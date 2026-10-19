'use strict';
window.CCPhoneInput={read(form){
 const code=String(form.elements.countryCode?.value||'55').trim().replace(/^\+/,''),field=form.elements.whatsapp,raw=String(field?.value||'').trim();
 if(!/^[1-9]\d{0,2}$/.test(code))throw Error('Confira o código do país. Exemplo: 55 para Brasil ou 351 para Portugal.');
 if(!/^\+?[\d\s().-]+$/.test(raw))throw Error('Confira o WhatsApp. Use apenas o DDD e o número, sem letras.');
 let national=raw.replace(/\D/g,'');
 if(raw.startsWith('+')){if(!national.startsWith(code))throw Error('O número informado usa outro código de país. Confira os dois campos.');national=national.slice(code.length);}
 else if(code==='55'&&[12,13].includes(national.length)&&national.startsWith(code))national=national.slice(code.length);
 if(!national||national.length+code.length>15)throw Error('Confira o DDD e o número do WhatsApp.');
 return code+national;
}};
