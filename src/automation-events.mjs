import {createHash} from 'node:crypto';
const tags=lead=>[...new Set([...(Array.isArray(lead.tags)?lead.tags:[]),...(lead.tag?[lead.tag]:[])].filter(t=>typeof t==='string'&&t.trim()).map(t=>t.trim()))];
const value=field=>field&&typeof field==='object'&&'value'in field?field.value:field;
export function queueLeadChanges(store,ws,before,after,revision){
 const old=new Map((before.leads||[]).map(l=>[l.id,l]));
 const enqueue=payload=>store.enqueue(ws,'crm-trigger',payload,{id:'crm-'+createHash('sha256').update(JSON.stringify([ws,revision,payload])).digest('hex')});
 for(const lead of after.leads||[]){const previous=old.get(lead.id);if(!previous)continue;
  const added=tags(lead).filter(t=>!tags(previous).includes(t));if(added.length)enqueue({leadId:lead.id,event:'tag-added',tags:added});
  for(const field of after.customFields||[]){const next=value(lead.custom?.[field.id]),prior=value(previous.custom?.[field.id]);if(JSON.stringify(next)!==JSON.stringify(prior))enqueue({leadId:lead.id,event:'field-updated',fieldId:field.id,fieldName:field.label||field.name||'',value:next??null});}
  if(lead.responsibleId!==previous.responsibleId)enqueue({leadId:lead.id,event:'assignee-changed'});
 }
}
