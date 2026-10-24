import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../extension/v4.js',import.meta.url),'utf8');
function setup(){const data={projects:[{id:'a',name:'Lançamento',description:'Campanha',status:'active',lead:'client-a',tags:['Vídeo','A&B'],columns:[{id:'stage'}]},{id:'b',name:'Site',status:'delivered',lead:'client-b',tags:'institucional',columns:[]},{id:'c',name:'CRM',status:'finished',columns:[]}],leads:[{id:'client-a',name:'João da Silva'},{id:'client-b',name:'Cliente Beta'}],tasks:[{projectId:'c',tags:['prioritário']} ]};
 const ctx=vm.createContext({data,console});const start=source.indexOf("let projectSearch="),end=source.indexOf('function updateProjectList',start);vm.runInContext(source.slice(start,end),ctx);return ctx;}
test('projects filter by normalized project/client/tags, combine status and preserve original records',()=>{const ctx=setup(),snapshot=JSON.stringify(ctx.data);const ids=()=>vm.runInContext('matchingProjects().map(p=>p.id).join(",")',ctx);for(const [text,expected] of [['lancamento','a'],['joao','a'],['video','a'],['prioritario','c'],['sem correspondencia','']]){vm.runInContext('projectSearch='+JSON.stringify(text),ctx);assert.equal(ids(),expected)}vm.runInContext('projectSearch="";projectStatus="delivered"',ctx);assert.equal(ids(),'b');vm.runInContext('projectSearch="João"',ctx);assert.equal(ids(),'');assert.equal(JSON.stringify(ctx.data),snapshot);});

test('project pagination renders at most 10 rows, clamps after archive and resets on search/status changes',()=>{
 const ctx=setup(),events={};Object.assign(ctx,{esc:x=>String(x??''),button:()=>'',badge:()=>'',attr:()=>'',actions:{},$:()=>null,document:{addEventListener:(name,fn)=>events[name]=fn}});
 ctx.data.projects=Array.from({length:25},(_,i)=>({id:'p'+i,name:'Projeto '+i,status:'active',columns:[]}));
 const count=()=>vm.runInContext('(projectRows().match(/<tr data-action/g)||[]).length',ctx);
 assert.equal(count(),10);vm.runInContext('projectPage=2',ctx);assert.equal(count(),10);assert.match(vm.runInContext('projectRows()',ctx),/data-id="p10"/);
 vm.runInContext('projectPage=3',ctx);assert.equal(count(),5);assert.match(vm.runInContext('projectPagination()',ctx),/21–25 de 25/);
 ctx.data.projects.slice(20).forEach(p=>p.archivedAt='2026-10-24');assert.equal(count(),10);assert.equal(vm.runInContext('projectPage',ctx),2);
 const start=source.indexOf('function updateProjectList'),end=source.indexOf('function projectBoard',start);vm.runInContext(source.slice(start,end),ctx);
 events.input({target:{id:'project-search',value:'Projeto 24'}});assert.equal(vm.runInContext('projectPage',ctx),1);assert.equal(count(),0);
 events.change({target:{id:'project-status',value:'archived'}});assert.equal(count(),1);
 ctx.data.companies=[{id:'company',name:'Indústria Alfa'}];ctx.data.projects[24].companyId='company';events.input({target:{id:'project-search',value:'industria'}});assert.equal(count(),1);
});

test('native project form links a company or individual exclusively without changing existing columns or archive state',()=>{
 const ctx=setup();Object.assign(ctx,{forms:{},readForm:f=>({...f}),uid:()=> 'new-project',CCCore:{now:()=>123}});ctx.data.companies=[{id:'company',name:'Alfa',kind:'customer'}];ctx.data.projects[0].archivedAt=111;
 const start=source.indexOf("forms['project-form']="),end=source.indexOf("actions['project-duplicate']",start);vm.runInContext(source.slice(start,end),ctx);
 const columns=JSON.stringify(ctx.data.projects[0].columns);ctx.forms['project-form']({id:'a',name:'Lançamento',projectParty:'company:company'});assert.equal(ctx.data.projects[0].companyId,'company');assert.equal(ctx.data.projects[0].lead,'');assert.equal(ctx.data.projects[0].archivedAt,111);assert.equal(JSON.stringify(ctx.data.projects[0].columns),columns);
 ctx.forms['project-form']({id:'a',name:'Lançamento',projectParty:'lead:client-a'});assert.equal(ctx.data.projects[0].companyId,null);assert.equal(ctx.data.projects[0].lead,'client-a');
 assert.throws(()=>ctx.forms['project-form']({id:'a',projectParty:'company:foreign'}),/empresa válida/);assert.equal(ctx.data.projects[0].lead,'client-a');
});
