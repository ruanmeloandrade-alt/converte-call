import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createApp} from '../src/server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('extension account gate escapes a hung reply, retries real identity and preserves a connected session on transient failure',{timeout:60000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'cc-extension-recovery-')),app=createApp({dir:join(root,'data'),master:'b'.repeat(64),bootstrap:'recovery'});let ctx;
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const owner=await(await fetch(base+'/v1/auth/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'recovery',email:'owner@recovery.test',password:'Recovery-test-password'})})).json();
  const extension=resolve('extension');ctx=await chromium.launchPersistentContext(join(root,'chrome'),{headless:true,executablePath:process.env.CHROME_BIN,args:['--disable-extensions-except='+extension,'--load-extension='+extension],viewport:{width:1440,height:960}});ctx.setDefaultTimeout(10000);
  await ctx.exposeFunction('__readAccount',async()=>{const r=await fetch(base+'/v1/account/license',{headers:{Authorization:'Bearer '+owner.accessToken}});return {ok:r.ok,...await r.json()};});
  await ctx.addInitScript(()=>{
   if(location.protocol!=='chrome-extension:')return;
   // Accelerate only the gate watchdog, not networking or application logic.
   const timeout=window.setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===15000?150:ms,...args);
   window.__accountMode='hang';const original=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=(message,...args)=>{
    if(message.type==='portal-account'){
     if(window.__accountMode==='hang')return new Promise(()=>{});
     if(window.__accountMode==='offline')return Promise.resolve({ok:false,error:'Network unavailable'});
     if(window.__accountMode==='unauthorized')return Promise.resolve({ok:false,error:'Sessão expirada',status:401});
     return window.__readAccount();
    }
    if(message.type==='integration-status')return Promise.resolve({ok:true,checked:true,connections:{whatsapp:{status:'connected'}},ai:true,google:true});
    if(message.type==='portal-release')return Promise.resolve({ok:true,published:false});
    if(message.type==='recordings-list')return Promise.resolve({ok:true,recordings:[]});
    return original(message,...args);
   };
  });
  const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
  await worker.evaluate(workspace=>chrome.storage.local.set({converteCallWorkspace:workspace}),app.store.get(owner.workspaceId));
  const page=await ctx.newPage();await page.goto(worker.url().replace('background.js','panel.html'));
  await page.getByRole('heading',{name:'Vamos retomar sua conta.'}).waitFor();assert.equal(await page.locator('#portal-login-form').count(),0);
  await page.evaluate(()=>window.__accountMode='ok');await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await page.waitForFunction(()=>portalIdentity?.email==='owner@recovery.test');assert.equal(await page.locator('.cc-account-gate').count(),0);
  await page.evaluate(async()=>{window.__accountMode='offline';await restorePortalAccount(true);});assert.equal(await page.locator('.cc-account-gate').count(),0);assert.equal(await page.evaluate(()=>portalIdentity.email),'owner@recovery.test');
  await page.evaluate(async()=>{window.__accountMode='unauthorized';await restorePortalAccount(true);});await page.locator('#portal-login-form').waitFor();assert.equal(await page.evaluate(()=>portalIdentity),null);
  if(process.env.SCREENSHOT_DIR){await page.evaluate(async()=>{window.__accountMode='ok';await restorePortalAccount(true);screen='integrations';render();});await page.screenshot({path:join(process.env.SCREENSHOT_DIR,'Converte-Call-recuperacao-extensao-validada.png')});}
 }finally{if(ctx)await ctx.close();await app.close();rmSync(root,{recursive:true,force:true});}
});
