'use strict';
const dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('converte-call-media',1);r.onupgradeneeded=()=>{r.result.createObjectStore('sessions',{keyPath:'id'});r.result.createObjectStore('chunks',{keyPath:['id','n']});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function tx(store,mode,run){const db=await dbPromise;return new Promise((resolve,reject)=>{const t=db.transaction(store,mode);let value;const r=run(t.objectStore(store));if(r){r.onsuccess=()=>{value=r.result;};}t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Falha ao salvar mídia.'));});}
const get=id=>tx('sessions','readonly',s=>s.get(id));const put=record=>tx('sessions','readwrite',s=>s.put(record));
let active=null;let starting=false;const urls=new Map();
const elapsed=()=>active?Date.now()-active.meta.startedAt-active.pausedMs-(active.pauseAt?Date.now()-active.pauseAt:0):0;
async function state(){return {ok:true,recording:!!active,starting,paused:!!active?.pauseAt,elapsed:elapsed(),meta:active?{...active.meta}:null};}
function closeInputs(a){stopLiveAI(a);for(const s of a.inputs)s.getTracks().forEach(t=>t.stop());a.audio?.close().catch(()=>{});}
function friendly(e){if(e.name==='NotAllowedError'||e.name==='PermissionDeniedError')return 'Permissão não concedida. Autorize o microfone nas configurações de gravação e tente novamente.';if(e.name==='NotFoundError')return 'Nenhum microfone foi encontrado. Conecte um dispositivo ou desative o microfone.';return e.message||'Não foi possível iniciar a gravação.';}
async function start(o,capturePromise=null){
 if(active||starting)throw Error('Já existe uma captura em preparação ou gravação.');starting=true;
 let phase='screen';
 const a={inputs:[],audio:null,queue:Promise.resolve(),n:0,bytes:0,pausedMs:0,pauseAt:0,stopping:null,writeError:null};
 try{
  
  let display=null,mic=null;const warnings=[];
  if(o.mode!=='audio'||o.system){display=await (capturePromise||navigator.mediaDevices.getDisplayMedia({video:true,audio:!!o.system,systemAudio:o.system?'include':'exclude',selfBrowserSurface:'exclude'}));a.inputs.push(display);}
  if(o.mic&&o.mode!=='screen'){phase='microphone';try{mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});a.inputs.push(mic);}catch(error){if(o.mode==='audio'&&!display?.getAudioTracks().length)throw error;warnings.push('Microfone indisponível: '+error.name+'. O arquivo não terá sua voz.');}}
  if(o.system&&o.mode!=='screen'&&!display?.getAudioTracks().length)warnings.push('A fonte escolhida não compartilhou áudio do computador. Para incluir a call, selecione uma aba e ative Compartilhar áudio.');
  if(o.liveAI)await aiSettings();
  const tracks=[];if(o.mode!=='audio'&&display)tracks.push(...display.getVideoTracks());
  const sources=[mic,...(o.system?[display]:[])].filter(s=>s?.getAudioTracks().length);
  if(o.mode!=='screen'&&sources.length){a.audio=new AudioContext();await a.audio.resume();const dest=a.audio.createMediaStreamDestination();for(const s of sources)a.audio.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(dest);tracks.push(...dest.stream.getAudioTracks());}
  if(!tracks.length)throw Error('Selecione pelo menos uma fonte de áudio ou vídeo.');
  const kind=tracks.some(t=>t.kind==='video')?'video':'audio';const candidates=kind==='video'?['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']:['audio/webm;codecs=opus','audio/webm'];const mimeType=candidates.find(s=>MediaRecorder.isTypeSupported(s));if(!mimeType)throw Error('O navegador não suporta gravação WebM.');
  a.meta={id:crypto.randomUUID(),title:String(o.title||'Call').slice(0,200),lead:o.lead||'',startedAt:Date.now(),created:new Date().toISOString(),mode:o.mode,workflow:Array.isArray(o.workflow)?structuredClone(o.workflow):[],mic:!!mic,system:!!display?.getAudioTracks().length,mimeType,status:'recording',bytes:0,events:[],workflowStep:0,workflowNode:o.workflowStart||o.workflow?.[0]?.id,liveAI:!!o.liveAI,warnings};
  a.recorder=new MediaRecorder(new MediaStream(tracks),{mimeType,videoBitsPerSecond:1800000});await put(a.meta);active=a;
  a.recorder.ondataavailable=e=>{if(e.data.size){const chunk={id:a.meta.id,n:a.n++,blob:e.data};a.bytes+=e.data.size;a.queue=a.queue.then(()=>tx('chunks','readwrite',s=>s.put(chunk))).catch(error=>{a.writeError=error;if(a.recorder.state!=='inactive')stop(false).catch(()=>{});});}};
  a.recorder.onerror=e=>{a.writeError=e.error||Error('Falha na gravação.');stop(false).catch(()=>{});};
  if(display)display.getVideoTracks()[0].onended=()=>{if(active===a&&!a.stopping)stop(true).catch(()=>{});};
  a.recorder.start(4000);startLiveAI(a,tracks.filter(t=>t.kind==='audio'));return state();
 }catch(e){closeInputs(a);if(active===a)active=null;if(e.name==='NotAllowedError'&&phase==='screen')throw Error('Captura cancelada ou compartilhamento não autorizado. Escolha a fonte e confirme Compartilhar.');throw Error(friendly(e));}finally{starting=false;}
}
async function stop(auto=false){
 const a=active;if(!a)return {ok:false,error:'Não há gravação ativa.'};if(a.stopping)return a.stopping;
 a.stopping=(async()=>{const duration=elapsed();await new Promise(resolve=>{if(a.recorder.state==='inactive')return resolve();a.recorder.addEventListener('stop',resolve,{once:true});a.recorder.stop();});await a.queue;closeInputs(a);a.meta={...a.meta,durationMs:duration,endedAt:Date.now(),bytes:a.bytes,status:a.writeError?'interrupted':'saved',error:a.writeError?.message||null};await put(a.meta);active=null;if(auto)chrome.runtime.sendMessage({channel:'cc',type:'engine-ended',id:a.meta.id}).catch(()=>{});return {ok:true,id:a.meta.id,meta:a.meta,error:a.writeError?'A gravação foi interrompida. Verifique os segmentos locais.':null};})();return a.stopping;
}
async function mediaURL(id){const record=await get(id);if(!record)throw Error('Gravação não encontrada.');if(active?.meta.id===id)throw Error('Encerre a gravação antes de baixar.');const chunks=(await tx('chunks','readonly',s=>s.getAll(IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER])))).sort((a,b)=>a.n-b.n);if(!chunks.length)throw Error('A gravação não possui segmentos salvos.');const blob=new Blob(chunks.map(c=>c.blob),{type:record.mimeType});const token=crypto.randomUUID(),url=URL.createObjectURL(blob);urls.set(token,url);const title=record.title.replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').slice(0,90)||'Call';return {ok:true,url,token,filename:title+'-'+record.id.slice(0,8)+'.webm'};}
async function handle(m){
 if(m.type==='analyse')return analyseRecording(m.id);
 if(m.type==='start')return start(m.options);
 if(m.type==='status')return state();
 if(m.type==='stop')return stop();
 if(m.type==='pause'){if(!active||active.recorder.state!=='recording')throw Error('Gravação não está em andamento.');active.recorder.pause();active.pauseAt=Date.now();pauseLiveAI(active);return state();}
 if(m.type==='resume'){if(!active||active.recorder.state!=='paused')throw Error('Gravação não está pausada.');active.pausedMs+=Date.now()-active.pauseAt;active.pauseAt=0;active.recorder.resume();return state();}
 if(m.type==='event'){if(!active)throw Error('Não há gravação ativa.');active.meta.events.push({timeMs:elapsed(),...m.event});if(m.event?.type==='branch'){active.meta.workflowNode=m.event.nodeId;active.meta.actionError='';}if(m.event?.type==='action-error')active.meta.actionError=m.event.text;if(m.event?.type==='workflow')active.meta.workflowStep=m.event.step;await put(active.meta);return {ok:true};}
 if(m.type==='list'){const rows=await tx('sessions','readonly',s=>s.getAll());return {ok:true,recordings:rows.map(r=>r.status==='recording'&&r.id!==active?.meta.id?{...r,status:'interrupted'}:r).sort((a,b)=>b.startedAt-a.startedAt)};}
 if(m.type==='media-url')return mediaURL(m.id);
 if(m.type==='release-url'){const u=urls.get(m.token);if(u)URL.revokeObjectURL(u);urls.delete(m.token);return {ok:true};}
 if(m.type==='delete'){if(m.id===active?.meta.id)throw Error('Encerre a gravação antes de excluir.');await tx('chunks','readwrite',s=>s.delete(IDBKeyRange.bound([m.id,0],[m.id,Number.MAX_SAFE_INTEGER])));await tx('sessions','readwrite',s=>s.delete(m.id));return {ok:true};}
 throw Error('Ação de mídia desconhecida.');
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(sender.id!==chrome.runtime.id||m?.target!=='media-engine'||m.owner!==(location.pathname.endsWith('/recorder.html')?'window':'offscreen'))return;handle(m).then(reply,e=>reply({ok:false,error:friendly(e)}));return true;});
