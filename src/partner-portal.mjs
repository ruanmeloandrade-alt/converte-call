import {randomBytes} from 'node:crypto';import {digest,checkPassword} from './security.mjs';import {requireOwner} from './teams.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export class PartnerPortal{
 constructor(store){this.store=store;store.db.exec(`CREATE TABLE IF NOT EXISTS partner_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);`);}
 async login(email,password){const user=this.store.one('SELECT * FROM users WHERE email=?',String(email||'').trim().toLowerCase());if(!user||!await checkPassword(password,user))throw fail(401,'E-mail ou senha incorretos.');requireOwner(this.store,user);const token=randomBytes(32).toString('hex');this.store.run('DELETE FROM partner_sessions WHERE expires_at<?',Date.now());this.store.run('INSERT INTO partner_sessions VALUES(?,?,?)',digest(token),user.id,Date.now()+12*3600000);return token;}
 user(cookie){const token=String(cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ccPartner='))?.slice(10),user=token&&this.store.one('SELECT u.* FROM partner_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',digest(token),Date.now());if(!user)throw fail(401,'Entre na sua área de parceiro.');requireOwner(this.store,user);return user;}
 logout(cookie){const token=String(cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ccPartner='))?.slice(10);if(token)this.store.run('DELETE FROM partner_sessions WHERE token_hash=?',digest(token));}
}
