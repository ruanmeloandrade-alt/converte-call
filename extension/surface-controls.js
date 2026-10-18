'use strict';
let hudCompact=false;const fullHUD=hud,standardHeader=headerHTML;
headerHTML=()=>standardHeader().replace('<div>',`<div>${view==='hud'?'<button data-action="hud-compact" title="Recolher ou expandir sugestões" aria-label="Modo compacto">◉</button><button data-action="hud-detach" title="Levar para outra tela" aria-label="Desencaixar gravação">↗</button>':''}`);
hud=function(){if(!hudCompact)return fullHUD();const n=hudNodes().find(n=>n.id===(state.meta?.workflowNode||hudNode)),advice=state.meta?.liveAdvice;return `<main class="compact-hud"><div class="row"><span class="recording-orb ${state.paused?'paused':''}" aria-label="${state.paused?'Gravação pausada':'Gravando'}">●</span><span class="timer">${formatTime(state.elapsed||0)}</span></div><p class="compact-suggestion">${esc(advice?.suggestion||n?.questions?.split('\n')[0]||(state.meta?.liveAI?'Ouvindo. A próxima sugestão aparece aqui…':'Seu roteiro e suas sugestões aparecem aqui.'))}</p>${state.meta?.liveError?`<p class="error">${esc(state.meta.liveError)}</p>`:''}</main>`;};
root.addEventListener('click',async e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='hud-compact'){hudCompact=!hudCompact;render();post('compact-hud',{compact:hudCompact});}if(action==='hud-detach'){const r=await send('open-floating',{kind:'hud'});if(!r.ok)toast(r.error);}});

// Apply the header controls even when the first state arrived before this deferred script.
if(view==='hud')render();
