import {guardCompanyAddress} from './companies.mjs';
import {installInboxData,queueInboxHistory} from './inbox-data.mjs';
import {randomUUID} from 'node:crypto';
import {token,digest,same} from './security.mjs';
const qrImage=value=>{const raw=String(value||'');if(!raw||raw.length>1000000)return null;const normalized=raw.startsWith('data:image/png;base64,')?raw:'data:image/png;base64,'+raw;return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(normalized)?normalized:null;};
function installConnectionSlots(store){
 const columns=new Set(store.all('PRAGMA table_info(instances)').map(column=>column.name));
 if(columns.has('slot'))return;
 const expires=columns.has('qr_expires_at')?'qr_expires_at':'NULL';
 store.transaction(()=>store.db.exec(`
  CREATE TABLE instances_with_slots(
   workspace_id TEXT NOT NULL,slot INTEGER NOT NULL DEFAULT 1 CHECK(slot BETWEEN 1 AND 3),
   instance_name TEXT NOT NULL UNIQUE,hook_hash TEXT NOT NULL,credentials TEXT NOT NULL,
   status TEXT NOT NULL DEFAULT 'created',phone TEXT,qr TEXT,updated_at TEXT NOT NULL,qr_expires_at INTEGER,
   PRIMARY KEY(workspace_id,slot)
  );
  INSERT INTO instances_with_slots(workspace_id,instance_name,hook_hash,credentials,status,phone,qr,updated_at,qr_expires_at)
   SELECT workspace_id,instance_name,hook_hash,credentials,status,phone,qr,updated_at,${expires} FROM instances;
  DROP TABLE instances;
  ALTER TABLE instances_with_slots RENAME TO instances;
  CREATE INDEX instances_hook ON instances(hook_hash);
 `));
}
function validateSlot(slot){
 if(!Number.isInteger(slot)||slot<1||slot>3)throw Object.assign(Error('Conexão de WhatsApp inválida.'),{status:400});
 return slot;
}
export class Evolution{
 constructor(store,{baseUrl=process.env.EVOLUTION_URL,key=process.env.EVOLUTION_API_KEY,publicUrl=process.env.PUBLIC_URL,fetcher=fetch}={}){Object.assign(this,{store,baseUrl,key,publicUrl,fetcher});this.connecting=new Map();installInboxData(store);installConnectionSlots(store);}
 config(){if(!this.baseUrl||!this.key)throw Object.assign(Error('Conexão WhatsApp aguarda configuração do servidor.'),{status:503});const u=new URL(this.baseUrl);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&u.hostname.endsWith('.railway.internal'))&&process.env.NODE_ENV!=='test')throw Error('Evolution exige HTTPS público ou a rede privada da Railway.');return {url:u,key:this.key};}
 async request(path,{method='GET',body,instanceKey}={}){const c=this.config(),r=await this.fetcher(new URL(path.replace(/^\//,''),c.url.href.replace(/\/?$/,'/')),{method,headers:{apikey:instanceKey||c.key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error('Conexão WhatsApp: HTTP '+r.status+'.'),{status:502,providerStatus:r.status});return data;}
 instance(ws,slot=1){return this.store.one('SELECT * FROM instances WHERE workspace_id=? AND slot=?',ws,validateSlot(slot));}
 connections(ws){return this.store.all('SELECT slot,status,phone FROM instances WHERE workspace_id=? ORDER BY slot',ws);}
 async connect(ws,slot=1){const key=ws+':'+validateSlot(slot);if(this.connecting.has(key))return this.connecting.get(key);const promise=this.connectInstance(ws,slot).finally(()=>this.connecting.delete(key));this.connecting.set(key,promise);return promise;}
 async connectInstance(ws,slot=1){this.config();if(!this.publicUrl)throw Error('PUBLIC_URL não configurada.');let row=this.instance(ws,slot);if(!row){const name='cc-'+randomUUID().replaceAll('-',''),hook=token(),instanceKey=token(),at=new Date().toISOString();this.store.run('INSERT INTO instances(workspace_id,slot,instance_name,hook_hash,credentials,updated_at) VALUES(?,?,?,?,?,?)',ws,slot,name,digest(hook),this.store.vault.seal({hook,instanceKey}),at);row=this.instance(ws,slot);}
 const creds=this.store.vault.open(row.credentials),webhook={url:new URL('v1/hooks/evolution/'+creds.hook,this.publicUrl.replace(/\/?$/,'/')).href,byEvents:false,base64:false,events:['QRCODE_UPDATED','MESSAGES_UPSERT','MESSAGES_UPDATE','CONNECTION_UPDATE','CALL']};
 // Check only this workspace's reserved instance. Never reuse/reset another app's instance.
 try{await this.request('/instance/connectionState/'+row.instance_name,{instanceKey:creds.instanceKey});}catch(e){if(e.providerStatus!==404)throw e;await this.request('/instance/create',{method:'POST',body:{instanceName:row.instance_name,token:creds.instanceKey,integration:'WHATSAPP-BAILEYS',qrcode:true,groupsIgnore:true,readMessages:false,readStatus:false,syncFullHistory:true,webhook}});}
 await this.request('/webhook/set/'+row.instance_name,{method:'POST',instanceKey:creds.instanceKey,body:{webhook:{...webhook,enabled:true}}});
 const status=await this.status(ws,slot);if(status.status==='connected')return status;const result=await this.request('/instance/connect/'+row.instance_name,{instanceKey:creds.instanceKey}),qr=qrImage(result.base64||result.qrcode?.base64);if(qr)this.store.run('UPDATE instances SET qr=?,qr_expires_at=?,updated_at=? WHERE workspace_id=? AND slot=?',qr,Date.now()+45000,new Date().toISOString(),ws,slot);else this.store.run('UPDATE instances SET qr=NULL,qr_expires_at=NULL WHERE workspace_id=? AND slot=?',ws,slot);return {status:'waiting_qr',qrDataUrl:qr,qrExpiresAt:qr?Date.now()+45000:null};}

 async status(ws,slot=1){const row=this.instance(ws,slot);if(!row)return {status:'disconnected',phone:null};const creds=this.store.vault.open(row.credentials),result=await this.request('/instance/connectionState/'+row.instance_name,{instanceKey:creds.instanceKey}),state=result.instance?.state||'close',status=state==='open'?'connected':state==='connecting'?'waiting_qr':'disconnected';if(row.status!==status)this.store.run('UPDATE instances SET status=?,updated_at=? WHERE workspace_id=? AND slot=?',status,new Date().toISOString(),ws,slot);if(status==='connected'&&slot===1)queueInboxHistory(this.store,ws);return {status,phone:row.phone,qrDataUrl:state==='open'||!row.qr_expires_at||row.qr_expires_at<=Date.now()?null:qrImage(row.qr),qrExpired:state!=='open'&&!!row.qr_expires_at&&row.qr_expires_at<=Date.now(),qrExpiresAt:row.qr_expires_at};}
 async scoped(ws,path,body,method='POST',slot=1){const row=this.instance(ws,slot);if(!row)throw Object.assign(Error('Conecte seu WhatsApp.'),{status:409});const c=this.store.vault.open(row.credentials);return this.request(path+row.instance_name,{method,instanceKey:c.instanceKey,body});}
 async history(ws,page=1,remoteJid,slot=1){return this.scoped(ws,'/chat/findMessages/',{where:remoteJid?{key:{remoteJid}}:{},page,offset:100},'POST',slot);}
 async sendMedia(ws,phone,input,slot=1){guardCompanyAddress(this.store.get(ws),phone);if(!/^[1-9]\d{7,14}$/.test(phone)||!['image','video','audio','document'].includes(input.kind)||typeof input.base64!=='string'||input.base64.length>28000000||!input.base64||!/^[A-Za-z0-9+/]+=*$/.test(input.base64))throw Object.assign(Error('Destinatário ou arquivo inválido (até20MB).'),{status:400});return input.kind==='audio'?this.scoped(ws,'/message/sendWhatsAppAudio/',{number:phone,audio:input.base64,encoding:true},'POST',slot):this.scoped(ws,'/message/sendMedia/',{number:phone,mediatype:input.kind,mimetype:input.mimeType,media:input.base64,caption:String(input.caption||'').slice(0,20000),fileName:String(input.fileName||'arquivo').slice(0,200)},'POST',slot);}
 async send(ws,phone,text,slot=1){guardCompanyAddress(this.store.get(ws),phone);const row=this.instance(ws,slot);if(!row)throw Error('Conecte seu WhatsApp primeiro.');if(!/^\d{8,15}$/.test(phone)||!text?.trim())throw Object.assign(Error('Destinatário ou texto inválido.'),{status:400});const creds=this.store.vault.open(row.credentials);return this.request('/message/sendText/'+row.instance_name,{method:'POST',instanceKey:creds.instanceKey,body:{number:phone,text:text.slice(0,20000),linkPreview:false}});}
 receive(hook,payload){const row=this.store.one('SELECT * FROM instances WHERE hook_hash=?',digest(hook));if(!row||!same(digest(hook),row.hook_hash)||payload.instance!==row.instance_name)throw Object.assign(Error('Webhook não autorizado.'),{status:401});const event=String(payload.event||'').toLowerCase().replaceAll('_','.');const ws=row.workspace_id,slot=row.slot;
 return this.store.transaction(()=>{if(event==='connection.update'){const phone=String(payload.data?.instance?.wuid||payload.data?.wuid||'').split('@')[0].replace(/\D/g,'');if(row.phone&&phone&&row.phone!==phone)throw Object.assign(Error('Esta conexão permite apenas o número já vinculado.'),{status:409});if(phone&&this.store.one('SELECT slot FROM instances WHERE workspace_id=? AND slot<>? AND phone=?',ws,slot,phone))throw Object.assign(Error('Esse número já está vinculado a outra conexão desta conta.'),{status:409});this.store.run('UPDATE instances SET status=?,phone=COALESCE(NULLIF(?,\'\'),phone),qr=NULL,qr_expires_at=NULL,updated_at=? WHERE workspace_id=? AND slot=?',payload.data?.state==='open'?'connected':'disconnected',phone,new Date().toISOString(),ws,slot);this.store.event(ws,{type:'connection',slot,status:payload.data?.state==='open'?'connected':'disconnected'});return {accepted:true};}
 if(event==='qrcode.updated'){const qr=qrImage(payload.data?.qrcode?.base64);if(qr)this.store.run('UPDATE instances SET qr=?,qr_expires_at=?,updated_at=? WHERE workspace_id=? AND slot=?',qr,Date.now()+45000,new Date().toISOString(),ws,slot);return {accepted:true};}
 const rows=Array.isArray(payload.data)?payload.data:[payload.data];for(const item of rows){if(!item)continue;const messageId=item.key?.id||item.id;if(!messageId)continue;const id=digest(row.instance_name+':'+event+':'+messageId);this.store.run('INSERT OR IGNORE INTO inbound(id,workspace_id,payload,created_at) VALUES(?,?,?,?)',id,ws,JSON.stringify({event,data:item,...(slot===1?{}:{connectionSlot:slot})}),new Date().toISOString());}return {accepted:true};});}
}
