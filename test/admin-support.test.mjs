import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.mjs';
import {createManagedAccount,publicRegistrationUrl} from '../src/admin-accounts.mjs';

test('public registration never inherits the administration subdomain',()=>{
 assert.equal(publicRegistrationUrl('https://adm.convertecall.pro/admin'),'https://convertecall.pro/register');
 assert.equal(publicRegistrationUrl('https://admin.convertecall.pro'),'https://convertecall.pro/register');
 assert.equal(publicRegistrationUrl(),'https://convertecall.pro/register');
});

test('admin support changes only the selected immutable account, revokes access and never stores password in audit',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-admin-support-')),app=createApp({dir,master:'c'.repeat(64),bootstrap:'support-test'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;app.billing.publicUrl=base;
 const call=async(path,body,token,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{Origin:base,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{
  const admin=(await call('/v1/auth/bootstrap',{token:'support-test',email:'admin@example.com',password:'Admin-test-password'})).data;
  const actor=app.store.one('SELECT * FROM users WHERE email=?','admin@example.com');
  const first=await createManagedAccount(app.store,actor,{kind:'partner',firstName:'Teste',email:'partner@example.com'},base);
  const second=await createManagedAccount(app.store,actor,{kind:'customer',firstName:'Outro',email:'other@example.com'},base);
  const login=async(email,password)=>(await call('/v1/auth/session',{email,password,rememberDevice:true}));
  const firstLogin=(await login(first.email,first.password)).data,otherLogin=(await login(second.email,second.password)).data;
  const path='/v1/admin/accounts/'+first.userId+'/support';
  assert.equal((await call(path,{action:'email',email:'hijack@example.com'},otherLogin.accessToken,'PATCH')).status,403);
  assert.equal((await call(path,{action:'email',email:second.email},admin.accessToken,'PATCH')).status,409);
  assert.equal((await call(path,{action:'password',password:'short'},admin.accessToken,'PATCH')).status,400);
  assert.equal((await call('/v1/admin/accounts/'+actor.id+'/support',{action:'password',password:'Cannot-change-admin'},admin.accessToken,'PATCH')).status,400);
  const changed=await call(path,{action:'email',email:'UPDATED@example.com'},admin.accessToken,'PATCH');
  assert.equal(changed.status,200);assert.equal(changed.data.email,'updated@example.com');
  assert.equal((await call('/v1/account/license',null,firstLogin.accessToken)).status,401);
  assert.equal((await call('/v1/account/license',null,otherLogin.accessToken)).status,200);
  const before=app.store.one('SELECT workspace_id FROM users WHERE id=?',first.userId);
  assert.equal((await login('updated@example.com',first.password)).status,200);
  const password='New-review-password-2026';
  assert.equal((await call(path,{action:'password',password},admin.accessToken,'PATCH')).status,200);
  assert.equal((await login('updated@example.com',first.password)).status,401);
  assert.equal((await login('updated@example.com',password)).status,200);
  assert.deepEqual(app.store.one('SELECT workspace_id FROM users WHERE id=?',first.userId),before);
  assert.equal(app.store.one('SELECT count(*) n FROM partners WHERE user_id=?',first.userId).n,1);
  const audit=await call('/v1/admin/license-audit',null,admin.accessToken);
  assert(!JSON.stringify(audit).includes(password));assert(!JSON.stringify(audit).includes('password_hash'));
  const ws=before.workspace_id,expires=app.store.one('SELECT expires_at FROM subscriptions WHERE workspace_id=?',ws).expires_at;
  assert.equal((await call('/v1/admin/accounts/'+ws+'/subscription',{suspended:true},admin.accessToken,'PATCH')).data.license.status,'suspended');
  assert.equal((await call('/v1/admin/accounts/'+ws+'/subscription',{suspended:false},admin.accessToken,'PATCH')).data.license.active,true);
  assert.equal(app.store.one('SELECT expires_at FROM subscriptions WHERE workspace_id=?',ws).expires_at,expires);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
