import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHmac,randomUUID} from 'node:crypto';import {createApp} from '../src/server.mjs';import {addMonths,verifyStripeEvent,PLANS} from '../src/billing.mjs';
const SECRET='whsec_local_only_test',API_KEY='rk_test_LOCALONLYTESTKEYNOTREAL';
test('billing catalog has exact requested amounts/messages and calendar months clamp correctly',()=>{
 assert.deepEqual(PLANS.map(p=>[p.id,p.usd,p.brl,p.months]),[['monthly',698,2990,1],['quarterly',1658,6790,3]]);
 assert.equal(PLANS[0].pixMessage,'#PIXm-bR | ☝😎Olá, quero fazer o pagamento do Plano Mensal no pix! Valor -> *R$29,90*💜');assert.equal(PLANS[1].pixMessage,'#PIXt-bR | ☝😎Olá, quero fazer o pagamento do Plano Trimestral no pix!Valor -> *R$67,90*💜');
 assert.equal(readFileSync(new URL('../vendor/billing-catalog.js',import.meta.url),'utf8'),readFileSync(new URL('../extension/billing-catalog.js',import.meta.url),'utf8'));
 assert.equal(new Date(addMonths(Date.parse('2028-01-31T15:20:00Z'),1)).toISOString(),'2028-02-29T15:20:00.000Z');assert.equal(new Date(addMonths(Date.parse('2026-11-30T10:00:00Z'),3)).toISOString(),'2027-02-28T10:00:00.000Z');
 const raw=Buffer.from('{"id":"evt_test"}'),t=Math.floor(Date.now()/1000),v=createHmac('sha256',SECRET).update(t+'.').update(raw).digest('hex');assert.equal(verifyStripeEvent(raw,`t=${t},v1=${v}`,SECRET).id,'evt_test');assert.throws(()=>verifyStripeEvent(raw,`t=${t},v1=${v}`,SECRET,Date.now()+400000));assert.throws(()=>verifyStripeEvent(Buffer.from('{}'),`t=${t},v1=${v}`,SECRET));
});
test('real HTTP billing authorizes admin/Pix, verifies signed payments, deduplicates and never trusts success redirect',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-billing-')),calls=[];let mode='open',invoiceStatus='paid',cancel=false,subStatus='active',price='price_monthly',end=Math.floor(Date.now()/1000)+30*86400,workspace;
 const fakeStripe=async(url,init)=>{
  const path=new URL(url).pathname,form=Object.fromEntries(new URLSearchParams(init.body));calls.push({path,method:init.method,form,key:init.headers.Authorization,version:init.headers['Stripe-Version'],idempotency:init.headers['Idempotency-Key']});
  if(path==='/v1/account')return Response.json({id:'acct_LOCAL',charges_enabled:true});
  if(path==='/v1/products')return Response.json({id:'prod_LOCAL'});
  if(path==='/v1/prices')return Response.json({id:Number(form['recurring[interval_count]'])===1?'price_monthly':'price_quarterly'});
  if(path==='/v1/webhook_endpoints')return Response.json({id:'we_LOCAL',secret:SECRET});
  if(path==='/v1/billing_portal/configurations')return Response.json({id:'bpc_LOCAL'});
  if(path==='/v1/customers')return Response.json({id:'cus_LOCAL'});
  if(path==='/v1/checkout/sessions'&&init.method==='POST')return Response.json({id:'cs_LOCAL',url:'https://checkout.stripe.com/test_local',expires_at:Number(form.expires_at)});
  if(path==='/v1/checkout/sessions/cs_LOCAL')return Response.json({id:'cs_LOCAL',url:'https://checkout.stripe.com/test_local',expires_at:Math.floor(Date.now()/1000)+3600,status:mode,mode:'subscription',payment_status:mode==='complete'?'paid':'unpaid',subscription:'sub_LOCAL',invoice:'in_LOCAL'});
  if(path==='/v1/subscriptions/sub_LOCAL')return Response.json({id:'sub_LOCAL',customer:'cus_LOCAL',status:subStatus,cancel_at_period_end:cancel,metadata:{workspaceId:workspace,plan:'monthly',application:'converte-call'},items:{data:[{quantity:1,price:{id:price}}]}});
  if(path==='/v1/invoices/in_LOCAL')return Response.json({id:'in_LOCAL',status:invoiceStatus,amount_paid:invoiceStatus==='paid'?698:0,currency:'usd',customer:'cus_LOCAL',parent:{subscription_details:{subscription:'sub_LOCAL'}},lines:{data:[{pricing:{price_details:{price}},period:{end}}]}});
  if(path==='/v1/billing_portal/sessions')return Response.json({url:'https://billing.stripe.com/local_portal'});
  throw Error('Unexpected provider request '+path);
 };
 const app=createApp({dir,master:'d'.repeat(64),bootstrap:'local-only-bootstrap',billingOptions:{publicUrl:'https://billing.example',fetcher:fakeStripe}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,token,body,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():await r.text()};};
 let eventNo=0;const hook=async(type,object,options={})=>{const raw=Buffer.from(JSON.stringify({id:options.id||'evt_'+(++eventNo),livemode:options.live??false,type,data:{object}})),t=Math.floor(Date.now()/1000)+(options.offset||0),signature=createHmac('sha256',SECRET).update(t+'.').update(raw).digest('hex');const r=await fetch(base+'/v1/hooks/stripe',{method:'POST',body:raw,headers:{'Stripe-Signature':`t=${t},v1=${options.invalid?'0'.repeat(64):signature}`}});return {status:r.status,data:await r.json()};};
 try{
  const admin=(await call('/v1/auth/bootstrap',null,{token:'local-only-bootstrap',email:'admin@example.com',password:'Only-test-admin-password'})).data;
  const register=(email,whatsapp)=>call('/v1/auth/register',null,{firstName:'Cliente',lastName:'Teste',birthDate:'1990-01-01',email,whatsapp,password:'Only-test-customer-password'});
  const customer=(await register('customer@example.com','5522992888971')).data;workspace=customer.workspaceId;const other=(await register('pix@example.com','5522992888972')).data;
  assert.equal((await call('/v1/admin/billing',customer.accessToken,{apiKey:API_KEY})).status,403);
  assert.equal((await call('/v1/billing/checkout',customer.accessToken,{plan:'monthly'})).status,503);
  assert.equal((await call('/v1/admin/billing',admin.accessToken,{apiKey:API_KEY})).status,410,'even an administrator cannot replace Stripe through HTTP');const actor=app.store.one('SELECT * FROM users WHERE workspace_id=?',admin.workspaceId);await assert.rejects(()=>app.billing.connect(actor,{apiKey:API_KEY,accountId:'acct_WRONG'}),e=>e.status===409);assert.equal(app.billing.config(),null,'wrong receiver cannot save credentials');const connected=await app.billing.connect(actor,{apiKey:API_KEY,accountId:'acct_LOCAL'});assert(connected.configured);assert.equal(connected.livemode,false);assert(!JSON.stringify(connected).includes(API_KEY));assert(!JSON.stringify(app.store.all('SELECT * FROM secrets')).includes(API_KEY));
  const prices=calls.filter(c=>c.path==='/v1/prices');assert.deepEqual(prices.map(p=>[p.form.unit_amount,p.form.currency,p.form['recurring[interval_count]']]),[['698','usd','1'],['1658','usd','3']]);
  assert.equal((await call('/v1/billing/checkout',customer.accessToken,{plan:'semiannual'})).status,400);
  const before=app.store.one('SELECT * FROM subscriptions WHERE workspace_id=?',workspace).expires_at;
  const checkout=await call('/v1/billing/checkout',customer.accessToken,{plan:'monthly',amount:1,workspaceId:other.workspaceId,locale:'pt-BR'});assert.equal(checkout.status,200);assert(checkout.data.url.startsWith('https://checkout.stripe.com/'));
  await call('/v1/billing/checkout',customer.accessToken,{plan:'monthly'});assert.equal(calls.filter(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST').length,1,'reuse pending checkout');
  const request=calls.find(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST');assert.equal(request.form.mode,'subscription');assert.equal(request.form['line_items[0][price]'],'price_monthly');assert.equal(request.form.client_reference_id,workspace);assert.equal(request.form['adaptive_pricing[enabled]'],'false');assert(!Object.keys(request.form).some(k=>k.startsWith('payment_method_types')));assert.match(request.form.integration_identifier,/^converte_call_[a-z]{8}$/);
  assert.equal((await call('/billing/success')).status,200);assert.equal(app.store.one('SELECT expires_at FROM subscriptions WHERE workspace_id=?',workspace).expires_at,before,'success page never grants access');
  assert.equal((await hook('invoice.paid',{id:'in_LOCAL'},{invalid:true})).status,400);assert.equal((await hook('invoice.paid',{id:'in_LOCAL'},{offset:-400})).status,400);assert.equal((await hook('invoice.paid',{id:'in_LOCAL'},{live:true})).status,400);
  mode='complete';assert.equal((await hook('checkout.session.completed',{id:'cs_LOCAL'},{id:'evt_first'})).status,200);assert.equal(app.store.one('SELECT expires_at FROM subscriptions WHERE workspace_id=?',workspace).expires_at,end*1000);
  assert((await hook('checkout.session.completed',{id:'cs_LOCAL'},{id:'evt_first'})).data.duplicate);await hook('invoice.paid',{id:'in_LOCAL'});assert.equal(app.store.one('SELECT COUNT(*) AS n FROM billing_payments').n,1,'invoice deduplicated across event types');
  assert.equal((await call('/v1/billing/checkout',customer.accessToken,{plan:'quarterly'})).status,409,'prevent duplicate subscription');
  invoiceStatus='open';end+=30*86400;await hook('invoice.payment_failed',{id:'in_LOCAL'});assert.equal(app.store.one('SELECT expires_at FROM subscriptions WHERE workspace_id=?',workspace).expires_at,(end-30*86400)*1000,'failed renewal does not extend');
  cancel=true;await hook('customer.subscription.updated',{id:'sub_LOCAL'});assert.equal((await call('/v1/billing',customer.accessToken)).data.subscription.cancel_at_period_end,1);assert.equal((await call('/v1/billing/portal',customer.accessToken,{})).status,200);
  const payment={plan:'quarterly',received:true,idempotencyKey:randomUUID()};assert.equal((await call('/v1/admin/accounts/'+other.workspaceId+'/payment',customer.accessToken,payment)).status,403);assert.equal((await call('/v1/admin/accounts/'+other.workspaceId+'/payment',admin.accessToken,{...payment,received:false})).status,400);
  const pix=await call('/v1/admin/accounts/'+other.workspaceId+'/payment',admin.accessToken,payment);assert.equal(pix.status,200);assert.equal(pix.data.license.plan,'Trimestral');assert(pix.data.license.remainingDays>=89);const until=pix.data.license.expiresAt;
  const duplicate=await call('/v1/admin/accounts/'+other.workspaceId+'/payment',admin.accessToken,payment);assert(duplicate.data.duplicate);assert.equal(duplicate.data.license.expiresAt,until);assert.equal(app.store.one("SELECT amount FROM billing_payments WHERE provider='pix'").amount,6790);
  assert.equal((await call('/v1/admin/accounts/'+workspace+'/payment',admin.accessToken,payment)).status,409,'same manual receipt cannot be reassigned');
  const monthly=await call('/v1/admin/accounts/'+other.workspaceId+'/payment',admin.accessToken,{plan:'monthly',received:true,idempotencyKey:randomUUID()});assert.equal(monthly.status,200);assert.equal(app.store.all("SELECT amount FROM billing_payments WHERE provider='pix' ORDER BY created_at DESC")[0].amount,2990);assert(Date.parse(monthly.data.license.expiresAt)>Date.parse(until));
  subStatus='canceled';await hook('customer.subscription.deleted',{id:'sub_LOCAL'});assert.equal((await call('/v1/billing/checkout',customer.accessToken,{plan:'monthly'})).status,200,'allow new Checkout after an actual canceled subscription');
  assert.equal(app.store.one('SELECT COUNT(*) AS n FROM users').n,3);assert.equal((await call('/v1/admin/billing')).status,401);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
