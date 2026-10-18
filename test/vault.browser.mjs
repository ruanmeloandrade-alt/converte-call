import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('encrypted credentials survive a real Chrome restart, remain outside CRM and use non-extractable AES key',async()=>{
 const root=mkdtempSync(join(tmpdir(),'cc-vault-')),extension=resolve('extension'),options={headless:true,executablePath:process.env.CHROME_BIN||undefined,args:['--disable-extensions-except='+extension,'--load-extension='+extension]};let context;
 try{
  context=await chromium.launchPersistentContext(root,options);let worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(async()=>{await CCCredentials.set('ccOpenAIKey','LOCAL-ONLY-SECRET-TO-VERIFY-ENCRYPTION');await CCCredentials.set('ccAccountToken','LOCAL-ONLY-ACCESS-TOKEN');await chrome.storage.session.clear();});
  assert.equal(await worker.evaluate(()=>CCCredentials.get('ccOpenAIKey')),'LOCAL-ONLY-SECRET-TO-VERIFY-ENCRYPTION');const local=await worker.evaluate(()=>chrome.storage.local.get(null));assert(!JSON.stringify(local).includes('LOCAL-ONLY-SECRET-TO-VERIFY-ENCRYPTION'));assert(!JSON.stringify(local).includes('LOCAL-ONLY-ACCESS-TOKEN'));
  await context.close();context=await chromium.launchPersistentContext(root,options);worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');assert.equal(await worker.evaluate(()=>CCCredentials.get('ccOpenAIKey')),'LOCAL-ONLY-SECRET-TO-VERIFY-ENCRYPTION');assert.equal(await worker.evaluate(()=>CCCredentials.get('ccAccountToken')),'LOCAL-ONLY-ACCESS-TOKEN');
  const protectedKey=await worker.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('cc-private-vault',1);r.onsuccess=()=>resolve(r.result);});try{const key=await new Promise(resolve=>{const r=db.transaction('keys').objectStore('keys').get('master');r.onsuccess=()=>resolve(r.result);});try{await crypto.subtle.exportKey('raw',key);return false;}catch{return key.extractable===false;}}finally{db.close();}});assert(protectedKey);
  await worker.evaluate(()=>CCCredentials.remove('ccOpenAIKey'));assert.equal(await worker.evaluate(()=>CCCredentials.get('ccOpenAIKey')),undefined);
 }finally{if(context)await context.close();rmSync(root,{recursive:true,force:true});}
});
