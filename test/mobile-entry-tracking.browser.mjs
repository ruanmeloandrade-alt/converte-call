import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
test('ordinary mobile accounts reach all permitted modules from login; tracking shows ingested events; iOS install and legal pages work',{timeout:120000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-mobile-entry-')),app=createApp({dir,master:'e'.repeat(64),bootstrap:'entry-test'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,old=process.env.PUBLIC_URL;process.env.PUBLIC_URL=base;app.billing.publicUrl=base;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});
 try{
  await fetch(base+'/v1/auth/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'entry-test',email:'admin@entry.test',password:'Admin-entry-password'})});
  const account=await(await fetch(base+'/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'mobile@entry.test',password:'Mobile-entry-password',firstName:'Teste',lastName:'Mobile',birthDate:'1990-01-01',whatsapp:'5522991234567'})})).json();assert(account.accessToken,JSON.stringify(account));assert.equal(account.license.status,'trial');
  const call=async(path,body,origin=base)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,Authorization:'Bearer '+account.accessToken,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert(r.ok,await r.clone().text());return r.json();};
  const {pixel}=await call('/v1/tracking/pixels',{name:'Site real de teste',url:'https://example.test'});
  const {rule}=await call('/v1/tracking/pixels/'+pixel.id+'/events',{name:'Compra registrada',type:'purchase',conversion:true});
  const sessionId=randomUUID(),event=extra=>({id:randomUUID(),sessionId,path:'/oferta',...extra});
  for(const payload of [{type:'pageview',utm:{source:'google',medium:'cpc',campaign:'lancamento'}},{type:'click'},{type:'engagement',visibleMs:12000},{type:'video_play'},{type:'video_progress',progress:50},{type:'video_complete'},{type:'purchase',ruleId:rule.id,orderId:'order_entry',valueMinor:15000,currency:'BRL'}])await call('/p/'+pixel.public_key+'/events',event(payload),pixel.origin);
  // A duplicate purchase must not inflate conversions.
  await call('/p/'+pixel.public_key+'/events',event({type:'purchase',ruleId:rule.id,orderId:'order_entry'}),pixel.origin);
  const stats=(await call('/v1/tracking/pixels')).pixels[0];assert.equal(stats.stats.totalEvents,7);assert.equal(stats.stats.conversions,1);assert.equal(stats.stats.visibleMs,12000);assert.equal(stats.sources[0].source,'google');
  const uas={Android:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',iPhone:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',iPad:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'};
  for(const [device,userAgent] of Object.entries(uas)){
   const p=await browser.newPage({viewport:{width:393,height:851},hasTouch:true,isMobile:true,userAgent});p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
   if(device==='iPad')await p.addInitScript(()=>{Object.defineProperty(navigator,'platform',{value:'MacIntel'});Object.defineProperty(navigator,'maxTouchPoints',{value:5});});
   await p.goto(base+'/account');await p.locator('#signin').waitFor({state:'visible'});await p.locator('[name=email]').fill('mobile@entry.test');await p.locator('[name=password]').fill('Mobile-entry-password');await p.getByRole('button',{name:'Entrar',exact:true}).click();await p.waitForURL('**/account/app');await p.getByRole('heading',{name:/Um bom dia/}).waitFor();
   await p.locator('#menu-toggle').click();for(const area of ['inbox','funnel','projects','dashboard','audiences','bots','brain','products','orders','inventory','suppliers'])assert(await p.locator('#menu-items [data-page='+area+']').isVisible(),device+' '+area);
   await p.locator('#menu-items [data-page=dashboard]').click();const f=p.frameLocator('.module-frame');await f.getByText('Da visita à conversão',{exact:true}).waitFor();await f.locator('[data-tracking-metric=totalEvents]').filter({hasText:'7'}).waitFor();assert.equal(await f.locator('[data-tracking-metric=visibleMs]').innerText(),'12 s');assert.equal(await f.locator('[data-tracking-metric=conversions]').innerText(),'1');await f.getByText('Site real de teste · 1 visitas',{exact:true}).click();await f.getByText('google / cpc · lancamento · 1 visitas',{exact:true}).waitFor();
   if(device==='iPhone'&&process.env.SCREENSHOT_DIR){mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:join(process.env.SCREENSHOT_DIR,'Converte-Call-tracking-dashboard-teste.png')});}
   await p.goto(base+'/account/integracoes');await p.getByRole('link',{name:'◫ Abrir aplicativo completo',exact:true}).click();await p.waitForURL('**/account/app');await p.getByRole('heading',{name:/Um bom dia/}).waitFor();
   if(device!=='Android'){await p.goto(base+'/account/app?install=1');await p.locator('[data-install-guide]').filter({hasText:'No Safari'}).waitFor();await p.locator('#install-helper [data-install]').click();await p.locator('#install-helper [data-install-status]').filter({hasText:'Compartilhar'}).waitFor();await p.goto(base+'/download');await p.waitForURL('**/ios');assert(await p.getByRole('heading',{name:/No seu iPhone/}).isVisible());}
   assert.deepEqual(errors,[]);await p.close();
  }
  const p=await browser.newPage({viewport:{width:393,height:851},isMobile:true});await p.goto(base);await p.locator('.footer-legal').scrollIntoViewIfNeeded();assert.equal(await p.locator('#funnel-demo .footer-legal').count(),0);assert.match(await p.locator('.footer-legal').innerText(),/41\.374\.264\/0001-92/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const path of ['/privacidade','/termos','/assinatura','/cookies','/plataformas']){const r=await p.goto(base+path);assert.equal(r.status(),200);assert.match(await p.locator('main').innerText(),/Av\. Amazonas, 975/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  if(process.env.SCREENSHOT_DIR){await p.goto(base+'/ios');await p.screenshot({path:join(process.env.SCREENSHOT_DIR,'Converte-Call-iOS-teste.png'),fullPage:true});await p.goto(base+'/privacidade');await p.screenshot({path:join(process.env.SCREENSHOT_DIR,'Converte-Call-privacidade-teste.png')});}
  // Restricted team permissions must not be expanded by the entry fix.
  const uid=app.store.one('SELECT id FROM users WHERE email=?','mobile@entry.test').id;app.store.run("UPDATE team_members SET role='member',permissions=? WHERE user_id=?",app.store.vault.seal(['inbox']),uid);
  const member=await browser.newPage({userAgent:uas.iPhone,isMobile:true});await member.request.post(base+'/account/api/login',{headers:{Origin:base},data:{email:'mobile@entry.test',password:'Mobile-entry-password'}});await member.goto(base+'/account');await member.waitForURL('**/account/app');await member.locator('#menu-toggle').click();assert.equal(await member.locator('#menu-items [data-page=funnel]').count(),0);assert(await member.locator('#menu-items [data-page=inbox]').isVisible());await member.goto(base+'/account/app#dashboard');await member.getByText('Seu usuário não tem permissão para esta área.',{exact:true}).waitFor();
 }finally{await browser.close();await app.close();if(old===undefined)delete process.env.PUBLIC_URL;else process.env.PUBLIC_URL=old;rmSync(dir,{recursive:true,force:true});}
});
