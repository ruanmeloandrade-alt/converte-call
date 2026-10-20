import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function panel(file){
 const requests=[],posts=[],timers=[],listeners={},rootListeners={};let active='lead-a',deferred;
 const workspace={leads:[{id:'lead-a'},{id:'lead-b'}]},parent={};
 const context=vm.createContext({params:new URLSearchParams('intent=reply'),workspace,contactId:'',view:'customer',context:{name:'Cliente'},customer(){},render(){},esc:s=>s,field(){},post:(...args)=>posts.push(args),toast(){},parent,
  root:{addEventListener:(type,fn)=>rootListeners[type]=fn,querySelector:()=>null},
  window:{addEventListener:(type,fn)=>listeners[type]=fn},
  chrome:{storage:{onChanged:{addListener(){}}}},CCWorkspace:{get:async()=>workspace},
  setInterval:()=>1,clearInterval(){},setTimeout:fn=>timers.push(fn),
  send:async(type,input)=>{requests.push({type,input});if(type==='wa-context')return {ok:true,lead:{id:active},messages:[],lastReceived:'Olá'};if(type==='ai-inbox-reply')return deferred?await deferred:{ok:true,id:'draft',text:'Como posso ajudar?'};throw Error('Unexpected '+type);},
 });
 vm.runInContext(readFileSync(new URL(file,import.meta.url),'utf8'),context);
 return {context,requests,posts,async event(data){listeners.message({source:parent,data:{channel:'cc-host',...data}});while(timers.length)await timers.shift()();},
  async click(){await rootListeners.click({target:{closest:()=>({dataset:{action:'inbox-generate'}})}});},
  switchLead(){active='lead-b';},defer(promise){deferred=promise;}};
}

for(const [name,file] of [['source','../extension/surface-inbox.js'],...['chrome','edge','firefox'].map(name=>[name,'../build/extensions/'+name+'/surface-inbox.js'])]){
 test(name+': opening, refreshing and switching chat never generates; explicit reply clicks generate once',async()=>{
  const p=panel(file),count=()=>p.requests.filter(r=>r.type==='ai-inbox-reply').length;
  await vm.runInContext('ensureInboxContext()',p.context);assert.equal(count(),0,'restored reply tab cannot generate');
  await p.event({type:'inbox-context',intent:'reply'});assert.equal(count(),0,'loading context is not a user request');
  await p.event({type:'inbox-context',intent:'reply',generateReply:true});assert.equal(count(),1,'outer smart reply click generates once');
  await vm.runInContext('ensureInboxContext()',p.context);assert.equal(count(),1,'refresh never regenerates');
  p.switchLead();await p.event({type:'conversation'});assert.equal(count(),1,'new chat never generates');
  await p.click();assert.equal(count(),2,'manual generation button still works');
  assert.equal(p.requests.filter(r=>r.type==='ai-inbox-reply').at(-1).input.leadId,'lead-b');
 });
 test(name+': a reply requested for the previous chat cannot be inserted into the next chat',async()=>{
  const p=panel(file);await vm.runInContext('ensureInboxContext()',p.context);let finish;
  p.defer(new Promise(resolve=>{finish=resolve;}));const generating=p.click();
  await Promise.resolve();p.switchLead();await p.event({type:'conversation'});
  finish({ok:true,id:'old-draft',text:'Resposta do cliente anterior'});await generating;
  assert.equal(p.posts.length,0);assert.equal(vm.runInContext('inboxDraft',p.context),null);
 });
}
