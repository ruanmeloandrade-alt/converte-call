import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store,Core} from '../src/database.mjs';
import {installTeams} from '../src/teams.mjs';
import {SalesbotStore} from '../src/salesbot-store.mjs';

test('a bot stage update survives later tag writes and reopening storage',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-stage-save-'));
 let store=new Store(dir,'a'.repeat(64));installTeams(store);
 try{
  const ws=store.createWorkspace();let target;
  store.mutate(ws,d=>{const f=d.funnels[0];target=f.stages[1];d.leads.push({id:'lead-stage',name:'QA',funnelId:f.id,stage:f.stages[0].name,status:'open',custom:{}});});
  const adapter=new SalesbotStore(store,{instance:()=>null},ws);
  const result=await adapter.from('leads').update({stage_id:target.id}).eq('id','lead-stage');
  assert.equal(result.error,null);
  assert.equal(store.get(ws).leads[0].stage,target.name);
  const base=structuredClone(store.get(ws));
  for(const name of ['Venda realizada','Perdida']){
   const stage=store.get(ws).funnels[0].stages.find(s=>s.name===name);
   await adapter.from('leads').update({stage_id:stage.id}).eq('id','lead-stage');
   const saved=store.get(ws).leads[0];
   assert.equal(saved.stage,name);
   assert.equal(saved.status,name==='Perdida'?'lost':'won');
   assert(saved.stageEnteredAt);
  }
  // Editing an unrelated field from an old app snapshot must retain the bot move.
  const next=structuredClone(base),latest=store.get(ws);next.leads[0].name='Edited';
  Core.merge(base,next,latest);store.put(ws,latest);
  assert.equal(store.get(ws).leads[0].stage,'Perdida');
  await adapter.from('leads').update({stage_id:target.id}).eq('id','lead-stage');
  await adapter.from('leads').update({tags:['META ADS']}).eq('id','lead-stage');
  assert.equal(store.get(ws).leads[0].stage,target.name);
  store.close();store=new Store(dir,'a'.repeat(64));
  assert.equal(store.get(ws).leads[0].stage,target.name);
  assert.deepEqual(store.get(ws).leads[0].tags,['META ADS']);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
