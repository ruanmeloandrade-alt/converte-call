import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';import {inboxContext,inboxReply} from '../src/inbox-context.mjs';
test('native conversation resolves persisted phone, creates once, uses actual inbound plus brain and never sends the draft',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-native-context-')),app=createApp({dir,master:'a'.repeat(64),bootstrap:'context-test'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{const response=await fetch(base+'/v1/auth/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'context-test',email:'owner@context.test',password:'Context-owner-password'})}),owner=await response.json(),user=app.store.one('SELECT * FROM users WHERE email=?','owner@context.test'),ws=user.workspace_id;
 const call=async input=>{const r=await fetch(base+'/v1/whatsapp/context',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+owner.accessToken},body:JSON.stringify(input)});return {status:r.status,...await r.json()};};
 let context=await call({name:'Contato real',phone:'5522991234567',ensure:true});assert.equal(context.status,200);assert.equal(context.lead.phone,'5522991234567');const leadId=context.lead.id;
 assert.equal((await call({name:'Nome do contato no WhatsApp',remoteJid:'5522991234567@s.whatsapp.net',ensure:true})).lead.id,leadId);assert.equal(app.store.get(ws).leads.length,1);
 app.store.mutate(ws,d=>{d.inboxEvents.push({id:randomUUID(),type:'message',leadId,direction:'in',text:'Vocês atendem aos sábados?',at:new Date().toISOString()});d.brainSources.push({id:randomUUID(),title:'Horário',source_type:'text',content:'Atendemos sábado das 8h às 12h.',enabled:true});d.providers.ai='openai';});
 context=inboxContext(app.store,user,{name:'Contato real'});assert.equal(context.lead.id,leadId);assert.equal(context.lastReceived,'Vocês atendem aos sábados?');
 app.store.secret(ws,'openai',{apiKey:'sk-native-context-fixture-key',model:'gpt-6-luna'});let request;
 const draft=await inboxReply(app.store,user,{leadId,snapshot:{lastReceived:'Mensagem falsa do DOM'}},{fetcher:async(_url,options)=>{request=JSON.parse(options.body);return Response.json({output:[{content:[{type:'output_text',text:'Sim! Atendemos aos sábados, das 8h às 12h.'}]}]});}});
 assert.equal(JSON.parse(request.input).lastReceived,'Vocês atendem aos sábados?');assert(request.input.includes('8h às 12h'));assert(draft.text.startsWith('Sim!'));assert.equal(app.store.get(ws).inboxEvents.length,1,'draft cannot send');assert.equal(app.store.get(ws).smartReplies.length,1);
 const other=app.store.createWorkspace();app.store.mutate(other,d=>d.leads.push({id:'other-private-lead',name:'Outro',phone:'5522999999999'}));assert.equal((await call({leadId:'other-private-lead'})).status,404);
 assert.equal((await call({name:'Sem número identificável',ensure:true})).status,404,'never invent a phone or bind ambiguous names');
 const normalized=await call({name:'Contato real',phone:'+55 (22) 9123-4567',ensure:true});assert.equal(normalized.lead.id,leadId,'Brazil digit variants reuse the contact');
 const distinct=await call({name:'Contato real',phone:'5511998765432',ensure:true});assert.notEqual(distinct.lead.id,leadId,'an explicit different phone never falls back to a matching name');
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
