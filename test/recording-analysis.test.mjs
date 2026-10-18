import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const policy=readFileSync(new URL('../extension/recording-analysis.js',import.meta.url),'utf8');
function context(){const c=vm.createContext({Blob,console,structuredClone});vm.runInContext(policy,c);return c;}
test('editorial reports retain evidenced cuts and derive timing only from captured segment windows',()=>{
 const p=context().CCRecordingAnalysis,quote='Vamos repetir este exemplo mais uma vez.';
 const raw={detectedType:'lesson',summary:'Aula sobre atendimento.',outline:['Introdução','Exemplo'],cuts:[{quote,reason:'Exemplo repetido',segmentIndex:0,startMs:999},{quote:'Frase que nunca foi dita.',reason:'Invenção'},{quote,reason:'Sem segmento',segmentIndex:8}]};
 const r=p.normalize(raw,{transcript:quote,segments:[{text:quote,startMs:1000,endMs:16000}],durationMs:30000});
 assert.equal(r.contentType,'lesson');assert.equal(r.cuts.length,2);assert.equal(r.cuts[0].startMs,1000);assert.equal(r.cuts[0].endMs,16000);assert.equal(r.cuts[1].startMs,undefined);
 const invalid=p.normalize(raw,{transcript:quote,segments:[{text:quote,startMs:1000,endMs:60000}],durationMs:30000});assert.equal(invalid.cuts[0].startMs,undefined);
 const corrected=p.normalize(raw,{requestedType:'call',transcript:quote});assert.equal(corrected.contentType,'call');assert.equal(corrected.cuts.length,0);
 assert.equal(p.normalize({...raw,detectedType:'unsupported'},{transcript:quote}).contentType,'unknown');
 assert.throws(()=>p.normalize({summary:''}),/estruturado/);
});
test('recording pipeline classifies solo lessons without extracting client fields and supports manual correction to a call',async()=>{
 const c=context(),record={id:'record',mode:'audio',mimeType:'audio/webm',contentType:'auto',durationMs:30000,lead:'lead',workflow:[]},saved={id:'record',transcript:'',segments:[]};let extraction=0,round=0;
 Object.assign(c,{active:null,get:async()=>record,tx:async()=>[],IDBKeyRange:{bound:()=>[]}});
 vm.runInContext(readFileSync(new URL('../extension/ai-media.js',import.meta.url),'utf8'),c);
 c.transcribeBlob=async()=> 'Vamos aprender a organizar o primeiro atendimento.';
 c.persistAnalysis=async(id,change)=>change(saved);
 c.aiSettings=async()=>({data:{analyses:[saved],customFields:[]}});
 c.textResponse=async(input,instructions)=>{round++;if(instructions.includes('Extraia somente'))return JSON.stringify({newFields:[]});return JSON.stringify({detectedType:'lesson',summary:'Treinamento de atendimento.',outline:['Abertura','Organização'],cuts:[]});};
 c.syncCallFields=async()=>{extraction++;};
 const result=await c.analyseRecording('record');assert.equal(result.contentType,'lesson');assert.equal(saved.contentType,'lesson');assert.equal(extraction,0);assert.equal(round,1);
 await c.analyseRecording('record','call');assert.equal(saved.requestedType,'call');assert.equal(saved.contentType,'call');assert.equal(extraction,1);
});
