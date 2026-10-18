import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {enrollPartner,assignReferral,recordCommission,partnerState} from '../src/partners.mjs';

test('bank onboarding is partner scoped, idempotent, Stripe hosted and checks real capabilities on return',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-bank-')),app=createApp({dir,master:'a'.repeat(64),billingOptions:{publicUrl:'https://converte.example'}});
 try{
  const make=(email)=>{const ws=app.store.createWorkspace(),user={id:randomUUID(),email,workspace_id:ws};app.store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',user.id,email,'test-only','test-only',ws,new Date().toISOString());return user;};
  const partner=make('partner@example.com'),other=make('other@example.com'),enrolled=enrollPartner(app.store,partner);
  let enabled=false,ready=false,broken=false,createCalls=0,linkCalls=0,metadata={application:'converte-call',partnerId:app.store.one('SELECT id FROM partners WHERE user_id=?',partner.id).id};const requests=[];
  const config={apiKey:'rk_test_only',accountId:'acct_platform',livemode:false};app.billing.config=()=>config;app.partnerBanking.enabled=()=>enabled;
  app.billing.api=async path=>{if(path==='/account')return {id:config.accountId,country:'BR'};assert.equal(path,'/accounts/acct_partner');return {id:'acct_partner',country:'BR',payouts_enabled:ready,requirements:{currently_due:ready?[]:['external_account'],pending_verification:[]},external_accounts:{data:ready?[{object:'bank_account',default_for_currency:true,bank_name:'Banco de teste',last4:'1234',currency:'brl',status:'new',routing_number:'MUST_NOT_LEAK',account_holder_name:'MUST_NOT_LEAK'}]:[]}};};
  app.billing.fetcher=async(url,options)=>{requests.push({url,options});if(broken)throw Error('offline');const path=new URL(url).pathname;
   if(path==='/v2/core/accounts'&&options.method==='GET')return Response.json({data:[]});
   if(path==='/v2/core/accounts'&&options.method==='POST'){createCalls++;const input=JSON.parse(options.body);assert.equal(input.dashboard,'express');assert.deepEqual(input.configuration,{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}});assert.equal(input.contact_email,partner.email);assert.equal(input.identity.country,'br');assert(!JSON.stringify(input).includes('tos_acceptance'));return Response.json({id:'acct_partner',livemode:false});}
   if(path==='/v2/core/account_links'){linkCalls++;const b=JSON.parse(options.body),onboard=b.use_case.account_onboarding;assert.equal(b.account,'acct_partner');assert.deepEqual(onboard.configurations,['recipient']);assert.equal(new URL(onboard.return_url).origin,'https://converte.example');return Response.json({account:'acct_partner',url:'https://accounts.stripe.com/r/secure-onboarding'});}
   assert.equal(path,'/v2/core/accounts/acct_partner');return Response.json({id:'acct_partner',livemode:false,metadata,configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:ready?'active':'pending'},payouts:{status:ready?'active':'pending'}}}}}});
  };
  assert.equal((await app.partnerBanking.status(partner)).enabled,false);await assert.rejects(app.partnerBanking.onboarding(partner),e=>e.status===503);assert.equal(createCalls,0);
  enabled=true;await assert.rejects(app.partnerBanking.onboarding(other),e=>e.status===403);await assert.rejects(app.partnerBanking.onboarding(partner,{country:'US'}),e=>e.status===400);
  assert.equal((await app.partnerBanking.onboarding(partner)).url,'https://accounts.stripe.com/r/secure-onboarding');await app.partnerBanking.onboarding(partner);assert.equal(createCalls,1);assert.equal(linkCalls,2);
  assert.equal((await app.partnerBanking.status(partner)).status,'incomplete');ready=true;const status=await app.partnerBanking.status(partner);assert.equal(status.status,'connected');assert.equal(status.bank.last4,'1234');assert(!JSON.stringify(status).includes('MUST_NOT_LEAK'));assert(!JSON.stringify(app.store.all('SELECT * FROM partner_bank_accounts')).includes('secure-onboarding'));
  broken=true;assert.equal((await app.partnerBanking.status(partner)).status,'unknown');broken=false;metadata={...metadata,partnerId:'someone-else'};await assert.rejects(app.partnerBanking.status(partner),e=>e.status===409);
  config.accountId='acct_otherplatform';await assert.rejects(app.partnerBanking.onboarding(partner),e=>e.status===409);config.accountId='acct_platform';
  const buyer=make('buyer@example.com');assignReferral(app.store,buyer.workspace_id,enrolled.code);
  for(const [index,currency,status]of [[0,'brl','held'],[1,'brl','paid'],[2,'brl','reversed'],[3,'usd','held']]){const now=Date.now()-20*86400000,payment={id:'in_'+index,workspace_id:buyer.workspace_id,provider:'stripe',amount:698,currency,created_at:now};app.store.run('INSERT INTO billing_payments(id,workspace_id,provider,plan,amount,currency,period_end,created_at,seats) VALUES(?,?,?,?,?,?,?,?,1)',payment.id,buyer.workspace_id,'stripe','monthly',698,currency,now+86400000,now);recordCommission(app.store,payment,{fee:48,currency,firstPurchase:index===0});app.store.run('UPDATE partner_commissions SET status=? WHERE payment_id=?',status,payment.id);}
  const totals=partnerState(app.store,partner).totals,brl=totals.find(t=>t.currency==='brl');assert.equal(brl.commission,845);assert.equal(brl.receivable,520);assert.equal(brl.paid,325);assert.equal(brl.reversed,325);assert.equal(brl.available,520);assert.equal(totals.length,2);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
