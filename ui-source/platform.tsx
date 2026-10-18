import React from 'react';
export const useServerFn=(fn:any)=>fn;
export const AppSidebar=()=>null;
export const useIsSuperAdmin=()=>({isSuperAdmin:false,loaded:true});
export const useIsAdmin=()=>({isAdmin:false,loaded:true});
export const AdminOnlyDot=()=>null;
export const extensionWorkspaceId=async()=>{const d=await (window as any).CCWorkspace.get();if(!d.workspaceId){d.workspaceId=crypto.randomUUID();await (window as any).CCWorkspace.set(d);}return d.workspaceId;};
export async function extensionPipelines(){const {rpc}=await import('./repository');const result=await rpc('@/lib/crm.functions','listAllPipelineStages');return result.pipelines;}
// This is an extension event transport, not a simulated remote login.
export const supabase={
 auth:{getUser:async()=>{const a=(await chrome.storage.local.get('ccAccountView')).ccAccountView;return {data:{user:a?.userId?{id:a.userId,email:a.email}:null}};},getSession:async()=>{const a=(await chrome.storage.local.get('ccAccountView')).ccAccountView;return {data:{session:a?.userId?{user:{id:a.userId,email:a.email}}:null}};},onAuthStateChange:(fn:any)=>{const handler=(changes:any,area:string)=>{if(area==='local'&&changes.ccAccountView)fn(changes.ccAccountView.newValue?'SIGNED_IN':'SIGNED_OUT');};chrome.storage.onChanged.addListener(handler);return {data:{subscription:{unsubscribe:()=>chrome.storage.onChanged.removeListener(handler)}}};}},
 channel:()=>{const callbacks:Function[]=[];const handler=()=>callbacks.forEach(fn=>fn());const chain:any={on:(_type:any,_filter:any,fn:any)=>{callbacks.push(fn);return chain;},subscribe:()=>{chrome.storage.onChanged.addListener(handler);chain.unsubscribe=()=>chrome.storage.onChanged.removeListener(handler);return chain;}};return chain;},
 removeChannel:(c:any)=>{c.unsubscribe?.();return Promise.resolve();},
 storage:{from:()=>({createSignedUrl:async(path:string)=>({data:{signedUrl:await localMediaURL(path)},error:null}),upload:async()=>({error:{message:'Use o upload local da extensão.'}})})},
 from:()=>{throw Error('Esta operação precisa da integração do servidor.');}
};
export async function localMediaURL(path:string){return new Promise<string>((resolve,reject)=>{const r=indexedDB.open('converte-call-assets',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets',{keyPath:'id'});r.onsuccess=()=>{const tx=r.result.transaction('assets','readonly'),get=tx.objectStore('assets').get(path);get.onsuccess=()=>get.result?resolve(URL.createObjectURL(get.result.blob)):reject(Error('Arquivo local não encontrado.'));get.onerror=()=>reject(get.error);};r.onerror=()=>reject(r.error);});}
export async function agentTestFetch(_url:any,options:any){const body=JSON.parse(options.body);const r=await chrome.runtime.sendMessage({channel:'cc',type:'slim-agent-test',config:body.config,messages:body.messages});if(!r.ok)throw Error(r.error);const id=crypto.randomUUID();const events=[{type:'start',messageId:id},{type:'text-start',id:'text-1'},{type:'text-delta',id:'text-1',delta:r.text},{type:'text-end',id:'text-1'},{type:'finish'}];return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream','x-vercel-ai-ui-message-stream':'v1'}});}
