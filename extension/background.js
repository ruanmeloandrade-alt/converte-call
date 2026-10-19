'use strict';
importScripts('credential-vault.js','internal-config.js','core.js','core-v4.js','notification-catalog.js','notification-center.js','call-fields.js','services.js','portal-services.js','cloud-sync.js');
let creating;
async function normalHost(){const win=await chrome.windows.getLastFocused({windowTypes:['normal']});return (await chrome.tabs.query({active:true,windowId:win.id}))[0];}
async function openFloating(kind){if(!['hud','dock'].includes(kind))throw Error('Janela inválida.');const key='ccFloating:'+kind,existing=(await chrome.storage.session.get(key))[key];if(existing){try{await chrome.windows.update(existing,{focused:true,state:'normal'});return {ok:true,windowId:existing};}catch{await chrome.storage.session.remove(key);}}const host=await normalHost(),popup=await chrome.windows.create({type:'popup',url:chrome.runtime.getURL('floating.html')+'#kind='+kind,width:kind==='dock'?460:380,height:kind==='dock'?170:360,focused:true});await chrome.storage.session.set({[key]:popup.id});if(host?.id)await chrome.tabs.sendMessage(host.id,{channel:'cc',type:'surface-detached',kind}).catch(()=>{});return {ok:true,windowId:popup.id};}
async function engine(){
 const url=chrome.runtime.getURL('offscreen.html');
 if((await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[url]})).length)return;
 if(!creating)creating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA','DISPLAY_MEDIA','BLOBS'],justification:'Gravar mídia autorizada pelo usuário, salvar segmentos locais e preparar download.'}).finally(()=>creating=null);
 await creating;
}
async function recorderContext(){return (await chrome.runtime.getContexts({documentUrls:[chrome.runtime.getURL('recorder.html')]}))[0];}
async function media(message){const context=await recorderContext();if(context)return chrome.runtime.sendMessage({...message,target:'media-engine',owner:'window'});await engine();return chrome.runtime.sendMessage({...message,target:'media-engine',owner:'offscreen'});}
async function openRecorder(sender){const context=await recorderContext();if(context){if(context.tabId>=0){const tab=await chrome.tabs.get(context.tabId);await chrome.windows.update(tab.windowId,{focused:true,state:'normal'});}return {ok:true};}const off=(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']}))[0];if(off){const r=await chrome.runtime.sendMessage({target:'media-engine',owner:'offscreen',type:'status'});if(r?.recording)throw Error('Finalize a gravação ativa antes de abrir outra.');await chrome.offscreen.closeDocument();}if(sender.tab?.id)await chrome.storage.session.set({ccRecorderHostTab:sender.tab.id});await chrome.windows.create({type:'popup',url:chrome.runtime.getURL('recorder.html'),width:550,height:780,focused:true});return {ok:true};}

const downloads=new Map();
chrome.downloads.onChanged.addListener(delta=>{if(['complete','interrupted'].includes(delta.state?.current)&&downloads.has(delta.id)){const token=downloads.get(delta.id);downloads.delete(delta.id);media({type:'release-url',token}).catch(()=>{});}});
async function notify(){for(const tab of await chrome.tabs.query({})){if(tab.id)chrome.tabs.sendMessage(tab.id,{channel:'cc',type:'state-changed'}).catch(()=>{});}}
async function downloadRecording(id){const result=await media({type:'media-url',id});if(!result.ok)throw Error(result.error);try{const downloadId=await chrome.downloads.download({url:result.url,filename:'Converte Call/'+result.filename,saveAs:false});downloads.set(downloadId,result.token);return {ok:true,downloadId};}catch(e){await media({type:'release-url',token:result.token});throw e;}}
async function handle(m,sender){
 if(m.type==='open-floating')return openFloating(m.kind);
 if(m.type==='floating-action'&&sender.url?.startsWith(chrome.runtime.getURL('floating.html'))){const tab=await normalHost();if(!tab)throw Error('Abra uma janela normal do navegador.');if(m.action==='record')return openRecorder({tab});if(m.action==='inbox'){const access=await handle({type:'open-inbox'},sender);if(!access.employee)return access;m.action='employee-inbox';}if(!['home','pipeline','orders','tracking','calls','employee-inbox'].includes(m.action))throw Error('Módulo inválido.');await chrome.storage.session.set({ccSurfaceState:{enabled:true,mode:'crm',view:m.action}});await chrome.windows.update(tab.windowId,{focused:true});await chrome.tabs.update(tab.id,{active:true});queueSurfaceFollow(tab.id,tab.windowId);return {ok:true};}
 if(m.type==='surface-location'&&sender.tab){const active=(await chrome.tabs.query({active:true,windowId:sender.tab.windowId}))[0];if(active?.id!==sender.tab.id||!(await chrome.windows.get(sender.tab.windowId)).focused)return {ok:false};await chrome.storage.session.set({ccSurfaceState:{enabled:true,mode:['crm','surface','dock','inbox'].includes(m.mode)?m.mode:'dock',view:String(m.view||'home').slice(0,80)}});return {ok:true};}
 if(m.type==='surface-ready'&&sender.tab){const sourceWindow=await chrome.windows.get(sender.tab.windowId);if(!sender.tab.active||!sourceWindow.focused||sourceWindow.type!=='normal')return {ok:true,suspended:true};let state=(await chrome.storage.session.get('ccSurfaceState')).ccSurfaceState;if(!state){const active=(await chrome.tabs.query({active:true,windowId:sender.tab.windowId}))[0];if(active?.id!==sender.tab.id)return {ok:true,suspended:true};state={enabled:true,mode:/^https:\/\/(meet\.google\.com|[^/]*\.zoom\.us)\//.test(sender.tab.url||'')?'surface':'dock',view:'hud'};await chrome.storage.session.set({ccSurfaceState:state});}queueSurfaceFollow(sender.tab.id,sender.tab.windowId);return {ok:true};}
 if(m.type==='open-recorder')return openRecorder(sender);
 if(m.type==='open-academy-lesson'){
  const content=await CCPortal.request('/v1/academy'),lesson=content.lessons?.find(item=>item.id===m.id);
  if(!lesson||!/^[-\w]{11}$/.test(lesson.videoId||''))throw Error('Aula não disponível para sua conta.');
  await chrome.storage.session.set({ccSurfaceState:{enabled:true,mode:'lesson',view:'academy',lesson:{id:lesson.id,title:String(lesson.title||'Sua aula').slice(0,160),videoId:lesson.videoId}}});
  await chrome.tabs.create({url:'https://www.youtube.com/watch?v='+lesson.videoId,active:true});return {ok:true};
 }
 if(m.type==='capture-engine-started'){const recordingContext=await recorderContext();if(recordingContext?.tabId>=0){const recordingTab=await chrome.tabs.get(recordingContext.tabId);await chrome.windows.update(recordingTab.windowId,{state:'minimized'});}const host=(await chrome.storage.session.get('ccRecorderHostTab')).ccRecorderHostTab;if(host){await chrome.tabs.update(host,{active:true}).catch(()=>{});await chrome.tabs.sendMessage(host,{channel:'cc',type:'open',view:'hud'}).catch(()=>{});}await notify();return {ok:true};}
 const portal=await CCPortal.handle(m,sender);if(portal!==undefined)return portal;
 const service=await CCServices.handle(m,sender);if(service!==undefined)return service;
 if(m.type==='native-inbox-access'){if(!sender.url?.startsWith('https://web.whatsapp.com/'))throw Error('Abra o WhatsApp Web.');const identity=await CCPortal.request('/v1/account/license');return {ok:true,owner:identity.membership?.role==='owner'};}
 if(m.type==='open-inbox'){
  const identity=await CCPortal.request('/v1/account/license');if(identity.membership?.role==='member'){if(!identity.membership.permissions.includes('inbox'))throw Error('Seu usuário não tem acesso ao Inbox.');return {ok:true,employee:true};}
  await chrome.storage.session.set({ccSurfaceState:{enabled:true,mode:'inbox',view:'employee-inbox'}});
  const tabs=await chrome.tabs.query({url:'https://web.whatsapp.com/*'});const tab=tabs[0]||await chrome.tabs.create({url:'https://web.whatsapp.com/'});
  await chrome.tabs.update(tab.id,{active:true});if(tab.windowId)await chrome.windows.update(tab.windowId,{focused:true});return {ok:true};
 }
 if(m.type==='capture-prepare')return media({type:'status'});
 if(m.type==='capture-start'){
  const current=await media({type:'status'});if(current.recording||current.starting)return {ok:false,error:'Já existe uma gravação ativa. Encerre antes de iniciar outra.'};
  const options=m.options||{};
  const result=await media({type:'start',options});if(result.ok)await notify();return result;
 }
 if(m.type==='capture-status')return media({type:'status'});
 if(m.type==='capture-pause'||m.type==='capture-resume')return media({type:m.type==='capture-pause'?'pause':'resume'});
 if(m.type==='capture-stop'){const r=await media({type:'stop'});if(r.ok&&r.id){try{r.download=await downloadRecording(r.id);}catch(e){r.downloadError=e.message;}}if(r.ok&&r.id)await CCNotification.emit({category:'recording',key:'recording:'+r.id,title:'Gravação salva',message:'Sua call está no histórico de gravações.',entityId:r.id,view:'calls'});await notify();return r;}
 if(m.type==='recording-cloud-sync')return media({type:'cloud-sync',id:m.id});
 if(m.type==='transcript-download'&&sender.url?.startsWith(chrome.runtime.getURL(''))){if(!String(m.url).startsWith('blob:'+chrome.runtime.getURL('')))throw Error('Arquivo de transcrição inválido.');return {ok:true,downloadId:await chrome.downloads.download({url:m.url,filename:'Converte Call/'+String(m.filename).replace(/[\\/:*?"<>|\x00-\x1f]/g,'-'),saveAs:false})};}
 if(m.type==='recording-analyse')return media({type:'analyse',id:m.id,contentType:m.contentType});
 if(m.type==='recordings-list')return media({type:'list'});
 if(m.type==='recording-url')return media({type:'media-url',id:m.id});
 if(m.type==='recording-release')return media({type:'release-url',token:m.token});
 if(m.type==='recording-download')return downloadRecording(m.id);
 if(m.type==='recording-delete')return media({type:'delete',id:m.id});
 if(m.type==='call-event'){const r=await media({type:'event',event:m.event});if(r.ok&&m.event?.type==='branch'){const state=await media({type:'status'});try{await CCServices.handle({type:'call-node-action',meta:state.meta,nodeId:m.event.nodeId,entryKey:state.meta.events.length},{url:chrome.runtime.getURL('recorder.html')});}catch(e){await media({type:'event',event:{type:'action-error',text:e.message}});r.warning=e.message;}}return r;}
 if(m.type==='open-mic-permission'){await chrome.windows.create({type:'popup',url:chrome.runtime.getURL('microphone.html'),width:450,height:440});return {ok:true};}
 if(m.type==='engine-ended'){if(m.id){await CCNotification.emit({category:'recording',key:'recording:'+m.id,title:'Gravação salva',message:'Sua call está no histórico de gravações.',entityId:m.id,view:'calls'});try{await downloadRecording(m.id);}catch{}}await notify();return {ok:true};}
 if(m.type==='workspace-changed'){CCCloudSync.sync();await notify();return {ok:true};}
 if(m.type==='show-surface'&&sender.tab){await chrome.tabs.sendMessage(sender.tab.id,{channel:'cc',type:'open',view:m.view});return {ok:true};}
 return {ok:false,error:'Ação desconhecida.'};
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(sender.id!==chrome.runtime.id||m?.target==='media-engine'||!m?.channel||m.channel!=='cc')return;
 handle(m,sender).then(reply,e=>reply({ok:false,error:e.message||'Não foi possível concluir a ação.',status:Number.isInteger(e.status)?e.status:undefined}));return true;
});
chrome.action.onClicked.addListener(async tab=>{
 if(!tab.id)return;
 try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});await chrome.tabs.sendMessage(tab.id,{channel:'cc',type:'surface-toggle'});await chrome.action.setBadgeText({tabId:tab.id,text:''});}
 catch{await chrome.action.setBadgeBackgroundColor({tabId:tab.id,color:'#CA4962'});await chrome.action.setBadgeText({tabId:tab.id,text:'!'});await chrome.action.setTitle({tabId:tab.id,title:'Abra o WhatsApp Web, Meet ou outro site comum para usar os controles.'});}
});

let surfaceSwitch=Promise.resolve();
function queueSurfaceFollow(tabId,windowId){surfaceSwitch=surfaceSwitch.catch(()=>{}).then(()=>followActiveTab(tabId,windowId));}
async function followActiveTab(tabId,windowId){
 let state=(await chrome.storage.session.get('ccSurfaceState')).ccSurfaceState;
 if(!state?.enabled)return;
 const win=await chrome.windows.get(windowId);if(win.type!=='normal'||!win.focused)return;
 const active=(await chrome.tabs.query({active:true,windowId}))[0];if(active?.id!==tabId)return;
 const tab=await chrome.tabs.get(tabId);
 for(const other of await chrome.tabs.query({}))if(other.id!==tabId)await chrome.tabs.sendMessage(other.id,{channel:'cc',type:'surface-suspend'}).catch(()=>{});
 // Chrome blocks injection into internal pages, its store and other extensions.
 if(!/^https?:/.test(tab.url||''))return;
 try{await chrome.tabs.sendMessage(tabId,{channel:'cc',type:'surface-ping'});}catch{try{await chrome.scripting.executeScript({target:{tabId},files:['content.js']});}catch{return;}}
 const latest=(await chrome.tabs.query({active:true,windowId}))[0];if(latest?.id!==tabId||!(await chrome.windows.get(windowId)).focused)return;
 state=(await chrome.storage.session.get('ccSurfaceState')).ccSurfaceState;
 const target=new URL(tab.url);if(['checkout.stripe.com','billing.stripe.com'].includes(target.hostname)||(['convertecall.pro','pay.convertecall.pro'].includes(target.hostname)&&/^\/(checkout|account\/assinatura)/.test(target.pathname)))state={...state,mode:'dock'};
 const floating=await chrome.storage.session.get(['ccFloating:hud','ccFloating:dock']);if(floating['ccFloating:hud']&&state.mode==='surface'&&state.view==='hud')state={...state,mode:'dock'};
 await chrome.tabs.sendMessage(tabId,{channel:'cc',type:'surface-restore',state,detachedDock:!!floating['ccFloating:dock']}).catch(()=>{});
}
chrome.tabs.onActivated.addListener(({tabId,windowId})=>queueSurfaceFollow(tabId,windowId));
chrome.tabs.onUpdated.addListener((tabId,change,tab)=>{if(change.status==='complete'&&tab.active)queueSurfaceFollow(tabId,tab.windowId);});
chrome.windows.onFocusChanged.addListener(async windowId=>{if(windowId<0)return;try{const tab=(await chrome.tabs.query({active:true,windowId}))[0];if(tab)queueSurfaceFollow(tab.id,windowId);}catch{}});
chrome.windows.onRemoved.addListener(async id=>{for(const kind of ['hud','dock']){const key='ccFloating:'+kind;if((await chrome.storage.session.get(key))[key]===id)await chrome.storage.session.remove(key);}try{const tab=await normalHost();if(tab)queueSurfaceFollow(tab.id,tab.windowId);}catch{}});
