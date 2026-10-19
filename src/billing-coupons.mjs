import {randomUUID} from 'node:crypto';
import {requireAdmin} from './licensing.mjs';
import {requireOwner} from './teams.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const normalize=code=>String(code||'').trim().toUpperCase();
export class BillingCoupons{
 constructor(billing){this.billing=billing;this.store=billing.store;this.store.db.exec(`CREATE TABLE IF NOT EXISTS billing_coupons(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,definition TEXT NOT NULL,stripe_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at INTEGER NOT NULL);INSERT OR IGNORE INTO migrations VALUES(26,datetime('now'));`);if(!this.store.all('PRAGMA table_info(billing_pending)').some(c=>c.name==='coupon_id'))this.store.db.exec('ALTER TABLE billing_pending ADD COLUMN coupon_id TEXT');}
 row(row){return {id:row.id,code:row.code,...JSON.parse(row.definition),active:!!row.active,ready:!!row.stripe_id,createdAt:row.created_at};}
 list(actor){requireAdmin(this.store,actor);return {coupons:this.store.all('SELECT * FROM billing_coupons ORDER BY created_at DESC').map(row=>this.row(row))};}
 async create(actor,input){
  requireAdmin(this.store,actor);const code=normalize(input.code),type=input.type,currency=type==='amount'?String(input.currency||'brl').toLowerCase():null,duration=input.duration||'once',number=Number(input.value),value=type==='amount'?Math.round(number*100):number;
  const maxRedemptions=input.maxRedemptions==null||input.maxRedemptions===''?null:Number(input.maxRedemptions),expiresAt=input.expiresAt?Math.floor(Date.parse(input.expiresAt)/1000):null;
  if(!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code))throw fail(400,'Use de 3 a 40 letras, números, hífen ou sublinhado no código.');
  if(!['percent','amount'].includes(type)||!Number.isFinite(number)||number<=0||Math.round(number*100)/100!==number||type==='percent'&&(number>100||Math.round(number*100)/100!==number)||type==='amount'&&(!Number.isSafeInteger(value)||value<1||value>100000000))throw fail(400,'Informe um valor positivo ou uma porcentagem de até 100%, com até 2 casas decimais.');
  if(type==='amount'&&!['brl','usd','eur'].includes(currency)||!['once','forever'].includes(duration)||maxRedemptions!==null&&(!Number.isSafeInteger(maxRedemptions)||maxRedemptions<1||maxRedemptions>1000000)||expiresAt!==null&&(!Number.isSafeInteger(expiresAt)||expiresAt<=Date.now()/1000))throw fail(400,'Confira a moeda, a duração, a validade e o limite de usos.');
  const definition=JSON.stringify({type,value,currency,duration,maxRedemptions,expiresAt});
  return this.billing.locked('coupon:'+code,async()=>{
   const config=this.billing.config();if(!this.billing.status().configured||!config.productId)throw fail(503,'Configure a Stripe antes de criar cupons.');
   let row=this.store.one('SELECT * FROM billing_coupons WHERE code=?',code);
   if(row&&row.definition!==definition)throw fail(409,'Esse código já existe com outra configuração. Crie um novo código.');
   if(!row){const id=randomUUID();this.store.run('INSERT INTO billing_coupons VALUES(?,?,?,NULL,1,?,?)',id,code,definition,actor.id,Date.now());row=this.store.one('SELECT * FROM billing_coupons WHERE id=?',id);}
   if(!row.stripe_id){const coupon=await this.billing.api('/coupons',{method:'POST',idempotency:'cc-coupon-'+row.id,body:{id:'cc_'+row.id.replaceAll('-',''),name:code,duration,...(type==='percent'?{percent_off:value}:{amount_off:value,currency}),...(maxRedemptions?{max_redemptions:maxRedemptions}:{}),...(expiresAt?{redeem_by:expiresAt}:{}),applies_to:{products:[config.productId]},metadata:{application:'converte-call',couponId:row.id,code}}});
    if(typeof coupon.id!=='string')throw fail(502,'A Stripe não confirmou o cupom. Tente salvar novamente.');this.store.run('UPDATE billing_coupons SET stripe_id=? WHERE id=?',coupon.id,row.id);this.billing.audit(actor.id,actor.workspace_id,'coupon-created',{couponId:row.id,code,...JSON.parse(definition)});
   }
   return {coupon:this.row(this.store.one('SELECT * FROM billing_coupons WHERE id=?',row.id))};
  });
 }
 setActive(actor,id,active){requireAdmin(this.store,actor);if(typeof active!=='boolean')throw fail(400,'Informe se o cupom está ativo.');const row=this.store.one('SELECT * FROM billing_coupons WHERE id=?',id);if(!row)throw fail(404,'Cupom não encontrado.');this.store.run('UPDATE billing_coupons SET active=? WHERE id=?',Number(active),id);this.billing.audit(actor.id,actor.workspace_id,'coupon-status',{couponId:id,active});return {coupon:this.row({...row,active:Number(active)})};}
 async preview(user,input){
  requireOwner(this.store,user);const quote=this.billing.currencies.quote(input.plan,input.seats??1,input.currency||'brl');return this.resolve(input.code,quote.currency,quote.amount);
 }
 async resolve(code,currency,subtotal){
  const row=this.store.one('SELECT * FROM billing_coupons WHERE code=?',normalize(code));if(!row||!row.active||!row.stripe_id)throw fail(400,'Cupom inválido ou desativado.');const def=JSON.parse(row.definition);
  if(def.expiresAt&&def.expiresAt<=Date.now()/1000)throw fail(400,'Este cupom expirou.');
  if(def.currency&&def.currency!==currency)throw fail(400,'Este cupom é válido para pagamentos em '+def.currency.toUpperCase()+'.');
  const coupon=await this.billing.api('/coupons/'+encodeURIComponent(row.stripe_id));
  if(!coupon.valid||coupon.deleted||def.maxRedemptions&&coupon.times_redeemed>=def.maxRedemptions)throw fail(400,'Este cupom expirou ou atingiu o limite de usos.');
  const discount=Math.min(subtotal,def.type==='percent'?Math.round(subtotal*def.value/100):def.value);
  return {id:row.id,code:row.code,stripeCouponId:row.stripe_id,currency,subtotal,discount,total:subtotal-discount,duration:def.duration,type:def.type,value:def.value};
 }
}

// Only Stripe-fetched, paid invoices with an evidenced discount can have a lower total.
export function discountedInvoice(invoice,amount){
 const discounts=invoice.total_discount_amounts;
 if(invoice.subtotal!==amount||!Array.isArray(discounts)||!discounts.length||!discounts.every(d=>Number.isSafeInteger(d.amount)&&d.amount>=0))return false;
 const discount=discounts.reduce((sum,d)=>sum+d.amount,0);
 return discount>0&&discount<=amount&&invoice.total===amount-discount&&invoice.amount_paid===invoice.total;
}
