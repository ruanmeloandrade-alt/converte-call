import test from 'node:test';
import assert from 'node:assert/strict';
import {couponFixture} from './coupon-fixture.mjs';
test('admin creates real Stripe-backed amount/percent coupons; checkout validates codes and changes pending discounts safely',async()=>{
 const f=await couponFixture();try{
  const admin=(path,body,method)=>f.call(path,body,f.admin.accessToken,method),preview=body=>f.call('/checkout/api/coupon',body,null,'POST',f.cookie),pay=body=>f.call('/checkout/api/pay',body,null,'POST',f.cookie);
  assert.equal((await f.call('/v1/admin/coupons',{code:'NOPE20',type:'percent',value:20},f.customer.accessToken)).status,403);
  assert.equal((await admin('/v1/admin/coupons',{code:'BAD101',type:'percent',value:101})).status,400);
  let result=await admin('/v1/admin/coupons',{code:'boasvindas20',type:'percent',value:20,duration:'once',maxRedemptions:5});assert.equal(result.status,201);const percent=result.data.coupon;
  assert.equal(percent.code,'BOASVINDAS20');assert.equal(f.calls.find(c=>c.path==='/v1/coupons').form['applies_to[products][0]'],'prod_coupon');
  const fixed=(await admin('/v1/admin/coupons',{code:'REAL10',type:'amount',value:10,currency:'brl',duration:'forever'})).data.coupon;assert.equal(fixed.value,1000);
  const input={code:'boasvindas20',plan:'monthly',seats:2,currency:'brl'};result=await preview(input);assert.equal(result.status,200);assert.equal(result.data.discount,Math.round(result.data.subtotal*.2));assert.equal(result.data.total,result.data.subtotal-result.data.discount);assert.equal(result.data.stripeCouponId,undefined);
  assert.equal((await preview({...input,code:'REAL10',currency:'usd'})).status,400);assert.equal((await preview({...input,code:'MISSING'})).status,400);assert.equal((await f.call('/checkout/api/coupon',input)).status,401);
  const rates=f.app.billing.currencies.rates(),choice={plan:'monthly',seats:2,currency:'brl',rateRevision:rates.revision,couponCode:percent.code};assert.equal((await pay(choice)).status,200);
  const first=f.calls.filter(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST').at(-1);assert(first.form['discounts[0][coupon]']);assert.equal(first.form['metadata[couponCode]'],percent.code);
  assert.equal((await pay({...choice,couponCode:'REAL10'})).status,200);const second=f.calls.filter(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST').at(-1);assert.notEqual(first.idempotency,second.idempotency);assert.notEqual(first.form['discounts[0][coupon]'],second.form['discounts[0][coupon]']);assert(f.calls.some(c=>c.path.endsWith('/expire')));
  assert.equal((await pay({...choice,couponCode:''})).status,200);const without=f.calls.filter(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST').at(-1);assert.equal(without.form['discounts[0][coupon]'],undefined,'removing the coupon creates a session without the previous discount');
  await admin('/v1/admin/coupons/'+fixed.id,{active:false},'PATCH');assert.equal((await preview({...input,code:'REAL10'})).status,400);
  const provider=[...f.coupons.values()].find(c=>c.name===percent.code);provider.times_redeemed=5;assert.equal((await preview(input)).status,400);provider.times_redeemed=0;
  const row=f.app.store.one('SELECT definition FROM billing_coupons WHERE id=?',percent.id),def=JSON.parse(row.definition);def.expiresAt=Math.floor(Date.now()/1000)-1;f.app.store.run('UPDATE billing_coupons SET definition=? WHERE id=?',JSON.stringify(def),percent.id);assert.equal((await preview(input)).status,400);
  assert.equal((await admin('/v1/admin/coupons')).data.coupons.length,2);
 }finally{await f.close();}
});
test('signed Stripe discounted invoices grant access for actual paid amounts, including zero, reject unexplained underpayment and deduplicate',async()=>{
 const f=await couponFixture();try{
  const ws=f.customer.workspaceId,end=Math.floor(Date.now()/1000)+30*86400;
  f.app.store.run('INSERT INTO billing_customers VALUES(?,?)',ws,'cus_paid');
  f.subscriptions.set('sub_coupon',{id:'sub_coupon',customer:'cus_paid',status:'active',metadata:{application:'converte-call',workspaceId:ws,plan:'monthly',seats:'1'},items:{data:[{quantity:1,price:{id:'price_monthly'}}]}});
  const base={status:'paid',currency:'usd',customer:'cus_paid',parent:{subscription_details:{subscription:'sub_coupon'}},subtotal:698,total:558,amount_paid:558,total_discount_amounts:[{amount:140,discount:'di_coupon'}],lines:{data:[{pricing:{price_details:{price:'price_monthly'}},period:{end}}]}};
  f.invoices.set('in_discount',{id:'in_discount',...base});let result=await f.webhook({id:'evt_coupon1',type:'invoice.paid',data:{object:{id:'in_discount'}}});assert.equal(result.status,200);assert.equal(f.app.store.one('SELECT amount FROM billing_payments WHERE id=?','in_discount').amount,558);
  await f.webhook({id:'evt_coupon1',type:'invoice.paid',data:{object:{id:'in_discount'}}});assert.equal(f.app.store.one('SELECT count(*) n FROM billing_payments').n,1);
  f.invoices.set('in_zero',{id:'in_zero',...base,total:0,amount_paid:0,total_discount_amounts:[{amount:698,discount:'di_full'}]});result=await f.webhook({id:'evt_coupon2',type:'invoice.paid',data:{object:{id:'in_zero'}}});assert.equal(result.status,200);assert.equal(f.app.store.one('SELECT amount FROM billing_payments WHERE id=?','in_zero').amount,0);
  f.invoices.set('in_wrong',{id:'in_wrong',...base,total:1,amount_paid:1,total_discount_amounts:[]});await f.webhook({id:'evt_coupon3',type:'invoice.paid',data:{object:{id:'in_wrong'}}});assert.equal(f.app.store.one('SELECT id FROM billing_payments WHERE id=?','in_wrong'),undefined);assert.notEqual(f.app.store.one('SELECT plan FROM subscriptions WHERE workspace_id=?',ws).plan,'trial');
 }finally{await f.close();}
});
