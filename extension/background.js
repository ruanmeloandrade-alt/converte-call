'use strict';
importScripts('internal-config.js','core.js','core-v4.js','notification-catalog.js','notification-center.js','call-fields.js','services.js','portal-services.js');
let creating;
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
 if(m.type==='open-recorder')return openRecorder(sender);
 if(m.type==='capture-engine-started'){const recordingContext=await recorderContext();if(recordingContext?.tabId>=0){const recordingTab=await chrome.tabs.get(recordingContext.tabId);await chrome.windows.update(recordingTab.windowId,{state:'minimized'});}const host=(await chrome.storage.session.get('ccRecorderHostTab')).ccRecorderHostTab;if(host){await chrome.tabs.update(host,{active:true}).catch(()=>{});await chrome.tabs.sendMessage(host,{channel:'cc',type:'open',view:'hud'}).catch(()=>{});}await notify();return {ok:true};}
 const portal=await CCPortal.handle(m,sender);if(portal!==undefined)return portal;
 const service=await CCServices.handle(m,sender);if(service!==undefined)return service;
 if(m.type==='open-inbox'){
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
 if(m.type==='recording-analyse')return media({type:'analyse',id:m.id});
 if(m.type==='recordings-list')return media({type:'list'});
 if(m.type==='recording-url')return media({type:'media-url',id:m.id});
 if(m.type==='recording-release')return media({type:'release-url',token:m.token});
 if(m.type==='recording-download')return downloadRecording(m.id);
 if(m.type==='recording-delete')return media({type:'delete',id:m.id});
 if(m.type==='call-event'){const r=await media({type:'event',event:m.event});if(r.ok&&m.event?.type==='branch'){const state=await media({type:'status'});try{await CCServices.handle({type:'call-node-action',meta:state.meta,nodeId:m.event.nodeId,entryKey:state.meta.events.length},{url:chrome.runtime.getURL('recorder.html')});}catch(e){await media({type:'event',event:{type:'action-error',text:e.message}});r.warning=e.message;}}return r;}
 if(m.type==='open-mic-permission'){await chrome.windows.create({type:'popup',url:chrome.runtime.getURL('microphone.html'),width:450,height:440});return {ok:true};}
 if(m.type==='engine-ended'){if(m.id){await CCNotification.emit({category:'recording',key:'recording:'+m.id,title:'Gravação salva',message:'Sua call está no histórico de gravações.',entityId:m.id,view:'calls'});try{await downloadRecording(m.id);}catch{}}await notify();return {ok:true};}
 if(m.type==='workspace-changed'){await notify();return {ok:true};}
 if(m.type==='show-surface'&&sender.tab){await chrome.tabs.sendMessage(sender.tab.id,{channel:'cc',type:'open',view:m.view});return {ok:true};}
 return {ok:false,error:'Ação desconhecida.'};
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(sender.id!==chrome.runtime.id||m?.target==='media-engine'||!m?.channel||m.channel!=='cc')return;
 handle(m,sender).then(reply,e=>reply({ok:false,error:e.message||'Não foi possível concluir a ação.'}));return true;
});
chrome.action.onClicked.addListener(async tab=>{
 if(!tab.id)return;
 try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});await chrome.action.setBadgeText({tabId:tab.id,text:''});}
 catch{await chrome.action.setBadgeBackgroundColor({tabId:tab.id,color:'#CA4962'});await chrome.action.setBadgeText({tabId:tab.id,text:'!'});await chrome.action.setTitle({tabId:tab.id,title:'Abra o WhatsApp Web, Meet ou outro site comum para usar os controles.'});}
});
