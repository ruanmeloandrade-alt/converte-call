import {randomUUID} from 'node:crypto';
import {digest} from './security.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export function installAccessSecurity(store){store.db.exec(`CREATE TABLE IF NOT EXISTS security_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,workspace_id TEXT NOT NULL,kind TEXT NOT NULL,created_at INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS security_events_owner ON security_events(user_id,created_at);INSERT OR IGNORE INTO migrations VALUES(27,datetime('now'));`);}
export function securityEvent(store,user,kind){
 const recent=store.one('SELECT created_at FROM security_events WHERE user_id=? AND kind=? ORDER BY created_at DESC LIMIT 1',user.id,kind);
 if(!recent||Date.now()-recent.created_at>60000)store.run('INSERT INTO security_events VALUES(?,?,?,?,?)',randomUUID(),user.id,user.workspace_id,kind,Date.now());
 store.run('DELETE FROM security_events WHERE created_at<?',Date.now()-30*86400000);
}
export function capWebSessions(store,userId){
 const rows=store.all('SELECT token_hash FROM account_web_sessions WHERE user_id=? ORDER BY expires_at DESC,rowid DESC',userId);
 for(const row of rows.slice(5))store.run('DELETE FROM account_web_sessions WHERE token_hash=?',row.token_hash);
 if(rows.length>5){const user=store.one('SELECT * FROM users WHERE id=?',userId);securityEvent(store,user,'web-session-limit');}
}
const tables={web:'account_web_sessions',extension:'sessions',device:'device_sessions'};
export function sessionSecurity(store,user,credential){
 const current=credential?digest(credential):null,sessions=[];
 for(const [kind,table]of Object.entries(tables))for(const row of store.all('SELECT token_hash,expires_at FROM '+table+' WHERE user_id=? AND expires_at>?',user.id,Date.now()))sessions.push({id:kind+':'+row.token_hash,kind,expiresAt:row.expires_at,current:row.token_hash===current});
 return {sessions,maxWebSessions:5,events:store.all('SELECT kind,created_at AS createdAt FROM security_events WHERE user_id=? ORDER BY created_at DESC LIMIT 30',user.id)};
}
export function revokeSession(store,user,input,credential){
 const match=String(input.id||'').match(/^(web|extension|device):([a-f0-9]{64})$/);if(!match)throw fail(400,'Sessão inválida.');
 const [,kind,hash]=match,table=tables[kind];
 return store.transaction(()=>{const row=store.one('SELECT token_hash FROM '+table+' WHERE token_hash=? AND user_id=?',hash,user.id);if(!row)throw fail(404,'Sessão não encontrada na sua conta.');store.run('DELETE FROM '+table+' WHERE token_hash=? AND user_id=?',hash,user.id);
  // A remembered device and its current bearer belong to the same extension login.
  if(kind==='device')store.run('DELETE FROM sessions WHERE user_id=?',user.id);
  if(kind==='extension')store.run('DELETE FROM device_sessions WHERE user_id=?',user.id);
  securityEvent(store,user,'session-revoked');return {revoked:true,currentRevoked:!!credential&&hash===digest(credential)};
 });
}
export class OperationGuard{
 constructor(store){this.store=store;this.running=new Map();}
 async run(user,operation){const key=user.id,n=this.running.get(key)||0;if(n>=3){securityEvent(this.store,user,'ai-concurrency-limit');throw fail(429,'Sua conta já tem 3 operações de IA em andamento. Aguarde uma terminar.');}this.running.set(key,n+1);try{return await operation();}finally{const remaining=(this.running.get(key)||1)-1;if(remaining)this.running.set(key,remaining);else this.running.delete(key);}}
}
