import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {transformSync} from '../ui-source/node_modules/esbuild/lib/main.js';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';
import {uploadAsset} from '../src/assets.mjs';
import {digest} from '../src/security.mjs';

test('manual Inbox bot starts with triggers disabled, sends voice audio, preserves pause and returns activation proof',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-manual-audio-')),sent=[],app=createApp({dir,master:'a'.repeat(64),bootstrap:'manual-audio',evolutionOptions:{baseUrl:'https://evolution.example',key:'fixture',fetcher:async(url,options)=>{
  if(String(url).includes('connectionState'))return Response.json({instance:{state:'open'}});
  sent.push({url:String(url),body:JSON.parse(options.body)});return Response.json({key:{id:randomUUID()}});
 }}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const req=async(path,body,token,headers={})=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const auth=(await req('/v1/auth/bootstrap',{token:'manual-audio',email:'audio@example.test',password:'Fixture-audio-123'})).data,ws=auth.workspaceId,leadId=randomUUID(),botId=randomUUID();
  app.store.run('INSERT INTO instances(workspace_id,instance_name,hook_hash,credentials,status,updated_at) VALUES(?,?,?,?,?,?)',ws,'cc-audio','unused',app.store.vault.seal({instanceKey:'fixture-own-key'}),'connected',new Date().toISOString());
  const uploaded=await req('/v1/slim/rpc',{module:'@/lib/salesbots.functions',method:'uploadSalesbotMedia',data:{base64:Buffer.from('audio fixture bytes').toString('base64'),mimeType:'audio/mpeg',fileName:'voz.mp3',kind:'audio'}},auth.accessToken);assert.equal(uploaded.status,200);const asset=uploaded.data;assert.equal(asset.kind,'audio');assert.equal(asset.mime,'audio/mpeg');assert.equal(asset.fileName,'voz.mp3');
  // Reproduce uploads saved before the contract fix: path only, no metadata/alias.
  app.store.run('DELETE FROM asset_aliases WHERE workspace_id=?',ws);
  app.store.mutate(ws,d=>{d.leads.push({id:leadId,name:'Contato',phone:'5522991234567',funnelId:d.funnels[0].id,stage:d.funnels[0].stages[0].name,custom:{}});d.bots.push({id:botId,nome:'Novo Bot 3',isActive:false,revision:3,startBlockId:'voice',gatilhos:[{tipo:'mensagem',ativo:false}],blocks:[{id:'voice',kind:'enviar-mensagem',mediaItems:[{path:asset.path,asVoice:false}],nextBlockId:'pause'},{id:'pause',kind:'pausar',pausas:[{tipo:'msg-recebida',nextBlockId:'answer'}]},{id:'answer',kind:'enviar-mensagem',texto:'Depois da resposta'}]});});
  const payload={leadId,kind:'bot',assetId:botId},requestId=randomUUID();let reply=await req('/v1/whatsapp/dispatch',payload,auth.accessToken,{'Idempotency-Key':requestId});assert.equal(reply.status,200,JSON.stringify(reply.data));assert.equal(reply.data.status,'waiting');
  assert.equal(sent.length,1);assert.match(sent[0].url,/sendWhatsAppAudio/);assert.equal(sent[0].body.encoding,true);assert.match(sent[0].body.audio,/v1\/assets/);assert.equal(sent[0].body.mediatype,undefined);assert.equal(app.store.get(ws).bots[0].isActive,false);
  await req('/v1/whatsapp/dispatch',payload,auth.accessToken,{'Idempotency-Key':requestId});assert.equal(sent.length,1,'retry cannot send the audio twice');
  const pdf=await req('/v1/slim/rpc',{module:'@/lib/salesbots.functions',method:'uploadSalesbotMedia',data:{base64:Buffer.from('%PDF-1.4 fixture').toString('base64'),mimeType:'application/pdf',fileName:'proposta.pdf',kind:'document'}},auth.accessToken);assert.equal(pdf.data.kind,'document');const pdfBot=randomUUID();app.store.mutate(ws,d=>d.bots.push({id:pdfBot,nome:'PDF sem texto',isActive:false,startBlockId:'pdf',blocks:[{id:'pdf',kind:'enviar-mensagem',mediaItems:[{path:pdf.data.path,kind:pdf.data.kind,mime:pdf.data.mime,filename:pdf.data.fileName}]}]}));const document=await req('/v1/whatsapp/dispatch',{...payload,assetId:pdfBot},auth.accessToken,{'Idempotency-Key':randomUUID()});assert.equal(document.status,200,JSON.stringify(document.data));assert.match(sent[1].url,/sendMedia/);assert.equal(sent[1].body.mediatype,'document');assert.equal(sent[1].body.fileName,'proposta.pdf');
  const rpc=(method,data)=>req('/v1/slim/rpc',{module:'@/lib/salesbots.functions',method,data},auth.accessToken);
  reply=await rpc('setSalesbotActive',{localId:botId,isActive:true});assert.equal(reply.data.isActive,true);assert.equal(reply.data.revision,4);
  reply=await rpc('setSalesbotActive',{localId:botId,isActive:false});assert.equal(reply.data.isActive,false);assert.equal(reply.data.revision,5);
  const unchanged=JSON.stringify(app.store.get(ws).bots[0]);assert.equal((await rpc('setSalesbotActive',{localId:botId})).status,400);assert.equal(JSON.stringify(app.store.get(ws).bots[0]),unchanged);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('opening Inbox refreshes stale provider history without replaying bots and lists durable conversations beyond the recent cache',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-history-recovery-')),app=createApp({dir,master:'b'.repeat(64),bootstrap:'history-recovery'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const req=async(path,body,token)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const auth=(await req('/v1/auth/bootstrap',{token:'history-recovery',email:'history@example.test',password:'Fixture-history-123'})).data,ws=auth.workspaceId;
  app.store.run('INSERT INTO instances(workspace_id,instance_name,hook_hash,credentials,status,updated_at) VALUES(?,?,?,?,?,?)',ws,'cc-history','unused',app.store.vault.seal({instanceKey:'fixture'}),'connected',new Date().toISOString());
  app.store.run('INSERT INTO inbox_history_sync VALUES(?,?,?,0,NULL,?)',ws,1,'done',Date.now()-86400000);
  let pages=0;app.evolution.history=async()=>{pages++;return {messages:{pages:1,total:2,records:[{key:{id:'yesterday',remoteJid:'5522991234567@s.whatsapp.net',fromMe:false},pushName:'Contato histórico',messageTimestamp:Math.floor(Date.now()/1000)-86400,message:{conversation:'Mensagem de ontem'}},{key:{id:'today',remoteJid:'5522991234567@s.whatsapp.net',fromMe:true},messageTimestamp:Math.floor(Date.now()/1000),message:{conversation:'Mensagem de hoje'}}]}};};
  const rpc=(method,data={})=>req('/v1/slim/rpc',{module:'@/lib/leads.functions',method,data},auth.accessToken);
  assert.equal((await rpc('getInboxBootstrap')).status,200);await app.worker.tick();assert.equal(pages,1);assert.equal(app.store.one("SELECT count(*) AS n FROM jobs WHERE type='incoming'").n,0);
  const lead=app.store.get(ws).leads[0];assert(lead);app.store.mutate(ws,d=>{d.inboxEvents=[];});
  const list=await rpc('getInboxBootstrap');assert.equal(list.data.leadPage.conversations[0].lastMessagePreview,'Mensagem de hoje');assert.equal(list.data.leadPage.conversations[0].unreadCount,1);
  const activities=await rpc('listLeadActivities',{leadId:lead.id});assert.deepEqual(activities.data.activities.map(m=>m.text),['Mensagem de ontem','Mensagem de hoje']);
  await rpc('getInboxBootstrap');await app.worker.tick();assert.equal(pages,1,'frequent polling must not rescan history');
  assert.equal(app.store.all('SELECT * FROM inbox_messages WHERE workspace_id=?',ws).length,2);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});


test('actual bot recorder uploads microphone audio and exposes the existing authorization flow on denial; both frame levels delegate microphone',async()=>{
 const source=readFileSync(new URL('../ui-source/copied-source/components/automations/SalesbotBuilder.tsx',import.meta.url),'utf8'),begin=source.indexOf('async function startRecording()'),end=source.indexOf('useEffect(() => () => {',begin),errors=[],uploads=[];let stopped=0,recording=false,blocked=false;
 const context=vm.createContext({navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped++}]})}},MediaRecorder:class{static isTypeSupported(){return true;}constructor(){this.mimeType='audio/webm';this.state='inactive';}start(){this.state='recording';}stop(){this.ondataavailable({data:new Blob([new Uint8Array(1024)])});this.state='inactive';this.onstop();}},Blob,File,Error,setUploadError:e=>errors.push(e),setMicBlocked:v=>{blocked=v;},setRecording:v=>{recording=v;},recStreamRef:{current:null},recChunksRef:{current:[]},recorderRef:{current:null},handleFile:async(file,options)=>uploads.push({file,options})});
 vm.runInContext(transformSync(source.slice(begin,end),{loader:'ts',target:'es2022'}).code,context);await context.startRecording();assert.equal(recording,true);context.stopRecording();assert.equal(recording,false);assert.equal(stopped,1);assert.equal(uploads.length,1);assert.equal(uploads[0].file.type,'audio/webm');assert.equal(uploads[0].options.asVoice,true);
 context.navigator.mediaDevices.getUserMedia=async()=>{const e=new Error('Permission denied');e.name='NotAllowedError';throw e;};await context.startRecording();assert.equal(blocked,true);assert.match(errors.at(-1),/Autorize o acesso/);assert(source.includes('type:"open-mic-permission"'));
 for(const browser of ['extension','build/extensions/chrome','build/extensions/edge','build/extensions/firefox'])for(const file of ['content.js','v5.js']){const frame=readFileSync(new URL('../'+browser+'/'+file,import.meta.url),'utf8');assert.match(frame,/microphone; clipboard-write/,browser+'/'+file);}
});
