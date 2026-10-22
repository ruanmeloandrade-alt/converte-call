import {randomUUID} from 'node:crypto';
import {Core} from './database.mjs';
import {assetBytes} from './assets.mjs';
function sourcePatch(store, ws, payload, existing = null) {
 const p = payload || {}, patch = {};
 const type = existing?.source_type || p.source_type;
 if (!['text','promotion','url','document'].includes(type)) throw Error('Tipo inválido.');
 if (existing && p.source_type && p.source_type !== type) throw Error('O tipo da fonte não pode ser alterado.');
 if (!existing || Object.hasOwn(p,'title')) {
  patch.title = String(p.title || '').trim().slice(0,200);
  if (!patch.title) throw Error('Informe o título.');
 }
 if (!existing || Object.hasOwn(p,'content')) patch.content = String(p.content || '').slice(0,120000);
 if (type === 'url' && (!existing || Object.hasOwn(p,'url'))) {
  const url = new URL(p.url);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw Error('Use um link HTTP ou HTTPS sem credenciais.');
  patch.url = url.href;
 }
 if (type === 'document' && (!existing || Object.hasOwn(p,'storage_path'))) {
  const file = store.one('SELECT asset_id FROM asset_aliases WHERE workspace_id=? AND path=?',ws,p.storage_path);
  if (!file) throw Error('Documento não encontrado.');
  assetBytes(store,ws,file.asset_id);
  patch.storage_path = p.storage_path;
  patch.file_name = String(p.file_name || 'documento').slice(0,200);
 }
 if (Object.hasOwn(p,'enabled')) {
  if (typeof p.enabled !== 'boolean') throw Error('Estado da fonte inválido.');
  patch.enabled = p.enabled;
 }
 return patch;
}
export function brainQuery(store,ws,q) {
 const collection={ai_brain_sources:'brainSources',ai_brain_blocked_terms:'brainBlockedTerms'}[q.table];
 if (!collection || !['select','insert','update','delete'].includes(q.action)) throw Object.assign(Error('Operação inválida.'),{status:400});
 const filters=q.filters||[];
 if (!Array.isArray(filters) || filters.some(f=>!Array.isArray(f)||!['id','workspace_id','enabled'].includes(f[0]))) throw Object.assign(Error('Filtro inválido.'),{status:400});
 let result;
 store.mutate(ws,d=>{
  const rows=d[collection],match=r=>filters.every(([key,value])=>key==='workspace_id'?value===ws:r[key]===value);
  if (q.action==='select') {
   result=rows.filter(match);
   if(q.sort==='created_at') result.sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))*(q.ascending?1:-1));
   return;
  }
  if (q.action==='insert') {
   let input=Array.isArray(q.payload)?q.payload:[q.payload];
   if (input.some(p=>!p || p.workspace_id && p.workspace_id!==ws)) throw Object.assign(Error('Workspace inválido.'),{status:403});
   if (collection==='brainBlockedTerms') input=input.flatMap(p=>String(p.term||'').split(/[,;\n\r]+/).map(term=>({...p,term:term.trim().toLocaleLowerCase('pt-BR')}))).filter(p=>p.term);
   if (!input.length) throw Error('Informe um termo ou fonte.');
   if(input.length>(collection==='brainBlockedTerms'?500:50)) throw Error('Limite de itens excedido.');
   result=[];
   for(const p of input) {
    const row={id:randomUUID(),workspace_id:ws,enabled:p.enabled!==false,created_at:new Date().toISOString(),created_by:null};
    if(collection==='brainBlockedTerms') {
     if(p.term.length>200) throw Error('Cada termo aceita até 200 caracteres.');
     const existing=rows.find(r=>r.term.toLocaleLowerCase('pt-BR')===p.term);
     if(existing) continue;
     row.term=p.term;
    } else Object.assign(row,{source_type:p.source_type},sourcePatch(store,ws,p));
    rows.push(row);result.push(row);
    if(collection==='brainSources') store.enqueue(ws,'brain-index',{sourceId:row.id});
   }
   return;
  }
  if(!filters.some(([key])=>key==='id')) throw Error('Selecione a fonte.');
  result=rows.filter(match);
  if(q.action==='update') {
   if(collection!=='brainSources') throw Error('Operação inválida para termos.');
   for(const row of result) {
    const patch=sourcePatch(store,ws,q.payload,row);
    const reindex=Object.keys(patch).some(key=>key!=='enabled'&&patch[key]!==row[key]);
    Object.assign(row,patch,{updated_at:new Date().toISOString()});
    if(reindex) {store.run('DELETE FROM rag_chunks WHERE workspace_id=? AND source_id=?',ws,row.id);store.enqueue(ws,'brain-index',{sourceId:row.id});}
   }
  } else {
   d[collection]=rows.filter(r=>!match(r));
   for(const row of result) store.run('DELETE FROM rag_chunks WHERE workspace_id=? AND source_id=?',ws,row.id);
  }
 });
 return {data:result};
}
export async function indexSource(store,ws,sourceId){const d=store.get(ws),source=d.brainSources.find(s=>s.id===sourceId);if(!source)return;let text=source.content||'';if(source.source_type==='document'){const {row,bytes}=assetBytes(store,ws,store.one('SELECT asset_id FROM asset_aliases WHERE workspace_id=? AND path=?',ws,source.storage_path)?.asset_id);if(/\.(txt|md)$/i.test(row.name))text=bytes.toString('utf8');else throw Error('Indexação de PDF/DOCX aguarda o processador documental. O arquivo foi preservado.');}if(source.source_type==='url')text=[source.title,source.url,source.content].filter(Boolean).join('\n');const chunks=[];for(let i=0;i<text.length;i+=1000)chunks.push(text.slice(i,i+1200));store.transaction(()=>{store.run('DELETE FROM rag_chunks WHERE workspace_id=? AND source_id=?',ws,sourceId);for(const chunk of chunks.slice(0,200))store.run('INSERT INTO rag_chunks VALUES(?,?,?,?,?,?,?)',randomUUID(),ws,sourceId,chunk,null,null,new Date().toISOString());});}
export function knowledge(store,ws,query){const d=store.get(ws),active=new Set(d.brainSources.filter(s=>s.enabled!==false).map(s=>s.id)),words=String(query).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[];const rows=store.all('SELECT * FROM rag_chunks WHERE workspace_id=?',ws).filter(r=>active.has(r.source_id)).map(r=>({...r,score:words.reduce((n,w)=>n+(r.text.toLowerCase().includes(w)?1:0),0)})).sort((a,b)=>b.score-a.score).slice(0,8);return {sources:rows.map(r=>({sourceId:r.source_id,text:r.text})),blockedTerms:d.brainBlockedTerms.map(r=>r.term),links:d.brainSources.filter(s=>s.enabled!==false&&s.source_type==='url').map(s=>s.url),mode:'lexical'};}
export function guardOutgoing(store,ws,text){const d=store.get(ws),normal=globalThis.CCCallFields.normalize(text);for(const term of d.brainBlockedTerms){if(globalThis.CCCallFields.normalize(term.term)&&normal.includes(globalThis.CCCallFields.normalize(term.term)))throw Error('Resposta bloqueada por termo proibido cadastrado no cérebro.');}const urls=String(text).match(/https?:\/\/[^\s<>]+/g)||[],allowed=d.brainSources.filter(s=>s.enabled!==false&&s.source_type==='url').map(s=>s.url);for(const u of urls)if(!allowed.some(link=>u.replace(/[.,;!?)]*$/,'')===link))throw Error('Resposta bloqueada: link não autorizado no cérebro.');}
