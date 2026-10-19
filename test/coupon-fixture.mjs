import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {createApp} from '../src/server.mjs';
export async function couponFixture(){
 process.env.NODE_ENV='test';
 const root=mkdtempSync(join(tmpdir(),'cc-coupons-')),coupons=new Map(),sessions=new Map(),calls=[],subscriptions=new Map(),invoices=new Map(),secret='whsec_coupon_fixture';let serial=0;
 const fetcher=async(url,options)=>{
  const path=new URL(url).pathname,form=Object.fromEntries(new URLSearchParams(options.body));calls.push({path,form,method:options.method,idempotency:options.headers['Idempotency-Key']});
  if(path==='/v1/coupons'&&options.method==='POST'){const coupon={id:form.id,valid:true,times_redeemed:0,...form};coupons.set(coupon.id,coupon);return Response.json(coupon);}
  if(path.startsWith('/v1/coupons/'))return Response.json(coupons.get(path.split('/').at(-1))||{deleted:true});
  if(path==='/v1/customers')return Response.json({id:'cus_'+(++serial)});
  if(path==='/v1/prices')return Response.json({id:'price_'+(++serial)});
  if(path==='/v1/checkout/sessions'&&options.method==='POST'){const session={id:'cs_'+(++serial),url:'https://checkout.stripe.com/coupon-fixture',status:'open',expires_at:Number(form.expires_at),metadata:{catalogPriceId:form['metadata[catalogPriceId]']},...form};sessions.set(session.id,session);return Response.json(session);}
  if(path.startsWith('/v1/checkout/sessions/')){const id=path.split('/')[4],session=sessions.get(id);if(path.endsWith('/expire'))session.status='expired';return Response.json(session);}
  if(path.startsWith('/v1/subscriptions/'))return Response.json(subscriptions.get(path.split('/').at(-1)));
  if(path.startsWith('/v1/invoices/'))return Response.json(invoices.get(path.split('/').at(-1)));
  throw Error('Unhandled Stripe fixture '+options.method+' '+path);
 };
 const app=createApp({dir:join(root,'data'),master:'b'.repeat(64),bootstrap:'coupon-fixture',billingOptions:{publicUrl:'https://coupons.example',fetcher}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;app.billing.publicUrl=base;app.checkout.url=base+'/checkout';
 const call=async(path,body,token,method=body?'POST':'GET',cookie)=>{const response=await fetch(base+path,{method,headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 const admin=(await call('/v1/auth/bootstrap',{token:'coupon-fixture',email:'admin@coupons.test',password:'Coupon-fixture-password'})).data;
 app.billing.saveConfig({apiKey:'rk_test_COUPONFIXTUREONLY',webhookSecret:secret,productId:'prod_coupon',prices:{monthly:'price_monthly',quarterly:'price_quarterly'},teamPrices:{monthly:'price_team_monthly',quarterly:'price_team_quarterly'},portalId:'bpc_coupon'});
 const customer=(await call('/v1/auth/register',{firstName:'Cliente',lastName:'Teste',email:'buyer@coupons.test',password:'Coupon-fixture-password',birthDate:'1990-01-01',whatsapp:'5522991234567'})).data;
 const link=await call('/v1/billing/web-checkout',{},customer.accessToken);if(link.status!==200){await app.close();rmSync(root,{recursive:true,force:true});throw Error(JSON.stringify(link));}const ticket=new URL(link.data.url).hash.slice(8),cookie=(await call('/checkout/api/exchange',{access:ticket})).cookie;
 const webhook=async event=>{const raw=Buffer.from(JSON.stringify(event)),t=Math.floor(Date.now()/1000),signature=createHmac('sha256',secret).update(t+'.').update(raw).digest('hex');const response=await fetch(base+'/v1/hooks/stripe',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${signature}`},body:raw});return {status:response.status,data:await response.json()};};
 return {app,root,base,admin,customer,call,cookie,coupons,calls,sessions,subscriptions,invoices,webhook,close:async()=>{await app.close();rmSync(root,{recursive:true,force:true});}};
}
