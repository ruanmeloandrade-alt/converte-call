import {saleAmount} from './dashboard.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const cents=value=>{if(typeof value==='string'&&!value.includes(',')&&/\.\d{3,}$/.test(value))throw fail(400,'Use até 2 casas decimais.');const n=saleAmount(value);if(n===null||n>1000000000||Math.abs(n*100-Math.round(n*100))>0.0001)throw fail(400,'Informe valores válidos, positivos e com até 2 casas decimais.');return Math.round(n*100);};
const date=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail(400,'Informe uma data válida.');return value;};
export const isSaleField=label=>['venda','valor da venda','valor venda','valor vendido','total da venda','receita da venda'].includes(String(label||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s*\(r\$\)$/,'').trim());
function rows(d,lead){const ids=new Set((d.orders||[]).map(o=>o.id));return [...(d.orders||[]).filter(o=>o.leadId===lead.id).map(o=>({...o,lead:o.leadId,created:o.createdAt,editable:false})),...(d.sales||[]).filter(s=>s.lead===lead.id&&!ids.has(s.id)).map(s=>({...s,editable:s.origin==='lead-sales'||s.origin==='custom-field-import'}))];}
function legacy(d,lead){const field=(d.customFields||[]).find(f=>isSaleField(f.label||f.name)&&saleAmount(lead.custom?.[f.id]?.value??lead.custom?.[f.id])!==null);if(!field){if(lead.status!=='won'||!(saleAmount(lead.value)>0))return null;return {id:'legacy:value',lead:lead.id,title:'Venda anterior (valor do cliente)',amount:saleAmount(lead.value),soldOn:null,editable:false,legacy:true};}return {id:'legacy:'+field.id,lead:lead.id,title:'Venda anterior (campo personalizado)',amount:saleAmount(lead.custom[field.id]?.value??lead.custom[field.id]),soldOn:null,editable:false,legacy:true};}
export function leadSales(d,method,p){
 const lead=d.leads.find(l=>l.id===p.leadId);if(!lead)throw fail(404,'Cliente não encontrado.');
 let records=rows(d,lead);const previous=!records.length?legacy(d,lead):null;
 if(method==='getLeadSales')return {sales:previous?[previous]:records};
 if(!/^[a-f0-9-]{36}$/i.test(p.id||''))throw fail(400,'Identificador da venda inválido.');
 const existing=d.sales.find(s=>s.id===p.id);if(existing&&existing.lead!==lead.id)throw fail(409,'Identificador já utilizado.');
 if(existing&&!['lead-sales','custom-field-import'].includes(existing.origin))throw fail(409,'Edite este pedido na área de pedidos.');
 const title=String(p.title||'').trim();if(!title||title.length>160)throw fail(400,'Informe uma descrição de até 160 caracteres.');
 const soldOn=date(p.soldOn),today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});if(soldOn>today)throw fail(400,'A data da venda não pode estar no futuro.');
 const payments={};for(const key of ['entry','delivery']){const part=p.payments?.[key]||{},amount=cents(part.amount);const received=part.received===true;const paymentDate=part.date?date(part.date):null;if(received&&(!paymentDate||paymentDate>today))throw fail(400,'Informe a data de recebimento, sem data futura.');payments[key]={amount:amount/100,received,date:paymentDate};}
 const amount=(cents(payments.entry.amount)+cents(payments.delivery.amount))/100;if(!amount)throw fail(400,'Informe o valor da entrada ou da entrega.');
 const payload={title,soldOn,amount,payments,status:p.status==='cancelled'?'cancelled':'registered'};
 if(existing){const same=Object.entries(payload).every(([k,v])=>JSON.stringify(existing[k])===JSON.stringify(v));if(same)return {sales:records};if(p.revision!==existing.revision)throw fail(409,'Esta venda foi alterada. Atualize o histórico antes de salvar.');Object.assign(existing,payload,{revision:crypto.randomUUID(),updatedAt:new Date().toISOString()});}
 else{if(p.revision)throw fail(404,'Venda não encontrada.');if(previous)d.sales.push({...previous,id:crypto.randomUUID(),legacy:undefined,editable:undefined,origin:'custom-field-import',created:new Date().toISOString(),revision:crypto.randomUUID()});d.sales.push({id:p.id,lead:lead.id,...payload,origin:'lead-sales',created:new Date().toISOString(),revision:crypto.randomUUID()});}
 lead.status='won';return {sales:rows(d,lead)};
}
