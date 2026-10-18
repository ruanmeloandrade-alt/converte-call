# Arquitetura e fronteiras

A extensão permanece a interface do usuário. O BFF autentica usuários e isola workspaces. Evolution e suas chaves são apenas infraestrutura interna.

## Banco e migração

SQLite/WAL em volume persistente, uma réplica de servidor. Tabelas: migrations, workspaces, users, sessions, secrets, events, instances, inbound, runs, jobs, outbox, assets, asset_aliases, idempotency, rag_chunks, pixels, pixel_events. Todas as consultas de domínio incluem workspace ou um recurso resolvido a partir da sessão. Tokens são armazenados por hash; segredos de IA e instâncias são cifrados em AES-256-GCM com chave do ambiente. A senha usa scrypt. Reiniciar não apaga dados.

O desenho inicial não suporta várias réplicas compartilhando este volume. A migração para PostgreSQL, escalabilidade e backup externo devem ser definidos antes da liberação comercial. Não compartilhar banco da Saúde Slim.

## Reaproveitamento

vendor/core.js e core-v4.js preservam o motor de projetos da extensão. vendor/repository.original.ts e provenance.json registram a origem do adaptador de CRUD. src/rpc.mjs porta a persistência para o banco e mantém os formatos dos componentes; não é apresentado como cópia do executor completo de Salesbot. Métodos não integrados falham, sem retornar dados ou execução fictícia.

## API implementada

O servidor 0.10 mantém /admin e substitui convites pelo cadastro /register com 7 dias grátis, e-mail/telefones únicos e sem documentos. A migração aditiva 2 cria account_roles, subscriptions, license_invites e license_audit. A conta inicial existente recebe papel administrativo; clientes recebem o teste automaticamente ao criar a conta e têm operações bloqueadas no servidor após vencer. Detalhes, contratos e limites em [LICENCAS.md](LICENCAS.md).

- `/health/ready`: saúde e configuração, sem valores secretos.
- `POST /v1/auth/bootstrap`: conta inicial com token de instalação de uso único.
- `POST /v1/auth/session`, `POST /v1/auth/logout`: sessão única, expiração de 12 horas.
- `GET /v1/workspace`, `POST /v1/workspace/import`: leitura isolada e importação inicial sem sobrescrever conta com dados.
- `PUT /v1/workspace/definitions`, `GET /v1/workspace/events`: definições e eventos com cursor estável.
- `PUT /v1/projects/definitions`: definição de tarefas e regras de projeto.
- `POST /v1/slim/rpc`: allowlist exato do contrato; CRUD persistido do workspace autenticado.
- `POST/GET /v1/whatsapp/session`: instância reservada, QR/status pelo adaptador Evolution. Falha explícita se faltam credenciais.
- `PATCH /v1/whatsapp/lead`, `POST /v1/whatsapp/stop`: alterações autorizadas e cancelamento de jobs futuros.
- `POST /v1/whatsapp/dispatch`: bloqueado com 503 até concluir o executor.
- `POST /v1/hooks/evolution/:token`: valida token da instância e nome de instância, persiste antes de responder. Não importar grupos ou LIDs como telefone.
- `POST /v1/brain/query`, `/v1/brain/assets`, `/v1/brain/search`: fontes, termos, arquivos reais e recuperação lexical. Sem crawler, vetores ou leitura de PDFs/DOCX.
- `PUT /v1/ai/credentials`: guarda chave individual cifrada para o executor futuro; não devolve a chave.
- `GET/POST /v1/tracking/pixels`, `GET /p/:key.js`, `POST /p/:key/events`: Pixel Call.

## Pontos a concluir antes do deploy de uso real

Executor completo de bots/agentes e gatilhos do funil, sincronização remota integral com a extensão sem sobrescrever dados concorrentes, idempotência dos despachos, mídia segmentada/retenção/transcrição, backup/restauração, OAuth e testes reais Evolution. Banco/fila estruturalmente presentes não significam execução desses fluxos.

## Conta e aprendizado — 0.10
Migração 3: perfil cifrado e índice HMAC dos dois telefones (account_profiles/account_phones). Migração 4: academy_lessons, academy_progress e support_questions. POST /v1/auth/register cria cliente e trial em uma transação. GET /v1/account/profile retorna perfil autorizado. /v1/admin/academy exige administrador; /v1/academy mostra apenas publicações. FAQ /v1/support/ask distingue guia de resposta via provedor. O token portal fica somente em chrome.storage.session e não ativa gatewayUrl. Detalhes em SUPORTE-FACULDADE.md.
