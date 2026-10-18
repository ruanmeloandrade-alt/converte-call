import {randomUUID} from 'node:crypto';
import {token,digest} from './security.mjs';

export const TRIAL_DAYS=7;
const DAY=86400000;
const fail=(status,message)=>Object.assign(Error(message),{status});

// Migration is additive: existing workspace data and passwords are untouched.
export function installLicensing(store){
 store.transaction(()=>{
  store.db.exec(`
   CREATE TABLE IF NOT EXISTS account_roles(user_id TEXT PRIMARY KEY REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('admin','customer')));
   CREATE TABLE IF NOT EXISTS subscriptions(workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),plan TEXT NOT NULL,started_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,trial_started_at INTEGER,suspended INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS license_invites(id TEXT PRIMARY KEY,key_hash TEXT NOT NULL UNIQUE,email TEXT,created_at INTEGER NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),redeemed_at INTEGER,redeemed_by TEXT REFERENCES users(id),revoked_at INTEGER);
   CREATE TABLE IF NOT EXISTS license_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),workspace_id TEXT,action TEXT NOT NULL,details TEXT NOT NULL,created_at INTEGER NOT NULL);
  `);
  if(!store.one('SELECT version FROM migrations WHERE version=2')){
   // Prior versions only exposed the single-owner bootstrap route.
   const owner=store.one('SELECT id FROM users ORDER BY rowid LIMIT 1');
   if(owner)store.run("INSERT OR IGNORE INTO account_roles VALUES(?,'admin')",owner.id);
   store.run("INSERT INTO migrations VALUES(2,datetime('now'))");
  }
 });
}

export function roleOf(store,userId){return store.one('SELECT role FROM account_roles WHERE user_id=?',userId)?.role||'customer';}
export function subscription(store,workspaceId,now=Date.now()){
 const owner=store.one("SELECT r.role FROM account_roles r JOIN users u ON u.id=r.user_id WHERE u.workspace_id=? AND r.role='admin'",workspaceId);
 if(owner)return {status:'admin',active:true,plan:'Administrador',expiresAt:null,remainingDays:null};
 const row=store.one('SELECT * FROM subscriptions WHERE workspace_id=?',workspaceId);
 if(!row)return {status:'unlicensed',active:false,plan:null,expiresAt:null,remainingDays:0};
 const active=!row.suspended&&row.expires_at>now;
 return {status:row.suspended?'suspended':!active?'expired':row.plan==='trial'?'trial':'active',active,plan:row.plan,startedAt:new Date(row.started_at).toISOString(),expiresAt:new Date(row.expires_at).toISOString(),trialStartedAt:row.trial_started_at?new Date(row.trial_started_at).toISOString():null,remainingDays:Math.max(0,Math.ceil((row.expires_at-now)/DAY))};
}
export function requireSubscription(store,workspaceId){const state=subscription(store,workspaceId);if(!state.active)throw fail(402,state.status==='suspended'?'Acesso suspenso. Entre em contato com o administrador.':'Sua licença expirou ou ainda não foi ativada. Entre em contato para liberar a assinatura.');return state;}
export function requireAdmin(store,user){if(roleOf(store,user.id)!=='admin')throw fail(403,'Acesso exclusivo do administrador.');}
function audit(store,actorId,workspaceId,action,details){store.run('INSERT INTO license_audit VALUES(?,?,?,?,?,?)',randomUUID(),actorId,workspaceId,action,JSON.stringify(details),Date.now());}
function emailValue(value){const email=String(value||'').trim().toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail(400,'Informe um e-mail válido.');return email;}

export function issueTrial(store,actor,{email}={}){
 requireAdmin(store,actor);email=emailValue(email);const licenseKey='CC-'+token(),id=randomUUID(),createdAt=Date.now();
 store.transaction(()=>{store.run('INSERT INTO license_invites(id,key_hash,email,created_at,created_by) VALUES(?,?,?,?,?)',id,digest(licenseKey),email||null,createdAt,actor.id);audit(store,actor.id,null,'trial-issued',{inviteId:id,email:email||null,days:TRIAL_DAYS});});
 return {id,licenseKey,trialDays:TRIAL_DAYS,email:email||null,createdAt:new Date(createdAt).toISOString()};
}
// Call inside the same transaction that inserts the user and workspace.
export function redeemTrial(store,{licenseKey,userId,workspaceId,email},now=Date.now()){
 if(typeof licenseKey!=='string'||licenseKey.length>200)throw fail(400,'Informe sua licença de teste.');
 const invite=store.one('SELECT * FROM license_invites WHERE key_hash=?',digest(licenseKey));
 if(!invite||invite.revoked_at||invite.redeemed_at)throw fail(400,'Licença inválida, revogada ou já utilizada.');
 if(invite.email&&invite.email!==emailValue(email))throw fail(400,'Esta licença foi emitida para outro e-mail.');
 if(store.one('SELECT workspace_id FROM subscriptions WHERE workspace_id=?',workspaceId))throw fail(409,'O teste desta conta já foi utilizado.');
 const changed=store.run('UPDATE license_invites SET redeemed_at=?,redeemed_by=? WHERE id=? AND redeemed_at IS NULL AND revoked_at IS NULL',now,userId,invite.id);
 if(Number(changed.changes)!==1)throw fail(409,'Esta licença já foi utilizada.');
 store.run('INSERT INTO subscriptions VALUES(?,?,?,?,?,0)',workspaceId,'trial',now,now+TRIAL_DAYS*DAY,now);
 store.run("INSERT INTO account_roles VALUES(?,'customer')",userId);
 audit(store,invite.created_by,workspaceId,'trial-activated',{inviteId:invite.id,userId,expiresAt:new Date(now+TRIAL_DAYS*DAY).toISOString()});
 return subscription(store,workspaceId,now);
}
export function adminAccounts(store,actor){requireAdmin(store,actor);return store.all("SELECT u.id,u.email,u.workspace_id,u.created_at FROM users u LEFT JOIN team_members m ON m.user_id=u.id WHERE m.role IS NULL OR m.role='owner' ORDER BY u.created_at DESC").map(u=>({id:u.id,email:u.email,workspaceId:u.workspace_id,createdAt:u.created_at,role:roleOf(store,u.id),license:subscription(store,u.workspace_id)}));}
export function adminInvites(store,actor){requireAdmin(store,actor);return store.all('SELECT id,email,created_at,redeemed_at,revoked_at FROM license_invites ORDER BY created_at DESC LIMIT 500').map(i=>({id:i.id,email:i.email,createdAt:new Date(i.created_at).toISOString(),status:i.revoked_at?'revoked':i.redeemed_at?'activated':'available'}));}
export function revokeInvite(store,actor,id){requireAdmin(store,actor);store.transaction(()=>{const row=store.one('SELECT * FROM license_invites WHERE id=?',id);if(!row)throw fail(404,'Licença não encontrada.');if(row.redeemed_at)throw fail(409,'Esta licença já foi ativada. Gerencie a assinatura do cliente.');store.run('UPDATE license_invites SET revoked_at=COALESCE(revoked_at,?) WHERE id=?',Date.now(),id);audit(store,actor.id,null,'trial-revoked',{inviteId:id});});return {ok:true};}

export function updateSubscription(store,actor,workspaceId,input,now=Date.now()){
 requireAdmin(store,actor);
 const target=store.one('SELECT id FROM users WHERE workspace_id=?',workspaceId);
 if(!target)throw fail(404,'Cliente não encontrado.');
 if(roleOf(store,target.id)==='admin')throw fail(400,'A conta de administrador não recebe assinatura de cliente.');
 const current=store.one('SELECT * FROM subscriptions WHERE workspace_id=?',workspaceId);
 const suspensionOnly=input.suspended!==undefined&&input.expiresAt===undefined&&input.days===undefined;
 if(input.suspended!==undefined&&typeof input.suspended!=='boolean')throw fail(400,'Estado de suspensão inválido.');
 let expiresAt=current?.expires_at;
 if(input.days!==undefined){if(!Number.isInteger(input.days)||input.days<1||input.days>3650)throw fail(400,'Informe entre 1 e 3650 dias.');expiresAt=Math.max(now,current?.expires_at||0)+input.days*DAY;}
 else if(input.expiresAt!==undefined){if(typeof input.expiresAt!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(input.expiresAt))throw fail(400,'Informe a validade com fuso horário.');expiresAt=Date.parse(input.expiresAt);}
 if(!suspensionOnly&&(!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+3650*DAY))throw fail(400,'Informe uma validade futura de até 10 anos.');
 if(suspensionOnly&&!current)throw fail(400,'Esta conta ainda não tem uma assinatura.');
 const plan=String(input.plan||current?.plan||'personalizado').trim();
 if(!plan||plan.length>80||(!suspensionOnly&&plan==='trial'))throw fail(400,'Escolha um nome de plano pago. O teste começa automaticamente no cadastro.');
 const suspended=input.suspended===undefined?(current?.suspended||0):Number(input.suspended);
 store.transaction(()=>{store.run('INSERT INTO subscriptions VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET plan=excluded.plan,expires_at=excluded.expires_at,suspended=excluded.suspended',workspaceId,plan,current?.started_at||now,expiresAt,current?.trial_started_at||null,suspended);audit(store,actor.id,workspaceId,'subscription-updated',{before:current?{plan:current.plan,expiresAt:current.expires_at,suspended:!!current.suspended}:null,after:{plan,expiresAt,suspended:!!suspended}});});
 return subscription(store,workspaceId,now);
}
