import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,existsSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';import vm from 'node:vm';
import {createApp} from '../src/server.mjs';import {beginRecording,recordingPart,finishRecording,purgeRecordingUploads,listRecordings} from '../src/recordings.mjs';
for(const finish of [false,true])test((finish?'finished':'expired')+' recording keeps unexpected remaining files without crashing cleanup',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-cleanup-')),app=createApp({dir,master:'d'.repeat(64),bootstrap:'cleanup'}),ws='test-workspace',id=randomUUID(),bytes=Buffer.from([0x1a,0x45,0xdf,0xa3,1,2,3]);
 try{
  const upload=beginRecording(app.store,ws,{id,parts:1,bytes:bytes.length,mime:'video/webm',meta:{title:'Recording',transcript:'Keep the transcript'}});
  recordingPart(app.store,ws,upload.uploadId,0,{base64:bytes.toString('base64')});
  const unexpected=join(dir,'recording-uploads',upload.uploadId,'.nfs-open-file');writeFileSync(unexpected,'preserved');
  if(finish)assert.equal(finishRecording(app.store,ws,upload.uploadId).id,id);
  else {app.store.run('UPDATE recording_uploads SET created_at=0');assert.doesNotThrow(()=>purgeRecordingUploads(app.store));}
  assert.equal(readFileSync(unexpected,'utf8'),'preserved');assert.equal(existsSync(join(dir,'recording-uploads',upload.uploadId,'0')),false);
  assert.equal(app.store.all('SELECT * FROM recording_uploads').length,0);
  assert.equal(listRecordings(app.store,ws)[0].transcript,'Keep the transcript');
  assert.doesNotThrow(()=>purgeRecordingUploads(app.store));
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('a maintenance error is isolated and cannot terminate the timer or skip the other cleanup',()=>{
 const source=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8'),start=source.indexOf('const cleanup=setInterval('),end=source.indexOf('cleanup.unref()',start),calls=[],errors=[];
 const ctx=vm.createContext({app:{store:{}},setInterval:fn=>{fn();return {};},purgeExpired:()=>{throw Object.assign(Error('Sensitive path'),{code:'EACCES'});},purgeRecordingUploads:()=>calls.push('uploads'),console:{error:x=>errors.push(JSON.parse(x))}});
 assert.doesNotThrow(()=>vm.runInContext(source.slice(start,end),ctx));assert.deepEqual(calls,['uploads']);assert.equal(errors[0].code,'EACCES');assert(!JSON.stringify(errors).includes('Sensitive path'));
});
