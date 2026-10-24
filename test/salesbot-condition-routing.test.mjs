import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {transformSync} from '../ui-source/node_modules/esbuild/lib/main.js';
import {createApp} from '../src/server.mjs';
import {SalesbotStore} from '../src/salesbot-store.mjs';
import * as Runtime from '../src/salesbot-runtime.original.mjs';

const builder=readFileSync(new URL('../ui-source/copied-source/components/automations/SalesbotBuilder.tsx',import.meta.url),'utf8');
function extract(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert(a>=0&&b>a);return source.slice(a,b);}
function compile(source,env,result){return Function(...Object.keys(env),transformSync(source,{loader:'tsx',target:'es2022'}).code+';return '+result)(...Object.values(env));}
test('actual condition editor disconnects one OU output, reconnects independently and preserves E/else and saved paths',()=>{
 let bot;const env={updateActive:fn=>bot=fn(bot)};
 const disconnect=compile(extract(builder,'function disconnectSource(','function updateBlock('),env,'disconnectSource');
 const connect=compile(extract(builder,'function connectExisting(','/** Remove a conexão'),env,'connectExisting');
 const flow=compile(extract(builder,'function computeFlow(','function ConnectionLayer('),{BLOCK_W:320},'computeFlow');
 const condition={id:'condition',kind:'condicao',condicaoModo:'ou',nextBlockId:'pause-a',falseNextBlockId:'else',condicoes:[{id:'a'},{id:'b'},{id:'c',nextBlockId:'pause-c'}]};
 const targets=['pause-a','pause-b','pause-c','else'].map((id,i)=>({id,kind:'pausar',x:600,y:i*100}));bot={blocks:[condition,...targets]};
 disconnect('condition','a');let block=bot.blocks[0];
 assert.equal(block.nextBlockId,undefined);assert.equal(block.condicoes[0].nextBlockId,undefined);assert.equal(block.condicoes[1].nextBlockId,'pause-a');assert.equal(block.condicoes[2].nextBlockId,'pause-c');assert.equal(block.falseNextBlockId,'else');
 assert(flow(bot.blocks).openEnds.some(e=>e.optionId==='a'));
 connect({sourceId:'condition',optionId:'a'},'pause-b');bot=JSON.parse(JSON.stringify(bot));
 assert.equal(bot.blocks[0].condicoes[0].nextBlockId,'pause-b');assert(!flow(bot.blocks).openEnds.some(e=>e.optionId==='a'));
 disconnect('condition','b');assert(flow(bot.blocks).openEnds.some(e=>e.optionId==='b'));assert.equal(bot.blocks[0].condicoes[0].nextBlockId,'pause-b');
 const single={...bot.blocks[0],condicoes:[bot.blocks[0].condicoes[0]]};assert(flow([single,...targets]).connectedEnds.some(e=>e.optionId==='a'));
 assert(flow([{...condition,condicaoModo:'e'},...targets]).connectedEnds.some(e=>e.sourceId==='condition'&&!e.optionId));
});

test('actual executor persists different OU destinations, one-rule OU, disconnected rule and E/else',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-condition-')),app=createApp({dir,master:'c'.repeat(64)});
 try{
  const ws=app.store.createWorkspace(),leadId=randomUUID();app.store.mutate(ws,d=>d.leads.push({id:leadId,name:'QA',phone:'5522991234567',custom:{},funnelId:d.funnels[0].id,stage:d.funnels[0].stages[0].name}));
  const adapter=new SalesbotStore(app.store,app.evolution,ws);
  for(const [mode,rules,text,expected] of [
   ['ou',[['a','A'],['b','B']],'A','a'],['ou',[['a','A'],['b','B']],'B','b'],['ou',[['a','A']],'A','a'],
   ['ou',[['a','A'],['b','B']],'C','else'],['ou',[[null,'A']],'A',null],['e',[['a','A'],['a','A']],'A','common'],['e',[['a','A'],['b','B']],'A','else']
  ]){
   const botId=randomUUID();app.store.mutate(ws,d=>d.bots.push({id:botId,startBlockId:'condition',blocks:[{id:'condition',kind:'condicao',condicaoModo:mode,condicoes:rules.map(([next,value],i)=>({id:'rule'+i,sujeito:'cliente',operador:'igual',valor:value,...(next?{nextBlockId:next}:{})})),...(expected===null?{}:{nextBlockId:'common'}),falseNextBlockId:'else'},...['a','b','else','common'].map(id=>({id,kind:'msg-interna',texto:id}))]}));
   const runId=await adapter.run(()=>Runtime.startSalesbotRun(adapter,{workspaceId:ws,leadId,salesbotId:botId,initialVariables:{last_message:text}}));
   assert.equal(adapter.rows('salesbot_runs').find(r=>r.id===runId).status,'finished');
   const notes=adapter.rows('lead_activities').filter(a=>a.payload?.salesbot_run_id===runId);assert.deepEqual(notes.map(n=>n.payload.text),expected?[expected]:[]);
   assert.equal(adapter.rows('salesbot_run_logs').filter(l=>l.salesbot_run_id===runId&&l.status==='error').length,0);
  }
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('custom field Save includes a pending select and typed last option without requiring the plus buttons',async()=>{
 const source=readFileSync(new URL('../ui-source/copied-source/components/inbox/LeadProfilePanel.tsx',import.meta.url),'utf8');let saved,closed=false,nextList;
 const addSource=extract(source,'function addField()','function removeField(');
 const saveSource=extract(source,'async function handleSave()','const needsOptions = type === "select" || type === "multiselect";');
 const env={label:'Interesse',type:'select',options:['CRM'],optionDraft:'Automação',currentList:[],mainList:[],baselineKeys:[],setCurrentList:v=>nextList=v,setLabel:()=>{},setType:()=>{},setOptions:()=>{},setOptionDraft:()=>{},saveLock:{current:false},setSavingFields:()=>{},onSaveMain:async v=>saved=v,onClose:()=>closed=true,toast:{error:message=>{throw Error(message);}}};
 await compile(addSource+'\n'+saveSource,env,'handleSave')();
 assert(closed);assert.equal(saved,nextList);assert.deepEqual(saved[0].options,['CRM','Automação']);assert.equal(saved[0].type,'select');
});

test('saving an older custom-field dialog cannot delete a field added concurrently elsewhere',async()=>{
 const source=readFileSync(new URL('../ui-source/copied-source/components/inbox/LeadProfilePanel.tsx',import.meta.url),'utf8');let patch;
 const a=source.indexOf('async function persistMainFields('),b=source.indexOf('\n return (',a);
 const env={customFields:[{key:'cf_old',label:'Antigo',type:'text'},{key:'cf_concurrent',label:'Criado em outra aba',type:'select',options:['Sim','Não']}],saveFields:async v=>patch=v.data,toast:{success:()=>{}},fieldsQ:{refetch:async()=>{}},queryClient:{invalidateQueries:()=>{}},leadId:'lead'};
 await compile(source.slice(a,b),env,'persistMainFields')([],['cf_old']);
 assert.deepEqual(patch.removedIds,['old']);assert.deepEqual(patch.fields,[]);
});
