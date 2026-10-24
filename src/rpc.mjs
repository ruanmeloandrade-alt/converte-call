import {companiesRPC,customerCompany,companyMembers,companyPrimary} from './companies.mjs';
import {SalesbotStore} from './salesbot-store.mjs';
import * as StageRuntime from './salesbot-runtime.original.mjs';
import {objectivePixelOptions} from './pixel-leads.mjs';
import {leadSales} from './lead-sales.mjs';
import {normalizeProduct, prepareOrder, applyOrderStock} from './product-policy.mjs';
import {workflowRPC} from './workflow-adapter.mjs';
import { Core } from "./database.mjs";
import { uploadAsset, signedAsset } from "./assets.mjs";
const id = () => crypto.randomUUID();
const displayFieldValue = (field, entry) => {
  let value = entry?.value ?? entry ?? '';
  if (value && typeof value === 'object' && !Array.isArray(value)) value = value.display ?? value.raw ?? '';
  if (Array.isArray(value)) return value.join(field.type === 'multiselect' ? '|' : ', ');
  if (field.type === 'multiselect' && typeof value === 'string' && !value.includes('|')) {
    const selected = (field.options || []).filter(option => value.split(',').map(v => v.trim()).includes(option));
    if (selected.length) return selected.join('|');
  }
  return String(value ?? '');
};
const field = (f) => ({ id: f.id, name: f.label, fieldType: f.type, options: f.options || [] });
function leadRow(d, l) {
  const funnel = d.funnels.find((f) => f.id === l.funnelId), stage = funnel?.stages.find((s) => s.name === l.stage || s.id === l.stageId);
  return { ...l, email: l.email || null, phone: l.phone || null, value: Number(l.value) || 0, pipeline_id: l.funnelId, stage_id: stage?.id, createdAt: l.createdAt, created_at: l.createdAt, tags: l.tags || l.tag ? [...l.tags || [], ...l.tag ? [l.tag] : []] : [], lastMessageFrom: "none", stageName: l.stage, pipelineName: funnel?.name };
}
function funnels(d, lite = false) {
  return d.funnels.map((f) => ({ ...f, stages: f.stages.map((s) => ({ ...s, status: s.name === "Venda realizada" ? "ganha" : s.name === "Perdida" ? "perdida" : "aberta", leads: lite ? [] : d.leads.filter((l) => {const c=customerCompany(d,l);return l.funnelId===f.id&&l.stage===s.name&&(!c||(companyPrimary(d,c)||companyMembers(d,c)[0])?.id===l.id);}).map(l=>{const row=leadRow(d,l),c=customerCompany(d,l);return c?{...row,name:c.name,company:`${companyMembers(d,c).length} contatos · Responsável: ${companyPrimary(d,c)?.name||'não definido'}`,companyCard:true}:row;}) })) }));
}
const findLead = (d, p) => {
  const l = d.leads.find((l2) => l2.id === (p.leadId || p.id));
  if (!l) throw Object.assign(Error("Cliente não encontrado."), {status:404});
  return l;
};
const findPipeline = (d, p) => {
  const f = d.funnels.find((f2) => f2.id === (p.pipelineId || p.funnelId));
  if (!f) throw Object.assign(Error("Funil não encontrado."), {status:404});
  return f;
};
function upsert(rows, row) {
  const existing = rows.find((x) => x.id === row.id);
  if (existing) Object.assign(existing, row);
  else rows.push(row);
  return row;
}
async function rpc(store, ws, module, name, arg = {}) {
  const p = arg?.data ?? arg ?? {};
  const d = store.get(ws), baseline = structuredClone(d);
  let result, changed = false;
  const createdLeadIds=[];
  const workspaceUsers=()=>store.all('SELECT u.id,u.email,p.profile FROM users u JOIN team_members m ON m.user_id=u.id LEFT JOIN account_profiles p ON p.user_id=u.id WHERE m.workspace_id=? AND m.active=1',ws).map(u=>{const profile=u.profile?store.vault.open(u.profile):{};return {id:u.id,email:u.email,name:[profile.firstName,profile.lastName].filter(Boolean).join(' ')||u.email};});
  const now = () => (/* @__PURE__ */ new Date()).toISOString();
  if(module==='@/lib/companies.functions'&&name!=='uploadCompanyLogo'){const response=companiesRPC(d,name,p,Core,store.actorId);if(response.changed)store.put(ws,d);return response.result;}
  if(module==='@/lib/workflow.functions'){const response=workflowRPC(d,name,p,Core);if(response.changed)store.put(ws,d);return response.result;}
  switch (name) {
    case 'getLeadSales':
      return leadSales(d,name,p);
    case 'saveLeadSale': {
      const result=leadSales(d,name,p);store.put(ws,d);return result;
    }
    case "getActiveWorkspace":
      result = { workspace: { id: d.workspaceId || "local-workspace", name: "Meu espa\xE7o" }, workspaceId: d.workspaceId || "local-workspace" };
      break;
    case "getCurrentUserRoles":
      result = { isAdmin: false, isSuperAdmin: false, roles: [] };
      break;
    case "listWorkspaceUsers":
      result = { users: workspaceUsers() };
      break;
    case "listInternalMessageTargets":
      result = { users: workspaceUsers(), departments: [], admins: [] };
      break;
    case "listWorkspaceChannels":
      result = {whatsapp:d.connections?.whatsapp?.status==="connected"?[{id:d.connections.whatsapp.sessionId||"account-whatsapp",label:d.connections.whatsapp.phone||"WhatsApp conectado",status:"connected"}]:[],instagram:[],facebook:[],email:[]};
      break;
    case "listCrmSources":
      result = { sources: d.crmSources.length ? d.crmSources : d.funnels.length ? [{id:"local-source",provider:"mkton",display_name:"Converte Call",is_default:true}] : [] };
      break;
    case "createCrmSource": {
      const source = { id: id(), provider: "mkton", display_name: p.name, is_default: !d.crmSources.length };
      d.crmSources.push(source);
      result = { sourceId: source.id };
      changed = true;
      break;
    }
    case "setDefaultCrmSource":
      for (const s of d.crmSources) s.is_default = s.id === p.crmSourceId;
      changed = true;
      result = { ok: true };
      break;
    case "listFunnels":
      result = { funnels: funnels(d) };
      break;
    case "listAllPipelineStages":
      result = { pipelines: funnels(d, true) };
      break;
    case "createFunnel": {
      const f = { id: id(), name: p.name || "Funil Comercial", stages: Core.defaultStages(), sourceId: p.crmSourceId };
      d.funnels.push(f);
      result = { pipelineId: f.id };
      changed = true;
      break;
    }
    case "renamePipeline":
      findPipeline(d, p).name = p.name;
      changed = true;
      result = { ok: true };
      break;
    case "reorderFunnels":
      d.funnels.sort((a, b) => (p.pipelineIds || p.funnelIds || []).indexOf(a.id) - (p.pipelineIds || p.funnelIds || []).indexOf(b.id));
      changed = true;
      result = { ok: true };
      break;
    case "duplicatePipeline": {
      const old = findPipeline(d, p), copy = structuredClone(old);
      copy.id = id();
      copy.name = p.name || old.name + " (c\xF3pia)";
      copy.stages = copy.stages.map((s) => ({ ...s, id: id() }));
      d.funnels.push(copy);
      result = { pipelineId: copy.id };
      changed = true;
      break;
    }
    case "deletePipeline": {
      const f = findPipeline(d, p);
      if (d.leads.some((l) => l.funnelId === f.id)) throw Error("Mova ou exclua os clientes deste funil antes de remov\xEA-lo.");
      d.funnels = d.funnels.filter((x) => x.id !== f.id);
      result = { ok: true };
      changed = true;
      break;
    }
    case "createPipelineStage": {
      const f = findPipeline(d, p), s = { id: id(), name: p.name, color: p.color || "#8b72da", description: p.description || "" };
      f.stages.push(s);
      result = { stageId: s.id };
      changed = true;
      break;
    }
    case "updatePipelineStage": {
      const f = d.funnels.find((f2) => f2.stages.some((s2) => s2.id === p.stageId)), s = f?.stages.find((s2) => s2.id === p.stageId);
      if (!s) throw Error("Etapa n\xE3o encontrada.");
      const old = s.name;
      Object.assign(s, p.patch || p);
      if (p.name) for (const l of d.leads.filter((l2) => l2.funnelId === f.id && l2.stage === old)) l.stage = p.name;
      result = { ok: true };
      changed = true;
      break;
    }
    case "reorderPipelineStages": {
      const f = findPipeline(d, p);
      f.stages.sort((a, b) => p.stageIds.indexOf(a.id) - p.stageIds.indexOf(b.id));
      changed = true;
      result = { ok: true };
      break;
    }
    case "deletePipelineStage": {
      const f = d.funnels.find((f2) => f2.stages.some((s2) => s2.id === p.stageId)), s = f?.stages.find((s2) => s2.id === p.stageId);
      if (!f || !s) throw Error("Etapa n\xE3o encontrada.");
      if (f.stages.length < 2) throw Error("Mantenha uma etapa no funil.");
      const target = f.stages.find((s2) => s2.id === p.moveToStageId || s2.id === p.targetStageId) || f.stages.find((s2) => s2.id !== p.stageId);
      for (const l of d.leads.filter((l2) => l2.funnelId === f.id && l2.stage === s.name)) Core.moveLead(d, l, target.name, f.id);
      f.stages = f.stages.filter((s2) => s2.id !== p.stageId);
      changed = true;
      result = { ok: true };
      break;
    }
    case "moveLead":
    case "bulkMoveLeads": {
      const target = p.toStageId || p.stageId;
      const f = d.funnels.find((f2) => f2.stages.some((s2) => s2.id === target)), s = f?.stages.find((s2) => s2.id === target);
      if (!s) throw Error("Etapa de destino n\xE3o encontrada.");
      for (const l of d.leads.filter((l2) => name === "moveLead" ? l2.id === p.leadId : (p.leadIds || []).includes(l2.id))) Core.moveLead(d, l, s.name, f.id);
      changed = true;
      result = { ok: true };
      break;
    }
    case "listLeads":
      result = { leads: d.leads.map((l) => leadRow(d, l)) };
      break;
    case "createLead": {
      const f = d.funnels.find((f2) => f2.id === p.pipelineId) || d.funnels[0];
      if (!f) throw Error("Crie um funil primeiro.");
      const s = f.stages.find((s2) => s2.id === p.stageId) || f.stages[0];
      let l = p.order?.customerId ? d.leads.find((l2) => l2.id === p.order.customerId) : null;
      if (!l) {
        l = { id: id(), ...p, createdAt: now(), name: p.name, phone: p.phone || "", email: p.email || "", funnelId: f.id, stage: s.name, status: "open", source: d.crmSources.find((s2) => s2.id === p.crmSourceId)?.display_name || "Manual", custom: {} };
        delete l.order;
        d.leads.push(l);
        Core.log(d, "lead-created", l.id, "Cliente criado: " + l.name);
        createdLeadIds.push(l.id);
      }
      if (p.order) {
        const selectedProduct = d.products.find(x => x.id === p.order.productId);
        const order = { id: id(), leadId: l.id, ...prepareOrder(p.order, selectedProduct), createdAt: now(), status: "registered" };
        if (!Number.isFinite(order.amount) || order.amount < 0) throw Error("Total do pedido inv\xE1lido.");
        d.orders.push(order);
        d.sales.push({ id: order.id, lead: l.id, title: order.productName || "Pedido", amount: order.amount, created: order.createdAt });
        const product = d.products.find((p2) => p2.id === order.productId);
        applyOrderStock(product, order);
        if (product && !d.leadProducts.some((x) => x.leadId === l.id && x.productId === product.id && x.kind === "comprou")) d.leadProducts.push({ id: id(), leadId: l.id, productId: product.id, kind: "comprou" });
        l.status = "won";
        Core.log(d, "order-created", l.id, "Pedido registrado: " + order.productName);
      }
      result = { leadId: l.id, id: l.id };
      changed = true;
      break;
    }
    case "updateLead": {
      const l = findLead(d, p), patch = p.patch || p;
      Object.assign(l, Object.fromEntries(Object.entries(patch).filter(([k]) => !["id", "leadId", "__proto__"].includes(k))));
      result = { ok: true };
      changed = true;
      break;
    }
    case "deleteLead":
      d.leads = d.leads.filter((l) => l.id !== (p.leadId || p.id));
      changed = true;
      result = { ok: true };
      break;
    case "duplicateLead": {
      const l = structuredClone(findLead(d, p));
      l.id = id();
      l.createdAt = now();
      createdLeadIds.push(l.id);
      l.name = p.name || l.name + " (c\xF3pia)";
      d.leads.push(l);
      result = { leadId: l.id };
      changed = true;
      break;
    }
    case "getLeadDetail": {
      const l = findLead(d, p), f = d.funnels.find((f2) => f2.id === l.funnelId), s = f?.stages.find((s2) => s2.name === l.stage);
      result = { lead: { ...leadRow(d, l), stageId: s?.id, pipelineId: f?.id, stageName: l.stage, pipelineName: f?.name, sourceId: l.crmSourceId || d.crmSources[0]?.id, sourceProvider: "mkton", sourceDisplayName: l.source, keepFiles: !!l.keepFiles, customFields: d.customFields.filter((f2) => l.custom?.[f2.id]).map((f2) => ({ id: f2.id, name: f2.label, type: f2.type, displayValue: displayFieldValue(f2,l.custom[f2.id]) })) }, activities: d.localActivity.filter((a) => a.entityId === l.id).map((a) => ({ ...a, occurredAt: a.at })) };
      break;
    }
    case "saveLeadCustomFields": {
      const patch = p.fields;
      if (!Array.isArray(patch) || !Array.isArray(p.removedIds)) throw Error("Lista de campos inválida.");
      const next = structuredClone(d.customFields).filter(f => !p.removedIds.includes(f.id));
      for (const item of patch) {
        const label = String(item.name || '').trim(), type = item.fieldType;
        if (!label || !['text','textarea','phone','email','date','datetime','birthday','cpf','address','url','money','file','product','select','multiselect','number','time','checkbox'].includes(type)) throw Error('Nome ou tipo de campo inválido.');
        const options = [...new Set((item.options || []).map(v => String(v).trim()).filter(Boolean))];
        if (['select','multiselect'].includes(type) && !options.length) throw Error('Adicione as opções do campo.');
        let row = next.find(f => f.id === item.id);
        if (item.id && !row) throw Error('Campo removido. Reabra as configurações.');
        if (next.some(f => f.id !== row?.id && String(f.label).trim().toLocaleLowerCase() === label.toLocaleLowerCase())) throw Error('Já existe um campo com esse nome.');
        if (row) Object.assign(row,{label,type,options});
        else next.push({id:id(),label,type,options});
      }
      d.customFields = next;
      for (const lead of d.leads) for (const key of p.removedIds) if (lead.custom) delete lead.custom[key];
      result = {ok:true,fields:next.map(field)};
      changed = true;
      break;
    }
    case "listLeadCustomFields":
      result = { fields: d.customFields.map(field) };
      break;
    case "createLeadCustomField": {
      p.name = String(p.name || '').trim();
      if (!p.name) throw Error('Informe o nome do campo.');
      if (['select','multiselect'].includes(p.fieldType) && (!Array.isArray(p.options) || !p.options.some(v => String(v).trim()))) throw Error('Adicione as opções do campo.');
      if (d.customFields.some((f2) => f2.label.toLowerCase() === p.name.toLowerCase())) throw Error("J\xE1 existe um campo com esse nome.");
      const f = { id: id(), label: p.name, type: p.fieldType, options: p.options || [] };
      d.customFields.push(f);
      result = { field: field(f) };
      changed = true;
      break;
    }
    case "updateLeadCustomField": {
      const f = d.customFields.find((f2) => f2.id === (p.fieldId || p.id));
      if (!f) throw Error("Campo n\xE3o encontrado.");
      f.label = p.name ?? f.label;
      f.type = p.fieldType ?? f.type;
      f.options = p.options ?? f.options;
      changed = true;
      result = { field: field(f) };
      break;
    }
    case "deleteLeadCustomField":
      d.customFields = d.customFields.filter((f) => f.id !== (p.fieldId || p.id));
      changed = true;
      result = { ok: true };
      break;
    case "setLeadCustomFieldValue": {
      const l = findLead(d, p);
      l.custom ||= {};
      if (!d.customFields.some(f => f.id === p.fieldId)) throw Error("Campo não encontrado.");
      l.custom[p.fieldId] = { value: p.value, source: "Voc\xEA", updatedAt: Date.now() };
      result = { ok: true, value: p.value, changed: true };
      changed = true;
      break;
    }
    case "setLeadKeepFiles":
      findLead(d, p).keepFiles = p.keepFiles;
      changed = true;
      result = { ok: true };
      break;
    case "getLead360": {
      const l = findLead(d, p), c = d.companies.find((c2) => c2.id === l.companyId), products = d.leadProducts.filter((x) => x.leadId === l.id).map((x) => {
        const product = d.products.find((p2) => p2.id === x.productId);
        return product ? { ...product, kind: x.kind, catalogName: d.catalogs.find((c2) => c2.id === product.catalogId)?.name || "" } : null;
      }).filter(Boolean), activities = d.localActivity.filter((a) => a.entityId === l.id).map((a) => ({ ...a, occurredAt: a.at })), tasks = d.tasks.filter((t) => t.lead === l.id).map((t) => ({ ...t, dueAt: t.due || null }));
      result = { lead: leadRow(d, l), company: c ? { ...c, logoUrl: c.logo_signed_url, leadsCount: d.leads.filter((l2) => l2.companyId === c.id).length } : null, products, forms: [], allForms: d.forms.map((f) => ({ id: f.id, nome: f.name || f.nome })), files: [], activities, tasks, agent: l.agentId ? d.agents.find((a) => a.id === l.agentId) : null, totals: { produtos: products.length, arquivos: 0, formularios: 0, atividades: activities.length, tarefas: tasks.length } };
      break;
    }
    case "setLeadCompany": {
      const lead=findLead(d,p),old=customerCompany(d,lead);
      if(old?.primaryLeadId===lead.id&&old.id!==p.companyId&&companyMembers(d,old).length>1)throw Error('Escolha outro contato principal antes de desvincular o responsável.');
      const company=p.companyId?d.companies.find(c=>c.id===p.companyId):null;
      if(p.companyId&&!company)throw Error('Empresa não encontrada nesta conta.');
      if(old?.primaryLeadId===lead.id&&old.id!==p.companyId)old.primaryLeadId=null;
      lead.companyId=p.companyId||null;
      if(company?.kind==='customer'&&!company.primaryLeadId)company.primaryLeadId=lead.id;
      result = { ok: true };
      changed = true;
      break;
    }
    case "linkLeadProduct":
      if (!d.leadProducts.some((x) => x.leadId === p.leadId && x.productId === p.productId && x.kind === p.kind)) d.leadProducts.push({ ...p, id: id() });
      result = { ok: true };
      changed = true;
      break;
    case "unlinkLeadProduct":
      d.leadProducts = d.leadProducts.filter((x) => !(x.leadId === p.leadId && x.productId === p.productId && x.kind === p.kind));
      result = { ok: true };
      changed = true;
      break;
    case "listWorkspaceTags":
      result = { tags: [...new Set(d.leads.flatMap((l) => l.tags || l.tag ? [...l.tags || [], ...l.tag ? [l.tag] : []] : []))].map((name2) => ({ id: name2, name: name2 })) };
      break;
    case "listStageAutomations": {
      const row = d.slimStageAutomations.find((r) => r.id === p.pipelineId);
      result = { automations: row?.automations || {} };
      break;
    }
    case "saveStageAutomations": {
      const funnel=d.funnels.find(f=>f.id===p.pipelineId);if(!funnel)throw Error('Funil fora desta conta.');
      const automations=p.automations||p.actions||{};
      if(!automations||typeof automations!=='object'||Array.isArray(automations))throw Error('Gatilhos inválidos.');
      for(const [stage,actions] of Object.entries(automations)){
       if(!funnel.stages.some(s=>s.id===stage)||!Array.isArray(actions)||actions.some(a=>!a?.id))throw Error('Etapa ou gatilho inválido.');
       if(actions.some(a=>a.stageIds?.some(id=>!funnel.stages.some(s=>s.id===id))))throw Error('Destino fora deste funil.');
      }
      upsert(d.slimStageAutomations,{id:p.pipelineId,automations});store.put(ws,d);changed=false;
      const adapter=new SalesbotStore(store,null,ws);let backfilled=0;const seen=new Set();
      await adapter.run(async()=>{for(const [stage,actions]of Object.entries(automations))for(const action of actions){
       if(seen.has(action.id)||action.enabled===false||!action.execution?.applyToExisting)continue;seen.add(action.id);
       const receipt=await StageRuntime.backfillAutomationAction(adapter,{workspaceId:ws,pipelineId:p.pipelineId,action,stageIds:action.stageIds?.length?action.stageIds:[stage],requestId:p.applyRequestId});backfilled+=receipt.queued;
      }
      await StageRuntime.scheduleStageTimerActions(adapter,true,{workspaceId:ws,pipelineId:p.pipelineId});});
      const latest=store.get(ws),saved=latest.slimStageAutomations.find(r=>r.id===p.pipelineId);
      // Clear only the command whose definition we just confirmed, never newer edits.
      for(const actions of Object.values(saved?.automations||{}))for(const action of actions){
       const expected=Object.values(automations).flat().find(a=>a.id===action.id);
       if(expected&&JSON.stringify(action)===JSON.stringify(expected)&&action.execution)action.execution.applyToExisting=false;
      }
      store.put(ws,latest);
      result={ok:true,count:Object.values(automations).reduce((n,a)=>n+a.length,0),backfilled};break;
    }
    case "backfillAutomationAction": {
      const adapter=new SalesbotStore(store,null,ws),row=d.slimStageAutomations.find(r=>r.id===p.pipelineId);
      const action=Object.values(row?.automations||{}).flat().find(a=>a.id===p.action?.id);
      if(!action)throw Error('Gatilho não salvo neste funil.');
      const stages=action.stageIds?.length?action.stageIds:Object.entries(row.automations).filter(([,actions])=>actions.some(a=>a.id===action.id)).map(([stage])=>stage);
      result=await adapter.run(()=>StageRuntime.backfillAutomationAction(adapter,{workspaceId:ws,pipelineId:p.pipelineId,action,stageIds:stages,requestId:p.requestId}));break;
    }
    case "triggerStageAutomations":
      findLead(d,p);store.enqueue(ws,"crm-trigger",{leadId:p.leadId,event:"manual",eventId:p.requestId||id()});result={ok:true,queued:true};break;
    case "listProductCatalogs":
      result = d.catalogs.map((c) => ({ ...c, products: d.products.filter((p2) => p2.catalogId === c.id) }));
      break;
    case "saveProductCatalog": {
      const c = { ...p, id: p.id || id() };
      upsert(d.catalogs, c);
      changed = true;
      result = { id: c.id };
      break;
    }
    case "deleteProductCatalog":
      d.catalogs = d.catalogs.filter((c) => c.id !== p.id);
      d.products = d.products.filter((x) => x.catalogId !== p.id);
      changed = true;
      result = { ok: true };
      break;
    case "saveProduct": {
      const product = normalizeProduct({ ...p, id: p.id || id() }, d.products.find(x => x.id === p.id));
      upsert(d.products, product);
      changed = true;
      result = { id: product.id };
      break;
    }
    case "deleteProduct":
      d.products = d.products.filter((x) => x.id !== p.id);
      changed = true;
      result = { ok: true };
      break;
    case "bulkUpsertProducts":
      for (const product of p.products || []) {
        const old = d.products.find((x) => x.catalogId === p.catalogId && x.sku === product.sku);
        upsert(d.products, { ...product, id: old?.id || id(), catalogId: p.catalogId });
      }
      changed = true;
      result = { ok: true, count: p.products?.length || 0 };
      break;
    case "renameProductCategory":
      for (const x of d.products) if (x.category === p.from || x.category === p.oldCategory) x.category = p.to || p.newCategory;
      changed = true;
      result = { ok: true };
      break;
    case "listCompanies":
      result = { companies: d.companies };
      break;
    case "createCompany": {
      const company = { ...p, id: id(), logo_signed_url: null };
      d.companies.push(company);
      changed = true;
      result = { companyId: company.id, id: company.id };
      break;
    }
    case "updateCompany": {
      const c = d.companies.find((c2) => c2.id === p.companyId);
      if (!c) throw Error("Fornecedor n\xE3o encontrado.");
      Object.assign(c, p);
      changed = true;
      result = { ok: true };
      break;
    }
    case "listSupplierProductCosts":
      result = { rows: d.supplierCosts.filter((r) => !p.supplierId || r.supplierId === p.supplierId).map((r) => {
        const product = d.products.find((p2) => p2.id === r.productId);
        return { ...r, productName: product?.name, productSku: product?.sku, salePrice: product?.promoPrice ?? product?.price ?? 0, product };
      }) };
      break;
    case "saveSupplierProductCost":
      upsert(d.supplierCosts, { ...p, id: p.id || id() });
      changed = true;
      result = { ok: true };
      break;
    case "deleteSupplierProductCost":
      d.supplierCosts = d.supplierCosts.filter((r) => r.id !== p.id);
      changed = true;
      result = { ok: true };
      break;
    case "listSalesbotsFull":
      result = { bots: d.bots.filter((b) => b.escopo !== "grupo") };
      break;
    case "listSalesbots":
    case "listSalesbotPickerOptions":
      result = { bots: d.bots.filter((b) => b.escopo !== "grupo").map((b) => ({ ...b, name: b.nome, localId: b.id, local_id: b.id, is_active: b.isActive !== false })) };
      break;
    case "getSalesbotGraph": {
      const b = d.bots.find((b2) => b2.id === (p.localId || p.botId || p.id));
      if (!b) throw Error("Bot n\xE3o encontrado.");
      result = { bot: b, revision: b.revision || 1, blockCount: b.blocks.length, complete: true, baseBlockLocalIds: b.blocks.map((b2) => b2.id) };
      break;
    }
    case "syncSalesbotFromLocal": {
      if (!p.bot?.id || !Array.isArray(p.bot.blocks)) throw Error("Defini\xE7\xE3o de bot inv\xE1lida.");
      const existing=d.bots.find(b=>b.id===p.bot.id),bot={...existing,...p.bot};
      bot.isActive=typeof p.isActive==='boolean'?p.isActive:typeof p.bot.isActive==='boolean'?p.bot.isActive:existing?.isActive??false;
      bot.revision = (existing?.revision || 0) + 1;
      bot.updatedAt = now();
      upsert(d.bots, bot);
      changed = true;
      result = { ok: true, id: bot.id, revision: bot.revision, blockLocalIds: bot.blocks.map((b) => b.id), baseBlockLocalIds: bot.blocks.map((b) => b.id) };
      break;
    }
    case "setSalesbotActive": {
      const b = d.bots.find((b2) => b2.id === (p.localId || p.botId || p.id));
      if (!b) throw Error("Bot n\xE3o encontrado.");
      if (typeof (p.active ?? p.isActive) !== "boolean") throw Object.assign(Error("Estado do bot inválido."), {status:400});
      b.isActive = p.active ?? p.isActive;
      b.revision = (b.revision || 0) + 1;
      b.updatedAt = now();
      changed = true;
      result = { ok: true, isActive: b.isActive, revision: b.revision };
      break;
    }
    case "deleteSalesbotByLocalId":
      d.bots = d.bots.filter((b) => b.id !== (p.localId || p.botId || p.id));
      changed = true;
      result = { ok: true };
      break;
    case "uploadSalesbotMedia": {
      const mime=String(p.mimeType||"application/octet-stream"),kind=mime.startsWith("audio/")?"audio":mime.startsWith("image/")?"image":mime.startsWith("video/")?"video":"document";
      const asset=uploadAsset(store,ws,p);
      store.run("INSERT INTO asset_aliases VALUES(?,?,?)",ws,asset.path,asset.path);
      return {...asset,kind,mime,fileName:String(p.fileName||"arquivo").slice(0,200)};
    }
    case "getSalesbotMediaSignedUrl": {
      const url = signedAsset(store, ws, p.path);
      return { url, signedUrl: url };
    }
    case "listConversationAgents":
      result = d.agents.map((a) => ({ ...a, workspace_id: d.workspaceId, name: a.name, persona: a.persona || "", system_prompt: a.system_prompt || a.instructions || "", cooldown_seconds: a.cooldown_seconds || 15, model: a.model || d.providers.model || "", metadata: a.metadata || { settings: { mode: a.mode || "prompt" }, objective_tree: a.objectiveTree } }));
      break;
    case "upsertConversationAgent": {
      const old = d.agents.find((a) => a.id === p.id), row = { ...old, ...p, id: p.id || id(), system_prompt: p.systemPrompt, cooldown_seconds: p.cooldownSeconds, enabled: p.enabled, metadata: { settings: { mode: p.mode, language: p.language, max_interactions: p.maxInteractions, allowed_actions: p.allowedActions, rules: p.rules, sources: p.sources, actions: p.actions, links: p.links, webhook_trigger: p.webhookTrigger, outcome: p.outcome }, objective_tree: p.objectiveTree }, instructions: p.systemPrompt };
      upsert(d.agents, row);
      changed = true;
      result = { id: row.id };
      break;
    }
    case "deleteConversationAgent":
      d.agents = d.agents.filter((a) => a.id !== p.id);
      changed = true;
      result = { ok: true };
      break;
    case "duplicateConversationAgent": {
      const a = structuredClone(d.agents.find((a2) => a2.id === (p.agentId || p.id)));
      if (!a) throw Error("Agente n\xE3o encontrado.");
      a.id = id();
      a.name = p.name || a.name + " (c\xF3pia)";
      d.agents.push(a);
      changed = true;
      result = { id: a.id };
      break;
    }
    case "setPrimaryConversationAgent":
      for (const a of d.agents) a.is_primary = a.id === (p.agentId || p.id);
      changed = true;
      result = { ok: true };
      break;
    case "getConversationAgentStats":
      result = store.all("SELECT asset_id AS agent_id,status,COUNT(*) AS count FROM runs WHERE workspace_id=? AND kind='agent' GROUP BY asset_id,status", ws);
      break;
    case "listConversationAgentRuns":
      result = store.all("SELECT * FROM runs WHERE workspace_id=? AND kind='agent' ORDER BY created_at DESC LIMIT 100", ws);
      break;
    case "listActiveWorkspaceConversationAgents":
      result = { agents: d.agents.filter((a) => a.enabled !== false) };
      break;
    case "listCrmAgents":
      result = d.crmAgents;
      break;
    case "saveCrmAgentConfig": {
      const row = { ...p, id: p.id || id() };
      upsert(d.crmAgents, row);
      changed = true;
      result = { id: row.id, config: row };
      break;
    }
    case "deleteCrmAgent":
      d.crmAgents = d.crmAgents.filter((a) => a.id !== (p.agentId || p.id));
      changed = true;
      result = { ok: true };
      break;
    case "listWorkflowPipelinesLite":
      result = { pipelines: d.projects.map((p2) => ({ id: p2.id, name: p2.name, stages: p2.columns })) };
      break;
    case "listConnectedLeadSources": {
      const instance=store.one("SELECT instance_name,phone FROM instances WHERE workspace_id=? AND status='connected'",ws);
      result={sources:[...d.crmSources.map(s=>({...s,label:s.label||s.display_name||s.name||s.provider})),...(instance?[{id:instance.instance_name,label:instance.phone?`WhatsApp ${instance.phone}`:'WhatsApp conectado',provider:'whatsapp'}]:[])]};
      break;
    }
    case "listForms":
      result = d.forms;
      break;
    case "listObjectiveTrackingOptions":
      result = objectivePixelOptions(store, ws);
      break;
    case "listTrackingSites":
      result = { sites: objectivePixelOptions(store,ws).map(s=>({id:s.siteId,name:s.siteName,domain:s.domain,verified:s.verified})) };
      break;
    case "listDistinctEventNames":
      result = { events: [...new Set(objectivePixelOptions(store,ws).flatMap(s=>s.events.map(e=>e.name)))] };
      break;
    case "loadAgentConversation":
      result = { messages: d.aiConversations?.[p.module] || "[]" };
      break;
    case "resetAgentConversation":
      d.aiConversations ||= {};
      d.aiConversations[p.module] = "[]";
      result = { ok: true };
      changed = true;
      break;
    case "getAgentSettings":
      result = d.aiSettings?.[p.module] || { model: d.providers.model || "", rules: "", temperature: 0.7 };
      break;
    case "updateAgentSettings":
      d.aiSettings ||= {};
      d.aiSettings[p.module] = p.settings || p;
      result = { ok: true };
      changed = true;
      break;
    default:
      throw Error("Esta a\xE7\xE3o do Slim requer o servidor conectado: " + name + ".");
  }
  if (changed) {
   const persist=()=>{store.put(ws,d);for(const leadId of createdLeadIds)store.enqueue(ws,"crm-trigger",{leadId,event:"created",eventId:"lead-created:"+leadId},{id:"lead-created:"+leadId});};
   if(createdLeadIds.length)store.transaction(persist);else persist();
  }
  return result;
}
export {
  rpc
};
