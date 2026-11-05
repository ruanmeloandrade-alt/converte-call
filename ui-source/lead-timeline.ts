import {useQuery} from '@tanstack/react-query';
export type LeadTiming={created:number;incoming:number;last?:number;from?:'lead'|'us';preview?:string};
export const timestamp=(value:unknown)=>{const n=Date.parse(String(value||''));return Number.isFinite(n)?n:0;};
export function useLeadTimeline(){
 return useQuery<Record<string,LeadTiming>>({queryKey:['cc-lead-timeline'],queryFn:async()=>{
  const workspace=await (window as any).CCWorkspace.get(),rows:Record<string,LeadTiming>={};
  for(const lead of workspace.leads||[])rows[lead.id]={created:timestamp(lead.createdAt),incoming:0};
  for(const event of workspace.inboxEvents||[]){const row=rows[event.leadId],at=timestamp(event.at);if(!row||event.type!=='message')continue;if(event.direction==='in')row.incoming=Math.max(row.incoming,at);if(at>(row.last||0)){row.last=at;row.from=event.direction==='in'?'lead':'us';row.preview=event.text||'Arquivo recebido';}}
  return rows;
 },staleTime:10000}).data||{};
}
export function orderLeads<T extends {id:string}>(rows:T[],mode:string,timing:Record<string,LeadTiming>){
 return [...rows].sort((a,b)=>{const x=timing[a.id],y=timing[b.id],ax=mode==='message'?x?.incoming:x?.created,bx=mode==='message'?y?.incoming:y?.created;
  if(!ax||!bx)return ax?-1:bx?1:a.id.localeCompare(b.id);
  return (mode==='oldest'?ax-bx:bx-ax)||a.id.localeCompare(b.id);
 });
}
