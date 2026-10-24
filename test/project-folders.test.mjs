import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {Store,Core} from '../src/database.mjs';
const source=readFileSync(new URL('../extension/v4.js',import.meta.url),'utf8'),native=readFileSync(new URL('../extension/native.js',import.meta.url),'utf8');
async function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'cc-project-folders-')),master='f'.repeat(64),app=createApp({dir,master,bootstrap:'folders-only-fixture'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,body,token,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{
  const bootstrap=await call('/v1/auth/bootstrap',{token:'folders-only-fixture',email:'folders@example.test',password:'Test-folders-only-123'}),token=bootstrap.data.accessToken,ws=bootstrap.data.workspaceId;
  app.store.mutate(ws,d=>{d.projects=Array.from({length:25},(_,i)=>({id:'project-'+i,name:'Projeto '+i,priority:['urgent','high','normal','low'][i%4],columns:[{id:'todo',name:'A fazer'}],status:'active',createdAt:Core.now()}));d.activeProjectId='project-0';d.projectColumns=d.projects[0].columns;d.tasks.push({id:'task-preserved',projectId:'project-0',column:'todo',title:'Histórico',comments:[{text:'Preservar'}]});});
  let failWrite=false;const messages=[],ctx=vm.createContext({data:app.store.get(ws),structuredClone,actions:{},forms:{},readForm:f=>({...f}),uid:randomUUID,CCCore:Core,render:()=>{},toast:text=>messages.push(text),CCWorkspace:{get:async()=>app.store.get(ws),set:async d=>{if(failWrite)throw Error('offline');const response=await call('/v1/projects/definitions',{schemaVersion:1,projects:d.projects,folders:d.projectFolders,tasks:d.tasks,rules:d.projectRules},token,'PUT');if(response.status!==200)throw Error(response.data.error.message);}}});
  vm.runInContext(native.slice(native.indexOf('let savedSnapshot=null;'),native.indexOf('async function boot()')),ctx);vm.runInContext('savedSnapshot=structuredClone(data);',ctx);
  vm.runInContext(source.slice(source.indexOf('let projectSearch='),source.indexOf('function projectRows()')),ctx);
  vm.runInContext(source.slice(source.indexOf('function projectFolderModal'),source.indexOf('const taskFormV3')),ctx);
  vm.runInContext(source.slice(source.indexOf("forms['project-form']="),source.indexOf("actions['project-duplicate']")),ctx);
  await fn({app,ws,ctx,call,token,dir,master,messages,fail:()=>{failWrite=true;}});
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
}

test('native folder create/rename/move/delete and project priorities persist through actual HTTP and restart without losing cards',()=>fixture(async({app,ws,ctx,dir,master,call,token})=>{
 assert.equal(vm.runInContext('projectViewMode',ctx),'folders');const original=JSON.stringify(ctx.data.tasks);
 await ctx.forms['project-folder-form']({name:'Campanhas'});await ctx.forms['project-folder-form']({name:'Entregas'});const [folder,other]=ctx.data.projectFolders;
 await ctx.forms['project-move-folder-form']({id:'project-0',folderId:folder.id});assert.equal(app.store.get(ws).projects[0].folderId,folder.id);
 await ctx.forms['project-folder-form']({id:folder.id,name:'Campanhas 2026'});assert.equal(ctx.data.projectFolders[0].id,folder.id);assert.equal(ctx.data.projectFolders[1].id,other.id);
 ctx.forms['project-form']({id:'project-0',name:'Projeto 0',folderId:folder.id,priority:'high'});await ctx.save();assert.equal(app.store.get(ws).projects[0].priority,'high');
 await assert.rejects(ctx.forms['project-folder-form']({name:'campanhas 2026'}),/existe/);
 const payload={schemaVersion:1,projects:ctx.data.projects,tasks:ctx.data.tasks,rules:ctx.data.projectRules};assert.equal((await call('/v1/projects/definitions',payload,token,'PUT')).status,200);assert.equal(app.store.get(ws).projectFolders.length,2,'older clients must preserve folders');
 const reopened=new Store(dir,master);try{assert.equal(reopened.get(ws).projectFolders[0].name,'Campanhas 2026');assert.equal(reopened.get(ws).projects[0].priority,'high');}finally{reopened.close();}
 await ctx.forms['project-folder-delete-form']({id:folder.id});assert.equal(app.store.get(ws).projects.length,25);assert.equal(app.store.get(ws).projects[0].folderId,null);assert.equal(app.store.get(ws).projectFolders.length,1);assert.equal(JSON.stringify(ctx.data.tasks),original);
 assert.equal((await call('/v1/projects/definitions',{...payload,folders:[{id:'bad',name:''}]},token,'PUT')).status,400);
 assert.equal((await call('/v1/projects/definitions',payload,null,'PUT')).status,401);
}));

test('folder and list scopes, 10-row pagination, four priorities and sorting preserve records',()=>fixture(async({ctx})=>{
 await ctx.forms['project-folder-form']({name:'Pasta'});const folder=ctx.data.projectFolders[0];
 for(const project of ctx.data.projects.slice(0,12))await ctx.forms['project-move-folder-form']({id:project.id,folderId:folder.id});
 const before=JSON.stringify(ctx.data);vm.runInContext(`projectFolder=${JSON.stringify(folder.id)}`,ctx);assert.equal(vm.runInContext('matchingProjects().length',ctx),12);assert.equal(vm.runInContext('projectPageState().pages',ctx),2);
 vm.runInContext("projectViewMode='list';projectPage=3",ctx);assert.equal(vm.runInContext('matchingProjects().length',ctx),25);assert.equal(vm.runInContext('projectPageState().start',ctx),20);
 vm.runInContext("projectOrder='priority';projectPage=1",ctx);assert.equal(vm.runInContext('matchingProjects()[0].priority',ctx),'urgent');assert.equal(vm.runInContext('matchingProjects().at(-1).priority',ctx),'low');
 for(const priority of ['low','normal','high','urgent']){vm.runInContext(`projectPriority=${JSON.stringify(priority)}`,ctx);assert(vm.runInContext('matchingProjects().every(p=>p.priority===projectPriority)',ctx));}
 assert.equal(JSON.stringify(ctx.data),before);assert.throws(()=>ctx.forms['project-form']({id:'project-0',priority:'invalid'}),/prioridade/);
 // A stale folder reference is shown as Sem pasta instead of hiding the project.
 ctx.data.projects[0].folderId='removed-folder';assert.equal(vm.runInContext('projectFolderFor(data.projects[0])',ctx),'');
}));

test('failed writes keep folder and move dialogs recoverable without reporting saved changes',()=>fixture(async({ctx,fail,app,ws})=>{
 await ctx.forms['project-folder-form']({name:'Preservar'});const folder=ctx.data.projectFolders[0];await ctx.forms['project-move-folder-form']({id:'project-0',folderId:folder.id});fail();
 await assert.rejects(ctx.forms['project-folder-form']({name:'Não salvar'}),/Não foi possível salvar/);assert.equal(ctx.data.projectFolders.length,1);
 await assert.rejects(ctx.forms['project-move-folder-form']({id:'project-0',folderId:''}),/Não foi possível mover/);assert.equal(ctx.data.projects[0].folderId,folder.id);
 await assert.rejects(ctx.forms['project-folder-delete-form']({id:folder.id}),/Não foi possível remover/);assert.equal(ctx.data.projectFolders[0].id,folder.id);assert.equal(ctx.data.projects[0].folderId,folder.id);assert.equal(app.store.get(ws).projectFolders[0].id,folder.id);
}));

test('merging a pre-folder client baseline preserves folders created on another device',()=>{
 const folder={id:'other-device',name:'Outra tela'},next={projectFolders:[]},latest={projectFolders:[folder]};Core.merge({},next,latest);assert.deepEqual(latest.projectFolders,[folder]);
 Core.merge({projectFolders:[folder]},{projectFolders:[]},latest);assert.deepEqual(latest.projectFolders,[]);
});
