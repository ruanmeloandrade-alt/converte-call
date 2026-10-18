'use strict';
globalThis.CCPortal=(()=>{
 const origin=()=>new URL(CCDeployment.accountUrl).origin;
 let refreshing;
 async function refresh(){if(refreshing)return refreshing;refreshing=(async()=>{const refreshToken=await CCCredentials.get('ccRefreshToken');if(!refreshToken)throw Object.assign(Error('Entre na sua conta do Converte Call.'),{status:401});const r=await request('/v1/auth/refresh',{method:'POST',anonymous:true,body:{refreshToken}});await CCCredentials.set('ccAccountToken',r.accessToken);return r.accessToken;})().finally(()=>{refreshing=null;});return refreshing;}
 async function request(path,{method='GET',body,anonymous=false,retry=true}={}){
  if(!CCDeployment.accountUrl)throw Error('O acesso à conta ainda não foi configurado nesta versão.');
  if(!await chrome.permissions.contains({origins:[origin()+'/*']}))throw Error('Autorize a conexão com sua conta primeiro.');
  let accessToken=anonymous?null:await CCCredentials.get('ccAccountToken');if(!anonymous&&!accessToken)accessToken=await refresh();
  const r=await fetch(origin()+path,{method,headers:{...(!anonymous?{Authorization:'Bearer '+accessToken}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(55000)}),data=await r.json().catch(()=>({}));
  if(r.status===401&&!anonymous&&retry){await refresh();return request(path,{method,body,anonymous,retry:false});}
  if(r.status===401){await CCCredentials.remove('ccAccountToken');await CCCredentials.remove('ccRefreshToken');}
  if(!r.ok)throw Object.assign(Error(data.error?.message||'Não foi possível acessar sua conta.'),{status:r.status});return data;
 }
 async function syncKey(){const apiKey=await CCCredentials.get('ccOpenAIKey');if(!apiKey)return false;const workspace=(await chrome.storage.local.get('converteCallWorkspace')).converteCallWorkspace;await request('/v1/ai/credentials',{method:'PUT',body:{apiKey,model:workspace?.providers?.model||''}});return true;}
 async function handle(message,sender){
  if(!String(message.type||'').startsWith('portal-'))return;
  if(!sender.url?.startsWith(chrome.runtime.getURL('')))return {ok:false,error:'Abra o painel seguro da extensão.'};
  if(message.type==='portal-login'){const r=await request('/v1/auth/session',{method:'POST',anonymous:true,body:{email:String(message.email||'').slice(0,200),password:String(message.password||'').slice(0,200),rememberDevice:true}});const previous=(await chrome.storage.local.get('ccCredentialWorkspace')).ccCredentialWorkspace;if(previous&&previous!==r.workspaceId){await CCCredentials.remove('ccOpenAIKey');await CCCredentials.remove('ccGatewayToken');}await chrome.storage.local.set({ccCredentialWorkspace:r.workspaceId});await CCCredentials.set('ccAccountToken',r.accessToken);if(r.refreshToken)await CCCredentials.set('ccRefreshToken',r.refreshToken);await syncKey().catch(()=>{});return {ok:true,role:r.role,license:r.license};}
  if(message.type==='portal-account'){const identity=await request('/v1/account/license');return {ok:true,...identity};}
  if(message.type==='portal-logout'){await request('/v1/auth/logout',{method:'POST'}).catch(()=>{});await CCCredentials.remove('ccAccountToken');await CCCredentials.remove('ccRefreshToken');await CCCredentials.remove('ccOpenAIKey');await CCCredentials.remove('ccGatewayToken');return {ok:true};}
  if(message.type==='portal-release')return {ok:true,...await request('/v1/releases/latest',{anonymous:true})};
  if(message.type==='portal-release-download'){const r=await request('/v1/releases/latest',{anonymous:true}),url=new URL(r.downloadUrl);if(url.origin!==origin()||!/^\/downloads\/Converte-Call-v[0-9.]+\.zip$/.test(url.pathname))throw Error('Endereço de atualização inválido.');const downloadId=await chrome.downloads.download({url:url.href,filename:'Converte Call/Converte-Call-v'+r.version+'.zip',saveAs:false});return {ok:true,downloadId,version:r.version};}
  if(message.type==='portal-marketing')return {ok:true,...await request('/v1/account/marketing-link')};
  if(message.type==='portal-billing')return {ok:true,...await request('/v1/billing')};
  if(message.type==='portal-checkout')return {ok:true,...await request('/v1/billing/checkout',{method:'POST',body:{plan:message.plan,locale:message.locale}})};
  if(message.type==='portal-billing-portal')return {ok:true,...await request('/v1/billing/portal',{method:'POST',body:{}})};
  if(message.type==='portal-academy')return {ok:true,...await request('/v1/academy')};
  if(message.type==='portal-progress')return {ok:true,...await request('/v1/academy/'+encodeURIComponent(message.id)+'/progress',{method:'PUT',body:{completed:message.completed}})};
  if(message.type==='portal-support'){
   const key=await CCCredentials.get('ccOpenAIKey');
   const workspace=(await chrome.storage.local.get('converteCallWorkspace')).converteCallWorkspace;
   if(key&&workspace?.providers?.model)try{await request('/v1/ai/credentials',{method:'PUT',body:{apiKey:key,model:workspace.providers.model}});}catch(error){if(error.status!==402)throw error;}
   return {ok:true,...await request('/v1/support/ask',{method:'POST',body:{question:String(message.question||'').slice(0,2001)}})};
  }
  return {ok:false,error:'Ação da conta não encontrada.'};
 }
 return {handle,request,syncKey};
})();
