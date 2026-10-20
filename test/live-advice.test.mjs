import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import vm from'node:vm';
test('live call assistance produces and saves contextual advice with no workflow or client and survives optional field errors',async()=>{
 for(const withWorkflow of [false,true]){
  const persisted=[],writes=[],requests=[];let latest={id:'call',transcript:'',segments:[]};
  class Recorder{constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}}
  const a={meta:{id:'call',liveAI:true,contentType:'call',workflowPurpose:'call',workflow:withWorkflow?[{id:'node',captureEnabled:true}]:[],workflowNode:withWorkflow?'node':undefined,lead:withWorkflow?'client':'',events:[]}};
  const context=vm.createContext({Blob,MediaRecorder:Recorder,MediaStream:class{constructor(tracks){this.tracks=tracks;}},console,structuredClone,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},active:a,elapsed:()=>15000,put:async meta=>writes.push(structuredClone(meta)),chrome:{storage:{local:{get:async()=>({converteCallWorkspace:{providers:{ai:'openai'},analyses:[latest]}})}},runtime:{sendMessage:async m=>{if(m.type==='portal-ai-text'){requests.push(m.input);return {ok:true,text:JSON.stringify({ready:true,clientQuote:'melhorar seu atendimento',suggestion:'Qual é a sua prioridade para melhorar seu atendimento?',situation:'Dúvida do cliente',reason:'Aprofundar o contexto',nextNode:'invented'})};}if(m.type==='call-fields-sync')return {ok:false,error:'Campo indisponível'};if(m.type==='call-analysis-commit'){latest=structuredClone(m.next);persisted.push(latest);return {ok:true};}throw Error('Unexpected '+m.type);}}}});
  vm.runInContext(readFileSync(new URL('../extension/recording-analysis.js',import.meta.url),'utf8'),context);vm.runInContext(readFileSync(new URL('../extension/ai-media.js',import.meta.url),'utf8'),context);
  vm.runInContext("transcribeBlob=async()=> 'O cliente precisa melhorar seu atendimento.';parseCallJSON=JSON.parse;startLiveAI(active,[{}]);active.live.recorder.stop();",context);await vm.runInContext('aiPipeline',context);
  assert.equal(a.meta.livePhase,'listening');assert.match(a.meta.liveAdvice.suggestion,/prioridade/);assert.equal(a.meta.liveAdvice.nextNode,withWorkflow?'node':null);assert.equal(latest.suggestions.length,1);assert.match(requests[0].input,/cliente precisa/);assert.match(requests[0].instructions,/Sem workflow/);if(withWorkflow)assert.equal(a.meta.fieldExtractionError,'Campo indisponível');
 }
});
test('call audio uses 9-second intervals and ignores short clicks and silence',()=>{
 const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../extension/recording-analysis.js',import.meta.url),'utf8'),context);const policy=context.CCRecordingAnalysis;
 assert.equal(policy.liveTiming.maxMs,9000);assert.equal(policy.liveTiming.minMs,9000);
 const voice=Array(1024).fill(0.06),silence=Array(1024).fill(0),window=policy.speechWindow(0);
 for(let time=80;time<=800;time+=80)assert.equal(policy.sampleSpeech(window,voice,time),false);
 assert.equal(policy.sampleSpeech(window,silence,1280),false,'a short phrase does not shorten the requested interval');
 assert.equal(policy.sampleSpeech(window,silence,9000),true);
 const click=policy.speechWindow(0);policy.sampleSpeech(click,voice,80);policy.sampleSpeech(click,silence,9000);assert(click.voiceMs<policy.liveTiming.minVoiceMs);
 const continuous=policy.speechWindow(0);for(let time=80;time<9000;time+=80)assert.equal(policy.sampleSpeech(continuous,voice,time),false);assert.equal(policy.sampleSpeech(continuous,voice,9000),true);
 const quiet=policy.speechWindow(0);policy.sampleSpeech(quiet,silence,9000);assert.equal(quiet.hasSpeech,false);
});
test('only short direct speech grounded in the latest words becomes visible advice',()=>{
 const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../extension/recording-analysis.js',import.meta.url),'utf8'),context);const policy=context.CCRecordingAnalysis,latest='Está caro, só consigo investir no mês que vem';
 assert(policy.liveAdvice({ready:true,clientQuote:'só consigo investir no mês que vem',suggestion:'Entendi. O que pesa mais: o valor total ou começar no mês que vem?'},latest));
 for(const row of [{ready:false,clientQuote:'Está caro',suggestion:'Entendi.'},{ready:true,clientQuote:'Está caro',suggestion:'Explore a objeção e reforce os benefícios.'},{ready:true,clientQuote:'Tenho 10 funcionários',suggestion:'Qual seria o melhor início?'},{ready:true,suggestion:'Pergunte ao cliente qual é sua prioridade.'}])assert.equal(policy.liveAdvice(row,latest),null);
 const prompt=policy.liveInstructions('call');assert.match(prompt,/latestUtterance/);assert.match(prompt,/ready:false/);assert.match(prompt,/primeira pessoa/);assert.match(prompt,/Não repita previousSuggestion/);
 assert.match(policy.liveInstructions('lesson'),/videoaula/);
});
test('slow providers keep only the newest waiting audio segment and never publish after stop',async()=>{
 for(const stopDuringRequest of [false,true]){
  const requests=[],texts=[];let latest={id:'call',transcript:'',segments:[]},release;const gate=new Promise(r=>release=r);let clock=0,number=0;
  class Recorder{constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['Trecho '+(++number)+' do cliente'])});this.onstop?.();}}
  const a={meta:{id:'call',liveAI:true,contentType:'auto',workflowPurpose:'call',workflow:[],events:[]}};
  const context=vm.createContext({Blob,MediaRecorder:Recorder,MediaStream:class{},structuredClone,console,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},active:a,elapsed:()=>clock,put:async()=>{},chrome:{storage:{local:{get:async()=>({converteCallWorkspace:{providers:{ai:'openai'}}})}},runtime:{sendMessage:async m=>{if(m.type==='call-analysis-commit'){latest=structuredClone(m.next);return {ok:true};}if(m.type==='portal-ai-text'){requests.push(JSON.parse(m.input.input));const text=JSON.parse(m.input.input).latestUtterance;return {ok:true,text:JSON.stringify({ready:true,clientQuote:text,suggestion:'Como você gostaria de resolver '+text+'?',nextNode:null})};}throw Error('Unexpected '+m.type);}}},transcription:async blob=>{const text=await blob.text();texts.push(text);if(texts.length===1)await gate;return text;}});
  for(const file of ['recording-analysis.js','ai-media.js'])vm.runInContext(readFileSync(new URL('../extension/'+file,import.meta.url),'utf8'),context);
  vm.runInContext('transcribeBlob=transcription;startLiveAI(active,[{}]);active.live.recorder.stop();',context);await new Promise(r=>setImmediate(r));
  clock=2000;vm.runInContext('active.live.recorder.stop()',context);clock=4000;vm.runInContext('active.live.recorder.stop()',context);
  if(stopDuringRequest)vm.runInContext('stopLiveAI(active);active=null;',context);
  release();await vm.runInContext('aiPipeline',context);
  if(stopDuringRequest){assert.equal(a.meta.liveAdvice,undefined);assert.equal(requests.length,0);}else{assert.equal(texts.length,2);assert.match(texts[0],/Trecho 1/);assert.match(texts[1],/Trecho 3/);assert.match(a.meta.liveAdvice.clientQuote,/Trecho 3/);assert(requests.every(r=>r.recentConversation.length<=4000));assert.equal(requests[0].speakerHint,'mixed');}
 }
});
