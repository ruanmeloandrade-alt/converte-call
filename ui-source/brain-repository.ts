// Real local storage adapter for the deployed brain component; remote mode uses the authenticated BFF.
const W=()=> (window as any).CCWorkspace;const names:any={ai_brain_sources:'brainSources',ai_brain_blocked_terms:'brainBlockedTerms'};let queue=Promise.resolve();
class Query {
 table:string;action='select';payload:any;filters:any[]=[];sort='';ascending=true;
 constructor(table:string){if(!names[table])throw Error('Coleção do cérebro não permitida.');this.table=table;}
 select(_columns?:string){this.action='select';return this;}eq(key:string,value:any){this.filters.push([key,value]);return this;}order(key:string,options:any={}){this.sort=key;this.ascending=options.ascending!==false;return this;}insert(value:any){this.action='insert';this.payload=value;return this;}update(value:any){this.action='update';this.payload=value;return this;}delete(){this.action='delete';return this;}
 then(resolve:any,reject:any){const p=queue.then(()=>execute(this));queue=p.catch(()=>{});return p.then(resolve,reject);}
}
async function execute(q:Query){try{
 const r=await chrome.runtime.sendMessage({channel:'cc',type:'brain-query',query:{table:q.table,action:q.action,filters:q.filters,payload:q.payload,sort:q.sort,ascending:q.ascending}});
 if(!r.ok)throw Error(r.error);return {data:r.data,error:null};
}catch(error:any){return {data:null,error:{message:error.message}};}}
async function assets(action:string,path:string,file?:File){try{
 if((window as any).CCDeployment?.gatewayUrl){let base64;if(file){const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.slice(i,i+8192));base64=btoa(text);}const r=await chrome.runtime.sendMessage({channel:'cc',type:'brain-asset',operation:action,path,name:file?.name,mime:file?.type,base64});if(!r.ok)throw Error(r.error);return {data:r.data,error:null};}
 if(file&&file.size>20*1024*1024)throw Error('Limite de 20 MB por documento.');await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('converte-call-assets',1);req.onupgradeneeded=()=>req.result.createObjectStore('assets',{keyPath:'id'});req.onsuccess=()=>{const tx=req.result.transaction('assets','readwrite'),store=tx.objectStore('assets');if(action==='upload')store.put({id:path,blob:file,name:file?.name});else store.delete(path);tx.oncomplete=()=>{req.result.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);});return {data:{path},error:null};
 }catch(error:any){return {data:null,error:{message:error.message}};}}
export const brainRepository={from:(table:string)=>new Query(table),storage:{from:(_bucket:string)=>({upload:(path:string,file:File)=>assets('upload',path,file),remove:async(paths:string[])=>{for(const path of paths){const r=await assets('delete',path);if(r.error)return r;}return {error:null};}})}};
