'use strict';
async function loadCoupons(){
 const result=await request('/v1/admin/coupons');$('#coupon-rows').replaceChildren();$('#coupon-empty').hidden=!!result.coupons.length;
 for(const coupon of result.coupons){const tr=document.createElement('tr');cell(tr,coupon.code);cell(tr,coupon.type==='percent'?coupon.value.toLocaleString('pt-BR')+'%':new Intl.NumberFormat('pt-BR',{style:'currency',currency:coupon.currency}).format(coupon.value/100));cell(tr,coupon.duration==='once'?'Primeira cobrança':'Todas as cobranças');cell(tr,(coupon.expiresAt?date(coupon.expiresAt*1000):'Sem data limite')+' · '+(coupon.maxRedemptions?coupon.maxRedemptions+' usos no total':'Sem limite de usos'));cell(tr,!coupon.ready?'Criação pendente':!coupon.active?'Desativado':coupon.expiresAt&&coupon.expiresAt*1000<=Date.now()?'Expirado':'Ativo');const actions=cell(tr,'');action(actions,coupon.active?'Desativar':'Ativar',async()=>{await request('/v1/admin/coupons/'+coupon.id,{method:'PATCH',body:{active:!coupon.active}});await loadCoupons();});$('#coupon-rows').append(tr);}
}
$('#coupon-create').elements.type.onchange=()=>{const form=$('#coupon-create'),fixed=form.elements.type.value==='amount';$('#coupon-currency-label').hidden=!fixed;form.elements.value.max=fixed?'1000000':'100';$('#coupon-value-label').textContent=fixed?'Valor do desconto':'Porcentagem de desconto';};
$('#coupon-create').onsubmit=async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type=submit]');button.disabled=true;$('#coupon-create-status').textContent='Criando cupom…';
 try{const input=Object.fromEntries(new FormData(form));if(input.expiresAt)input.expiresAt=new Date(input.expiresAt).toISOString();const {coupon}=await request('/v1/admin/coupons',{method:'POST',body:input});$('#coupon-create-status').textContent='Cupom '+coupon.code+' criado e pronto para usar no checkout.';form.reset();form.elements.type.onchange();await loadCoupons();}catch(error){$('#coupon-create-status').textContent=error.message;}finally{button.disabled=false;}
};
$('#coupon-refresh').onclick=()=>loadCoupons().catch(error=>notify(error.message));
