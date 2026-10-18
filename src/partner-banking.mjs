import {randomUUID} from 'node:crypto';
import {partnerFor} from './partners.mjs';
import {requireOwner} from './teams.mjs';

const fail=(status,message)=>Object.assign(Error(message),{status});
const VERSION='2026-09-30.endive';
const includes='include[0]=configuration.recipient&include[1]=requirements';
const accountId=value=>/^acct_[A-Za-z0-9]+$/.test(value||'');

// Stripe collects identity and bank details. Only the provider reference and a
// minimal masked summary belong here; never persist an onboarding URL or bank form.
export class PartnerBanking{
 constructor(store,billing,{enabled=()=>process.env.STRIPE_PARTNER_BANK_ENABLED==='true'}={}){
  Object.assign(this,{store,billing,enabled});
  store.db.exec(`CREATE TABLE IF NOT EXISTS partner_bank_accounts(
   partner_id TEXT PRIMARY KEY REFERENCES partners(id),account_id TEXT UNIQUE,
   platform_id TEXT NOT NULL,livemode INTEGER NOT NULL,country TEXT NOT NULL,
   create_key TEXT NOT NULL,summary TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
   INSERT OR IGNORE INTO migrations VALUES(16,datetime('now'));`);
 }
 partner(user){requireOwner(this.store,user);const partner=partnerFor(this.store,user);if(!partner||partner.status!=='active')throw fail(403,'Ative sua área de parceiro primeiro.');return partner;}
 config(){const config=this.billing.config();if(!config?.apiKey||!accountId(config.accountId))throw fail(503,'O cadastro bancário aguarda a configuração de pagamentos.');return config;}
 row(partner){return this.store.one('SELECT * FROM partner_bank_accounts WHERE partner_id=?',partner.id);}
 validateRow(row){const config=this.config();if(row.platform_id!==config.accountId||!!row.livemode!==!!config.livemode)throw fail(409,'A conta de recebimento pertence a outra configuração de pagamentos. Fale com o suporte.');return config;}
 async api(path,{method='GET',body,idempotency}={}){
  const config=this.config();let response;
  try{response=await this.billing.fetcher('https://api.stripe.com/v2/core/'+path,{method,headers:{Authorization:'Bearer '+config.apiKey,'Stripe-Version':VERSION,...(body?{'Content-Type':'application/json'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}catch{throw fail(502,'Não foi possível consultar o cadastro bancário. Tente novamente; sua conta será preservada.');}
  const data=await response.json().catch(()=>({}));if(response.ok)return data;
  const code=data.error?.code||data.error?.type||'provider_error';
  const setup=['accounts_v2_access_blocked','non_connect_platform_accounts_v2_access_blocked','platform_registration_required','connect_profile_not_submitted','account_create_activation_required','account_creation_liability_unacknowledged','connect_identity_not_verified','account_creation_identity_verification_incomplete'].includes(code);
  const err=fail(response.status===401||response.status===403||setup?503:502,response.status===401||response.status===403?'O cadastro bancário aguarda a liberação das permissões de contas conectadas no servidor.':setup?'O administrador precisa concluir a ativação do programa de repasses na Stripe.':'A Stripe não concluiu o cadastro. Tente novamente ou fale com o suporte.');err.providerCode=code;throw err;
 }
 async status(user){
  const partner=this.partner(user),row=this.row(partner),enabled=!!this.enabled();
  if(!row?.account_id){
   if(enabled)try{await this.api('accounts?limit=1');}catch(error){console.error(JSON.stringify({type:'partner-bank-setup-required',code:error.providerCode||'unavailable'}));return {status:'not_started',enabled:false,bank:null,message:error.message};}
   return {status:'not_started',enabled,bank:null,message:enabled?'Cadastre a conta em que deseja receber suas comissões.':'O cadastro bancário aguarda a ativação pelo administrador.'};
  }
  this.validateRow(row);
  try{
   const account=await this.api('accounts/'+row.account_id+'?'+includes);
   if(account.id!==row.account_id||!!account.livemode!==!!row.livemode||account.metadata?.partnerId!==partner.id||account.metadata?.application!=='converte-call')throw fail(409,'A conta de recebimento não corresponde ao parceiro. Fale com o suporte.');
   const legacy=await this.billing.api('/accounts/'+row.account_id);
   if(legacy.id!==row.account_id||legacy.country?.toLowerCase()!==row.country)throw fail(409,'Dados da conta de recebimento divergentes. Fale com o suporte.');
   const caps=account.configuration?.recipient?.capabilities?.stripe_balance;
   const bank=legacy.external_accounts?.data?.find(b=>b.object==='bank_account'&&b.default_for_currency&& !['errored','verification_failed'].includes(b.status));
   const ready=!account.closed&&caps?.stripe_transfers?.status==='active'&&caps?.payouts?.status==='active'&&legacy.payouts_enabled===true&&!!bank;
   const status=ready?'connected':account.closed||legacy.requirements?.disabled_reason?.startsWith('rejected')?'restricted':legacy.requirements?.pending_verification?.length?'pending_verification':'incomplete';
   const summary={status,bank:bank?{name:String(bank.bank_name||'Banco cadastrado').slice(0,100),last4:String(bank.last4||'').slice(-4),currency:String(bank.currency||'').slice(0,3)}:null,pendingFields:(legacy.requirements?.currently_due||[]).length,checkedAt:Date.now()};
   this.store.run('UPDATE partner_bank_accounts SET summary=?,updated_at=? WHERE partner_id=?',this.store.vault.seal(summary),Date.now(),partner.id);
   return {...summary,enabled,message:ready?'Conta de recebimento verificada.':status==='pending_verification'?'Seus dados estão em análise pela Stripe.':status==='restricted'?'A conta está restrita. Confira as pendências no cadastro seguro.':'Conclua as informações solicitadas e cadastre sua conta bancária.'};
  }catch(error){if(error.status===409)throw error;const previous=this.store.vault.open(row.summary);return {...previous,status:'unknown',enabled,message:error.message};}
 }
 async onboarding(user,input={}){
  const partner=this.partner(user);if(!this.enabled())throw fail(503,'O cadastro bancário aguarda a ativação pelo administrador.');
  return this.billing.locked('partner-bank:'+partner.id,async()=>{
   const config=this.config();let row=this.row(partner);
   if(row)this.validateRow(row);
   if(!row){
    const platform=await this.billing.api('/account');if(platform.id!==config.accountId||!/^[A-Z]{2}$/.test(platform.country||''))throw fail(409,'Configuração da plataforma de repasses divergente.');
    // Cross-border recipients require a separately approved payout route. Do not
    // promise international bank support from a Brazilian platform by default.
    const country=String(input.country||platform.country).toLowerCase();if(country!==platform.country.toLowerCase())throw fail(400,'O cadastro bancário está disponível, por enquanto, no país da plataforma.');
    this.store.run('INSERT INTO partner_bank_accounts VALUES(?,?,?,?,?,?,?,?,?)',partner.id,null,config.accountId,Number(config.livemode),country,randomUUID(),this.store.vault.seal({status:'not_started',bank:null}),Date.now(),Date.now());row=this.row(partner);
   }
   if(!row.account_id){
    const account=await this.api('accounts',{method:'POST',idempotency:'cc-partner-bank-'+row.create_key,body:{contact_email:user.email,display_name:'Parceiro Converte Call',dashboard:'express',identity:{country:row.country},defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},metadata:{application:'converte-call',partnerId:partner.id},include:['configuration.recipient']}});
    if(!accountId(account.id)||!!account.livemode!==!!config.livemode)throw fail(502,'A Stripe retornou uma conta de outro ambiente.');
    this.store.run('UPDATE partner_bank_accounts SET account_id=?,updated_at=? WHERE partner_id=?',account.id,Date.now(),partner.id);row=this.row(partner);
   }
   const base=new URL('/partners',this.billing.publicUrl);if(base.protocol!=='https:'&&config.livemode)throw fail(503,'O cadastro bancário exige o endereço seguro da plataforma.');
   const returnUrl=new URL(base);returnUrl.searchParams.set('bank','return');returnUrl.hash='finance';const refreshUrl=new URL(base);refreshUrl.searchParams.set('bank','refresh');refreshUrl.hash='finance';
   const link=await this.api('account_links',{method:'POST',body:{account:row.account_id,use_case:{type:'account_onboarding',account_onboarding:{configurations:['recipient'],collection_options:{fields:'eventually_due'},return_url:returnUrl.href,refresh_url:refreshUrl.href}}}});
   const url=new URL(link.url);if(url.protocol!=='https:'||url.hostname!=='accounts.stripe.com'||link.account!==row.account_id)throw fail(502,'A Stripe retornou um endereço de cadastro inválido.');
   return {url:url.href};
  });
 }
}
