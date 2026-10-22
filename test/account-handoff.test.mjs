import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const identity={userId:'user',workspaceId:'workspace',email:'test@example.com',membership:{role:'owner'},role:'customer'};
function fixture(prefix,fetcher,age=0){
 const cache={ccAccountView:structuredClone(identity),ccAccountVerifiedAt:Date.now()-age},vault={ccAccountToken:'access',ccRefreshToken:'refresh'};
 const calls=[],sender={url:'chrome-extension://test/panel.html'};
 const ctx=vm.createContext({URL,AbortSignal,Date,CCDeployment:{accountUrl:'https://fixture.test'},CCCredentials:{get:async k=>vault[k],set:async(k,v)=>vault[k]=v,remove:async k=>delete vault[k]},chrome:{permissions:{contains:async()=>true},runtime:{getURL:p=>'chrome-extension://test/'+p},storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,cache[k]])),set:async data=>Object.assign(cache,data),remove:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])delete cache[k];}}}},fetch:async(url,options)=>{calls.push({url,options});return fetcher(url,options,vault);}});
 vm.runInContext(readFileSync(new URL(prefix+'portal-services.js',import.meta.url),'utf8'),ctx);
 return {portal:ctx.CCPortal,cache,vault,calls,sender};
}
for(const [name,prefix] of [['source','../extension/'],...['chrome','edge','firefox'].map(n=>[n,'../build/extensions/'+n+'/'])]){
 test(name+': moving between freshly verified panels reuses identity without a network recovery',async()=>{
  const f=fixture(prefix,()=>{throw Error('Unexpected network');});
  const result=await f.portal.handle({type:'portal-account'},f.sender);
  assert.equal(result.userId,'user');assert.equal(f.calls.length,0);
 });
 test(name+': temporary timeout keeps a recently verified account and its credentials',async()=>{
  const f=fixture(prefix,()=>{throw Object.assign(Error('signal timed out'),{name:'TimeoutError'});},60000);
  const result=await f.portal.handle({type:'portal-account'},f.sender);
  assert.equal(result.connectionPending,true);assert.equal(f.vault.ccAccountToken,'access');assert(f.cache.ccAccountView);
  delete f.cache.ccAccountView;
  await assert.rejects(f.portal.handle({type:'portal-account'},f.sender),e=>e.transient&&e.message.includes('sessão foi preservada')&&!e.message.includes('signal timed out'));
 });
 test(name+': revoked permission never falls back to cached account',async()=>{
  const f=fixture(prefix,()=>Response.json({error:{message:'Suspended'}},{status:403}),60000);
  await assert.rejects(f.portal.handle({type:'portal-account'},f.sender),e=>e.status===403);
  assert.equal(f.cache.ccAccountView,undefined);
 });
 test(name+': late unauthorized responses reuse the rotated token rather than refresh again',async()=>{
  let release;const gate=new Promise(r=>release=r);let old=0,refreshes=0;
  const f=fixture(prefix,async(url,options,vault)=>{
   if(url.endsWith('/v1/auth/refresh')){refreshes++;return Response.json({accessToken:'new-access'});}
   if(options.headers.Authorization==='Bearer access'){old++;if(old===2)await gate;return Response.json({}, {status:401});}
   assert.equal(options.headers.Authorization,'Bearer new-access');return Response.json({ok:true});
  });
  const first=f.portal.request('/first'),second=f.portal.request('/second');
  await first;release();await second;
  assert.equal(refreshes,1);assert.equal(f.vault.ccAccountToken,'new-access');assert.equal(f.vault.ccRefreshToken,'refresh');
 });
 test(name+': parallel account restoration sends one license query and force bypasses only the short cache',async()=>{
  let release;const gate=new Promise(r=>release=r);
  const f=fixture(prefix,async()=>{await gate;return Response.json(identity);},60000);
  const jobs=Array.from({length:6},()=>f.portal.handle({type:'portal-account'},f.sender));
  await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,1);release();await Promise.all(jobs);
  await f.portal.handle({type:'portal-account'},f.sender);assert.equal(f.calls.length,1);
  await f.portal.handle({type:'portal-account',force:true},f.sender);assert.equal(f.calls.length,2);
 });
 test(name+': an old in-flight identity cannot restore the account after logout',async()=>{
  let release;const gate=new Promise(r=>release=r);
  const f=fixture(prefix,async url=>{if(url.endsWith('/v1/account/license')){await gate;return Response.json(identity);}return Response.json({ok:true});},60000);
  const account=f.portal.handle({type:'portal-account'},f.sender);await new Promise(r=>setImmediate(r));
  await f.portal.handle({type:'portal-logout'},f.sender);release();await assert.rejects(account);
  assert.equal(f.cache.ccAccountView,undefined);assert.equal(f.vault.ccAccountToken,undefined);
 });
 test(name+': a recreated panel renders verified identity before a slow account query finishes',async()=>{
  let complete;const gate=new Promise(r=>complete=r),renders=[];
  const source=readFileSync(new URL(prefix+'v9.js',import.meta.url),'utf8'),start=source.indexOf('let portalAccountCheckedAt'),end=source.indexOf('const settingsBeforePortal',start);
  const ctx=vm.createContext({Date,setTimeout:()=>1,clearTimeout(){},portalAccountPending:null,portalAccountEpoch:0,portalIdentity:null,portalAccountStatus:'loading',portalAccountError:'',data:{},render:()=>renders.push(ctx.portalIdentity),chrome:{storage:{local:{get:async()=>({ccAccountView:identity,ccAccountVerifiedAt:Date.now()})}}},service:async()=>{await gate;throw Object.assign(Error('Temporary network timeout'),{transient:true});},document:{querySelector:()=>null,activeElement:null}});
  vm.runInContext(source.slice(start,end),ctx);const restore=ctx.restorePortalAccount();
  await new Promise(r=>setImmediate(r));assert.equal(ctx.portalIdentity.userId,'user');assert.equal(ctx.portalAccountStatus,'connected');assert(renders.length);
  complete();await restore;assert.equal(ctx.portalIdentity.userId,'user');assert.equal(ctx.portalAccountStatus,'connected');
 });
}
