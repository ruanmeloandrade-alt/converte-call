import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createApp} from '../src/server.mjs';
test('extension account service talks to real HTTP server with persistent credential adapter, refresh and trusted sender checks',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-portal-')),app=createApp({dir,master:'b'.repeat(64),bootstrap:'test-bootstrap-portal'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const session={},vault={},workspace={providers:{}},requests=[];let granted=true;
 const sandbox=vm.createContext({URL,AbortSignal,CCCredentials:{get:async name=>vault[name]||session[name],set:async(name,value)=>{vault[name]=value;session[name]=value;},remove:async name=>{delete vault[name];delete session[name];}},CCDeployment:{accountUrl:'https://portal.example'},chrome:{runtime:{getURL:path=>'chrome-extension://test-id/'+path},permissions:{contains:async()=>granted},storage:{session:{get:async()=>session,set:async v=>Object.assign(session,v),remove:async key=>{delete session[key];}},local:{get:async()=>({converteCallWorkspace:workspace}),set:async()=>{}}}},fetch:async(url,options)=>{requests.push(url);return fetch(base+new URL(url).pathname,options);}});
 vm.runInContext(readFileSync(new URL('../extension/portal-services.js',import.meta.url),'utf8'),sandbox);const portal=sandbox.CCPortal,sender={url:'chrome-extension://test-id/panel.html'};
 try{
  await fetch(base+'/v1/auth/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'test-bootstrap-portal',email:'admin@example.com',password:'Admin-test-password'})});
  const registration={firstName:'Pessoa',lastName:'Teste',birthDate:'1990-01-01',email:'customer@example.com',password:'Customer-test-password',whatsapp:'5522992888971'};
  await fetch(base+'/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(registration)});
  assert.equal((await portal.handle({type:'portal-account'},{url:'https://web.whatsapp.com/'})).ok,false);assert.equal(requests.length,0);
  await assert.rejects(portal.handle({type:'portal-academy'},sender),/Entre na sua conta/);
  const login=await portal.handle({type:'portal-login',email:registration.email,password:registration.password},sender);assert.equal(login.role,'customer');assert(session.ccAccountToken);assert(!JSON.stringify(workspace).includes(session.ccAccountToken));assert.equal((await portal.handle({type:'portal-academy'},sender)).lessons.length,0);
  assert(vault.ccRefreshToken);delete session.ccAccountToken;delete vault.ccAccountToken;assert.equal((await portal.handle({type:'portal-account'},sender)).role,'customer');assert(vault.ccAccountToken,'restores access from persistent refresh token');
  const guide=await portal.handle({type:'portal-support',question:'Como funciona o teste gratuito?'},sender);assert.equal(guide.mode,'guide');assert(guide.answer.includes('7 dias'));
  granted=false;await assert.rejects(portal.handle({type:'portal-academy'},sender),/Autorize/);granted=true;
  await portal.handle({type:'portal-logout'},sender);assert.equal(session.ccAccountToken,undefined);assert.equal(await portal.handle({type:'other'},sender),undefined);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
