import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createApp} from '../src/server.mjs';import {SalesbotStore} from '../src/salesbot-store.mjs';import * as Runtime from '../src/salesbot-runtime.original.mjs';
test('custom fields persist atomically through authenticated RPC, keep blank definitions and confirm values',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-fields-')),app=createApp({dir,master:'f'.repeat(64),bootstrap:'fields'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,data,token)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}};
 try {const owner=(await call('/v1/auth/bootstrap',{token:'fields',email:'owner@fields.test',password:'Fields-password'})).body;
 const rpc=async(method,data={},token=owner.accessToken)=>call('/v1/slim/rpc',{module:method==='createLead'?'@/lib/crm.functions':'@/lib/leads.functions',method,data},token);
 const before=(await rpc('listLeadCustomFields')).body.fields;
 const saved=await rpc('saveLeadCustomFields',{removedIds:[],fields:[{name:'Escolha',fieldType:'select',options:['A','B']},{name:'Interesses',fieldType:'multiselect',options:['X','Y']}]});assert.equal(saved.status,200,JSON.stringify(saved));const fields=saved.body.fields;assert.equal(fields.length,before.length+2);const selected=fields.find(f=>f.name==='Escolha');assert.deepEqual(selected.options,['A','B']);
 const lead=(await rpc('createLead',{name:'Cliente'})).body.leadId;
 assert.equal((await rpc('listLeadCustomFields')).body.fields.length,fields.length);
 const value=(await rpc('setLeadCustomFieldValue',{leadId:lead,fieldId:selected.id,value:'B'})).body;assert.equal(value.ok,true);assert.equal(value.value,'B');
 const detail=(await rpc('getLeadDetail',{leadId:lead})).body;assert.equal(detail.lead.customFields.find(f=>f.id===selected.id).displayValue,'B');
 const botId=crypto.randomUUID();app.store.mutate(owner.workspaceId,d=>d.bots.push({id:botId,startBlockId:'field',blocks:[{id:'field',kind:'acao',acaoTipo:'definir-campo',campoId:selected.id,campoValor:'A',campoOrigem:'manual'}]}));
 const adapter=new SalesbotStore(app.store,app.evolution,owner.workspaceId);await adapter.run(()=>Runtime.startSalesbotRun(adapter,{workspaceId:owner.workspaceId,leadId:lead,salesbotId:botId}));
 assert.equal((await rpc('getLeadDetail',{leadId:lead})).body.lead.customFields.find(f=>f.id===selected.id).displayValue,'A');
 const manual=(await rpc('createLeadCustomField',{name:'Origem manual',fieldType:'text'})).body.field;
 await rpc('setLeadCustomFieldValue',{leadId:lead,fieldId:manual.id,value:'Perfil preenchido'});
 const copyBot=crypto.randomUUID();app.store.mutate(owner.workspaceId,d=>d.bots.push({id:copyBot,startBlockId:'copy',blocks:[{id:'copy',kind:'acao',acaoTipo:'definir-campo',campoId:selected.id,campoOrigem:'copiar',campoOrigemRef:manual.id}]}));
 await adapter.run(()=>Runtime.startSalesbotRun(adapter,{workspaceId:owner.workspaceId,leadId:lead,salesbotId:copyBot}));
 assert.equal((await rpc('getLeadDetail',{leadId:lead})).body.lead.customFields.find(f=>f.id===selected.id).displayValue,'Perfil preenchido');
 const currentFields=(await rpc('listLeadCustomFields')).body.fields;
 const savedBefore=structuredClone(app.store.get(owner.workspaceId).leads.find(l=>l.id===lead).custom[selected.id]);
 const invalid=await rpc('saveLeadCustomFields',{removedIds:[selected.id],fields:[{name:'Primeiro válido',fieldType:'text'},{name:'Inválido',fieldType:'select',options:[]}]});assert.notEqual(invalid.status,200);assert.deepEqual((await rpc('listLeadCustomFields')).body.fields,currentFields);assert.deepEqual(app.store.get(owner.workspaceId).leads.find(l=>l.id===lead).custom[selected.id],savedBefore);
 const other=(await call('/v1/auth/register',{registrationMode:'quick',name:'Outra',whatsapp:'5522991234567',email:'other@fields.test',password:'Fields-other-password'})).body;
 assert.equal((await rpc('listLeadCustomFields',{},other.accessToken)).body.fields.some(f=>f.id===selected.id),false);
 await rpc('saveLeadCustomFields',{removedIds:[selected.id],fields:[]});assert.equal(app.store.get(owner.workspaceId).leads.find(l=>l.id===lead).custom[selected.id],undefined);
 assert.notEqual((await call('/v1/slim/rpc',{module:'@/lib/leads.functions',method:'saveLeadCustomFields',data:{removedIds:[],fields:[]}})).status,200);
 } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});
