import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function nativeUI(file){
 const source=readFileSync(new URL(file,import.meta.url),'utf8'),start=source.indexOf('function insertNativeReply('),end=source.indexOf('function openCRM(',start);
 assert(start>=0&&end>start,'native reply controller exists');
 const calls=[],notices=[],edits=[];let complete;
 const editor={innerText:'',focus(){}},ctx=vm.createContext({nativeReplyBusy:false,nativeConversationRevision:0,suspended:false,disposed:false,surface:null,
  context:{name:'Cliente A',phone:'5522991234567',remoteJid:'5522991234567@s.whatsapp.net'},
  document:{querySelector:()=>editor,execCommand:(command,ui,text)=>{edits.push(command);editor.innerText+=text;return true;}},
  findWhatsApp(){},notice:text=>notices.push(text),chrome:{runtime:{sendMessage:async m=>{calls.push(m);return new Promise(resolve=>{complete=resolve;});}}},
  openSurface(){throw Error('Smart reply must never open a panel');},
 });
 vm.runInContext(source.slice(start,end),ctx);
 return {ctx,editor,calls,notices,edits,click:()=>vm.runInContext('nativeSmartReply()',ctx),finish:()=>complete({ok:true,text:'Sugestão para revisar.'})};
}

for(const [name,prefix] of [['source','../extension/'],...['chrome','edge','firefox'].map(n=>[n,'../build/extensions/'+n+'/'])]){
 test(name+': native WhatsApp click creates one unsent draft without opening a panel or overwriting typed text',async()=>{
  const p=nativeUI(prefix+'content.js');assert.equal(p.calls.length,0);
  const request=p.click();await p.click();assert.equal(p.calls.length,1);assert.equal(p.calls[0].type,'native-smart-reply');p.finish();await request;
  assert.equal(p.editor.innerText,'Sugestão para revisar.');assert.deepEqual(p.edits,['insertText']);
  await p.click();assert.equal(p.calls.length,1,'existing draft is preserved without another AI request');
 });
 test(name+': typing or changing chat while generation is pending never replaces the current draft',async()=>{
  for(const changedChat of [false,true]){
   const p=nativeUI(prefix+'content.js'),request=p.click();
   if(changedChat)vm.runInContext("nativeConversationRevision++;context={name:'Cliente B',phone:'5511998765432'}",p.ctx);
   else p.editor.innerText='Mensagem que estou escrevendo';
   p.finish();await request;assert.equal(p.edits.length,0);
   if(!changedChat)assert.equal(p.editor.innerText,'Mensagem que estou escrevendo');
  }
 });
 test(name+': native service is restricted to the top WhatsApp frame and an authorized owner',async()=>{
  const requests=[],handlers={addListener(){}};let owner=true;
  const data={leads:[],bindings:{},leadAutomation:{}};
  const ctx=vm.createContext({structuredClone,console,chrome:{runtime:{getURL:s=>'chrome-extension://test/'+s,onStartup:handlers},storage:{local:{get:async()=>({converteCallWorkspace:structuredClone(data)}),set:async()=>{},onChanged:handlers},onChanged:handlers},alarms:{create(){},onAlarm:handlers},notifications:{onClicked:handlers}},
   CCCore:{migrate:d=>d,merge:(base,next)=>next},CCPortal:{request:async(path,options)=>{requests.push({path,options});if(path==='/v1/account/license')return {membership:{role:owner?'owner':'member'}};if(path==='/v1/whatsapp/context')return {lead:{id:'actual-server-lead',phone:'5522991234567'},automation:{}};if(path==='/v1/whatsapp/reply')return {id:'draft',text:'Rascunho'};throw Error('Unexpected request');}},
  });
  vm.runInContext(readFileSync(new URL(prefix+'services.js',import.meta.url),'utf8'),ctx);
  const message={type:'native-smart-reply',context:{name:'Cliente',phone:'5522991234567'}},sender={url:'https://web.whatsapp.com/',frameId:0,tab:{id:8}};
  for(const invalid of [{...sender,url:'https://example.com/'},{...sender,frameId:1},{...sender,tab:{}}])assert.equal((await ctx.CCServices.handle(message,invalid)).ok,false);
  assert.equal(requests.length,0);owner=false;assert.equal((await ctx.CCServices.handle(message,sender)).ok,false);assert.equal(requests.length,1);
  owner=true;requests.length=0;const reply=await ctx.CCServices.handle(message,sender);assert.equal(reply.text,'Rascunho');
  assert.equal(requests.at(-1).options.body.leadId,'actual-server-lead');assert.equal(requests.filter(r=>r.path==='/v1/whatsapp/reply').length,1);
  assert.equal((await ctx.CCServices.handle({type:'ai-inbox-reply',leadId:'forged'},sender)).ok,false,'other extension services remain private');
 });
}
