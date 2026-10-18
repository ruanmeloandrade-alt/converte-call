 'use strict';
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduce&&'IntersectionObserver'in window){document.documentElement.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}},{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));let queued=false;const update=()=>{const hero=document.querySelector('.hero'),story=document.querySelector('.momentum');document.documentElement.style.setProperty('--progress',Math.min(1,scrollY/Math.max(1,hero.offsetHeight)));const bounds=story.getBoundingClientRect();story.style.setProperty('--story-progress',Math.max(0,Math.min(1,-bounds.top/Math.max(1,bounds.height-innerHeight))));queued=false;};addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update);}},{passive:true});update();}
const scenarios={atender:{label:'ATENDIMENTO COM CONTEXTO',scene:'<span class="scene-label">CONVERSA + HISTÓRICO + PRÓXIMO PASSO</span><div class="scene-bubble">Oi! Podemos retomar aquela proposta?</div><div class="scene-bubble answer">Claro. Vamos olhar juntos o que faz mais sentido para você.</div><span class="scene-label">RASCUNHO ILUSTRATIVO · VOCÊ REVISA ANTES DE ENVIAR</span>',title:'Uma boa resposta começa com uma boa leitura.',description:'Conversa, histórico e informações do cliente juntos. A IA ajuda a preparar um rascunho; você revisa e decide o que enviar.'},conversar:{label:'UMA CONVERSA COM DIREÇÃO',scene:'<span class="scene-label">ROTEIRO DA CALL · ENTENDER O CENÁRIO</span><div class="scene-step"><span>Ouvir antes de propor.</span><i>Você está aqui</i></div><div class="scene-bubble answer">“Qual é a dificuldade que mais pesa na sua rotina hoje?”</div><span class="scene-label">SUGESTÃO ILUSTRATIVA · BASEADA NO SEU CONTEXTO</span>',title:'Mais espaço para ouvir. Um caminho para continuar.',description:'Seu roteiro fica por perto enquanto a conversa acontece. Com a IA ativada, receba sugestões e registre os pontos importantes para retomar depois.'},entregar:{label:'DO COMBINADO À ENTREGA',scene:'<span class="scene-label">CADA ETAPA TEM UM PRÓXIMO PASSO</span><div class="scene-step"><span>Conversa organizada</span><i>✓</i></div><div class="scene-step"><span>Pedido registrado</span><i>✓</i></div><div class="scene-step"><span>Projeto em andamento</span><i>→</i></div>',title:'O “sim” é só o começo da próxima etapa.',description:'Conecte o que foi vendido ao trabalho que precisa ser entregue. Saiba o que está em andamento e mantenha o cliente no contexto.'}};
const scenarioKeys=Object.keys(scenarios);let selectedScenario=0;
const sceneContext={atender:'<div class="context-profile"><span>AC</span><div><strong>Ana · exemplo</strong><small>Retomando uma proposta</small></div></div><h4>Você já chega com contexto.</h4><p>O histórico acompanha a conversa. O que importa sobre o cliente fica perto da sua resposta.</p><div class="context-signal">✦ Rascunho com IA. Você revisa antes de enviar.</div>',conversar:'<div class="call-visual"><span class="call-orb">✳</span><div class="call-wave" aria-hidden="true">▂ ▅ ▃ ▇ ▂ ▆ ▄ ▇ ▃ ▅ ▂ ▄</div><span>ROTEIRO EM ANDAMENTO</span></div><h4>Ouça. Entenda. Continue.</h4><p>Uma dúvida pode mudar o rumo da conversa. Seu roteiro e as sugestões ficam por perto para ajudar no próximo passo.</p><div class="context-signal">✦ A conversa continua sendo sua.</div>',entregar:'<div class="delivery-seal">✓</div><h4>O combinado ganha movimento.</h4><p>O pedido tem contexto. A entrega tem um próximo passo. Você acompanha o que acontece depois do sim.</p><div class="context-signal">↗ Projeto associado ao cliente · exemplo</div>'};
function scenario(key){const s=scenarios[key];selectedScenario=scenarioKeys.indexOf(key);document.querySelector('#scenario-position').textContent=String(selectedScenario+1).padStart(2,'0')+' / 03';document.querySelector('#scenario-label').textContent=s.label;document.querySelector('#scenario-scene').innerHTML='<div class="scene-dialog">'+s.scene+'</div><div class="scene-context">'+sceneContext[key]+'</div>';document.querySelector('#scenario-title').textContent=s.title;document.querySelector('#scenario-description').textContent=s.description;}
document.querySelector('#scenario-previous').onclick=()=>scenario(scenarioKeys[(selectedScenario+2)%3]);document.querySelector('#scenario-next').onclick=()=>scenario(scenarioKeys[(selectedScenario+1)%3]);scenario('atender');
const params=new URLSearchParams(location.search),allowed=['ref','utm_source','utm_medium','utm_campaign','utm_content','utm_term'];for(const link of document.querySelectorAll('a[href="/download"]')){const url=new URL(link.href);for(const key of allowed)if(params.has(key))url.searchParams.set(key,params.get(key).slice(0,200));if(/Android/i.test(navigator.userAgent))url.searchParams.set('platform','android');link.href=url.pathname+url.search;}
// Particle wordmark stays local: no libraries, remote assets or customer data.
(()=>{
 const canvas=document.querySelector('#brand-particles');if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 let width=0,height=0,points=[],stars=[],frame=0,paused=reduce,visible=true,time=0;
 const pointer={x:-9999,y:-9999};
 function resize(){
  const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
  const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  const mask=document.createElement('canvas');mask.width=Math.round(width);mask.height=Math.round(height);const m=mask.getContext('2d');
  let size=height*.8;m.font='900 '+size+'px Arial, sans-serif';size*=width*.96/m.measureText('CONVERTE CALL').width;m.font='900 '+size+'px Arial, sans-serif';m.textAlign='center';m.textBaseline='middle';m.fillText('CONVERTE CALL',width/2,height/2);
  const palette=[[196,92,255],[255,83,178],[255,159,74]],color=x=>{const t=x/width*2,i=Math.min(1,Math.floor(t)),f=t-i;return 'rgb('+palette[i].map((v,k)=>Math.round(v+(palette[i+1][k]-v)*f)).join(',')+')';};
  const data=m.getImageData(0,0,mask.width,mask.height).data,step=width<600?3:4;points=[];
  for(let y=0;y<mask.height;y+=step)for(let x=0;x<mask.width;x+=step)if(data[(y*mask.width+x)*4+3]>130){const px=x+(Math.random()-.5)*1.6,py=y+(Math.random()-.5)*1.6;points.push({x:px,y:py,vx:0,vy:0,homeX:px,homeY:py,r:1+Math.random()*1.1,a:.8+Math.random()*.2,phase:Math.random()*6.28,color:color(x)});}
  stars=Array.from({length:width<600?30:80},()=>({x:Math.random()*width,y:Math.random()*height,r:.3+Math.random()*.8,a:.1+Math.random()*.3}));
  draw();
 }
 function draw(){
  ctx.clearRect(0,0,width,height);
  for(const s of stars){ctx.fillStyle='rgba(201,149,244,'+s.a+')';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
  ctx.globalCompositeOperation='lighter';
  for(const p of points){let tx=p.homeX,ty=p.homeY;if(!paused){const dx=p.homeX-pointer.x,dy=p.homeY-pointer.y,d=Math.hypot(dx,dy),radius=Math.max(80,Math.min(180,width*.15));if(d<radius){const angle=d>.01?Math.atan2(dy,dx):p.phase,force=Math.pow(1-d/radius,1.15)*Math.min(110,width*.13);tx+=Math.cos(angle)*force;ty+=Math.sin(angle)*force;}ty+=Math.sin(time*.016+p.phase)*.65;}
   if(paused){p.x=p.homeX;p.y=p.homeY;p.vx=p.vy=0;}else{p.vx=(p.vx+(tx-p.x)*.055)*.78;p.vy=(p.vy+(ty-p.y)*.055)*.78;p.x+=p.vx;p.y+=p.vy;}ctx.globalAlpha=p.a;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 }
 function tick(){frame=0;if(paused||!visible||document.hidden)return;time++;draw();frame=requestAnimationFrame(tick);}
 function start(){if(!paused&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);}
 function stop(){cancelAnimationFrame(frame);frame=0;}
 canvas.parentElement.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();pointer.x=e.clientX-rect.left;pointer.y=e.clientY-rect.top;},{passive:true});canvas.parentElement.addEventListener('pointerleave',()=>{pointer.x=pointer.y=-9999;});
 function controls(){document.body.classList.toggle('motion-paused',paused);}
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{paused=e.matches;controls();if(paused){stop();draw();}else start();});
 new ResizeObserver(resize).observe(canvas);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();}).observe(canvas);
 document.addEventListener('visibilitychange',()=>document.hidden?stop():start());controls();resize();start();
})();
(()=>{
 const data=document.querySelector('#testimonial-data');if(!data)return;
 let stories;try{stories=JSON.parse(data.textContent);}catch{return;}if(!Array.isArray(stories)||!stories.length)return;
 const screen=document.querySelector('#story-screen'),avatars=document.querySelector('#story-avatars'),progress=document.querySelector('#story-progress'),pause=document.querySelector('#story-pause');
 let index=0,elapsed=0,last=0,frame=0,manualPause=reduce,holding=false,visible=false,startX=0;
 const globallyPaused=()=>document.body.classList.contains('motion-paused');
 avatars.replaceChildren();progress.replaceChildren();
 const buttons=stories.map((s,i)=>{const button=document.createElement('button');button.type='button';button.className='story-avatar-button wa-contact';button.setAttribute('aria-label','Ver conversa de '+s.name);const photo=document.createElement('span');photo.className='portrait';photo.style.backgroundPosition=s.photoPosition;photo.setAttribute('role','img');photo.setAttribute('aria-label','Retrato ilustrativo de '+s.name);const copy=document.createElement('span');copy.className='wa-contact-copy';const name=document.createElement('strong');name.textContent=s.name;const preview=document.createElement('small');preview.textContent=s.result;copy.append(name,preview);const time=document.createElement('span');time.className='wa-contact-time';time.textContent=i===0?'09:16':i<3?'Hoje':'Ontem';button.append(photo,copy,time);button.onclick=()=>show(i);avatars.append(button);const track=document.createElement('span'),fill=document.createElement('i');track.append(fill);progress.append(track);return button;});
 const fills=[...progress.querySelectorAll('i')];
 function show(i){index=(i+stories.length)%stories.length;elapsed=0;last=0;const s=stories[index];document.querySelector('#story-avatar').style.backgroundPosition=s.photoPosition;document.querySelector('#story-name').textContent=s.name+' · exemplo';document.querySelector('#story-role').textContent='Online · '+s.role.split('·')[0].trim();document.querySelector('#story-tag').textContent='CONVERSA DEMONSTRATIVA';document.querySelector('#story-headline').textContent=s.headline;document.querySelector('#story-text').textContent=s.text;document.querySelector('#story-result').textContent=s.result;document.querySelector('#story-reply').textContent=['Que bom saber disso! Obrigado por contar 💜','É para isso que estamos aqui. Vamos em frente! 💜','Adorei saber como ficou a sua rotina! 💜'][index%3];buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(j===index)));fills.forEach((f,j)=>f.style.width=j<index?'100%':'0%');screen.setAttribute('aria-label','Conversa demonstrativa de '+s.name);start();}
 function tick(now){frame=0;if(manualPause||globallyPaused()||holding||!visible||document.hidden)return;if(last)elapsed+=Math.min(100,now-last);last=now;fills[index].style.width=Math.min(100,elapsed/90)+'%';if(elapsed>=9000)show(index+1);if(!frame)frame=requestAnimationFrame(tick);}
 function start(){if(!frame&&!manualPause&&!globallyPaused()&&!holding&&visible&&!document.hidden){last=0;frame=requestAnimationFrame(tick);}}
 function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
 function controls(){pause.textContent=manualPause?'▷ Reproduzir conversas':'Ⅱ Pausar conversas';pause.setAttribute('aria-label',manualPause?'Reproduzir conversas':'Pausar conversas');pause.setAttribute('aria-pressed',String(manualPause));}
 pause.onclick=()=>{manualPause=!manualPause;controls();if(manualPause)stop();else start();};
 document.querySelector('.wa-navigation .previous').onclick=()=>show(index-1);document.querySelector('.wa-navigation .next').onclick=()=>show(index+1);
 screen.addEventListener('pointerdown',e=>{holding=true;startX=e.clientX;stop();});
 function release(e){if(!holding)return;holding=false;if(e&&Math.abs(e.clientX-startX)>45)show(index+(e.clientX<startX?1:-1));start();}
 screen.addEventListener('pointerup',release);screen.addEventListener('pointercancel',()=>release());screen.addEventListener('pointerleave',()=>{holding=false;start();});
 screen.tabIndex=0;screen.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(index+(e.key==='ArrowRight'?1:-1));}});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();},{threshold:.25}).observe(screen);document.addEventListener('visibilitychange',()=>document.hidden?stop():start());new MutationObserver(()=>globallyPaused()?stop():start()).observe(document.body,{attributes:true,attributeFilter:['class']});controls();show(0);
})();
// Interactive dot/line field follows the pointer across the sales page, never the app.
(()=>{
 const canvas=document.querySelector('#interaction-field');if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
 let width=0,height=0,spacing=27,frame=0,last=0,power=0,targetPower=0,settling=false;
 const pointer={x:-1000,y:-1000,targetX:-1000,targetY:-1000};
 const paused=()=>motion.matches||document.body.classList.contains('motion-paused');
 function draw(){
  ctx.clearRect(0,0,width,height);const active=paused()?0:power,radius=190,shift=paused()?0:(scrollY*.035)%spacing;
  if(active>.005){const glow=ctx.createRadialGradient(pointer.x,pointer.y,0,pointer.x,pointer.y,radius);glow.addColorStop(0,'rgba(222,49,157,'+(.1*active)+')');glow.addColorStop(.55,'rgba(139,57,232,'+(.065*active)+')');glow.addColorStop(1,'rgba(139,57,232,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);}
  ctx.lineCap='round';
  for(let y=-spacing;y<height+spacing;y+=spacing)for(let x=spacing/2;x<width;x+=spacing){
   const by=y-shift,dx=x-pointer.x,dy=by-pointer.y,d=Math.hypot(dx,dy),influence=active*Math.pow(Math.max(0,1-d/radius),1.4),angle=Math.atan2(dy,dx)+Math.PI/2+influence*1.7;
   const px=x+(Math.cos(angle)*11+dx/Math.max(1,d)*7)*influence,py=by+(Math.sin(angle)*11+dy/Math.max(1,d)*7)*influence;
   const length=.65+influence*9;ctx.strokeStyle='rgba('+Math.round(139+90*influence)+','+Math.round(100-42*influence)+','+Math.round(220-39*influence)+','+(.19+influence*.65)+')';ctx.lineWidth=1.35+influence*1.1;
   ctx.beginPath();ctx.moveTo(px-Math.cos(angle)*length/2,py-Math.sin(angle)*length/2);ctx.lineTo(px+Math.cos(angle)*length/2,py+Math.sin(angle)*length/2);ctx.stroke();
  }
 }
 function tick(now){frame=0;if(document.hidden||paused()){draw();return;}const dt=last?Math.min(48,now-last):16;last=now;const ease=1-Math.exp(-dt/85);pointer.x+=(pointer.targetX-pointer.x)*ease;pointer.y+=(pointer.targetY-pointer.y)*ease;power+=(targetPower-power)*ease;draw();settling=Math.abs(power-targetPower)>.002||Math.abs(pointer.x-pointer.targetX)+Math.abs(pointer.y-pointer.targetY)>.15;if(settling)frame=requestAnimationFrame(tick);else last=0;}
 function request(){if(!frame&&!document.hidden&&!paused())frame=requestAnimationFrame(tick);}
 function reset(){cancelAnimationFrame(frame);frame=0;last=0;power=targetPower=0;draw();}
 function resize(){width=innerWidth;height=innerHeight;spacing=width<760?29:27;const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();}
 addEventListener('pointermove',e=>{if(!fine.matches||e.pointerType==='touch'||paused())return;if(!power){pointer.x=e.clientX;pointer.y=e.clientY;}pointer.targetX=e.clientX;pointer.targetY=e.clientY;targetPower=1;request();},{passive:true});
 document.documentElement.addEventListener('pointerleave',()=>{targetPower=0;request();},{passive:true});addEventListener('blur',()=>{targetPower=0;request();});
 addEventListener('scroll',()=>{if(!paused())request();},{passive:true});addEventListener('resize',resize,{passive:true});
 document.addEventListener('visibilitychange',()=>document.hidden?reset():draw());motion.addEventListener('change',reset);fine.addEventListener('change',reset);
 new MutationObserver(()=>{if(paused())reset();else draw();}).observe(document.body,{attributes:true,attributeFilter:['class']});resize();
})();
(()=>{
 const button=document.querySelector('#simulate-sale');if(!button)return;
 const demo=document.querySelector('.sales-console'),receipt=document.querySelector('#sale-receipt');
 const examples=[{name:'Ana',product:'Mentoria individual',value:1490,next:'Preparar a primeira sessão.'},{name:'Rafael',product:'Projeto de identidade visual',value:2490,next:'Organizar o briefing do projeto.'},{name:'Camila',product:'Consultoria de marketing',value:790,next:'Agendar a conversa de diagnóstico.'},{name:'Lucas',product:'Treinamento online',value:297,next:'Enviar as orientações de acesso.'}];
 const money=value=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});let index=0,total=0,count=0,timer=0,visible=false;
 const paused=()=>document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('motion-paused');
 function sale(){const example=examples[index%examples.length];index++;total+=example.value;count++;document.querySelector('#demo-total').textContent=money(total);document.querySelector('#demo-count').textContent=count+' '+(count===1?'venda registrada':'vendas registradas')+' nesta simulação';document.querySelector('#demo-client').textContent=example.name+' · exemplo';document.querySelector('#demo-avatar').textContent=example.name[0];document.querySelector('#demo-product').textContent=example.product;document.querySelector('#demo-value').textContent=money(example.value);document.querySelector('#demo-next').textContent=example.next;receipt.classList.remove('receipt-enter');requestAnimationFrame(()=>receipt.classList.add('receipt-enter'));}
 function schedule(){clearTimeout(timer);if(visible&&!paused())timer=setTimeout(()=>{sale();schedule();},5200);}
 button.onclick=()=>{sale();schedule();};new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.2}).observe(demo);document.addEventListener('visibilitychange',schedule);matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',schedule);new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});sale();
})();
// Local starflight is decorative, viewport-bounded and suspended away from the footer.
(()=>{
 const canvas=document.querySelector('#footer-space');if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
 const footer=canvas.parentElement,motion=matchMedia('(prefers-reduced-motion: reduce)');let w=0,h=0,frame=0,last=0,visible=false;
 const pointer={x:0,y:0},stars=Array.from({length:500},()=>({x:(Math.random()-.5)*2,y:(Math.random()-.5)*2,z:.1+Math.random()*.9,shade:Math.random()}));
 function draw(dt=0){ctx.clearRect(0,0,w,h);const cx=w*.5+pointer.x,cy=h*.42+pointer.y,scaleX=w*.45,scaleY=h*.45;ctx.lineCap='round';for(const star of stars){star.z-=dt*.000075;if(star.z<.08){star.z=1;star.x=(Math.random()-.5)*2;star.y=(Math.random()-.5)*2;}const x=cx+star.x/star.z*scaleX,y=cy+star.y/star.z*scaleY,tail=motion.matches?1:Math.min(18,(1-star.z)*12+2),dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy)||1;ctx.strokeStyle=star.shade>.65?'rgba(249,147,192,'+(.15+(1-star.z)*.5)+')':'rgba(210,192,245,'+(.18+(1-star.z)*.5)+')';ctx.lineWidth=.4+(1-star.z)*.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-dx/d*tail,y-dy/d*tail);ctx.stroke();}}
 function tick(now){frame=0;if(!visible||motion.matches||document.hidden)return;const dt=last?Math.min(40,now-last):16;last=now;draw(dt);frame=requestAnimationFrame(tick);}
 function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
 function start(){if(visible&&!motion.matches&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);else if(motion.matches)draw();}
 function resize(){w=footer.clientWidth;h=footer.clientHeight;const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();}
 new ResizeObserver(resize).observe(footer);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();}).observe(footer);footer.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||motion.matches)return;const r=footer.getBoundingClientRect();pointer.x=(e.clientX-r.left-w/2)*.065;pointer.y=(e.clientY-r.top-h/2)*.065;},{passive:true});footer.addEventListener('pointerleave',()=>{pointer.x=pointer.y=0;});document.addEventListener('visibilitychange',()=>document.hidden?stop():start());motion.addEventListener('change',()=>{stop();draw();start();});resize();
})();
