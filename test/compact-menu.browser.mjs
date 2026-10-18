import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createServer} from 'node:http';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('compact menu has five requested buttons; logo expands, drag persists without opening, Inbox opens CRM',{timeout:60000},async()=>{
 const server=createServer((req,res)=>res.end('<title>Menu fixture</title><h1>Site de teste</h1>'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,dir=mkdtempSync(join(tmpdir(),'cc-dock-')),extension=resolve('extension');let browser;
 try{
  browser=await chromium.launchPersistentContext(join(dir,'chrome'),{headless:true,executablePath:process.env.CHROME_BIN,args:['--disable-extensions-except='+extension,'--load-extension='+extension],viewport:{width:1440,height:1000}});
  await browser.route('https://convertecall.pro/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{"error":{"message":"Isolated test account"}}'}));
  const worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker'),page=await browser.newPage();await page.goto(base);await page.bringToFront();
  const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());
  await worker.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['content.js']}),tabId);
  await page.waitForFunction(()=>!!document.getElementById('converte-call-native-root'));
  const cdp=await browser.newCDPSession(page);await cdp.send('DOM.enable');
  async function dock(){const visit=n=>{const a=n.attributes||[],i=a.indexOf('class');if(i>=0&&a[i+1].split(' ').includes('dock'))return n;for(const c of [...(n.children||[]),...(n.shadowRoots||[])]){const found=visit(c);if(found)return found;}};const node=visit((await cdp.send('DOM.getDocument',{depth:-1,pierce:true})).root);assert(node);return (await cdp.send('DOM.resolveNode',{backendNodeId:node.backendNodeId})).object.objectId;}
  async function inspect(){return(await cdp.send('Runtime.callFunctionOn',{objectId:await dock(),functionDeclaration:'function(){return {hidden:this.classList.contains("hidden"),buttons:[...this.querySelectorAll("button")].map(b=>({label:b.getAttribute("aria-label"),x:b.getBoundingClientRect().x+b.offsetWidth/2,y:b.getBoundingClientRect().y+b.offsetHeight/2}))}}',returnByValue:true})).result.value;}
  let state=await inspect();assert.deepEqual(state.buttons.map(b=>b.label),['Expandir Converte Call','Gravar call','Funil de vendas','Inbox','Registrar venda']);
  const logo=state.buttons[0];await page.mouse.move(logo.x,logo.y);await page.mouse.down();await page.mouse.move(logo.x-180,logo.y+80,{steps:12});await page.mouse.up();
  const stored=await worker.evaluate(async()=>(await chrome.storage.local.get('ccDock')).ccDock);assert(stored&&stored.x<logo.x-100);assert.equal((await inspect()).hidden,false,'drag does not expand');
  await page.waitForTimeout(450);state=await inspect();await page.mouse.click(state.buttons[0].x,state.buttons[0].y);
  let crm;for(let i=0;i<100;i++){crm=page.frames().find(f=>f.url().includes('panel.html#home'));if(crm)break;await page.waitForTimeout(30);}assert(crm,'logo opens expanded CRM');
  await crm.evaluate(()=>parent.postMessage({channel:'cc-ui',action:'hide'},'*'));for(let i=0;i<50&&(await inspect()).hidden;i++)await page.waitForTimeout(30);
  state=await inspect();const inbox=state.buttons.find(b=>b.label==='Inbox');await page.mouse.click(inbox.x,inbox.y);
  for(let i=0;i<100&&!page.frames().some(f=>f.url().includes('panel.html#employee-inbox'));i++)await page.waitForTimeout(30);
  assert(page.frames().some(f=>f.url().includes('panel.html#employee-inbox')));assert.equal((await browser.pages()).filter(p=>p.url().startsWith('https://web.whatsapp.com')).length,0);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});
