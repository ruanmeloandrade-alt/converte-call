// Local-only manual IAB harness. Browser APIs and provider responses are controlled;
// packaged DOM, WebM encoding, capture engine, AI adapters and history API are real.
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../../src/server.mjs';
import {saveProvider,providerTranscribe,providerText} from '../../src/ai.mjs';
import {backgroundFixture} from '../surface-placement.test.mjs';
const root=resolve('.'),app=createApp({dir:mkdtempSync(join(tmpdir(),'cc-iab-')),master:'d'.repeat(64),bootstrap:'iab'});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const api='http://127.0.0.1:'+app.server.address().port;
async function call(path,body,token){const r=await fetch(api+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error(j.error?.message||JSON.stringify(j));return j;}
const owner=await call('/v1/auth/bootstrap',{token:'iab',email:'iab@example.com',password:'Isolated-browser-test-2026'});
saveProvider(app.store,owner.workspaceId,{provider:'openai',apiKey:'sk-isolated-browser-fixture'});
let phrase=0;const proof={audio:[],requests:[],errors:[]};
const provider={fetcher:async(url,options)=>{
 if(url.endsWith('/transcriptions')){const bytes=Buffer.from(await options.body.get('file').arrayBuffer());if(bytes.subarray(0,4).toString('hex')!=='1a45dfa3'||bytes.length<100)throw Error('Invalid WebM');proof.audio.push(bytes.length);return Response.json({text:++phrase%2?'Preciso entender como funciona o suporte durante a instalação.':'O valor está alto, só consigo começar no próximo mês.'});}
 const input=JSON.parse(JSON.parse(options.body).input);proof.requests.push(input);
 const text=input.latestUtterance||'',quote=text.includes('próximo mês')?'só consigo começar no próximo mês':'como funciona o suporte durante a instalação';
 return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({ready:true,clientQuote:quote,suggestion:quote.includes('próximo')?'O que precisaria estar resolvido para começarmos no próximo mês?':'Posso te mostrar como você recebe suporte durante a instalação.',reason:'Resposta à última fala reconhecida.',nextNode:null})}]}]});
}};
const fixtures=new Map(['chrome','edge','firefox'].map(platform=>[platform,backgroundFixture('../build/extensions/'+platform+'/')]));
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'};
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost'),platform=u.searchParams.get('platform')||'chrome',f=fixtures.get(platform);if(!f)throw Error('Unknown platform');
 res.setHeader('Cache-Control','no-store');
 if(u.pathname.startsWith('/extension/')){const file=u.pathname.slice(11);if(!/^[\w./-]+$/.test(file)||file.includes('..'))throw Error('Invalid path');res.setHeader('Content-Type',mime['.'+file.split('.').at(-1)]||'application/octet-stream');let bytes=readFileSync(join(root,'build/extensions',platform,file));if(file==='offscreen.js')bytes=bytes.toString().replace(/\bstate\(\)/g,'captureState()');if(file==='content.js')bytes=bytes.toString().replaceAll('mode:"closed"','mode:"open"');res.end(bytes);return;}
 if(u.pathname==='/api'){
  let body='';for await(const chunk of req)body+=chunk;const m=JSON.parse(body);let result;
  if(m.type==='workspace')result={converteCallWorkspace:{...(await call('/v1/workspace',null,owner.accessToken)).workspace,providers:{ai:'openai'}}};
  else if(m.type==='portal-ai-transcribe')result={ok:true,...await providerTranscribe(app.store,owner.workspaceId,m.input,provider)};
  else if(m.type==='portal-ai-text')result={ok:true,...await providerText(app.store,owner.workspaceId,m.input,provider)};
  else if(m.type==='call-analysis-commit'){await call('/v1/calls/actions',m,owner.accessToken);result={ok:true};}
  else if(m.type==='proof')result=proof;
  else if(m.type==='capture-status')result={ok:true,recording:false};
  else if(m.type==='activate'){f.focus(m.tab);await f.follow(m.tab);result={ok:true};}
  else if(m.type==='restore'){f.focus(m.tab);await f.listeners.action(f.tabs[m.tab-1]);result={ok:true};}
  else if(m.type==='commands'){result=f.messages.filter(x=>x.id===m.tab);f.messages.splice(0,f.messages.length,...f.messages.filter(x=>x.id!==m.tab));}
  else result=await f.handle(m,m.tab||1);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
 }
 const shim=`const platform=${JSON.stringify(platform)};async function request(m){const r=await fetch('/api?platform='+platform,{method:'POST',body:JSON.stringify(m)});const j=await r.json();if(j.error&&!j.ok)throw Error(j.error);return j;}let stored={};const listeners=[];window.chrome={runtime:{id:'fixture',getURL:p=>location.origin+'/extension/'+p+'?platform='+platform,onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:m=>request({...m,tab:Number(location.pathname.split('/').pop())||1})},storage:{onChanged:{addListener(){}},local:{get:async key=>{if(key==='converteCallWorkspace'){stored=await request({type:'workspace'});return stored;}return {[key]:stored[key]};},set:async x=>Object.assign(stored,x)}}};`;
 if(u.pathname.startsWith('/dock/')){
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><title>Menu ${platform}</title><style>body{font:17px Arial;background:#f5f5fa;color:#242137;padding:55px}button,a{padding:12px;margin:8px}</style><h1>Converte Call · ${platform}</h1><p>Validação local: DOM do pacote; APIs de abas controladas.</p><button id="activate">Ativar esta janela de teste</button><button id="restore">Reabrir pelo ícone da extensão</button><p>Use os botões da barra lateral para acompanhar abas e ocultar tudo.</p><script>${shim}document.querySelector('#activate').onclick=()=>request({type:'activate',tab:Number(location.pathname.split('/').pop())});document.querySelector('#restore').onclick=()=>request({type:'restore',tab:Number(location.pathname.split('/').pop())});setInterval(async()=>{for(const m of await request({type:'commands',tab:Number(location.pathname.split('/').pop())}))for(const fn of listeners)fn(m,{},()=>{});},120);</script><script src="/extension/content.js?platform=${platform}"></script>`);return;
 }
 res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><title>Copiloto ${platform} · validação interna</title><link rel="stylesheet" href="/extension/surface.css?platform=${platform}"><style>body{margin:30px;background:#f7f6fb;font:15px Arial;color:#242137}.tools{max-width:850px;margin:auto}button,select{padding:12px;margin:8px}#root{width:360px;margin:30px auto;background:white;border:1px solid #ddd;border-radius:20px;padding:10px}pre{white-space:pre-wrap}</style><section class="tools"><h1>Converte Call · ${platform}</h1><p>Captura WebM e histórico reais em ambiente local. Áudio de teste sintetizado; transcrição e respostas do provedor controladas. Sem microfone pessoal.</p><select id="purpose"><option value="call">Call sem workflow</option><option value="video">Vídeo com workflow</option></select><button id="start-test">Iniciar validação</button><button id="stop-test">Encerrar validação</button><pre id="result">Pronto.</pre></section><div id="root"></div><script>${shim}</script><script src="/extension/recording-analysis.js?platform=${platform}"></script><script src="/extension/ai-media.js?platform=${platform}"></script><script src="/extension/offscreen.js?platform=${platform}"></script><script>
 const root=document.querySelector('#root'),view='hud';let state={recording:false},busy=false,hudPath=[],headerHTML=()=>'',hud=()=>'';const hudNodes=()=>state.meta?.workflow||[],esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),formatTime=v=>Math.floor(v/1000)+'s',post=()=>{},send=()=>{},toast=()=>{};function render(){root.innerHTML=headerHTML()+hud();}
 let oscillator;document.querySelector('#start-test').onclick=async()=>{try{const purpose=document.querySelector('#purpose').value,ac=new AudioContext();await ac.resume();oscillator=ac.createOscillator();const out=ac.createMediaStreamDestination();oscillator.connect(out);oscillator.start();const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.getContext('2d').fillRect(0,0,640,360);const stream=canvas.captureStream(4);for(const track of out.stream.getAudioTracks())stream.addTrack(track);await start({mode:'video',mic:false,system:true,liveAI:true,contentType:purpose,workflow:purpose==='video'?[{id:'intro',name:'Apresentação',goal:'Explicar suporte'}]:[],workflowStart:purpose==='video'?'intro':null,title:'Validação '+platform},Promise.resolve(stream));document.querySelector('#result').textContent='Gravando áudio e vídeo de teste…';}catch(e){document.querySelector('#result').textContent=e.stack;}};
 document.querySelector('#stop-test').onclick=async()=>{if(active){stopLiveAI(active);const r=await stop();oscillator?.stop();document.querySelector('#result').textContent=JSON.stringify({saved:r.ok,bytes:r.meta?.bytes,advice:r.meta?.liveAdvice,proof:await request({type:'proof'})},null,2);}};
 setInterval(async()=>{state=await window.stateCapture();render();if(state.meta?.liveAdvice)document.querySelector('#result').textContent='Sugestão visível · '+state.meta.liveAdvice.sequence+' · '+state.meta.liveAdvice.suggestion;},250);window.stateCapture=()=>({recording:!!active,elapsed:elapsed(),meta:active?.meta});
 </script><script src="/extension/surface-controls.js?platform=${platform}"></script>`);
 }catch(e){proof.errors.push(e.message);res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,error:e.message}));}});
server.listen(4198,'127.0.0.1',()=>console.log('IAB harness: http://127.0.0.1:4198/dock/1?platform=chrome and /call?platform=chrome'));
