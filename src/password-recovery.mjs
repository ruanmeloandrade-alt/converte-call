import {randomBytes} from 'node:crypto';
import {digest,hashPassword} from './security.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export class PasswordRecovery{
 constructor(store,google,publicUrl,{deliver}={}){Object.assign(this,{store,google,publicUrl,deliver});store.db.exec(`CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);INSERT OR IGNORE INTO migrations VALUES(28,datetime('now'));`);}
 sender(){return this.store.all("SELECT u.* FROM users u JOIN account_roles r ON r.user_id=u.id WHERE r.role='admin'").find(u=>this.store.secret(u.workspace_id,'google:gmail'));}
 async request(input){
  const email=String(input.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200)throw fail(400,'Informe um e-mail válido.');
  const sender=this.deliver?null:this.sender();if(!this.deliver&&!sender)throw fail(503,'O envio de recuperação está indisponível. Fale com o suporte para recuperar seu acesso.');
  const user=this.store.one('SELECT * FROM users WHERE email=?',email);
  if(user){const token=randomBytes(32).toString('base64url'),url=new URL('/redefinir-senha',this.publicUrl());url.hash='token='+token;const text='Você solicitou a redefinição da senha do Converte Call.\n\nAbra este link para criar sua nova senha:\n'+url.href+'\n\nO link é válido por 15 minutos e só pode ser usado uma vez. Se você não pediu a alteração, ignore esta mensagem. Sua senha permanece a mesma.';
   this.store.run('DELETE FROM password_resets WHERE user_id=? OR expires_at<?',user.id,Date.now());this.store.run('INSERT INTO password_resets VALUES(?,?,?)',digest(token),user.id,Date.now()+15*60000);
   try{if(this.deliver)await this.deliver({email,text,url:url.href});else{const raw=Buffer.from('To: '+email+'\r\nSubject: Redefina sua senha - Converte Call\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+Buffer.from(text).toString('base64')).toString('base64url');await this.google.send(sender.workspace_id,{raw,confirm:true});}}
   catch{this.store.run('DELETE FROM password_resets WHERE token_hash=?',digest(token));console.error(JSON.stringify({type:'password-recovery-delivery-failed'}));}
  }
  return {message:'Solicitação recebida. Se este e-mail estiver cadastrado, confira a caixa de entrada e o spam para encontrar o link de redefinição.'};
 }
 async reset(input){
  const token=String(input.token||'');if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw fail(400,'Link inválido ou expirado. Solicite um novo.');
  const row=this.store.one('SELECT * FROM password_resets WHERE token_hash=? AND expires_at>?',digest(token),Date.now());if(!row)throw fail(400,'Link inválido ou expirado. Solicite um novo.');
  const credentials=await hashPassword(input.password);
  this.store.transaction(()=>{const consumed=this.store.run('DELETE FROM password_resets WHERE token_hash=? AND expires_at>?',digest(token),Date.now());if(!consumed.changes)throw fail(400,'Link inválido ou expirado. Solicite um novo.');this.store.run('UPDATE users SET password_hash=?,salt=? WHERE id=?',credentials.hash,credentials.salt,row.user_id);for(const table of ['sessions','device_sessions','account_web_sessions','admin_web_sessions','partner_sessions'])this.store.run('DELETE FROM '+table+' WHERE user_id=?',row.user_id);this.store.run('DELETE FROM password_resets WHERE user_id=?',row.user_id);});
  return {message:'Senha alterada. Entre com sua nova senha.'};
 }
}
