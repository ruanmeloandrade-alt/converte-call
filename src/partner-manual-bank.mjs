import {partnerFor} from './partners.mjs';
import {requireOwner} from './teams.mjs';
import {requireAdmin} from './licensing.mjs';

const fail=(status,message)=>Object.assign(Error(message),{status});
const limits={holderName:150,country:2,currency:3,bankName:120,bankCode:20,branch:30,accountNumber:80,accountType:20,routingNumber:40,iban:40,swift:11,pixType:10,pixKey:150};
function validate(input){
 const data={};for(const [key,max]of Object.entries(limits)){if(input[key]!=null&&typeof input[key]!=='string')throw fail(400,'Confira os dados de recebimento.');const value=(input[key]||'').trim();if(value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail(400,'Confira o tamanho e o formato dos dados de recebimento.');data[key]=value;}
 data.country=data.country.toUpperCase();data.currency=data.currency.toUpperCase();data.iban=data.iban.replace(/ /g,'').toUpperCase();data.swift=data.swift.toUpperCase();
 if(data.holderName.length<3||!/[\p{L}]/u.test(data.holderName))throw fail(400,'Informe o nome do titular da conta.');
 if(!/^[A-Z]{2}$/.test(data.country)||!Intl.supportedValuesOf('currency').includes(data.currency))throw fail(400,'Informe o país e uma moeda válida para recebimento.');
 if(data.accountType&&!['checking','savings','payment'].includes(data.accountType))throw fail(400,'Selecione um tipo de conta válido.');
 if(data.iban&&!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(data.iban))throw fail(400,'Confira o formato do IBAN.');
 if(data.swift&&!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(data.swift))throw fail(400,'Confira o código SWIFT/BIC.');
 if(data.pixKey){const validators={email:v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),phone:v=>/^\+[1-9]\d{7,14}$/.test(v),cpf:v=>/^\d{11}$/.test(v),cnpj:v=>/^\d{14}$/.test(v),random:v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)};if(!validators[data.pixType]?.(data.pixKey))throw fail(400,'Confira a chave Pix e o tipo selecionado.');}else data.pixType='';
 const bank=!!(data.bankName&&(data.accountNumber||data.iban));
 if(!data.pixKey&&!bank)throw fail(400,'Cadastre uma chave Pix ou informe banco e número da conta/IBAN.');
 if([data.bankName,data.bankCode,data.branch,data.accountNumber,data.routingNumber,data.iban,data.swift].some(Boolean)&&!bank)throw fail(400,'Complete o banco e o número da conta/IBAN, ou deixe os dados bancários vazios para usar somente Pix.');
 return data;
}
export class PartnerManualBanking{
 constructor(store){this.store=store;store.db.exec(`CREATE TABLE IF NOT EXISTS partner_manual_bank_accounts(partner_id TEXT PRIMARY KEY REFERENCES partners(id),details TEXT NOT NULL,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL);INSERT OR IGNORE INTO migrations VALUES(18,datetime('now'));`);}
 partner(user){requireOwner(this.store,user);const p=partnerFor(this.store,user);if(!p||p.status!=='active')throw fail(403,'Ative sua área de parceiro primeiro.');return p;}
 readRow(id){return this.store.one('SELECT * FROM partner_manual_bank_accounts WHERE partner_id=?',id);}
 state(user){const p=this.partner(user),row=this.readRow(p.id);return {mode:'manual',registered:!!row,revision:row?.revision||0,updatedAt:row?.updated_at||null,details:row?this.store.vault.open(row.details):null};}
 save(user,input){const p=this.partner(user),details=validate(input.details||{});if(!Number.isSafeInteger(input.revision)||input.revision<0)throw fail(400,'Reabra seu cadastro antes de salvar.');return this.store.transaction(()=>{const row=this.readRow(p.id);if((row?.revision||0)!==input.revision)throw fail(409,'Os dados foram alterados em outra tela. Atualize antes de editar novamente.');this.store.run('INSERT INTO partner_manual_bank_accounts VALUES(?,?,?,?) ON CONFLICT(partner_id) DO UPDATE SET details=excluded.details,revision=excluded.revision,updated_at=excluded.updated_at',p.id,this.store.vault.seal(details),input.revision+1,Date.now());return this.state(user);});}
 list(actor){requireAdmin(this.store,actor);return {partners:this.store.all('SELECT p.id,u.email,b.revision,b.updated_at FROM partners p JOIN users u ON u.id=p.user_id LEFT JOIN partner_manual_bank_accounts b ON b.partner_id=p.id ORDER BY b.updated_at DESC,p.created_at DESC').map(r=>({id:r.id,email:r.email,registered:!!r.revision,updatedAt:r.updated_at||null}))};}
 adminDetail(actor,id){requireAdmin(this.store,actor);const p=this.store.one('SELECT p.id,u.email FROM partners p JOIN users u ON u.id=p.user_id WHERE p.id=?',id);if(!p)throw fail(404,'Parceiro não encontrado.');const row=this.readRow(id);return {id:p.id,email:p.email,mode:'manual',registered:!!row,revision:row?.revision||0,updatedAt:row?.updated_at||null,details:row?this.store.vault.open(row.details):null};}
}
