import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {transformSync} from '../ui-source/node_modules/esbuild/lib/main.js';
import {createApp} from '../src/server.mjs';
import {Store} from '../src/database.mjs';

test('central duplicates the complete graph through real RPC without inheriting revision or enabling triggers',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-bot-duplicate-')),master='d'.repeat(64),app=createApp({dir,master,bootstrap:'duplicate-fixture'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const request=async(path,body,token)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error?.message||JSON.stringify(data));return data;};
 try{
  const auth=await request('/v1/auth/bootstrap',{token:'duplicate-fixture',email:'duplicate@example.test',password:'Fixture-duplicate-123'});
  const reads=[],api=async(method,data)=>{if(method==='getSalesbotGraph')reads.push(data.localId);return request('/v1/slim/rpc',{module:'@/lib/salesbots.functions',method,data},auth.accessToken);};
  const original={id:'original',nome:'Original',revision:7,isActive:true,startBlockId:'a',gatilhos:[{id:'trigger',ativo:true,tipo:'mensagem'}],blocks:[{id:'a',type:'condicao',nextBlockId:'b',falseNextBlockId:'c',condicoes:[{nextBlockId:'b',campo:'customer-field'}]},{id:'b',type:'pausa',nextBlockId:'c',pausas:[{nextBlockId:'c',seconds:30}],roleta:[{nextBlockId:'a'}],validacaoRegras:[{nextBlockId:'c'}]},{id:'c',type:'webhook',webhookErrorNextBlockId:'a',url:'https://example.test/hook'}],totalLancado:12};
  app.store.mutate(auth.workspaceId,d=>{d.bots.push(original);});const before=JSON.stringify(app.store.get(auth.workspaceId).bots[0]);
  const file=readFileSync(new URL('../ui-source/copied-source/legacy/crm.automacoes.legacy.tsx',import.meta.url),'utf8');
  const extract=(start,end)=>file.slice(file.indexOf(start),file.indexOf(end,file.indexOf(start)));
  const code=[extract('async function loadCompleteForMutation(', 'const botName ='),extract('function persist(', 'async function toggleActive('),extract('function syncBots(', '/** Exclui de verdade'),extract('async function duplicateBot(', 'function toggleSel(')].join('\n');
  const errors=[],success=[],ctx=vm.createContext({bots:[{id:'original',nome:'Original',revision:7}],newId:p=>p+'_'+randomUUID(),getBotGraphFn:({data})=>api('getSalesbotGraph',data),syncFn:({data})=>api('syncSalesbotFromLocal',data),botName:b=>b.nome,enqueueSalesbotSync:(_,fn)=>fn(),setBots:()=>{},saveSalesbots:()=>{},toast:{loading:()=>1,success:m=>success.push(m),error:m=>errors.push(m)}});
  vm.runInContext(transformSync(code,{loader:'ts',target:'es2022'}).code,ctx);
  await ctx.duplicateBot(ctx.bots[0],'Cópia');assert.deepEqual(errors,[]);assert.equal(success.length,1);assert.deepEqual(reads,['original']);
  const stored=app.store.get(auth.workspaceId).bots,copy=stored.find(b=>b.id!=='original');assert(copy);assert.equal(JSON.stringify(stored.find(b=>b.id==='original')),before);assert.equal(copy.revision,1);assert.equal(copy.isActive,false);assert.equal(copy.gatilhos[0].ativo,false);assert.notEqual(copy.gatilhos[0].id,'trigger');assert.equal(copy.blocks.length,3);
  const [a,b,c]=copy.blocks;assert.equal(copy.startBlockId,a.id);assert.equal(a.nextBlockId,b.id);assert.equal(a.falseNextBlockId,c.id);assert.equal(a.condicoes[0].nextBlockId,b.id);assert.equal(a.condicoes[0].campo,'customer-field');assert.equal(b.pausas[0].nextBlockId,c.id);assert.equal(b.roleta[0].nextBlockId,a.id);assert.equal(b.validacaoRegras[0].nextBlockId,c.id);assert.equal(c.webhookErrorNextBlockId,a.id);assert.equal(c.url,original.blocks[2].url);
  for(const block of copy.blocks)assert(!['a','b','c'].includes(block.id));
  await api('syncSalesbotFromLocal',{bot:{id:'original',nome:'Renomeado',blocks:original.blocks}});assert.equal(app.store.get(auth.workspaceId).bots.find(b=>b.id==='original').isActive,true);
  await api('syncSalesbotFromLocal',{bot:{id:'original',blocks:original.blocks},isActive:false});assert.equal(app.store.get(auth.workspaceId).bots.find(b=>b.id==='original').isActive,false);
  const reopened=new Store(dir,master);try{assert.equal(reopened.get(auth.workspaceId).bots.find(b=>b.id===copy.id).blocks[2].webhookErrorNextBlockId,a.id);}finally{reopened.close();}
  // Reproduce the old regression with exactly the same real central and server.
  reads.length=0;vm.runInContext(transformSync(code.replace('revision: 0, // A cópia ainda não existe no servidor.','revision: source.revision,'),{loader:'ts',target:'es2022'}).code,ctx);await ctx.duplicateBot(ctx.bots[0],'Regression');assert.equal(errors.length,1);assert.equal(reads.length,2);assert.notEqual(reads[1],'original');assert.equal(app.store.get(auth.workspaceId).bots.length,2);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
