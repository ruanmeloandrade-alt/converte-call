# Integração técnica — Converte Call 0.5.3

A interface do cliente apresenta WhatsApp Web, Provedor de IA, Google Agenda,
Gmail e SMS pendente. Infraestrutura, banco, Evolution e hospedagem são internos.
Esta entrega não provisiona o servidor e não contém suas credenciais.

## Configuração de implantação

`internal-config.js`: `CCDeployment.gatewayUrl` é a base HTTPS do BFF próprio.
Não apontar diretamente para Evolution nem adicionar sua chave administrativa.
A permissão de acesso somente a essa origem é solicitada quando o usuário conecta
a conta. A sessão do BFF fica em `chrome.storage.session`, apenas em contextos
confiáveis da extensão. Credenciais não são incluídas no workspace nem no backup.

Para Google, registrar um OAuth client do tipo Chrome Extension para o ID real
da extensão. Adicionar ao manifest:

```json
"oauth2": {
  "client_id": "CLIENT_ID_REAL.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.send"
  ]
}
```

Não distribuir um placeholder como client_id. A interface informa que o OAuth
está pendente enquanto essa configuração não existe. `getAuthToken` solicita
somente os escopos da conexão escolhida. O cadastro Google e a eventual aprovação
da tela de consentimento são tarefas externas ainda pendentes.

## Contrato do BFF a implementar

Todas as rotas abaixo são um contrato desta extensão; não são rotas nativas da
Evolution. O BFF deve traduzi-las, validar a conta e aplicar autorização por usuário.
Erro deve retornar HTTP apropriado. Toda resposta é JSON. Endpoints autenticados
recebem `Authorization: Bearer <sessão individual>`. Nunca aceitar IDs de outro
workspace. Garantir uma sessão ativa e apenas um número por usuário no servidor.

| Método / rota relativa à base | Entrada | Saída esperada |
|---|---|---|
| POST v1/auth/session | email, password | accessToken |
| POST v1/whatsapp/session | slots: 1 | status, qrDataUrl (PNG base64) ou phone |
| GET v1/whatsapp/session | sessão individual | status, phone |
| POST v1/whatsapp/dispatch | leadId, phone, kind: bot/agent, assetId, definition, customFields | confirmação de aceitação |
| PUT v1/workspace/definitions | schemaVersion: 4, funnels, bots, agents, rules, brain, knowledge, customFields, workflows | confirmação |
| GET v1/workspace/events?cursor=... | cursor da última leitura | events, cursor |

Despachos incluem `Idempotency-Key`. O servidor deve deduplicar e rejeitar bots ou
agentes inativos e definições inválidas. Deve confirmar o número e o destinatário
antes de enviar. Não confiar na extensão como controle de acesso ou de plano.

Sincronização pode ser solicitada pelo botão Sincronizar CRM e ocorre a cada
minuto enquanto a conexão está ativa e o Chrome está aberto. O próximo passo
no servidor é emitir os eventos e implementar as rotas autenticadas do contrato.
Não há conexão direta da extensão ao banco da Saúde Slim.

Eventos têm `id` estável, `type`, `at`, `leadId`. Tipos aceitos:
- `lead`: name, phone, source, utm (source, medium, campaign, content, term).
- `field`: fieldId, value. A ficha mostra origem Bot / IA e horário.
- `message`: direction in/out (métrica; corpo não é importado por este contrato).
- `call`: direction in/out (registro de ligação, sem confundir com vídeo gravado).
- `sale`: amount e title. Duplicações são evitadas por id de evento.

Guardar eventos antes de avançar o cursor; no servidor, ordenar/deduplicar e
implementar paginação consistente. IDs usam letras, números, `_` ou `-`.

## Módulos originais e fronteira do servidor (0.5)

`slim/runtime.js` usa componentes originais e `slim/rpc-contract.json` contém
os módulos/funções permitidos. Em modo local, `repository.ts` implementa CRUD
no workspace Chrome. Com `CCDeployment.gatewayUrl`, as chamadas originais usam:

POST `v1/slim/rpc` com `{module, method, data}` → JSON com o retorno original da função.
O worker encapsula esse JSON no seu campo interno `result`; o HTTP não deve acrescentar outro wrapper.
O BFF deve mapear explicitamente módulo/método para as funções do Slim; não usar
eval/import dinâmico de caminho recebido. Autenticação, isolamento de workspace,
validação de entrada, autorização e idempotência devem existir no servidor.
O allowlist do cliente não substitui esses controles.

Os editores agora salvam o grafo e os campos nativos do SalesbotBuilder e dos
agentes originais. Não traduzir para os antigos blocos simplificados. As regras
nativas por funil ficam em `slimStageAutomations`; as regras de projetos continuam
separadas em `projectRules`. A sincronização de definições envia schemaVersion 4
com `slimStageAutomations` e `crmAgents`, sem regras de projetos nesse contrato.
O BFF deve oferecer importação validada do estado local antes de mudar o modo:
configurar uma URL não migra os dados locais automaticamente ao banco remoto.

Na fonte técnica entregue, `backend-reference` contém cópias originais das
fronteiras e dos motores selecionados com hashes. São referência para portar o
servidor, não um servidor autônomo nem algo executado pela extensão. Os módulos
server-only, suas dependências, banco e migrações devem ser integrados no BFF.
Não conectar esta extensão ao banco de produção do Saúde Slim.

Um evento `message` pode incluir `contact:{phone,name}`. A extensão localiza o
cliente por ID/telefone e cria o cadastro se necessário; eventos `field`
atualizam os campos da mesma ficha. O servidor deve garantir IDs estáveis e
ordem dos eventos, enviando o contato antes de suas atualizações de campos.
O QR Code continua dependente da sessão real do servidor.

Workflow da call é um grafo próprio: nós, condições, falas, ações e ramificações.
Cada gravação mantém snapshot, eventos e marcações; não é o fluxo de automações
do funil. Os agentes originais mantêm seus próprios formatos de objetivos.

## APIs diretas implementadas

- OpenAI: GET /v1/models, POST /v1/responses (`store:false`) e POST
  /v1/audio/transcriptions multipart. Chave lida apenas da sessão confiável.
  Não há fallback para chave compartilhada. Não foi validado consumo real.
- Calendar: listar eventos, criar com conferenceDataVersion=1 e pedido de Meet.
- Gmail: users/me/messages/send com MIME UTF-8 codificado em base64url.
  Revisão e confirmação explícitas, envios individuais, até 50 destinatários por
  campanha nesta versão. O Gmail pode limitar mais. Envios parcialmente concluídos
  são registrados; destinatários registrados não são reenviados automaticamente.

## Persistência e vídeo

Workspace local: `chrome.storage.local.converteCallWorkspace`, versão 4.
Mídia: IndexedDB `converte-call-media`, preservado ao atualizar a mesma extensão.
O download WebM é independente da cópia no perfil do navegador.

Ainda implementar no servidor: autenticação/plano, isolamento por conta,
enforcement de acesso único, execução de bots/agentes e regras externas,
webhooks Evolution, tracking com atribuição, upload segmentado, transcrição de
arquivos grandes, storage com expiração de 24 horas, auditoria e recuperação.

## Documentação oficial consultada

- https://developer.chrome.com/docs/extensions/reference/api/identity
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- https://developers.google.com/workspace/gmail/api/guides/sending

## Inbox nativo 0.5.1

O BFF passa a implementar também:

| Método/rota | Entrada | Retorno |
|---|---|---|
| PATCH v1/whatsapp/lead | leadId, patch com tags ou funnelId/stageId/stage | confirmação; erro HTTP impede atualização local |
| POST v1/whatsapp/stop | leadId, phone, kind bot/agent, runId, assetId; Idempotency-Key | status stopped/idle para confirmação, ou aceitação assíncrona |

O stop deve cancelar a execução, mensagens agendadas e futuros passos daquele
atendimento. Uma solicitação aceita ainda não equivale à parada confirmada.
Para o estado atualizado, retornar em GET v1/workspace/events um evento
`automation` com id, at, leadId, kind, assetId, runId e status:
active/running/starting/queued/stopping/stopped/idle/failed. Os estados de bot
e agente são separados; o servidor decide sua política de concorrência.
A resposta de dispatch pode conter status e runId. Sem status conclusivo,
a extensão registra starting e aguarda eventos. Aplicar autorização por conta.

Os rascunhos de Resposta inteligente ficam no workspace local em smartReplies
(máximo 100). A geração usa o transporte OpenAI já existente, com chave da
sessão, sem acessar a rota de envio WhatsApp. O cérebro selecionado vem dos
agentes originais; também entram contexto geral, conhecimento e regras dos
gestores habilitados aplicáveis ao funil. O contexto de conversa é limitado às
últimas 24 mensagens de texto renderizadas; não busca o histórico completo nem
transcreve áudios. A cópia exige clique e nunca dispara envio.

## Identidade do cérebro 0.5.2

A aba Cérebro e a aba Agentes IA agora compartilham o componente original
ConversationAgentsPanel/AgentEditor e a coleção de agentes de conversa.
Prompt, persona, fontes, ações e regras permanecem no contrato original
conversation-agents.functions. A árvore continua em metadata.objective_tree.
O nó raiz interno é preservado para compatibilidade de dados e motor, porém
não é desenhado como segundo contexto: o único contexto fixo o representa.
Gestores CRM continuam preservados como dados antigos, mas não são a tela
do cérebro de atendimento. A Resposta inteligente inclui a árvore do agente.

# Adições da versão 0.6.0

## Projetos no executor 24h

PUT `v1/projects/definitions` recebe `{schemaVersion:1, timezone, projects, tasks, rules}`
e retorna `{accepted:true, revision}` somente após persistir as definições.
O servidor deve autenticar a conta e validar todos os IDs e vínculos.
`tasks[].dueAt` é o prazo ISO com offset resolvido; `due` permanece como valor do
editor local. Duração da regra é `minutes` canônico; durationValue/durationUnit
são informações do editor (minutes/hours/days). O cliente do cartão tem prioridade
sobre o cliente do projeto. `lead-stage` usa targetFunnel e targetStage.
Regras sem cliente ou destino válido precisam gerar auditoria de falha/ignorada.

O servidor deve persistir agendamentos, usar relógio e fila duráveis, retomar após
reinício e deduplicar pela entrada do cartão e revisão da regra. Uma resposta de
aceitação das definições não prova a execução do executor. Nada disso foi
implantado nesta entrega. Com gateway configurado, a prévia não roda as mesmas
regras de projeto localmente. A extensão sincroniza mudanças e tenta novamente
quando inicia. Falhas de sincronização geram aviso configurável.

## Notificações

`notificationPreferences.categories` usa os IDs de notification-catalog.js.
Preferência false suprime o aviso dessa categoria. O histórico é limitado às
1000 notificações mais recentes; lotes grandes são resumidos.
Chaves por evento impedem duplicação local, inclusive em lembretes.
O backend deve manter preferências, IDs de evento e fila de avisos por usuário;
reprocessamento/reconexão não pode disparar o mesmo evento novamente.
Não depender de chrome.alarms para o motor 24h. Quando Chrome não estiver ativo,
o servidor continua executando e guarda os avisos para a entrega suportada.

## Cérebro — atualização 0.7.0

A referência correta foi localizada no módulo público registrado em slim/brain-provenance.json.
O corpo React publicado foi copiado. A autenticação remota foi substituída pelo
workspace real da extensão, sem sessão fictícia. No armazenamento local,
brainSources e brainBlockedTerms preservam os campos do original; arquivos reais
ficam no IndexedDB converte-call-assets. Upload máximo: 20 MB.

Com gateway configurado: POST v1/brain/query recebe {table,action,filters,payload,sort,ascending}
e retorna {data}; tabelas permitidas ai_brain_sources e ai_brain_blocked_terms.
POST v1/brain/assets recebe {operation,path,name,mime,base64} para upload ou exclusão,
retorna {data}. O backend deve validar conta/workspace, permissões de linha,
tipo/tamanho, chave de arquivo e aplicar isolamento. created_by deve vir da sessão
no servidor, nunca de um ID de usuário enviado pelo cliente.
Indexação documental, embeddings, recuperação RAG e bloqueio no despacho são
responsabilidade do backend; os contratos de armazenamento não implementam isso.
Fontes de texto/link ativas entram no contexto das sugestões locais, sem crawler
nem indexação vetorial. O envio de mensagens continua separado da geração.

## Campos extraídos na call

call-analysis-commit serializa alterações de análise pelo worker. call-fields-sync
valida evidência literal, confiança >= 0,9 e captureEnabled/captureFields do snapshot
do bloco. Preserva previous/evidence/nodeId/at no histórico de alterações.
call-fields-accept cria/preenche somente após clique de confirmação; verifica
cliente, tipo, duplicação e conflito com valor existente. O backend futuro deverá
persistir sugestões, confirmações e auditoria com a mesma validação por conta.
A análise final sugere campos novos, mas não aplica preenchimentos automáticos
retroativos de blocos sem saber em que momento cada dado foi dito.

# Atualização 0.8.0 — Pixel Call e servidor em preparação

GET/POST v1/tracking/pixels consulta/cria sites autenticados. Cadastro recebe name e url; retorno inclui pixel e snippet. GET retorna pixels com stats (visits, sessions, clicks, visibleMs) e páginas. Script público GET /p/:key.js; eventos POST /p/:key/events, origem deve corresponder ao site cadastrado. Sessões anônimas; não fazem associação automática a lead.

A implementação local e os testes estão em converte-call-server. Repositório/projeto de deploy e instalação Evolution aguardam confirmação. Não ligar gatewayUrl antes de concluir executor e sincronização remota. Nenhum GitHub Actions foi criado.
