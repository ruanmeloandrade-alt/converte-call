import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {canonicalPhone,uniqueLeadCards} from '../src/contact-identity.mjs';
import {createApp} from '../src/server.mjs';
import {inboxRPC} from '../src/inbox.mjs';

test('contact keys collapse device suffixes and Brazil ninth-digit variants without changing saved records',()=>{
 assert.equal(canonicalPhone('5522991234567:12@s.whatsapp.net'),'5522991234567');
 assert.equal(canonicalPhone('+55 (22) 9123-4567'),'5522991234567');
 assert.equal(canonicalPhone('12345678@lid'),null);
 const leads=[{id:'one',name:'Ruan Barone',phone:'552291234567',stage:'Novo',funnelId:'f'}, {id:'two',name:'Ruan | RB Midia',phone:'5522991234567:4@s.whatsapp.net',stage:'Novo',funnelId:'f'}, {id:'three',phone:'5522991234567',stage:'Proposta',funnelId:'f'}, {id:'four',phone:'',stage:'Novo'}];
 assert.deepEqual(uniqueLeadCards(leads).map(l=>l.id),['one','three','four']);assert.equal(leads.length,4);
});
test('protocol/read events do not create contacts or appear as chat bubbles; real media and messages remain',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-android-inbox-')),app=createApp({dir,master:'a'.repeat(64)});
 try{const ws=app.store.createWorkspace(),user={id:randomUUID(),workspace_id:ws};app.store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',user.id,'test@android.test','test','test',ws,new Date().toISOString());app.store.run('INSERT INTO account_roles VALUES(?,?)',user.id,'admin');
 const receive=(id,jid,message)=>app.worker.receive({id,workspace_id:ws,payload:JSON.stringify({event:'messages.upsert',data:{key:{id,remoteJid:jid},pushName:'Contato',message}})},{historical:true});
 receive('protocol','5522991234567@s.whatsapp.net',{protocolMessage:{type:0}});assert.equal(app.store.get(ws).leads.length,0);
 receive('hello','552291234567@s.whatsapp.net',{conversation:'Olá'});receive('photo','5522991234567:2@s.whatsapp.net',{imageMessage:{mimetype:'image/png'}});assert.equal(app.store.get(ws).leads.length,1);
 const lead=app.store.get(ws).leads[0];app.store.mutate(ws,d=>{d.inboxEvents.push(...['read','received','call'].map((type,i)=>({id:'internal-'+i,leadId:lead.id,type,direction:'in',text:'Mensagem vista',at:new Date().toISOString()})),{id:'empty',leadId:lead.id,type:'message',direction:'in',text:'',at:new Date().toISOString()});});
 const result=await inboxRPC(app.store,user,app.evolution,'listLeadActivities',{leadId:lead.id});assert.equal(result.activities.length,2);assert(result.activities.some(a=>a.text==='Olá'));assert(result.activities.some(a=>a.mediaType==='image'));
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
