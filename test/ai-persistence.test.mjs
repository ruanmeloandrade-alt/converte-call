import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.mjs';

test('fresh installation restores server AI state without downloading keys; blank settings preserve credentials across restart and account isolation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-ai-reinstall-')),options={dir,master:'a'.repeat(64),bootstrap:'ai-persist-bootstrap'};let app,base;
 const start=async()=>{app=createApp(options);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;};
 const request=async(path,token,body,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{
  await start();const owner=(await request('/v1/auth/bootstrap',null,{token:options.bootstrap,email:'admin@persist.test',password:'Persistence-admin-password'})).data;
  const other=(await request('/v1/auth/register',null,{firstName:'Outra',lastName:'Conta',birthDate:'1990-01-01',email:'other@persist.test',password:'Persistence-customer-password',whatsapp:'5522991234567'})).data;
  const key='sk-persistence-fixture-only-123456789';assert.equal((await request('/v1/ai/credentials',owner.accessToken,{provider:'gemini',apiKey:key,model:'my-saved-model'},'PUT')).status,200);
  const ws=app.store.one('SELECT workspace_id FROM users WHERE email=?','admin@persist.test').workspace_id;
  await app.close();await start();let state=await request('/v1/ai/credentials',owner.accessToken);assert.equal(state.status,200);assert.equal(state.data.configured,true);assert.equal(state.data.provider,'gemini');assert.equal(state.data.model,'my-saved-model');assert(!JSON.stringify(state.data).includes(key));assert(!JSON.stringify(state.data).includes('apiKey'));
  assert.equal((await request('/v1/ai/credentials',other.accessToken)).data.configured,false);assert.equal((await request('/v1/ai/credentials')).status,401);
  let workspace={providers:{},connections:{whatsapp:{status:'disconnected'}}},offline=false;const listener={addListener(){}},removed=[];
  const sandbox=vm.createContext({URL,AbortSignal,structuredClone,console,setTimeout,clearTimeout,CCCore:{migrate:d=>d,merge:(base,next,latest)=>({...latest,...next}),now:()=>new Date().toISOString()},CCCredentials:{get:async name=>name==='ccAccountToken'?owner.accessToken:null,remove:async name=>removed.push(name)},CCDeployment:{accountUrl:'https://account.example'},CCPortal:{request:async(path,options={})=>{if(path==='/v1/google/status')return {configured:false};if(path==='/v1/whatsapp/session')return {status:'disconnected'};if(offline)throw Error('Network unavailable');const result=await request(path,owner.accessToken,options.body,options.method);if(result.status>=400)throw Error(result.data.error?.message);return result.data;}},chrome:{runtime:{getURL:p=>'chrome-extension://fresh/'+p,onStartup:listener},storage:{local:{get:async()=>({converteCallWorkspace:structuredClone(workspace)}),set:async value=>{workspace=value.converteCallWorkspace;},onChanged:listener},onChanged:listener},alarms:{create(){},onAlarm:listener},notifications:{onClicked:listener}}});
  vm.runInContext(readFileSync(new URL('../extension/services.js',import.meta.url),'utf8'),sandbox);
  const send=m=>sandbox.CCServices.handle(m,{url:'chrome-extension://fresh/panel.html'});
  const restored=await send({type:'integration-status'});assert.equal(restored.ai,true);assert.equal(restored.aiProvider,'gemini');assert.equal(workspace.providers.ai,'gemini');assert.equal(workspace.providers.model,'my-saved-model');assert(!JSON.stringify(workspace).includes(key));
  const edited=await send({type:'ai-config',provider:'gemini',key:'',model:'new-explicit-model'});assert.equal(edited.ok,true);assert.equal(app.store.secret(ws,'ai:gemini').apiKey,key);assert.equal(app.store.secret(ws,'ai:gemini').model,'new-explicit-model');assert.deepEqual(removed,['ccGeminiKey']);
  await send({type:'ai-config',provider:'openai',key:'sk-audio-secondary-fixture-123456',select:false});assert.equal((await request('/v1/ai/credentials',owner.accessToken)).data.provider,'gemini','secondary audio does not change the selected response provider');
  offline=true;assert.equal((await send({type:'integration-status'})).ai,null,'offline is unknown, not disconnected');assert.equal(app.store.secret(ws,'ai:gemini').apiKey,key);
  assert(!JSON.stringify(app.store.all('SELECT * FROM secrets')).includes(key));
 }finally{if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
});

