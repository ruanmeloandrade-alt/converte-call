import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {Store} from '../src/database.mjs';
import {subscription,updateSubscription,roleOf} from '../src/licensing.mjs';
import {hashPassword} from '../src/security.mjs';

const DAY=86400000,master='7'.repeat(64),bootstrap='test-license-bootstrap-only';

test('automatic trial, administrator authority, expiry and manual renewal use the server clock',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-licenses-'));let app=createApp({dir,master,bootstrap});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;process.env.PUBLIC_URL=base;
 const call=async(path,{accessToken,body,method=body?'POST':'GET'}={})=>{
  const r=await fetch(base+path,{method,headers:{...(accessToken?{Authorization:'Bearer '+accessToken}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json()};
 };
 const customer=email=>({email,password:'Customer-test-password',firstName:'Cliente',lastName:'Teste',birthDate:'1992-05-19',whatsapp:'5522992888971',role:'admin',days:99999});
 try{
  const owner=await call('/v1/auth/bootstrap',{body:{token:bootstrap,email:'owner@example.com',password:'Admin-test-password'}});
  assert.equal(owner.status,201);assert.equal(owner.data.role,'admin');assert.equal(owner.data.license.status,'admin');
  const admin=owner.data.accessToken;
  const accountsBefore=app.store.one('SELECT COUNT(*) AS n FROM users').n;
  assert.equal((await call('/v1/auth/register',{body:{...customer('missing@example.com'),whatsapp:''}})).status,400);
  assert.equal(app.store.one('SELECT COUNT(*) AS n FROM users').n,accountsBefore);
  const beforeActivation=Date.now(),activation=await call('/v1/auth/register',{body:customer('client@example.com')});
  assert.equal(activation.status,201);assert.equal(activation.data.role,'customer');
  const client=activation.data.accessToken,workspaceId=activation.data.workspaceId;
  const record=app.store.one('SELECT * FROM subscriptions WHERE workspace_id=?',workspaceId);
  assert.equal(record.expires_at-record.started_at,7*DAY);assert(record.started_at>=beforeActivation);
  assert.equal((await call('/v1/admin/accounts',{accessToken:client})).status,403);
  assert.equal((await call('/v1/admin/licenses',{accessToken:client,body:{}})).status,403);
  assert.equal((await call('/v1/admin/accounts/'+workspaceId+'/subscription',{accessToken:client,method:'PATCH',body:{days:3650,plan:'Mensal'}})).status,403);
  assert.equal((await call('/v1/workspace',{accessToken:client})).status,200);
  assert.equal((await call('/v1/auth/register',{body:customer('CLIENT@example.com')})).status,409);
  const pixel=await call('/v1/tracking/pixels',{accessToken:client,body:{name:'Site do cliente',url:'https://customer.example'}});
  assert.equal(pixel.status,201);
  app.store.run('UPDATE subscriptions SET expires_at=? WHERE workspace_id=?',Date.now()-1,workspaceId);
  assert.equal((await call('/v1/workspace',{accessToken:client})).status,402);
  assert.equal((await call('/v1/whatsapp/session',{accessToken:client,method:'POST',body:{}})).status,402,'expired account is blocked before provider request');
  assert.equal((await call('/v1/slim/rpc',{accessToken:client,body:{module:'@/lib/crm.functions',method:'createLead',data:{name:'Blocked'}}})).status,402);
  const deniedPixel=await fetch(base+'/p/'+pixel.data.pixel.public_key+'.js');assert.equal(deniedPixel.status,402);
  const state=await call('/v1/account/license',{accessToken:client});assert.equal(state.status,200);assert.equal(state.data.license.status,'expired');
  const reentry=await call('/v1/auth/session',{body:{email:'client@example.com',password:'Customer-test-password'}});
  assert.equal(reentry.status,200);assert.equal(reentry.data.license.status,'expired','logging in cannot restart the trial');
  assert.equal((await call('/v1/workspace',{accessToken:reentry.data.accessToken})).status,402);
  const renewed=await call('/v1/admin/accounts/'+workspaceId+'/subscription',{accessToken:admin,method:'PATCH',body:{days:30,plan:'Mensal',suspended:false}});
  assert.equal(renewed.status,200);assert.equal(renewed.data.license.status,'active');
  assert.equal((await call('/v1/workspace',{accessToken:reentry.data.accessToken})).status,200);
  const expiresAt=new Date(Date.now()+90*DAY).toISOString();
  const dated=await call('/v1/admin/accounts/'+workspaceId+'/subscription',{accessToken:admin,method:'PATCH',body:{expiresAt,plan:'Semestral'}});
  assert.equal(dated.status,200);assert.equal(dated.data.license.expiresAt,expiresAt,'administrator can define exact validity');
  assert.equal((await call('/v1/admin/accounts/'+workspaceId+'/subscription',{accessToken:admin,method:'PATCH',body:{days:0,plan:'Mensal'}})).status,400);
  assert.equal((await call('/v1/admin/accounts/'+workspaceId+'/subscription',{accessToken:admin,method:'PATCH',body:{expiresAt:'2026-12-01T10:00',plan:'Mensal'}})).status,400,'timezone required');
  assert.equal((await call('/v1/admin/accounts/'+owner.data.workspaceId+'/subscription',{accessToken:admin,method:'PATCH',body:{days:30,plan:'Mensal'}})).status,400);
  assert.equal((await call('/v1/admin/accounts/'+workspaceId+'/subscription',{accessToken:admin,method:'PATCH',body:{suspended:true}})).data.license.status,'suspended');
  assert.equal((await call('/v1/workspace',{accessToken:reentry.data.accessToken})).status,402);
  const revision=app.store.revision(workspaceId);app.worker.projects(workspaceId);assert.equal(app.store.revision(workspaceId),revision);
  for(let i=0;i<35;i++)app.store.enqueue(workspaceId,'brain-index',{sourceId:'not-present'},{id:'expired-'+i,dueAt:0});
  app.store.enqueue(owner.data.workspaceId,'brain-index',{sourceId:'not-present'},{id:'admin-after-expired-jobs',dueAt:1});
  await app.worker.tick();
  assert.equal(app.store.one('SELECT status FROM jobs WHERE id=?','expired-0').status,'pending');
  assert.equal(app.store.one('SELECT status FROM jobs WHERE id=?','admin-after-expired-jobs').status,'done','inactive accounts cannot starve another account worker jobs');
  await call('/v1/admin/accounts/'+workspaceId+'/subscription',{accessToken:admin,method:'PATCH',body:{suspended:false}});
  assert.equal((await call('/v1/account/license',{accessToken:reentry.data.accessToken})).data.license.status,'active');
  assert.equal((await call('/v1/auth/logout',{accessToken:reentry.data.accessToken,method:'POST'})).status,200);
  await app.close();app=null;
  const reopened=new Store(dir,master);assert.equal(subscription(reopened,workspaceId).expiresAt,expiresAt);assert.equal(roleOf(reopened,reopened.one('SELECT id FROM users WHERE email=?','client@example.com').id),'customer');reopened.close();
 }finally{if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('existing bootstrap owner becomes administrator without changing stored customer data',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-license-upgrade-'));let store=new Store(dir,master);
 try{
  const workspaceId=store.createWorkspace(),credentials=await hashPassword('Legacy-test-password'),userId=randomUUID();
  store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',userId,'legacy@example.com',credentials.hash,credentials.salt,workspaceId,new Date().toISOString());
  const original=JSON.stringify(store.get(workspaceId));
  store.db.exec('DROP TABLE license_audit; DROP TABLE license_invites; DROP TABLE subscriptions; DROP TABLE account_roles; DELETE FROM migrations WHERE version=2;');
  store.close();store=new Store(dir,master);
  assert.equal(roleOf(store,userId),'admin');assert.equal(subscription(store,workspaceId).status,'admin');assert.equal(JSON.stringify(store.get(workspaceId)),original);
  const second=store.createWorkspace(),secondUser=randomUUID();store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',secondUser,'second@example.com',credentials.hash,credentials.salt,second,new Date().toISOString());
  store.close();store=new Store(dir,master);assert.equal(roleOf(store,secondUser),'customer');assert.equal(subscription(store,second).status,'unlicensed');
  const actor=store.one('SELECT * FROM users WHERE id=?',userId),now=Date.now();
  const first=updateSubscription(store,actor,second,{days:30,plan:'Mensal'},now);
  const extended=updateSubscription(store,actor,second,{days:30,plan:'Mensal'},now);
  assert.equal(Date.parse(first.expiresAt),now+30*DAY);assert.equal(Date.parse(extended.expiresAt),now+60*DAY);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
