import {randomUUID} from 'node:crypto';import {hashPassword} from './security.mjs';import {requireAdmin,roleOf} from './licensing.mjs';import {membership,inviteMember,acceptMember} from './teams.mjs';import {startAccountTrial} from './accounts.mjs';import {enrollPartner} from './partners.mjs';

export function publicRegistrationUrl(publicUrl){
 const url=new URL('/register',publicUrl||'https://convertecall.pro');
 url.hostname=url.hostname.replace(/^(adm|admin)\./i,'');
 return url.href;
}

export async function supportAccount(store,actor,userId,input){
 requireAdmin(store,actor);
 const target=store.one('SELECT id,email,workspace_id FROM users WHERE id=?',userId);
 if(!target)throw Object.assign(Error('Cliente não encontrado.'),{status:404});
 if(roleOf(store,target.id)==='admin')throw Object.assign(Error('Use o fluxo da própria conta para alterar um administrador.'),{status:400});
 if(!['email','password'].includes(input.action))throw Object.assign(Error('Escolha trocar e-mail ou trocar senha.'),{status:400});
 const email=input.action==='email'?String(input.email||'').trim().toLowerCase():null;
 if(input.action==='email'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200))throw Object.assign(Error('Informe um e-mail válido.'),{status:400});
 const credentials=input.action==='password'?await hashPassword(input.password):null;
 return store.transaction(()=>{
  if(email){
   if(store.one('SELECT id FROM users WHERE email=? AND id<>?',email,target.id))throw Object.assign(Error('Este e-mail já possui conta.'),{status:409});
   store.run('UPDATE users SET email=? WHERE id=?',email,target.id);
  }else store.run('UPDATE users SET password_hash=?,salt=? WHERE id=?',credentials.hash,credentials.salt,target.id);
  for(const table of ['sessions','device_sessions','account_web_sessions','admin_web_sessions','partner_sessions','password_resets'])store.run('DELETE FROM '+table+' WHERE user_id=?',target.id);
  store.run('INSERT INTO license_audit VALUES(?,?,?,?,?,?)',randomUUID(),actor.id,target.workspace_id,'support-'+input.action+'-updated',JSON.stringify({userId:target.id,...(email?{beforeEmail:target.email,afterEmail:email}:{})}),Date.now());
  return {updated:true,userId:target.id,email:email||target.email};
 });
}
export async function createManagedAccount(store,actor,input,publicUrl){requireAdmin(store,actor);const email=String(input.email||'').trim().toLowerCase(),firstName=String(input.firstName||'').trim(),kind=input.kind;if(!['employee','partner','customer'].includes(kind)||!firstName||firstName.length>80||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200)throw Object.assign(Error('Confira nome, e-mail e tipo de acesso.'),{status:400});if(store.one('SELECT id FROM users WHERE email=?',email))throw Object.assign(Error('Este e-mail já possui conta.'),{status:409});const password='CC!'+randomUUID()+'a9';let user;if(kind==='employee'){const invite=inviteMember(store,actor,{email,firstName,lastName:'',permissions:['inbox']},publicUrl);user=await acceptMember(store,{invite:new URL(invite.url).searchParams.get('invite'),password});}else{const credentials=await hashPassword(password);user=store.transaction(()=>{const workspace_id=store.createWorkspace(),id=randomUUID();store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',id,email,credentials.hash,credentials.salt,workspace_id,new Date().toISOString());startAccountTrial(store,id,workspace_id,{firstName,lastName:''});const result={id,workspace_id};membership(store,result);if(kind==='partner')enrollPartner(store,result);return result;});}store.run('INSERT INTO license_audit VALUES(?,?,?,?,?,?)',randomUUID(),actor.id,user.workspace_id,'admin-account-created',JSON.stringify({kind,userId:user.id}),Date.now());return {email,password,kind,userId:user.id,loginUrl:publicUrl+(kind==='partner'?'/partners':'/account')};}
