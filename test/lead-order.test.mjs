import test from 'node:test';
import assert from 'node:assert/strict';
import {orderLeads,timestamp} from '../ui-source/lead-timeline.ts';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('lead ordering uses arrival or incoming timestamps with stable ties and missing dates last',()=>{
 const rows=[{id:'b'},{id:'missing'},{id:'a'},{id:'c'}],before=JSON.stringify(rows),timing={a:{created:10,incoming:90},b:{created:20,incoming:20},c:{created:20,incoming:70}};
 assert.deepEqual(orderLeads(rows,'newest',timing).map(x=>x.id),['b','c','a','missing']);
 assert.deepEqual(orderLeads(rows,'oldest',timing).map(x=>x.id),['a','b','c','missing']);
 assert.deepEqual(orderLeads(rows,'message',timing).map(x=>x.id),['a','c','b','missing']);
 assert.equal(JSON.stringify(rows),before);
 assert.equal(timestamp('invalid'),0);
 assert.equal(timestamp('2026-11-05T00:00:00Z'),1793836800000);
});
test('native client ordering does not promote an outgoing message or mutate saved contacts',()=>{
 const source=readFileSync(new URL('../extension/v11.js',import.meta.url),'utf8'),data={leads:[{id:'old',createdAt:'2026-01-01'},{id:'new',createdAt:'2026-11-05'}],inboxEvents:[{type:'message',leadId:'old',direction:'in',at:'2026-11-05T01:00:00Z'},{type:'message',leadId:'new',direction:'out',at:'2026-11-05T02:00:00Z'}]},before=JSON.stringify(data),ctx=vm.createContext({data});
 vm.runInContext(source.slice(source.indexOf("let ccClientSort="),source.indexOf("document.addEventListener('change',event=>",source.indexOf("let ccClientSort="))),ctx);
 assert.equal(vm.runInContext('ccOrderedClients().map(l=>l.id).join(",")',ctx),'new,old');
 assert.equal(vm.runInContext('ccClientSort="message";ccOrderedClients().map(l=>l.id).join(",")',ctx),'old,new');
 assert.equal(JSON.stringify(data),before);
});
test('native sidebar no longer offers the calendar and the home links preserve work actions',()=>{
 const app=readFileSync(new URL('../extension/app.js',import.meta.url),'utf8'),release=readFileSync(new URL('../extension/release.js',import.meta.url),'utf8'),v4=readFileSync(new URL('../extension/v4.js',import.meta.url),'utf8'),v11=readFileSync(new URL('../extension/v11.js',import.meta.url),'utf8');
 const ctx=vm.createContext({data:{tasks:[],projects:[],sales:[]},recordingRows:[],portalIdentity:{profile:{firstName:'QA'}},CCCore:{metrics:()=>({open:0,leads:0,revenue:0})},views:{}});
 vm.runInContext(app.slice(0,app.indexOf('const navs=')),ctx);
 vm.runInContext(release.split('\n').find(line=>line.startsWith('const attr=')),ctx);
 vm.runInContext(v4.split('\n').find(line=>line.startsWith('const groupsV4=')),ctx);
 assert.equal(vm.runInContext("groupsV4.flatMap(group=>group[1]).some(item=>item[0]==='agenda')",ctx),false);
 for(const line of v11.split('\n'))if(line.startsWith('views.home='))vm.runInContext(line,ctx);
 const html=vm.runInContext('views.home()',ctx);
 assert.doesNotMatch(html,/data-view="agenda"|home-grid/);
 for(const action of ['native-inbox','native-capture','open-dashboard'])assert.match(html,new RegExp('data-action="'+action+'"'));
});
