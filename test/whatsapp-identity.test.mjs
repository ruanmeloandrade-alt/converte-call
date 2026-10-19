import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.mjs';
import {digest} from '../src/security.mjs';
import {messageIdentity} from '../src/whatsapp-identity.mjs';
import {inboxRPC} from '../src/inbox.mjs';

const pn='5522991234567@s.whatsapp.net',lid='123456789123456@lid';
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'cc-wa-identity-')),app=createApp({dir,master:'a'.repeat(64)}),ws=app.store.createWorkspace();
 const receive=(id,key,name='Nara')=>{const row={id,workspace_id:ws,payload:JSON.stringify({event:'messages.upsert',data:{key:{id,...key},pushName:name,message:{conversation:'Mensagem '+id}}})};app.worker.receive(row,{historical:true});return row;};
 return {app,ws,receive,close:async()=>{await app.close();rmSync(dir,{recursive:true,force:true});}};
}
test('LID-only inbound registers the client and later PN/LID messages reuse its ID and preserve every message',async()=>{
 const f=fixture();try{
  f.receive('one',{remoteJid:lid});let d=f.app.store.get(f.ws);assert.equal(d.leads.length,1);const id=d.leads[0].id;assert.equal(d.leads[0].name,'Nara');assert.equal(d.leads[0].phone,'');
  f.receive('two',{remoteJid:lid,senderPn:pn});f.receive('three',{remoteJid:pn,remoteJidAlt:lid});f.receive('four',{remoteJid:lid});
  d=f.app.store.get(f.ws);assert.equal(d.leads.length,1);assert.equal(d.leads[0].id,id);assert.equal(d.leads[0].phone,pn.split('@')[0]);assert.equal(d.inboxEvents.length,4);assert.equal(f.app.store.one('SELECT count(*) n FROM inbox_messages').n,4);
 }finally{await f.close();}
});
test('outbound sender name/number cannot name or identify the recipient; same names never merge different phones',async()=>{
 const f=fixture();try{
  assert.equal(messageIdentity({key:{remoteJid:lid,fromMe:true,senderPn:pn},senderPn:pn}).phone,'');
  f.receive('sent',{remoteJid:pn,fromMe:true},'Ruan Barone');let lead=f.app.store.get(f.ws).leads[0];assert.notEqual(lead.name,'Ruan Barone');const id=lead.id;
  f.receive('reply',{remoteJid:pn,fromMe:false},'Nara');lead=f.app.store.get(f.ws).leads[0];assert.equal(lead.name,'Nara');assert.equal(lead.id,id);
  f.receive('other',{remoteJid:'5511998765432@s.whatsapp.net',fromMe:false},'Nara');assert.equal(f.app.store.get(f.ws).leads.length,2);
  assert.equal(messageIdentity({key:{remoteJid:'123456@g.us',remoteJidAlt:pn}}),null);
  assert.equal(messageIdentity({key:{remoteJid:pn,remoteJidAlt:'5511998765432@s.whatsapp.net'}}).aliases.length,1);
 }finally{await f.close();}
});
test('recovery reprocesses previously discarded webhooks without replaying bots and repairs proven outgoing sender names',async()=>{
 const f=fixture();try{
  const store=f.app.store;store.run('INSERT INTO users VALUES(?,?,?,?,?,?)','owner','repair@example.test','x','x',f.ws,new Date().toISOString());store.run('INSERT INTO account_roles VALUES(?,?)','owner','admin');
  store.run('INSERT INTO instances(workspace_id,instance_name,hook_hash,credentials,status,updated_at) VALUES(?,?,?,?,?,?)',f.ws,'repair','unused',store.vault.seal({instanceKey:'test-only'}),'connected',new Date().toISOString());
  const outgoing=f.receive('sent',{remoteJid:pn,fromMe:true},'Ruan Barone'),lead=store.get(f.ws).leads[0];
  store.mutate(f.ws,d=>{const l=d.leads[0];l.name='Ruan Barone';delete l.whatsappNameSource;delete l.whatsappPushName;d.inboxEvents[0].contact.name=l.name;});
  const saved=store.one('SELECT payload FROM inbox_messages WHERE id=?',digest(f.ws+':sent')),savedEvent=store.vault.open(saved.payload);savedEvent.contact.name='Ruan Barone';store.run('UPDATE inbox_messages SET payload=? WHERE id=?',store.vault.seal(savedEvent),digest(f.ws+':sent'));
  const reply={id:'reply',workspace_id:f.ws,payload:JSON.stringify({event:'messages.upsert',data:{key:{id:'reply',remoteJid:pn,remoteJidAlt:lid,fromMe:false},pushName:'Nara',message:{conversation:'Olá'}}})};
  const unresolved={id:'lost',workspace_id:f.ws,payload:JSON.stringify({event:'messages.upsert',data:{key:{id:'lost',remoteJid:'987654321987654@lid',fromMe:false},pushName:'Outro contato',message:{conversation:'Oi'}}})};
  for(const row of [outgoing,reply,unresolved])store.run("INSERT INTO inbound(id,workspace_id,payload,status,created_at) VALUES(?,?,?,'done',?)",row.id,f.ws,row.payload,new Date().toISOString());
  f.app.worker.repairIdentities();const d=store.get(f.ws);assert.equal(d.leads.find(l=>l.id===lead.id).name,'Nara');assert.equal(d.leads.length,2);assert.equal(d.inboxEvents.length,3);assert.equal(store.one("SELECT count(*) n FROM jobs WHERE type='incoming'").n,0);assert.equal(store.one("SELECT count(*) n FROM jobs WHERE type='inbox-history'").n,1);
  f.app.worker.repairIdentities();assert.equal(store.get(f.ws).leads.length,2);assert.equal(store.one("SELECT count(*) n FROM jobs WHERE type='inbox-history'").n,1);assert(store.one('SELECT id FROM inbox_messages WHERE id=?',digest(f.ws+':sent')));
 }finally{await f.close();}
});

test('one phone has one Inbox conversation with both histories, while assigned-only users see only authorized messages',async()=>{
 const f=fixture();try{
  const store=f.app.store,user={id:'owner',workspace_id:f.ws},member={id:'member',workspace_id:f.ws};
  for(const u of [user,member])store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',u.id,u.id+'@fixture.test','x','x',f.ws,new Date().toISOString());
  store.run('INSERT INTO team_members VALUES(?,?,?,?,1)',user.id,f.ws,'owner',store.vault.seal(['inbox','allLeads']));store.run('INSERT INTO team_members VALUES(?,?,?,?,1)',member.id,f.ws,'member',store.vault.seal(['inbox']));
  store.mutate(f.ws,d=>{
   const base={funnelId:d.funnels[0].id,stage:d.funnels[0].stages[0].name,createdAt:'2026-01-01T00:00:00.000Z',custom:{}};
   d.leads.push({...base,id:'old',name:'Nome antigo',phone:'552291234567',assigneeId:member.id},{...base,id:'current',name:'Nome WhatsApp',phone:'5522991234567'});
   d.inboxEvents.push({id:'a',type:'message',leadId:'old',direction:'in',text:'Histórico antigo',at:'2026-01-01T01:00:00.000Z'},{id:'b',type:'message',leadId:'current',direction:'in',text:'Histórico novo',at:'2026-01-01T02:00:00.000Z'});
  });
  const call=(u,name,input={})=>inboxRPC(store,u,f.app.evolution,name,input);
  let list=await call(user,'listLeadConversations');assert.equal(list.conversations.length,1);assert.equal(list.conversations[0].id,'current');assert.equal(list.conversations[0].unreadCount,2);
  assert.deepEqual((await call(user,'listLeadActivities',{leadId:'current'})).activities.map(a=>a.text),['Histórico antigo','Histórico novo']);
  assert.deepEqual((await call(member,'listLeadActivities',{leadId:'old'})).activities.map(a=>a.text),['Histórico antigo']);await assert.rejects(call(member,'listLeadActivities',{leadId:'current'}),/Cliente não encontrado/);
  await call(user,'markLeadConversationRead',{leadId:'current'});list=await call(user,'listLeadConversations');assert.equal(list.conversations[0].unreadCount,0);assert.equal(store.get(f.ws).leads.length,2,'CRM deals and all history remain stored');
 }finally{await f.close();}
});
