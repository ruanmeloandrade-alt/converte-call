import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for(const [name,prefix] of [['source','../extension/'],...['chrome','edge','firefox'].map(n=>[n,'../build/extensions/'+n+'/'])]){
 test(name+': a call suggestion still appears after 10 seconds and before a slow history save',async()=>{
  let clock=0,finishHistory,latest={id:'call',transcript:'',segments:[]};const writes=[],requests=[];
  const gate=new Promise(resolve=>{finishHistory=resolve;});
  class Recorder{constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}}
  const a={meta:{id:'call',liveAI:true,contentType:'call',workflow:[],events:[]}};
  const ctx=vm.createContext({Blob,MediaRecorder:Recorder,MediaStream:class{},structuredClone,console,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},active:a,elapsed:()=>clock,put:async meta=>writes.push(structuredClone(meta)),chrome:{storage:{local:{get:async()=>({converteCallWorkspace:{providers:{ai:'openai'},analyses:[latest]}})}},runtime:{sendMessage:async m=>{
   if(m.type==='call-analysis-commit'){if(!m.next.suggestions)await gate;latest=structuredClone(m.next);return {ok:true};}
   if(m.type==='portal-ai-text'){requests.push(JSON.parse(m.input.input));clock=24000;return {ok:true,text:JSON.stringify({ready:true,clientQuote:'SO CONSIGO investir no mes que vem.',suggestion:'O que precisaria estar resolvido para começarmos no mês que vem?',nextNode:null})};}
   throw Error('Unexpected '+m.type);
  }}}});
  for(const file of ['recording-analysis.js','ai-media.js'])vm.runInContext(readFileSync(new URL(prefix+file,import.meta.url),'utf8'),ctx);
  vm.runInContext("transcribeBlob=async()=> 'So consigo investir no mes que vem';startLiveAI(active,[{}]);active.live.recorder.stop();",ctx);
  try{for(let i=0;i<5&&!a.meta.liveAdvice;i++)await new Promise(r=>setImmediate(r));assert(a.meta.liveAdvice,'history synchronization must not block the visible suggestion');assert.equal(requests.length,1);assert.equal(a.meta.liveAdvice.sourceEndMs,0);assert.match(a.meta.liveAdvice.suggestion,/mês que vem/);}
  finally{finishHistory();await vm.runInContext('aiPipeline',ctx);}
  assert.equal(latest.suggestions.length,1);assert.match(latest.transcript,/investir/);
 });
 test(name+': history failure cannot suppress a valid live suggestion',async()=>{
  const a={meta:{id:'call',liveAI:true,contentType:'call',workflow:[],events:[]}};
  class Recorder{constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}}
  const ctx=vm.createContext({Blob,MediaRecorder:Recorder,MediaStream:class{},structuredClone,console,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},active:a,elapsed:()=>12000,put:async()=>{},chrome:{storage:{local:{get:async()=>({converteCallWorkspace:{providers:{ai:'openai'}}})}},runtime:{sendMessage:async m=>m.type==='call-analysis-commit'?{ok:false,error:'Histórico indisponível'}:{ok:true,text:JSON.stringify({ready:true,clientQuote:'Preciso de suporte',suggestion:'Qual parte do atendimento mais precisa de suporte hoje?'})}}}});
  for(const file of ['recording-analysis.js','ai-media.js'])vm.runInContext(readFileSync(new URL(prefix+file,import.meta.url),'utf8'),ctx);
  vm.runInContext("transcribeBlob=async()=> 'Preciso de suporte';startLiveAI(active,[{}]);active.live.recorder.stop();",ctx);await vm.runInContext('aiPipeline',ctx);
  assert.match(a.meta.liveAdvice.suggestion,/suporte/);assert.equal(a.meta.liveHistoryError,'Histórico indisponível');
 });
 test(name+': call capture passes both voices to AI and reports missing audio',async()=>{
  for(const audio of [true,false]){
   const captured=[],sources=[],mixed={kind:'audio',id:'mixed'},mic={kind:'audio',id:'microphone'},shared={kind:'audio',id:'remote'},video={kind:'video',id:'screen'};
   class Stream{constructor(tracks){this.tracks=tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}getTracks(){return this.tracks;}}
   class Audio{async resume(){}createMediaStreamDestination(){return {stream:new Stream([mixed])};}createMediaStreamSource(stream){sources.push(...stream.getAudioTracks().map(t=>t.id));return {connect(){}};}}
   class Recorder{static isTypeSupported(){return true;}start(){}constructor(){this.state='inactive';}}
   const source=readFileSync(new URL(prefix+'offscreen.js',import.meta.url),'utf8'),start=source.indexOf('async function start('),end=source.indexOf('async function stop(',start);assert(start>=0&&end>start);
   const ctx=vm.createContext({structuredClone,crypto:{randomUUID:()=> 'call'},Date,MediaStream:Stream,MediaRecorder:Recorder,AudioContext:Audio,starting:false,active:null,put:async()=>{},aiSettings:async()=>({}),CCRecordingAnalysis:{kind:v=>v||'auto'},navigator:{mediaDevices:{getDisplayMedia:async()=>new Stream(audio?[video,shared]:[video]),getUserMedia:async()=>new Stream([mic])}},startLiveAI:(a,tracks,hint)=>captured.push({tracks,hint}),closeInputs(){},friendly:e=>e.message,state:()=>({})});
   vm.runInContext(source.slice(start,end),ctx);await vm.runInContext("start({mode:'"+(audio?'video':'screen')+"',system:true,mic:true,liveAI:true,workflow:[]})",ctx);
   if(audio){assert.equal(captured[0].tracks[0].id,'mixed');assert.equal(captured[0].hint,'mixed');assert.deepEqual(sources,['microphone','remote']);}
   else{assert.equal(captured.length,0);assert.match(vm.runInContext('active.meta.liveError',ctx),/áudio/);}
  }
 });
}
