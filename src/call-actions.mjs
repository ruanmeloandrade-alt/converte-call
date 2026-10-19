import {Core} from './database.mjs';
import {requirePermission,membership} from './teams.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=value=>/^[a-f0-9-]{36}$/.test(value||'');
export function callAction(store,user,input){
 requirePermission(store,user,'calls');
 return store.transaction(()=>{
  const d=store.get(user.workspace_id),member=membership(store,user);
  const leadAccess=id=>{if(!id)return null;const lead=d.leads.find(l=>l.id===id);if(!lead)throw fail(404,'Cliente não encontrado.');if(member.role!=='owner'&&!member.permissions.includes('allLeads')&&lead.responsibleId!==user.id&&lead.assigneeId!==user.id)throw fail(403,'Cliente não atribuído ao seu usuário.');return lead;};
  d.analyses||=[];let notification;
  if(input.type==='call-analysis-commit'){
   const next=input.next;if(!uuid(next?.id))throw fail(400,'Análise inválida.');leadAccess(next.leadId);
   const latest=d.analyses.find(x=>x.id===next.id);if(latest)leadAccess(latest.leadId);
   const merged=Core.merge({analyses:input.base?[input.base]:[]},{analyses:[next]},{analyses:latest?[latest]:[]});
   d.analyses=d.analyses.filter(x=>x.id!==next.id).concat(merged.analyses);
  }else if(['call-fields-sync','call-fields-accept'].includes(input.type)){
   requirePermission(store,user,'clients');const row=d.analyses.find(x=>x.id===input.analysisId);if(!row)throw fail(404,'Análise não encontrada.');leadAccess(input.leadId||row.leadId);
   if(input.type==='call-fields-sync')globalThis.CCCallFields.ingest(d,row,input.nodeId,input.result||{});
   else globalThis.CCCallFields.accept(d,row,input.suggestionId,input.leadId);
  }else if(input.type==='call-node-action'){
   const meta=input.meta||{};if(!uuid(meta.id)||!Number.isSafeInteger(input.entryKey)||input.entryKey<0)throw fail(400,'Evento da call inválido.');
   // Never execute a workflow definition supplied by the browser.
   const nodes=(d.workflows||[]).filter(w=>!meta.workflowId||w.id===meta.workflowId).flatMap(w=>w.nodes||[]).filter(n=>n.id===input.nodeId);
   if(nodes.length!==1)throw fail(400,'Bloco não encontrado no workflow salvo.');
   const node=nodes[0],config=node.callAction;if(!config||config.kind==='none')return {applied:false};
   const key='call:'+meta.id+':'+input.entryKey+':'+node.id;if(d.automationRuns.some(r=>r.key===key))return {applied:false};
   const lead=leadAccess(meta.lead);
   if(['tag','stage','field'].includes(config.kind)){requirePermission(store,user,'clients');if(!lead)throw fail(400,'Esta ação precisa de cliente associado.');}
   if(config.kind==='notify')notification={category:'automation',key,title:node.name,message:config.text||node.questions||'Momento do workflow atingido.',view:'calls'};
   else if(config.kind==='task'){requirePermission(store,user,'projects');const project=d.projects.find(p=>p.id===d.activeProjectId)||d.projects[0];if(!project)throw fail(400,'Crie um projeto para receber a tarefa.');d.tasks.push({id:Core.id(),projectId:project.id,title:config.text||node.name,body:'Criada durante a call '+String(meta.title||'').slice(0,200),lead:lead?.id||'',type:'task',status:'open',column:project.columns[0].id,enteredAt:Core.now(),createdAt:Core.now()});}
   else if(config.kind==='tag')lead.tag=config.text;
   else if(config.kind==='stage')Core.moveLead(d,lead,config.targetStage,lead.funnelId);
   else if(config.kind==='field'){const field=d.customFields.find(f=>f.id===config.fieldId);if(!field)throw fail(400,'Campo removido.');lead.custom||={};lead.custom[field.id]={value:config.value,source:'Workflow da call',updatedAt:Date.now()};}
   else if(config.kind==='tracking'){d.callTracking||=[];d.callTracking.push({id:Core.id(),callId:meta.id,nodeId:node.id,leadId:lead?.id||'',label:config.text||node.name,at:Core.now(),source:'workflow-call'});}
   else throw fail(400,'Ação do workflow inválida.');
   d.automationRuns.push({id:Core.id(),key,ruleId:node.id,at:Core.now(),status:'done'});Core.log(d,'call-action',lead?.id||meta.id,'Call: '+node.name+' • '+config.kind);
  }else throw fail(400,'Operação da call inválida.');
  store.put(user.workspace_id,d);return {applied:true,...(notification?{notification}: {})};
 });
}
