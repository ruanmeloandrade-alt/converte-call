import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {vault} from './security.mjs';
import '../vendor/core.js';
import '../vendor/core-v4.js';
import '../vendor/call-fields.js';
export const Core=globalThis.CCCore;
export class Store{
 constructor(dir,master){mkdirSync(dir,{recursive:true});this.dir=dir;this.vault=vault(master);this.db=new DatabaseSync(join(dir,'converte-call.sqlite'));this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL,workspace_id TEXT NOT NULL REFERENCES workspaces(id),created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES users(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS secrets(workspace_id TEXT NOT NULL,name TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(workspace_id,name));
 CREATE TABLE IF NOT EXISTS events(sequence INTEGER PRIMARY KEY AUTOINCREMENT,workspace_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(workspace_id,id));
 CREATE INDEX IF NOT EXISTS events_workspace_sequence ON events(workspace_id,sequence);
 CREATE TABLE IF NOT EXISTS instances(workspace_id TEXT PRIMARY KEY,instance_name TEXT NOT NULL UNIQUE,hook_hash TEXT NOT NULL,credentials TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'created',phone TEXT,qr TEXT,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS inbound(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',error TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,lead_id TEXT NOT NULL,kind TEXT NOT NULL,asset_id TEXT NOT NULL,status TEXT NOT NULL,node_id TEXT,state TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS runs_active ON runs(workspace_id,lead_id,status);
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,run_id TEXT,type TEXT NOT NULL,payload TEXT NOT NULL,due_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,error TEXT,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,due_at);
 CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,run_id TEXT,lead_id TEXT NOT NULL,text TEXT NOT NULL,status TEXT NOT NULL,remote_id TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,expires_at INTEGER,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS asset_aliases(workspace_id TEXT NOT NULL,path TEXT NOT NULL,asset_id TEXT NOT NULL,PRIMARY KEY(workspace_id,path));
 CREATE TABLE IF NOT EXISTS idempotency(workspace_id TEXT NOT NULL,key TEXT NOT NULL,request_hash TEXT NOT NULL,response TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(workspace_id,key));
 CREATE TABLE IF NOT EXISTS rag_chunks(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,source_id TEXT NOT NULL,text TEXT NOT NULL,embedding TEXT,model TEXT,updated_at TEXT NOT NULL);
 INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));`);
  // A send interrupted after the HTTP request is uncertain, never blindly resend.
  this.db.exec("UPDATE outbox SET status='uncertain' WHERE status='sending'; UPDATE jobs SET status='pending' WHERE status='running'; UPDATE inbound SET status='pending' WHERE status='processing';");
 }
 one(sql,...args){return this.db.prepare(sql).get(...args);}
 all(sql,...args){return this.db.prepare(sql).all(...args);}
 run(sql,...args){return this.db.prepare(sql).run(...args);}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 createWorkspace(){const id=randomUUID(),data=this.normalize({workspaceId:id});this.run('INSERT INTO workspaces(id,data,updated_at) VALUES(?,?,?)',id,JSON.stringify(data),new Date().toISOString());return id;}
 normalize(d){Core.migrate(d);for(const k of ['crmSources','companies','catalogs','products','supplierCosts','crmAgents','slimStageAutomations','forms','notifications','leadProducts','orders','brainSources','brainBlockedTerms'])d[k]||=[];return d;}
 get(id){const row=this.one('SELECT data,revision FROM workspaces WHERE id=?',id);if(!row)throw Object.assign(Error('Conta não encontrada.'),{status:404});return this.normalize(JSON.parse(row.data));}
 revision(id){return this.one('SELECT revision FROM workspaces WHERE id=?',id)?.revision;}
 put(id,data){data.workspaceId=id;this.run('UPDATE workspaces SET data=?,revision=revision+1,updated_at=? WHERE id=?',JSON.stringify(this.normalize(data)),new Date().toISOString(),id);}
 mutate(id,fn){return this.transaction(()=>{const d=this.get(id),r=fn(d);this.put(id,d);return r;});}
 secret(id,name,value){if(arguments.length===3){this.run('INSERT INTO secrets VALUES(?,?,?) ON CONFLICT(workspace_id,name) DO UPDATE SET value=excluded.value',id,name,this.vault.seal(value));return;}const r=this.one('SELECT value FROM secrets WHERE workspace_id=? AND name=?',id,name);return r?this.vault.open(r.value):null;}
 event(ws,event){const e={id:event.id||randomUUID(),at:new Date().toISOString(),...event};this.run('INSERT OR IGNORE INTO events(workspace_id,id,payload,created_at) VALUES(?,?,?,?)',ws,e.id,JSON.stringify(e),e.at);return e;}
 enqueue(ws,type,payload,{runId=null,id=randomUUID(),dueAt=Date.now()}={}){this.run('INSERT OR IGNORE INTO jobs(id,workspace_id,run_id,type,payload,due_at,created_at) VALUES(?,?,?,?,?,?,?)',id,ws,runId,type,JSON.stringify(payload),dueAt,new Date().toISOString());return id;}
 close(){this.db.close();}
}
