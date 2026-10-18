import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';import {createApp} from '../src/server.mjs';
test('team invites share workspace, enforce paid capacity, isolate assigned leads and revoke disabled access',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-teams-')),app=createApp({dir,master:'d'.repeat(64),bootstrap:'local-team-security',billingOptions:{publicUrl:'https://converte.example.test'}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,token,body,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{
  const admin=(await call('/v1/auth/bootstrap',null,{token:'local-team-security',email:'admin@example.com',password:'Local-admin-password123'})).data;
  const owner=(await call('/v1/auth/register',null,{firstName:'Titular',lastName:'Teste',birthDate:'1990-01-01',email:'owner@example.com',whatsapp:'5522992888971',password:'Local-owner-password123'})).data;
  const invite={email:'staff@example.com',firstName:'Vendedor',permissions:['inbox']};
  assert.equal((await call('/v1/team/invites',owner.accessToken,invite)).status,402);
  const pay=seats=>call('/v1/admin/accounts/'+owner.workspaceId+'/payment',admin.accessToken,{plan:'monthly',seats,received:true,idempotencyKey:randomUUID()});
  assert.equal((await pay(3)).status,200);
  const invitation=await call('/v1/team/invites',owner.accessToken,invite);assert.equal(invitation.status,201);const inviteToken=new URL(invitation.data.url).searchParams.get('invite');
  assert(!JSON.stringify(app.store.all('SELECT * FROM team_invites')).includes(inviteToken),'only invitation hash is stored');
  const staff=(await call('/v1/auth/join',null,{invite:inviteToken,password:'Local-staff-password123'})).data;assert.equal(staff.workspaceId,owner.workspaceId);
  assert.equal((await call('/v1/auth/join',null,{invite:inviteToken,password:'Local-staff-password123'})).status,400,'invitation is single-use');
  const identity=(await call('/v1/account/license',staff.accessToken)).data;assert.equal(identity.membership.role,'member');
  for(const [path,body]of [['/v1/team',null],['/v1/team/invites',invite],['/v1/billing/checkout',{plan:'monthly',seats:7}],['/v1/tracking/pixels',null],['/v1/workspace/sync',{base:{},next:{}}]])assert.equal((await call(path,staff.accessToken,body)).status,403,path);
  const wrongWorkspace=await fetch(base+'/v1/workspace',{headers:{Authorization:'Bearer '+owner.accessToken,'X-Workspace-Id':admin.workspaceId}});assert.equal(wrongWorkspace.status,409,'stale account sync cannot read or overwrite another workspace');
  const d=app.store.get(owner.workspaceId);d.leads.push({id:randomUUID(),name:'Meu cliente',responsibleId:identity.userId},{id:randomUUID(),name:'Outro vendedor',responsibleId:randomUUID()});app.store.put(owner.workspaceId,d);
  const visible=(await call('/v1/workspace',staff.accessToken)).data;
  assert.equal(JSON.stringify(visible).includes('Outro vendedor'),false);assert.equal(JSON.stringify(visible).includes('Meu cliente'),true);
  const pending=await call('/v1/team/invites',owner.accessToken,{...invite,email:'pending@example.com'});assert.equal(pending.status,201);
  assert.equal((await pay(3)).status,200);assert.equal(app.store.one('SELECT count(*) AS n FROM team_invites WHERE accepted=0').n,1,'renewal preserves valid pending invitation');
  assert.equal((await pay(1)).status,200);assert.equal((await call('/v1/account/license',staff.accessToken)).status,401,'paid seat reduction revokes excess member session');assert.equal(app.store.one('SELECT count(*) AS n FROM team_invites WHERE accepted=0').n,0,'pending invitations cannot exceed reduced capacity');
  assert.equal((await call('/v1/team',owner.accessToken)).status,200,'owner remains active');
  assert.equal(app.store.one('SELECT count(*) AS n FROM workspaces').n,2,'employee does not receive a separate workspace or trial');
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
