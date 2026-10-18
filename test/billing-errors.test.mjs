import test from 'node:test';
import assert from 'node:assert/strict';
import {Billing} from '../src/billing.mjs';

test('restricted Stripe errors identify the refused operation without exposing credentials or request data',async()=>{
 const key='rk_test_PRIVATE_DIAGNOSTIC_FIXTURE',records=[],original=console.error;
 const billing=Object.create(Billing.prototype);
 billing.fetcher=async()=>Response.json({error:{code:'more_permissions_required',message:'The key '+key+' cannot access this endpoint.'}},{status:403,headers:{'request-id':'req_diagnostic'}});
 console.error=line=>records.push(JSON.parse(line));
 try{
  await assert.rejects(()=>billing.api('/prices',{method:'POST',key,body:{unit_amount:3839,customer:'cus_PRIVATE'}}),e=>e.status===502&&e.stripeStatus===403&&e.stripeStep==='/prices');
  await assert.rejects(()=>billing.api('/subscriptions/sub_PRIVATE?expand[]=customer',{key}),e=>e.stripeStep==='/subscriptions/:id');
  assert.deepEqual(records[0],{type:'stripe-operation-failed',method:'POST',step:'/prices',status:403,code:'more_permissions_required',requestId:'req_diagnostic',permissions:[]});
  const output=JSON.stringify(records);for(const secret of [key,'3839','cus_PRIVATE','sub_PRIVATE','expand'])assert(!output.includes(secret));
 }finally{console.error=original;}
});
