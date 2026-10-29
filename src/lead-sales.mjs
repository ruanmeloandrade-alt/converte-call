import {createHash} from 'node:crypto';
import {saleAmount} from './dashboard.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const cents=value=>{if(typeof value==='string'&&!value.includes(',')&&/\.\d{3,}$/.test(value))throw fail(400,'Use até 2 casas decimais.');const n=saleAmount(value);if(n===null||n>1000000000||Math.abs(n*100-Math.round(n*100))>0.0001)throw fail(400,'Informe valores válidos, positivos e com até 2 casas decimais.');return Math.round(n*100);};
const date=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail(400,'Informe uma data válida.');return value;};
export const isSaleField=label=>['venda','valor da venda','valor venda','valor vendido','total da venda','receita da venda'].includes(String(label||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s*\(r\$\)$/,'').trim());
const revision=row=>row.revision||createHash('sha256').update(JSON.stringify(row)).digest('hex');
function rows(d,lead){const ids=new Set((d.orders||[]).map(o=>o.id));return [...(d.orders||[]).filter(o=>o.leadId===lead.id).map(o=>({...o,lead:o.leadId,created:o.createdAt,title:o.title||o.productName||'Pedido',revision:revision(o),editable:true,order:true})),...(d.sales||[]).filter(s=>s.lead===lead.id&&!ids.has(s.id)).map(s=>({...s,revision:revision(s),editable:true}))];}
function legacy(d,lead){const field=(d.customFields||[]).find(f=>isSaleField(f.label||f.name)&&saleAmount(lead.custom?.[f.id]?.value??lead.custom?.[f.id])!==null);if(!field){if(lead.status!=='won'||!(saleAmount(lead.value)>0))return null;return {id:'legacy:'+lead.id+':value',lead:lead.id,title:'Venda anterior (valor do cliente)',amount:saleAmount(lead.value),soldOn:null,editable:true,legacy:true};}return {id:'legacy:'+lead.id+':'+field.id,lead:lead.id,title:'Venda anterior (campo personalizado)',amount:saleAmount(lead.custom[field.id]?.value??lead.custom[field.id]),soldOn:null,editable:true,legacy:true};}
export function leadSales(d,method,p){
 const lead=d.leads.find(l=>l.id===p.leadId);if(!lead)throw fail(404,'Cliente não encontrado.');
 let records=rows(d,lead);const previous=!records.length?legacy(d,lead):null;if(previous)previous.revision=revision(previous);
 if(method==='getLeadSales')return {sales:previous?[previous]:records};
 const order=(d.orders||[]).find(o=>o.id===p.id),existing=order||d.sales.find(s=>s.id===p.id);
 if(existing&&(order?order.leadId:existing.lead)!==lead.id)throw fail(409,'Identificador já utilizado.');
 const oldLegacy=previous&&previous.id===p.id?previous:null;
 if(!existing&&!oldLegacy&&!/^[a-f0-9-]{36}$/i.test(p.id||''))throw fail(400,'Identificador da venda inválido.');
 const current=existing||oldLegacy;
 const changedAt=new Date().toISOString();
 const persist=payload=>{
  if(existing){Object.assign(existing,payload,{revision:crypto.randomUUID(),updatedAt:changedAt});if(order){const mirror=d.sales.find(s=>s.id===order.id);if(mirror)Object.assign(mirror,payload,{lead:lead.id,revision:order.revision,updatedAt:changedAt});}}
  else if(oldLegacy){d.sales.push({...oldLegacy,legacy:undefined,editable:undefined,...payload,origin:'custom-field-import',created:changedAt,revision:crypto.randomUUID()});}
 };
 if(p.operation==='delete'||p.operation==='restore'){
  if(!current)throw fail(404,'Venda não encontrada.');
  const deleting=p.operation==='delete';
  if(deleting&&current.deletedAt||!deleting&&!current.deletedAt)return {sales:rows(d,lead)};
  if(p.revision!==revision(current))throw fail(409,'Esta venda foi alterada. Atualize o histórico antes de continuar.');
  const payload=deleting?{status:'cancelled',deletedAt:changedAt,statusBeforeDelete:current.status||'registered'}:{status:current.statusBeforeDelete||'registered',deletedAt:null,statusBeforeDelete:null};
  persist(payload);return {sales:rows(d,lead)};
 }
 if(current?.deletedAt)throw fail(409,'Restaure a venda antes de editar.');
 const title=String(p.title||'').trim();if(!title||title.length>160)throw fail(400,'Informe uma descrição de até 160 caracteres.');
 const soldOn=date(p.soldOn),today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});if(soldOn>today)throw fail(400,'A data da venda não pode estar no futuro.');
 const payments={};for(const key of ['entry','delivery']){const part=p.payments?.[key]||{},amount=cents(part.amount);const received=part.received===true;const paymentDate=part.date?date(part.date):null;if(received&&(!paymentDate||paymentDate>today))throw fail(400,'Informe a data de recebimento, sem data futura.');payments[key]={amount:amount/100,received,date:paymentDate};}
 const amount=(cents(payments.entry.amount)+cents(payments.delivery.amount))/100;if(!amount)throw fail(400,'Informe o valor da entrada ou da entrega.');
 const payload={title,soldOn,amount,payments,status:p.status==='cancelled'?'cancelled':'registered'};
 if(current){const same=Object.entries(payload).every(([k,v])=>JSON.stringify(current[k])===JSON.stringify(v));if(same)return {sales:records};if(p.revision!==revision(current))throw fail(409,'Esta venda foi alterada. Atualize o histórico antes de salvar.');persist(payload);}
 else{if(p.revision)throw fail(404,'Venda não encontrada.');if(previous)d.sales.push({...previous,id:crypto.randomUUID(),legacy:undefined,editable:undefined,origin:'custom-field-import',created:changedAt,revision:crypto.randomUUID()});d.sales.push({id:p.id,lead:lead.id,...payload,origin:'lead-sales',created:changedAt,revision:crypto.randomUUID()});}
 lead.status='won';return {sales:rows(d,lead)};
}

export function listLeadSales(d,p={}){
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const query=normalize(p.query).trim(),status=p.status||'active',origin=p.origin||'all';
 if(!['active','all','cancelled','deleted'].includes(status)||!['all','order','manual','legacy'].includes(origin))throw fail(400,'Filtro de vendas inválido.');
 const from=p.from?date(p.from):'',to=p.to?date(p.to):'';if(from&&to&&from>to)throw fail(400,'O início do período deve ser anterior ao fim.');
 const cancelled=s=>['cancelled','canceled','cancelado','cancelada','refunded','reembolsado'].includes(s.status);
 const all=(d.leads||[]).flatMap(lead=>{const records=rows(d,lead),previous=!records.length?legacy(d,lead):null;if(previous)previous.revision=revision(previous);return (previous?[previous]:records).map(s=>({...s,leadId:lead.id,leadName:lead.name||'Cliente',leadPhone:lead.phone||'',leadEmail:lead.email||'',companyName:(d.companies||[]).find(c=>c.id===lead.companyId)?.name||lead.company||'',tags:lead.tags||[],saleOrigin:s.order?'order':s.legacy||s.origin==='custom-field-import'?'legacy':'manual'}));});
 const selected=all.filter(s=>{
  if(status==='active'&&(s.deletedAt||cancelled(s))||status==='cancelled'&&(!cancelled(s)||s.deletedAt)||status==='deleted'&&!s.deletedAt||origin!=='all'&&origin!==s.saleOrigin)return false;
  const sold=s.soldOn||(!s.legacy&&s.origin!=='custom-field-import'?s.created?.slice(0,10):'');if(from&&(!sold||sold<from)||to&&(!sold||sold>to))return false;
  return !query||normalize([s.title,s.productName,s.leadName,s.leadPhone,s.leadEmail,s.companyName,...s.tags].join(' ')).includes(query);
 }).sort((a,b)=>{const av=a.soldOn||a.created||'',bv=b.soldOn||b.created||'';return bv.localeCompare(av)||String(a.id).localeCompare(String(b.id));});
 const total=selected.length,totalPages=Math.max(1,Math.ceil(total/10)),page=Math.min(totalPages,Math.max(1,Math.trunc(Number(p.page)||1)));
 return {sales:selected.slice((page-1)*10,page*10),total,page,pageSize:10,totalPages,totalAmount:selected.filter(s=>!s.deletedAt&&!cancelled(s)).reduce((n,s)=>n+(saleAmount(s.amount)||0),0)};
}
