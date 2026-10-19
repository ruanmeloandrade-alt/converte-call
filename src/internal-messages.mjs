import {randomUUID} from 'node:crypto';import{requirePermission,requireOwner}from'./teams.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
export function internalMessages(store,user,method,input={}){
 requirePermission(store,user,'projects');const visible=m=>m.recipientId===user.id||m.recipient_id===user.id||m.target==='workspace';
 if(method==='listInternalMessages')return (store.get(user.workspace_id).internalMessages||[]).filter(visible).slice(-200).reverse();
 return store.mutate(user.workspace_id,d=>{d.internalMessages||=[];if(method==='markInternalMessageRead'){for(const m of d.internalMessages)if(visible(m)&&(input.all===true||m.id===input.id))m.read_at=new Date().toISOString();return {updated:true};}
 if(method!=='sendInternalMessage')throw fail(400,'Operação inválida.');requireOwner(store,user);const body=String(input.body||'').trim(),recipientId=String(input.recipientId||input.userId||'');if(!body||body.length>4000||!store.one('SELECT id FROM users WHERE id=? AND workspace_id=?',recipientId,user.workspace_id))throw fail(400,'Confira destinatário e mensagem.');const message={id:randomUUID(),body,recipientId,origin:'admin',created_at:new Date().toISOString(),read_at:null};d.internalMessages.push(message);return message;});
}
