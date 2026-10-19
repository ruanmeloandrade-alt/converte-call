'use strict';
// A web app receives published code from the server; no ZIP reaches the phone.
(()=>{
 let current=document.querySelector('meta[name="cc-mobile-revision"]')?.content,pending=null,lastInteraction=Date.now(),checking=false;const baselines=new WeakMap();
 const snapshot=el=>el.isContentEditable?el.textContent:['checkbox','radio'].includes(el.type)?el.checked:el.value;
 function activity(event){lastInteraction=Date.now();const el=event.target;if(el?.matches?.('input,textarea,select,[contenteditable=true]')&&!baselines.has(el))baselines.set(el,event.type==='input'?el.defaultValue:snapshot(el));}
 function dirty(doc){try{if([...doc.querySelectorAll('video,audio')].some(el=>!el.paused&&!el.ended))return true;return [...doc.querySelectorAll('input,textarea,select,[contenteditable=true]')].some(el=>{if(el.disabled||el.type==='hidden'||el.type==='search')return false;if(baselines.has(el))return snapshot(el)!==baselines.get(el);if(el.isContentEditable)return !!el.textContent.trim();if(el.type==='file')return !!el.files?.length;if(['checkbox','radio'].includes(el.type))return el.checked!==el.defaultChecked;if(el.tagName==='SELECT')return [...el.options].some(o=>o.selected!==o.defaultSelected)&&el.value!==el.options[0]?.value;return el.value!==el.defaultValue;});}catch{return true;}}
 function safe(){if(window.CCMobileRecorderBusy?.()||dirty(document))return false;return [...document.querySelectorAll('iframe')].every(frame=>{try{return !frame.contentDocument||!dirty(frame.contentDocument);}catch{return false;}});}
 function apply(){if(!pending||!safe()||!document.hidden&&Date.now()-lastInteraction<15000)return;navigator.serviceWorker?.getRegistration('/account/').then(r=>r?.update()).catch(()=>{});location.reload();}
 async function check(){if(checking||!navigator.onLine)return;checking=true;try{const response=await fetch('/account/app-version',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)return;const {revision}=await response.json();if(!/^[a-f0-9]{64}$/.test(revision))return;if(!current)current=revision;else if(revision!==current)pending=revision;apply();}catch{}finally{checking=false;}}
 for(const type of ['pointerdown','keydown','focusin','beforeinput','input'])document.addEventListener(type,activity,{capture:true,passive:true});
 document.addEventListener('cc-mobile-saved',event=>event.target.querySelectorAll('input,textarea,select').forEach(el=>baselines.delete(el)));
 // Activity inside a same-origin module also protects ongoing typing.
 const frames=new WeakSet();function watchFrames(){for(const frame of document.querySelectorAll('iframe')){if(frames.has(frame))continue;frames.add(frame);frame.addEventListener('load',()=>{try{for(const type of ['pointerdown','keydown','focusin','beforeinput','input'])frame.contentDocument.addEventListener(type,activity,{capture:true,passive:true});}catch{}});}}
 new MutationObserver(watchFrames).observe(document.documentElement,{childList:true,subtree:true});watchFrames();
 setInterval(check,30000);setInterval(apply,5000);addEventListener('focus',check);addEventListener('online',check);document.addEventListener('visibilitychange',check);check();
})();
