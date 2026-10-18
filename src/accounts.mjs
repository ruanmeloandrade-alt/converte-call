import {TRIAL_DAYS} from './licensing.mjs';
import {randomUUID} from 'node:crypto';
const fail=message=>Object.assign(Error(message),{status:400});
export function installProfiles(store){store.transaction(()=>{store.db.exec(`CREATE TABLE IF NOT EXISTS account_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),profile TEXT NOT NULL,created_at INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS account_phones(phone_key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),slot TEXT NOT NULL CHECK(slot IN ('primary','secondary')),UNIQUE(user_id,slot));INSERT OR IGNORE INTO migrations VALUES(3,datetime('now'));`);});}
export function validPhone(value,required=true){
 const raw=String(value??'');if(!raw&&!required)return null;
 // Country code included. Do not silently remove punctuation or letters.
 if(!/^[1-9]\d{7,14}$/.test(raw)||/^(\d)\1+$/.test(raw))throw fail('Informe o WhatsApp somente com números, incluindo código do país e DDD (ex.: 5522992888971).');
 const codes='1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98 211 212 213 216 218 220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 235 236 237 238 239 240 241 242 243 244 245 246 247 248 249 250 251 252 253 254 255 256 257 258 260 261 262 263 264 265 266 267 268 269 290 291 297 298 299 350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 376 377 378 380 381 382 383 385 386 387 389 420 421 423 500 501 502 503 504 505 506 507 508 509 590 591 592 593 594 595 596 597 598 599 670 672 673 674 675 676 677 678 679 680 681 682 683 685 686 687 688 689 690 691 692 850 852 853 855 856 880 886 960 961 962 963 964 965 966 967 968 970 971 972 973 974 975 976 977 992 993 994 995 996 998'.split(' ');if(!codes.some(code=>raw.startsWith(code)))throw fail('Informe um código de país válido no início do telefone.');
 if(raw.startsWith('55')){const national=raw.slice(2),ddd=Number(national.slice(0,2)),areas=[11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];if(!areas.includes(ddd)||!(/^[1-9]\d9\d{8}$/.test(national)||/^[1-9]\d[2-5]\d{7}$/.test(national)))throw fail('Informe um WhatsApp brasileiro válido, com 55, DDD e número completo.');}
 if(raw.startsWith('1')&&!/^1[2-9]\d{2}[2-9]\d{6}$/.test(raw))throw fail('Informe o telefone com código 1 e os dez dígitos válidos do número.');
 return raw;
}
export function validateProfile(input,now=Date.now()){
 const firstName=String(input.firstName||'').trim(),lastName=String(input.lastName||'').trim(),birthDate=String(input.birthDate||'');
 if(!firstName||!lastName||firstName.length>80||lastName.length>120)throw fail('Informe nome e sobrenome.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||!Number.isFinite(Date.parse(birthDate+'T00:00:00Z'))||new Date(birthDate+'T00:00:00Z').toISOString().slice(0,10)!==birthDate||Date.parse(birthDate+'T00:00:00Z')>now||Date.parse(birthDate+'T00:00:00Z')<Date.UTC(1900,0,1))throw fail('Informe uma data de nascimento válida.');
 const whatsapp=validPhone(input.whatsapp),whatsappSecondary=validPhone(input.whatsappSecondary,false);
 if(whatsapp===whatsappSecondary)throw fail('O segundo WhatsApp deve ser diferente do principal.');
 return {firstName,lastName,birthDate,whatsapp,whatsappSecondary};
}
export const phoneKey=(store,number)=>store.vault.sign('account-phone:'+number);
export function requireAvailablePhones(store,profile){for(const number of [profile.whatsapp,profile.whatsappSecondary].filter(Boolean))if(store.one('SELECT user_id FROM account_phones WHERE phone_key=?',phoneKey(store,number)))throw Object.assign(Error('Este telefone já está cadastrado em outra conta. Entre na conta existente ou fale com o suporte.'),{status:409});}
export function startAccountTrial(store,userId,workspaceId,profile,now=Date.now()){
 requireAvailablePhones(store,profile);
 store.run('INSERT INTO account_profiles VALUES(?,?,?)',userId,store.vault.seal(profile),now);
 for(const [slot,number] of [['primary',profile.whatsapp],['secondary',profile.whatsappSecondary]])if(number)store.run('INSERT INTO account_phones VALUES(?,?,?)',phoneKey(store,number),userId,slot);
 store.run("INSERT INTO account_roles VALUES(?,'customer')",userId);
 store.run('INSERT INTO subscriptions VALUES(?,?,?,?,?,0)',workspaceId,'trial',now,now+TRIAL_DAYS*86400000,now);
 store.run('INSERT INTO license_audit VALUES(?,?,?,?,?,?)',randomUUID(),userId,workspaceId,'account-trial-started',JSON.stringify({days:TRIAL_DAYS,expiresAt:new Date(now+TRIAL_DAYS*86400000).toISOString()}),now);
}
export function accountProfile(store,userId){const row=store.one('SELECT profile FROM account_profiles WHERE user_id=?',userId);return row?store.vault.open(row.profile):null;}

export function updateAccountProfile(store,userId,input){
 const previous=accountProfile(store,userId)||{},profile=validateProfile({...previous,...input});
 for(const key of ['company','position','website','country','city','address','postalCode']){
  const value=String(input[key]??previous[key]??'').trim();if(value.length>500)throw fail('Informação de perfil muito longa.');profile[key]=value;
 }
 store.transaction(()=>{
  for(const number of [profile.whatsapp,profile.whatsappSecondary].filter(Boolean)){
   const found=store.one('SELECT user_id FROM account_phones WHERE phone_key=?',phoneKey(store,number));
   if(found&&found.user_id!==userId)throw Object.assign(Error('Este telefone já está cadastrado em outra conta.'),{status:409});
  }
  store.run('INSERT INTO account_profiles VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET profile=excluded.profile',userId,store.vault.seal(profile),Date.now());
  store.run('DELETE FROM account_phones WHERE user_id=?',userId);
  for(const [slot,number] of [['primary',profile.whatsapp],['secondary',profile.whatsappSecondary]])if(number)store.run('INSERT INTO account_phones VALUES(?,?,?)',phoneKey(store,number),userId,slot);
 });return profile;
}
