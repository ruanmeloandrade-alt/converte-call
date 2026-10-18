import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createApp} from '../src/server.mjs';
test('Google OAuth uses PKCE, validates state and owner, encrypts refresh credentials and separates Gmail from Calendar',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-google-')),calls=[];let granted='https://www.googleapis.com/auth/calendar.events';
 const fetcher=async(url,options)=>{const form=Object.fromEntries(new URLSearchParams(options.body));calls.push({url,options,form});if(url==='https://oauth2.googleapis.com/token')return Response.json(form.grant_type==='refresh_token'?{access_token:'refreshed-private-access',expires_in:3600}:{access_token:'private-access',refresh_token:'private-refresh',expires_in:3600,scope:granted});if(url.includes('/calendar/'))return Response.json({items:[],id:'event-created'});if(url.includes('/gmail/'))return Response.json({id:'sent-message'});throw Error('Unexpected Google request');};
 const app=createApp({dir,master:'e'.repeat(64),bootstrap:'local-google',googleOptions:{clientId:'local.apps.googleusercontent.com',clientSecret:'local-private-client',publicUrl:'https://converte.example.test',fetcher}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json();};
 try{
  const owner=await post('/v1/auth/bootstrap',{token:'local-google',email:'admin@example.com',password:'Local-Google-password123'}),user=app.store.one('SELECT * FROM users WHERE workspace_id=?',owner.workspaceId),other={id:'other-user',workspace_id:'other-workspace'};
  assert.throws(()=>app.google.authorize(user,{kind:'calendar',redirectUrl:'https://attacker.test/'}),e=>e.status===400);
  const authorization=app.google.authorize(user,{kind:'calendar',redirectUrl:'https://'+'a'.repeat(32)+'.chromiumapp.org/google'}),url=new URL(authorization.url);
  assert.equal(url.hostname,'accounts.google.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('redirect_uri'),'https://converte.example.test/oauth/google/callback');assert(!authorization.url.includes('local-private-client'));
  await assert.rejects(()=>app.google.callback(new URLSearchParams({state:'wrong',code:'local-code'})),e=>e.status===400);
  const redirect=await app.google.callback(new URLSearchParams({state:url.searchParams.get('state'),code:'local-code'})),grant=new URLSearchParams(new URL(redirect).hash.slice(1)).get('grant');
  assert.equal(calls[0].form.code_verifier.length>40,true);assert(!redirect.includes('private-access'));assert(!JSON.stringify(app.store.all('SELECT * FROM secrets')).includes('private-refresh'));
  assert.throws(()=>app.google.finish(other,{grant}),e=>e.status===400);assert.equal(app.google.finish(user,{grant}).kind,'calendar');assert.throws(()=>app.google.finish(user,{grant}),e=>e.status===400);
  await assert.rejects(()=>app.google.callback(new URLSearchParams({state:url.searchParams.get('state'),code:'local-code'})),e=>e.status===400);
  assert.equal(app.google.status(user.workspace_id).calendar,true);assert.equal(app.google.status(user.workspace_id).gmail,false);
  const credentials=app.store.secret(user.workspace_id,'google:calendar');credentials.expiresAt=0;app.store.secret(user.workspace_id,'google:calendar',credentials);
  await app.google.events(user.workspace_id);assert.equal(calls.at(-2).form.grant_type,'refresh_token');assert.equal(calls.at(-1).options.headers.Authorization,'Bearer refreshed-private-access');
  await assert.rejects(()=>app.google.send(user.workspace_id,{raw:'bWVzc2FnZQ',confirm:false}),e=>e.status===400);
  await assert.rejects(()=>app.google.send(user.workspace_id,{raw:'bWVzc2FnZQ',confirm:true}),e=>e.status===401);
  granted='https://www.googleapis.com/auth/gmail.send';const gmailUrl=new URL(app.google.authorize(user,{kind:'gmail',redirectUrl:'https://'+'a'.repeat(32)+'.chromiumapp.org/google'}).url);await app.google.callback(new URLSearchParams({state:gmailUrl.searchParams.get('state'),code:'gmail-code'}));
  assert.equal((await app.google.send(user.workspace_id,{raw:'bWVzc2FnZQ',confirm:true})).id,'sent-message');app.google.disconnect(user.workspace_id,'gmail');assert.equal(app.google.status(user.workspace_id).gmail,false);assert.equal(app.google.status(user.workspace_id).calendar,true);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
