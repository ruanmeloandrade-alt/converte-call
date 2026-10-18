'use strict';
const fragment=location.hash.slice(1),initial=location.pathname==='/setup',form=document.querySelector('#setup'),status=document.querySelector('#status');
history.replaceState(null,'',location.pathname);
if(initial){document.querySelector('#license-label').hidden=true;document.querySelector('#intro').textContent='Crie sua conta de administrador.';form.querySelector('button').textContent='Concluir cadastro inicial';document.querySelector('#hint').textContent='O cadastro inicial é único e exige o link privado da implantação. A conta de administrador poderá emitir licenças e gerenciar assinaturas.';}
else{form.elements.licenseKey.value=new URLSearchParams(fragment).get('license')||'';form.elements.licenseKey.required=true;}
form.addEventListener('submit',async e=>{
 e.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{
  const fd=new FormData(form),body={email:fd.get('email'),password:fd.get('password')};
  if(initial)body.token=fragment;else body.licenseKey=fd.get('licenseKey');
  const r=await fetch(initial?'/v1/auth/bootstrap':'/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json();
  if(!r.ok)throw Error(j.error?.message||'Falha no cadastro.');
  form.reset();form.hidden=true;
  if(j.role==='admin'){sessionStorage.setItem('ccAdminSession',j.accessToken);location.assign('/admin');return;}
  status.textContent='Conta criada! Seu teste termina em '+new Date(j.license.expiresAt).toLocaleString('pt-BR')+'. Guarde seu e-mail e senha para entrar no Converte Call.';
 }catch(error){status.textContent=error.message;button.disabled=false;}
});
