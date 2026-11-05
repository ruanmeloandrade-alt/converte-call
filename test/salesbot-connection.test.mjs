import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {grantConnections} from '../src/connection-entitlements.mjs';
import {createApp} from '../src/server.mjs';

test('a bot waits and resumes on its selected WhatsApp connection',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-bot-connection-')),sent=[];
 const app=createApp({dir,master:'c'.repeat(64),evolutionOptions:{
  baseUrl:'https://evolution.example',key:'fixture',fetcher:async(url,options)=>{
   if(String(url).includes('connectionState'))return Response.json({instance:{state:'open'}});
   sent.push({url:String(url),body:JSON.parse(options.body),key:options.headers.apikey});
   return Response.json({key:{id:randomUUID()}});
  },
 }});
 try{
  const ws=app.store.createWorkspace(),leadId=randomUUID(),botId=randomUUID();
  grantConnections(app.store,ws,2);
  for(const slot of [1,2])app.store.run('INSERT INTO instances(workspace_id,slot,instance_name,hook_hash,credentials,status,updated_at) VALUES(?,?,?,?,?,?,?)',ws,slot,'connection-'+slot,'hook-'+slot,app.store.vault.seal({instanceKey:'key-'+slot}),'connected',new Date().toISOString());
  app.store.mutate(ws,d=>{
   d.leads.push({id:leadId,name:'QA',phone:'5522991234567',source:'WhatsApp',custom:{}});
   d.bots.push({id:botId,nome:'Teste',startBlockId:'first',blocks:[
    {id:'first',kind:'enviar-mensagem',texto:'Primeiro',nextBlockId:'wait'},
    {id:'wait',kind:'pausar',pausas:[{id:'reply',tipo:'msg-recebida',nextBlockId:'last'}]},
    {id:'last',kind:'enviar-mensagem',texto:'Segundo'},
   ]});
  });
  const first=await app.worker.automation.dispatch(ws,{leadId,assetId:botId,kind:'bot',connectionSlot:2},randomUUID());
  assert.equal(first.status,'waiting');
  assert.equal(sent.length,1);
  assert.match(sent[0].url,/connection-2$/);
  assert.equal(sent[0].key,'key-2');
  await app.worker.automation.incoming(ws,{leadId,text:'Outra conexão',connectionSlot:1,receivedAt:new Date(Date.now()+1000).toISOString()});
  assert.equal(sent.length,1);
  await app.worker.automation.incoming(ws,{leadId,text:'Resposta',connectionSlot:2,receivedAt:new Date(Date.now()+1000).toISOString()});
  assert.equal(sent.length,2);
  assert.match(sent[1].url,/connection-2$/);
  assert.equal(sent[1].body.text,'Segundo');
  const adapter=app.worker.automation.adapter(ws,leadId,2);
  assert.equal(adapter.rows('salesbot_runs').find(run=>run.id===first.runId).status,'finished');
  app.store.mutate(ws,d=>{
   d.bots[0].startBlockId='timer';
   d.bots[0].blocks=[
    {id:'timer',kind:'pausar',pausas:[{tipo:'cronometro',seg:60}],nextBlockId:'last'},
    {id:'last',kind:'enviar-mensagem',texto:'Depois do cronômetro'},
   ];
  });
  const delayed=await app.worker.automation.dispatch(ws,{leadId,assetId:botId,kind:'bot',connectionSlot:2},randomUUID());
  await adapter.from('salesbot_runs').update({waiting_until:new Date(Date.now()-1000).toISOString()}).eq('id',delayed.runId);
  await app.worker.automation.tick(ws);
  assert.equal(sent.length,3);
  assert.match(sent[2].url,/connection-2$/);
  assert.equal(sent[2].body.text,'Depois do cronômetro');
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
