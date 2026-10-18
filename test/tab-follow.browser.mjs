import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('extension follows real tab activation, reload, windows and Inbox without resetting its route', {timeout:90000},async()=>{
 const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Tab follow fixture</title><h1>Normal website</h1>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`,root=mkdtempSync(join(tmpdir(),'cc-tab-follow-'));
 const extension=resolve('extension');let ctx;
 try{
  ctx=await chromium.launchPersistentContext(join(root,'profile'),{headless:true,executablePath:process.env.CHROME_BIN,args:['--disable-extensions-except='+extension,'--load-extension='+extension],viewport:{width:1440,height:1000}});
  ctx.setDefaultTimeout(10000);
  await ctx.route('https://convertecall.pro/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"Test profile not authenticated"}'}));
  await ctx.route('https://web.whatsapp.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>WhatsApp fixture</title><div><header><h1>WhatsApp</h1></header><div id="side"></div></div><div id="main"><header><span title="Fixture client">Fixture client</span></header><footer><div role="textbox" contenteditable="true"></div></footer></div>'}));
  await ctx.route('https://www.youtube.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Aula de teste — YouTube</title><body style="background:#101018;color:white;font-family:Arial;padding:40px"><h1>Aula de teste — ambiente isolado</h1><div style="background:#242439;height:520px;border-radius:20px;display:grid;place-items:center;font-size:80px">▶</div></body>'}));
  const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
  // Isolated account adapter: no production session, credentials or messages.
  await worker.evaluate(()=>{CCPortal.request=async()=>({membership:{role:'owner',permissions:['inbox']}});});
  const first=await ctx.newPage();await first.goto(base+'/first');await first.bringToFront();
  const tabId=async page=>worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());
  const firstId=await tabId(first);
  // Same entry point as clicking the extension action, without granting activeTab.
  await worker.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['content.js']}),firstId);
  await first.waitForFunction(()=>!!document.getElementById('converte-call-native-root'));
  const setView=async(mode,view)=>worker.evaluate(async({mode,view})=>{const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0];await handle({type:'surface-location',mode,view},{tab});queueSurfaceFollow(tab.id,tab.windowId);await surfaceSwitch;},{mode,view});
  const visible=page=>page.waitForFunction(()=>{const h=document.getElementById('converte-call-native-root');return h&&getComputedStyle(h).display!=='none';});
  const hidden=page=>page.waitForFunction(()=>{const h=document.getElementById('converte-call-native-root');return !h||getComputedStyle(h).display==='none';});
  const crm=async(page,view)=>{await visible(page);await page.waitForFunction(()=>true);await assert.doesNotReject(async()=>{await (async()=>{for(let i=0;i<100;i++){const f=page.frames().find(f=>f.url().includes('panel.html#'+view));if(f&&await (await f.frameElement()).isVisible())return;await new Promise(r=>setTimeout(r,50));}throw Error('Missing visible CRM '+view+' on '+page.url());})();});};
  await setView('crm','projects');await crm(first,'projects');
  const second=await ctx.newPage();await second.goto(base+'/second');await second.bringToFront();await crm(second,'projects');await hidden(first);
  await second.reload();await crm(second,'projects');
  await first.bringToFront();await crm(first,'projects');await hidden(second);
  // An inactive iframe cannot overwrite the foreground view.
  assert.equal(await worker.evaluate(async id=>(await handle({type:'surface-location',mode:'crm',view:'settings'},{tab:await chrome.tabs.get(id)})).ok,await tabId(second)),false);
  for(let i=0;i<5;i++){await second.bringToFront();await first.bringToFront();}
  await crm(first,'projects');assert.equal(await worker.evaluate(async()=>(await chrome.storage.session.get('ccSurfaceState')).ccSurfaceState.view),'projects');
  await setView('surface','hud');
  await second.bringToFront();await visible(second);await second.waitForFunction(()=>true);
  await assert.doesNotReject(async()=>{for(let i=0;i<100;i++){const f=second.frames().find(f=>f.url().includes('surface.html#')&&f.url().includes('view=hud'));if(f&&await (await f.frameElement()).isVisible())return;await new Promise(r=>setTimeout(r,50));}throw Error('HUD did not follow');});
  await setView('inbox','employee-inbox');await crm(second,'employee-inbox');
  const wa=await ctx.newPage();await wa.goto('https://web.whatsapp.com/');await wa.bringToFront();await visible(wa);
   await wa.waitForFunction(()=>!!document.getElementById('converte-call-profile'));
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.session.get('ccSurfaceState')).ccSurfaceState.mode),'inbox');
  await second.bringToFront();await crm(second,'employee-inbox');await hidden(wa);
  // Employees keep the internal Inbox even on the WhatsApp host.
  await worker.evaluate(()=>{CCPortal.request=async()=>({membership:{role:'member',permissions:['inbox']}});});
   await wa.bringToFront();await wa.reload();try{await crm(wa,'employee-inbox');}catch(error){console.log('Employee restore diagnostic',await worker.evaluate(async()=>({state:(await chrome.storage.session.get('ccSurfaceState')).ccSurfaceState,license:await CCPortal.request('/v1/account/license')})),wa.frames().map(f=>f.url()));throw error;}assert.equal(await wa.locator('#converte-call-profile').count(),0);
  await setView('dock','home');await first.bringToFront();await visible(first);
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.session.get('ccSurfaceState')).ccSurfaceState.mode),'dock');
  await worker.evaluate(()=>{CCPortal.request=async()=>({lessons:[{id:'fixture-lesson',title:'Aprenda a usar o Converte Call',videoId:'ABCDEFGHIJK'}]});});
  const lessonEvent=ctx.waitForEvent('page');
  assert.equal((await worker.evaluate(()=>handle({type:'open-academy-lesson',id:'fixture-lesson'},{}))).ok,true);
  const youtube=await lessonEvent;await youtube.waitForLoadState();await visible(youtube);
  assert.equal(youtube.url(),'https://www.youtube.com/watch?v=ABCDEFGHIJK');
  const cdp=await ctx.newCDPSession(youtube);await cdp.send('DOM.enable');
  const findReturn=node=>{if(node.attributes?.includes('academy-return'))return node;for(const child of [...(node.children||[]),...(node.shadowRoots||[])]){const found=findReturn(child);if(found)return found;}};
  let back;
  for(let i=0;i<100;i++){back=findReturn((await cdp.send('DOM.getDocument',{depth:-1,pierce:true})).root);if(back)break;await new Promise(r=>setTimeout(r,50));}
  assert.ok(back,'Lesson has a real return button in the injected interface');
  if(process.env.SCREENSHOT_DIR)await youtube.screenshot({path:join(process.env.SCREENSHOT_DIR,'Converte-Call-v0.13.3-aula-teste-isolado.png')});
  const resolved=await cdp.send('DOM.resolveNode',{nodeId:back.nodeId});
  await cdp.send('Runtime.callFunctionOn',{objectId:resolved.object.objectId,functionDeclaration:'function(){this.click();}'});
  await crm(youtube,'academy');
  await first.bringToFront();await crm(first,'academy');
  await assert.rejects(worker.evaluate(()=>handle({type:'open-academy-lesson',id:'not-allowed'},{})),/Aula não disponível/);
  // Checkout remains visible rather than being covered by the expanded CRM.
  const checkoutPage=await ctx.newPage();await checkoutPage.goto('https://convertecall.pro/checkout');await checkoutPage.bringToFront();await visible(checkoutPage);
  await checkoutPage.waitForTimeout(150);
  for(const f of checkoutPage.frames().filter(f=>f.url().includes('panel.html#')))assert.equal(await (await f.frameElement()).isVisible(),false);
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.session.get('ccSurfaceState')).ccSurfaceState.view),'academy');
  await first.bringToFront();await crm(first,'academy');
  // A second normal browser window follows the same state (recorder popups excluded).
   const pageEvent=ctx.waitForEvent('page');
   const newWindow=await worker.evaluate(url=>chrome.windows.create({url,focused:true,type:'normal'}),base+'/window');
   const windowPage=await pageEvent;
   await windowPage.waitForLoadState();await visible(windowPage);await hidden(first);
  assert.ok(newWindow.id);
 }finally{if(ctx)await ctx.close();await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
});
