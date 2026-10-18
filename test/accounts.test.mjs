import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createApp} from '../src/server.mjs';import {validPhone,validateProfile} from '../src/accounts.mjs';
const registration=(email='client@example.com',whatsapp='5522992888971')=>({firstName:'Cliente',lastName:'Teste',birthDate:'1992-05-19',email,password:'Customer-test-password',whatsapp,whatsappSecondary:'',role:'admin',trialDays:1000});
test('numeric international phones and registration fields reject malformed values without documents',()=>{
 for(const n of ['5522992888971','12125550123','351912345678','34612345678','27821234567'])assert.equal(validPhone(n),n);
 assert.equal(validateProfile(registration()).whatsappSecondary,null);assert(!('document' in validateProfile({...registration(),document:'ignored',documentType:'ignored'})));
 for(const patch of [{lastName:''},{birthDate:'2001-02-30'},{birthDate:'2999-01-01'},{whatsapp:''},{whatsapp:'5522992888971a'},{whatsapp:'+5522992888971'},{whatsapp:'(22) 99288-8971'},{whatsapp:' 5522992888971'},{whatsapp:'11111111111'},{whatsapp:'5500992888971'},{whatsapp:'551199999999'},{whatsappSecondary:'not a phone'},{whatsappSecondary:'5522992888971'}])assert.throws(()=>validateProfile({...registration(),...patch}),e=>e.status===400);
});
test('signup starts 7 days; email and both phone slots are unique, private and transactional',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-accounts-')),app=createApp({dir,master:'6'.repeat(64),bootstrap:'test-only-owner'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const req=async(path,body,token)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{
  assert.equal((await req('/v1/auth/register',registration())).status,503);
  const owner=await req('/v1/auth/bootstrap',{token:'test-only-owner',email:'owner@example.com',password:'Owner-test-password'});assert.equal(owner.status,201);
  const before=Date.now(),customer=await req('/v1/auth/register',{...registration(),whatsappSecondary:'5522992888972'});assert.equal(customer.status,201);assert.equal(customer.data.role,'customer');assert.equal(customer.data.license.status,'trial');const ws=customer.data.workspaceId;
  const sub=app.store.one('SELECT * FROM subscriptions WHERE workspace_id=?',ws);assert(sub.started_at>=before);assert.equal(sub.expires_at-sub.started_at,7*86400000);
  assert.equal((await req('/v1/auth/register',registration('other@example.com','5522992888972'))).status,409,'secondary number also reserves identity');
  assert.equal((await req('/v1/auth/register',{...registration('other@example.com','5522992888973'),whatsappSecondary:'5522992888971'})).status,409,'primary cannot be reused as another secondary');
  assert.equal((await req('/v1/auth/register',registration(' CLIENT@example.com ','5522992888973'))).status,409);
  assert.equal((await req('/v1/auth/register',registration('international@example.com','12125550123'))).status,201,'no country document required');
  assert.equal((await req('/v1/auth/register',registration('limit@example.com'))).status,429);
  const accounts=await req('/v1/admin/accounts',undefined,owner.data.accessToken),account=accounts.data.accounts.find(a=>a.workspaceId===ws);assert.equal(account.profile.firstName,'Cliente');assert.equal(account.profile.whatsapp,'5522992888971');assert(!('document' in account.profile));
  const record=app.store.one('SELECT * FROM account_profiles WHERE user_id=?',account.id);assert(!record.profile.includes('1992-05-19'));assert(!record.profile.includes('5522992888971'));assert(!JSON.stringify(app.store.all('SELECT * FROM account_phones')).includes('5522992888971'));
  assert.equal((await req('/v1/admin/accounts',undefined,customer.data.accessToken)).status,403);
  assert.equal(app.store.one('SELECT COUNT(*) AS n FROM users').n,3,'no orphan accounts');assert.equal(app.store.one('SELECT COUNT(*) AS n FROM account_phones').n,3);
  assert.equal((await req('/v1/admin/licenses',{},owner.data.accessToken)).status,410);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
