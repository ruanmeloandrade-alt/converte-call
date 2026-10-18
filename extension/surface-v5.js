'use strict';
const customerBeforeSlim=customer;
customer=function(){let html=customerBeforeSlim();if(!contactId)return html;const l=workspace.leads.find(l=>l.id===contactId);if(!l)return html;const profile=`<iframe class="native-profile-frame" title="Ficha do cliente" src="${chrome.runtime.getURL('slim.html')}?module=lead&leadId=${encodeURIComponent(l.id)}"></iframe>`;return html.replace(/<form id="customer-v3-form"[\s\S]*?<\/form>/,profile);};
window.addEventListener('message',e=>{const frame=document.querySelector('.native-profile-frame');if(e.origin!==location.origin||e.source!==frame?.contentWindow||e.data?.channel!=='cc-slim')return;if(e.data.type==='close-profile')post('hide');});
