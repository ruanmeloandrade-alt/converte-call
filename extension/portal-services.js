'use strict';
globalThis.CCPortal=(()=>{
 const origin=()=>new URL(CCDeployment.accountUrl).origin;
 async function request(path,{method='GET',body,anonymous=false}={}){
  if(!CCDeployment.accountUrl)throw Error('O acesso à conta ainda não foi configurado nesta versão.');
  if(!await chrome.permissions.contains({origins:[origin()+'/*']}))throw Error('Autorize a conexão com sua conta primeiro.');
  const accessToken=(await chrome.storage.session.get('ccAccountToken')).ccAccountToken;
  if(!anonymous&&!accessToken)throw Error('Entre na sua conta do Converte Call.');
  const r=await fetch(origin()+path,{method,headers:{...(!anonymous?{Authorization:'Bearer '+accessToken}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(55000)}),data=await r.json().catch(()=>({}));
  if(r.status===401)await chrome.storage.session.remove('ccAccountToken');
  if(!r.ok)throw Object.assign(Error(data.error?.message||'Não foi possível acessar sua conta.'),{status:r.status});return data;
 }
 async function handle(message,sender){
  if(!String(message.type||'').startsWith('portal-'))return;
  if(!sender.url?.startsWith(chrome.runtime.getURL('')))return {ok:false,error:'Abra o painel seguro da extensão.'};
  if(message.type==='portal-login'){const r=await request('/v1/auth/session',{method:'POST',anonymous:true,body:{email:String(message.email||'').slice(0,200),password:String(message.password||'').slice(0,200)}});await chrome.storage.session.set({ccAccountToken:r.accessToken});return {ok:true,role:r.role,license:r.license};}
  if(message.type==='portal-account'){const identity=await request('/v1/account/license');return {ok:true,...identity};}
  if(message.type==='portal-logout'){await request('/v1/auth/logout',{method:'POST'}).catch(()=>{});await chrome.storage.session.remove('ccAccountToken');return {ok:true};}
  if(message.type==='portal-billing')return {ok:true,...await request('/v1/billing')};
  if(message.type==='portal-checkout')return {ok:true,...await request('/v1/billing/checkout',{method:'POST',body:{plan:message.plan,locale:message.locale}})};
  if(message.type==='portal-billing-portal')return {ok:true,...await request('/v1/billing/portal',{method:'POST',body:{}})};
  if(message.type==='portal-academy')return {ok:true,...await request('/v1/academy')};
  if(message.type==='portal-progress')return {ok:true,...await request('/v1/academy/'+encodeURIComponent(message.id)+'/progress',{method:'PUT',body:{completed:message.completed}})};
  if(message.type==='portal-support'){
   const key=(await chrome.storage.session.get('ccOpenAIKey')).ccOpenAIKey;
   const workspace=(await chrome.storage.local.get('converteCallWorkspace')).converteCallWorkspace;
   if(key&&workspace?.providers?.model)try{await request('/v1/ai/credentials',{method:'PUT',body:{apiKey:key,model:workspace.providers.model}});}catch(error){if(error.status!==402)throw error;}
   return {ok:true,...await request('/v1/support/ask',{method:'POST',body:{question:String(message.question||'').slice(0,2001)}})};
  }
  return {ok:false,error:'Ação da conta não encontrada.'};
 }
 return {handle};
})();
