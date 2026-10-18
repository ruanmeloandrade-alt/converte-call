import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createApp} from '../src/server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('sales background reacts across sections without blocking clicks, respects pause and reduced motion',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-sales-field-')),app=createApp({dir,master:'b'.repeat(64)});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  const field=page.locator('#interaction-field');
  assert.equal(await field.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  const before=await field.evaluate(e=>e.toDataURL());await page.mouse.move(150,500);
  await page.waitForFunction(before=>document.querySelector('#interaction-field').toDataURL()!==before,before);
  if(process.env.SCREENSHOT_DIR){mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.SCREENSHOT_DIR,'Converte-Call-background-interativo.png')});}
  await page.getByRole('button',{name:'Pausar animações',exact:true}).click();
  const frozen=await field.evaluate(e=>e.toDataURL());await page.mouse.move(1100,600);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await field.evaluate(e=>e.toDataURL()),frozen,'paused background stays still');
  await page.getByRole('button',{name:'Reproduzir animações',exact:true}).click();
  await page.locator('#depoimentos').scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Ver story de Camila',exact:true}).click();
  assert.equal(await page.locator('#story-name').textContent(),'Camila · exemplo');
  const atStories=await field.evaluate(e=>e.toDataURL());await page.mouse.move(80,300);
  await page.waitForFunction(before=>document.querySelector('#interaction-field').toDataURL()!==before,atStories);
  const reduced=await browser.newPage({reducedMotion:'reduce',viewport:{width:393,height:851}});
  await reduced.goto(base);const still=await reduced.locator('#interaction-field').evaluate(e=>e.toDataURL());
  await reduced.mouse.move(100,350);await reduced.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await reduced.locator('#interaction-field').evaluate(e=>e.toDataURL()),still,'reduced-motion keeps field static');
  assert.equal(await reduced.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});
