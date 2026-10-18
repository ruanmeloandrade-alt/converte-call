import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createApp} from '../src/server.mjs';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('browser administrator issues trial, customer activates and administrator updates and suspends subscription',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-license-browser-')),app=createApp({dir,master:'9'.repeat(64),bootstrap:'browser-fixture-bootstrap'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;process.env.PUBLIC_URL=base;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined});
 const errors=[];
 try{
  const seed=await fetch(base+'/v1/auth/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'browser-fixture-bootstrap',email:'admin@teste.example',password:'Only-browser-test-password'})});assert.equal(seed.status,201);
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/admin');await page.locator('#login input[name=email]').fill('admin@teste.example');await page.locator('#login input[name=password]').fill('Only-browser-test-password');await page.locator('#login button').click();await page.waitForFunction(()=>!document.querySelector('#dashboard').hidden||document.querySelector('#status').textContent);assert(await page.locator('#dashboard').isVisible(),(await page.locator('#status').innerText())+' '+JSON.stringify(errors));
  await page.locator('#issue input').fill('cliente@teste.example');await page.locator('#issue button').click();await page.locator('#issued').waitFor({state:'visible'});
  const activation=await page.locator('#activation-url').inputValue();assert(activation.includes('#license=CC-'));
  const customer=await context.newPage();customer.on('pageerror',e=>errors.push(e.message));await customer.goto(activation);assert.equal(new URL(customer.url()).hash,'');
  await customer.locator('#setup input[name=email]').fill('cliente@teste.example');await customer.locator('#setup input[name=password]').fill('Customer-browser-password');await customer.locator('#setup button').click();await customer.waitForFunction(()=>document.querySelector('#status').textContent.includes('Conta criada!'));
  await page.locator('#refresh').click();const row=page.locator('#accounts tr').filter({hasText:'cliente@teste.example'});await row.waitFor();assert((await row.innerText()).includes('Em teste'));
  await row.getByRole('button',{name:'Editar assinatura'}).click();await page.locator('#subscription-dialog').waitFor({state:'visible'});await page.locator('#subscription-form input[name=days]').fill('30');await page.locator('#subscription-form input[name=plan]').fill('Mensal');await page.getByRole('button',{name:'Salvar e liberar acesso'}).click();await page.locator('#subscription-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#accounts').textContent.includes('Mensal'));
  await row.getByRole('button',{name:'Editar assinatura'}).click();await page.locator('#subscription-form select').selectOption('date');const exactDate=await page.evaluate(()=>{const d=new Date(Date.now()+45*86400000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});await page.locator('#subscription-form input[name=expiresAt]').fill(exactDate);await page.getByRole('button',{name:'Salvar e liberar acesso'}).click();await page.locator('#subscription-dialog').waitFor({state:'hidden'});assert(Math.abs(app.store.one('SELECT expires_at FROM subscriptions').expires_at-Date.now()-45*86400000)<65000,'date picker persists the selected local expiry');
  page.on('dialog',d=>d.accept());await row.getByRole('button',{name:'Suspender',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#accounts').textContent.includes('Suspensa'));
  await row.getByRole('button',{name:'Reativar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#accounts .pill').textContent==='Ativa');
  const screenshots=process.env.SCREENSHOT_DIR;if(screenshots){mkdirSync(screenshots,{recursive:true});await page.screenshot({path:join(screenshots,'Converte-Call-Admin-Licencas.png'),fullPage:true});}
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile layout does not overflow viewport');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});
