'use strict';
(()=>{
 const prior=CCCore.migrate;
 CCCore.migrate=d=>{prior(d);if(!Array.isArray(d.projectFolders))d.projectFolders=[];if(!Array.isArray(d.projects))d.projects=[{id:'project-default',name:'Meu projeto',description:'',status:'active',columns:d.projectColumns,createdAt:CCCore.now()}];d.activeProjectId||=d.projects[0]?.id||'';const project=d.projects.find(x=>x.id===d.activeProjectId);if(project)d.projectColumns=project.columns;for(const t of d.tasks){t.projectId||=d.projects[0]?.id;t.status||='open';}for(const r of d.projectRules)r.projectId||=d.projects[0]?.id;if(!Array.isArray(d.workflows))d.workflows=[{id:'call-default',name:'Diagnóstico consultivo',nodes:d.workflow,start:d.workflowStart,updatedAt:CCCore.now()}];d.activeWorkflowId||=d.workflows[0]?.id||'';d.version=4;return d;};
 CCCore.prepare=d=>{const project=d.projects?.find(x=>x.id===d.activeProjectId);if(project)project.columns=d.projectColumns;const workflow=d.workflows?.find(x=>x.id===d.activeWorkflowId);if(workflow){workflow.nodes=d.workflow;workflow.start=d.workflowStart;}return d;};
})();
