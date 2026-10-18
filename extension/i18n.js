'use strict';
(()=>{
 const catalog=globalThis.CCLocaleCatalog,dictionaries=new Map(catalog.columns.map((code,i)=>[code,new Map(catalog.rows.map(row=>[row[0],row[i+1]]))]));
 const valid=code=>catalog.languages.some(([id])=>id===code),memo=new WeakMap();let language='pt-BR',queued=false;
 const translate=value=>dictionaries.get(language)?.get(value)||value;
 function localize(){
  queued=false;document.documentElement.lang=language;
  // Only UI controls and navigation. Never scan messages, notes, answers, inputs or customer fields.
  const selector='button,label,summary,.sidebar,.back-row,.topmeta,#mobile-screen option,[data-i18n]';
  const controls=[...document.querySelectorAll(selector)];if(typeof screen!=='undefined'&&screen==='settings')controls.push(...document.querySelectorAll('.main h2,.main .pagehead p'));
  for(const root of controls){
   if(root.closest('[data-user-content],.support-answers,.academy-lesson h2,.academy-lesson p,[contenteditable=true]'))continue;
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
   while((node=walker.nextNode())){if(node.parentElement.closest('textarea,script,style,select:not(#mobile-screen)'))continue;const current=node.nodeValue,previous=memo.get(node),source=previous?.translated===current?previous.source:current,trimmed=source.trim(),value=translate(trimmed),next=source.replace(trimmed,value);if(next!==current)node.nodeValue=next;memo.set(node,{source,translated:next});}
   for(const name of ['title','aria-label']){const value=root.getAttribute(name);if(value){const attrKey='ccOriginal'+name.replace('-','');if(!root.dataset[attrKey])root.dataset[attrKey]=value;root.setAttribute(name,translate(root.dataset[attrKey]));}}
  }
 }
 const schedule=()=>{if(!queued){queued=true;queueMicrotask(localize);}};
 async function setLanguage(code){if(!valid(code))throw Error('Unsupported language');language=code;await chrome.storage.local.set({ccLanguage:code});if(typeof render==='function'&&typeof data!=='undefined')render();localize();}
 globalThis.CCLocale={translate,setLanguage,get language(){return language;},languages:catalog.languages};
 if(typeof views!=='undefined'){
  const settingsBefore=views.settings;views.settings=()=>settingsBefore()+`<section class="card spaced" id="language-settings"><h2 data-i18n>Idioma da interface</h2><p class="muted spaced" data-i18n>Escolha o idioma dos menus e comandos. Seus conteúdos são preservados.</p><label class="spaced"><span data-i18n>Idioma</span><select id="cc-language" name="interfaceLanguage">${catalog.languages.map(([code,label])=>`<option value="${code}" ${language===code?'selected':''}>${label}</option>`).join('')}</select></label></section>`;
  const headBefore=head;head=function(title,sub,actions){return headBefore(translate(title),translate(sub),actions);};
  const renderBefore=render;render=function(){const expanded=[...document.querySelectorAll('.sidebar details')].map(el=>el.open);renderBefore();document.querySelectorAll('.sidebar details').forEach((el,i)=>{if(expanded[i])el.open=true;});localize();};
 }
 document.addEventListener('change',event=>{if(event.target.id==='cc-language')setLanguage(event.target.value).catch(error=>{if(typeof toast==='function')toast(error.message);});});
 const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
 chrome.storage.local.get('ccLanguage').then(saved=>{language=valid(saved.ccLanguage)?saved.ccLanguage:'pt-BR';if(language!=='pt-BR'&&typeof render==='function'&&typeof data!=='undefined')render();localize();});
 chrome.storage.onChanged.addListener((changes,area)=>{const code=changes.ccLanguage?.newValue;if(area==='local'&&valid(code)&&code!==language){language=code;if(typeof render==='function'&&typeof data!=='undefined')render();localize();}});
})();
