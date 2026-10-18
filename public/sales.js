 'use strict';
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduce&&'IntersectionObserver'in window){document.documentElement.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}},{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));let queued=false;const update=()=>{const hero=document.querySelector('.hero'),story=document.querySelector('.story-track');document.documentElement.style.setProperty('--progress',Math.min(1,scrollY/Math.max(1,hero.offsetHeight)));const bounds=story.getBoundingClientRect();story.style.setProperty('--story-progress',Math.max(0,Math.min(1,-bounds.top/Math.max(1,bounds.height-innerHeight))));queued=false;};addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update);}},{passive:true});update();}
const scenarios={atender:{label:'ATENDIMENTO COM CONTEXTO',scene:'<span class="scene-label">CONVERSA + HISTÓRICO + PRÓXIMO PASSO</span><div class="scene-bubble">Oi! Podemos retomar aquela proposta?</div><div class="scene-bubble answer">Claro. Vamos olhar juntos o que faz mais sentido para você.</div><span class="scene-label">RASCUNHO ILUSTRATIVO · VOCÊ REVISA ANTES DE ENVIAR</span>',title:'Uma boa resposta começa com uma boa leitura.',description:'Conversa, histórico e informações do cliente juntos. A IA ajuda a preparar um rascunho; você revisa e decide o que enviar.'},conversar:{label:'UMA CONVERSA COM DIREÇÃO',scene:'<span class="scene-label">ROTEIRO DA CALL · ENTENDER O CENÁRIO</span><div class="scene-step"><span>Ouvir antes de propor.</span><i>Você está aqui</i></div><div class="scene-bubble answer">“Qual é a dificuldade que mais pesa na sua rotina hoje?”</div><span class="scene-label">SUGESTÃO ILUSTRATIVA · BASEADA NO SEU CONTEXTO</span>',title:'Mais espaço para ouvir. Um caminho para continuar.',description:'Seu roteiro fica por perto enquanto a conversa acontece. Com a IA ativada, receba sugestões e registre os pontos importantes para retomar depois.'},entregar:{label:'DO COMBINADO À ENTREGA',scene:'<span class="scene-label">CADA ETAPA TEM UM PRÓXIMO PASSO</span><div class="scene-step"><span>Conversa organizada</span><i>✓</i></div><div class="scene-step"><span>Pedido registrado</span><i>✓</i></div><div class="scene-step"><span>Projeto em andamento</span><i>→</i></div>',title:'O “sim” é só o começo da próxima etapa.',description:'Conecte o que foi vendido ao trabalho que precisa ser entregue. Saiba o que está em andamento e mantenha o cliente no contexto.'}};
function scenario(key){const s=scenarios[key];for(const button of document.querySelectorAll('[data-scenario]'))button.setAttribute('aria-selected',String(button.dataset.scenario===key));document.querySelector('#scenario-panel').setAttribute('aria-labelledby','tab-'+key);document.querySelector('#scenario-label').textContent=s.label;document.querySelector('#scenario-scene').innerHTML=s.scene;document.querySelector('#scenario-title').textContent=s.title;document.querySelector('#scenario-description').textContent=s.description;}
const tabs=[...document.querySelectorAll('[data-scenario]')];tabs.forEach((button,index)=>{button.addEventListener('click',()=>scenario(button.dataset.scenario));button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(index+(['ArrowLeft','ArrowUp'].includes(e.key)?2:1))%3;tabs[next].focus();scenario(tabs[next].dataset.scenario);});});scenario('atender');
const params=new URLSearchParams(location.search),allowed=['ref','utm_source','utm_medium','utm_campaign','utm_content','utm_term'];for(const link of document.querySelectorAll('a[href="/download"]')){const url=new URL(link.href);for(const key of allowed)if(params.has(key))url.searchParams.set(key,params.get(key).slice(0,200));if(/Android/i.test(navigator.userAgent))url.searchParams.set('platform','android');link.href=url.pathname+url.search;}
// Particle wordmark stays local: no libraries, remote assets or customer data.
(()=>{
 const canvas=document.querySelector('#brand-particles'),button=document.querySelector('#toggle-motion');if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 let width=0,height=0,points=[],stars=[],frame=0,paused=reduce,visible=true,time=0;
 const pointer={x:-9999,y:-9999};
 function resize(){
  const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
  const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  const mask=document.createElement('canvas');mask.width=Math.round(width);mask.height=Math.round(height);const m=mask.getContext('2d');
  let size=height*.8;m.font='900 '+size+'px Arial, sans-serif';size*=width*.96/m.measureText('CONVERTE CALL').width;m.font='900 '+size+'px Arial, sans-serif';m.textAlign='center';m.textBaseline='middle';m.fillText('CONVERTE CALL',width/2,height/2);
  const palette=[[155,50,243],[236,56,142],[255,126,40]],color=x=>{const t=x/width*2,i=Math.min(1,Math.floor(t)),f=t-i;return 'rgb('+palette[i].map((v,k)=>Math.round(v+(palette[i+1][k]-v)*f)).join(',')+')';};
  const data=m.getImageData(0,0,mask.width,mask.height).data,step=width<600?3:4;points=[];
  for(let y=0;y<mask.height;y+=step)for(let x=0;x<mask.width;x+=step)if(data[(y*mask.width+x)*4+3]>130){const px=x+(Math.random()-.5)*1.6,py=y+(Math.random()-.5)*1.6;points.push({x:px,y:py,homeX:px,homeY:py,r:.6+Math.random()*1.05,a:.35+Math.random()*.65,phase:Math.random()*6.28,color:color(x)});}
  stars=Array.from({length:width<600?30:80},()=>({x:Math.random()*width,y:Math.random()*height,r:.3+Math.random()*.8,a:.1+Math.random()*.3}));
  draw();
 }
 function draw(){
  ctx.clearRect(0,0,width,height);
  for(const s of stars){ctx.fillStyle='rgba(201,149,244,'+s.a+')';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
  ctx.globalCompositeOperation='lighter';
  for(const p of points){let tx=p.homeX,ty=p.homeY;if(!paused){const dx=p.homeX-pointer.x,dy=p.homeY-pointer.y,d=Math.hypot(dx,dy);if(d>0&&d<95){const force=(1-d/95)*27;tx+=dx/d*force;ty+=dy/d*force;}ty+=Math.sin(time*.016+p.phase)*.65;}
   p.x+=(tx-p.x)*.12;p.y+=(ty-p.y)*.12;ctx.globalAlpha=p.a;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 }
 function tick(){frame=0;if(paused||!visible||document.hidden)return;time++;draw();frame=requestAnimationFrame(tick);}
 function start(){if(!paused&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);}
 function stop(){cancelAnimationFrame(frame);frame=0;}
 canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();pointer.x=e.clientX-rect.left;pointer.y=e.clientY-rect.top;},{passive:true});canvas.addEventListener('pointerleave',()=>{pointer.x=pointer.y=-9999;});
 function controls(){button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'Reproduzir animações':'Pausar animações');button.textContent=paused?'▷':'Ⅱ';document.body.classList.toggle('motion-paused',paused);}
 button.addEventListener('click',()=>{paused=!paused;controls();if(paused){stop();draw();}else start();});
 new ResizeObserver(resize).observe(canvas);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();}).observe(canvas);
 document.addEventListener('visibilitychange',()=>document.hidden?stop():start());controls();resize();start();
})();
(()=>{
 const data=document.querySelector('#testimonial-data');if(!data)return;
 let stories;try{stories=JSON.parse(data.textContent);}catch{return;}if(!Array.isArray(stories)||!stories.length)return;
 const screen=document.querySelector('#story-screen'),avatars=document.querySelector('#story-avatars'),progress=document.querySelector('#story-progress'),pause=document.querySelector('#story-pause');
 let index=0,elapsed=0,last=0,frame=0,manualPause=reduce,holding=false,visible=false,startX=0,suppressClickUntil=0;
 avatars.replaceChildren();progress.replaceChildren();document.querySelector('#story-pending').hidden=true;pause.hidden=false;
 const buttons=stories.map((s,i)=>{const button=document.createElement('button');button.type='button';button.className='story-avatar-button';button.setAttribute('aria-label','Ver story de '+s.name);const ring=document.createElement('span');ring.className='ring';const photo=document.createElement('span');photo.className='portrait';photo.style.backgroundPosition=s.photoPosition;photo.setAttribute('role','img');photo.setAttribute('aria-label','Retrato ilustrativo de '+s.name);ring.append(photo);const label=document.createElement('span');label.textContent=s.name;button.append(ring,label);button.onclick=()=>show(i);avatars.append(button);const track=document.createElement('span'),fill=document.createElement('i');track.append(fill);progress.append(track);return button;});
 const fills=[...progress.querySelectorAll('i')];
 function show(i){index=(i+stories.length)%stories.length;elapsed=0;last=0;const s=stories[index];document.querySelector('#story-avatar').style.backgroundPosition=s.photoPosition;document.querySelector('#story-name').textContent=s.name+' · exemplo';document.querySelector('#story-role').textContent=s.role;document.querySelector('#story-tag').textContent='EXEMPLO ILUSTRATIVO · '+String(index+1).padStart(2,'0')+'/07';document.querySelector('#story-headline').textContent=s.headline;document.querySelector('#story-text').textContent=s.text;document.querySelector('#story-result').textContent=s.result;buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(j===index)));fills.forEach((f,j)=>f.style.width=j<index?'100%':'0%');screen.style.setProperty('--story-accent',s.color);screen.dataset.storyTheme=s.theme;screen.setAttribute('aria-label','Story demonstrativo de '+s.name);screen.classList.remove('story-changing');requestAnimationFrame(()=>screen.classList.add('story-changing'));start();}
 function tick(now){frame=0;if(manualPause||holding||!visible||document.hidden)return;if(last)elapsed+=Math.min(100,now-last);last=now;fills[index].style.width=Math.min(100,elapsed/80)+'%';if(elapsed>=8000)show(index+1);if(!frame)frame=requestAnimationFrame(tick);}
 function start(){if(!frame&&!manualPause&&!holding&&visible&&!document.hidden){last=0;frame=requestAnimationFrame(tick);}}
 function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
 function controls(){pause.textContent=manualPause?'▷':'Ⅱ';pause.setAttribute('aria-label',manualPause?'Reproduzir story':'Pausar story');pause.setAttribute('aria-pressed',String(manualPause));}
 pause.onclick=()=>{manualPause=!manualPause;controls();if(manualPause)stop();else start();};
 const previous=screen.querySelector('.previous'),next=screen.querySelector('.next');previous.hidden=next.hidden=false;previous.onclick=()=>{if(performance.now()>suppressClickUntil)show(index-1);};next.onclick=()=>{if(performance.now()>suppressClickUntil)show(index+1);};
 screen.addEventListener('pointerdown',e=>{if(e.target.closest('#story-pause'))return;holding=true;startX=e.clientX;stop();});
 function release(e){if(!holding)return;holding=false;if(e&&Math.abs(e.clientX-startX)>45){suppressClickUntil=performance.now()+400;show(index+(e.clientX<startX?1:-1));e.preventDefault();}start();}
 screen.addEventListener('pointerup',release);screen.addEventListener('pointercancel',()=>release());screen.addEventListener('pointerleave',()=>{holding=false;start();});
 screen.tabIndex=0;screen.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(index+(e.key==='ArrowRight'?1:-1));}});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();},{threshold:.25}).observe(screen);document.addEventListener('visibilitychange',()=>document.hidden?stop():start());controls();show(0);
})();
