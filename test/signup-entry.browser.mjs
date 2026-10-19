import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync}from'node:fs';import {tmpdir}from'node:os';import{join}from'node:path';import{createRequire}from'node:module';import{createApp}from'../src/server.mjs';
const{chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
test('free trial CTAs open registration and existing-account download never replaces the create-account link',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-signup-entry-')),app=createApp({dir,master:'f'.repeat(64)});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});
 try{const p=await browser.newPage();await p.goto(base);await p.getByRole('link',{name:'Começar grátis ↗',exact:true}).click();await p.getByRole('button',{name:'Criar conta e começar teste grátis',exact:true}).waitFor();assert.equal(new URL(p.url()).pathname,'/register');assert(await p.getByLabel('Nome',{exact:true}).isVisible());
 await p.goto(base+'/download?existing=1');assert.equal(new URL(await p.locator('#register-link').getAttribute('href'),base).pathname,'/register');await p.goto(base+'/access');await p.getByRole('link',{name:'Ainda não tem conta? Criar minha conta ↗',exact:true}).click();await p.getByRole('button',{name:'Criar conta e começar teste grátis',exact:true}).waitFor();
 }finally{await browser.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});
