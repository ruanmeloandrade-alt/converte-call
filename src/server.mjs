import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {Store,Core} from './database.mjs';
import {hashPassword,checkPassword,token,digest,same,cleanJSON} from './security.mjs';
import {Evolution} from './evolution.mjs';
import {Worker} from './worker.mjs';
import {rpc} from './rpc.mjs';
import {installPixelSchema,createPixel,pixelScript,pixelSnippet,ingestPixel,pixelStats} from './pixel.mjs';
import {brainQuery,knowledge} from './brain.mjs';
import {uploadAsset,removeAsset,verifyAsset,assetPath,purgeExpired} from './assets.mjs';
import {roleOf,subscription,requireSubscription,requireAdmin,issueTrial,redeemTrial,adminAccounts,adminInvites,revokeInvite,updateSubscription} from './licensing.mjs';
const contract=JSON.parse(readFileSync(new URL('../vendor/rpc-contract.json',import.meta.url)));
const error=(status,message)=>Object.assign(Error(message),{status});
export function createApp({dir=process.env.DATA_DIR||'data',master=process.env.ENCRYPTION_KEY,bootstrap=process.env.BOOTSTRAP_TOKEN,evolutionOptions}={}){
 const store=new Store(dir,master),evolution=new Evolution(store,evolutionOptions),worker=new Worker(store,evolution),limits=new Map();installPixelSchema(store);
 function limit(key,max,ms=60000){const now=Date.now();let r=limits.get(key);if(!r||r.until<now){r={n:0,until:now+ms};limits.set(key,r);}if(++r.n>max)throw error(429,'Muitas tentativas. Aguarde um minuto.');if(limits.size>10000)for(const [k,v]of limits)if(v.until<now)limits.delete(k);}
 function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
 async function body(req,max=30*1024*1024){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>max)throw error(413,'Arquivo ou requisição excede o limite.');chunks.push(c);}try{return cleanJSON(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'));}catch(e){if(e.status)throw e;throw error(400,'JSON inválido.');}}
 function authenticate(req){const credential=String(req.headers.authorization||'');if(!credential.startsWith('Bearer '))throw error(401,'Entre na sua conta.');const session=store.one('SELECT u.*,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?',digest(credential.slice(7)));if(!session||session.expires_at<Date.now())throw error(401,'Sessão expirada ou substituída por outro acesso.');return session;}
 function session(user){const accessToken=token();store.transaction(()=>{store.run('DELETE FROM sessions WHERE user_id=?',user.id);store.run('INSERT INTO sessions VALUES(?,?,?)',digest(accessToken),user.id,Date.now()+12*3600000);});return {accessToken,expiresIn:43200,workspaceId:user.workspace_id,role:roleOf(store,user.id),license:subscription(store,user.workspace_id)};}
 async function handle(req,res){const url=new URL(req.url,'http://localhost'),path=url.pathname;res.setHeader('Referrer-Policy','no-referrer');const origin=String(req.headers.origin||'');if(origin.startsWith('chrome-extension://')||origin===process.env.PUBLIC_URL?.replace(/\/$/,'')){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,Idempotency-Key');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');}if(req.method==='OPTIONS'&&!path.startsWith('/p/')){res.writeHead(204);res.end();return;}
 if(req.method==='GET'&&/^\/p\/[a-f0-9]{40}\.js$/.test(path)){const key=path.split('/').at(-1).slice(0,-3),pixel=store.one('SELECT id,workspace_id FROM pixels WHERE public_key=? AND enabled=1',key);if(!pixel)throw error(404,'Pixel não encontrado.');requireSubscription(store,pixel.workspace_id);res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'});return res.end(pixelScript(process.env.PUBLIC_URL,key));}
 if(/^\/p\/[a-f0-9]{40}\/events$/.test(path)){const key=path.split('/')[2],pixel=store.one('SELECT origin,workspace_id FROM pixels WHERE public_key=? AND enabled=1',key);if(pixel?.origin===origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');}if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}if(req.method!=='POST')throw error(405,'Método inválido.');if(pixel)requireSubscription(store,pixel.workspace_id);limit('pixel:'+key+':'+req.socket.remoteAddress,240);return send(res,202,ingestPixel(store,key,origin,await body(req,5000)));}
 if(req.method==='GET'&&path==='/health/ready'){store.one('SELECT 1');return send(res,200,{status:'ready',version:'0.9.0',storage:'persistent-sqlite',evolutionConfigured:!!evolution.baseUrl&&!!evolution.key});}
 if(req.method==='GET'&&['/','/setup','/activate','/admin'].includes(path)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'",'Cache-Control':'no-store'});return res.end(readFileSync(new URL(path==='/admin'?'../public/admin.html':'../public/setup.html',import.meta.url)));}
 if(req.method==='GET'&&['/setup.js','/setup.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});return res.end(readFileSync(new URL('../public'+path,import.meta.url)));}
 if(req.method==='GET'&&['/admin.js','/admin.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});return res.end(readFileSync(new URL('../public'+path,import.meta.url)));}
 if(req.method==='GET'&&path.startsWith('/v1/assets/')){const id=path.split('/').at(-1),row=verifyAsset(store,id,url.searchParams);requireSubscription(store,row.workspace_id);const buffer=readFileSync(assetPath(store,id));res.writeHead(200,{'Content-Type':row.mime,'Content-Length':buffer.length,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(row.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(buffer);}
 if(req.method==='POST'&&path.startsWith('/v1/hooks/evolution/')){limit('hook:'+req.socket.remoteAddress,600);return send(res,200,evolution.receive(path.split('/').at(-1),await body(req,5*1024*1024)));}
 if(req.method==='POST'&&path==='/v1/auth/bootstrap'){limit('bootstrap:'+req.socket.remoteAddress,5);const b=await body(req,2000);if(!bootstrap||!same(b.token,bootstrap)||store.one('SELECT id FROM users LIMIT 1'))throw error(403,'Cadastro inicial indisponível.');const email=String(b.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw error(400,'Informe um e-mail válido.');const credentials=await hashPassword(b.password),user=store.transaction(()=>{if(store.one('SELECT id FROM users LIMIT 1'))throw error(409,'Conta já criada.');const workspace_id=store.createWorkspace(),id=randomUUID();store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',id,email,credentials.hash,credentials.salt,workspace_id,new Date().toISOString());store.run("INSERT INTO account_roles VALUES(?,'admin')",id);return {id,workspace_id};});return send(res,201,session(user));}
 if(req.method==='POST'&&path==='/v1/auth/session'){limit('login:'+req.socket.remoteAddress,10);const b=await body(req,2000),user=store.one('SELECT * FROM users WHERE email=?',String(b.email||'').trim().toLowerCase());if(!user||!await checkPassword(b.password,user))throw error(401,'E-mail ou senha incorretos.');return send(res,200,session(user));}
 if(req.method==='POST'&&path==='/v1/auth/register'){
  limit('register:'+req.socket.remoteAddress,5);const b=await body(req,3000),email=String(b.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw error(400,'Informe um e-mail válido.');
  if(store.one('SELECT id FROM users WHERE email=?',email))throw error(409,'Este e-mail já está cadastrado. Entre na sua conta.');
  const credentials=await hashPassword(b.password),user=store.transaction(()=>{
   if(store.one('SELECT id FROM users WHERE email=?',email))throw error(409,'Este e-mail já está cadastrado.');
   const workspace_id=store.createWorkspace(),id=randomUUID();
   store.run('INSERT INTO users VALUES(?,?,?,?,?,?)',id,email,credentials.hash,credentials.salt,workspace_id,new Date().toISOString());
   redeemTrial(store,{licenseKey:b.licenseKey,userId:id,workspaceId:workspace_id,email});return {id,workspace_id};
  });return send(res,201,session(user));
 }
 const user=authenticate(req),ws=user.workspace_id;limit('account:'+user.id,300);
 if(req.method==='GET'&&path==='/v1/account/license')return send(res,200,{role:roleOf(store,user.id),license:subscription(store,ws)});
 if(path.startsWith('/v1/admin/')){
  requireAdmin(store,user);
  if(req.method==='GET'&&path==='/v1/admin/accounts')return send(res,200,{accounts:adminAccounts(store,user)});
  if(req.method==='GET'&&path==='/v1/admin/licenses')return send(res,200,{licenses:adminInvites(store,user)});
  if(req.method==='POST'&&path==='/v1/admin/licenses'){
   const issued=issueTrial(store,user,await body(req,2000));
   const activationUrl=process.env.PUBLIC_URL?new URL('/activate#license='+issued.licenseKey,process.env.PUBLIC_URL).href:null;
   return send(res,201,{...issued,activationUrl});
  }
  const revoke=path.match(/^\/v1\/admin\/licenses\/([a-f0-9-]{36})$/);
  if(req.method==='DELETE'&&revoke)return send(res,200,revokeInvite(store,user,revoke[1]));
  const target=path.match(/^\/v1\/admin\/accounts\/([a-f0-9-]{36})\/subscription$/);
  if(req.method==='PATCH'&&target)return send(res,200,{license:updateSubscription(store,user,target[1],await body(req,3000))});
  if(req.method==='GET'&&path==='/v1/admin/license-audit')return send(res,200,{events:store.all('SELECT id,actor_id,workspace_id,action,details,created_at FROM license_audit ORDER BY created_at DESC LIMIT 300')});
  throw error(404,'Rota administrativa não encontrada.');
 }
 if(req.method==='POST'&&path==='/v1/auth/logout'){store.run('DELETE FROM sessions WHERE user_id=?',user.id);return send(res,200,{ok:true});}
 requireSubscription(store,ws);
 if(req.method==='GET'&&path==='/v1/workspace'){return send(res,200,{workspace:store.get(ws),revision:store.revision(ws)});}
 if(req.method==='POST'&&path==='/v1/workspace/import'){const b=await body(req);const result=store.mutate(ws,d=>{if(d.importedAt||d.leads.length||d.bots.length||d.agents.length)throw error(409,'Conta já tem dados. Use sincronização, sem substituir o banco.');const next=b.workspace;if(!next||!Array.isArray(next.leads)||!Array.isArray(next.funnels))throw error(400,'Workspace inválido.');for(const k of Object.keys(next))if(!['workspaceId','connections','syncCursor','integration'].includes(k))d[k]=next[k];d.workspaceId=ws;d.importedAt=new Date().toISOString();return {imported:true};});return send(res,201,result);}
 if(req.method==='PUT'&&path==='/v1/workspace/definitions'){const b=await body(req);if(b.schemaVersion!==4)throw error(400,'Versão de definições inválida.');store.mutate(ws,d=>{for(const key of ['funnels','bots','agents','rules','knowledge','customFields','workflows','slimStageAutomations','crmAgents']){if(b[key]!==undefined){if(!Array.isArray(b[key]))throw error(400,'Coleção inválida: '+key);d[key]=b[key];}}if(b.brain)d.brain=b.brain;});return send(res,200,{accepted:true,revision:store.revision(ws)});}
 if(req.method==='GET'&&path==='/v1/workspace/events'){const cursor=Number(url.searchParams.get('cursor')||0);if(!Number.isSafeInteger(cursor)||cursor<0)throw error(400,'Cursor inválido.');const events=store.all('SELECT sequence,payload FROM events WHERE workspace_id=? AND sequence>? ORDER BY sequence LIMIT 1000',ws,cursor);return send(res,200,{events:events.map(e=>JSON.parse(e.payload)),cursor:String(events.at(-1)?.sequence||cursor)});}
 if(req.method==='PUT'&&path==='/v1/projects/definitions'){const b=await body(req);if(b.schemaVersion!==1||!Array.isArray(b.projects)||!Array.isArray(b.tasks)||!Array.isArray(b.rules))throw error(400,'Projetos inválidos.');store.mutate(ws,d=>{d.projects=b.projects;d.tasks=b.tasks;d.projectRules=b.rules;});return send(res,200,{accepted:true,revision:store.revision(ws)});}
 if(path==='/v1/whatsapp/session'&&req.method==='POST')return send(res,200,await evolution.connect(ws));
 if(path==='/v1/whatsapp/session'&&req.method==='GET')return send(res,200,await evolution.status(ws));
 if(path==='/v1/whatsapp/lead'&&req.method==='PATCH'){const b=await body(req,10000);store.mutate(ws,d=>{const l=d.leads.find(l=>l.id===b.leadId);if(!l)throw error(404,'Cliente não encontrado.');if(b.patch?.tags)l.tags=[...new Set(b.patch.tags.map(t=>String(t).slice(0,60)))].slice(0,30);if(b.patch?.stageId){const f=d.funnels.find(f=>f.id===b.patch.funnelId),s=f?.stages.find(s=>s.id===b.patch.stageId);if(!s)throw error(400,'Etapa inválida.');Core.moveLead(d,l,s.name,f.id);}store.event(ws,{type:'lead-updated',leadId:l.id});});return send(res,200,{ok:true});}
 if(path==='/v1/whatsapp/dispatch'&&req.method==='POST')throw error(503,'O executor de bots/agentes ainda está em integração. Nenhuma mensagem foi enviada.');
 if(path==='/v1/whatsapp/stop'&&req.method==='POST'){const b=await body(req,10000);store.transaction(()=>{const rows=store.all("SELECT id,asset_id FROM runs WHERE workspace_id=? AND lead_id=? AND kind=? AND status IN ('active','running','queued','waiting')",ws,b.leadId,b.kind);for(const r of rows){store.run("UPDATE runs SET status='stopped',updated_at=? WHERE id=?",new Date().toISOString(),r.id);store.run("UPDATE jobs SET status='cancelled' WHERE run_id=? AND status='pending'",r.id);store.event(ws,{type:'automation',leadId:b.leadId,kind:b.kind,assetId:r.asset_id,runId:r.id,status:'stopped'});}});return send(res,200,{status:'stopped'});}
 if(path==='/v1/slim/rpc'&&req.method==='POST'){const b=await body(req);if(!contract[b.module]?.includes(b.method))throw error(403,'Operação fora do contrato.');const result=await rpc(store,ws,b.module,b.method,b.data);return send(res,200,result);}
 if(path==='/v1/brain/query'&&req.method==='POST')return send(res,200,brainQuery(store,ws,await body(req)));
 if(path==='/v1/brain/assets'&&req.method==='POST'){const b=await body(req);if(b.operation==='upload'){if(typeof b.path!=='string'||b.path.length>2000||b.path.includes('..'))throw error(400,'Caminho inválido.');if(store.one('SELECT asset_id FROM asset_aliases WHERE workspace_id=? AND path=?',ws,b.path))throw error(409,'Arquivo já existe.');const asset=uploadAsset(store,ws,b);store.run('INSERT INTO asset_aliases VALUES(?,?,?)',ws,b.path,asset.path);return send(res,201,{data:{path:b.path}});}if(b.operation==='delete'){const asset=store.one('SELECT asset_id FROM asset_aliases WHERE workspace_id=? AND path=?',ws,b.path);if(!asset)throw error(404,'Arquivo não encontrado.');removeAsset(store,ws,asset.asset_id);store.run('DELETE FROM asset_aliases WHERE workspace_id=? AND path=?',ws,b.path);return send(res,200,{data:null});}throw error(400,'Operação inválida.');}
 if(path==='/v1/brain/search'&&req.method==='POST'){const b=await body(req,10000);return send(res,200,knowledge(store,ws,b.query));}
 if(path==='/v1/tracking/pixels'&&req.method==='GET'){return send(res,200,{pixels:pixelStats(store,ws,url.searchParams.get('days')).map(p=>({...p,snippet:pixelSnippet(p,process.env.PUBLIC_URL)}))});}
 if(path==='/v1/tracking/pixels'&&req.method==='POST'){const row=createPixel(store,ws,await body(req,5000));return send(res,201,{pixel:row,snippet:pixelSnippet(row,process.env.PUBLIC_URL)});}
 if(path==='/v1/ai/credentials'&&req.method==='PUT'){const b=await body(req,3000);if(!/^sk-[A-Za-z0-9_-]{15,}$/.test(b.apiKey||''))throw error(400,'Chave inválida.');store.secret(ws,'openai',{apiKey:b.apiKey,model:String(b.model||'').slice(0,100)});return send(res,200,{configured:true});}
 throw error(404,'Rota não encontrada.');
 }
 const server=http.createServer((req,res)=>{handle(req,res).catch(e=>{if(!res.headersSent)send(res,e.status||500,{error:{message:e.status?e.message:'Falha no servidor. Consulte o registro de operação.'}});else res.end();if(!e.status)console.error(JSON.stringify({type:'request-failed',requestId:randomUUID(),errorName:e.name}));});});server.requestTimeout=60000;server.headersTimeout=15000;
 let timer;return {server,store,evolution,worker,startWorker(){timer=setInterval(()=>worker.tick().catch(e=>console.error(JSON.stringify({type:'worker-failed',name:e.name}))),5000);timer.unref();worker.tick();},close(){clearInterval(timer);return new Promise(resolve=>server.close(()=>{store.close();resolve();}));}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=createApp();app.server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>{app.startWorker();console.log(JSON.stringify({type:'listening',port:Number(process.env.PORT)||8080,version:'0.9.0'}));});const cleanup=setInterval(()=>purgeExpired(app.store),60000);cleanup.unref();process.on('SIGTERM',()=>app.close().then(()=>process.exit(0)));}
