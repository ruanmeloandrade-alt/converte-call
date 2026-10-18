import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHmac} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {quote} from '../src/billing.mjs';

test('Equipe charges only employees, preserves individual Pix text and rejects invalid seat counts',()=>{
 assert.deepEqual([quote('monthly',7).usd,quote('monthly',7).brl],[1598,5990]);
 assert.deepEqual([quote('quarterly',7).usd,quote('quarterly',7).brl],[4358,15790]);
 assert.deepEqual([quote('quarterly',2).usd,quote('quarterly',2).brl],[2108,8290]);
 assert.match(quote('quarterly',7).pixMessage,/\*R\$157,90\*/);
 assert.match(quote('monthly',2).pixMessage,/titular \+ 1 funcionário/);
 for(const seats of [0,8,1.5,'7',null,-1])assert.throws(()=>quote('monthly',seats),e=>e.status===400);
});

test('HTTP Equipe: paid invoice and confirmed Pix grant seats, amounts and receipt retries are enforced',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-team-billing-')),secret='whsec_team_local',calls=[];
 let ws,subscriptionSeats='7',quantity=6,invoiceQuantity=6,amount=1598,paid=false,invoiceId='in_team',plan='monthly',end=Math.floor(Date.now()/1000)+31*86400;
 const stripe=async(url,init)=>{
  const path=new URL(url).pathname,form=Object.fromEntries(new URLSearchParams(init.body));calls.push({path,form,method:init.method});
  if(path==='/v1/account')return Response.json({id:'acct_TEAM',charges_enabled:true});
  if(path==='/v1/products')return Response.json({id:'prod_team'});
  if(path==='/v1/prices')return Response.json({id:'price_'+(form['metadata[kind]']==='team-seat'?'team_':'')+form['metadata[plan]']});
  if(path==='/v1/webhook_endpoints')return Response.json({id:'we_team',secret});
  if(path==='/v1/billing_portal/configurations')return Response.json({id:'bpc_team'});
  if(path==='/v1/customers')return Response.json({id:'cus_team'});
  if(path==='/v1/checkout/sessions'&&init.method==='POST')return Response.json({id:'cs_team',url:'https://checkout.stripe.com/local',expires_at:Number(form.expires_at)});
  if(path==='/v1/checkout/sessions/cs_team/expire')return Response.json({id:'cs_team',status:'expired'});
  if(path==='/v1/checkout/sessions/cs_team')return Response.json({id:'cs_team',status:'open',url:'https://checkout.stripe.com/local',expires_at:Math.floor(Date.now()/1000)+3600});
  if(path==='/v1/subscriptions/sub_team')return Response.json({id:'sub_team',customer:'cus_team',status:'active',metadata:{workspaceId:ws,application:'converte-call',plan,seats:subscriptionSeats},items:{data:[{price:'price_'+plan,quantity:1},...(quantity?[{price:'price_team_'+plan,quantity}]:[])]}});
  if(path.startsWith('/v1/invoices/'))return Response.json({id:invoiceId,status:paid?'paid':'open',amount_paid:paid?amount:0,currency:'usd',customer:'cus_team',parent:{subscription_details:{subscription:'sub_team'}},lines:{data:[{pricing:{price_details:{price:'price_'+plan}},quantity:1,period:{end}},...(quantity?[{pricing:{price_details:{price:'price_team_'+plan}},quantity:invoiceQuantity,period:{end}}]:[])]}});
  throw Error('Unexpected Stripe test request '+path);
 };
 const app=createApp({dir,master:Buffer.alloc(32,19).toString('hex'),bootstrap:'local-team',billingOptions:{fetcher:stripe,publicUrl:'https://example.com'}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,token,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 const hook=async()=>{const raw=JSON.stringify({id:'evt_'+randomUUID(),livemode:false,type:'invoice.paid',data:{object:{id:invoiceId}}}),t=Math.floor(Date.now()/1000),signature=createHmac('sha256',secret).update(t+'.'+raw).digest('hex');return fetch(base+'/v1/hooks/stripe',{method:'POST',headers:{'Stripe-Signature':`t=${t},v1=${signature}`},body:raw});};
 try{
  const admin=(await call('/v1/auth/bootstrap',null,{token:'local-team',email:'owner@example.com',password:'Local-owner-password123'})).data;
  const user=(await call('/v1/auth/register',null,{firstName:'Cliente',lastName:'Equipe',birthDate:'1990-01-01',email:'team@example.com',whatsapp:'5522992888971',password:'Local-customer-password123'})).data;ws=user.workspaceId;
  await app.billing.connect(app.store.one('SELECT * FROM users WHERE workspace_id=?',admin.workspaceId),{apiKey:'rk_test_LOCALONLYTEAMKEY',accountId:'acct_TEAM'});
  assert.equal((await call('/v1/billing/checkout',user.accessToken,{plan:'monthly',seats:8})).status,400);
  assert.equal((await call('/v1/billing/checkout',user.accessToken,{plan:'monthly',seats:7})).status,200);
  const session=calls.find(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST');
  assert.equal(session.form['line_items[0][quantity]'],'1');assert.equal(session.form['line_items[1][price]'],'price_team_monthly');assert.equal(session.form['line_items[1][quantity]'],'6');
  assert.equal(session.form['subscription_data[metadata][seats]'],'7');
  const seats=()=>app.store.one('SELECT seats FROM team_settings WHERE workspace_id=?',ws).seats;
  assert.equal(seats(),1,'opening Checkout never grants seats');
  assert.equal((await hook()).status,200);assert.equal(seats(),1,'unpaid invoice never grants seats');
  paid=true;quantity=5;assert.equal((await hook()).status,409);assert.equal(seats(),1,'mismatched subscription quantity rejected');
  quantity=6;invoiceQuantity=5;assert.equal((await hook()).status,409);assert.equal(seats(),1,'mismatched invoice quantity rejected');
  invoiceQuantity=6;assert.equal((await hook()).status,200);assert.equal(seats(),7);
  assert.equal((await hook()).status,200);assert.equal(app.store.one('SELECT count(*) AS n FROM billing_payments').n,1,'invoice retries deduplicated');
  const before=calls.filter(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST').length;
  assert.equal((await call('/v1/billing/checkout',user.accessToken,{plan:'quarterly',seats:7})).status,409);assert.equal(calls.filter(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST').length,before,'no duplicate active subscription');
  const pix=(await call('/v1/auth/register',null,{firstName:'Cliente',lastName:'Pix',birthDate:'1990-01-01',email:'pixteam@example.com',whatsapp:'5522992888972',password:'Local-customer-password123'})).data;
  const receipt={plan:'quarterly',seats:7,received:true,idempotencyKey:randomUUID()};
  assert.equal((await call('/v1/admin/accounts/'+pix.workspaceId+'/payment',user.accessToken,receipt)).status,403);
  assert.equal((await call('/v1/admin/accounts/'+pix.workspaceId+'/payment',admin.accessToken,receipt)).status,200);
  assert.equal(app.store.one("SELECT amount FROM billing_payments WHERE provider='pix'").amount,15790);
  assert.equal(app.store.one('SELECT seats FROM team_settings WHERE workspace_id=?',pix.workspaceId).seats,7);
  assert((await call('/v1/admin/accounts/'+pix.workspaceId+'/payment',admin.accessToken,receipt)).data.duplicate);
  assert.equal((await call('/v1/admin/accounts/'+pix.workspaceId+'/payment',admin.accessToken,{...receipt,seats:6})).status,409,'receipt cannot be reused with different seats');
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

