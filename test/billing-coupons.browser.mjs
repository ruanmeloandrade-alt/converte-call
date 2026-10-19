import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {couponFixture} from './coupon-fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('admin creates and deactivates coupons; buyer applies/removes them with correct totals on mobile and desktop',{timeout:60000},async()=>{
 const f=await couponFixture();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});const admin=await browser.newPage({viewport:{width:1440,height:1000}});admin.setDefaultTimeout(10000);
  await admin.addInitScript(token=>sessionStorage.setItem('ccAdminSession',token),f.admin.accessToken);await admin.goto(f.base+'/admin/cupons');await admin.getByRole('heading',{name:'Cupons de desconto',exact:true}).first().waitFor();
  await admin.locator('#coupon-create [name=code]').fill('BEMVINDO20');await admin.locator('#coupon-create [name=value]').fill('20');await admin.getByRole('button',{name:'Criar cupom',exact:true}).click();await admin.getByText('Cupom BEMVINDO20 criado e pronto para usar no checkout.',{exact:true}).waitFor();await admin.locator('#coupon-rows').getByText('BEMVINDO20',{exact:true}).waitFor();
  await admin.locator('#coupon-create [name=code]').fill('DESCONTO10');await admin.locator('#coupon-create [name=type]').selectOption('amount');await admin.locator('#coupon-create [name=value]').fill('10');await admin.locator('#coupon-create [name=duration]').selectOption('forever');await admin.getByRole('button',{name:'Criar cupom',exact:true}).click();await admin.getByText('Cupom DESCONTO10 criado e pronto para usar no checkout.',{exact:true}).waitFor();
  if(process.env.SCREENSHOT_DIR)await admin.screenshot({path:join(process.env.SCREENSHOT_DIR,'Converte-Call-cupons-administrador.png'),fullPage:true});
  const context=await browser.newContext({viewport:{width:393,height:852}});await context.addCookies([{name:'ccCheckout',value:f.cookie.split('=')[1],url:f.base+'/checkout'}]);const checkout=await context.newPage();checkout.setDefaultTimeout(10000);await checkout.goto(f.base+'/checkout');await checkout.locator('#purchase:not([hidden])').waitFor({state:'attached'});await checkout.locator('#currency').selectOption('brl');await checkout.getByRole('button',{name:'Continuar',exact:true}).click();
  const original=await checkout.locator('#total').textContent();await checkout.locator('#coupon-code').fill('BEMVINDO20');await checkout.getByRole('button',{name:'Aplicar',exact:true}).click();await checkout.getByText(/Cupom aplicado na primeira cobrança/).waitFor();assert.notEqual(await checkout.locator('#total').textContent(),original);assert.equal(await checkout.locator('#pix').isVisible(),false);
  const preview=await f.call('/checkout/api/coupon',{code:'BEMVINDO20',plan:'monthly',seats:1,currency:'brl'},null,'POST',f.cookie);assert.equal((await checkout.locator('#total').textContent()).replace(/\s/g,''),new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(preview.data.total/100).replace(/\s/g,''));
  assert(await checkout.locator('#coupon-code').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));if(process.env.SCREENSHOT_DIR)await checkout.screenshot({path:join(process.env.SCREENSHOT_DIR,'Converte-Call-cupom-checkout-mobile.png'),fullPage:true});
  await checkout.getByRole('button',{name:'Remover cupom',exact:true}).click();assert.equal(await checkout.locator('#total').textContent(),original);
  await checkout.locator('#coupon-code').fill('DESCONTO10');await checkout.getByRole('button',{name:'Aplicar',exact:true}).click();await checkout.getByText('Cupom aplicado em todas as cobranças desta assinatura.',{exact:true}).waitFor();
  await checkout.getByRole('button',{name:'Adicionar funcionário',exact:true}).click();await checkout.getByText('Seu plano ou moeda mudou. Aplique o cupom novamente.',{exact:true}).waitFor();assert.equal(await checkout.locator('#coupon-row').isVisible(),false);
  await checkout.getByRole('button',{name:'Aplicar',exact:true}).click();await checkout.getByText('Cupom aplicado em todas as cobranças desta assinatura.',{exact:true}).waitFor();
  await checkout.setViewportSize({width:1280,height:960});if(process.env.SCREENSHOT_DIR)await checkout.screenshot({path:join(process.env.SCREENSHOT_DIR,'Converte-Call-cupom-checkout.png'),fullPage:true});
  await admin.locator('#coupon-rows tr').filter({hasText:'DESCONTO10'}).getByRole('button',{name:'Desativar',exact:true}).click();await admin.locator('#coupon-rows tr').filter({hasText:'DESCONTO10'}).getByText('Desativado',{exact:true}).waitFor();
  await checkout.getByRole('button',{name:'Remover cupom',exact:true}).click();await checkout.locator('#coupon-code').fill('DESCONTO10');await checkout.getByRole('button',{name:'Aplicar',exact:true}).click();await checkout.getByText('Cupom inválido ou desativado.',{exact:true}).waitFor();
 }finally{if(browser)await browser.close();await f.close();}
});
