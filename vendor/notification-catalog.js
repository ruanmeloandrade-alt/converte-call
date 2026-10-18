'use strict';
globalThis.CCNotificationCatalog=[
 ['message','Relacionamento','Mensagens recebidas','Nova mensagem de cliente no WhatsApp conectado.'],
 ['lead','Relacionamento','Novos clientes','Novo cliente criado manualmente, importado ou recebido pela integração.'],
 ['stage','Relacionamento','Troca de etapa ou funil','Cliente movido entre etapas ou funis.'],
 ['sale','Relacionamento','Vendas registradas','Nova venda ou pedido registrado.'],
 ['lost','Relacionamento','Oportunidades perdidas','Cliente marcado como perdido.'],
 ['task','Projetos','Novos cartões e tarefas','Cartão ou tarefa criado em um projeto.'],
 ['task_move','Projetos','Movimentação de cartões','Cartão movido para outra coluna.'],
 ['task_status','Projetos','Andamento e conclusão','Tarefa em andamento ou concluída.'],
 ['task_due','Projetos','Prazos de tarefas','Lembrete antes do prazo e aviso de atraso.'],
 ['meeting','Calls e agenda','Reuniões e compromissos','Lembrete 15 minutos antes do compromisso.'],
 ['recording','Calls e agenda','Gravações salvas','Gravação encerrada e salva localmente.'],
 ['call','Calls e agenda','Avisos do workflow da call','Notificações configuradas nos blocos da reunião.'],
 ['automation','Sistema','Execuções de automações','Resultado das regras de projeto e atendimentos conectados.'],
 ['automation_error','Sistema','Falhas de automação','Regra sem cliente, destino inválido ou falha reportada pelo servidor.'],
 ['connection','Sistema','Estado das conexões','WhatsApp, Google ou Gmail conectado ou desconectado.'],
 ['campaign','Sistema','Envios de campanhas','Campanha concluída ou parcialmente enviada.'],
 ['stock','Sistema','Estoque esgotado','Produto com estoque que chegou a zero.']
].map(([id,group,title,description])=>({id,group,title,description}));
