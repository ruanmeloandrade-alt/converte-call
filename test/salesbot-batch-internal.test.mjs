import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {SalesbotStore} from '../src/salesbot-store.mjs';
import {internalMessages} from '../src/internal-messages.mjs';
import {rpc} from '../src/rpc.mjs';
import * as Runtime from '../src/salesbot-runtime.original.mjs';

async function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'cc-batch-internal-')),app=createApp({dir,master:'e'.repeat(64)});
 try{
  const ws=app.store.createWorkspace(),leadId=randomUUID(),owner=randomUUID(),other=app.store.createWorkspace(),foreign=randomUUID();
  for(const [id,workspace]of [[owner,ws],[foreign,other]]){
   app.store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',id,id+'@example.test','fixture','fixture',workspace,new Date().toISOString());
   app.store.run("INSERT INTO team_members VALUES(?,?,'owner',?,1)",id,workspace,app.store.vault.seal(['projects']));
  }
  app.store.mutate(ws,d=>d.leads.push({id:leadId,name:'QA',phone:'5522991234567',custom:{},funnelId:d.funnels[0].id,stage:d.funnels[0].stages[0].name}));
  const adapter=new SalesbotStore(app.store,app.evolution,ws);await fn({app,ws,leadId,owner,foreign,other,adapter});
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
}
test('batch pause counts distinct incoming messages durably and rejects another workspace/bot target',async()=>fixture(async({app,ws,leadId,other,adapter})=>{
 const botId=randomUUID(),foreignBot=randomUUID();app.store.mutate(ws,d=>d.bots.push({id:botId,startBlockId:'wait',blocks:[{id:'wait',kind:'pausar',pausas:[{tipo:'lote-msgs',qtdMensagens:2,nextBlockId:'done'}]},{id:'done',kind:'msg-interna',texto:'Lote completo'}]},{id:foreignBot,blocks:[{id:'foreign',kind:'encerrar-bot'}]}));
 const runId=await adapter.run(()=>Runtime.startSalesbotRun(adapter,{workspaceId:ws,leadId,salesbotId:botId}));
 const foreignBlock=adapter.rows('salesbot_blocks').find(b=>b.salesbot_id===foreignBot).id;
 await assert.rejects(adapter.rpc('salesbot_batch_decrement',{p_run_id:runId,p_next_block_id:foreignBlock,p_text:'A'}),/fora/);
 const incoming=(messageId)=>app.worker.automation.incoming(ws,{leadId,messageId,text:messageId,receivedAt:new Date(Date.now()+20).toISOString()});
 await incoming('QA 1');let run=adapter.rows('salesbot_runs').find(r=>r.id===runId);
 assert.equal(run.status,'waiting_message');assert.equal(run.variables.salesbot_waiting_branch.waitingEvents[0].remaining,1);
 // A restarted adapter/runtime must still know which event already counted.
 const restarted=new SalesbotStore(app.store,app.evolution,ws);await restarted.run(()=>Runtime.resumeRunsOnInboundMessage(restarted,{workspaceId:ws,leadId,text:'duplicate',messageId:'QA 1'}));
 assert.equal(adapter.rows('salesbot_runs').find(r=>r.id===runId).variables.salesbot_waiting_branch.waitingEvents[0].remaining,1);
 const outside=new SalesbotStore(app.store,app.evolution,other);assert.equal((await outside.rpc('salesbot_batch_decrement',{p_run_id:runId,p_text:'foreign'})).data.success,false);
 await incoming('QA 2');run=adapter.rows('salesbot_runs').find(r=>r.id===runId);assert.equal(run.status,'finished');assert.equal(run.variables.salesbot_lote_completo,true);
 assert.equal(adapter.rows('lead_activities').filter(n=>n.payload?.text==='Lote completo').length,1);
 await incoming('QA 2');assert.equal(adapter.rows('lead_activities').filter(n=>n.payload?.text==='Lote completo').length,1);
}));

test('bot internal note reaches the actual customer profile and selected recipient, with no false success for a foreign recipient',async()=>fixture(async({app,ws,leadId,owner,foreign,other,adapter})=>{
 for(const [recipient,success]of [[owner,true],[foreign,false]]){
  const botId=randomUUID();app.store.mutate(ws,d=>d.bots.push({id:botId,startBlockId:'note',blocks:[{id:'note',kind:'msg-interna',texto:'Alerta '+recipient,msgInternaDestinoTipo:'usuario',msgInternaDestinoId:recipient}]}));
  const runId=await adapter.run(()=>Runtime.startSalesbotRun(adapter,{workspaceId:ws,leadId,salesbotId:botId}));
  const logs=adapter.rows('salesbot_run_logs').filter(l=>l.salesbot_run_id===runId);
  assert.equal(logs.some(l=>l.status==='error'),!success);assert.equal(logs.some(l=>l.status==='ok'),success);
 }
 const ownerUser={id:owner,workspace_id:ws};const notices=internalMessages(app.store,ownerUser,'listInternalMessages');
 assert.equal(notices.length,1);assert.equal(notices[0].body,'Alerta '+owner);assert.equal(notices[0].origin,'salesbot');
 assert.equal(internalMessages(app.store,{id:foreign,workspace_id:other},'listInternalMessages').length,0);
 const detail=await rpc(app.store,ws,'@/lib/leads.functions','getLeadDetail',{leadId});assert.equal(detail.activities.filter(a=>a.internal).length,2);
 assert.equal(app.store.one('SELECT count(*) n FROM outbox').n,0,'internal notes never send to WhatsApp');
 internalMessages(app.store,ownerUser,'markInternalMessageRead',{id:notices[0].id});assert(internalMessages(app.store,ownerUser,'listInternalMessages')[0].read_at);
}));

test('business-hour exclusions block during their exception, for both list and legacy pause formats',async()=>fixture(async({app,ws,leadId,adapter})=>{
 for(const inHours of [true,false])for(const legacy of [true,false])for(const type of ['exceto-expediente','exceto-fora-expediente']){
  const botId=randomUUID();app.store.mutate(ws,d=>{d.businessHours={timezone:'UTC',days:Array.from({length:7},()=>({enabled:inHours,start:'00:00',end:'23:59'}))};d.bots.push({id:botId,startBlockId:'wait',blocks:[{id:'wait',kind:'pausar',...(legacy?{pausaTipo:type}:{pausas:[{tipo:type}]}),nextBlockId:'done'},{id:'done',kind:'msg-interna',texto:botId}]});});
  const runId=await adapter.run(()=>Runtime.startSalesbotRun(adapter,{workspaceId:ws,leadId,salesbotId:botId})),blocked=type==='exceto-expediente'?inHours:!inHours;
  const run=adapter.rows('salesbot_runs').find(r=>r.id===runId);assert.equal(run.status,blocked?'waiting_timer':'finished');
  assert.equal(adapter.rows('lead_activities').some(a=>a.payload?.text===botId),!blocked);
  if(blocked)assert(Date.parse(run.waiting_until)>Date.now());
 }
}));

test('media waits reject unrelated or missing media IDs and only the matching confirmation resumes',async()=>fixture(async({app,ws,leadId,adapter})=>{
 const botId=randomUUID();app.store.mutate(ws,d=>d.bots.push({id:botId,startBlockId:'wait',blocks:[{id:'wait',kind:'pausar',pausas:[{tipo:'audio-aberto',nextBlockId:'done'}]},{id:'done',kind:'msg-interna',texto:'Mídia correta'}]}));
 const runId=await adapter.run(()=>Runtime.startSalesbotRun(adapter,{workspaceId:ws,leadId,salesbotId:botId,initialVariables:{salesbot_last_sent_media:[{kind:'audio',messageId:'audio-id'}]}}));
 const event=messageId=>adapter.run(()=>Runtime.resumeRunsOnMediaEvent(adapter,{workspaceId:ws,leadId,messageId,status:'read'}));
 await event('other-id');assert.equal(adapter.rows('salesbot_runs').find(r=>r.id===runId).status,'waiting_message');
 const saved=adapter.rows('salesbot_runs').find(r=>r.id===runId),vars=structuredClone(saved.variables);vars.salesbot_waiting_branch.waitingEvents[0].messageId=null;
 await adapter.from('salesbot_runs').update({variables:vars}).eq('id',runId);await event('other-id');assert.equal(adapter.rows('salesbot_runs').find(r=>r.id===runId).status,'waiting_message');
 await adapter.from('salesbot_runs').update({variables:saved.variables}).eq('id',runId);await event('audio-id');assert.equal(adapter.rows('salesbot_runs').find(r=>r.id===runId).status,'finished');
 assert.equal(adapter.rows('lead_activities').filter(a=>a.payload?.text==='Mídia correta').length,1);
}));
