import {normalizeProduct, prepareOrder, applyOrderStock} from '../src/product-policy.mjs';
import {workflowRPC} from './workflow-repository';
// Chrome persistence adapter for the unchanged Saúde Slim component contracts.
// Remote execution is delegated to the original server functions when configured.
const W=()=> (window as any).CCWorkspace;const Core=()=> (window as any).CCCore;const id=()=>crypto.randomUUID();let queue=Promise.resolve();
const arrays=['crmSources','companies','catalogs','products','supplierCosts','crmAgents','slimStageAutomations','forms','notifications','leadProducts','orders'];
async function load(){const d=await W().get();for(const k of arrays)d[k]||=[];d.crmSources.length||d.crmSources.push({id:'local-source',provider:'mkton',display_name:'Converte Call',is_default:true});return d;}
const field=(f:any)=>({id:f.id,name:f.label,fieldType:f.type,options:f.options||[]});
function leadRow(d:any,l:any){const funnel=d.funnels.find((f:any)=>f.id===l.funnelId),stage=funnel?.stages.find((s:any)=>s.name===l.stage||s.id===l.stageId);return {...l,email:l.email||null,phone:l.phone||null,value:Number(l.value)||0,pipeline_id:l.funnelId,stage_id:stage?.id,createdAt:l.createdAt,created_at:l.createdAt,tags:l.tags||l.tag?[...(l.tags||[]),...(l.tag?[l.tag]:[])]:[],lastMessageFrom:'none',stageName:l.stage,pipelineName:funnel?.name};}
function funnels(d:any,lite=false){return d.funnels.map((f:any)=>({...f,stages:f.stages.map((s:any)=>({...s,status:s.name==='Venda realizada'?'ganha':s.name==='Perdida'?'perdida':'aberta',leads:lite?[]:d.leads.filter((l:any)=>l.funnelId===f.id&&l.stage===s.name).map((l:any)=>leadRow(d,l))}))}));}
const findLead=(d:any,p:any)=>{const l=d.leads.find((l:any)=>l.id===(p.leadId||p.id));if(!l)throw Error('Cliente não encontrado.');return l;};
const findPipeline=(d:any,p:any)=>{const f=d.funnels.find((f:any)=>f.id===(p.pipelineId||p.funnelId));if(!f)throw Error('Funil não encontrado.');return f;};
function upsert(rows:any[],row:any){const existing=rows.find(x=>x.id===row.id);if(existing)Object.assign(existing,row);else rows.push(row);return row;}
async function mediaUpload(p:any){const key=p.path||id(),binary=atob(p.base64||p.fileBase64||''),blob=new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:p.mimeType||p.mime||'application/octet-stream'});await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('converte-call-assets',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets',{keyPath:'id'});r.onsuccess=()=>{const tx=r.result.transaction('assets','readwrite');tx.objectStore('assets').put({id:key,blob,name:p.filename||p.fileName||'arquivo'});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);};r.onerror=()=>reject(r.error);});return {path:key,signedUrl:URL.createObjectURL(blob),url:URL.createObjectURL(blob)};}
export function rpc(module:string,name:string,arg:any={}){const operation=queue.then(()=>execute(module,name,arg));queue=operation.catch(()=>{});return operation;}
async function execute(module:string,name:string,arg:any){const p=arg?.data??arg??{};const deployment=(window as any).CCDeployment;const account=(await chrome.storage.local.get('ccAccountView')).ccAccountView;if(deployment?.gatewayUrl||account?.membership?.role==='member'||module==='@/lib/permissions-core.functions'||module==='@/lib/crm-audiences.functions'||['getInboxBootstrap','listLeadConversations','listLeadActivities','markLeadConversationRead','sendLeadMessage','syncWhatsAppInbox','checkInboxHealth','listInboxGroupConversations','listInboxLabels'].includes(name)){const r=await chrome.runtime.sendMessage({channel:'cc',type:'slim-rpc',module,method:name,data:p});if(!r.ok)throw Error(r.error);return r.result;}
 const d=await load(),baseline=structuredClone(d);let result:any,changed=false;const now=()=>new Date().toISOString();
 if(module==='@/lib/workflow.functions'){const response=workflowRPC(d,name,p,Core());if(response.changed){const saved=await chrome.runtime.sendMessage({channel:'cc',type:'slim-workspace-commit',base:baseline,next:d});if(!saved.ok)throw Error(saved.error);}return response.result;}
 switch(name){
 case 'listMetaDashboardAccounts':result={accounts:[]};break;
 case 'getActiveWorkspace': result={workspace:{id:d.workspaceId||'local-workspace',name:'Meu espaço'},workspaceId:d.workspaceId||'local-workspace'};break;
 case 'getCurrentUserRoles':result={isAdmin:false,isSuperAdmin:false,roles:[]};break;
 case 'listWorkspaceUsers':result={users:d.members||[]};break;
 case 'listInternalMessageTargets':result={users:d.members||[],departments:[],admins:[]};break;
 case 'listWorkspaceChannels':result={whatsapp:d.connections?.whatsapp?.status==='connected'?[{id:d.connections.whatsapp.sessionId||'account-whatsapp',label:d.connections.whatsapp.phone||'WhatsApp conectado',status:'connected'}]:[],instagram:[],facebook:[],email:[]};break;
 case 'listCrmSources':result={sources:d.crmSources};break;
 case 'createCrmSource':{const source={id:id(),provider:'mkton',display_name:p.name,is_default:!d.crmSources.length};d.crmSources.push(source);result={sourceId:source.id};changed=true;break;}
 case 'setDefaultCrmSource':for(const s of d.crmSources)s.is_default=s.id===p.crmSourceId;changed=true;result={ok:true};break;
 case 'listFunnels':result={funnels:funnels(d)};break;
 case 'listAllPipelineStages':result={pipelines:funnels(d,true)};break;
 case 'createFunnel':{const f={id:id(),name:p.name||'Funil Comercial',stages:Core().defaultStages(),sourceId:p.crmSourceId};d.funnels.push(f);result={pipelineId:f.id};changed=true;break;}
 case 'renamePipeline':findPipeline(d,p).name=p.name;changed=true;result={ok:true};break;
 case 'reorderFunnels':d.funnels.sort((a:any,b:any)=>(p.pipelineIds||p.funnelIds||[]).indexOf(a.id)-(p.pipelineIds||p.funnelIds||[]).indexOf(b.id));changed=true;result={ok:true};break;
 case 'duplicatePipeline':{const old=findPipeline(d,p),copy=structuredClone(old);copy.id=id();copy.name=p.name||old.name+' (cópia)';copy.stages=copy.stages.map((s:any)=>({...s,id:id()}));d.funnels.push(copy);result={pipelineId:copy.id};changed=true;break;}
 case 'deletePipeline':{const f=findPipeline(d,p);if(d.leads.some((l:any)=>l.funnelId===f.id))throw Error('Mova ou exclua os clientes deste funil antes de removê-lo.');d.funnels=d.funnels.filter((x:any)=>x.id!==f.id);result={ok:true};changed=true;break;}
 case 'createPipelineStage':{const f=findPipeline(d,p),s={id:id(),name:p.name,color:p.color||'#8b72da',description:p.description||''};f.stages.push(s);result={stageId:s.id};changed=true;break;}
 case 'updatePipelineStage':{const f=d.funnels.find((f:any)=>f.stages.some((s:any)=>s.id===p.stageId)),s=f?.stages.find((s:any)=>s.id===p.stageId);if(!s)throw Error('Etapa não encontrada.');const old=s.name;Object.assign(s,p.patch||p);if(p.name)for(const l of d.leads.filter((l:any)=>l.funnelId===f.id&&l.stage===old))l.stage=p.name;result={ok:true};changed=true;break;}
 case 'reorderPipelineStages':{const f=findPipeline(d,p);f.stages.sort((a:any,b:any)=>p.stageIds.indexOf(a.id)-p.stageIds.indexOf(b.id));changed=true;result={ok:true};break;}
 case 'deletePipelineStage':{const f=d.funnels.find((f:any)=>f.stages.some((s:any)=>s.id===p.stageId)),s=f?.stages.find((s:any)=>s.id===p.stageId);if(!f||!s)throw Error('Etapa não encontrada.');if(f.stages.length<2)throw Error('Mantenha uma etapa no funil.');const target=f.stages.find((s:any)=>s.id===p.moveToStageId||s.id===p.targetStageId)||f.stages.find((s:any)=>s.id!==p.stageId);for(const l of d.leads.filter((l:any)=>l.funnelId===f.id&&l.stage===s.name))Core().moveLead(d,l,target.name,f.id);f.stages=f.stages.filter((s:any)=>s.id!==p.stageId);changed=true;result={ok:true};break;}
 case 'moveLead':case 'bulkMoveLeads':{const target=p.toStageId||p.stageId;const f=d.funnels.find((f:any)=>f.stages.some((s:any)=>s.id===target)),s=f?.stages.find((s:any)=>s.id===target);if(!s)throw Error('Etapa de destino não encontrada.');for(const l of d.leads.filter((l:any)=>name==='moveLead'?l.id===p.leadId:(p.leadIds||[]).includes(l.id)))Core().moveLead(d,l,s.name,f.id);changed=true;result={ok:true};break;}
 case 'listLeads':result={leads:d.leads.map((l:any)=>leadRow(d,l))};break;
 case 'createLead':{const f=d.funnels.find((f:any)=>f.id===p.pipelineId)||d.funnels[0];if(!f)throw Error('Crie um funil primeiro.');const s=f.stages.find((s:any)=>s.id===p.stageId)||f.stages[0];let l=p.order?.customerId?d.leads.find((l:any)=>l.id===p.order.customerId):null;if(!l){l={id:id(),...p,createdAt:now(),name:p.name,phone:p.phone||'',email:p.email||'',funnelId:f.id,stage:s.name,status:'open',source:d.crmSources.find((s:any)=>s.id===p.crmSourceId)?.display_name||'Manual',custom:{}};delete l.order;d.leads.push(l);Core().log(d,'lead-created',l.id,'Cliente criado: '+l.name);}if(p.order){const order={id:id(),leadId:l.id,...prepareOrder(p.order,d.products.find((x:any)=>x.id===p.order.productId)),createdAt:now(),status:'registered'};if(!Number.isFinite(order.amount)||order.amount<0)throw Error('Total do pedido inválido.');d.orders.push(order);d.sales.push({id:order.id,lead:l.id,title:order.productName||'Pedido',amount:order.amount,created:order.createdAt});const product=d.products.find((p:any)=>p.id===order.productId);applyOrderStock(product,order);if(product&&!d.leadProducts.some((x:any)=>x.leadId===l.id&&x.productId===product.id&&x.kind==='comprou'))d.leadProducts.push({id:id(),leadId:l.id,productId:product.id,kind:'comprou'});l.status='won';Core().log(d,'order-created',l.id,'Pedido registrado: '+order.productName);}result={leadId:l.id,id:l.id};changed=true;break;}
 case 'updateLead':{const l=findLead(d,p),patch=p.patch||p;Object.assign(l,Object.fromEntries(Object.entries(patch).filter(([k])=>!['id','leadId','__proto__'].includes(k))));result={ok:true};changed=true;break;}
 case 'deleteLead':d.leads=d.leads.filter((l:any)=>l.id!==(p.leadId||p.id));changed=true;result={ok:true};break;
 case 'duplicateLead':{const l=structuredClone(findLead(d,p));l.id=id();l.name=p.name||l.name+' (cópia)';d.leads.push(l);result={leadId:l.id};changed=true;break;}
 case 'getLeadDetail':{const l=findLead(d,p),f=d.funnels.find((f:any)=>f.id===l.funnelId),s=f?.stages.find((s:any)=>s.name===l.stage);result={lead:{...leadRow(d,l),stageId:s?.id,pipelineId:f?.id,stageName:l.stage,pipelineName:f?.name,sourceId:l.crmSourceId||d.crmSources[0]?.id,sourceProvider:'mkton',sourceDisplayName:l.source,keepFiles:!!l.keepFiles,customFields:d.customFields.filter((f:any)=>l.custom?.[f.id]).map((f:any)=>({id:f.id,name:f.label,type:f.type,displayValue:Array.isArray(l.custom[f.id].value)?l.custom[f.id].value.join(', '):String(l.custom[f.id].value??'')}))},activities:d.localActivity.filter((a:any)=>a.entityId===l.id).map((a:any)=>({...a,occurredAt:a.at}))};break;}
 case 'listLeadCustomFields':result={fields:d.customFields.map(field)};break;
 case 'createLeadCustomField':{if(d.customFields.some((f:any)=>f.label.toLowerCase()===p.name.toLowerCase()))throw Error('Já existe um campo com esse nome.');const f={id:id(),label:p.name,type:p.fieldType,options:p.options||[]};d.customFields.push(f);result={field:field(f)};changed=true;break;}
 case 'updateLeadCustomField':{const f=d.customFields.find((f:any)=>f.id===(p.fieldId||p.id));if(!f)throw Error('Campo não encontrado.');f.label=p.name??f.label;f.type=p.fieldType??f.type;f.options=p.options??f.options;changed=true;result={field:field(f)};break;}
 case 'deleteLeadCustomField':d.customFields=d.customFields.filter((f:any)=>f.id!==(p.fieldId||p.id));changed=true;result={ok:true};break;
 case 'setLeadCustomFieldValue':{const l=findLead(d,p);l.custom||={};l.custom[p.fieldId]={value:p.value,source:'Você',updatedAt:Date.now()};result={ok:true};changed=true;break;}
 case 'setLeadKeepFiles':findLead(d,p).keepFiles=p.keepFiles;changed=true;result={ok:true};break;
 case 'getLead360':{const l=findLead(d,p),c=d.companies.find((c:any)=>c.id===l.companyId),products=d.leadProducts.filter((x:any)=>x.leadId===l.id).map((x:any)=>{const product=d.products.find((p:any)=>p.id===x.productId);return product?{...product,kind:x.kind,catalogName:d.catalogs.find((c:any)=>c.id===product.catalogId)?.name||''}:null;}).filter(Boolean),activities=d.localActivity.filter((a:any)=>a.entityId===l.id).map((a:any)=>({...a,occurredAt:a.at})),tasks=d.tasks.filter((t:any)=>t.lead===l.id).map((t:any)=>({...t,dueAt:t.due||null}));result={lead:leadRow(d,l),company:c?{...c,logoUrl:c.logo_signed_url,leadsCount:d.leads.filter((l:any)=>l.companyId===c.id).length}:null,products,forms:[],allForms:d.forms.map((f:any)=>({id:f.id,nome:f.name||f.nome})),files:[],activities,tasks,agent:l.agentId?d.agents.find((a:any)=>a.id===l.agentId):null,totals:{produtos:products.length,arquivos:0,formularios:0,atividades:activities.length,tarefas:tasks.length}};break;}
 case 'setLeadCompany':findLead(d,p).companyId=p.companyId;result={ok:true};changed=true;break;
 case 'linkLeadProduct':if(!d.leadProducts.some((x:any)=>x.leadId===p.leadId&&x.productId===p.productId&&x.kind===p.kind))d.leadProducts.push({...p,id:id()});result={ok:true};changed=true;break;
 case 'unlinkLeadProduct':d.leadProducts=d.leadProducts.filter((x:any)=>!(x.leadId===p.leadId&&x.productId===p.productId&&x.kind===p.kind));result={ok:true};changed=true;break;
 case 'listWorkspaceTags':result={tags:[...new Set(d.leads.flatMap((l:any)=>l.tags||l.tag?[...(l.tags||[]),...(l.tag?[l.tag]:[])]:[]))].map((name:any)=>({id:name,name}))};break;
 case 'listStageAutomations':{const row=d.slimStageAutomations.find((r:any)=>r.id===p.pipelineId);result={automations:row?.automations||{}};break;}
 case 'saveStageAutomations':upsert(d.slimStageAutomations,{id:p.pipelineId,automations:p.automations||p.actions||{}});changed=true;result={ok:true,count:Object.values(p.automations||p.actions||{}).reduce((n:number,a:any)=>n+(a?.length||0),0)};break;
 case 'triggerStageAutomations':case 'backfillAutomationAction':throw Error('A execução dos gatilhos do Slim será habilitada ao conectar o servidor. A configuração fica salva localmente.');
 case 'listProductCatalogs':result=d.catalogs.map((c:any)=>({...c,products:d.products.filter((p:any)=>p.catalogId===c.id)}));break;
 case 'saveProductCatalog':{const c={...p,id:p.id||id()};upsert(d.catalogs,c);changed=true;result={id:c.id};break;}
 case 'deleteProductCatalog':d.catalogs=d.catalogs.filter((c:any)=>c.id!==p.id);d.products=d.products.filter((x:any)=>x.catalogId!==p.id);changed=true;result={ok:true};break;
 case 'saveProduct':{const product=normalizeProduct({...p,id:p.id||id()},d.products.find((x:any)=>x.id===p.id));upsert(d.products,product);changed=true;result={id:product.id};break;}
 case 'deleteProduct':d.products=d.products.filter((x:any)=>x.id!==p.id);changed=true;result={ok:true};break;
 case 'bulkUpsertProducts':for(const product of p.products||[]){const old=d.products.find((x:any)=>x.catalogId===p.catalogId&&x.sku===product.sku);upsert(d.products,{...product,id:old?.id||id(),catalogId:p.catalogId});}changed=true;result={ok:true,count:p.products?.length||0};break;
 case 'renameProductCategory':for(const x of d.products)if(x.category===p.from||x.category===p.oldCategory)x.category=p.to||p.newCategory;changed=true;result={ok:true};break;
 case 'listCompanies':result={companies:d.companies};break;
 case 'createCompany':{const company={...p,id:id(),logo_signed_url:null};d.companies.push(company);changed=true;result={companyId:company.id,id:company.id};break;}
 case 'updateCompany':{const c=d.companies.find((c:any)=>c.id===p.companyId);if(!c)throw Error('Fornecedor não encontrado.');Object.assign(c,p);changed=true;result={ok:true};break;}
 case 'listSupplierProductCosts':result={rows:d.supplierCosts.filter((r:any)=>!p.supplierId||r.supplierId===p.supplierId).map((r:any)=>{const product=d.products.find((p:any)=>p.id===r.productId);return {...r,productName:product?.name,productSku:product?.sku,salePrice:product?.promoPrice??product?.price??0,product};})};break;
 case 'saveSupplierProductCost':upsert(d.supplierCosts,{...p,id:p.id||id()});changed=true;result={ok:true};break;
 case 'deleteSupplierProductCost':d.supplierCosts=d.supplierCosts.filter((r:any)=>r.id!==p.id);changed=true;result={ok:true};break;
 case 'listSalesbotsFull':result={bots:d.bots.filter((b:any)=>b.escopo!=='grupo')};break;
 case 'listSalesbots':case 'listSalesbotPickerOptions':result={bots:d.bots.filter((b:any)=>b.escopo!=='grupo').map((b:any)=>({...b,name:b.nome,localId:b.id,local_id:b.id,is_active:b.isActive!==false}))};break;
 case 'getSalesbotGraph':{const b=d.bots.find((b:any)=>b.id===(p.localId||p.botId||p.id));if(!b)throw Error('Bot não encontrado.');result={bot:b,revision:b.revision||1,blockCount:b.blocks.length,complete:true,baseBlockLocalIds:b.blocks.map((b:any)=>b.id)};break;}
 case 'syncSalesbotFromLocal':{const bot=p.bot;if(!bot?.id)throw Error('Definição de bot inválida.');bot.revision=(d.bots.find((b:any)=>b.id===bot.id)?.revision||0)+1;bot.updatedAt=now();upsert(d.bots,bot);changed=true;result={ok:true,id:bot.id,revision:bot.revision,blockLocalIds:bot.blocks.map((b:any)=>b.id),baseBlockLocalIds:bot.blocks.map((b:any)=>b.id)};break;}
 case 'setSalesbotActive':{const b=d.bots.find((b:any)=>b.id===(p.localId||p.botId||p.id));if(!b)throw Error('Bot não encontrado.');b.isActive=p.active??p.isActive;changed=true;result={ok:true};break;}
 case 'deleteSalesbotByLocalId':d.bots=d.bots.filter((b:any)=>b.id!==(p.localId||p.botId||p.id));changed=true;result={ok:true};break;
 case 'uploadSalesbotMedia':return mediaUpload(p);
 case 'getSalesbotMediaSignedUrl':{const {localMediaURL}=await import('./platform');const url=await localMediaURL(p.path);return {url,signedUrl:url};}
 case 'listConversationAgents':result=d.agents.map((a:any)=>({...a,workspace_id:d.workspaceId,name:a.name,persona:a.persona||'',system_prompt:a.system_prompt||a.instructions||'',cooldown_seconds:a.cooldown_seconds||15,model:a.model||d.providers.model||'',metadata:a.metadata||{settings:{mode:a.mode||'prompt'},objective_tree:a.objectiveTree}}));break;
 case 'upsertConversationAgent':{const old=d.agents.find((a:any)=>a.id===p.id),row={...old,...p,id:p.id||id(),system_prompt:p.systemPrompt,cooldown_seconds:p.cooldownSeconds,enabled:p.enabled,metadata:{settings:{mode:p.mode,language:p.language,max_interactions:p.maxInteractions,allowed_actions:p.allowedActions,rules:p.rules,sources:p.sources,actions:p.actions,links:p.links,webhook_trigger:p.webhookTrigger,outcome:p.outcome},objective_tree:p.objectiveTree},instructions:p.systemPrompt};upsert(d.agents,row);changed=true;result={id:row.id};break;}
 case 'deleteConversationAgent':d.agents=d.agents.filter((a:any)=>a.id!==p.id);changed=true;result={ok:true};break;
 case 'duplicateConversationAgent':{const a=structuredClone(d.agents.find((a:any)=>a.id===(p.agentId||p.id)));if(!a)throw Error('Agente não encontrado.');a.id=id();a.name=p.name||a.name+' (cópia)';d.agents.push(a);changed=true;result={id:a.id};break;}
 case 'setPrimaryConversationAgent':for(const a of d.agents)a.is_primary=a.id===(p.agentId||p.id);changed=true;result={ok:true};break;
 case 'getConversationAgentStats':result=[];break;
 case 'listConversationAgentRuns':result=[];break;
 case 'listActiveWorkspaceConversationAgents':result={agents:d.agents.filter((a:any)=>a.enabled!==false)};break;
 case 'listCrmAgents':result=d.crmAgents;break;
 case 'saveCrmAgentConfig':{const row={...p,id:p.id||id()};upsert(d.crmAgents,row);changed=true;result={id:row.id,config:row};break;}
 case 'deleteCrmAgent':d.crmAgents=d.crmAgents.filter((a:any)=>a.id!==(p.agentId||p.id));changed=true;result={ok:true};break;
 case 'listWorkflowPipelinesLite':result={pipelines:d.projects.map((p:any)=>({id:p.id,name:p.name,stages:p.columns}))};break;
 case 'listConnectedLeadSources':result={sources:d.crmSources};break;
 case 'listForms':result=d.forms;break;
 case 'listTrackingSites':result={sites:d.tracking};break;
 case 'listDistinctEventNames':result={events:[...new Set((d.inboxEvents||[]).map((e:any)=>e.type))]};break;
 case 'loadAgentConversation':result={messages:d.aiConversations?.[p.module]||'[]'};break;
 case 'resetAgentConversation':d.aiConversations||={};d.aiConversations[p.module]='[]';result={ok:true};changed=true;break;
 case 'getAgentSettings':result=d.aiSettings?.[p.module]||{model:d.providers.model||'',rules:'',temperature:0.7};break;
 case 'updateAgentSettings':d.aiSettings||={};d.aiSettings[p.module]=p.settings||p;result={ok:true};changed=true;break;
 default:throw Error('Esta ação do Slim requer o servidor conectado: '+name+'.');
 }
 if(changed){const response=await chrome.runtime.sendMessage({channel:'cc',type:'slim-workspace-commit',base:baseline,next:d});if(!response.ok)throw Error(response.error);window.dispatchEvent(new Event('cc-data'));}return result;
}
