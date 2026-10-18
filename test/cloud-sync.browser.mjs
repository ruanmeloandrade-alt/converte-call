import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('Chrome sync clears prior user data before fetching, binds workspace and discards stale account responses',async()=>{
 const root=mkdtempSync(join(tmpdir(),'cc-cloud-browser-')),extension=resolve('extension'),context=await chromium.launchPersistentContext(root,{headless:true,executablePath:process.env.CHROME_BIN,args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
 try{const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const initial=await worker.evaluate(async()=>{
   const old={workspaceId:'workspace-a',leads:[{id:'private-lead',name:'Owner only'}],bots:[],agents:[]};
   await chrome.storage.local.set({converteCallWorkspace:old,ccWorkspaceOwner:{workspaceId:'workspace-a',userId:'owner'},ccAccountView:{workspaceId:'workspace-a',userId:'member',previousWorkspace:'workspace-a',membership:{role:'member'}}});
   let isolatedBeforeFetch=false,headers;CCPortal.request=async(_path,options)=>{headers=options.headers;isolatedBeforeFetch=!(await chrome.storage.local.get('converteCallWorkspace')).converteCallWorkspace;return {workspace:{leads:[{id:'assigned',name:'Assigned only'}],bots:[],agents:[]}};};
   await CCCloudSync.sync();const saved=await chrome.storage.local.get(['converteCallWorkspace','ccWorkspaceOwner']);return {isolatedBeforeFetch,headers,saved};
  });
  assert.equal(initial.isolatedBeforeFetch,true);assert.equal(initial.headers['X-Workspace-Id'],'workspace-a');assert.equal(initial.saved.ccWorkspaceOwner.userId,'member');assert.deepEqual(initial.saved.converteCallWorkspace.leads.map(l=>l.id),['assigned']);
  await worker.evaluate(async()=>{let ready;const started=new Promise(resolve=>{ready=resolve;});CCPortal.request=()=>new Promise(resolve=>{globalThis.__resolveOldSync=resolve;ready();});globalThis.__oldSync=CCCloudSync.sync();await started;});
  const stale=await worker.evaluate(async()=>{await chrome.storage.local.set({ccAccountView:{workspaceId:'workspace-b',userId:'other-user',membership:{role:'member'}},converteCallWorkspace:{workspaceId:'workspace-b',leads:[{id:'new-account-lead'}]}});globalThis.__resolveOldSync({workspace:{leads:[{id:'must-not-appear'}]}});await globalThis.__oldSync;return (await chrome.storage.local.get('converteCallWorkspace')).converteCallWorkspace;});
  assert.equal(stale.workspaceId,'workspace-b');assert.deepEqual(stale.leads.map(l=>l.id),['new-account-lead']);
 }finally{await context.close();rmSync(root,{recursive:true,force:true});}
});
