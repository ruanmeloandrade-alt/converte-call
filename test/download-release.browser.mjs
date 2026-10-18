import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createApp} from '../src/server.mjs';
import {uploadRelease} from '../src/release-uploads.mjs';
import {zip} from './fixtures/release-zip.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('an already open sales download page downloads the newly published ADM ZIP, including retries',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cc-download-release-'));
 const app=createApp({dir,master:'b'.repeat(64)});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});
 const publish=version=>{const bytes=zip({'manifest.json':JSON.stringify({manifest_version:3,name:'Converte Call',version}),'app.js':'/* isolated test fixture */'});return {bytes,info:uploadRelease(app.store,{base64:bytes.toString('base64')})};};
 try{
  publish('9.0.0');
  const page=await browser.newPage({acceptDownloads:true});
  await page.goto(base+'/download');
  await page.getByText('Versão 9.0.0 · Google Chrome',{exact:true}).waitFor();
  let newest=publish('9.0.1');
  const checkDownload=async selector=>{
   const waiting=page.waitForEvent('download');await page.locator(selector).click();const download=await waiting;
   assert.equal(download.suggestedFilename(),newest.info.filename);
   assert.deepEqual(readFileSync(await download.path()),newest.bytes);
   const meta=await(await fetch(base+'/download/info')).json();
   const announcement=await(await fetch(base+'/v1/releases/latest')).json();
   assert.equal(meta.version,newest.info.version);assert.equal(meta.sha256,newest.info.sha256);
   assert.equal(announcement.version,newest.info.version);
  };
  await checkDownload('#download-extension');
  await page.getByRole('heading',{name:/Download iniciado/}).waitFor();
  newest=publish('9.0.2');
  await checkDownload('#download-again');
  await page.route('**/download/info',r=>r.fulfill({status:503,body:'unavailable'}));
  await page.locator('#download-again').click();
  await page.locator('#tutorial-status').filter({hasText:'Clique em baixar para tentar novamente'}).waitFor();
  assert.equal(await page.locator('#download-again').isEnabled(),true);
  await page.unroute('**/download/info');
  await checkDownload('#download-again');
 }finally{await browser.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});
