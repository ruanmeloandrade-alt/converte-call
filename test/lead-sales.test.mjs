import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createApp} from '../src/server.mjs';import {leadSales} from '../src/lead-sales.mjs';import {dashboardSummary} from '../src/dashboard.mjs';
const sale=(leadId,entry=100,delivery=200)=>({id:crypto.randomUUID(),leadId,title:'Serviço',soldOn:'2025-03-12',payments:{entry:{amount:entry,received:true,date:'2025-03-12'},delivery:{amount:delivery,received:false,date:'2025-04-01'}}});
test('multiple backdated sales preserve legacy value, split payments once, retry idempotently, edit and cancel',()=>{
 const d={leads:[{id:'a',custom:{value:{value:'500,50'}}}],customFields:[{id:'value',label:'Valor da venda (R$)'}],orders:[],sales:[],funnels:[]},first=sale('a');
 assert.equal(leadSales(d,'getLeadSales',{leadId:'a'}).sales[0].amount,500.5);
 const saved=leadSales(d,'saveLeadSale',first);assert.equal(saved.sales.length,2);assert.equal(d.sales[0].soldOn,null);assert.equal(d.sales[1].soldOn,'2025-03-12');assert(d.sales[1].created.startsWith(new Date().getFullYear()+''));
 leadSales(d,'saveLeadSale',first);assert.equal(d.sales.length,2);assert.throws(()=>leadSales(d,'saveLeadSale',{...first,title:'Retry diferente'}),/alterada/);
 leadSales(d,'saveLeadSale',sale('a',50.25,49.75));let summary=dashboardSummary(d);assert.equal(summary.totals.revenue,900.5);assert.equal(summary.totals.saleCount,3);assert.equal(summary.totals.wonLeads,1);assert.equal(summary.totals.receivedSales,150.25);
 const row=d.sales[1];const rev=row.revision;leadSales(d,'saveLeadSale',{...row,leadId:'a',payments:{...row.payments,delivery:{amount:300,date:'2025-04-01',received:true}}});assert.equal(dashboardSummary(d).totals.revenue,1000.5);assert.throws(()=>leadSales(d,'saveLeadSale',{...row,leadId:'a',revision:rev,title:'Conflito'}),/alterada/);
 for(const s of [...d.sales])leadSales(d,'saveLeadSale',{...s,leadId:'a',soldOn:s.soldOn||'2025-01-01',payments:s.payments||{entry:{amount:s.amount,received:false},delivery:{amount:0,received:false}},status:'cancelled'});
 summary=dashboardSummary(d);assert.equal(summary.totals.revenue,0);assert.equal(summary.totals.saleCount,0);assert.equal(summary.totals.wonLeads,0);
});
test('orders retain authority, invalid values and dates cannot write sales',()=>{
 const d={leads:[{id:'a',custom:{v:{value:300}}}],customFields:[{id:'v',label:'Venda'}],orders:[{id:'o',leadId:'a',amount:300}],sales:[{id:'o',lead:'a',amount:300}],funnels:[]};leadSales(d,'saveLeadSale',sale('a'));assert.equal(d.sales.length,2);assert.equal(dashboardSummary(d).totals.revenue,600);assert.equal(dashboardSummary(d).totals.saleCount,2);
 for(const p of [{...sale('a'),soldOn:'2025-02-30'},{...sale('a'),soldOn:'2999-01-01'},sale('a',-10),sale('a',1.111),{...sale('a'),payments:{entry:{amount:100,received:true},delivery:{amount:0}}}])assert.throws(()=>leadSales(d,'saveLeadSale',p));assert.equal(d.sales.length,2);
});
test('real sales RPC persists and enforces authentication, workspace, assignment and edit permissions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-sales-')),app=createApp({dir,master:'e'.repeat(64),bootstrap:'sales'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,data,token)=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,...await r.json()};};
 try{const owner=await call('/v1/auth/bootstrap',{token:'sales',email:'owner@sales.test',password:'Sales-password-123'});const rpc=(method,data,token=owner.accessToken)=>call('/v1/slim/rpc',{module:'@/lib/leads.functions',method,data},token);const created=await call('/v1/slim/rpc',{module:'@/lib/crm.functions',method:'createLead',data:{name:'Cliente recorrente'}},owner.accessToken);const leadId=created.leadId;
 assert.equal((await rpc('saveLeadSale',sale(leadId))).status,200);assert.equal((await rpc('saveLeadSale',sale(leadId,300,400))).status,200);assert.equal((await rpc('getLeadSales',{leadId})).sales.length,2);assert.equal(app.store.get(owner.workspaceId).sales.length,2);const summary=await call('/v1/dashboard/summary',null,owner.accessToken);assert.equal(summary.totals.revenue,1000);assert.equal(summary.totals.saleCount,2);
 const other=await call('/v1/auth/register',{registrationMode:'quick',name:'Outra',email:'other@sales.test',whatsapp:'5522991234567',password:'Sales-password-123'});assert.equal((await rpc('getLeadSales',{leadId},other.accessToken)).status,404);assert.equal((await rpc('saveLeadSale',sale(leadId),other.accessToken)).status,404);assert.equal((await rpc('getLeadSales',{leadId},'')).status,401);
 const user=app.store.one('SELECT id FROM users WHERE workspace_id=?',owner.workspaceId);app.store.run("UPDATE team_members SET role='member',permissions=? WHERE user_id=?",app.store.vault.seal(['inbox']),user.id);assert.equal((await rpc('saveLeadSale',sale(leadId))).status,403);app.store.run('UPDATE team_members SET permissions=? WHERE user_id=?',app.store.vault.seal(['inbox','clients']),user.id);assert.equal((await rpc('getLeadSales',{leadId})).status,404);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('Inbox edits the canonical order, preserves stock, and deletion/restoration updates all dashboard totals without duplicates',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-order-edit-')),app=createApp({dir,master:'a'.repeat(64),bootstrap:'order-edit'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,data,token)=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,...await r.json()};};
 try{
  const owner=await call('/v1/auth/bootstrap',{token:'order-edit',email:'order@edit.test',password:'Test-password-123'}),rpc=(method,data,token=owner.accessToken)=>call('/v1/slim/rpc',{module:'@/lib/leads.functions',method,data},token);
  const created=await call('/v1/slim/rpc',{module:'@/lib/crm.functions',method:'createLead',data:{name:'Cliente com pedido',order:{productName:'Plataforma SaaS',amount:2080,quantity:1}}},owner.accessToken),leadId=created.leadId;
  let response=await rpc('getLeadSales',{leadId});assert.equal(response.sales.length,1);let order=response.sales[0];assert.equal(order.editable,true);assert.equal(order.order,true);assert.equal(order.amount,2080);const original=app.store.get(owner.workspaceId),stock=structuredClone(original.products),orderId=order.id;
  const edit={...order,leadId,title:'Plataforma SaaS',soldOn:'2026-10-19',payments:{entry:{amount:500,received:true,date:'2026-10-19'},delivery:{amount:1450,received:false,date:''}}};
  response=await rpc('saveLeadSale',edit);assert.equal(response.status,200);assert.equal(response.sales.length,1);order=response.sales[0];assert.equal(order.amount,1950);
  let data=app.store.get(owner.workspaceId);assert.equal(data.orders.length,1);assert.equal(data.orders[0].id,orderId);assert.equal(data.sales.length,1);assert.equal(data.sales[0].amount,1950);assert.deepEqual(data.products,stock);
  let summary=await call('/v1/dashboard/summary',null,owner.accessToken);assert.equal(summary.totals.revenue,1950);assert.equal(summary.totals.receivedSales,500);assert.equal(summary.totals.saleCount,1);assert.equal(summary.productSales.rows[0].revenue,1950);
  assert.equal((await rpc('saveLeadSale',{...edit,title:'Edição obsoleta'})).status,409);
  response=await rpc('saveLeadSale',{id:order.id,leadId,revision:order.revision,operation:'delete'});assert.equal(response.status,200);assert(response.sales[0].deletedAt);assert.equal((await rpc('saveLeadSale',{...edit,revision:response.sales[0].revision})).status,409);
  summary=await call('/v1/dashboard/summary',null,owner.accessToken);assert.equal(summary.totals.revenue,0);assert.equal(summary.totals.receivedSales,0);assert.equal(summary.totals.saleCount,0);assert.equal(summary.productSales.totalRevenue,0);
  assert.equal((await rpc('saveLeadSale',{id:order.id,leadId,revision:order.revision,operation:'restore'})).status,409);
  order=response.sales[0];response=await rpc('saveLeadSale',{id:order.id,leadId,revision:order.revision,operation:'restore'});assert.equal(response.status,200);assert.equal(response.sales[0].deletedAt,null);summary=await call('/v1/dashboard/summary',null,owner.accessToken);assert.equal(summary.totals.revenue,1950);assert.equal(summary.totals.saleCount,1);
  const second=await rpc('saveLeadSale',sale(leadId,20,30));assert.equal(second.sales.length,2);assert.equal((await call('/v1/dashboard/summary',null,owner.accessToken)).totals.revenue,2000);
  const other=await call('/v1/auth/register',{registrationMode:'quick',name:'Outro',email:'other@edit.test',whatsapp:'5522991234567',password:'Test-password-123'});
  assert.equal((await rpc('saveLeadSale',{id:order.id,leadId,revision:response.sales[0].revision,operation:'delete'},other.accessToken)).status,404);
  assert.equal((await rpc('saveLeadSale',{id:order.id,leadId,operation:'delete'},'')).status,401);
  assert.equal(app.store.get(owner.workspaceId).orders[0].amount,1950);assert.deepEqual(app.store.get(owner.workspaceId).products,stock);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('legacy sale fields can be edited, excluded and restored without resurrecting the old fallback',()=>{
 const d={leads:[{id:'a',custom:{value:{value:'2080,00'}}}],customFields:[{id:'value',label:'Valor da venda (R$)'}],orders:[],sales:[],funnels:[]};
 let old=leadSales(d,'getLeadSales',{leadId:'a'}).sales[0];assert(old.editable);let result=leadSales(d,'saveLeadSale',{...old,leadId:'a',title:'Venda corrigida',soldOn:'2026-10-19',payments:{entry:{amount:1950,received:false},delivery:{amount:0,received:false}}});assert.equal(result.sales.length,1);assert.equal(dashboardSummary(d).totals.revenue,1950);
 old=result.sales[0];result=leadSales(d,'saveLeadSale',{id:old.id,leadId:'a',revision:old.revision,operation:'delete'});assert.equal(dashboardSummary(d).totals.revenue,0);assert.equal(leadSales(d,'getLeadSales',{leadId:'a'}).sales.length,1);assert(result.sales[0].deletedAt);
 old=result.sales[0];leadSales(d,'saveLeadSale',{id:old.id,leadId:'a',revision:old.revision,operation:'restore'});assert.equal(dashboardSummary(d).totals.revenue,1950);assert.equal(d.leads[0].custom.value.value,'2080,00');
});
import {listLeadSales} from '../src/lead-sales.mjs';
test('sales management filters the real ledger, deduplicates order mirrors and clamps every page to 10 rows',()=>{
 const d={leads:[{id:'a',name:'João Silva',phone:'5522991234567',tags:['Renovação'],companyId:'c'},{id:'b',name:'Ana'}],companies:[{id:'c',name:'Empresa Alfa'}],customFields:[],orders:[],sales:[]};
 for(let i=0;i<23;i++){const id=crypto.randomUUID();d.orders.push({id,leadId:'a',productName:'Sistema '+i,amount:100+i,soldOn:'2026-10-19',createdAt:'2026-10-19T12:00:00Z'});d.sales.push({id,lead:'a',amount:100+i});}
 d.sales.push({...sale('b'),lead:'b',amount:300,origin:'lead-sales',created:'2026-10-20T12:00:00Z'});
 let r=listLeadSales(d,{});assert.equal(r.total,24);assert.equal(r.sales.length,10);assert.equal(r.pageSize,10);assert.equal(r.totalPages,3);const ids=new Set(r.sales.map(s=>s.id));r=listLeadSales(d,{page:2,pageSize:999});assert.equal(r.sales.length,10);assert(!r.sales.some(s=>ids.has(s.id)));r=listLeadSales(d,{page:3});assert.equal(r.sales.length,4);assert.equal(listLeadSales(d,{page:999}).page,3);
 for(const query of ['joao','Alfa','renovacao','5522991234567'])assert.equal(listLeadSales(d,{query}).total,23);
 assert.equal(listLeadSales(d,{origin:'manual'}).total,1);assert.equal(listLeadSales(d,{origin:'order'}).total,23);assert.equal(listLeadSales(d,{query:'inexistente'}).total,0);assert.equal(listLeadSales(d,{from:'2026-10-20'}).total,0);assert.throws(()=>listLeadSales(d,{from:'2026-10-20',to:'2026-10-01'}),/início/);
 const first=leadSales(d,'getLeadSales',{leadId:'a'}).sales[0];leadSales(d,'saveLeadSale',{id:first.id,leadId:'a',revision:first.revision,operation:'delete'});assert.equal(listLeadSales(d,{}).total,23);assert.equal(listLeadSales(d,{status:'deleted'}).total,1);assert.equal(listLeadSales(d,{status:'all'}).total,24);assert.equal(listLeadSales(d,{status:'cancelled'}).total,0);
});

test('sales management RPC requires ERP access and scopes list/edit to assigned leads',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-sales-management-')),app=createApp({dir,master:'c'.repeat(64),bootstrap:'management'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,data,token)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {status:r.status,...await r.json()};};
 try{
  const owner=await call('/v1/auth/bootstrap',{token:'management',email:'management@test.invalid',password:'Test-password-123'}),rpc=(method,data,token=owner.accessToken)=>call('/v1/slim/rpc',{module:'@/lib/sales.functions',method,data},token);
  const a=crypto.randomUUID(),b=crypto.randomUUID();app.store.mutate(owner.workspaceId,d=>{d.leads.push({id:a,name:'Meu cliente'},{id:b,name:'Outro responsável'});leadSales(d,'saveLeadSale',sale(a));leadSales(d,'saveLeadSale',sale(b));});
  let response=await rpc('listLeadSales',{page:1,pageSize:999});assert.equal(response.status,200);assert.equal(response.pageSize,10);assert.equal(response.total,2);assert.equal((await rpc('listLeadSales',{},'')).status,401);
  const user=app.store.one('SELECT id FROM users WHERE workspace_id=?',owner.workspaceId);app.store.run("UPDATE team_members SET role='member',permissions=? WHERE user_id=?",app.store.vault.seal(['inbox','clients']),user.id);assert.equal((await rpc('listLeadSales',{})).status,403);
  app.store.run('UPDATE team_members SET permissions=? WHERE user_id=?',app.store.vault.seal(['erp']),user.id);app.store.mutate(owner.workspaceId,d=>{d.leads.find(l=>l.id===a).responsibleId=user.id;});response=await rpc('listLeadSales',{});assert.equal(response.status,200);assert.equal(response.total,1);assert.equal(response.sales[0].leadId,a);
  assert.equal((await rpc('getLeadSales',{leadId:b})).status,404);const mine=(await rpc('getLeadSales',{leadId:a})).sales[0];assert.equal((await rpc('saveLeadSale',{...mine,leadId:a,title:'Corrigida pelo ERP'})).status,200);
  assert.equal((await rpc('saveLeadSale',{id:app.store.get(owner.workspaceId).sales.find(s=>s.lead===b).id,leadId:b,operation:'delete'})).status,404);assert.equal(app.store.get(owner.workspaceId).sales.find(s=>s.lead===b).amount,300);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('editing legacy sales of two customers never shares a transaction identifier',()=>{
 const d={leads:[{id:'a',custom:{v:{value:100}}},{id:'b',custom:{v:{value:200}}}],customFields:[{id:'v',label:'Venda'}],orders:[],sales:[],funnels:[]};
 for(const leadId of ['a','b']){const s=leadSales(d,'getLeadSales',{leadId}).sales[0];leadSales(d,'saveLeadSale',{...s,leadId,title:'Correção',soldOn:'2026-10-19',payments:{entry:{amount:300,received:false},delivery:{amount:0,received:false}}});}
 assert.equal(d.sales.length,2);assert.notEqual(d.sales[0].id,d.sales[1].id);assert.equal(dashboardSummary(d).totals.revenue,600);
});
