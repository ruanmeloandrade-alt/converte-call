import {isCompanyMessageTarget,requireCompanyMessageTarget} from './companies.mjs';
import {randomUUID,createHash} from 'node:crypto';
import * as Original from './salesbot-runtime.original.mjs';
import {SalesbotStore} from './salesbot-store.mjs';
import {AI_DEFAULTS} from './ai.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});

export class AutomationRuntime{
 constructor(store,evolution,{aiOptions}={}){Object.assign(this,{store,evolution,aiOptions});this.locks=new Map();}
 adapter(ws,leadId){const adapter=new SalesbotStore(this.store,this.evolution,ws);adapter.aiOptions=this.aiOptions;adapter.google=this.google;adapter.leadId=leadId;return adapter;}
 async locked(ws,lead,fn){const key=ws+':'+lead,previous=this.locks.get(key)||Promise.resolve(),task=previous.catch(()=>{}).then(fn);this.locks.set(key,task);try{return await task;}finally{if(this.locks.get(key)===task)this.locks.delete(key);}}
 async dispatch(ws,input,requestId){
  if(!/^[a-f0-9-]{36}$/.test(requestId||''))throw fail(400,'Atualize a extensão para iniciar esta automação com segurança.');
  return this.locked(ws,input.leadId,async()=>{
   const key='dispatch:'+requestId,hash=createHash('sha256').update(JSON.stringify([input.leadId,input.kind,input.assetId])).digest('hex'),existing=this.store.one('SELECT * FROM idempotency WHERE workspace_id=? AND key=?',ws,key);
   if(existing){if(existing.request_hash!==hash)throw fail(409,'Esta solicitação já pertence a outra automação.');const response=JSON.parse(existing.response);if(response.status==='processing')throw fail(409,'Esta execução já foi iniciada. Confira o histórico antes de tentar outra.');if(response.status==='failed')throw fail(502,response.error);return response;}
   const d=this.store.get(ws),lead=d.leads.find(l=>l.id===input.leadId);if(!lead)throw fail(404,'Cliente não encontrado.');requireCompanyMessageTarget(d,lead);if(!['bot','agent'].includes(input.kind))throw fail(400,'Selecione bot ou agente IA.');const asset=(input.kind==='bot'?d.bots:d.agents).find(a=>a.id===input.assetId);if(!asset)throw fail(404,'Automação não encontrada nesta conta.');if(asset.isActive===false||asset.enabled===false)throw fail(400,'Ative a automação antes de iniciar.');const connection=await this.evolution.status(ws);if(connection.status!=='connected')throw fail(409,'Conecte seu WhatsApp antes de iniciar.');
   this.store.run('INSERT INTO idempotency VALUES(?,?,?,?,?)',ws,key,hash,JSON.stringify({status:'processing'}),Date.now());
   try{const adapter=this.adapter(ws);let result;
    if(input.kind==='bot'){
     const runId=await adapter.run(()=>Original.startSalesbotRun(adapter,{workspaceId:ws,salesbotId:asset.id,leadId:lead.id,initialVariables:{trigger:'manual',requestId}}));if(!runId)throw Error('O motor não iniciou o bot. Confira o histórico.');
     const run=adapter.rows('salesbot_runs').find(r=>r.id===runId),errors=adapter.rows('salesbot_run_logs').filter(r=>r.salesbot_run_id===runId&&r.status==='error');if(errors.length)throw Error(errors.at(-1).message);
     result={runId,status:run?.status==='finished'?'done':run?.status?.startsWith('waiting')?'waiting':'running'};
    }else{
     const p=String(d.providers.ai||'openai').toLowerCase(),credentials=this.store.secret(ws,p==='openai'?'openai':'ai:'+p);if(!credentials?.apiKey)throw Error('Salve sua API key em Integrações antes de ativar o agente.');
     await adapter.from('leads').update({active_conversation_agent_id:asset.id,ai_paused:false}).eq('id',lead.id);
     const runId=this.store.one("SELECT id FROM runs WHERE workspace_id=? AND lead_id=? AND kind='agent' AND asset_id=? AND status='active' ORDER BY updated_at DESC LIMIT 1",ws,lead.id,asset.id)?.id||randomUUID(),now=new Date().toISOString();this.store.run('INSERT OR REPLACE INTO runs VALUES(?,?,?,?,?,?,?,?,?,?)',runId,ws,lead.id,'agent',asset.id,'active',null,this.store.vault.seal({provider:p,model:credentials.model||AI_DEFAULTS[p]?.model}),now,now);
     // The next incoming message is the trigger. Activation never invents an
     // inbound message, sends a greeting or replies to an already handled turn.
     result={runId,status:'active'};
    }
    this.store.run('UPDATE idempotency SET response=? WHERE workspace_id=? AND key=?',JSON.stringify(result),ws,key);this.store.event(ws,{type:'automation',leadId:lead.id,kind:input.kind,assetId:asset.id,...result});return result;
   }catch(error){const message=String(error.message||'A automação falhou.').slice(0,300);this.store.run('UPDATE idempotency SET response=? WHERE workspace_id=? AND key=?',JSON.stringify({status:'failed',error:message}),ws,key);this.store.event(ws,{type:'automation-error',leadId:lead.id,message});throw fail(502,message);}
  });
 }
 async incoming(ws,payload){
  {const d=this.store.get(ws),l=d.leads.find(l=>l.id===payload.leadId);if(l&&!isCompanyMessageTarget(d,l))return;}
  const receivedAt=payload.receivedAt||this.store.get(ws).inboxEvents.find(e=>e.id===payload.messageId)?.at||new Date().toISOString();
  return this.locked(ws,payload.leadId,async()=>{const adapter=this.adapter(ws);
   const waits=adapter.rows('salesbot_runs').filter(r=>r.lead_id===payload.leadId&&r.status==='waiting_message');
   const logs=waits.some(r=>!r.waiting_started_at)?adapter.rows('salesbot_run_logs'):[];
   const resumableRunIds=waits.filter(r=>{
    const started=r.waiting_started_at||logs.filter(l=>l.salesbot_run_id===r.id&&l.block_id===r.current_block_id&&l.status==='wait').map(l=>l.created_at).sort().at(-1)||r.created_at;
    return !started||Date.parse(started)<Date.parse(receivedAt);
   }).map(r=>r.id);
   await adapter.run(async()=>{if(payload.isFirstMessage){await Original.dispatchLeadCreated(adapter,{workspaceId:ws,leadId:payload.leadId});await Original.enqueueLeadAutomationEvent(adapter,{workspaceId:ws,leadId:payload.leadId,event:'created',eventId:payload.messageId});}await Original.dispatchInboundMessage(adapter,{workspaceId:ws,leadId:payload.leadId,text:payload.text||'',canal:'whatsapp',isFirstMessage:!!payload.isFirstMessage,resumableRunIds,messageId:payload.messageId});if(adapter.errors.length)throw adapter.errors.at(-1);const lead=adapter.rows('leads').find(l=>l.id===payload.leadId);if(lead?.ai_paused||!lead?.active_conversation_agent_id){this.store.event(ws,{type:'automation',leadId:payload.leadId,kind:'agent',status:'done'});this.store.run("UPDATE runs SET status='done',updated_at=? WHERE workspace_id=? AND lead_id=? AND kind='agent' AND status='active'",new Date().toISOString(),ws,payload.leadId);}});});}
 async stage(ws,payload){{const d=this.store.get(ws),l=d.leads.find(l=>l.id===payload.leadId);if(l&&!isCompanyMessageTarget(d,l))return;}return this.locked(ws,payload.leadId,async()=>{const adapter=this.adapter(ws),lead=adapter.rows('leads').find(l=>l.id===payload.leadId);if(!lead)return;await adapter.run(async()=>{await Original.dispatchStageChange(adapter,{workspaceId:ws,leadId:lead.id,newStageId:lead.stage_id,newPipelineId:lead.pipeline_id});await Original.enqueueLeadAutomationEvent(adapter,{workspaceId:ws,leadId:lead.id,event:'moved',pipelineId:lead.pipeline_id,stageId:lead.stage_id,eventId:payload.eventId});});});}
 async trigger(ws,payload){{const d=this.store.get(ws),l=d.leads.find(l=>l.id===payload.leadId);if(l&&!isCompanyMessageTarget(d,l))return;}return this.locked(ws,payload.leadId,async()=>{const adapter=this.adapter(ws,payload.leadId);if(!adapter.rows('leads').length)return;const params={...payload,workspaceId:ws};await adapter.run(async()=>{if(payload.event==='created')await Original.dispatchLeadCreated(adapter,params);if(payload.event==='tracking')await Original.dispatchTrackingEvent(adapter,params);if(payload.event==='tag-added')await Original.dispatchTagAdded(adapter,params);if(payload.event==='field-updated')await Original.dispatchCustomFieldChanged(adapter,{...params,value:String(payload.value??'')});if(payload.event!=='tracking')await Original.enqueueLeadAutomationEvent(adapter,params);if(adapter.errors.length)throw adapter.errors.at(-1);});});}
 async tick(ws){const adapter=this.adapter(ws);await adapter.run(async()=>{await Original.tickWaitingTimers(adapter);await Original.tickStageAutomationJobs(adapter,20);});const d=this.store.get(ws);for(const lead of d.leads.filter(l=>l.agentId&&!l.aiPaused&&isCompanyMessageTarget(d,l)).slice(0,200))await this.locked(ws,lead.id,async()=>{const scoped=this.adapter(ws,lead.id);await scoped.run(async()=>{await Original.tickAiAgentTracking(scoped);await Original.tickAiAgentInactivity(scoped);if(scoped.errors.length)throw scoped.errors.at(-1);});});}
}
