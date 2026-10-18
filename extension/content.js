(() => {
 'use strict';
 const ID='converte-call-native-root',old=document.getElementById(ID);
 if(old)return;
 const host=document.createElement('div');host.id=ID;host.style.cssText='all:initial!important;position:fixed!important;inset:0!important;z-index:2147483646!important;pointer-events:none!important;';
 const sh=host.attachShadow({mode:'closed'}),origin=chrome.runtime.getURL('').replace(/\/$/,'');
 const style=document.createElement('style');style.textContent=`
 :host{all:initial}*{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}button{cursor:pointer;font:inherit}button:focus-visible{outline:3px solid #b9abff;outline-offset:3px}.dock{z-index:5;position:fixed;right:16px;top:30%;display:flex;flex-direction:column;gap:6px;padding:7px;background:#fff;border:1px solid #e5e7f0;border-radius:16px;box-shadow:0 9px 35px #15192e20;pointer-events:auto;touch-action:none}.dock button{width:38px;height:38px;background:#f5f4fb;border:0;border-radius:10px;color:#6852e8;display:flex;align-items:center;justify-content:center;position:relative}.dock button:hover{background:#ede8ff}.dock svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.dock .brand{background:#6852e8;gap:3px;color:white;cursor:grab}.brand i{width:3px;background:white;height:12px;border-radius:3px}.brand i:nth-child(2){height:22px}.brand i:nth-child(3){height:16px}.dock .recording:after{content:'';position:absolute;right:3px;top:3px;width:7px;height:7px;background:#ce4765;border:2px solid white;border-radius:50%}.dock .delete{color:#bd566a}.dock .sale{color:#16784b;background:#e8f7ef}.dock .sale:hover{background:#d3f0e0}.tip{display:none;position:absolute;right:52px;background:#171b32;color:#fff;font-size:11px;padding:9px 12px;white-space:nowrap;border-radius:7px;box-shadow:0 3px 15px #0002}.dock button:hover .tip,.dock button:focus-visible .tip{display:block}.menu{z-index:6;max-height:calc(70vh - 20px);overflow:auto;position:fixed;right:80px;top:30%;width:220px;padding:12px;pointer-events:auto;background:white;border:1px solid #e5e7f0;border-radius:14px;box-shadow:0 12px 45px #15192e26}.menu h3{font-size:11px;color:#80869b;padding:3px 9px 10px;margin:0}.menu button{border:0;border-radius:7px;background:transparent;text-align:left;width:100%;padding:11px;font-size:12px;color:#171b32}.menu button:hover{background:#f0edff;color:#6852e8}iframe{z-index:2;position:fixed;pointer-events:auto;border:1px solid #e3e5ef;background:#f3f4f9;box-shadow:0 15px 65px #10142c30;border-radius:16px}.surface{z-index:3;width:370px;height:600px;max-height:calc(100vh - 32px);right:80px;top:16px}.surface.hud{width:345px;height:390px;right:80px;top:auto;bottom:26px}.surface.customer{height:660px}.crm{inset:24px;width:calc(100vw - 48px);height:calc(100vh - 48px)}.notice{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:480px;pointer-events:auto;padding:14px 20px;background:#171b32;color:white;border-radius:10px;font-size:12px;box-shadow:0 5px 20px #0003}.hidden{display:none!important}@media(max-width:650px){.dock{right:6px}.surface,.surface.hud,.surface.customer{width:calc(100vw - 72px);right:62px;top:10px;bottom:auto;max-height:calc(100vh - 20px)}.crm{inset:6px;width:calc(100vw - 12px);height:calc(100vh - 12px)}.menu{right:62px}}`;
 const paths={pipeline:'<path d="M3 4h18l-7 8v7l-4 2v-9z"/>',record:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',inbox:'<path d="M21 11a9 9 0 0 1-9 9H4l-2 2v-9a9 9 0 1 1 19-2Z"/><path d="M7 9h10M7 13h6"/>',sale:'<path d="M3 4h2l3 12h10l3-9H6M10 21h.01M18 21h.01M12 3v6m-3-3h6"/>',tracking:'<path d="M4 3v18h17M8 16v-4m5 4V8m5 8V4"/>',menu:'<path d="M5 6h14M5 12h14M5 18h14"/>'};
 const icon=(n)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[n]}</svg>`;
 const dock=document.createElement('div');dock.className='dock';dock.setAttribute('role','toolbar');dock.setAttribute('aria-label','Converte Call');
 const drag=document.createElement('button');drag.className='brand';drag.setAttribute('aria-label','Mover atalhos');drag.title='Arraste para posicionar os atalhos';drag.innerHTML='<i></i><i></i><i></i>';dock.append(drag);
 for(const [name,label] of [['pipeline','Funil de vendas'],['record','Gravar call'],['inbox','Abrir WhatsApp Web'],['sale','Registrar venda'],['tracking','Tracking'],['menu','Mais módulos']]){const b=document.createElement('button');b.dataset.action=name;b.setAttribute('aria-label',label);b.title=label;b.innerHTML=icon(name)+`<span class="tip">${label}</span>`;if(name==='sale')b.className='sale';dock.append(b);}
 const menu=document.createElement('div');menu.className='menu hidden';menu.innerHTML='<h3>SEU CRM, NESTA PÁGINA</h3>';
 for(const [view,label] of [['home','Visão geral'],['pipeline','Funil de vendas'],['workflow','Workflow da call'],['agenda','Agenda'],['calls','Gravações e histórico'],['projects','Projetos'],['automations','Central de automações'],['brain','Cérebro da IA'],['email','Email marketing'],['sms','SMS marketing'],['groups','Grupos'],['integrations','Integrações'],['settings','Conta e configurações']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>openCRM(view);menu.append(b);}
 let surface=null,crm=null,lessonCard=null,context={name:'',phone:''},barHost=null,lastHeader=null,observer,scheduled=false,disposed=false,suspended=false,followingMode='dock',crmView='home';
 function notice(text){const n=document.createElement('div');n.className='notice';n.textContent=text;sh.append(n);setTimeout(()=>n.remove(),5000);}
 function hideMenu(){menu.classList.add('hidden');}
 function publishSurface(mode,view){followingMode=mode;lessonCard?.remove();lessonCard=null;if(!suspended)chrome.runtime.sendMessage({channel:'cc',type:'surface-location',mode,view}).catch(()=>{});}
 function showLesson(lesson){
  if(lessonCard?.isConnected&&lessonCard.dataset.lessonId===lesson?.id)return;
  lessonCard?.remove();lessonCard=null;
  if(!['www.youtube.com','youtube.com'].includes(location.hostname)||new URL(location.href).searchParams.get('v')!==lesson?.videoId)return;
  const card=document.createElement('section');card.dataset.lessonId=lesson.id;card.setAttribute('aria-label','Acompanhamento da aula Converte Call');card.style.cssText='position:fixed;right:80px;bottom:24px;width:300px;max-width:calc(100vw - 100px);padding:20px;border:1px solid #ded5f6;border-radius:18px;background:white;color:#29213f;box-shadow:0 12px 45px #15192e26;pointer-events:auto;font-size:13px;line-height:1.5';
  const label=document.createElement('small');label.textContent='FACULDADE CONVERTE CALL';label.style.color='#6852e8';
  const title=document.createElement('h3');title.textContent=lesson.title;title.style.margin='8px 0';
  const message=document.createElement('p');message.textContent='Inscreva-se no canal e deixe seu comentário no YouTube. Comente sua dúvida: ela será respondida em até 24 horas.';
  const back=document.createElement('button');back.dataset.ccAction='academy-return';back.textContent='← Voltar para a Faculdade';back.style.cssText='width:100%;border:0;border-radius:999px;padding:12px;background:#6852e8;color:white;font-weight:600';back.onclick=()=>openCRM('academy');
  card.append(label,title,message,back);sh.append(card);lessonCard=card;
 }
 function openCRM(view='home',publish=true){if(publish)publishSurface('crm',view);hideMenu();dock.classList.add('hidden');if(surface)surface.classList.add('hidden');if(!crm){crm=document.createElement('iframe');crm.className='crm';crm.allow='clipboard-write';crm.title='Converte Call • CRM';sh.append(crm);}if(!crm.src||crmView!==view)crm.src=chrome.runtime.getURL('panel.html')+'#'+encodeURIComponent(view);crmView=view;crm.classList.remove('hidden');}
 function openSurface(view='recorder',intent='',publish=true){
  if(publish)publishSurface('surface',view);hideMenu();dock.classList.remove('hidden');if(crm)crm.classList.add('hidden');if(!publish&&surface?.dataset.view===view){surface.classList.remove('hidden');return;}if(surface)surface.remove();surface=document.createElement('iframe');surface.dataset.view=view;surface.className='surface '+(view==='hud'?'hud':view==='customer'?'customer':'');surface.title=view==='hud'?'Converte Call • Apoio da reunião':view==='customer'?'Ficha do cliente':'Converte Call • Gravação';surface.allow='microphone; display-capture; clipboard-write';surface.src=chrome.runtime.getURL('surface.html')+'#'+new URLSearchParams({view,context:JSON.stringify(context),intent});const frame=surface,snapshot=intent==='reply'?conversationSnapshot():null;frame.addEventListener('load',()=>frame.contentWindow.postMessage({channel:'cc-host',type:'inbox-context',intent,context,snapshot},origin),{once:true});sh.append(frame);
 }
 async function record(){const r=await chrome.runtime.sendMessage({channel:'cc',type:'capture-status'});if(r?.recording)openSurface('hud');else{const opened=await chrome.runtime.sendMessage({channel:'cc',type:'open-recorder'});if(!opened.ok)notice(opened.error);}}
 async function perform(action){if(action==='pipeline')return openCRM('pipeline');if(action==='record')return record();if(action==='inbox'){hideMenu();const access=await chrome.runtime.sendMessage({channel:'cc',type:'open-inbox'});if(!access?.ok){notice(access?.error||'Entre na sua conta.');return;}if(access.employee){openCRM('employee-inbox');return;}if(location.hostname==='web.whatsapp.com'){if(crm)crm.classList.add('hidden');if(surface)surface.classList.add('hidden');findWhatsApp();notice('Selecione uma conversa. Os controles aparecem no cabeçalho e acima da caixa de mensagem.');}return;}if(action==='sale')return openCRM('orders');if(action==='tracking')return openCRM('tracking');if(action==='menu')menu.classList.toggle('hidden');}
 dock.addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(b)perform(b.dataset.action).catch(()=>notice('A extensão foi atualizada. Recarregue a página para continuar.'));});
 const onMessage=e=>{if(e.origin!==origin||![surface?.contentWindow,crm?.contentWindow].includes(e.source)||e.data?.channel!=='cc-ui')return;const m=e.data;
  if(suspended)return;
  if(m.action==='navigation'){crmView=m.view;publishSurface(followingMode==='inbox'&&m.view==='employee-inbox'?'inbox':'crm',m.view);return;}
  if(m.action==='hide'||m.action==='close'){publishSurface('dock','home');dock.classList.remove('hidden');if(e.source===crm?.contentWindow)crm.classList.add('hidden');else surface.classList.add('hidden');}
  if(m.action==='crm')openCRM(m.view||'home');if(m.action==='surface')openSurface(m.view||'hud');if(m.action==='inbox')perform('inbox');if(m.action==='resize-surface'&&surface){surface.style.height=Math.max(230,Math.min(innerHeight-32,Number(m.height)||390))+'px';}
  if(m.action==='move-surface'&&surface){const r=surface.getBoundingClientRect();surface.style.right='auto';surface.style.bottom='auto';surface.style.left=Math.max(6,Math.min(innerWidth-r.width-6,r.left+(Number(m.dx)||0)))+'px';surface.style.top=Math.max(6,Math.min(innerHeight-r.height-6,r.top+(Number(m.dy)||0)))+'px';}
  if(m.action==='compact'&&crm){publishSurface(location.hostname==='web.whatsapp.com'&&crmView==='employee-inbox'?'inbox':'dock',crmView);crm.classList.add('hidden');dock.classList.remove('hidden');}if(m.action==='expand'&&crm){publishSurface('crm',crmView);crm.classList.remove('hidden');}
 };
 window.addEventListener('message',onMessage);
 const nativeMounts=new Map();let nativeData=null;const composerResize=new ResizeObserver(()=>positionComposer());
 const nativeCSS=`:host{all:initial;min-width:0}*{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}.bar{display:flex;align-items:center;gap:6px;padding:6px;flex-wrap:wrap;max-width:100%;color:#e9e5ff;background:#262431;border:1px solid #51466e;border-radius:999px}.bar button{border:1px solid #65538c;border-radius:999px;background:#393044;color:#f3efff;font-weight:600;padding:7px 9px;font-size:11px;cursor:pointer;white-space:nowrap}.bar button:hover{background:#5e4692}.bar button:focus-visible{outline:3px solid #c2a9ff;outline-offset:2px}.bar .primary{background:#7154e8;border-color:#8c76ee}.bar .stop{background:#4e2938;border-color:#b5687c;color:#ffd6df}.bar .chip{font-size:10px;padding:4px 7px;border-radius:12px;color:#e1d6ff;background:#473a5f;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar .state{font-size:10px;color:#c4b7db}.compact{padding:3px;border:none;background:transparent}.compact button{padding:6px 8px;font-size:10px}.tags button{min-height:36px;min-width:135px;padding:9px 14px;font-size:12px;background:#7154e8;color:#fff;border-color:#9279ef;border-radius:999px;box-shadow:0 3px 10px #5c3db52b}.tags .chip{max-width:85px}@media(prefers-color-scheme:light){.bar{background:#fbfaff;border-color:#ded5f6;color:#302443}.bar button{color:#6043b8;background:#f0eaff;border-color:#e4d9fc}.bar .primary{background:#7154e8;color:white}.bar .stop{background:#ffeff3;color:#a23754}.bar .chip{background:#eee7ff;color:#6043b8}.bar .state{color:#78688e}.compact{background:transparent;border:none}}`;
 function currentLead(){return nativeData?.leads?.find(l=>l.id===nativeData.bindings?.[context.phone?'phone:'+context.phone:'title:'+context.name]);}
 function conversationSnapshot(){
  const main=document.querySelector('#main');const rows=[...(main?.querySelectorAll('.message-in,.message-out')||[])].slice(-24);const messages=rows.map(row=>({direction:row.classList.contains('message-in')?'in':'out',text:[...row.querySelectorAll('.selectable-text')].map(n=>n.innerText||n.textContent||'').join('\n').trim().slice(0,3000)})).filter(m=>m.text);
  return {messages,lastReceived:[...messages].reverse().find(m=>m.direction==='in')?.text||'',capturedAt:Date.now()};
 }
 function mountNative(key,target,className,items){
  if(!target)return removeNative(key);let m=nativeMounts.get(key);if(!m||!m.host.isConnected||m.target!==target){m?.host.remove();const h=document.createElement('div');h.id='converte-call-'+key;h.style.cssText=['composer','profile','tags'].includes(key)?'display:block!important;position:fixed!important;z-index:2147483640!important;width:max-content!important;pointer-events:auto!important;margin:0!important;padding:0!important;':'display:flex;align-items:center;flex-shrink:1;min-width:0;margin:0 6px;';const r=h.attachShadow({mode:'closed'}),css=document.createElement('style'),bar=document.createElement('div');css.textContent=nativeCSS;r.append(css,bar);if(['composer','profile','tags'].includes(key))document.documentElement.append(h);else target.append(h);m={host:h,target,bar,signature:''};nativeMounts.set(key,m);if(key==='composer'){composerResize.observe(target);composerResize.observe(h);}}
  const signature=JSON.stringify(items);if(m.signature===signature)return;m.signature=signature;m.bar.className='bar '+className;m.bar.replaceChildren();for(const item of items){const e=document.createElement(item.action?'button':'span');e.textContent=item.label;e.className=item.className||(item.action?'':'chip');if(item.action){e.type='button';e.setAttribute('aria-label',item.label);e.onclick=()=>openSurface('customer',item.action);}m.bar.append(e);}
 }
 function removeNative(key){if(key==='composer')composerResize.disconnect();nativeMounts.get(key)?.host.remove();nativeMounts.delete(key);}
 function positionComposer(){
  const m=nativeMounts.get('composer');if(!m?.host.isConnected||!m.target.isConnected)return;
  const footer=m.target.getBoundingClientRect(),main=document.querySelector('#main')?.getBoundingClientRect();
  if(!main||footer.width<20||footer.height<1){m.host.style.visibility='hidden';return;}
  m.host.style.visibility='visible';m.host.style.maxWidth=Math.max(0,Math.min(main.right,footer.right)-Math.max(main.left,footer.left)-28)+'px';
  m.host.style.left=Math.max(main.left,footer.left)+14+'px';const height=m.host.getBoundingClientRect().height;
  m.host.style.top=Math.max(main.top+64,footer.top-height-8)+'px';
 }
 function sidebarHeader(){const side=document.querySelector('#side');return side?.querySelector('header')||side?.parentElement?.querySelector('header');}
 function applyWhatsAppBrand(){
  delete document.documentElement.dataset.converteCallTheme;
  document.querySelector('#converte-call-whatsapp-logo')?.remove();
 }
 function headerWord(header){return [...(header?.querySelectorAll('h1,h2,span,b,strong')||[])].find(e=>e.textContent.trim()==='WhatsApp');}
 function positionInline(){for(const key of ['tags','profile']){const m=nativeMounts.get(key);if(!m?.host.isConnected||!m.target.isConnected)continue;const header=m.target.closest('header');if(!header){m.host.style.visibility='hidden';continue;}const r=header.getBoundingClientRect();let anchor=m.target.getBoundingClientRect();try{const range=document.createRange();range.selectNodeContents(m.target);const text=range.getBoundingClientRect();if(text.width)anchor=text;}catch{}m.host.style.visibility=r.width>10?'visible':'hidden';m.host.style.left=(anchor.right+10)+'px';m.host.style.top=(r.top+(r.height-m.host.getBoundingClientRect().height)/2)+'px';m.host.style.maxWidth=Math.max(100,r.right-anchor.right-22)+'px';}}
 function nativeButtons(header){
  const main=document.querySelector('#main'),lead=currentLead(),automation=nativeData?.leadAutomation?.[lead?.id]||{};
  const items=[];for(const [kind,label]of [['bot','bot'],['agent','agente IA']]){const running=['active','running','starting','queued','waiting','stopping'].includes(automation[kind]?.status);items.push({label:running?'Parar '+label:'Ativar '+label,action:running?'stop-'+kind:kind,className:running?'stop':''});}items.push({label:'✦ Resposta inteligente',action:'reply',className:'primary'});
  const footer=main?.querySelector('footer')||main?.querySelector('[contenteditable="true"][role="textbox"]')?.closest('footer');mountNative('composer',footer,'',items);positionComposer();
  const title=header.querySelector('[data-testid="conversation-info-header-chat-title"]')||[...header.querySelectorAll('span[title]')].find(n=>!n.id?.startsWith('converte-call'));mountNative('profile',title,'compact',[{label:'Perfil do cliente',action:'profile'},{label:'Funil / etapa',action:'stage'}]);
  let sideHeader=sidebarHeader();if(sideHeader===header)sideHeader=null;
  const tags=[...new Set([...(lead?.tags||[]),...(lead?.tag?[lead.tag]:[])])];mountNative('tags',headerWord(sideHeader),'compact tags',[{label:'Tags do lead'+(tags.length?' ('+tags.length+')':''),action:'tags'}]);positionInline();
 }
 let nativeOwner=false;async function checkNativeOwner(){try{const result=await chrome.runtime.sendMessage({channel:'cc',type:'native-inbox-access'});nativeOwner=result?.ok===true&&result.owner===true;}catch{nativeOwner=false;}if(!suspended&&followingMode==='inbox'&&nativeOwner){crm?.classList.add('hidden');surface?.classList.add('hidden');dock.classList.remove('hidden');}findWhatsApp();}if(location.hostname==='web.whatsapp.com')checkNativeOwner();
 chrome.storage.local.get('converteCallWorkspace').then(r=>{nativeData=r.converteCallWorkspace;findWhatsApp();});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.converteCallWorkspace){nativeData=changes.converteCallWorkspace.newValue;findWhatsApp();}});
 function findWhatsApp(){
  if(disposed||location.hostname!=='web.whatsapp.com')return;if(suspended||!nativeOwner){for(const key of [...nativeMounts.keys()])removeNative(key);return;}applyWhatsAppBrand();
  const main=document.querySelector('#main');const header=main?.querySelector('header');if(!header){for(const key of [...nativeMounts.keys()])removeNative(key);context={name:'',phone:''};return;}
  const titleEl=header.querySelector('[data-testid="conversation-info-header-chat-title"]')||[...header.querySelectorAll('span[title]')].find(n=>!n.closest('#converte-call-whatsapp-actions'));
  const title=(titleEl?.getAttribute('title')||titleEl?.textContent||'').trim().slice(0,160);const phone=/^\+?[\d\s().-]{7,}$/.test(title)?title.replace(/[^\d+]/g,''):'';
  const next={name:title,phone};if(title!==context.name||phone!==context.phone){context=next;surface?.contentWindow.postMessage({channel:'cc-host',type:'conversation',context},origin);}nativeButtons(header);
 }
 const runtimeListener=(m,sender,reply)=>{if(m?.channel!=='cc')return;
  if(m.type==='surface-ping'){reply({ok:true});return;}
  if(m.type==='surface-toggle'){host.dispatchEvent(new Event('cc-show'));reply({ok:true});return;}
  if(m.type==='surface-suspend'){suspended=true;host.style.setProperty('display','none','important');for(const key of [...nativeMounts.keys()])removeNative(key);hideMenu();reply({ok:true});return;}
  if(m.type==='surface-restore'){
   const state=m.state;if(!state?.enabled){reply({ok:false});return;}
   suspended=false;host.style.removeProperty('display');followingMode=state.mode;
   if(state.mode!=='lesson'){lessonCard?.remove();lessonCard=null;}
   if(state.mode==='crm')openCRM(state.view,false);
   else if(state.mode==='surface')openSurface(state.view,'',false);
   else if(state.mode==='inbox'&&(location.hostname!=='web.whatsapp.com'||!nativeOwner))openCRM('employee-inbox',false);
   else{crm?.classList.add('hidden');surface?.classList.add('hidden');dock.classList.remove('hidden');hideMenu();if(state.mode==='lesson')showLesson(state.lesson);}
   findWhatsApp();reply({ok:true});return;
  }
  if(m.type==='open')openSurface(m.view);if(m.type==='state-changed'){refreshState();if(location.hostname==='web.whatsapp.com')checkNativeOwner();surface?.contentWindow.postMessage({channel:'cc-host',type:'refresh'},origin);}
 };
 chrome.runtime.onMessage.addListener(runtimeListener);
 async function refreshState(){try{const s=await chrome.runtime.sendMessage({channel:'cc',type:'capture-status'});dock.querySelector('[data-action=record]').classList.toggle('recording',!!s.recording);}catch{}}
 let dragState=null;
 drag.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragState={x:e.clientX,y:e.clientY,rect:dock.getBoundingClientRect(),moved:false};drag.setPointerCapture(e.pointerId);});
 drag.addEventListener('pointermove',e=>{if(!dragState)return;const dx=e.clientX-dragState.x,dy=e.clientY-dragState.y;if(Math.abs(dx)+Math.abs(dy)>4)dragState.moved=true;const x=Math.max(6,Math.min(innerWidth-58,dragState.rect.left+dx)),y=Math.max(6,Math.min(innerHeight-dock.offsetHeight-6,dragState.rect.top+dy));dock.style.right='auto';dock.style.left=x+'px';dock.style.top=y+'px';});
 drag.addEventListener('pointerup',()=>{if(dragState?.moved)chrome.storage.local.set({ccDock:{x:parseFloat(dock.style.left),y:parseFloat(dock.style.top)}});dragState=null;});
 const clamp=()=>{if(dock.style.left){dock.style.left=Math.max(6,Math.min(innerWidth-58,parseFloat(dock.style.left)))+'px';dock.style.top=Math.max(6,Math.min(innerHeight-dock.offsetHeight-6,parseFloat(dock.style.top)))+'px';}};
 window.addEventListener('resize',()=>{clamp();positionComposer();positionInline();});window.addEventListener('scroll',()=>{positionComposer();positionInline();},true);
 host.addEventListener('cc-show',()=>{suspended=false;host.style.removeProperty('display');publishSurface('dock','home');crm?.classList.add('hidden');surface?.classList.add('hidden');dock.classList.remove('hidden');menu.classList.toggle('hidden');});
 sh.append(style,dock,menu);document.documentElement.append(host);
 chrome.storage.local.get('ccDock').then(({ccDock:p})=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){dock.style.right='auto';dock.style.left=p.x+'px';dock.style.top=p.y+'px';clamp();}});
 if(location.hostname==='web.whatsapp.com'){observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;findWhatsApp();});});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['title']});findWhatsApp();}
 refreshState();
 chrome.runtime.sendMessage({channel:'cc',type:'surface-ready'}).then(result=>{if(result?.suspended){suspended=true;host.style.setProperty('display','none','important');findWhatsApp();}}).catch(()=>{});
})();
