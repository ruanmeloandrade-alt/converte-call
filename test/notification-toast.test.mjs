import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

test('notifications display in the active tab, restore a pin and fall back on restricted pages',async()=>{
 const key='converteCallWorkspace',local={[key]:{notifications:[]}},session={};
 const calls=[],fallback=[],listeners={},injected=new Set();
 let tab={id:1,url:'https://example.test/'};
 const event=name=>({addListener(fn){listeners[name]=fn;}});
 const storage=data=>({
  get:async key=>({[key]:data[key]}),set:async fields=>Object.assign(data,fields),
  remove:async key=>delete data[key],
 });
 const chrome={
  storage:{local:storage(local),session:storage(session),onChanged:event('storage')},
  tabs:{query:async()=>[tab],onActivated:event('activate'),onUpdated:event('update'),sendMessage:async(id,message)=>{
   calls.push({id,...message});
   return {ok:injected.has(id)};
  }},
  scripting:{executeScript:async({target})=>injected.add(target.tabId)},
  notifications:{create:async(id,message)=>fallback.push({id,...message})},
  alarms:{create(){},onAlarm:event('alarm')},
 };
 const ctx=vm.createContext({chrome,crypto:{randomUUID},CCCore:{migrate:data=>data}});
 vm.runInContext(readFileSync(new URL('../extension/notification-center.js',import.meta.url),'utf8'),ctx);
 const id=await ctx.CCNotification.emit({key:'test',title:'Venda registrada'});
 assert.equal(calls.at(-1).notice.id,id);
 assert.equal(fallback.length,0);
 await ctx.CCNotification.pin(id,true);
 tab={id:2,url:'https://example.test/next'};
 await listeners.activate();
 assert.equal(calls.at(-1).id,2);
 assert.equal(calls.at(-1).notice.pinned,true);
 await ctx.CCNotification.emit({key:'second',title:'Tarefa'});
 assert.equal(fallback.length,1);
 assert.equal(calls.at(-1).notice.id,id);
 await ctx.CCNotification.pin(id,false);
 tab={id:3,url:'about:blank'};
 await ctx.CCNotification.emit({key:'restricted',title:'Aviso'});
 assert.equal(fallback.length,2);
 assert.equal(local[key].notifications.length,3);
});
