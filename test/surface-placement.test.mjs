import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

export function backgroundFixture(prefix='../extension/'){
 const session={},local={},messages=[],listeners={},tabs=[{id:1,windowId:1,active:true,url:'https://example.org/first'},{id:2,windowId:2,active:true,url:'https://example.org/second'}];
 let focused=1;
 const event=name=>({addListener(fn){listeners[name]=fn;}});
 const storage=data=>({get:async key=>Object.fromEntries((Array.isArray(key)?key:[key]).map(k=>[k,data[k]])),set:async values=>Object.assign(data,values),remove:async key=>delete data[key]});
 const chrome={storage:{session:storage(session),local:storage(local)},downloads:{onChanged:event('download')},runtime:{id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,onMessage:event('message')},
 tabs:{query:async q=>tabs.filter(t=>(q.windowId===undefined||t.windowId===q.windowId)&&(!q.active||t.active)),get:async id=>tabs.find(t=>t.id===id),sendMessage:async(id,m)=>{messages.push({id,...m});return {ok:true};},onActivated:event('activate'),onUpdated:event('updated')},
 windows:{get:async id=>({id,type:'normal',focused:id===focused}),onFocusChanged:event('focus'),onRemoved:event('removed')},action:{onClicked:event('action'),setBadgeText:async()=>{}},scripting:{executeScript:async()=>{}}};
 const ctx=vm.createContext({chrome,importScripts(){},console,URL,navigator:{userAgent:'Desktop test'}});
 let source=readFileSync(new URL(prefix+'background.js',import.meta.url),'utf8');
 // Distribution wrappers differ; all exercise the actual shared placement implementation.
 if(prefix.includes('firefox'))source=source.replace(/}\s*$/,';globalThis.fixture={handle,queueSurfaceFollow:queueSurfaceFollow2,wait:()=>surfaceSwitch};}');
 vm.runInContext(source,ctx);
 const api=ctx.fixture||{handle:ctx.handle,queueSurfaceFollow:ctx.queueSurfaceFollow,wait:()=>vm.runInContext('surfaceSwitch',ctx)};
 return {ctx,session,local,messages,tabs,listeners,focus:id=>{focused=id;},handle:(m,id=1)=>api.handle(m,{tab:tabs.find(t=>t.id===id)}),follow:async(id=1)=>{api.queueSurfaceFollow(id,tabs.find(t=>t.id===id).windowId);await api.wait();}};
}

for(const [name,prefix] of [['source','../extension/'],...['chrome','edge','firefox'].map(n=>[n,'../build/extensions/'+n+'/'])]){
 test(name+': default pin stays on its original window, follow is explicit and full hide survives navigation',async()=>{
  const f=backgroundFixture(prefix);
  await f.handle({type:'surface-ready'});await f.follow();
  assert.equal(f.session.ccSurfacePlacement.follow,false);
  assert(f.messages.some(m=>m.id===1&&m.type==='surface-restore'));
  f.messages.length=0;f.focus(2);await f.follow(2);
  assert(!f.messages.some(m=>m.type==='surface-restore'),'switching monitor does not steal a pinned panel');
  assert.equal((await f.handle({type:'surface-ready'},2)).suspended,true);
  f.focus(1);await f.handle({type:'surface-placement',follow:true});
  f.focus(2);await f.follow(2);
  assert(f.messages.some(m=>m.id===2&&m.type==='surface-restore'&&m.follow));
  await f.handle({type:'surface-placement',hidden:true},2);
  assert(f.session.ccSurfacePlacement.hidden);assert.equal(f.local.ccSurfaceFollow,false);
  f.messages.length=0;f.focus(1);await f.follow();
  assert.equal((await f.handle({type:'surface-ready'})).suspended,true);
  assert(!f.messages.some(m=>m.type==='surface-restore'));
  await f.listeners.action(f.tabs[0]);
  assert.equal(f.session.ccSurfacePlacement.hidden,false);assert.equal(f.session.ccSurfacePlacement.tabId,1);
  assert(f.messages.some(m=>m.id===1&&m.type==='surface-toggle'));
 });
 test(name+': private recording opens an independent HUD and removes overlays from shared tabs',async()=>{
  const f=backgroundFixture(prefix),created=[],updated=[];
  await f.handle({type:'surface-ready'});await f.follow();f.messages.length=0;
  f.session.ccRecorderHostTab=1;
  f.ctx.chrome.runtime.getContexts=async()=>[{tabId:99}];
  const oldGet=f.ctx.chrome.tabs.get;f.ctx.chrome.tabs.get=async id=>id===99?{id,windowId:99}:oldGet(id);
  f.ctx.chrome.windows.getLastFocused=async()=>({id:1});
  f.ctx.chrome.windows.update=async(id,options)=>updated.push({id,...options});
  f.ctx.chrome.windows.create=async options=>{created.push(options);return {id:3};};
  await f.handle({type:'capture-engine-started',detachedHUD:true});
  assert(updated.some(w=>w.id===99&&w.state==='minimized'));
  assert.equal(created[0].type,'popup');assert.match(created[0].url,/floating.html#kind=hud/);
  assert(f.session.ccSurfacePlacement.hidden);
  assert(f.messages.some(m=>m.id===1&&m.type==='surface-suspend'));
  assert(!f.messages.some(m=>m.type==='open'&&m.view==='hud'));
 });
}
