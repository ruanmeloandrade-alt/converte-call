import React, {useEffect,useRef,useState} from 'react';
import {BrainCircuit,FileText,Link2,Upload,Tags,ShieldBan,Library,Plus,Pencil,Trash2} from 'lucide-react';
import {extensionWorkspaceId} from './platform';
import {brainRepository as repository} from './brain-repository';
type Kind='text'|'document'|'url'|'promotion';
type Tab=Kind|'blocked'|'sources';
type Source={id:string;title:string;source_type:Kind;content?:string;url?:string;storage_path?:string;file_name?:string;enabled:boolean};
const tabs=[{id:'text',label:'Informações',icon:FileText},{id:'document',label:'Documentos',icon:Upload},{id:'url',label:'Links autorizados',icon:Link2},{id:'promotion',label:'Promoções',icon:Tags},{id:'blocked',label:'Palavras proibidas',icon:ShieldBan},{id:'sources',label:'Fontes cadastradas',icon:Library}] as const;
const inputClass='mt-1 w-full rounded-md border bg-background p-2 text-sm';
const buttonClass='inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50';
export function component(){
 const [workspace,setWorkspace]=useState<string|null>(null),[sources,setSources]=useState<Source[]>([]),[terms,setTerms]=useState<{id:string;term:string}[]>([]);
 const [tab,setTab]=useState<Tab>('text'),[editing,setEditing]=useState<Source|null>(null),[title,setTitle]=useState(''),[content,setContent]=useState(''),[url,setUrl]=useState(''),[file,setFile]=useState<File|null>(null),[draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lock=useRef(false),fileInput=useRef<HTMLInputElement>(null);
 async function load(id:string){
  const [a,b]=await Promise.all([repository.from('ai_brain_sources').select().eq('workspace_id',id).order('created_at',{ascending:false}),repository.from('ai_brain_blocked_terms').select().eq('workspace_id',id).order('term')]);
  if(a.error||b.error)throw Error(a.error?.message||b.error?.message);
  setSources(a.data||[]);setTerms(b.data||[]);
 }
 useEffect(()=>{let mounted=true;(async()=>{const id=await extensionWorkspaceId();if(!mounted)return;setWorkspace(id);await load(id);})().catch(e=>setError(e.message)).finally(()=>{if(mounted)setLoading(false)});return()=>{mounted=false}},[]);
 function clear(){setEditing(null);setTitle('');setContent('');setUrl('');setFile(null);if(fileInput.current)fileInput.current.value='';}
 function choose(next:Tab){if(lock.current)return;clear();setTab(next);setError('');setNotice('');}
 function edit(source:Source){clear();setTab(source.source_type);setEditing(source);setTitle(source.title);setContent(source.content||'');setUrl(source.url||'');setError('');setNotice('');}
 async function perform(action:()=>Promise<void>){if(lock.current||!workspace)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await action();await load(workspace);}catch(e:any){setError(e.message||'Não foi possível salvar. Tente novamente.')}finally{lock.current=false;setBusy(false)}}
 async function save(){await perform(async()=>{
  if(!title.trim())throw Error('Informe o título da fonte.');
  if(tab==='sources'||tab==='blocked')return;
  if(tab==='document'&&!file&&!editing)throw Error('Selecione um documento.');
  let uploaded:string|undefined;
  try{
   const patch:any={title:title.trim(),content,url:tab==='url'?url.trim():undefined};
   if(tab!=='url')delete patch.url;
   if(file&&tab==='document'){
    const ext=file.name.split('.').pop()?.toLowerCase();
    if(!['pdf','docx','txt','md'].includes(ext||''))throw Error('Use PDF, DOCX, TXT ou Markdown.');
    if(file.size>20*1024*1024)throw Error('Limite de 20 MB por documento.');
    uploaded=workspace+'/'+crypto.randomUUID()+'.'+ext;
    const result=await repository.storage.from('saude-slim-brain').upload(uploaded,file);
    if(result.error)throw Error(result.error.message);
    patch.storage_path=uploaded;patch.file_name=file.name;
   }
   const result=editing?await repository.from('ai_brain_sources').update(patch).eq('id',editing.id).eq('workspace_id',workspace):await repository.from('ai_brain_sources').insert({...patch,workspace_id:workspace,source_type:tab,enabled:true});
   if(result.error)throw Error(result.error.message);
   clear();setNotice(editing?'Fonte atualizada.':'Fonte adicionada.');
  }catch(e){if(uploaded)await repository.storage.from('saude-slim-brain').remove([uploaded]);throw e;}
 })}
 async function toggle(source:Source){await perform(async()=>{const r=await repository.from('ai_brain_sources').update({enabled:!source.enabled}).eq('id',source.id).eq('workspace_id',workspace);if(r.error)throw Error(r.error.message)})}
 async function remove(source:Source){if(!window.confirm('Excluir a fonte "'+source.title+'"?'))return;await perform(async()=>{const r=await repository.from('ai_brain_sources').delete().eq('id',source.id).eq('workspace_id',workspace);if(r.error)throw Error(r.error.message);if(editing?.id===source.id)clear();setNotice('Fonte excluída.');})}
 async function addTerms(){await perform(async()=>{
  const list=[...new Set(draft.split(/[,;\n\r]+/).map(t=>t.trim().toLocaleLowerCase('pt-BR')).filter(Boolean))].filter(t=>!terms.some(row=>row.term.toLocaleLowerCase('pt-BR')===t));
  if(!list.length){setDraft('');setNotice('Os termos informados já estão cadastrados.');return;}
  const r=await repository.from('ai_brain_blocked_terms').insert(list.map(term=>({workspace_id:workspace,term})));
  if(r.error)throw Error(r.error.message);setDraft('');setNotice(list.length+' termo(s) adicionado(s) separadamente.');
 })}
 async function removeTerm(id:string){await perform(async()=>{const r=await repository.from('ai_brain_blocked_terms').delete().eq('id',id).eq('workspace_id',workspace);if(r.error)throw Error(r.error.message)})}
 const visible=sources.filter(s=>tab==='sources'||s.source_type===tab);
 const active=tabs.find(t=>t.id===tab)!;
 return <main className="min-w-0 space-y-5 p-4 md:p-6 text-foreground">
  <header><h1 className="flex items-center gap-2 text-2xl font-bold"><BrainCircuit/> Cérebro IA</h1><p className="mt-2 text-sm text-muted-foreground">Informações da sua empresa para orientar os agentes de atendimento.</p></header>
  <div role="tablist" aria-label="Seções do Cérebro IA" className="flex flex-wrap gap-2">{tabs.map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} aria-controls={'brain-panel-'+t.id} id={'brain-tab-'+t.id} disabled={busy} onClick={()=>choose(t.id)} className={buttonClass+(tab===t.id?' bg-primary text-primary-foreground':' bg-card hover:bg-muted')}><t.icon size={16}/>{t.label}</button>)}</div>
  {error&&<p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="rounded-md border p-3 text-sm">{notice}</p>}
  {loading?<p role="status">Carregando sua base…</p>:<section role="tabpanel" id={'brain-panel-'+tab} aria-labelledby={'brain-tab-'+tab} className="space-y-5">
   <h2 className="text-lg font-semibold">{active.label}</h2>
   {tab==='blocked'?<>
    <div className="rounded-xl border bg-card p-5"><label className="block text-sm">Adicionar palavras ou expressões<textarea aria-label="Novas palavras proibidas" value={draft} onChange={e=>setDraft(e.target.value)} className={inputClass+' min-h-24'} placeholder="Separe por vírgula, ponto e vírgula ou quebra de linha."/></label><p className="mt-2 text-xs text-muted-foreground">Cada item será cadastrado separadamente. Expressões com espaços permanecem juntas.</p><button disabled={busy||!draft.trim()} className={buttonClass+' mt-3 bg-primary text-primary-foreground'} onClick={addTerms}><Plus size={16}/>Adicionar termos</button></div>
    <div className="flex flex-wrap gap-2" aria-label="Termos cadastrados">{terms.map(t=><div key={t.id} className="flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-sm"><span>{t.term}</span><button aria-label={'Remover '+t.term} disabled={busy} onClick={()=>removeTerm(t.id)}><Trash2 size={14}/></button></div>)}</div>{!terms.length&&<p className="text-sm text-muted-foreground">Nenhum termo cadastrado.</p>}
   </>:<>
    {tab!=='sources'&&<form onSubmit={e=>{e.preventDefault();void save()}} className="rounded-xl border bg-card p-5 space-y-3">
     <h3 className="font-semibold">{editing?'Editar fonte':'Adicionar '+(tab==='url'?'link autorizado':tab==='promotion'?'promoção':tab==='document'?'documento':'informação')}</h3>
     <label className="block text-sm">Título<input required value={title} onChange={e=>setTitle(e.target.value)} className={inputClass} maxLength={200}/></label>
     {tab==='url'?<label className="block text-sm">Endereço da página<input required type="url" value={url} onChange={e=>setUrl(e.target.value)} className={inputClass} placeholder="https://..."/></label>:tab==='document'?<label className="block text-sm">{editing?'Substituir documento (opcional)':'Documento (até 20 MB)'}<input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.md" onChange={e=>setFile(e.target.files?.[0]||null)} className="mt-2 block max-w-full"/>{editing?.file_name&&<span className="mt-2 block text-xs text-muted-foreground">Atual: {editing.file_name}. Deixe sem arquivo para manter.</span>}</label>:<label className="block text-sm">Conteúdo<textarea value={content} onChange={e=>setContent(e.target.value)} className={inputClass+' min-h-36'}/></label>}
     <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy||!workspace} className={buttonClass+' bg-primary text-primary-foreground'}>{busy?'Salvando…':editing?'Salvar alterações':'Adicionar fonte'}</button>{editing&&<button type="button" disabled={busy} className={buttonClass} onClick={clear}>Cancelar edição</button>}</div>
    </form>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Fontes cadastradas">{visible.map(source=><article key={source.id} className="min-w-0 rounded-xl border bg-card p-4 flex flex-col gap-3"><div><h3 className="font-semibold break-words">{source.title}</h3><p className="text-xs text-muted-foreground">{tabs.find(t=>t.id===source.source_type)?.label} · {source.enabled?'Ativo':'Pausado'}</p></div><p className="text-sm break-words text-muted-foreground">{source.url||source.file_name||(source.content||'').slice(0,180)}</p><div className="mt-auto flex flex-wrap gap-2"><button disabled={busy} className={buttonClass} aria-label={'Editar '+source.title} onClick={()=>edit(source)}><Pencil size={14}/>Editar</button><button disabled={busy} className={buttonClass} onClick={()=>toggle(source)} aria-label={(source.enabled?'Desativar ':'Ativar ')+source.title}>{source.enabled?'Desativar':'Ativar'}</button><button disabled={busy} className={buttonClass+' text-destructive'} aria-label={'Excluir '+source.title} onClick={()=>remove(source)}><Trash2 size={14}/></button></div></article>)}</div>
    {!visible.length&&<p className="text-sm text-muted-foreground">Nenhuma fonte nesta seção.</p>}
   </>}
  </section>}
 </main>
}
