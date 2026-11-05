import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/database.mjs';
import {installInboxData} from '../src/inbox-data.mjs';
import {rpc} from '../src/rpc.mjs';

test('funnel search returns matching inbound history for the requested funnel and workspace',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-funnel-search-')),store=new Store(dir,'a'.repeat(64));
 try {
  installInboxData(store);
  const ws=store.createWorkspace(),otherWs=store.createWorkspace();
  const funnel=store.get(ws).funnels[0];
  store.mutate(ws,d=>d.leads.push(...['received','outgoing','other-account'].map(id=>({id,name:id,funnelId:funnel.id,stage:funnel.stages[0].name}))));
  function message(workspace,leadId,direction,text){
   const event={id:leadId,type:'message',leadId,direction,text,at:'2026-01-01T00:00:00.000Z'};
   store.run('INSERT INTO inbox_messages(workspace_id,id,lead_id,occurred_at,payload) VALUES(?,?,?,?,?)',workspace,event.id,leadId,event.at,store.vault.seal(event));
  }
  message(ws,'received','in','Quero uma cotação');
  message(ws,'outgoing','out','Segue a cotação');
  message(otherWs,'other-account','in','Quero uma cotação');
  const search=funnelId=>rpc(store,ws,'@/lib/crm.functions','listFunnels',{data:{funnelId,messageQuery:'COTACAO'}});
  assert.deepEqual((await search(funnel.id)).matchingLeadIds,['received']);
  assert.deepEqual((await search('unknown')).matchingLeadIds,[]);
 } finally {
  store.db.close();
  rmSync(dir,{recursive:true,force:true});
 }
});
