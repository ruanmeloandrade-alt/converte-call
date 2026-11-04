'use strict';
(()=>{
 const prior=CCCore.migrate;
 CCCore.migrate=d=>{prior(d);if(!Array.isArray(d.projectFolders))d.projectFolders=[];if(!Array.isArray(d.projects))d.projects=[{id:'project-default',name:'Meu projeto',description:'',status:'active',columns:d.projectColumns,createdAt:CCCore.now()}];d.activeProjectId||=d.projects[0]?.id||'';const project=d.projects.find(x=>x.id===d.activeProjectId);if(project)d.projectColumns=project.columns;for(const t of d.tasks){t.projectId||=d.projects[0]?.id;t.status||='open';}for(const r of d.projectRules)r.projectId||=d.projects[0]?.id;if(!Array.isArray(d.workflows))d.workflows=[{id:'call-default',name:'Diagnóstico consultivo',nodes:d.workflow,start:d.workflowStart,updatedAt:CCCore.now()}];d.activeWorkflowId||=d.workflows[0]?.id||'';d.version=4;return d;};
 CCCore.prepare=d=>{const project=d.projects?.find(x=>x.id===d.activeProjectId);if(project)project.columns=d.projectColumns;const workflow=d.workflows?.find(x=>x.id===d.activeWorkflowId);if(workflow){workflow.nodes=d.workflow;workflow.start=d.workflowStart;}return d;};
 CCCore.importWorkflow=(source,makeId=CCCore.id)=>{
  const w=JSON.parse(source,(key,value)=>{
   if(['__proto__','prototype','constructor'].includes(key))throw Error('Campo inválido no arquivo.');
   return value;
  });
  if(!w||typeof w.name!=='string'||!w.name.trim()||!Array.isArray(w.nodes)||!w.nodes.length||w.nodes.length>250)
   throw Error('Selecione um JSON de workflow individual com até 250 etapas.');
  if(w.purpose!==undefined&&!['call','lesson','video'].includes(w.purpose))throw Error('Finalidade inválida.');
  const ids=new Map();
  for(const node of w.nodes){
   if(!node||typeof node.id!=='string'||!node.id||ids.has(node.id)||typeof node.name!=='string'||!node.name.trim()||
      (node.edges!==undefined&&!Array.isArray(node.edges)))throw Error('Etapa inválida ou duplicada.');
   ids.set(node.id,makeId());
  }
  if(!ids.has(w.start))throw Error('Bloco inicial inválido.');
  const nodes=w.nodes.map((node,index)=>{
   const next={...node,id:ids.get(node.id),x:Number.isFinite(node.x)?node.x:60+(index%3)*300,y:Number.isFinite(node.y)?node.y:55+Math.floor(index/3)*220};
   next.edges=(node.edges||[]).map(edge=>{
    if(!edge||!ids.has(edge.to)||typeof edge.label!=='string')throw Error('Ligação inválida.');
    return {...edge,id:makeId(),to:ids.get(edge.to)};
   });
   if(node.returnTo){
    if(!ids.has(node.returnTo))throw Error('Retorno inválido.');
    next.returnTo=ids.get(node.returnTo);
   }
   return next;
  });
  const start=ids.get(w.start);
  CCCore.validateGraph(nodes,start);
  return {id:makeId(),name:w.name.trim(),purpose:w.purpose||'call',nodes,start,updatedAt:CCCore.now()};
 };
})();
