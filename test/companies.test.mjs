import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {Store,Core} from '../src/database.mjs';
import {rpc} from '../src/rpc.mjs';
import {runtimeFetch,runtimeEmail} from '../src/salesbot-context.mjs';
import {SalesbotStore} from '../src/salesbot-store.mjs';
import {hashPassword} from '../src/security.mjs';

const module='@/lib/companies.functions';
async function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'cc-company-')),master='c'.repeat(64),app=createApp({dir,master,bootstrap:'company-fixture'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 let credential;
 const request=async(path,body,token=credential)=>{const res=await fetch(base+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
 try{
  const setup=await request('/v1/auth/bootstrap',{token:'company-fixture',email:'owner@example.test',password:'Company-test-only-123'});assert.equal(setup.status,201);credential=setup.data.accessToken;const ws=setup.data.workspaceId;
  const api=async(method,data={},mod=module)=>{const res=await request('/v1/slim/rpc',{module:mod,method,data});assert.equal(res.status,200,JSON.stringify(res.data));return res.data;};
  await fn({app,ws,api,request,dir,master});
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
}

test('B2B real HTTP stores contacts, renders one company card, moves all together, changes primary and preserves projects/history after restart',()=>fixture(async({app,ws,api,request,dir,master})=>{
 const supplier=await api('createCompany',{name:'Fornecedor existente'}),company=await api('createCompany',{name:'Empresa B2B',kind:'customer',cnpj:'123',notes:'Contrato'});
 await api('addCompanyMembers',{companyId:company.id,contacts:[{name:'Ana',phone:'5511991112233',email:'ana@example.test',role:'Diretora'},{name:'Bruno',phone:'5521992223344',email:'bruno@example.test',role:'Compras'}]});
 let response=await api('listCompanyLeads',{companyId:company.id});const [ana,bruno]=response.leads;assert.equal(response.company.primaryLead.id,ana.id);assert.equal(response.leads.length,2);assert.equal(ana.role,'Diretora');
 let d=app.store.get(ws),f=d.funnels[0];
 app.store.mutate(ws,d=>{d.inboxEvents.push({id:randomUUID(),type:'message',leadId:bruno.id,direction:'in',text:'Histórico preservado',at:Core.now()});d.projects.push({id:'b2b-project',name:'Implantação',companyId:company.id,lead:'',columns:[],status:'active'});});
 let funnels=await api('listFunnels',{},'@/lib/crm.functions'),cards=funnels.funnels.flatMap(f=>f.stages.flatMap(s=>s.leads));assert.equal(cards.length,1);assert.equal(cards[0].name,'Empresa B2B');assert.equal(cards[0].id,ana.id);assert.match(cards[0].company,/2 contatos/);
 await api('moveLead',{leadId:bruno.id,toStageId:f.stages[1].id},'@/lib/crm.functions');d=app.store.get(ws);assert(d.leads.every(l=>l.stage===f.stages[1].name));assert(d.localActivity.some(e=>e.type==='lead-stage'&&e.entityId===ana.id));
 await api('setCompanyPrimaryLead',{companyId:company.id,leadId:bruno.id});await api('updateCompanyMemberRole',{companyId:company.id,leadId:bruno.id,role:'Decisor'});
 response=await api('listCompanyLeads',{companyId:company.id});assert.equal(response.company.primaryLead.id,bruno.id);assert.equal(response.leads.find(l=>l.id===bruno.id).role,'Decisor');
 funnels=await api('listFunnels',{},'@/lib/crm.functions');cards=funnels.funnels.flatMap(f=>f.stages.flatMap(s=>s.leads));assert.equal(cards.length,1);assert.equal(cards[0].id,bruno.id);
 app.store.mutate(ws,d=>{const project=d.projects.find(p=>p.id==='b2b-project');project.columns=[{id:'todo',name:'A fazer'}];d.tasks.push({id:'b2b-task',projectId:project.id,column:'todo',title:'Entrega',enteredAt:Core.now()});d.projectRules.push({id:'b2b-rule',name:'Avançar empresa',projectId:project.id,column:'todo',trigger:'entered',action:'lead-stage',targetFunnel:f.id,targetStage:f.stages[2].id,active:true});Core.projectTick(d);});
 d=app.store.get(ws);assert(d.leads.every(l=>l.stage===f.stages[2].name));assert(d.leads.every(l=>l.stageId===f.stages[2].id));assert.equal(d.automationRuns.find(r=>r.ruleId==='b2b-rule').status,'done');
 const reject=await request('/v1/slim/rpc',{module,method:'removeCompanyMember',data:{companyId:company.id,leadId:bruno.id}});assert.equal(reject.status,409);
 await api('removeCompanyMember',{companyId:company.id,leadId:ana.id});d=app.store.get(ws);assert.equal(d.leads.length,2);assert.equal(d.leads.find(l=>l.id===ana.id).companyId,null);assert.equal(d.inboxEvents[0].text,'Histórico preservado');assert.equal(d.projects.find(p=>p.id==='b2b-project').companyId,company.id);assert.equal(d.companies.find(c=>c.id===supplier.id).kind,'supplier');
 const reopened=new Store(dir,master);try{assert.equal(reopened.get(ws).companies.find(c=>c.id===company.id).primaryLeadId,bruno.id);assert.equal(reopened.get(ws).projects.find(p=>p.id==='b2b-project').companyId,company.id);}finally{reopened.close();}
}));

test('company outbound policy blocks secondary Inbox/text/media/bot/email sends and follows primary reassignment',()=>fixture(async({app,ws,api,request})=>{
 const c=await api('createCompany',{name:'B2B',kind:'customer'});await api('addCompanyMembers',{companyId:c.id,contacts:[{name:'Principal',phone:'5511981112233',email:'p@example.test'},{name:'Equipe',phone:'5521982223344',email:'s@example.test'}]});const {leads:[p,s]}=await api('listCompanyLeads',{companyId:c.id});
 const sent=[];app.evolution.baseUrl='https://evolution.example.test';app.evolution.key='fixture';app.evolution.fetcher=async(url,options)=>{sent.push({url:String(url),body:JSON.parse(options.body||'{}')});return Response.json({key:{id:randomUUID()}});};app.store.run("INSERT INTO instances(workspace_id,instance_name,hook_hash,credentials,status,updated_at) VALUES(?,?,?,?,?,?)",ws,'qa-'+ws,'qa',app.store.vault.seal({instanceKey:'fixture'}),'connected',Core.now());
 const secondary=await request('/v1/slim/rpc',{module:'@/lib/leads.functions',method:'sendLeadMessage',data:{leadId:s.id,text:'Não deve sair'}});assert.equal(secondary.status,409);assert.equal(sent.length,0);
 await assert.rejects(app.evolution.send(ws,s.phone,'bloqueado'),/contato principal/);await assert.rejects(app.evolution.sendMedia(ws,s.phone,{kind:'image',base64:'YQ=='}),/contato principal/);
 const adapter=new SalesbotStore(app.store,app.evolution,ws);await assert.rejects(adapter.run(()=>runtimeFetch('https://evolution.example.test/message/sendText/test',{body:JSON.stringify({number:s.phone,text:'bloqueado'})})),/contato principal/);
 assert.deepEqual(adapter.rows('leads').map(l=>l.id),[p.id]);
 adapter.google={};await assert.rejects(adapter.run(()=>runtimeEmail(ws,{to:s.email,subject:'Teste',text:'Não enviar',idempotencyKey:'blocked'})),/contato principal/);
 await assert.rejects(app.worker.automation.dispatch(ws,{kind:'bot',leadId:s.id,assetId:randomUUID()},randomUUID()),/contato principal/);
 await api('sendLeadMessage',{leadId:p.id,text:'Mensagem ao responsável'},'@/lib/leads.functions');assert.equal(sent.length,1);assert.equal(sent[0].body.number,p.phone);
 await api('setCompanyPrimaryLead',{companyId:c.id,leadId:s.id});await assert.rejects(app.evolution.send(ws,p.phone,'bloqueado após troca'),/contato principal/);await app.evolution.send(ws,s.phone,'Agora principal');assert.equal(sent.length,2);assert.equal(sent[1].body.number,s.phone);
 // Deleting a primary must never silently pick an employee as the new recipient.
 await api('deleteLead',{leadId:s.id},'@/lib/crm.functions');await assert.rejects(app.evolution.send(ws,p.phone,'sem responsável'),/contato principal/);
}));

test('company RPC rejects foreign members, invalid associations and cross-workspace primary changes atomically',()=>fixture(async({app,ws,api,request})=>{
 const c=await api('createCompany',{name:'Empresa',kind:'customer'}),other=app.store.createWorkspace(),foreign=randomUUID();app.store.mutate(other,d=>d.leads.push({id:foreign,name:'Outra conta',funnelId:d.funnels[0].id,stage:d.funnels[0].stages[0].name}));
 for(const [method,data] of [['addCompanyMembers',{companyId:c.id,leadIds:[foreign]}],['setCompanyPrimaryLead',{companyId:c.id,leadId:foreign}],['listCompanyLeads',{companyId:randomUUID()}]]){const response=await request('/v1/slim/rpc',{module,method,data});assert(response.status>=400);}
 await assert.rejects(api('addCompanyMembers',{companyId:c.id,contacts:[{name:'Válido'},{name:''}]}));assert.equal(app.store.get(ws).leads.length,0);
 assert.throws(()=>app.store.mutate(ws,d=>d.projects.push({id:'invalid',name:'Projeto',columns:[],companyId:'foreign'})),/Empresa do projeto/);assert(!app.store.get(ws).projects.some(p=>p.id==='invalid'));
 const credentials=await hashPassword('Other-fixture-password'),uid=randomUUID();app.store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',uid,'foreign@example.test',credentials.hash,credentials.salt,other,Core.now());app.store.run("INSERT INTO account_roles VALUES(?,'admin')",uid);const login=await request('/v1/auth/session',{email:'foreign@example.test',password:'Other-fixture-password'});const response=await request('/v1/slim/rpc',{module,method:'listCompanyLeads',data:{companyId:c.id}},login.data.accessToken);assert.equal(response.status,404);
}));

test('a team member with client access creates B2B contacts without ERP permission and cannot bind hidden contacts',()=>fixture(async({app,ws,request})=>{
 const uid=randomUUID(),credentials=await hashPassword('Member-fixture-password');app.store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',uid,'member@example.test',credentials.hash,credentials.salt,ws,Core.now());app.store.run("INSERT INTO team_members VALUES(?,?,'member',?,1)",uid,ws,app.store.vault.seal(['clients','inbox','pipeline','projects']));
 const hidden=randomUUID();app.store.mutate(ws,d=>d.leads.push({id:hidden,name:'Privado de outro atendente',phone:'5511997778888',funnelId:d.funnels[0].id,stage:d.funnels[0].stages[0].name}));
 const login=await request('/v1/auth/session',{email:'member@example.test',password:'Member-fixture-password'}),token=login.data.accessToken;
 const call=async(method,data={})=>request('/v1/slim/rpc',{module,method,data},token);
 let response=await call('createCompany',{name:'Empresa da equipe',kind:'customer'});assert.equal(response.status,200);const companyId=response.data.id;
 response=await call('listCompanies',{kind:'customer'});assert.equal(response.status,200);assert(response.data.companies.some(c=>c.id===companyId));
 response=await call('addCompanyMembers',{companyId,contacts:[{name:'Contato B2B',phone:'5511993334444'}]});assert.equal(response.status,200);
 response=await call('listCompanyLeads',{companyId});assert.equal(response.data.leads.length,1);assert.equal(response.data.leads[0].responsibleId,uid);
 response=await call('addCompanyMembers',{companyId,leadIds:[hidden]});assert.equal(response.status,409);assert.equal(app.store.get(ws).leads.find(l=>l.id===hidden).companyId,undefined);
}));
