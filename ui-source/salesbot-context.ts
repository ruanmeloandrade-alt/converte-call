import {currentRuntime} from '../src/salesbot-context.mjs';
export const supabaseAdmin=new Proxy({}, {get(_target,key){const adapter=currentRuntime().adapter;const value=adapter[key];return typeof value==='function'?value.bind(adapter):value;}});
export async function resolveWorkspaceAiKey(_adapter:any,workspaceId:string){const context=currentRuntime();if(context.workspaceId!==workspaceId)throw Error('Workspace da IA divergente.');return {provider:'openai',apiKey:'workspace-internal-transport',baseUrl:'cc://ai',defaultModel:context.model()};}
