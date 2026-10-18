'use strict';
// Browser transport for the unchanged copied UI; every operation uses the real account API.
(async()=>{
 async function request(path,body){const r=await fetch('/account/api'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}),data=await r.json();if(!r.ok)throw Error(data.error?.message||'Falha ao acessar a conta.');return data;}
 try{
  const identity=await request('/v1/account/license');if(identity.membership.role!=='member'||!identity.membership.permissions.includes('inbox'))throw Error('Este inbox é exclusivo dos funcionários com permissão. O titular utiliza o WhatsApp Web.');
  const listeners=new Set(),cache={ccAccountView:identity};
  const changed={addListener(fn){listeners.add(fn);},removeListener(fn){listeners.delete(fn);}};
  window.CCDeployment=Object.freeze({gatewayUrl:location.origin});
  window.CCWorkspace={get:async()=>({workspaceId:identity.workspaceId}),set:async()=>{throw Error('Use as ações do Inbox para alterar os dados.');}};
  window.chrome={storage:{local:{get:async key=>typeof key==='string'?{[key]:cache[key]}:{...cache}},onChanged:changed},runtime:{sendMessage:async m=>{try{if(m.type!=='slim-rpc')throw Error('Operação indisponível no inbox web.');return {ok:true,result:await request('/v1/slim/rpc',{module:m.module,method:m.method,data:m.data})};}catch(e){return {ok:false,error:e.message};}}}};
  const script=document.createElement('script');script.src='/account/runtime.js';document.head.append(script);
  setInterval(()=>{for(const fn of listeners)fn({},'local');},10000);
 }catch(e){document.querySelector('#root').replaceChildren();const p=document.createElement('p');p.textContent=e.message;const a=document.createElement('a');a.href='/account';a.textContent='Entrar na minha conta';document.querySelector('#root').append(p,a);}
})();
