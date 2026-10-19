import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {getLeadSales,saveLeadSale} from '@/lib/leads.functions';
export const isSaleLabel=(label:string)=>['venda','valor da venda','valor venda','valor vendido','total da venda','receita da venda'].includes(label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s*\(r\$\)$/,'').trim());
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const day=(s:string)=>s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR'):'Data não informada';
const input='w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
export function LeadSalesPanel({leadId}:{leadId:string}){
 const query=useQueryClient(),[sales,setSales]=useState<any[]>([]),[draft,setDraft]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const load=async()=>{setError('');try{const r=await getLeadSales({data:{leadId}});setSales(r.sales);setLoaded(true);}catch(e:any){setError(e.message);}};
 useEffect(()=>{setLoaded(false);setDraft(null);setSales([]);let active=true;getLeadSales({data:{leadId}}).then((r:any)=>{if(active){setSales(r.sales);setLoaded(true);}}).catch((e:any)=>active&&setError(e.message));return()=>{active=false;};},[leadId]);
 const change=(key:string,value:any)=>setDraft((d:any)=>({...d,[key]:value}));
 const part=(key:string,field:string,value:any)=>setDraft((d:any)=>({...d,payments:{...d.payments,[key]:{...d.payments[key],[field]:value}}}));
 const edit=(sale:any)=>setDraft({...sale,soldOn:sale.soldOn||today(),payments:sale.payments?structuredClone(sale.payments):{entry:{amount:sale.amount,received:false,date:''},delivery:{amount:0,received:false,date:''}}});
 const save=async()=>{setBusy(true);setError('');try{const r=await saveLeadSale({data:{...draft,leadId}});setSales(r.sales);setDraft(null);query.invalidateQueries();window.dispatchEvent(new Event('cc-dashboard-refresh'));}catch(e:any){setError(e.message);}finally{setBusy(false);}};
 const active=sales.filter(s=>!['cancelled','canceled','cancelado','cancelada','refunded','reembolsado'].includes(s.status));
 return <section className="rounded-xl border border-border bg-card p-3 space-y-3" aria-label="Vendas do cliente">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-sm">Venda</h3><p className="text-xs text-muted-foreground">{active.length} venda(s) · {money(active.reduce((n,s)=>n+s.amount,0))}</p></div><button type="button" disabled={!loaded||busy||!!draft} className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs" onClick={()=>edit({id:crypto.randomUUID(),title:'',amount:0,status:'registered'})}>+ Adicionar venda</button></div>
  <p className="text-xs text-muted-foreground">Registre vendas anteriores e novas vendas deste cliente, com entrada e entrega separadas.</p>
  {!loaded&&!error&&<p className="text-xs">Carregando vendas…</p>}
  {error&&<div role="alert" className="text-sm text-destructive">{error} <button type="button" onClick={load} className="underline">Atualizar histórico</button></div>}
  <div className="space-y-2 max-h-64 overflow-y-auto">{sales.map(s=><article key={s.id} className="rounded-lg border border-border p-3 text-xs space-y-1"><div className="flex justify-between gap-2"><strong className="break-words">{s.title||s.productName||'Venda'}</strong><strong className="shrink-0">{money(s.amount)}</strong></div><p className="text-muted-foreground">{day(s.soldOn||(s.origin==='custom-field-import'?null:s.created?.slice(0,10)))}{s.status==='cancelled'?' · Cancelada':''}{s.legacy?' · Campo anterior preservado':''}</p>{s.payments&&['entry','delivery'].map(k=><p key={k}>{k==='entry'?'Entrada':'Entrega'}: {money(s.payments[k].amount)} · {s.payments[k].received?'Recebido':'A receber'}{s.payments[k].date?' · '+day(s.payments[k].date):''}</p>)}{s.editable&&<button type="button" disabled={busy||!!draft} className="text-primary underline py-1" onClick={()=>edit(s)}>Editar venda</button>}{!s.editable&&!s.legacy&&<p className="text-muted-foreground">Pedido: gerencie na área de pedidos.</p>}</article>)}</div>
  {draft&&<div className="border-t border-border pt-3 space-y-3" aria-label="Registrar venda">
   <label className="block text-xs space-y-1">Descrição da venda<input className={input} maxLength={160} value={draft.title} onChange={e=>change('title',e.target.value)}/></label>
   <label className="block text-xs space-y-1">Data da venda<input className={input} type="date" max={today()} value={draft.soldOn} onChange={e=>change('soldOn',e.target.value)}/></label>
   <div className="grid gap-3 sm:grid-cols-2">{['entry','delivery'].map(k=><fieldset key={k} className="rounded-lg border border-border p-2 space-y-2"><legend className="px-1 text-xs font-semibold">{k==='entry'?'Entrada':'Entrega'}</legend><label className="block text-xs">Valor (R$)<input aria-label={k==='entry'?'Valor da entrada':'Valor da entrega'} className={input} inputMode="decimal" type="number" min="0" step="0.01" value={draft.payments[k].amount} onChange={e=>part(k,'amount',e.target.value)}/></label><label className="flex gap-2 text-xs items-center"><input type="checkbox" checked={draft.payments[k].received} onChange={e=>{part(k,'received',e.target.checked);if(e.target.checked&&!draft.payments[k].date)part(k,'date',today());}}/>Valor já recebido</label><label className="block text-xs">{draft.payments[k].received?'Recebido em':'Previsão de recebimento (opcional)'}<input className={input} type="date" max={draft.payments[k].received?today():undefined} value={draft.payments[k].date||''} onChange={e=>part(k,'date',e.target.value)}/></label></fieldset>)}</div>
   <p className="font-semibold text-sm">Total da venda: {money((Number(draft.payments.entry.amount)||0)+(Number(draft.payments.delivery.amount)||0))}</p>
   {draft.revision&&<label className="flex gap-2 items-center text-xs"><input type="checkbox" checked={draft.status==='cancelled'} onChange={e=>change('status',e.target.checked?'cancelled':'registered')}/>Venda cancelada (retirar dos indicadores)</label>}
   <p className="text-xs text-muted-foreground">Estes campos registram os valores. Nenhuma cobrança é realizada.</p>
   <div className="flex gap-2"><button type="button" disabled={busy} className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm" onClick={save}>{busy?'Salvando…':'Salvar venda'}</button><button type="button" disabled={busy} className="rounded-md border border-border px-3 py-2 text-sm" onClick={()=>setDraft(null)}>Fechar</button></div>
  </div>}
 </section>;
}
