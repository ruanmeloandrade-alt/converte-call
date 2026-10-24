import {randomUUID} from 'node:crypto';
import {canonicalPhone} from './contact-identity.mjs';

const fail=(status,message)=>Object.assign(Error(message),{status});
export const customerCompany=(d,lead)=>d.companies?.find(c=>c.id===lead?.companyId&&c.kind==='customer');
export const companyMembers=(d,company)=>d.leads.filter(l=>l.companyId===company.id);
export const companyPrimary=(d,company)=>companyMembers(d,company).find(l=>l.id===company.primaryLeadId);
export function isCompanyMessageTarget(d,lead){const company=customerCompany(d,lead);return !company||companyPrimary(d,company)?.id===lead.id;}
export function requireCompanyMessageTarget(d,lead){if(!isCompanyMessageTarget(d,lead))throw fail(409,'Envios da empresa são permitidos apenas para o contato principal. Abra Empresas para selecionar o responsável.');}
export function guardCompanyAddress(d,address,channel='phone'){
 const key=channel==='phone'?canonicalPhone(address):String(address||'').trim().toLowerCase();
 if(!key)return;
 const matches=d.leads.filter(l=>(channel==='phone'?canonicalPhone(l.phone):String(l.email||'').trim().toLowerCase())===key);
 // A shared address must not bypass a company's explicit recipient policy.
 for(const lead of matches)requireCompanyMessageTarget(d,lead);
}
export function syncCompanyStages(d,before={},moveLead){
 const old=new Map((before.leads||[]).map(l=>[l.id,l]));
 for(const company of d.companies||[]){
  if(company.kind!=='customer')continue;
  const members=companyMembers(d,company),primary=companyPrimary(d,company);
  if(!primary)continue; // Never silently elect another recipient after deletion.
  const moved=members.filter(l=>{const prev=old.get(l.id);return prev?.companyId===company.id&&(l.funnelId!==prev.funnelId||l.stage!==prev.stage);});
  const source=moved.find(l=>l.id===primary.id)||moved[0]||primary;
  if(source!==primary&&moved.length&&moveLead)moveLead(d,primary,source.stage,source.funnelId);
  for(const lead of members)for(const key of ['funnelId','stage','stageId','status','stageEnteredAt']){
   if(Object.hasOwn(source,key))lead[key]=source[key];else if(key==='stageId')delete lead.stageId;
  }
  const stageId=d.funnels.find(f=>f.id===source.funnelId)?.stages.find(s=>s.name===source.stage)?.id;
  if(stageId)for(const lead of members)lead.stageId=stageId;
 }
}
export function validateCompanyLinks(d,before={}){
 const previous=new Map((before.leads||[]).map(l=>[l.id,l]));
 for(const lead of d.leads)if(lead.companyId&&lead.companyId!==previous.get(lead.id)?.companyId&&!d.companies.some(c=>c.id===lead.companyId))throw fail(400,'Empresa do contato não encontrada nesta conta.');
 const projects=new Map((before.projects||[]).map(p=>[p.id,p]));
 for(const project of d.projects)if(project.companyId&&project.companyId!==projects.get(project.id)?.companyId&&!d.companies.some(c=>c.id===project.companyId&&c.kind==='customer'))throw fail(400,'Empresa do projeto não encontrada nesta conta.');
 for(const company of d.companies)if(company.kind==='customer'&&company.primaryLeadId&&!companyPrimary(d,company)){
  const prev=(before.companies||[]).find(c=>c.id===company.id);
  if(prev?.primaryLeadId!==company.primaryLeadId)throw fail(400,'O responsável deve ser um contato desta empresa.');
 }
}
const companyView=(d,c)=>({...c,leadsCount:companyMembers(d,c).length,primaryLead:companyPrimary(d,c)?{id:companyPrimary(d,c).id,name:companyPrimary(d,c).name}:null});
const companyFields=p=>Object.fromEntries(['name','site','notes','cnpj','phone'].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]==null?null:String(p[k]).trim().slice(0,k==='notes'?10000:300)]));
export function companiesRPC(d,name,p,Core,actorId){
 const find=()=>{const c=d.companies.find(c=>c.id===p.companyId);if(!c)throw fail(404,'Empresa não encontrada nesta conta.');return c;};
 const member=(company,leadId)=>{const l=companyMembers(d,company).find(l=>l.id===leadId);if(!l)throw fail(404,'Contato não vinculado a esta empresa.');return l;};
 let result,changed=false;
 switch(name){
  case 'listCompanies':result={companies:d.companies.filter(c=>!p.kind||c.kind===p.kind).map(c=>companyView(d,c))};break;
  case 'createCompany':{const fields=companyFields(p);if(!fields.name)throw fail(400,'Informe o nome da empresa.');const c={...fields,id:randomUUID(),kind:p.kind==='customer'?'customer':'supplier',primaryLeadId:null,logo_signed_url:null,createdAt:Core.now(),...(actorId?{createdBy:actorId}:{})};d.companies.push(c);result={companyId:c.id,id:c.id};changed=true;break;}
  case 'updateCompany':{const c=find(),fields=companyFields(p);if(Object.hasOwn(fields,'name')&&!fields.name)throw fail(400,'Informe o nome da empresa.');Object.assign(c,fields);result={ok:true};changed=true;break;}
  case 'listCompanyLeads':{const c=find();result={company:companyView(d,c),leads:companyMembers(d,c).map(l=>({...l,isPrimary:l.id===c.primaryLeadId,role:l.companyRole||''}))};break;}
  case 'listUnassignedLeads':result={leads:d.leads.filter(l=>!l.companyId)};break;
  case 'addCompanyMembers':{
   const c=find();if(c.kind!=='customer')throw fail(400,'Este cadastro é um fornecedor. Cadastre uma empresa em Relacionamento.');
   const ids=[...new Set(p.leadIds||[])];if(!Array.isArray(p.leadIds||[])||ids.length>100||!Array.isArray(p.contacts||[])||(p.contacts||[]).length>20)throw fail(400,'Lista de contatos inválida.');
   const leads=ids.map(id=>{const l=d.leads.find(l=>l.id===id);if(!l||l.companyId&&l.companyId!==c.id)throw fail(409,'Contato indisponível ou vinculado a outra empresa.');return l;});
   const primary=companyPrimary(d,c),f=d.funnels.find(f=>f.id===primary?.funnelId)||d.funnels[0];if(!f?.stages.length)throw fail(400,'Crie um funil antes de adicionar contatos.');
   for(const contact of p.contacts||[]){
    const name=String(contact.name||'').trim(),phone=canonicalPhone(contact.phone),email=String(contact.email||'').trim().toLowerCase();
    if(!name||name.length>200||contact.phone&&!phone||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail(400,'Confira nome, telefone com DDI e e-mail do contato.');
    if(phone&&d.leads.some(l=>canonicalPhone(l.phone)===phone))throw fail(409,'Este telefone já está cadastrado. Use Vincular contato existente.');
    const l={id:randomUUID(),name,phone:phone||'',email,companyRole:String(contact.role||'').trim().slice(0,200),funnelId:primary?.funnelId||f.id,stage:primary?.stage||f.stages[0].name,status:primary?.status||'open',custom:{},createdAt:Core.now(),...(actorId?{responsibleId:actorId}:{})};d.leads.push(l);leads.push(l);
   }
   for(const lead of leads)lead.companyId=c.id;
   if(!c.primaryLeadId&&leads.length)c.primaryLeadId=leads[0].id;
   result={ok:true,primaryLeadId:c.primaryLeadId};changed=true;break;
  }
  case 'setCompanyPrimaryLead':{const c=find(),l=member(c,p.leadId);c.primaryLeadId=l.id;result={ok:true};changed=true;break;}
  case 'updateCompanyMemberRole':{const c=find(),l=member(c,p.leadId);l.companyRole=String(p.role||'').trim().slice(0,200);result={ok:true};changed=true;break;}
  case 'removeCompanyMember':{const c=find(),l=member(c,p.leadId);if(c.primaryLeadId===l.id&&companyMembers(d,c).length>1)throw fail(409,'Escolha outro contato principal antes de desvincular o responsável.');if(c.primaryLeadId===l.id)c.primaryLeadId=null;l.companyId=null;l.companyRole='';result={ok:true};changed=true;break;}
  default:throw fail(400,'Operação de empresa indisponível.');
 }
 if(changed)syncCompanyStages(d);
 return {result,changed};
}
