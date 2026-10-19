'use strict';
globalThis.CCPortal=(()=>{
 const origin=()=>new URL(CCDeployment.accountUrl).origin;
 let refreshing;
 async function refresh(){if(refreshing)return refreshing;refreshing=(async()=>{const refreshToken=await CCCredentials.get('ccRefreshToken');if(!refreshToken)throw Object.assign(Error('Entre na sua conta do Converte Call.'),{status:401});const r=await request('/v1/auth/refresh',{method:'POST',anonymous:true,body:{refreshToken}});await CCCredentials.set('ccAccountToken',r.accessToken);return r.accessToken;})().finally(()=>{refreshing=null;});return refreshing;}
 async function request(path,{method='GET',body,anonymous=false,retry=true,headers={},timeoutMs}={}){
  if(!CCDeployment.accountUrl)throw Error('O acesso à conta ainda não foi configurado nesta versão.');
  if(!await chrome.permissions.contains({origins:[origin()+'/*']}))throw Error('Autorize a conexão com sua conta primeiro.');
  let accessToken=anonymous?null:await CCCredentials.get('ccAccountToken');if(!anonymous&&!accessToken)accessToken=await refresh();
  const r=await fetch(origin()+path,{method,headers:{...headers,...(!anonymous?{Authorization:'Bearer '+accessToken}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeoutMs||(path==='/v1/ai/credentials'?10000:path.startsWith('/v1/ai/')?120000:path.startsWith('/v1/auth/')||path==='/v1/account/license'?10000:30000))}),data=await r.json().catch(()=>({}));
  if(r.status===401&&!anonymous&&retry){await refresh();return request(path,{method,body,anonymous,retry:false,headers,timeoutMs});}
  if(r.status===401){await CCCredentials.remove('ccAccountToken');await CCCredentials.remove('ccRefreshToken');}
  if(!r.ok)throw Object.assign(Error(data.error?.message||'Não foi possível acessar sua conta.'),{status:r.status});return data;
 }
 async function syncKey(){const status=await request('/v1/ai/credentials'),workspace=(await chrome.storage.local.get('converteCallWorkspace')).converteCallWorkspace;let synced=false;for(const [provider,name]of Object.entries({openai:'ccOpenAIKey',gemini:'ccGeminiKey',anthropic:'ccAnthropicKey'})){const apiKey=await CCCredentials.get(name);if(!apiKey)continue;if(!status.profiles?.[provider]?.configured){const profile=workspace?.providers?.profiles?.[provider]||{};await request('/v1/ai/credentials',{method:'PUT',body:{provider,apiKey,model:profile.model,transcriptionModel:profile.transcriptionModel,select:false}});synced=true;}await CCCredentials.remove(name);}return synced;}

 async function handle(message,sender){
  if(!String(message.type||'').startsWith('portal-'))return;
  if(!sender.url?.startsWith(chrome.runtime.getURL('')))return {ok:false,error:'Abra o painel seguro da extensão.'};
  if(message.type==='portal-login'){const r=await request('/v1/auth/session',{method:'POST',anonymous:true,body:{email:String(message.email||'').slice(0,200),password:String(message.password||'').slice(0,200),rememberDevice:true}}),previous=(await chrome.storage.local.get('ccCredentialWorkspace')).ccCredentialWorkspace;await CCCredentials.set('ccAccountToken',r.accessToken);if(r.refreshToken)await CCCredentials.set('ccRefreshToken',r.refreshToken);const identity=await request('/v1/account/license');if(previous&&previous!==r.workspaceId||identity.membership?.role==='member'){for(const name of ['ccOpenAIKey','ccGeminiKey','ccAnthropicKey','ccGatewayToken'])await CCCredentials.remove(name);}await chrome.storage.local.set({ccCredentialWorkspace:r.workspaceId,ccAccountView:{...identity,previousWorkspace:previous}});if(identity.membership?.role!=='member')await syncKey().catch(()=>{});if(globalThis.CCCloudSync)await CCCloudSync.sync();return {ok:true,...identity};}

  if(message.type==='portal-account'){const identity=await request('/v1/account/license');const previous=(await chrome.storage.local.get('ccAccountView')).ccAccountView;await chrome.storage.local.set({ccAccountView:{...identity,previousWorkspace:previous?.previousWorkspace}});return {ok:true,...identity};}
  if(message.type==='portal-logout'){await chrome.storage.local.remove('ccAccountView');await request('/v1/auth/logout',{method:'POST'}).catch(()=>{});await CCCredentials.remove('ccAccountToken');await CCCredentials.remove('ccRefreshToken');await CCCredentials.remove('ccOpenAIKey');await CCCredentials.remove('ccGeminiKey');await CCCredentials.remove('ccAnthropicKey');await CCCredentials.remove('ccGatewayToken');return {ok:true};}
  if(message.type==='portal-release')return {ok:true,...await request('/v1/releases/latest',{anonymous:true})};
  if(message.type==='portal-release-download'){const r=await request('/v1/releases/latest',{anonymous:true}),url=new URL(r.downloadUrl);if(url.origin!==origin()||!/^\/downloads\/Converte-Call-v[0-9.]+\.zip$/.test(url.pathname))throw Error('Endereço de atualização inválido.');const downloadId=await chrome.downloads.download({url:url.href,filename:'Converte Call/Converte-Call-v'+r.version+'.zip',saveAs:false});return {ok:true,downloadId,version:r.version};}
  if(message.type==='portal-profile-save')return {ok:true,...await request('/v1/account/profile',{method:'PATCH',body:message.profile})};
  if(message.type==='portal-human-support')return {ok:true,...await request('/v1/account/support-link')};
  if(message.type==='portal-marketing')return {ok:true,...await request('/v1/account/marketing-link')};
  if(message.type==='portal-recording-begin')return {ok:true,...await request('/v1/recordings/uploads',{method:'POST',body:message.input})};
  if(message.type==='portal-recording-part')return {ok:true,...await request('/v1/recordings/uploads/'+encodeURIComponent(message.uploadId)+'/'+Number(message.part),{method:'PUT',body:{base64:message.base64}})};
  if(message.type==='portal-recording-complete')return {ok:true,...await request('/v1/recordings/uploads/'+encodeURIComponent(message.uploadId)+'/complete',{method:'POST',body:{}})};
  if(message.type==='portal-recording-update')return {ok:true,...await request('/v1/recordings/'+encodeURIComponent(message.id),{method:'PATCH',body:message.meta})};
  if(message.type==='portal-recordings')return {ok:true,...await request('/v1/recordings')};
  if(message.type==='portal-recording-media')return {ok:true,...await request('/v1/recordings/'+encodeURIComponent(message.id)+'/media')};
  if(message.type==='portal-ai-text')return {ok:true,...await request('/v1/ai/text',{method:'POST',body:message.input})};
  if(message.type==='portal-ai-transcribe')return {ok:true,...await request('/v1/ai/transcribe',{method:'POST',body:message.input})};
  if(message.type==='portal-admin-overview')return {ok:true,...await request('/v1/admin/accounts')};
  if(message.type==='portal-team')return {ok:true,...await request('/v1/team')};
  if(message.type==='portal-team-invite')return {ok:true,...await request('/v1/team/invites',{method:'POST',body:message.input})};
  if(message.type==='portal-team-member')return {ok:true,...await request('/v1/team/members/'+encodeURIComponent(message.id),{method:'PATCH',body:message.input})};
  if(message.type==='portal-billing')return {ok:true,...await request('/v1/billing')};
  if(message.type==='portal-web-checkout')return {ok:true,...await request('/v1/billing/web-checkout',{method:'POST',body:{}})};
  if(message.type==='portal-checkout')return {ok:true,...await request('/v1/billing/checkout',{method:'POST',body:{plan:message.plan,locale:message.locale,seats:message.seats??1}})};
  if(message.type==='portal-billing-portal')return {ok:true,...await request('/v1/billing/portal',{method:'POST',body:{}})};
  if(message.type==='portal-academy-settings')return {ok:true,...await request('/v1/academy/settings')};
  if(message.type==='portal-academy-edit')return {ok:true,...await request('/v1/academy/settings',{method:'PUT',body:message.settings})};
  if(message.type==='portal-academy-admin')return {ok:true,...await request('/v1/admin/academy')};
  if(message.type==='portal-lesson-save')return {ok:true,...await request('/v1/admin/academy'+(message.id?'/'+encodeURIComponent(message.id):''),{method:message.id?'PATCH':'POST',body:message.lesson})};
  if(message.type==='portal-lesson-delete')return {ok:true,...await request('/v1/admin/academy/'+encodeURIComponent(message.id),{method:'DELETE'})};
  if(message.type==='portal-inbox-control'){const paths={choices:['/v1/whatsapp/choices','GET'],context:['/v1/whatsapp/context','POST'],start:['/v1/whatsapp/dispatch','POST'],stop:['/v1/whatsapp/stop','POST'],reply:['/v1/whatsapp/reply','POST']},route=paths[message.action];if(!route)throw Error('Ação inválida.');return {ok:true,...await request(route[0],{method:route[1],body:route[1]==='GET'?undefined:message.data,headers:{'Idempotency-Key':message.requestId||crypto.randomUUID()}})};}
  if(message.type==='portal-forums')return {ok:true,...await request('/v1/academy/forums')};
  if(message.type==='portal-forum-create')return {ok:true,...await request('/v1/academy/forums',{method:'POST',body:message.forum})};
  if(message.type==='portal-forum-posts')return {ok:true,...await request('/v1/academy/forums/'+encodeURIComponent(message.id)+'/posts')};
  if(message.type==='portal-forum-reaction')return {ok:true,...await request('/v1/academy/forums/'+encodeURIComponent(message.id)+'/posts/'+encodeURIComponent(message.postId)+'/reaction',{method:'PUT',body:{emoji:message.emoji,active:message.active}})};
  if(message.type==='portal-forum-post')return {ok:true,...await request('/v1/academy/forums/'+encodeURIComponent(message.id)+'/posts',{method:'POST',body:message.post})};
  if(message.type==='portal-academy')return {ok:true,...await request('/v1/academy')};
  if(message.type==='portal-progress')return {ok:true,...await request('/v1/academy/'+encodeURIComponent(message.id)+'/progress',{method:'PUT',body:{completed:message.completed}})};
  if(message.type==='portal-support'){
   return {ok:true,...await request('/v1/support/ask',{method:'POST',body:{question:String(message.question||'').slice(0,2001)}})};
  }
  return {ok:false,error:'Ação da conta não encontrada.'};
 }
 return {handle,request,syncKey};
})();
