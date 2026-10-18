import {runtimeEmail} from '../src/salesbot-context.mjs';
export async function sendWorkspaceEmail(_adapter:unknown,workspaceId:string,input:unknown){return runtimeEmail(workspaceId,input);}
