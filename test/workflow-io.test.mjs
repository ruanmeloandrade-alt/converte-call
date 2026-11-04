import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const core = runInNewContext(
  ['core.js','core-v4.js'].map(name=>readFileSync(new URL('../extension/'+name,import.meta.url),'utf8')).join('\n')+'\nCCCore',
  {crypto:globalThis.crypto},
);
const original={id:'existing',name:'Case',purpose:'video',start:'a',nodes:[
  {id:'a',name:'Abertura',questions:'Fala',material:'Tela',edges:[{id:'edge',label:'Avançar',to:'b'}]},
  {id:'b',name:'Fechamento',returnTo:'a',edges:[]},
]};
test('adds an independent copy and preserves the connected script',()=>{
 const copy=core.importWorkflow(JSON.stringify(original));
 assert.notEqual(copy.id,original.id);
 assert.notEqual(copy.start,original.start);
 assert.equal(copy.start,copy.nodes[0].id);
 assert.equal(copy.nodes[0].edges[0].to,copy.nodes[1].id);
 assert.equal(copy.nodes[1].returnTo,copy.start);
 assert.equal(copy.nodes[0].questions,'Fala');
 assert.equal(copy.nodes[0].material,'Tela');
 assert.equal(core.importWorkflow(JSON.stringify(copy)).nodes.length,2);
});
test('rejects backup files, duplicate stages and invalid connections',()=>{
 assert.throws(()=>core.importWorkflow(JSON.stringify({workflows:[original]})),/individual/);
 assert.throws(()=>core.importWorkflow(JSON.stringify({...original,nodes:[original.nodes[0],original.nodes[0]]})),/duplicada/);
 assert.throws(()=>core.importWorkflow(JSON.stringify({...original,nodes:[original.nodes[0]]})),/Ligação/);
});
