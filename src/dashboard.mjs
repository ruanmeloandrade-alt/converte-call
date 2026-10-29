// Read-only projection: orders/sales are authoritative; explicit sale fields are a fallback.
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\s*\(r\$\)$/,'').trim();
const saleAmounts=new Set(['venda','valor da venda','valor venda','valor vendido','total da venda','receita da venda']);
const saleStatuses=new Set(['venda','status','situacao','status da venda','situacao da venda','status comercial']);
const won=new Set(['venda','vendido','venda realizada','venda concluida','ganho','won','fechado']);
const cancelled=row=>['cancelled','canceled','cancelado','cancelada','refunded','reembolsado'].includes(normalize(row.status));
export function saleAmount(value){
 if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;
 let text=String(value??'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');if(!text)return null;
 if(!/^\d[\d.,]*$/.test(text))return null;
 if(text.includes(','))text=text.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(?:\.\d{3})+$/.test(text))text=text.replace(/\./g,'');
 const number=Number(text);return Number.isFinite(number)&&number>=0?number:null;
}
export function dashboardSummary(data){
 const orders=(data.orders||[]).filter(row=>!cancelled(row)),allOrderIds=new Set((data.orders||[]).map(row=>row.id)),sales=(data.sales||[]).filter(row=>!allOrderIds.has(row.id)&&!cancelled(row));
 const transactions=[...orders.map(row=>({lead:row.leadId,amount:saleAmount(row.amount)??0})),...sales.map(row=>({lead:row.lead,amount:saleAmount(row.amount)??0}))];
 let fieldSales=0,legacySales=0;
 const leads=(data.leads||[]).map(lead=>{
  const entries=(data.customFields||[]).map(field=>({id:field.id,label:normalize(field.label||field.name),value:lead.custom?.[field.id]?.value??lead.custom?.[field.id]}));
  const explicitAmount=entries.find(field=>saleAmounts.has(field.label)&&saleAmount(field.value)!==null),fieldWon=entries.some(field=>saleStatuses.has(field.label)&&(won.has(normalize(field.value))||field.label==='venda'&&['sim','true'].includes(normalize(field.value))));
  const saleField=explicitAmount||((fieldWon||lead.status==='won')?entries.find(field=>['valor','valor total','valor do negocio'].includes(field.label)&&saleAmount(field.value)!==null):null);
  const records=transactions.filter(row=>row.lead===lead.id),hasLedger=(data.sales||[]).some(s=>s.lead===lead.id)||(data.orders||[]).some(o=>o.leadId===lead.id),hasSale=records.length>0||!hasLedger&&(!!saleField||fieldWon||lead.status==='won');
  const lost=!hasSale&&lead.status==='lost',status=hasSale?'won':lost?'lost':'open',amount=hasLedger?records.reduce((sum,row)=>sum+row.amount,0):saleField?saleAmount(saleField.value):saleAmount(lead.value)??0;
  if(!hasLedger&&(saleField||fieldWon)){fieldSales++;legacySales++;}else if(!hasLedger&&lead.status==='won')legacySales++;
  const funnel=(data.funnels||[]).find(f=>f.id===lead.funnelId);
  return {lead_id:lead.id,name:lead.name,email:lead.email||'',phone:lead.phone||'',status_key:status,status,created_at:lead.createdAt||null,value_brl:amount,stage_name:lead.stage,funnel_name:funnel?.name||'',crm_tags:lead.tags||[],custom_fields:entries.map(field=>({key:field.id,value:String(field.value??'')}))};
 });
 const funnel=(data.funnels||[]).flatMap(f=>f.stages.map(stage=>{const ids=new Set((data.leads||[]).filter(lead=>lead.funnelId===f.id&&lead.stage===stage.name).map(lead=>lead.id)),selected=leads.filter(lead=>ids.has(lead.lead_id));return {stage_id:stage.id,stage_name:stage.name,funnel_name:f.name,count:selected.length,value_brl:selected.reduce((sum,lead)=>sum+lead.value_brl,0),pct_of_top:0};}));
 const products=new Map();for(const order of orders){const key=order.productId||order.productName||'Venda avulsa',row=products.get(key)||{productId:key,name:order.productName||'Venda avulsa',units:0,deals:0,revenue:0,leadIds:[]};row.units+=Number(order.quantity)||1;row.deals++;row.revenue+=saleAmount(order.amount)??0;if(order.leadId&&!row.leadIds.includes(order.leadId))row.leadIds.push(order.leadId);products.set(key,row);}
 const orderRevenue=[...products.values()].reduce((sum,row)=>sum+row.revenue,0);
 return {leads,funnel,productSales:{rows:[...products.values()].map(row=>({...row,ticket:row.deals?row.revenue/row.deals:0,share:orderRevenue?row.revenue/orderRevenue:0})),totalRevenue:orderRevenue,revenueCoverage:1,schemaReady:true},totals:{saleCount:transactions.length+legacySales,receivedSales:[...orders,...sales].reduce((sum,s)=>sum+Object.values(s.payments||{}).reduce((n,p)=>n+(p.received?(saleAmount(p.amount)??0):0),0),0),orderCount:orders.length,orderRevenue,fieldSales:fieldSales+sales.filter(s=>['lead-sales','custom-field-import'].includes(s.origin)).length,revenue:leads.filter(lead=>lead.status_key==='won').reduce((sum,lead)=>sum+lead.value_brl,0),wonLeads:leads.filter(lead=>lead.status_key==='won').length}};
}
