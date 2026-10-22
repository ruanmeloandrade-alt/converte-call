import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

for(const platform of ['extension','build/extensions/chrome','build/extensions/edge','build/extensions/firefox']){
 for(const contentType of ['call','video'])test(platform+': '+contentType+' joins unfinished phrases and continues while cloud history is blocked',async()=>{
  let resolveHistory,index=0;const gate=new Promise(r=>resolveHistory=r),requests=[];
  const a={meta:{id:'call',liveAI:true,contentType,workflow:contentType==='video'?[{id:'intro',goal:'Explicar o produto'}]:[],workflowNode:contentType==='video'?'intro':undefined,events:[]}};
  class Recorder{constructor(){this.mimeType='audio/webm';this.state='inactive';}start(timeslice){assert.equal(timeslice,1000);this.state='recording';}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['audio'])});this.onstop();}}
  const ctx=vm.createContext({Blob,MediaRecorder:Recorder,MediaStream:class{},structuredClone,console,active:a,elapsed:()=>10000,put:async()=>{},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
   chrome:{storage:{local:{get:async()=>({converteCallWorkspace:{providers:{ai:'openai'}}})}},runtime:{sendMessage:async m=>{
    if(m.type==='call-analysis-commit'){await gate;return {ok:true};}
    if(m.type==='portal-ai-text'){const request=JSON.parse(m.input.input);requests.push(request);return {ok:true,text:JSON.stringify(requests.length===1?{ready:false,suggestion:'',conversationContext:'Objetivo: entender o suporte antes de contratar.'}:{ready:true,clientQuote:'preciso entender como funciona o suporte',suggestion:'Posso te mostrar como você recebe suporte durante a instalação.',nextNode:null})};}
    throw Error('Unexpected '+m.type);
   }}}});
  for(const file of ['recording-analysis.js','ai-media.js'])vm.runInContext(readFileSync(new URL('../'+platform+'/'+file,import.meta.url),'utf8'),ctx);
  ctx.words=async()=>++index===1?'Eu preciso entender':'como funciona o suporte.';
  vm.runInContext('transcribeBlob=words;startLiveAI(active,[{}]);active.live.recorder.stop();',ctx);
  try{
   for(let i=0;i<10&&requests.length<1;i++)await new Promise(r=>setImmediate(r));
   vm.runInContext('active.live.recorder.stop()',ctx);
   for(let i=0;i<10&&!a.meta.liveAdvice;i++)await new Promise(r=>setImmediate(r));
   assert.equal(requests.length,2,'second inference must not wait for cloud persistence');
   assert.match(requests[1].latestUtterance,/preciso entender como funciona/);
   assert.match(requests[1].conversationContext,/antes de contratar/);
   assert.match(requests[1].conversationOpening,/preciso entender/);
   assert.match(a.meta.liveAdvice.suggestion,/suporte/);
   assert.equal(requests[1].workflow.length,contentType==='video'?1:0);
  }finally{resolveHistory();await vm.runInContext('aiPipeline',ctx);}
 });
 test(platform+': media events close a ten-second segment even when background timers do not fire',async()=>{
  let clock=0,count=0,stops=0,transcriptions=0;const a={meta:{id:'call',liveAI:true,workflow:[],events:[]}};
  class Recorder{constructor(){this.mimeType='audio/webm';this.state='inactive';count++;}start(){this.state='recording';}stop(){stops++;this.state='inactive';this.ondataavailable({data:new Blob(['tail'])});this.onstop();}}
  class Audio{createMediaStreamSource(){return {connect(){}};}createAnalyser(){return {fftSize:1024,getFloatTimeDomainData(){throw Error('No timer samples in background');}};}}
  const ctx=vm.createContext({Blob,Float32Array,AudioContext:Audio,MediaRecorder:Recorder,MediaStream:class{},active:a,elapsed:()=>clock,put:async()=>{},transcription:async()=>{transcriptions++;return '';},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},chrome:{storage:{local:{get:async()=>({converteCallWorkspace:{providers:{ai:'openai'}}})}},runtime:{sendMessage:async()=>({ok:true,text:''})}}});
  for(const file of ['recording-analysis.js','ai-media.js'])vm.runInContext(readFileSync(new URL('../'+platform+'/'+file,import.meta.url),'utf8'),ctx);
  vm.runInContext('transcribeBlob=transcription;startLiveAI(active,[{}]);',ctx);
  clock=10000;vm.runInContext('active.live.recorder.ondataavailable({data:new Blob(["audio"])})',ctx);
  assert.equal(stops,1);assert.equal(count,2,'the next recording window starts without a foreground timer');
  await vm.runInContext('aiPipeline',ctx);
  assert.equal(transcriptions,1,'throttled VAD sampling must not discard recorded audio as silence');
 });
}
