'use strict';
globalThis.CCBillingCatalog=Object.freeze([
 Object.freeze({id:'monthly',name:'Mensal',months:1,usd:698,brl:2990,pixMessage:'#PIXm-bR | ☝😎Olá, quero fazer o pagamento do Plano Mensal no pix! Valor -> *R$29,90*💜'}),
 Object.freeze({id:'quarterly',name:'Trimestral',months:3,usd:1658,brl:6790,pixMessage:'#PIXt-bR | ☝😎Olá, quero fazer o pagamento do Plano Trimestral no pix!Valor -> *R$67,90*💜'})
]);
globalThis.CCTeamPricing=Object.freeze({maxSeats:7,usdPerMonth:150,brlPerMonth:500});
globalThis.CCBillingQuote=function(planId,seats=1){
 const plan=globalThis.CCBillingCatalog.find(p=>p.id===planId);
 if(!plan||!Number.isInteger(seats)||seats<1||seats>7)throw new RangeError('Escolha um plano e entre 1 e 7 pessoas no total.');
 const employees=seats-1,usd=plan.usd+employees*globalThis.CCTeamPricing.usdPerMonth*plan.months,brl=plan.brl+employees*globalThis.CCTeamPricing.brlPerMonth*plan.months;
 const pixMessage=employees?plan.pixMessage.replace(/\*R\$[\d,]+\*/, '*'+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(brl/100).replace(/\s/g,'')+'*')+' Equipe: '+seats+' pessoas (titular + '+employees+' funcionário'+(employees===1?'':'s')+').':plan.pixMessage;
 return {plan:plan.id,seats,employees,usd,brl,pixMessage};
};

globalThis.CCWhatsAppPricing=Object.freeze({maxConnections:3,usdPerMonth:150,brlPerMonth:825,includedSeats:2});
globalThis.CCWhatsAppQuote=function(planId,connections=1){
 const plan=globalThis.CCBillingCatalog.find(item=>item.id===planId);
 if(!plan||!Number.isInteger(connections)||connections<1||connections>3)throw new RangeError('Escolha um plano e entre um e três WhatsApps.');
 const additional=connections-1,usd=plan.usd+additional*globalThis.CCWhatsAppPricing.usdPerMonth*plan.months,brl=plan.brl+additional*globalThis.CCWhatsAppPricing.brlPerMonth*plan.months;
 const amount=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(brl/100).replace(/\s/g,'');
 const pixMessage=plan.pixMessage.replace(/\*R\$[\d,]+\*/,'*'+amount+'*')+' WhatsApps: '+connections+'. Inclui titular e um convidado.';
 return {plan:plan.id,connections,additional,seats:connections,usd,brl,pixMessage,model:'whatsapp-v1'};
};
