import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';import {Store} from '../src/database.mjs';import {Evolution} from '../src/evolution.mjs';import {Worker} from '../src/worker.mjs';import {uploadAsset} from '../src/assets.mjs';import {brainQuery,indexSource} from '../src/brain.mjs';
import {grantConnections} from '../src/connection-entitlements.mjs';
import {digest} from '../src/security.mjs';

test('legacy WhatsApp connection survives migration and the second slot stays separate',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-whatsapp-slots-')),store=new Store(dir,'4'.repeat(64));
 try{
  const ws=store.createWorkspace(),at=new Date().toISOString(),sent=[];
  const primary=store.vault.seal({hook:'legacy-hook',instanceKey:'legacy-key'});
  store.run('INSERT INTO instances(workspace_id,instance_name,hook_hash,credentials,status,phone,updated_at) VALUES(?,?,?,?,?,?,?)',ws,'legacy',digest('legacy-hook'),primary,'connected','5511999990000',at);
  const providerInstances=new Set(['legacy']);
  const evolution=new Evolution(store,{baseUrl:'https://evolution.example',key:'test-only',publicUrl:'https://app.example',fetcher:async(url,init)=>{
   const target=new URL(url);
   if(target.pathname.includes('/connectionState/'))return providerInstances.has(target.pathname.split('/').at(-1))?Response.json({instance:{state:'open'}}):Response.json({},{status:404});
   if(target.pathname==='/instance/create')providerInstances.add(JSON.parse(init.body).instanceName);
   if(target.pathname.startsWith('/message/sendText/'))sent.push({url:target.pathname,key:init.headers.apikey});
   return Response.json({ok:true});
  }});
  assert.equal(evolution.instance(ws).credentials,primary);
  assert.equal(evolution.instance(ws).phone,'5511999990000');
  await assert.rejects(evolution.connect(ws,2),error=>error.status===403);
  grantConnections(store,ws,2);
  await evolution.connect(ws,2);
  const second=evolution.instance(ws,2),credentials=store.vault.open(second.credentials);
  assert.notEqual(second.instance_name,'legacy');
  assert.deepEqual(evolution.connections(ws).map(row=>row.slot),[1,2]);
  assert.throws(()=>evolution.instance(ws,4),error=>error.status===400);
  await evolution.send(ws,'5511999999999','Mensagem de teste',2);
  assert.deepEqual(sent,[{url:'/message/sendText/'+second.instance_name,key:credentials.instanceKey}]);
  assert.throws(()=>evolution.receive(credentials.hook,{event:'connection.update',instance:'legacy'}),error=>error.status===401);
  evolution.receive(credentials.hook,{event:'connection.update',instance:second.instance_name,data:{state:'open',wuid:'5511999990001@s.whatsapp.net'}});
  assert.equal(evolution.instance(ws).phone,'5511999990000');
  assert.equal(evolution.instance(ws,2).phone,'5511999990001');
  const data={key:{id:'same-provider-id',remoteJid:'5511999999999@s.whatsapp.net'},message:{conversation:'Mensagem de teste'}};
  evolution.receive('legacy-hook',{event:'messages.upsert',instance:'legacy',data});
  evolution.receive(credentials.hook,{event:'messages.upsert',instance:second.instance_name,data});
  const worker=new Worker(store,evolution);
  for(const row of store.all('SELECT * FROM inbound'))worker.receive(row);
  assert.deepEqual(store.get(ws).inboxEvents.map(row=>row.connectionSlot??1).sort(),[1,2]);
  assert.equal(store.all("SELECT * FROM jobs WHERE type='incoming'").length,2);
  assert.equal(new Evolution(store).instance(ws).instance_name,'legacy');
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('Evolution adapter reserves private instance and validates hook; native document path is retained',async()=>{const dir=mkdtempSync(join(tmpdir(),'evo-contract-')),store=new Store(dir,'3'.repeat(64)),ws=store.createWorkspace(),requests=[];let exists=false;const evo=new Evolution(store,{baseUrl:'https://evolution.example/',key:'TEST-ONLY-KEY',publicUrl:'https://converte.example/',fetcher:async(url,init)=>{requests.push({url:String(url),body:init.body?JSON.parse(init.body):null,key:init.headers.apikey});if(String(url).includes('/connectionState/'))return Response.json(exists?{instance:{state:'close'}}:{},{status:exists?200:404});if(String(url).endsWith('/instance/create')){exists=true;return Response.json({instance:{status:'created'}});}if(String(url).includes('/instance/connect/'))return Response.json({base64:'data:image/png;base64,TEST'});return Response.json({ok:true});}});try{const r=await evo.connect(ws);assert.equal(r.status,'waiting_qr');const created=requests.find(r=>r.url.endsWith('/instance/create'));assert(created.body.instanceName.startsWith('cc-'));assert.equal(created.body.integration,'WHATSAPP-BAILEYS');assert.equal(created.body.groupsIgnore,true);const hook=created.body.webhook.url.split('/').at(-1),instance=created.body.instanceName;assert(!requests.some(r=>r.url.includes('/delete')||r.url.includes('/logout')));assert.throws(()=>evo.receive(hook,{event:'messages.upsert',instance:'outro',data:{}}));const msg={event:'messages.upsert',instance,data:{key:{id:randomUUID(),remoteJid:'5511999999999@s.whatsapp.net',fromMe:false},pushName:'Contato de teste',message:{conversation:'Olá!'}}};evo.receive(hook,msg);evo.receive(hook,msg);assert.equal(store.one('SELECT COUNT(*) AS n FROM inbound').n,1);const worker=new Worker(store,evo);const row=store.one('SELECT * FROM inbound');worker.receive(row);worker.receive(row);assert.equal(store.get(ws).leads.length,1);assert.equal(store.all('SELECT * FROM events WHERE workspace_id=?',ws).length,2);const asset=uploadAsset(store,ws,{base64:Buffer.from('Documento verdadeiro de teste.').toString('base64'),name:'guia.txt',mime:'text/plain'}),path=ws+'/fonte-guia.txt';store.run('INSERT INTO asset_aliases VALUES(?,?,?)',ws,path,asset.path);const source=brainQuery(store,ws,{table:'ai_brain_sources',action:'insert',payload:{title:'Guia',source_type:'document',storage_path:path,file_name:'guia.txt'},filters:[]}).data[0];assert.equal(source.storage_path,path);await indexSource(store,ws,source.id);assert(store.one('SELECT text FROM rag_chunks WHERE source_id=?',source.id).text.includes('Documento verdadeiro'));assert(!JSON.stringify(store.get(ws)).includes('TEST-ONLY-KEY'));}finally{store.close();rmSync(dir,{recursive:true,force:true});}});
