import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';import {createApp} from '../src/server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('public account entry teaches extension access; returning-user download is branded; Android remains usable',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-access-guide-')),app=createApp({dir,master:'b'.repeat(64),bootstrap:'access-guide-bootstrap'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,previous=process.env.PUBLIC_URL;process.env.PUBLIC_URL=base;app.billing.publicUrl=base;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN}),errors=[];
 const capture=async(page,name)=>{if(process.env.SCREENSHOT_DIR){mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.SCREENSHOT_DIR,name+'.png'),fullPage:true,animations:'disabled'});}};
 try{
  await fetch(base+'/v1/auth/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'access-guide-bootstrap',email:'owner@guide.test',password:'Owner-guide-password'})});
  const customer={firstName:'Cliente',lastName:'Teste',birthDate:'1990-01-01',email:'customer@guide.test',password:'Customer-guide-password',whatsapp:'5522991234567'};
  const registered=await(await fetch(base+'/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(customer)})).json();
  assert(registered.accessToken);
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByRole('link',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/access');
  await page.getByRole('heading',{name:/Sua conta.*Na extensão/}).waitFor();assert.equal(await page.locator('form,input[type=password]').count(),0);
  assert.equal(await page.getByRole('link',{name:/Administração/}).getAttribute('href'),'/admin');assert.equal(await page.getByRole('link',{name:/Área de parceiros/}).getAttribute('href'),'/partners');
  await capture(page,'Converte-Call-como-acessar');await page.getByRole('link',{name:/Baixar minha extensão/}).click();await page.waitForURL(base+'/download?existing=1');
  assert(await page.locator('body').evaluate(e=>e.classList.contains('download-page')));assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(10, 8, 15)');
  await page.locator('#download-extension:not([disabled])').waitFor();await capture(page,'Converte-Call-download-identidade');
  const waiting=page.waitForEvent('download');await page.locator('#download-extension').click();const download=await waiting;assert.match(download.suggestedFilename(),/^Converte-Call-v[0-9.]+\.zip$/);
  assert.equal(await page.locator('#register-link').getAttribute('href'),'/access');await page.getByText('Você não precisa criar outra conta.',{exact:false}).waitFor();
  await page.goto(base+'/account/app');await page.waitForURL(base+'/access');
  await page.goto(base+'/account');await page.getByLabel('E-mail',{exact:true}).fill(customer.email);await page.getByLabel('Senha',{exact:true}).fill(customer.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/access',{timeout:7000}).catch(async e=>{console.log('Access diagnostics',page.url(),await page.locator('body').innerText());throw e;});
  await page.goto(base+'/account/module?module=inbox');await page.waitForURL(base+'/access');await page.goto(base+'/account/events?pixel=not-used');await page.waitForURL(base+'/access');
  const mobile=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'}),m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));
  await m.goto(base+'/access');assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await capture(m,'Converte-Call-como-acessar-android');
  await m.goto(base+'/account/app');await m.getByLabel('E-mail',{exact:true}).fill(customer.email);await m.getByLabel('Senha',{exact:true}).fill(customer.password);await m.getByRole('button',{name:/Entrar no meu espaço/}).click();await m.getByRole('heading',{name:/Um bom dia/}).waitFor();
  assert.equal((await fetch(base+'/v1/account/license',{headers:{Authorization:'Bearer '+registered.accessToken}})).status,200,'extension session remains valid');
  assert.deepEqual(errors,[]);
 }finally{if(previous===undefined)delete process.env.PUBLIC_URL;else process.env.PUBLIC_URL=previous;await browser.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});
