import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {build,transformSync} from '../ui-source/node_modules/esbuild/lib/main.js';
import {createApp} from '../src/server.mjs';
import {SalesbotStore} from '../src/salesbot-store.mjs';
import {rpc} from '../src/rpc.mjs';
import {internalMessages} from '../src/internal-messages.mjs';
import * as Runtime from '../src/salesbot-runtime.original.mjs';

const compiled=await build({entryPoints:['ui-source/copied-server-source/lib/stage-execution.core.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const Rules=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const now=Date.parse('2030-01-07T11:59:00Z');
async function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'cc-stage-schedule-')),app=createApp({dir,master:'a'.repeat(64)});
 try{const ws=app.store.createWorkspace(),owner=randomUUID(),leadId=randomUUID();
  app.store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',owner,owner+'@example.test','fixture','fixture',ws,new Date().toISOString());
  app.store.run("INSERT INTO team_members VALUES(?,?,'owner',?,1)",owner,ws,app.store.vault.seal([]));
  app.store.mutate(ws,d=>{const f=d.funnels[0];d.businessHours={timezone:'UTC',days:Array.from({length:7},()=>({enabled:true,start:'00:00',end:'23:59'}))};d.leads.push({id:leadId,name:'QA',phone:'',tags:['QA'],utm_source:'campanha',responsibleId:owner,funnelId:f.id,stage:f.stages[0].name,custom:{}});});
  const funnel=app.store.get(ws).funnels[0],stage=funnel.stages[0],adapter=new SalesbotStore(app.store,app.evolution,ws);
  const action=(id,execution={trigger:{kind:'created-or-moved'}})=>({id,title:id,enabled:true,channel:'ia',type:'msg-interna',config:{kind:'msg-interna',toUserId:owner,mensagem:id},execution});
  await fn({app,ws,owner,leadId,funnel,stage,adapter,action});
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
}

test('all execution kinds select their events; date reminders retain field IDs after a rename',()=>{
 const cases={'created-or-moved':['created','moved'],'created-only':['created'],'moved-only':['moved'],'assignee-changed':['assignee-changed'],'tag-added':['tag-added'],'field-updated':['field-updated'],'hours-before-field':['field-updated'],daily:['created','moved'],'exact-datetime':['created','moved']};
 for(const [kind,accepted]of Object.entries(cases))for(const event of ['created','moved','assignee-changed','tag-added','field-updated'])assert.equal(Runtime.shouldRunForEvent({execution:{trigger:{kind}}},event),accepted.includes(event),kind+':'+event);
 assert(Runtime.shouldRunForEvent({execution:{trigger:{kind:'field-updated',fieldId:'id',fieldName:'Nome antigo'}}},'field-updated',{fieldId:'id',fieldName:'Novo nome'}));
 assert(!Runtime.shouldRunForEvent({execution:{trigger:{kind:'tag-added',tags:['Quente']}}},'tag-added',{tags:['Frio']}));
});

test('native timing helpers preserve hours/days, exact time zones, date reminders, UTM/responsible filters and overnight windows',()=>{
 const lead={timezone:'UTC',tags:['QA'],assigneeId:'owner',attributes:{utm_source:'campanha'},customFields:[{id:'date',name:'Reunião',displayValue:'2030-01-08T12:00'}]};
 for(const minutes of [1,60,1440])assert.equal(Rules.stageDueAt({delayMinutes:minutes},lead,now),now+minutes*60000);
 assert.equal(Rules.stageDueAt({trigger:{kind:'exact-datetime',at:'2030-01-07T12:00'}},lead,now),Date.parse('2030-01-07T12:00Z'));
 assert.equal(Rules.stageDueAt({trigger:{kind:'hours-before-field',fieldId:'date',fieldName:'Antigo',hours:1}},lead,now),Date.parse('2030-01-08T11:00Z'));
 for(const condition of [{field:'assignee',op:'eq',value:'owner'},{field:'utm_source',op:'eq',value:'campanha'},{field:'tag',op:'in',value:'Frio, QA'}])assert(Rules.stageMatchesCondition(condition,lead));
 assert(!Rules.stageMatchesCondition({field:'tag',op:'eq',value:'Q'},lead));
 const night={active:'custom',activeWindows:[{days:[1],from:'22:00',to:'06:00'}]};
 assert(Rules.stageInsideWindow(night,lead,Date.parse('2030-01-08T02:00Z')));assert(!Rules.stageInsideWindow(night,lead,Date.parse('2030-01-08T07:00Z')));
 assert(!Rules.stageInsideWindow({active:'business-hours'},{...lead,businessHours:{days:Array.from({length:7},()=>({enabled:false,start:'09:00',end:'18:00'}))}},now));
});

test('immediate stage job is claimed once and sends a private alert through the existing service',async()=>fixture(async({app,ws,owner,leadId,funnel,stage,adapter,action})=>{
 const a=action('immediate');app.store.mutate(ws,d=>d.slimStageAutomations.push({id:funnel.id,automations:{[stage.id]:[a]}}));
 await adapter.run(()=>Runtime.enqueueLeadAutomationEvent(adapter,{workspaceId:ws,leadId,event:'created',eventId:'created-event'}));
 const job=adapter.rows('crm_automation_jobs')[0];assert.equal(job.status,'done');assert.equal(internalMessages(app.store,{id:owner,workspace_id:ws},'listInternalMessages').length,1);
 await Promise.all([adapter.run(()=>Runtime.runJobById(adapter,job.id)),adapter.run(()=>Runtime.tickStageAutomationJobs(adapter))]);
 assert.equal(internalMessages(app.store,{id:owner,workspace_id:ws},'listInternalMessages').length,1);
}));

test('native RPC applies over 2000 clients, retries without duplicates and does not reset completed jobs',async()=>fixture(async({app,ws,funnel,stage,adapter,action})=>{
 app.store.mutate(ws,d=>{for(let i=1;i<2006;i++)d.leads.push({id:'qa-'+String(i).padStart(5,'0'),name:'QA '+i,phone:'',funnelId:funnel.id,stage:stage.name,custom:{}});});
 const a=action('bulk',{trigger:{kind:'created-or-moved'},applyToExisting:true});
 const payload={pipelineId:funnel.id,automations:{[stage.id]:[a]},applyRequestId:'same-attempt'};
 const originalRun=app.store.run.bind(app.store);let writes=0;
 app.store.run=(sql,...args)=>{if(sql.startsWith('INSERT INTO salesbot_runtime_rows')&&args[1]==='crm_automation_jobs'&&++writes===501)throw Error('Interrupted second page');return originalRun(sql,...args);};
 try{await assert.rejects(rpc(app.store,ws,'@/lib/crm.functions','saveStageAutomations',payload),/Interrupted second page/);}finally{app.store.run=originalRun;}
 assert.equal(adapter.rows('crm_automation_jobs').length,500);
 assert.equal(app.store.get(ws).slimStageAutomations.find(r=>r.id===funnel.id).automations[stage.id][0].execution.applyToExisting,true);
 const first=await rpc(app.store,ws,'@/lib/crm.functions','saveStageAutomations',payload);assert.equal(first.backfilled,1506);
 let jobs=adapter.rows('crm_automation_jobs');assert.equal(jobs.length,2006);
 await adapter.run(()=>Runtime.runJobById(adapter,jobs[0].id));assert.equal(adapter.rows('crm_automation_jobs').find(j=>j.id===jobs[0].id).status,'done');
 const retry=await rpc(app.store,ws,'@/lib/crm.functions','saveStageAutomations',payload);assert.equal(retry.backfilled,0);assert.equal(adapter.rows('crm_automation_jobs').length,2006);assert.equal(adapter.rows('crm_automation_jobs').find(j=>j.id===jobs[0].id).status,'done');
 assert.equal(app.store.get(ws).slimStageAutomations.find(r=>r.id===funnel.id).automations[stage.id][0].execution.applyToExisting,false);
 const other=app.store.createWorkspace();await assert.rejects(rpc(app.store,other,'@/lib/crm.functions','backfillAutomationAction',{pipelineId:funnel.id,action:a}),/não salvo/);
}));

test('manual CRM creation emits the created trigger once even when its job is retried',async()=>fixture(async({app,ws,funnel,stage,adapter,action})=>{
 const a=action('created-only',{trigger:{kind:'created-only'}});app.store.mutate(ws,d=>d.slimStageAutomations.push({id:funnel.id,automations:{[stage.id]:[a]}}));
 const created=await rpc(app.store,ws,'@/lib/crm.functions','createLead',{name:'Novo QA',pipelineId:funnel.id,stageId:stage.id});
 const job=app.store.one("SELECT payload FROM jobs WHERE id=?",'lead-created:'+created.leadId);assert(job);
 await app.worker.automation.trigger(ws,JSON.parse(job.payload));assert.equal(adapter.rows('crm_automation_jobs').filter(j=>j.lead_id===created.leadId&&j.status==='done').length,1);
 await app.worker.automation.trigger(ws,JSON.parse(job.payload));assert.equal(adapter.rows('crm_automation_jobs').filter(j=>j.lead_id===created.leadId).length,1);
 const users=await rpc(app.store,ws,'@/lib/crm.functions','listWorkspaceUsers');assert(users.users[0].name.includes('@example.test'));
}));

test('actual timing controls retain each selected unit and all ten execution options',()=>{
 const source=readFileSync('ui-source/copied-source/components/crm/StageTriggerConfigPopover.tsx','utf8');
 const tail=source.slice(source.indexOf('type TimingValue ='));
 const h=(type,props,...children)=>({type,props:props||{},children}),Input='input-component',PickerSelect='picker';
 const js=transformSync(tail,{loader:'tsx',jsxFactory:'h',jsxFragment:'Fragment',target:'es2022'}).code;
 const Timing=Function('h','Fragment','Input','PickerSelect','cn',js+';return ExecutionTiming')(h,'fragment',Input,PickerSelect,(...s)=>s.join(' '));
 const walk=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(walk):[node,...node.children.flatMap(walk)];
 let state={spec:{kind:'created-or-moved'},delayMinutes:60,delayUnit:'minutes'};
 const render=()=>walk(Timing({...state,customFields:[],onTriggerChange:spec=>state.spec=spec,onDelayChange:(minutes,unit,clear)=>{state.delayMinutes=minutes;state.delayUnit=clear?undefined:unit||state.delayUnit;}}));
 assert.equal(render().filter(n=>n.props.role==='radio').length,10);
 for(const [unit,multiplier]of [['hours',60],['days',1440],['minutes',1]]){
  const picker=render().find(n=>n.type===PickerSelect&&n.props.options?.some(o=>o.value==='days'));picker.props.onChange(unit);
  assert.equal(state.delayUnit,unit);const input=render().find(n=>n.type===Input&&n.props.type==='number');input.props.onChange({target:{value:'2'}});
  assert.equal(state.delayMinutes,2*multiplier);assert.equal(render().find(n=>n.type===PickerSelect&&n.props.options?.some(o=>o.value==='days')).props.value,unit);
 }
});

test('Pronto save callback keeps draft and application attempt after failure and confirms the native server on retry',async()=>fixture(async({app,ws,funnel,stage,action})=>{
 const source=readFileSync('ui-source/copied-source/legacy/crm.funis-de-venda.legacy.tsx','utf8');
 const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const code=extract('function assertAutomationPersistence(','  async function saveAutomatize(')+extract('  async function saveAutomatize(','  function addTrigger(');
 let draft={[stage.id]:[action('save-ui',{trigger:{kind:'created-or-moved'},delayMinutes:120,delayUnit:'hours',applyToExisting:true})]},failed=true,lastDraft=draft;const attempts=[];
 const storage=new Map(),storageApi={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k)};
 const env={draft,funnelId:funnel.id,savingAutomations:false,stageActionStamp:Rules.stageActionStamp,setDraft:v=>lastDraft=v,automationSaveRequest:{current:null},stageAutomationDraftStorageKey:id=>'draft:'+id,stageAutomationStorageKey:id=>'saved:'+id,localStorage:storageApi,sessionStorage:storageApi,setSavingAutomations:()=>{},saveStageAutomationsServer:async({data})=>{attempts.push(data.applyRequestId);if(failed)throw Error('Server unavailable');return rpc(app.store,ws,'@/lib/crm.functions','saveStageAutomations',data);},listStageAutomationsServer:({data})=>rpc(app.store,ws,'@/lib/crm.functions','listStageAutomations',data),setAutomations:()=>{},toast:{success:()=>{},error:()=>{}},setConfiguring:()=>{},setColorMode:()=>{},setSelectedColorStageId:()=>{},setMode:()=>{},console:{error:()=>{},warn:()=>{}}};
 const js=transformSync(code,{loader:'tsx',target:'es2022'}).code,save=Function(...Object.keys(env),js+';return saveAutomatize')(...Object.values(env));
 await assert.rejects(save(draft,true),/Server unavailable/);assert.equal(lastDraft,draft);assert(env.automationSaveRequest.current);
 failed=false;await save(draft,true);assert.equal(attempts[0],attempts[1]);assert.equal(env.automationSaveRequest.current,null);assert.equal(lastDraft[stage.id][0].execution.applyToExisting,false);assert.equal(lastDraft[stage.id][0].execution.delayUnit,'hours');
}));

test('daily schedules recur for each workspace; stale delayed jobs stop after leaving the stage',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 await fixture(async({app,ws,leadId,funnel,stage,adapter,action})=>{
  const daily=action('daily',{trigger:{kind:'daily',time:'12:00'}}),dwell=action('dwell',{trigger:{kind:'created-or-moved'},delayMinutes:2});
  app.store.mutate(ws,d=>d.slimStageAutomations.push({id:funnel.id,automations:{[stage.id]:[daily,dwell]}}));
  await adapter.run(()=>Runtime.enqueueLeadAutomationEvent(adapter,{workspaceId:ws,leadId,event:'created',eventId:'start'}));
  const initial=adapter.rows('crm_automation_jobs');assert.equal(initial.length,2);assert(initial.every(j=>j.status==='pending'));
  const other=app.store.createWorkspace(),otherAdapter=new SalesbotStore(app.store,app.evolution,other);
  app.store.mutate(other,d=>{const f=d.funnels[0];d.leads.push({id:randomUUID(),phone:'',funnelId:f.id,stage:f.stages[0].name,custom:{}});d.slimStageAutomations.push({id:f.id,automations:{[f.stages[0].id]:[{...daily,id:'other-daily'}]}});});
  await adapter.run(()=>Runtime.scheduleStageTimerActions(adapter));await otherAdapter.run(()=>Runtime.scheduleStageTimerActions(otherAdapter));assert.equal(otherAdapter.rows('crm_automation_jobs').length,1);
  t.mock.timers.tick(60001);await app.worker.automation.tick(ws);
  assert.equal(adapter.rows('crm_automation_jobs').filter(j=>j.action_id==='daily'&&j.status==='done').length,1);
  const next=adapter.rows('crm_automation_jobs').find(j=>j.action_id==='daily'&&j.status==='pending');assert.equal(next.due_at,'2030-01-08T12:00:00.000Z');
  app.store.mutate(ws,d=>{d.leads[0].stage=funnel.stages[1].name;});t.mock.timers.tick(60001);await app.worker.automation.tick(ws);
  assert.equal(adapter.rows('crm_automation_jobs').find(j=>j.action_id==='dwell').status,'skipped');
 });
});

test('queued reminders and timers are rejected after their date, action or filters change',async t=>{
 t.mock.timers.enable({apis:['Date'],now});
 await fixture(async({app,ws,owner,leadId,funnel,stage,adapter,action})=>{
  const field=randomUUID(),target='2030-01-07T12:00:00';
  const reminder=action('reminder',{trigger:{kind:'hours-before-field',fieldId:field,fieldName:'Antigo',hours:0}}),exact=action('exact',{trigger:{kind:'exact-datetime',at:target}}),filtered=action('filtered',{trigger:{kind:'created-only'},conditions:[{field:'assignee',op:'eq',value:owner},{field:'utm_source',op:'eq',value:'campanha'}]});
  app.store.mutate(ws,d=>{d.customFields.push({id:field,label:'Novo',type:'datetime'});d.leads[0].custom[field]={value:target};d.slimStageAutomations.push({id:funnel.id,automations:{[stage.id]:[reminder,exact,filtered]}});});
  await adapter.run(()=>Runtime.enqueueLeadAutomationEvent(adapter,{workspaceId:ws,leadId,event:'created',eventId:'created'}));
  assert.equal(adapter.rows('crm_automation_jobs').find(j=>j.action_id==='filtered').status,'done');
  await adapter.run(()=>Runtime.enqueueLeadAutomationEvent(adapter,{workspaceId:ws,leadId,event:'field-updated',fieldId:field,fieldName:'Novo',eventId:'date'}));
  app.store.mutate(ws,d=>{d.leads[0].custom[field]={value:'2030-01-08T12:00:00'};d.slimStageAutomations[0].automations[stage.id].find(a=>a.id==='exact').enabled=false;});
  t.mock.timers.tick(60001);await app.worker.automation.tick(ws);
  assert.equal(adapter.rows('crm_automation_jobs').find(j=>j.action_id==='exact').status,'skipped');assert.equal(adapter.rows('crm_automation_jobs').find(j=>j.action_id==='reminder'&&j.context.reminderTarget===target).status,'skipped');
  assert.equal(internalMessages(app.store,{id:owner,workspace_id:ws},'listInternalMessages').length,1);
 });
});
