// Only the authenticated transport is shipped. Business rules stay in src/rpc.mjs.
let queue=Promise.resolve();
export function rpc(module:string,method:string,arg:any={}){
 const task=queue.then(async()=>{
  const reply=await chrome.runtime.sendMessage({channel:'cc',type:'slim-rpc',module,method,data:arg?.data??arg??{}});
  if(!reply?.ok)throw Error(reply?.error||'Conecte sua conta para concluir esta operação.');
  return reply.result;
 });
 queue=task.catch(()=>{});return task;
}
