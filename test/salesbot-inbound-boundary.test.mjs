import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {SalesbotStore} from '../src/salesbot-store.mjs';

const later=()=>new Date(Date.now()+10).toISOString();
async function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'cc-inbound-boundary-')),sent=[];
 const app=createApp({dir,master:'c'.repeat(64),evolutionOptions:{baseUrl:'https://evolution.example',key:'fixture',fetcher:async(url,init)=>{sent.push({text:JSON.parse(init.body).text,at:Date.now()});return Response.json({key:{id:randomUUID()}});}}});
 try{
  const ws=app.store.createWorkspace(),leadId=randomUUID(),botId=randomUUID();
  app.store.run('INSERT INTO instances(workspace_id,instance_name,hook_hash,credentials,status,updated_at) VALUES(?,?,?,?,?,?)',ws,'cc-boundary','hook',app.store.vault.seal({instanceKey:'fixture-key'}),'connected',new Date().toISOString());
  app.store.mutate(ws,d=>{const f=d.funnels[0];d.leads.push({id:leadId,name:'Cliente',phone:'5522991234567',custom:{},funnelId:f.id,stage:f.stages[0].name,status:'open'});d.bots.push({id:botId,nome:'Atendimento',isActive:true,startBlockId:'hello',gatilhos:[],blocks:[{id:'hello',kind:'enviar-mensagem',texto:'Primeira pergunta',nextBlockId:'wait-1'},{id:'wait-1',kind:'pausar',pausas:[{tipo:'msg-recebida',nextBlockId:'second'},{tipo:'cronometro',min:30,nextBlockId:'timeout'}]},{id:'second',kind:'enviar-mensagem',texto:'Segunda pergunta',nextBlockId:'wait-2'},{id:'wait-2',kind:'pausar',pausas:[{tipo:'msg-recebida',nextBlockId:'third'}]},{id:'third',kind:'enviar-mensagem',texto:'Resposta final'},{id:'timeout',kind:'enviar-mensagem',texto:'Sem resposta'}]});});
  const adapter=new SalesbotStore(app.store,app.evolution,ws),runtime=app.worker.automation;
  await fn({app,ws,leadId,botId,sent,adapter,runtime});
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
}

test('lead-created stage bot cannot consume its starting inbound as the answer to a new pause',async()=>fixture(async({app,ws,leadId,botId,sent,adapter,runtime})=>{
 const lead=adapter.rows('leads').find(l=>l.id===leadId);
 app.store.mutate(ws,d=>d.slimStageAutomations.push({id:lead.pipeline_id,automations:{[lead.stage_id]:[{id:'stage-bot',type:'salesbot',enabled:true,config:{kind:'salesbot',botId},execution:{trigger:{kind:'created-or-moved'}}}]}}));
 const receivedAt=new Date().toISOString();
 await runtime.incoming(ws,{leadId,messageId:'initial',text:'Olá',isFirstMessage:true,receivedAt});
 assert.deepEqual(sent.map(m=>m.text),['Primeira pergunta']);
 let run=adapter.rows('salesbot_runs')[0];
 assert.equal(run.status,'waiting_message');assert(run.waiting_started_at);assert(run.waiting_until);
 await runtime.tick(ws);assert.equal(sent.length,1,'30-minute fallback cannot fire early');
 await runtime.incoming(ws,{leadId,messageId:'already-queued',text:'Mensagem anterior à pausa',receivedAt});
 assert.equal(sent.length,1,'queued earlier input cannot release a future wait');
 await runtime.incoming(ws,{leadId,messageId:'answer-1',text:'Minha primeira resposta',receivedAt:later()});
 assert.deepEqual(sent.map(m=>m.text),['Primeira pergunta','Segunda pergunta']);
 assert.equal(adapter.rows('salesbot_runs')[0].status,'waiting_message');
 await runtime.incoming(ws,{leadId,messageId:'answer-1',text:'Minha primeira resposta',receivedAt:later()});
 assert.equal(sent.length,2,'same inbound cannot answer two pauses');
 await runtime.incoming(ws,{leadId,messageId:'answer-2',text:'Outra resposta',receivedAt:later()});
 assert.equal(sent.length,3);assert.equal(adapter.rows('salesbot_runs')[0].status,'finished');
}));

test('keyword trigger ignores unrelated text and mixed wait uses only its timed branch when due',async()=>fixture(async({app,ws,leadId,sent,adapter,runtime})=>{
 app.store.mutate(ws,d=>{d.bots[0].gatilhos=[{kind:'palavra-chave',palavraChave:'iniciar',palavraChaveModo:'igual'}];});
 await runtime.incoming(ws,{leadId,messageId:'wrong',text:'Olá'});assert.equal(sent.length,0);
 await runtime.incoming(ws,{leadId,messageId:'right',text:'iniciar'});assert.equal(sent.length,1);
 let run=adapter.rows('salesbot_runs')[0];assert.equal(run.status,'waiting_message');
 // Persisted due date simulates the configured 30 minutes, without waiting in the test.
 await adapter.from('salesbot_runs').update({waiting_until:new Date(Date.now()-1000).toISOString()}).eq('id',run.id);
 await runtime.tick(ws);
 assert.deepEqual(sent.map(m=>m.text),['Primeira pergunta','Sem resposta']);
 assert.equal(adapter.rows('salesbot_runs')[0].status,'finished');
 await runtime.tick(ws);assert.equal(sent.length,2,'expired fallback runs once');
}));

test('short timer still waits its configured duration before sending',async()=>fixture(async({app,ws,leadId,botId,sent,runtime})=>{
 app.store.mutate(ws,d=>{const b=d.bots[0];b.startBlockId='delay';b.blocks.unshift({id:'delay',kind:'pausar',pausas:[{tipo:'cronometro',seg:1}],nextBlockId:'hello'});b.gatilhos=[{kind:'primeira-mensagem'}];});
 const start=Date.now();await runtime.incoming(ws,{leadId,messageId:'timed-first',text:'Olá',isFirstMessage:true});
 assert.equal(sent.length,1);assert(sent[0].at-start>=950,'timer cannot send immediately');
}));

test('trigger delay persists and cannot send before its due time',async()=>fixture(async({app,ws,leadId,sent,adapter,runtime})=>{
 app.store.mutate(ws,d=>{d.bots[0].gatilhos=[{kind:'palavra-chave',palavraChave:'iniciar',palavraChaveModo:'igual',atrasoMin:10}];});
 await runtime.incoming(ws,{leadId,messageId:'delayed',text:'iniciar'});
 let run=adapter.rows('salesbot_runs')[0];assert.equal(run.status,'waiting_timer');assert.equal(sent.length,0);
 assert(Date.parse(run.waiting_until)-Date.now()>590000);
 await runtime.tick(ws);assert.equal(sent.length,0);
 await runtime.incoming(ws,{leadId,messageId:'too-early',text:'Outra mensagem'});assert.equal(sent.length,0);
 await adapter.from('salesbot_runs').update({waiting_until:new Date(Date.now()-1000).toISOString()}).eq('id',run.id);
 await runtime.tick(ws);assert.deepEqual(sent.map(m=>m.text),['Primeira pergunta']);
 assert.equal(adapter.rows('salesbot_runs')[0].status,'waiting_message');
}));
