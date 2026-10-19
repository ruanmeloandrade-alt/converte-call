'use strict';
window.CCWorkspace={
 key:'converteCallWorkspace',
 async refresh(){const result=await chrome.runtime.sendMessage({channel:'cc',type:'workspace-read'});if(!result?.ok)throw Error(result?.error||'Não foi possível atualizar seus dados.');return CCCore.migrate(result.workspace);},
 async get(){const all=await chrome.storage.local.get(['converteCallWorkspace','converteCallPreview']);if(all.converteCallWorkspace){const d=CCCore.migrate(all.converteCallWorkspace);return d;}
  const old=all.converteCallPreview;const workflow=old?.workflow||[
   {id:'s1',name:'Abertura e acordo',time:'3',goal:'Alinhar o objetivo da reunião.',questions:'O que você espera resolver nesta conversa?',material:'',criteria:'Objetivo confirmado.'},
   {id:'s2',name:'Contexto e perguntas',time:'7',goal:'Entender a situação e a necessidade do cliente.',questions:'Como você lida com isso hoje?\nO que motivou a procura por uma solução?',material:'',criteria:'Necessidade identificada.'},
   {id:'s3',name:'Impacto e prioridade',time:'8',goal:'Investigar o impacto e a prioridade.',questions:'Como esse problema afeta seu resultado?\nQual a prioridade de resolver isso?',material:'',criteria:'Impacto e prioridade descritos.'},
   {id:'s4',name:'Mostrar a solução',time:'8',goal:'Conectar a oferta ao contexto relatado.',questions:'Como isso se encaixa no que você precisa?',material:'Apresentação da oferta',criteria:'Entendimento confirmado.'},
   {id:'s5',name:'Pitch e objeções',time:'9',goal:'Esclarecer condições e dúvidas antes da decisão.',questions:'O que falta esclarecer para você decidir?',material:'Condições aprovadas',criteria:'Dúvidas esclarecidas.'},
   {id:'s6',name:'Fechamento',time:'5',goal:'Registrar a decisão e combinar o próximo passo.',questions:'Faz sentido começarmos?\nQual próximo passo podemos combinar?',material:'',criteria:'Decisão ou retorno confirmado.'}
  ];
  const d={version:2,leads:old?.leads||[],workflow,notes:old?.notes||[],rules:old?.rules||[],calls:[],messages:{},campaigns:old?.campaigns||[],events:old?.events||[],groups:old?.groups||[],brain:old?.brain||{offer:'',tone:'Direto, acolhedor e objetivo',context:'',instructions:'Usar informações cadastradas e seguir o workflow da call. Não inventar condições ou garantias.'},tracking:old?.tracking||[],providers:old?.providers||{ai:'OpenAI'},customFields:[{id:'interest',label:'Interesse / produto',type:'text'},{id:'budget',label:'Orçamento informado',type:'text'},{id:'decision',label:'Prazo de decisão',type:'date'}],bindings:{},sales:[],integration:{},localActivity:[]};
  CCCore.migrate(d);await chrome.storage.local.set({converteCallWorkspace:d});return d;
 },
 async set(d){CCCore.prepare(d);await chrome.storage.local.set({converteCallWorkspace:d});chrome.runtime.sendMessage({channel:'cc',type:'workspace-changed'}).catch(()=>{});}
};
