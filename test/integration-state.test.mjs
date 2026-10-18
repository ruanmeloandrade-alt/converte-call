import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('integration card refreshes live state and pairing persists without a second status click',async()=>{
 let workspace={providers:{},connections:{whatsapp:{status:'disconnected'}}},live='connected',unavailable=false;
 const listener={addListener(){}},sandbox=vm.createContext({URL,AbortSignal,structuredClone,console,
  CCCore:{migrate:d=>d,merge:(base,next,latest)=>({...latest,...next}),now:()=>new Date().toISOString()},
  CCCredentials:{get:async()=>null},CCDeployment:{accountUrl:'https://account.example'},
  CCPortal:{request:async path=>{if(path==='/v1/google/status')return {configured:true,calendar:true,gmail:false};if(unavailable)throw Error('Network unavailable');if(path==='/v1/ai/credentials')return {configured:false,provider:'openai',profiles:{}};assert.equal(path,'/v1/whatsapp/session');return {status:live,phone:'5511999999999'};}},
  chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p,onStartup:listener},storage:{local:{get:async()=>({converteCallWorkspace:structuredClone(workspace)}),set:async v=>{workspace=v.converteCallWorkspace;},onChanged:listener},onChanged:listener},alarms:{create(){},onAlarm:listener},notifications:{onClicked:listener}}
 });
 vm.runInContext(readFileSync(new URL('../extension/services.js',import.meta.url),'utf8'),sandbox);
 const send=type=>sandbox.CCServices.handle({type},{url:'chrome-extension://test/panel.html'});
 const result=await send('integration-status');assert.equal(result.connections.whatsapp.status,'connected');assert.equal(workspace.connections.google.status,'connected');assert.equal(workspace.connections.gmail.status,'disconnected');
 live='disconnected';assert.equal((await send('integration-status')).connections.whatsapp.status,'disconnected');
 live='connected';await send('wa-pair');assert.equal(workspace.connections.whatsapp.status,'connected');
 unavailable=true;assert.equal((await send('integration-status')).connections.whatsapp.status,'unknown');
});
