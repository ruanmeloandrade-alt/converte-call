'use strict';
const partnerNext=new URLSearchParams(location.search).get('next')==='partners';
const mobileNext=new URLSearchParams(location.search).get('next')==='app';
const referralCode=new URLSearchParams(location.search).get('ref')||'',fragment=location.hash.slice(1),initial=location.pathname==='/setup',form=document.querySelector('#setup'),status=document.querySelector('#status');
history.replaceState(null,'',location.pathname);
if(initial){document.querySelector('#profile-fields').hidden=true;for(const input of document.querySelectorAll('#profile-fields input,#profile-fields select'))input.disabled=true;document.querySelector('#intro').textContent='Crie sua conta de administrador.';form.querySelector('button[type=submit]').textContent='Concluir cadastro inicial';document.querySelector('#hint').textContent='O cadastro inicial é único e exige o link privado da implantação. Se já criou a conta, entre no acesso do administrador.';}

form.addEventListener('submit',async e=>{
 e.preventDefault();const button=form.querySelector('button[type=submit]');button.disabled=true;
 try{
  const fd=new FormData(form),body={email:fd.get('email'),password:fd.get('password')};
  if(!initial&&referralCode)body.referralCode=referralCode;
  if(initial)body.token=fragment;else Object.assign(body,{registrationMode:'quick',name:fd.get('name'),whatsapp:CCPhoneInput.read(form),instagram:fd.get('instagram')});
  const r=await fetch(initial?'/v1/auth/bootstrap':'/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json();
  if(!r.ok)throw Error(j.error?.message||'Falha no cadastro.');
  form.reset();form.hidden=true;
  if(j.role==='admin'){sessionStorage.setItem('ccAdminSession',j.accessToken);location.assign('/admin');return;}
  if(!partnerNext){location.assign(mobileNext?'/download?registered=1&platform=android':'/download?registered=1');return;}
  status.textContent='Conta criada! Seu teste termina em '+new Date(j.license.expiresAt).toLocaleString('pt-BR')+'. Guarde seu e-mail e senha para entrar no Converte Call.';
  const next=document.createElement('a');next.className='button';next.href=partnerNext?'/partners':mobileNext?'/account/app':'/download';next.textContent=partnerNext?'Ativar minha área de parceiro →':mobileNext?'Entrar no aplicativo web →':'Instalar extensão →';status.after(next);
 }catch(error){status.textContent=error.message;button.disabled=false;}
});
