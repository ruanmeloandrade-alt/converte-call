# Converte Call — trabalho em andamento

## Objetivo autorizado
Servidor Railway, integração Evolution, persistência, automações 24h e documentação no GitHub. Não usar GitHub Actions. Preservar UI e dados aprovados.

## Novo ajuste de Inbox
- Remover a logo ao lado de WhatsApp.
- Tags do lead na mesma barra, imediatamente ao lado de WhatsApp.
- Perfil e Funil/etapa imediatamente ao lado do nome do contato.
- Bot, agente e resposta inteligente preservados acima do compositor.

## Acessos verificados
Railway e GitHub conectores acessíveis. GitHub CLI sem login. Não existe repositório Converte Call entre os disponíveis. Confirmação do destino e endereço Evolution solicitada; preparação local pode continuar.

## Preservação
Saúde Slim: apenas referências de leitura. Nenhum serviço/banco/variável existente foi alterado. Desenvolvimento local em feat/railway-server.

## Funil
Remover seleção duplicada no cabeçalho de cada etapa; ambas chamam onBatchToggleLeads sobre os mesmos leads. Manter uma só seleção e a ação de edição em massa original. Alteração no adaptador de build; fonte canônica preservada.

## Pixel Call
Gerar código head por site; dados de visitas, cliques, UTMs e tempo visível. Implementação prepara script sem fingerprint, ingestão com origem autorizada, deduplicação e estatísticas por página. Ainda ligar a interface Tracking e testar a implantação real.

## Resultado desta etapa
Ajustes visuais 0.8.0 empacotados, instalados na pasta antiga do Desktop e verificados: Inbox, checkbox única no funil, cérebro suave e nome Pixel Call.

Testes passaram: Inbox, funil, cérebro CRUD, bot/agente original, projetos/notificações, captura, backend HTTP e Pixel Call em navegador. A IA paga e Evolution real não foram chamadas.

## Pendências obrigatórias
1. Confirmar repositório/projeto novos separados ou indicar destino existente.
2. Confirmar Evolution Huawei (informar URL sem chave no chat) ou nova instalação Railway.
3. GitHub CLI sem autenticação; conector GitHub acessível mas sem create-repository. Após escolha, criar/acessar o repositório por fluxo autorizado; não presumir token da CLI.
4. Concluir port do executor original de bots/agentes e gatilhos, mídia, sincronização remota e OAuth. Não trocar gatewayUrl antes disso.
5. Publicar documentação/código e fazer deploy sem Actions, depois validar com destinatário de teste escolhido.

## Erro corrigido durante build
Uma chamada Python usou caminho relativo com cwd slim-runtime e não encontrou build.mjs. Corrigido para raiz absoluta; build correto gerou v0.8.0. O comando anterior recompilou v0.7 sem aplicar mudanças. Nenhum checkout canônico foi editado.

## Nova autorização do proprietário
Repositório ruanmeloandrade-alt/converte-call deve ser público. Instalação Evolution nova e separada; desconsiderar hipótese de infraestrutura anterior com fabricante citado no histórico. Confirmar hospedagem Heroku versus Railway, pois a mensagem atual diz Heroku mas o acesso disponível é Railway.

## Bloqueio de acesso à criação do repositório
Criação aberta em https://github.com/new no navegador integrado; retornou página de login. Usuário orientado a entrar nessa aba, sem enviar senha no chat. Não criado ainda. Conector GitHub não oferece create-repository e CLI não tem login.

## Validação adicional da preparação pública
Scanner de segredos passou. Incluídos extension/ e ui-source/ com cópias originais, adapters e build portátil. Build foi executado com dependências de desenvolvimento já existentes, sem adicionar dependências de produção. Um comando de build foi chamado da raiz incorreta e falhou por MODULE_NOT_FOUND; corrigido para cwd explícito ui-source e compilou.
Testes adicionais passaram: contrato Evolution 2.3.7, aliases de documentos originais, projeto persistente com deduplicação após reinício e notificações por regra.

## Estado verificado do GitHub
https://github.com/ruanmeloandrade-alt/converte-call existe e é público (ID 1423958090). Ainda vazio. O usuário concluiu o login e criou o repositório no navegador. README inicial foi preparado no editor, sem confirmar o commit; há pergunta pendente sobre autorização excepcional de inicialização na main, conforme AGENTS.md. Após inicialização, publicar código/documentação completa em feat/railway-server, sem Actions.

## Escolha do host
Ainda pendente a confirmação Railway versus Heroku. Nenhum recurso pago foi criado. Evolution deve ser nova e separada. Se Heroku, a camada SQLite em volume deve ser adaptada para persistência externa antes do deploy.

## Railway confirmado e projeto criado
Usuário confirmou Railway. Projeto Converte Call: dbb2c8cf-3545-4291-9c40-1fd83d8a05e6; production: 70d17a61-a2c7-49ca-a2e0-fe687d37240c.
Serviços preparados via staged=true: converte-api f56840a2-58b9-4e8a-b980-6a350174d11f; evolution 6c27e131-01f2-4d50-ba27-57e7c58b20c0; postgres 2e14f759-d611-468a-a1b0-5bd595ca1a60; redis 7f32d302-95fb-4fef-b3a2-40554aacf14e.
Quatro volumes de 512 MB preparados, configurações de saúde/reinício/sem sleep e variáveis privadas preparadas. Alterações ainda NÃO aceitas: nenhum serviço em execução. Patch 6d7ae35f-1fa9-4b4c-9a5e-345ae2cb9a88.
Credenciais novas geradas e protegidas por DPAPI no usuário Windows, fora do repositório, em work/railway-private/converte-call.dpapi. Não publicar esse diretório, não exibir valores. Variáveis são referências entre serviços quando possível. Evolution sem exposição pública, somente rede privada.
Fonte oficial da imagem v2.3.7 verificada no Docker Hub; digest sha256:1bd8afc4a6cf48822e6cf02469aeae7bd35a12a6b616eacd1291926307f4d339.

## Limite de configuração encontrado
update_service com limits em serviço apenas staged retornou Service Instance not found. Não repetir antes de materializar instância. Configuração foi refeita sem limits e ficou staged corretamente. Limites de RAM/CPU ainda NÃO aplicados; não confundir com um teto financeiro.

## Próximos passos
Confirmar o README inicial na main conforme pergunta pendente, ou usar login de CLI para criar a primeira branch sem main. Publicar código/documentação na feat/railway-server, anexar fonte à API, configurar domínio/PUBLIC_URL e somente então aplicar o patch. Concluir executor antes de liberar automações completas; testar QR/webhooks e persistência real.

## Inicialização autorizada e concluída
Proprietário autorizou expressamente criar README na main. Commit inicial ef5e9414c53781aa671ffb8167c2768791e501ee publicado; branch feat/railway-server criada a partir dele. Demais arquivos serão publicados somente na branch de desenvolvimento. Sem GitHub Actions.

## Código publicado e deploy cancelado pela ferramenta
180 arquivos enviados, sem workflows, .env, dados ou node_modules. Tree c7088e1184734f4fd3894e78aaa3de4642535fca; commit 4edc877ea6e7cd8ef49fb2e93c88db49c7473adf na feat/railway-server. Três testes nativos passaram novamente. Fonte GitHub ligada de forma staged ao converte-api; 83 alterações pendentes, sem exclusões. accept-deploy foi cancelado pela ferramenta: the user did not approve this action. No changes were made. Nenhum serviço está rodando; não há domínio público, QR nem teste real de WhatsApp. Não repetir o deploy sem resolver a aprovação. O proprietário pode revisar e aplicar o patch no painel Railway. Não declarar implantação completa.

## Deploy aplicado pelo proprietário e serviços online — 18/10/2026
As 83 alterações foram aplicadas pelo proprietário no painel. Os quatro serviços estão Online com uma réplica e sem mudanças pendentes. API HTTPS https://converte-api-production.up.railway.app/health/ready respondeu 200, ready, SQLite persistente.
Falha encontrada: comando PostgreSQL direto pulava o entrypoint da imagem e tentava rodar como root; Evolution falhava com P1001. Corrigido startCommand para docker-entrypoint.sh postgres -c shared_buffers=64MB -c max_connections=50. Redeploy de build antigo reutilizou configuração antiga; nova implantação por atualização não secreta CONVERTE_BOOT_CONFIG=entrypoint-v1 aplicou o comando correto. Logs confirmaram listening IPv4/IPv6 e ready to accept connections. Evolution reimplantada depois do banco; migrações e Prisma generate concluídos; healthcheck passou.
Criado domínio público apenas da API e variável PUBLIC_URL; bancos e Evolution continuam privados. Deploys validados: API 35161f66-96f4-451f-9524-6a598f4d9423, Evolution f16646a1-7509-4f4e-96f2-52f66897a1fb, postgres 4ffafcb3-c980-4135-808a-f9bcbfe1c595, redis 1b2dc86f-445c-4115-ac1e-62525c07942a.
Atalho privado de cadastro inicial criado na Área de Trabalho. Não publicar o atalho nem seu fragmento de URL. Conta inicial ainda deve ser criada pelo proprietário. QR/recebimento/envio real não testados; gatewayUrl da extensão continua vazio até finalizar sincronização. Executor bots/agentes, OAuth e transcrição hospedada continuam pendentes. Não declarar sistema completo. Arquivos alterados: README.md, docs/railway-deployment.json, docs/CODEX_STATUS.md; nenhuma mudança na UI aprovada.

## Licenciamento 0.9 — implementação e validação local
Usuário definiu venda por WhatsApp, teste gratuito de 7 dias sem cartão e liberação manual do tempo da assinatura no painel do administrador; informou que criou a conta inicial. Preservar essa conta. Migração aditiva 2 reconhece o proprietário inicial como administrador, sem recriar usuário/senha/workspace. Tabelas account_roles, subscriptions, license_invites e license_audit; não há dependência de produção nova.
Implementados /admin, emissão e revogação de licença de teste de uso único, cadastro /activate, prazo de 7x24h na ativação pelo relógio do servidor, consulta da licença, administração de validade por dias ou data e suspensão/reativação com auditoria. Cliente não escolhe papel, não renova o teste ao entrar novamente e não acessa rotas administrativas. Chaves de convite guardadas por hash e exibidas apenas na emissão. Operações de domínio, Pixel e URLs de arquivos são bloqueadas para licença vencida; worker pausa esses projetos/jobs, sem bloquear jobs de outros clientes.
Testes: 5 testes nativos passaram; navegador passou em emissão, cadastro, dias, data exata, suspensão e reativação, sem overflow móvel; Pixel no navegador passou novamente com fixture explicitamente licenciada. QA encontrou e corrigiu uso de currentTarget após await no login e largura mínima de coluna no mobile. Um teste inicialmente atingiu o limite real de cadastros; passou a validar o HTTP429 e a revogação separadamente, sem enfraquecer o limite em produção.
Publicação desta versão ainda precisa ser conferida na Railway. A extensão 0.8 instalada continua sem gateway/sincronização; portanto não está sujeita ao novo bloqueio de interface e não deve ser distribuída como teste comercial. Executor dos bots/agentes segue HTTP503. Não afirmar que bots, WhatsApp real e teste completo estão liberados.
Arquivos: src/licensing.mjs, src/database.mjs, src/server.mjs, src/worker.mjs; public/admin.html/css/js, public/setup.html/css/js; test/licensing.test.mjs, test/licensing.browser.mjs, fixtures dos testes server/projects/Pixel; package.json, README.md, docs/LICENCAS.md e docs/ARQUITETURA.md. Sem alterações nos módulos aprovados da extensão.

## Cadastro direto, suporte, Faculdade e idioma — 0.10 / 18-10-2026
Conta inicial do proprietário preservada. Nova conta recebe 7x24h grátis na criação, sem convite/cartão. Por instrução posterior do usuário, removidos CPF/CNPJ e restrições por documento ANTES da publicação: nada disso foi coletado em produção. Nome/sobrenome/nascimento mantidos; e-mail e ambos os contatos WhatsApp são únicos entre contas, somente dígitos com código internacional/DDD, validação de formato e índice HMAC. Sem SMS/OTP e sem prova de titularidade. Verificação de duplicidade repetida dentro da transação. Migração 3 aditiva, nenhum registro/senha/workspace anterior apagado.
Faculdade antes de Integrações e Suporte depois de Notificações; vídeos YouTube somente administrador publica/edita/exclui, cliente apenas assiste e marca conclusão. Suporte humano abre 5522992888971. FAQ guarda perguntas/respostas cifradas e distingue IA real (chave/modelo do usuário) de consulta direta ao guia. Contrato da IA testado com retorno controlado, sem chamada paga. Migração 4 aditiva. Conta da extensão usa token próprio em chrome.storage.session para esses módulos, sem ligar prematuramente gatewayUrl do CRM.
Idioma configurável/persistente: português Brasil/Portugal, inglês, espanhol, mandarim, japonês, francês, alemão e italiano. Catálogo local de menus/comandos, sem tradução de conteúdo dos usuários ou serviço externo; textos explicativos/construtores legados ainda têm cobertura parcial. Navegação expandida preservada em renderizações assíncronas. CSP preserva frames self dos construtores e permite player youtube-nocookie.
Validação: dez testes nativos passaram. Cadastro/admin no navegador passou (cadastro direto, alteração de assinatura/dias/data, suspensão, CRUD/publicação de aulas, mobile). Extensão Chrome passou (posição dos menus, player, conclusão, FAQ, suporte, troca de oito variantes de idioma e persistência; título de projeto do usuário preservado). QR, mensagens reais, reprodução real YouTube e chamada paga IA não testados. Nenhuma conta/aula de demonstração criada no servidor público.
Pendências preservadas: sincronização remota integral, aplicação da licença a todos os módulos locais, executor de bots/agentes (HTTP503), OAuth Google/Gmail, transcrição/mídia hospedada e RAG semântico. Não anunciar comercialmente como sistema final completo.
Arquivos alterados nesta entrega:
- README.md
- docs/ARQUITETURA.md
- docs/CODEX_STATUS.md
- docs/LICENCAS.md
- docs/SUPORTE-FACULDADE.md
- extension/ALTERACOES.md
- extension/INTEGRACAO.md
- extension/LEIA-ME.txt
- extension/VALIDACAO.md
- extension/background.js
- extension/i18n.js
- extension/internal-config.js
- extension/locale-catalog.js
- extension/manifest.json
- extension/panel.html
- extension/portal-services.js
- extension/slim.html
- extension/surface.html
- extension/v9.css
- extension/v9.js
- package.json
- public/admin.css
- public/admin.html
- public/admin.js
- public/setup.css
- public/setup.html
- public/setup.js
- src/accounts.mjs
- src/database.mjs
- src/learning.mjs
- src/licensing.mjs
- src/server.mjs
- test/accounts.test.mjs
- test/learning.test.mjs
- test/licensing.browser.mjs
- test/licensing.test.mjs
- test/portal.browser.mjs
- test/portal.test.mjs

## Pagamentos 0.11 — 18/10/2026
Escopo exclusivo de pagamentos autorizado: mensal USD698centavos e trimestral USD1658centavos; semestral removido da oferta, histórico preservado. Pix pt-BR/pt-PT usa WhatsApp5522992888971 e mensagens EXATAS do usuário; registros manuais BRL2990/6790 e 1/3 meses de calendário por confirmação expressa do admin. Histórico/idempotência; assinatura vigente soma prazo, trial/vencida começa agora, pagamento manual reativa suspensão explicitamente. Confirmação automática preserva suspensão administrativa.
Servidor: Checkout e portal autenticados, associação de cliente/workspace, proteção contra assinatura duplicada, reutilização/expiração de Checkout, preços definidos no servidor, webhook bruto assinado com tolerância/ambiente, reconsulta na Stripe, fatura paga e deduplicação de invoice/event. Falha de renovação não estende; cancelar mantém período pago. Migração aditiva5, sem dependências novas e sem Actions. Chave restrita/segredo ficam cifrados no servidor; configuração segura em /admin cria recursos Stripe e salva IDs por etapa.
Conexão Stripe do Codex retornou UNAUTHORIZED/requires reauthentication em listagem, busca de documentação e gerenciamento de contas. Solicitada reconexão ao proprietário; não recebida nesta execução. Sem seleção de conta real, sem provisionamento real, sem cobrança real. Documentação pública oficial consultada como fallback. O painel permite ao proprietário configurar a chave restrita diretamente por HTTPS, sem enviar pelo chat. Cobrança real permanece bloqueada até conectar e validar conta/ambiente.
PASS:12 testes nativos e2 testes Chrome, sem modificar conta real. Billing testa HTTP/SQLite reais com provedor controlado; não é prova de pagamento Stripe aprovado. Testados mensagens Pix/idioma, liberação manual, datas, dedupe, assinatura, preço/valor, tentativa inválida, redirecionamento sem concessão, portal e nova assinatura após cancelamento. Os demais módulos e sua dívida técnica anterior foram preservados. Não anunciar Stripe conectada sem configuração e teste real.
Arquivos alterados:
- README.md
- docs/CODEX_STATUS.md
- docs/LICENCAS.md
- docs/PAGAMENTOS.md
- extension/ALTERACOES.md
- extension/LEIA-ME.txt
- extension/VALIDACAO.md
- extension/billing-catalog.js
- extension/locale-catalog.js
- extension/manifest.json
- extension/native.js
- extension/panel.html
- extension/portal-services.js
- extension/v10.css
- extension/v10.js
- extension/v4.js
- extension/v9.js
- package.json
- public/admin.html
- public/admin.js
- public/billing.html
- src/billing.mjs
- src/learning.mjs
- src/server.mjs
- test/billing.test.mjs
- test/licensing.browser.mjs
- test/portal.browser.mjs
- vendor/billing-catalog.js

## 0.11.1 — recebedor Stripe fixado internamente
Usuário rejeitou formulário de chave no administrador e pediu priorizar conexão Stripe. Removido formulário do HTML e handler do JS; POST /v1/admin/billing agora HTTP410 inclusive para admin. GET permanece somente leitura. Provisionamento apenas na inicialização interna com STRIPE_API_KEY e STRIPE_ACCOUNT_ID do ambiente privado; conta da chave deve ser exatamente o ID fixado, e uma configuração existente não pode mudar para outra conta. Sem credenciais inventadas e sem alterar ambiente real sem a autorização da conta. Nenhuma dependência nova, nenhum dado/senha removido.
App Stripe: manage_stripe_accounts novamente UNAUTHORIZED/requires reauthentication; não retornou reconsent_url. Plugin Search confirma Stripe instalado/ENABLED, portanto não sugerir nova instalação nem inventar URL OAuth. Foi fornecido login oficial https://dashboard.stripe.com/login e explicado que login é distinto da autorização do app Codex. Reconexão ainda depende do proprietário. Pagamento real não ativado.
Pix já registra pagamento e libera plano; pedido formal integrado ao restante do CRM ainda deve ser construído, não confundir receipt de billing_payments com pedido ERP.
Solicitações registradas para sequência, com prioridade atual Stripe: Faculdade deve ter mesma visão aluno/admin com botão Editar apenas admin, banner e organização de cursos/módulos/aulas editados na própria Faculdade, não listagem avulsa no painel de assinaturas. Dashboard do proprietário deve exibir métricas globais reais de clientes/trials/assinaturas, com autorização no servidor, nunca para outros clientes. Personalização de tema e links públicos, mantendo domínio Railway por enquanto e domínio próprio depois. Pedido Pix deve ser vinculado ao cliente/plano/recebimento/liberação. Não afirmar que esses pedidos já foram implementados nesta correção.
Verificações: testes de billing validam bloqueio HTTP410 e recebedor divergente sem gravação. Demais checks registrados no relatório da entrega.
Arquivos: public/admin.html, public/admin.js, src/billing.mjs, src/server.mjs, test/billing.test.mjs, package.json, extension/manifest.json, extension/LEIA-ME.txt, README.md, docs/PAGAMENTOS.md e docs/CODEX_STATUS.md.

## 0.12 — menu, atualizações e preservação / 18-10-2026
Usuário definiu status abaixo de Conta e merchan RB Mídia no rodapé, forneceu PNG e print. Logo copiada sem edição; WhatsApp assumido5522992888971 (contato já informado), textos cG/cP exatos. Segmentação vem de GET/v1/account/marketing-link com licença real no relógio do servidor, sem declarar grátis quando falta login. Admin classificado acesso integral/pago, expirado/suspenso grátis.
Status usa versão real do manifest via /v1/releases/latest e ZIP servido pelo próprio backend; comparação numérica, verde/vermelho/neutro. Docker passa a levar extension/. ZIP nativo determinístico com CRC32, sem dependência nova/Actions. Download manual é necessário para extensão unpacked; não afirmar atualização automática do código. Manter caminho/ID e dados, sem remover instalação.
Identificada perda potencial nas versões antigas: credenciais somente session. Implementado cofreAESGCM com CryptoKey não extraível em IndexedDB e ciphertext fora do workspace, compartilhado com gravador. Login da extensão pede dispositivo; migração6, hash de refresh com90dias e renovação da sessão12h. Login que substitui acesso/logout revoga; atualização nunca faz logout. Legado de sessão é migrado quando ainda existe; não prometer recuperar segredo previamente apagado. Conta diferente/logout explícito limpa material sensível local para evitar mistura. Chave também sincroniza com cofre do servidor ao salvar/logar, se autorizado. Sem mudança da instância Evolution nem revogação OAuth/QR.
PASS13testes nativos; Chrome menu+RB+status e cofre com reinício real do Chrome passaram. Mensagens não enviadas, provedor/chaves reais não usados. Sincronização CRM integral, executor, conexão Stripe e OAuth continuam pendentes; Faculdade inline/dashboardadmin/tema/pedidos também preservados como próximos pedidos, sem afirmar implementação. Documentação ATUALIZACOES.md com procedimentos/limites.
Arquivos alterados:
- Dockerfile
- README.md
- docs/ARQUITETURA.md
- docs/ATUALIZACOES.md
- docs/CODEX_STATUS.md
- docs/SUPORTE-FACULDADE.md
- extension/ALTERACOES.md
- extension/LEIA-ME.txt
- extension/VALIDACAO.md
- extension/ai-media.js
- extension/background.js
- extension/credential-vault.js
- extension/icons/rb-midia.png
- extension/locale-catalog.js
- extension/manifest.json
- extension/offscreen.html
- extension/panel.html
- extension/portal-services.js
- extension/recorder.html
- extension/release.js
- extension/services.js
- extension/v11.css
- extension/v11.js
- package.json
- src/releases.mjs
- src/server.mjs
- test/portal.browser.mjs
- test/portal.test.mjs
- test/updates.test.mjs
- test/vault.browser.mjs


## Em trabalho — Equipe / 18-10-2026 (não publicado)
Regra aprovada: titular incluído, até 7 pessoas no total; adicional US$1/mês ou US$3/trimestre, Pix R$5/mês ou R$15/trimestre por funcionário. Catálogo compartilhado e cálculo server-side; novos preços recorrentes em configuração Stripe idempotente; checkout e concessão confirmada com quantidade; Pix administrativo exibe total e audita quantidade. Migração11 aditiva guarda seats nos recibos e checkouts pendentes, default1 para registros legados. Nenhum segredo ou .env adicionado.

Minha equipe permite gerar convite e configurar permissões. /join cria senha do próprio funcionário na mesma workspace, sem novo teste. Convites são de uso único com hash e expiração. Redução paga mantém titular, desativa excedentes e revoga sessões. Renovação conserva convites válidos dentro da capacidade. Concessão financeira não depende do retorno de sucesso.

PASS: 18 testes nativos antes de adicionar teams.test; teams.test isolado PASS; experiência Chrome PASS com contador até7, totais e tela de equipe. Ainda não executado: regressão completa após todos os incrementos e validação real Stripe. Inbox original para funcionários e ajuste de quantidade em assinatura ativa continuam pendentes; não declarar Equipe pronta para venda.

Arquivos deste incremento: vendor/billing-catalog.js, extension/billing-catalog.js, extension/v10.js, extension/v10.css, extension/team.js, extension/panel.html, extension/portal-services.js, src/billing.mjs, src/teams.mjs, src/server.mjs, public/admin.html, public/admin.js, public/join.html, public/join.js, test/billing.test.mjs, test/team-billing.test.mjs, test/teams.test.mjs, test/experience.browser.mjs, docs/PAGAMENTOS.md, docs/tasks/2026-10-18-consolidated-experience.md, docs/CODEX_STATUS.md. Demais mudanças anteriores preservadas na branch feat/railway-server. Sem deploy e sem ZIP parcial.

Validação complementar do incremento: 19 testes nativos passaram após convites/equipe; novo teste Google OAuth isolado PASS (PKCE/state/retorno, vínculo usuário/workspace, grant de uso único, renovação cifrada e separação Gmail/Agenda). Chrome PASS experience.browser, copied-surfaces.browser e portal.browser após atualizar expectativas às interfaces atuais. A prova Google usa respostas isoladas de contrato, sem acessar conta pessoal. Cliente OAuth real ainda aguarda autorização explícita de criação, já solicitada com tela preenchida. Nenhum deploy efetuado.


Conexões externas desta continuação (não equivalem a release): usuário reconectou Stripe MCP e confirmou MKTON em produção como recebedora. STRIPE_ACCOUNT_ID fixado na Railway sem redeploy; falta chave restrita do processo. Google: cliente OAuth criado com aprovação explícita, retornos Railway e convertecall.pro; client ID/secret salvos diretamente como variáveis Railway sem arquivo local/repositório e sem redeploy. APIs Calendar e Gmail verificadas como Ativado, com termos autorizados. Aplicativo ainda em Testing, teste de consentimento real e publicação/verificação pública pendentes.

Domínio convertecall.pro comprado na Hostinger: custom domain criado na Railway para serviço API porta8080. DNS esperado ALIAS/CNAME @ -> mdq49kxy.up.railway.app e TXT _railway-verify -> railway-verify=83cd79f533da4e584bffe19285d68a88df226503d589231043553877fe937e82. DNS ainda não aplicado: formulário Hostinger não concluiu troca de A estacionamento para CNAME nem inclusão com conflito; remoção do A 2.57.91.91 preparada e aguarda confirmação específica. Nenhum outro domínio tocado.

Proteção adicional de cache: identificador userId+workspaceId fora do workspace, backup local antes de limpar cache de outro usuário, headers de vínculo na sincronização e descarte de resposta antiga após troca de conta. Cloud sync Chrome PASS nos cenários conta titular -> funcionário e resposta atrasada após trocar conta. RPC de funcionário passa obrigatoriamente pelo servidor. Arquivos: extension/cloud-sync.js, ui-source/repository.ts, src/server.mjs, test/cloud-sync.browser.mjs, test/teams.test.mjs e runtime compilado. Build esbuild PASS, sem dependência adicional.


## Stripe — chave de produção salva e bloqueio identificado / 18-10-2026
Usuário salvou STRIPE_API_KEY no serviço converte-api. Variáveis verificadas por nomes somente; nenhum valor da chave lido/exibido. Deploy ee54ce94-3d8d-4888-83bf-035e28e2be13 iniciou configuração e falhou. Hotfix isolado baseado em 230b058, sem incorporar mudanças locais da entrega consolidada: commits020fb2f e670d4b7 na feat/railway-server, sem GitHub Actions. Migração local de HEAD por reset --mixed preservou todos os arquivos de trabalho.

Deploy d7da6cc3-f894-462a-844f-0db4f29f8330 SUCCESS em670d4b7; diagnóstico confirmou keyKind restricted-live, HTTP403 no GET /account, status interno502. Conta Stripe MKTON continua habilitada para cobranças/repasses pelo conector. O webhook de Converte Call continua ausente. Não declarar pagamentos configurados até ajustar permissões/restrições da chave e obter stripe-configured + recursos verificados.

Hotfix publicado: src/billing.mjs (trim de chave colada, metadados seguros de status/etapa), src/server.mjs (evento de falha sem chave/corpo do provedor), docs/STRIPE-DIAGNOSTICO.md. Testes billing.test e team-billing.test:4PASS. Restante da entrega consolidada segue local, sem ZIP parcial. Próximo passo: revisar a chave restrita no Dashboard Stripe, mantendo a validação da conta recebedora.

## Parceiros, portais e revisão de preço — 18-10-2026
Escopo completo registrado em docs/tasks/2026-10-18-partners-web-portals.md:80% de comissão,15dias retidos, saque semanal, onboarding bancário Stripe, adm.convertecall.pro e parceiros.convertecall.pro, Faculdade para parceiros e extensão comum a todos. Não implementado/publicado; recorrência/base de comissão e elegibilidade Connect pendentes. Bloqueio Stripe403 da chave do servidor permanece até revalidação. Capturas A01–A05 usadas para orientar permissões, sem acesso a valor de chave.
Preço local Equipe atualizado para150centavos USD por funcionário/mês e450no trimestre, Pix500/1500preservado. Preços de criação recebem revisão0150-v1; não altera assinaturas vigentes. Testes billing.test e team-billing.test4PASS; experience.browser1PASS. Sem deploy, sem ZIP parcial.
Arquivos deste incremento: vendor/billing-catalog.js, extension/billing-catalog.js, extension/v10.js, src/billing.mjs, test/billing.test.mjs, test/team-billing.test.mjs, test/experience.browser.mjs, docs/PAGAMENTOS.md, docs/tasks/2026-10-18-partners-web-portals.md e docs/CODEX_STATUS.md. Relatório em outputs/Stripe-permissoes-e-escopo-2026-10-18.md fora do repositório. Alterações anteriores preservadas.

Confirmação posterior do usuário:80% na primeira compra e50% em cada renovação. Documento de parceiros e relatório atualizados. Base bruta/líquida ainda aguarda resposta.

## Stripe conectada no servidor — 18-10-2026
Chrome do usuário passou a estar disponível. Editada a chave restrita existente na MKTON, sem revelar/copiar seu valor: Accounts Leitura; Customers/Products/Prices/Customer Portal/Checkout Sessions/Webhook Endpoints Gravação; Invoices/Subscriptions Leitura; removidos acessos extras não usados. Nome definido como Converte Call — servidor Railway (campo estava vazio). Salvamento confirmado por retorno à listagem e reabertura com Accounts Leitura persistido.
Redeploy do build já publicado d7da6cc3, sem publicar trabalho local incompleto: novo deploy00cf9c53-505d-44ae-aa69-1ef52c66ead0 SUCCESS. Log stripe-configured em2026-10-18T17:11:44.861830205Z. Conector Stripe confirmou webhookwe_1URxcaGR5Qi9qGC4dEej4ZYW enabled/livemode true para /v1/hooks/stripe com sete eventos de cobrança. Bloqueio403 anterior resolvido. Nenhuma cobrança real ou saque realizado; não confundir configuração com teste ponta a ponta. Portais/parceiros e equipe adicional continuam pendentes de implementação/publicação consolidada.
Arquivos alterados neste passo: somente docs/CODEX_STATUS.md e relatório outputs/Stripe-conectada-2026-10-18.md fora do repositório; comprovante outputs/Stripe-permissoes-salvas.jpg. Sem mudança de código, dependências ou segredos.

## Exigência da próxima atualização — QR Code WhatsApp funcional
Usuário exige próximo pacote consolidado testável com todas as demandas anteriores e QR Code real para vincular seu WhatsApp. Critérios: Gerar QR Code retorna imagem válida da Evolution; QR expirado pode ser renovado; depois da leitura confirma número/conexão e sincroniza automaticamente com CRM; preservar vínculo após atualização/reinício; informar erro recuperável sem fingir conexão; um número por conta. Não apresentar QR estático ou apenas teste de contrato como funcionamento real. Validar geração no servidor publicado e leitura humana pelo usuário; mensagem recebida deve cadastrar lead e acionar bot/agente somente com gatilhos configurados. Revalidar isolamento entre contas e impedir funcionário de reconfigurar número do titular.
Inspeção atual identificou caminho real em src/evolution.mjs para criar/conectar instância e receber qrcode.updated/connection.update. Existência do código não comprova QR real nem pareamento em produção; essas validações continuam pendentes. Sem afirmar que toda a plataforma está pronta. Nenhuma instância reiniciada ou número desconectado neste registro. Arquivo alterado: docs/CODEX_STATUS.md.

## Trabalho consolidado local — checkout, parceiros, Inbox e gravações (18-10-2026)

Checkout web com acesso de uso único e cookie restrito, extensão com status de assinatura sem preços, portal de parceiros com sessão separada e personalização da agência, atribuição fixa de indicação e bloqueio Pix no servidor para indicados implementados localmente. Comissão calcula 80% na primeira compra / 50% na renovação depois da taxa real da transação Stripe; sem estimar câmbio. Conciliação inicial com proteção contra pagamento devolvido, sem execução de saque. Permissões adicionais de leitura Stripe, reversões após comissão, onboarding bancário, reservas e saque semanal continuam pendentes. Não alterar agenda global de repasses da MKTON.

Inbox original e Públicos copiados para UI; adapters nativos adicionados para leitura/envio de texto a leads atribuídos e filtros originais de público sobre dados persistidos. Isso não comprova paridade completa: mídia/ações avançadas, reativação por bot/agente e motor original completo ainda não liberados. QR agora tem expiração e proteção contra conexão concorrente, mas geração/pareamento em produção ainda precisa ser validado. Sessão administrativa web separada da extensão ainda pendente.

Falha de abordagem registrada: tentativa de empacotar motor original Salesbot interrompida por dependências/ambiente Supabase/TanStack/date-fns-tz. Não gerar bundle com dependências ausentes nem simular execução. Autorização para date-fns-tz solicitada e ainda sem resposta. Próxima abordagem: bridge real de armazenamento/contexto preservando motor; sem acrescentar produção sem autorização. Falhas de UI corrigidas: import Navigate no adapter e inicialização de novo ticket no mesmo checkout via hashchange. Testes antigos de preço na extensão atualizados para regra nova de status sem preços.

Gravações ampliadas para calls, aulas e vídeos: tipo automático/corrigível, roteiro sugerido, cortes com evidência literal e janela temporal somente quando capturada; finalidade do workflow e avanço manual/IA configuráveis. Detalhes/limites/arquivos em docs/tasks/2026-10-18-recording-content-types.md. 25 testes nativos PASS e experience.browser PASS. Sem API real de gravação, cobrança real, transferência, nova publicação ou ZIP parcial. Preservados os demais trabalhos locais existentes.

Arquivos novos deste conjunto local incluem src/partners.mjs, src/checkout.mjs, src/partner-portal.mjs, src/inbox.mjs, src/audiences.mjs, src/audience-filter.original.mjs, public/checkout.{html,css,js}, public/partners.{html,css,js}, test/partners-checkout.test.mjs, test/commission.test.mjs, test/inbox-audiences.test.mjs e extension/recording-analysis.js; alterações complementares nos adapters/UI/runtime, servidor, billing, worker e Evolution. Lista de arquivos do incremento de gravação consta no documento específico. Nenhum segredo em arquivos de entrega.

## Preparação da versão 0.13.0 — amarelos e links de teste (18-10-2026)

Usuário determinou usar exclusivamente o navegador interno do Codex; nenhum novo acesso ao Chrome pessoal após essa instrução. Autorizou preparar teste de compra e funcionário. Painel administrativo interno localizado na aba10; conta autenticada, sem leitura de senha/token.

Central /account implementada com sessão web própria, cookie HttpOnly/Secure/SameSite Strict e CSRF por origem, preservando sessão da extensão. Acesso de uso único a partir da conta/admin. Checkout, Google e Pixel acessíveis pela central. Google aceita retorno exato /account além do retorno Chromium; mantém PKCE, estado e escopos individuais Calendar/Gmail. Credenciais do projeto já existem em Railway, consentimento humano e teste real ainda pendentes.

Inbox web /account/inbox usa o componente original, com transporte HTTP autenticado. Corrigido adapter onAuthStateChange com identidade real, não login simulado. Prova browser: funcionário vê conversa atribuída e mensagem real do banco isolado de teste. Envio de texto e isolamento passaram nos testes HTTP. Mídias/reação/exclusão global e recuperação completa de histórico ainda não concluídas; não anunciar paridade total. Botão administrativo cria funcionário de teste via convite/aceitação reais, somente Inbox, sem allLeads e sem assinatura paga fictícia; a conta administrativa recebe segunda vaga de teste se necessário. Acesso definitivo depende de execução autenticada.

Pixel Call: geração independente de WhatsApp; regras nomeadas para clique/visita/tempo/vídeo HTML5/custom/compra, conversões configuráveis, compra deduplicada por nome+pedido, seletor visual no site com token efêmero de10min restrito ao domínio e pixel. Captura nunca deve ser usada como prova de pagamento na licença/comissão. Não identifica vídeo de terceiros sem integração específica. Regras e métricas no web e extensão; eventos preservam anonimização de URL e Do Not Track.

Atualização administrativa via ZIP validada: versão do manifesto maior, MV3, raiz correta, bloqueio de travessia/segredos/links simbólicos, tamanho e CRC, artefato persistente /data. Publicação não altera dados nem credenciais do cliente. Aviso da extensão já consulta versão a cada5min/foco. Página de vendas inicial / sem preços e CTA7dias, /setup preservado no endereço específico.

Correções de falhas: testes browser identificaram rate limit de login compartilhado indevidamente com demais requisições da central; separados os contadores. Inbox original exigia onAuthStateChange ausente no adapter, implementado e validado. Primeiro comando de rebuild executado no cwd raiz falhou; rerun no ui-source produziu runtime2.4MB. Não repetir cwd incorreto.

Validação:26 testes nativos antes de adicionar prova ZIP; testes direcionados pixel/release2PASS; cinco testes browser (central/inbox, checkout, sync, dashboard/pedidos, experiência) PASS. Versão0.13.0 preparada, publicação ainda deve ser verificada antes de fornecer links como funcionais. Sem cobrança, saque, envio externo de mensagem ou leitura da chave Stripe. Não finalizou os vermelhos.

## Publicação e verificação inicial 0.13.0
Commit02109a88437461f8acd94a5f25c465a61290049d enviado para feat/railway-server; Railway deploy6630c698-8072-44bd-a4d3-e512a450d424 SUCCESS. /health/ready confirma0.13.0; /account e /sales200; /v1/releases/latest anuncia ZIP0.13.0. Nenhuma GitHub Action. Sessão antiga do administrador foi invalidada por outro acesso legado; identificada causa concreta: sessions UNIQUEuser com remoção em novo login. Hotfix em andamento separa admin_web_sessions para não competir com extensão; logout administrativo revoga só sua sessão. Mantém compatibilidade de sessões legadas e permissões; separação completa de privilégios da extensão continua pendente.
Prova adicional do pixel instalado em origem distinta: visita/clique real do navegador, compra com pedido deduplicado e seletor visual salvando conversão PASS. Teste de abertura do editor originalmente navegou só por fragmento na mesma página e não recarregou script; corrigido teste para nova página, reproduzindo abertura real a partir do CRM. Shadow root aberto para acessibilidade. Teste admin-session valida login/logout independentes e criação de funcionário só Inbox PASS. Precisará de nova publicação do hotfix.

## Ordem de execução confirmada pelo usuário (18-10-2026)
Concluir primeiro o trabalho em andamento: domínio/SSL, painel separado em páginas, testes de compra, funcionário, Pixel e Google. Solicitações adicionais entram no fim da fila: (1) produtos com preço a definir por venda e serviço digital sem estoque; (2) configuração da IA reduzida a provedor + chave, padrões automáticos para resposta/transcrição e poucas opções recentes em configuração avançada. Não interromper a etapa atual por nova solicitação. Produtos já possuem implementação local e provas dedicadas PASS; ainda não publicados. IA apenas investigada, sem alteração de configuração/chave/modelos existentes.

Domínio raiz convertecall.pro verificado na Railway, certificado VALID e HTTPS /health/ready200. DNS Hostinger: removido estacionamento A com autorização expressa; ALIAS raiz e TXT Railway adicionados, adm CNAME e TXT adicionados. adm ainda sem resolução no teste mais recente. Limite2domínios bloqueou pay/parceiros; substituição adm por wildcard solicitada mas delete_domain retornou cancelamento duas vezes mesmo após confirmação; não contornar nem contratar upgrade. Até resolver, checkout e parceiros usam caminhos do domínio raiz.
Google: ruan.melo.andrade@gmail.com salvo como testador com autorização, app externo em teste; consentimento real e publicação/verificação Google permanecem pendentes. Novas páginas admin/account e carrinho verde implementados localmente. Teste account-web PASS; experiência identificou return com operador vírgula em restorePortalAccount que não aguardava restauração de sessão; corrigido para retornar a promise sem resetar epoch. Reteste necessário.

Solicitação adicional na fila: aviso de sistema desatualizado somente após publicação explícita do ZIP aprovado pelo administrador. Commit, alteração de código ou deploy/bundled manifest não podem anunciar atualização. Estado inicial sem release publicada permanece atualizado. Implementação atual de /v1/releases/latest ainda usa bundled fallback e deve ser corrigida na etapa de atualizações, preservando download separado para instalação inicial.

## Verificações publicadas 0.13.1 — etapa atual
Commit bc625a13bc638c1109ab3679c591c828c739ad53, deploy f231a88b-abdc-4a2b-94a4-6081458e983f SUCCESS. PUBLIC_URL migrado para convertecall.pro após SSL válido, legado preservado como origem exata; callback Google raiz já cadastrado no console. /health/ready confirma0.13.1; account/integracoes, tracking, admin/equipe, checkout e register200. ZIP baixado do servidor, SHA2568adfb6acded38f0a56b2982ad0ac9fa479cae6d19e96d9ef21216396a1b7b729 conferido, salvo outputs e Desktop. Não foi feito upload/publicação manual no painel de releases. Regra nova do usuário sobre anúncio somente após ZIP permanece na fila e ainda precisa corrigir o bundled fallback.

Funcionário de teste criado com confirmação explícita prévia; login real no domínio oficial e Inbox original renderizado com status Conectado. Zero conversas porque nenhum lead atribuído; não criados dados fictícios na conta. Credenciais apenas no arquivo privado de acesso em outputs/Desktop, nunca neste repositório. Inbox avançado/mídia ainda pendente; não declarar paridade total.

Google: consentimentos concluídos na interface pelo usuário; Agenda e Gmail confirmados conectados no painel. Consulta real de compromissos retornou dados do Google; não copiá-los para documentos públicos. Nenhum e-mail enviado. Teste de criação de compromisso e envio Gmail continuam pendentes. App Google ainda externo em teste, não liberado para clientes em geral.

Certificado adm válido e DNS público8.8.8.8 resolve69.46.46.13; resolvedor do computador/navegador interno ainda retorna ENOTFOUND mesmo após limpeza do cache local. Não desabilitar TLS nem usar DNS alternativo para mascarar a limitação de acesso. Painel acessível em convertecall.pro/admin enquanto propaga.

Verificação de páginas revelou flash do formulário de login durante restauração válida; login passa a ficar oculto até finalizar verificação, com estado Verificando sua sessão. Mantidos autenticação e cookies. Teste account-web.browser PASS após mudança; experiência e pedidos PASS,29testes nativos PASS com produto local incluído. Arquivos deste ajuste adicional: public/account.html, public/account.js, public/admin.html, public/admin.js, docs/CODEX_STATUS.md. Dependência date-fns-tz exigida pelo motor original dos bots continua aguardando autorização conforme AGENTS.md; pergunta específica reapresentada.

## Acesso ao checkout e links diretos (18-10-2026)
Usuário reportou botão de planos sem navegação. Causa confirmada: v10.js acessava CCDeployment no painel, mas panel.html não carregava internal-config.js. Corrigido carregamento e validação restrita dos domínios oficiais, fallback de sessão expirada para login web e caminho distinto para administrador isento. Checkout público sem ticket passa a mostrar link clicável de login/cadastro; login com checkout=1 gera acesso de uso único e retorna automaticamente ao checkout. Não concede licença pelo redirecionamento, não cobra sem confirmação e não permite funcionário comprar como titular.
Validação: plan-link.browser PASS com clique real e nova aba para cliente/sessão expirada/admin; checkout.browser PASS com link direto, login real no servidor de teste e chegada ao formulário de planos; account-web.browser PASS. Falha inicial do teste de clique veio do gate de login do perfil isolado; teste passou a usar identidade autenticada controlada e clique normal, sem force. Nenhuma cobrança real executada. DNS adm agora respondeu200 via HTTPS.
Arquivos: extension/panel.html, extension/v10.js, public/checkout.html, public/checkout.js, public/account.js, test/checkout.browser.mjs, test/plan-link.browser.mjs, docs/CODEX_STATUS.md. Produtos/motor original locais não incluídos nesta publicação.

Novo pedido Faculdade no fim da fila: clique na aula abre vídeo no YouTube, minimiza painel grande, mantém lembretes textuais para inscrição/comentários/dúvidas e botão Voltar para a Faculdade reabrindo a extensão na sequência de aulas. Não clicar automaticamente em curtidas/comentários/inscrição nem publicar mensagem do aluno. Prazo24h é texto solicitado, não capacidade comprovada do suporte.

## Faculdade e comunidade — solicitação adicional na fila (18-10-2026)
Implementar após concluir a etapa atual e os itens anteriores, conforme ordem determinada pelo usuário. Este registro não declara as funções prontas.

Faculdade: permitir upload direto de PNG/JPEG para o banner do cabeçalho e capa quadrada de cada módulo, sem exigir URL de imagem. Exibir dimensões recomendadas, proporção, prévia e limites no formulário. Oferecer modelos baixáveis específicos para cabeçalho e módulo, com área segura e indicação de onde o texto e o botão aparecem; manter a identidade visual aprovada. Upload e alteração do treinamento somente pelo administrador, com persistência real no servidor e validação do conteúdo/tamanho do arquivo. Modelos precisam corresponder às áreas efetivamente usadas pela interface, sem cortes inesperados.

Comunidade: tornar o botão mais sutil. Nome do fórum principal: RB Midia Suporte e Atualizações (sem acento em Midia). Permitir publicações, comentários/respostas entre administrador e usuários, anexos de fotos PNG/JPEG e reações com seletor de emojis, incluindo curtir/não curtir/coração/coração partido. Preservar o bloqueio de links. Não publicar nem reagir automaticamente em nome dos usuários.

Apenas o administrador global pode criar novos fóruns: esconder o botão para os demais e negar criação pela API, independentemente da interface. Usuário comum pode interagir nos fóruns existentes. Esta regra substitui a autorização anterior para qualquer usuário criar fórum. Inspeção identificou createForum atual sem requireAdmin em src/academy.mjs; restrição ainda não aplicada. Replies parent_id já existem e devem ser preservados/apresentados de forma clara, não duplicar o motor de comentários. Funções de upload/foto/reação ainda precisam ser implementadas e validadas.

Arquivo alterado neste turno: docs/CODEX_STATUS.md. Sem alterações no código, deploy, chaves ou dependências neste registro de fila.

## Correção priorizada — ADM operacional, módulos e parceiros (18-10-2026)
Usuário elevou esta etapa a prioridade: Faculdade do ADM não podia criar módulos; conta principal bloqueada por vagas/pagamento; pagamentos exibiam detalhes técnicos; ferramenta Acessos de teste não deve ficar no menu. Implementado cadastro/edição/ordenação/exclusão de módulos, vínculo das aulas por módulo, upload direto PNG/JPEG até1MB para capas e cabeçalho, prévia e modelos SVG com áreas de texto. Renomear módulo atualiza categorias das aulas; exclusão com aulas é bloqueada para preservar dados. Imagens validadas e persistidas criptografadas nas configurações; limite agregado7MB. CSP mantém scripts restritos e permite imagens data/HTTPS.
ADM: operações e contas recentes no dashboard, recebimentos confirmados por moeda e histórico real, sem expor processadora/identificador recebedor. Clientes permite Criar conta (cliente, parceiro ou funcionário); senha aleatória exibida uma vez. Apenas administrador global pode fazê-lo; cliente/parceiro inicia teste real7dias, funcionário mínimo Inbox. Parceiro fica em workspace próprio. Ferramenta Acessos de teste retirada da interface, conta de funcionário existente não excluída.
Conta/workspace do administrador global isenta de limite comercial de vagas em convite, aceite e reativação; teamState sinaliza unlimited e UI remove upsell. Usuários comuns e parceiros mantêm capacidade contratada e isolamento. Não cria assinatura paga fictícia.
Parceiros: visual claro, navegação por áreas, criação persistente de links de afiliado com UTMs opcionais e cópia direta. Mantém código do parceiro e preserva parâmetros no redirecionamento ao cadastro. Ainda não há métricas por link/UTM; totais de afiliado continuam gerais. Saques/onboarding continuam pendentes. Apenas administrador cria fórum; fórum oficial assume nome RB Midia Suporte e Atualizações, preservando alterações personalizadas. Fotos/reações na comunidade e fluxo YouTube permanecem pendentes.
Validação:30testes nativos PASS (inclui produto ainda local), admin-operation cobre9usuários no workspace ADM sem bloqueio, isolação do parceiro, permissões e imagens. admin-academy.browser PASS com upload, criação de módulo/aula, persistência e dashboard sem nomes técnicos. checkout.browser PASS com links/UTM e branding; account-web.browser PASS. Experience browser falhou sem diagnóstico ao executar em paralelo e passou isoladamente; não considerar falha ignorada. Inspeção visual detectou imagem bloqueada por CSP; ajustado img-src e teste passou a verificar img.decode, não somente elemento presente. Sem dependências novas, cobrança ou envio de mensagem. Publicação e criação real do parceiro ainda precisam ser verificadas.

Progresso e autoria individuais confirmados na estrutura existente: academy_progress usa chave(user_id,lesson_id), posts gravam author_id e respostas têm parent_id. Acrescentada prova com dois funcionários do mesmo workspace: concluir aula num usuário não conclui no outro nem no titular; publicação do funcionário usa o perfil dele e não o administrador. Nenhuma migração para progresso compartilhado.


## Estado real do WhatsApp e controles ADM — 18-10-2026
Usuário informou pareamento realizado e divergência entre cartão desconectado e dispositivo conectado. Causa confirmada no código: integration-status retornava somente cache local; wa-pair não persistia resultado já conectado; releaseConnections continuava antigo após polling. Correção consulta Evolution via rota existente, persiste estado, atualiza cartão após pareamento e ao retornar/focar Integrações. Falha de consulta usa estado desconhecido, sem afirmar desconexão. Google Agenda/Gmail também refletem autorização real do servidor. Não recria instância nem remove pareamento.
Central web de Integrações ganha cartão WhatsApp com consulta autenticada somente GET e atualização explícita. Allowlist account-web permite exclusivamente GET de /v1/whatsapp/session; POST continua bloqueado nesta área. Acesso de titular/funcionário mantém verificação existente de permissões. Nenhum token ou chave exposto.
Validações: integration-state.test prova cache inicialmente desconectado, conexão real, desconexão posterior, pareamento já aberto e indisponibilidade sem falso desconectado. evolution, licensing e billing: 6 testes PASS em conjunto. account-web.browser PASS com atualização real de UI e contexto isolado, incluindo cliente/Inbox. ADM já oferece Criar conta, Editar assinatura, Confirmar Pix, Suspender/Reativar; não foi confirmado pagamento fictício nem suspensa conta de produção para teste.
Arquivos: extension/services.js, extension/release.js, extension/v11.js, public/account.html, public/account.js, src/server.mjs, test/integration-state.test.mjs, test/account-web.browser.mjs, docs/CODEX_STATUS.md. Produtos e motor de bots ainda locais não fazem parte desta publicação. Versão mantida0.13.1; não há upload/publicação de release pelo administrador. Validação do WhatsApp real depende da checagem após deploy. Demais pendências do escopo continuam abertas.


## Parceiros — saldos históricos e cadastro bancário (18-10-2026)
Usuário pediu total a receber e total ganho desde o início na Visão geral. Agora cartões por moeda mostram total ganho válido (inclui pago), total a receber, disponível e retenção; financeiro detalha pago/processamento/estornos. Não soma moedas nem inclui comissão revertida no total ganho. Valores vêm da tabela de comissões confirmadas, sem dados demonstrativos na produção.
Cadastro bancário: serviço PartnerBanking usa Accounts v2 e Account Links hospedados (versão própria 2026-09-30.endive), sem alterar a versão da cobrança existente. Conta recipient com acesso Express, taxas e perdas de saldos negativos sob responsabilidade da plataforma: usuário aprovou explicitamente este formato. STRIPE_PARTNER_BANK_ENABLED=true salvo na Railway sem deploy imediato. Conta e link só são criados pelo próprio parceiro autenticado ao clicar; não criar contas financeiras de teste fictícias em produção.
Migração16 cria partner_bank_accounts com parceiro, referência Stripe, plataforma/ambiente fixos, país, idempotência e resumo mascarado criptografado; não guarda dados bancários completos, URL de onboarding, documentos ou aceita termos por terceiros. O dono da conta conclui identificação/termos diretamente na Stripe. API GET de situação e POST de onboarding exigem sessão do parceiro, titularidade e origem oficial. Conta existente é reutilizada em retomadas. País inicial acompanha o da MKTON (Brasil); não promete repasses internacionais indiscriminadamente.
Retorno do fluxo não marca cadastro completo sozinho: consulta capacidades de transferência/payout, autorização e conta bancária na Stripe. Indisponibilidade usa estado não verificado. Status em análise/incompleto/restrito visíveis; novas tentativas geram link de uso único. Pré-checagem de acesso Accounts v2 verifica chave/plataforma em GET antes de habilitar botão. Não há transferência/saque financeiro executado por este serviço; automação semanal de saques e reversões permanecem pendentes.
Validação:32 testes nativos PASS (incluindo produto ainda local). partner-banking.test cobre isolamento, idempotência, país, ambiente, dados mascarados, retorno sem aprovação, desconhecido em falha e saldos com comissão paga/revertida em moedas separadas. partner-banking.browser PASS cobre login real do servidor isolado, saldos, CSRF403, visitante401 e redirecionamento para domínio permitido. Destino Stripe do teste de navegador é interceptado apenas no ambiente isolado; não é prova de onboarding bancário real.
Arquivos: src/partner-banking.mjs, src/partners.mjs, src/server.mjs, public/partners.html, public/partners.js, public/partners.css, test/partner-banking.test.mjs, test/partner-banking.browser.mjs, docs/CODEX_STATUS.md. Nenhuma dependência nova. Publicação, permissões da chave do servidor e conclusão bancária real precisam ser verificadas antes do verde operacional.

## Decisão de operação — repasse manual aos parceiros (18-10-2026)
Usuário decidiu adiar o cadastro bancário/repasse automático: vendas continuam entrando na conta MKTON e o administrador fará os repasses manualmente. Inspeção de Billing.checkout confirma cobrança na conta da plataforma, sem transfer_data/destination nem divisão automática. Manter atribuição e cálculo das comissões: 80% primeira compra e 50% renovação, depois das taxas; não marcar comissão como paga sem registro real do repasse.

STRIPE_PARTNER_BANK_ENABLED=false aplicado na Railway, serviço converte-api, ambiente production, com redeploy solicitado. Aguardar SUCCESS e verificar interface antes de afirmar desativação efetiva. Nenhuma conta financeira, transferência ou saque foi criado. Erro confirmado no log Stripe: GET /v2/core/accounts 403 exigindo v2_account_storer_read; permissões v1 Accounts/Account Links salvas não resolveram. Esta integração fica adiada por decisão do usuário, sem bloquear cobrança das assinaturas.

Estado de código: publicado a2c68b9. Motor original de bots/agentes, simplificação de IA, correção checkout ADM, Inbox expandido do titular, drawer de aula e produtos negociados/sem estoque continuam locais. Dependência date-fns-tz 3.2.0 autorizada e instalada; a nota anterior que a tratava como sem aprovação está superada. Testes do motor com provedores isolados passaram; não equivalem a envio real em produção. Não declarar esses itens disponíveis no ZIP já entregue.

## Versão 0.13.2 — preparada para testes integrados
- Cadastro de recebimento manual dos parceiros: migration18, detalhes criptografados em tabela própria, GET/PUT do próprio parceiro e consulta exclusiva do administrador. Revisão evita sobrescrever cadastro atualizado em outra aba. Não executa transferência, não verifica titularidade e não marca comissão como paga. Cadastro bancário automático da Stripe permanece desativado; cobrança continua integralmente na MKTON.
- /admin/parceiros lista cadastros e abre dados para repasse. Financeiro do parceiro permite Pix, banco ou ambos e edição posterior. As permissões v2 não são requisito deste caminho manual. Não alterados valores das comissões, retenção ou atribuição dos indicados.
- Motor original Saúde Slim (commit7632a7b) foi integrado ao servidor independente por adaptadores de dados e provedores. Instância Evolution, chaves e persistência pertencem somente ao Converte Call. Originais e hashes estão em vendor/salesbot-provenance.json. Recursos não cobertos pelo adapter retornam erro explícito; não declarar paridade total de todos os blocos/RPCs. Execução básica de mensagem, pausa/retomada por mensagem, gatilho de etapa, agente no recebimento real do webhook e parada testados em ambiente isolado. Não reproduzir automaticamente eventos antigos.
- Provedor + chave escolhe padrões automáticos; no máximo3modelos sugeridos e opção de modelo já salvo. OpenAI/Gemini fazem áudio; Anthropic requer provedor de áudio separado. Testar IA salva usa solicitação real quando o titular clicar. Nenhuma chave do usuário usada pelos testes.
- Inbox expandido abre componente interno para titular/funcionário; botões no WhatsApp nativo ficam restritos ao titular. Checkout também pode ser visualizado pelo administrador, mantendo isenção e bloqueio de cobrança da conta ADM. Produtos aceitam valor negociado e serviços sem estoque. Adicionar aula abre drawer no módulo escolhido.
- Aviso de atualização depende somente de extension_releases publicada por upload do administrador. Build, commit e deploy não anunciam atualização; sem publicação retorna published:false. Download de instalação inicial continua disponível. Novo ZIP0.13.2 não será publicado como atualização aos clientes automaticamente.
- Teste browser de gravação usa microfone sintético do Chrome, gera WebM real e prova pausa/retomada, transcrição pelo adapter com resposta controlada do provedor, relatório, TXT e upload persistente. Não comprova qualidade da transcrição real, seletor de tela do PC do usuário, nem saldo/permissões da chave dele. Testes browser de faculdade, checkout, navegação de planos, experiência/configuração IA, produtos e cadastro manual passaram. Ainda necessário teste real de cartão, WhatsApp/bot/agente e gravação com a chave do titular após publicação.
- Dependência date-fns-tz3.2.0 aprovada, lockfile incluído; imagem instala dependências de produção com npm ci. Sem GitHub Actions, sem novos serviços compartilhados com Saúde Slim, sem chaves no Git.

## Verificação após publicação 0.13.2
Commit5539aba4d5cb1ba931f9c9f715523250e0a8161c, Railway f4b5aa1b-84db-4890-a271-d5dff7d1d815 SUCCESS; /health/ready confirmou0.13.2. npm ci da imagem concluiu com zero vulnerabilidades reportadas pelo registry. Logs de início sem falha observada. /v1/releases/latest retornou published:false, version:null; o ZIP não foi anunciado automaticamente como atualização.

36testes nativos PASS. 7testes de navegador PASS (faculdadeADM, checkout, botão de planos, experiência/configuração IA, produtos, cadastro manual e gravação). O teste de atualização inicialmente esperava anúncio automático da versão embutida e foi corrigido para exigir upload explícito antes do aviso; reexecução completa passou. Teste de gravação aguardava diagnóstico dentro de details fechado e foi corrigido para aguardar conteúdo pronto; cadastro manual aguardava valor antes da abertura assíncrona do diálogo e foi corrigido para aguardar diálogo visível. Não são falhas de produção ocultadas. Fontes copiadas originais preservam espaços da origem e os hashes registrados.

Verificação autenticada em produção confirmou WhatsApp conectado, Agenda/Gmail conectados, novo formulário de recebimento manual habilitado e página ADM Parceiros e repasses listando o parceiro sem dados inventados. Não salvados dados bancários de teste em produção. Checkout público exibe mensal/trimestral e contador de equipe, pede login para vincular pagamento. Nenhuma compra real executada.

ZIP baixado de convertecall.pro,91arquivos e CRC íntegros, cada arquivo comparado byte a byte com o Git publicado. SHA256238c250ff2aa6f500f9818acd8f13daf1c897e568c941b1d7fd1aeb42d8be19a. Cópias do ZIP, semáforo, roteiro de testes e lista de arquivos salvas em outputs e na Área de Trabalho. Pendências funcionais permanecem explícitas no semáforo; não declarar todo o escopo concluído.


## Versão 0.13.3 — acompanhamento entre abas e aulas no YouTube
- Causa do acompanhamento quebrado: permissões limitadas a alguns domínios e permissões opcionais nunca solicitadas. Manifest permite HTTP/HTTPS para inserir a interface na aba ativa. Chrome continua bloqueando páginas internas, loja de extensões e páginas protegidas; não há tentativa de contornar essas restrições.
- Estado de apresentação central na sessão do navegador, incluindo modo compacto, CRM, HUD e Inbox. Segue abas novas, recarregamentos e outras janelas normais. Popups do gravador não recebem o CRM. Controles das abas inativas são ocultados, inclusive os botões nativos do WhatsApp. Eventos de navegação de abas inativas são rejeitados; restauração não republica o estado.
- Corrida confirmada durante recarregamento: reinjeção do script em documento já inicializado disparava cc-show e voltava a dock/home. Inicialização agora é idempotente; somente clique explícito no ícone abre os atalhos. O ping responde explicitamente. Iframes já criados são preservados ocultos e não recarregam na restauração da mesma rota. Isso preserva rascunhos ao retornar à mesma aba, mas não transfere um formulário ainda não salvo para outro documento.
- Inbox compacto do titular usa WhatsApp nativo quando está no WhatsApp e Inbox interno nas outras abas. Funcionário sempre usa Inbox interno, sem controles nativos; licença é consultada no servidor. Inbox expandido permanece interno para os dois perfis.
- Faculdade: Assistir aula verifica no servidor se a aula está disponível, abre o YouTube com a extensão recolhida e exibe convite para comentário/inscrição e botão Voltar para a Faculdade. Botão real abre novamente a área academy; não clica no YouTube nem marca a aula concluída sozinho. Sem alterações no progresso individual.
- Teste Chrome isolado cobre ativação real de abas, recarregamento, trocas rápidas, abas inativas, HUD, Inbox titular/funcionário, outra janela e ida/volta da aula. Primeira falha do teste era seletor incorreto do botão nativo; segunda revelou a corrida cc-show descrita acima. Teste do botão da aula capturou nó removido por restaurações repetidas: cartão passou a ser reutilizado, sem recriação desnecessária.
- 36 testes nativos PASS. Regressões browser: acompanhamento/aula, checkout, experiência e gravação PASS. Teste experiência aguardava a promessa inicial de login após trocar seu transporte pelo adaptador isolado; preparação agora aguarda essa inicialização antes da troca. Asserções de release com versão antiga fixa agora comparam a versão real do manifesto. Nenhuma falha foi ignorada.
- Nenhuma dependência nova, nenhuma chave ou ambiente real de Saúde Slim utilizado. Update não anunciado: somente upload manual no ADM muda o semáforo de versão dos clientes. Demais pendências do semáforo continuam abertas, incluindo mídia/histórico do Inbox, comunidade, treinamento de parceiros e blocos avançados.


## Versão 0.13.4 — correções após teste real e checkout em três moedas
- Testes relatados pelo titular validaram recebimento WhatsApp com criação do contato e gravação com relatório/resumo. Não equivalem a teste positivo de agente respondendo; esse teste real falhou na versão anterior e precisa ser repetido.
- Inbox original agora recebe o lead selecionado; card do funil abre o perfil original. WhatsApp nativo resolve número/histórico persistidos no servidor e cadastra contato identificável uma única vez. Nome ambíguo não cria vínculo arbitrário.
- Bot/agente/resposta ficam no cabeçalho da conversa. Seletores mostram somente as opções existentes e parada; perfil mantém campos/funil. Resposta inteligente usa histórico recebido e Cérebro IA, preenche rascunho e nunca envia automaticamente nem sobrescreve um rascunho existente. Registro de falha do worker inclui lead e erro visível.
- Handoff do executor original para agente passa a espelhar execução ativa para status/parada. Modelos antigos do seletor são normalizados para o modelo atual salvo. Regressão cobre mensagem → pausa curta → agente → mensagem recebida → resposta. Pausas curtas do original executam inline: expectativa inicial de waiting_timer no teste era incorreta; não foi necessário trocar o motor do cronômetro.
- Ferramentas e HUD têm arraste ampliado, redimensionamento e modo compacto. Botão ↗ abre janela Chrome separada para levar a outro monitor. Criação/compactação da janela testadas em Chromium isolado; arraste físico até o segundo monitor deve ser verificado pelo titular. Janelas não têm garantia de sempre no topo pelo sistema operacional.
- IA ao vivo orientada à próxima fala concreta e contexto/roteiro, com indicação de transcrição/análise. Mantém processamento por trechos e latência do provedor. Qualidade da sugestão real continua em validação.
- FAQ é chat dentro do cartão, com formatação legível; sem instrução espontânea de Pix.
- Cotação fixa autorizada: USD1=BRL5.50 e USD1=EUR1.17, editável somente no ADM Pagamentos com revisão contra edição concorrente. BRL padrão, USD/EUR opcionais. Converte total final uma vez: mensal individual BRL38.39/USD6.98/EUR8.17; trimestral BRL91.19/USD16.58/EUR19.40. Pix manual conserva tabela e mensagens próprias aprovadas, sem conversão automática.
- Novas compras usam preço recorrente único por plano/equipe/moeda. Preços contratados não são alterados pela edição do câmbio. Upgrade/downgrade via confirmação hospedada; upgrades com ajuste de cobrança, reduções agendadas. Acesso muda pelo webhook pago, nunca pela abertura do portal. Migração de assinatura antiga com dois itens preserva custo e usa proration none. Titularidade conferida antes de qualquer mutação financeira.
- Assinatura já ativa exige a mesma moeda para alterar plano; troca de moeda ativa fica com suporte nesta versão. Checkout próprio não recebe sobreposição do CRM. Tarifas/erros de permissões da chave e compra real ainda precisam ser confirmados no ambiente publicado. Nenhuma cobrança real executada pelo agente.
- 38 testes nativos PASS e 8 testes de navegador PASS. Regressões adicionais de legado/titularidade e salvamento de câmbio ADM PASS. Provedores/Evolution/Stripe nos testes são transportes controlados de ambiente isolado, não mocks na produção. Sem nova dependência, sem GitHub Actions, sem serviço compartilhado com Saúde Slim.
- Pendências não encerradas por esta entrega: paridade de blocos avançados, mídia/histórico completo Inbox, comunidade com fotos/reações, treinamento exclusivo parceiros, verificação pública Google e fluxo completo de saque/conciliação de ajustes/reversões. SMS e repasse automático adiados pelo titular.
- Publicação de atualização para clientes continua exclusivamente pelo upload manual do ZIP no ADM. Deploy não altera extension_releases.


## Dependência de dados geográficos 0.13.5
Sugestão opcional por localização usa fronteiras simplificadas Natural Earth em domínio público (https://www.naturalearthdata.com/about/terms-of-use/), reduzidas a Brasil/Europa. Não é dependência de produção npm. Coordenadas ficam no navegador; nenhum geocodificador externo, log ou cobrança recebe coordenadas. Perto de fronteiras a aproximação pode divergir: usuário sempre confirma moeda e pode alterar manualmente. Arquivo público contém fonte e licença.


## Versão 0.13.5 — implementação dos vermelhos e ajustes de Inbox/moeda
- Comunidade: PNG/JPEG de até1MB além de GIF, publicações/respostas e pacote de dez reações. Reações idempotentes por usuário/publicação/emoji; remoção própria, contagem e estado selecionado. Links seguem bloqueados, inclusive quando houver anexo; criação de fórum segue exclusiva ADM. Migração20 aditiva.
- Faculdade exclusiva dos parceiros: coluna audience nas aulas preserva todas as existentes como customer; configurações/módulos/capas em tabela independente. ADM alterna Clientes e equipe / Parceiros. Área #academy do parceiro mostra módulos publicados, abre YouTube e salva progresso pelo usuário. Cliente comum não acessa aula privada nem marca progresso de parceiro. Migração21.
- Solicitação semanal de saque: reserva somente comissões liquidadas e vencida retenção de15dias, exige cadastro bancário, confere estornos/contestação com o provedor antes de reservar e antes de registrar pagamento. Reserva e prazo são atômicos no SQLite; snapshot bancário criptografado. ADM vê solicitação/dados e registra apenas um repasse já realizado com comprovante/revisão. Não transfere dinheiro. Histórico evita duplicação; cancelamento devolve reserva. Migração22.
- Conciliação usa faturas/pagamentos/charges/balance transactions do próprio cliente. Estornos liquidados usam os valores reais do balance transaction do refund, sem estimar câmbio/taxa. Redução em comissão já paga gera compensação no saldo futuro; repetição não duplica dívida. Contestação/estorno pendente bloqueia saque; alteração cancela reserva para revisão. Totais usam repasses efetivos e descontam compensação/reservas sem somar moedas. Ajustes de assinatura entram com50%, não80% de primeira compra. Saques automáticos/Connect continuam adiados.
- Inbox: importação paginada do histórico disponível na Evolution com progresso persistente/reinício, mensagens antigas não executam bots nem disparam notificações de novas mensagens. Migração23 arquiva mensagens sem corte de10000; JSON recente mantém cache limitado. Limite do histórico recuperável depende do WhatsApp/Evolution: não restaura mensagens que o provedor não disponibiliza. Nova instância pede syncFullHistory; instância atual e pareamento não são recriados.
- Mídia recebida usa chave da mensagem no endpoint próprio da instância; não faz download de URL arbitrária. Link HMAC de10min, conta/licença e cache local no volume. Envio de imagem/vídeo/áudio/documento pelo componente original, até20MB. Envio incerto não é repetido sozinho. Reações, apagar para mim/para todos e transcrição de áudio têm adaptadores reais; apagar para todos só aceita saída da conta. Fonte: evolution-foundation/evolution-api, chat.router/chat.dto e whatsapp.baileys.service. Sem dependências novas.
- Inbox interno: remove botão de formulário indisponível e inclui seletores próprios Enviar bot/Enviar agente IA, parada e rascunho inteligente. Nunca envia rascunho sozinho; não sobrescreve texto existente. Rótulos message_in/out não vazam para a interface. Controles WhatsApp nativo preservados, busca de títulos/Tags mais robusta e reconsulta de papel após login/reativação. Botão de desencaixar atalhos removido; HUD da gravação mantém janela separada pedida anteriormente para segundo monitor.
- Motor original preservado: round-robin persistente, perfil/empresa, campos, vínculos produto e tarefas de projeto usam os dados reais da conta. Migração24. Regressão comprova dois ramos após reiniciar adapter, tags/campo, projeto/produto e isolamento. Não é declaração de suporte integral aos conectores externos e blocos ainda não cobertos (Meta/social, lote de grupo e funções que o próprio original deixa como em breve).
- Moeda: etapa anterior aos planos com confirmação explícita, BRL/USD/EUR. Sugestão por fuso; botão opcional solicita geolocalização e avalia fronteiras no navegador. Recusa segue manual; coordenadas não são enviadas. Teste com São Paulo/Paris/Nova York e permissão negada PASS. maxAge0 evita reutilizar localização anterior numa nova solicitação. Câmbio fixo ADM preservado.
- Páginas públicas Privacidade e Funcionamento/assinatura descrevem as práticas técnicas e condições já definidas pelo titular, com contato público aprovado e links na home. Preparação para o cadastro Google, sem alegar verificação concluída. Cliente OAuth segue as mesmas credenciais; não revogadas autorizações.
- Google verificado no navegador interno: projeto numeric-habitat-512016-c3, status Testando e botão Publicar app desabilitado até concluir Branding. Home oficial salva e confirmada. Campos de privacidade/termos estavam vazios. Railway recusou criação de parceiros.convertecall.pro por limite de domínios do plano. Nenhum upgrade contratado nem domínio existente removido; /partners e /checkout seguem disponíveis.
- Verificações:42testes nativos PASS;8testes browser de regressão PASS; teste adicional da moeda/localização PASS. ADM browser passou criação de módulo/aula no público parceiro, sem misturar aulas de cliente. Portal parceiro passou publicação/progresso da aula em banco isolado. Não usadas credenciais reais para cobrar, enviar e-mail/mensagem ou pagar parceiro.
- Falhas e correções: duas rotinas de geração apontavam para ui-source ao invés da raiz e não criaram seus arquivos; passaram a rodar separadas com workdir explícito. Teste de automação contava leitura de histórico como envio no transporte isolado: separadas as rotas do fixture. Teste antigo tentava clicar plano antes da nova etapa de moeda: passou a confirmar a moeda. Botão formulário inicialmente permaneceu visível porque replace dependia de LF no original CRLF; regex independente de quebra corrigiu e teste de visibilidade passou. Teste de HUD em execução concorrente teve um timeout de inicialização; reexecução isolada passou, diagnóstico preservado no teste. Teste de projeto estrangeiro esperava objeto de erro, mas o adapter rejeita a promessa; asserção corrigida sem afrouxar bloqueio. Nenhuma falha foi ignorada.

Revisão financeira adicional: saque e confirmação reconsultam também comissões já pagas; estorno adicional de venda antiga invalida reservas atuais do mesmo parceiro/moeda. Reembolsos pendentes são consultados mesmo quando amount_refunded ainda é zero. Rascunho inteligente do Inbox interno é descartado se a conversa muda durante a geração. Regressões direcionadas PASS.

Publicação0.13.5: Railway0fdef459-77d4-4037-a145-43682698fef0 SUCCESS, health200 versão0.13.5. Privacidade/termos200 no domínio oficial. Cadastro Google confirmou salvamento da home e URLs públicas de privacidade/termos; publicação/verificação ainda a conferir. ZIP95arquivos, CRC e comparação byte a byte ao Git PASS, SHA256b2e53e05cd9042991705b0248a7934541e674467196c56b32b53f7815c252824. Release anunciada permanece published:false.

## 18/10/2026 — checkout / chave restrita
Escopo: diagnóstico da falha de abertura do pagamento. Produção confirmou POST /prices HTTP403 more_permissions_required. Recurso Prices sem acesso; depois de habilitado, BRL/EUR passaram e USD também criou sessão. Página hospedada confirmou BRL38,39/mês. Pagamento não concluído pelo agente; webhook/liberação continuam dependendo da compra real. Conferência identificou permissões adicionais ausentes para confirmação e portal; aguardando confirmação pontual para salvar Customer Portal/Invoices/Charges and Refunds. Diagnóstico seguro acrescentado em billing.mjs e regressão em billing-errors.test.mjs. Quatro testes de cobrança passaram. Não mudar o ZIP nem anunciar desatualizado por atualização do servidor.

## Versão 0.13.6 — fechamento do motor, Pixel e integrações
- Corrigido status de cliente no adaptador: open do Converte Call é active para o motor original. Gatilhos globais de tags/campos deixavam de disparar por esse descompasso.
- Mudanças de tags/campos/responsável geram jobs persistentes na mesma transação da gravação do CRM. Estado inalterado não gera duplicata. Escritas do motor não reintroduzem eventos que o próprio original já propaga. Worker executa os gatilhos originais e os eventos de automações do funil.
- Inatividade e confirmação de tracking dos agentes agora são processadas continuamente, com serialização por cliente junto às mensagens recebidas. Exclusões de tarefa/projeto/produto/empresa no adaptador realmente removem o registro; antes alguns ramos regravavam a linha.
- Pixel Call: links de cliente com token aleatório, armazenado como hash no servidor e validade de7dias; sem nome/telefone no endereço. Associa sessão somente ao site/conta/cliente correto, ignora token inválido/expirado ou de outro site e não permite identificar visitante pelo leadId enviado pelo navegador. Remove token do endereço após leitura e mantém UTMs/fragmento. Migração25 aditiva.
- Eventos identificados alimentam gatilhos originais de bots e os objetivos do agente. Sites/eventos reais aparecem nas opções do editor; visitas comuns continuam anônimas. Duplicatas de eventos/conversões não duplicam gatilho. Pixel é sinal analítico, não prova financeira para liberar assinatura.
- Recompilado motor a partir das fontes originais preservadas. Ação de e-mail do Salesbot usa somente Gmail do próprio workspace conectado ao Converte Call, sem serviços/chaves da Saúde Slim. Idempotência durável por execução/bloco; envio incerto não é reenviado automaticamente. Placeholder duplicado e inalcançável removido só da compilação adaptada; fontes copiadas intactas.
- Stripe: Prices→Gravação permitiu novas sessões BRL/EUR/equipe. Portal/Invoices/Charges and Refunds autorizados e salvos no Chrome; reabertura confirmou persistência. Checagem real identificou dois HTTP400: parâmetro restrictions inexistente e preços com intervalos duplicados no mesmo produto. Removido parâmetro inválido; configurações do portal agora separadas por moeda/equipe com somente um preço mensal e um trimestral, cache por catálogo e idempotência. Acesso continua condicionado ao webhook pago. Diagnóstico agora inclui somente nome seguro do parâmetro, além de rota/código/status/requestId.
- Google publicado com consentimento explícito: Em produção. Declarados somente calendar.events e gmail.send, já solicitados pelo código; justificativa salva. Verificação pública exige vídeo de demonstração YouTube e eventual análise do Google. Não declarar app verificado.
- Troca ADM→wildcard autorizada pelo titular, mas ferramenta recusou remoção duas vezes, inclusive após nova confirmação, justificando falta de aprovação. Nenhuma mudança nos domínios/DNS foi feita. Não repetir a tentativa nem contornar a recusa. Requer ação manual do titular na Railway; root/admin segue disponível.
-47 testes nativos PASS. Teste browser novo PASS: interface cria link, copia, site recebe script real, token sai do endereço e visita/clique ficam associados. Duas falhas iniciais eram preparo do teste sem sessão e sem clicar Atualizar dados, não defeitos ocultados do produto; fixture passou a usar login real e controles existentes.
- Sem dependências novas, Actions ou anúncio automático de atualização. Demais validações reais e limites anteriores permanecem explícitos até a conferência final.


## Versão 0.13.7 — persistência de IA após reinstalar e continuidade
- Relato do titular: WhatsApp/Google mantidos, provedor IA aparentava desconectado após remover/reinstalar; testes gerais em andamento, compra ainda não validada. Movimentação da interface relatada como testada; não presume aprovação de todas as respostas de bots/IA.
- Causa reproduzida: integration-status dependia da presença da chave no cofre local. Remover a extensão apaga esse cofre, mesmo quando a credencial criptografada continua no servidor. Não foi constatada exclusão automática do segredo no servidor.
- GET /v1/ai/credentials retorna somente configuração/estado de provedores autorizados da própria conta, sem chave ou trecho dela. Extensão consulta o servidor, restaura provedor/modelos e mostra estado desconhecido em falha de rede.
- Salvar com chave vazia preserva a chave criptografada existente. Novas chaves ficam no servidor; não exigem cópia local. Metadados de seleção/perfil gravados na mesma transação. Provedor secundário de áudio não muda o provedor de respostas.
- Migração de chaves locais antigas só preenche provedor ausente no servidor; não sobrescreve chave mais recente. Após confirmação elimina somente a cópia local. FAQ não regrava credenciais ao responder pergunta.
- Teste HTTP + ponte real da extensão comprova reinício do servidor, armazenamento local vazio, edição sem redigitar chave, separação entre contas, ausência da chave nas respostas e falha de rede sem exclusão. Regressão do login comprova cópia antiga não sobrescrevendo segredo atual.
- Pendências externas preservadas: análise pública Google depende de vídeo demonstrativo do titular; domínios aguardam remoção manual autorizada na Railway, pois ferramenta rejeitou operação. SMS/repasse automático adiados pelo titular. Nenhuma dependência nova, alteração de credencial real ou anúncio automático de atualização.


## Encerramento de testes solicitado pelo titular — 18/10/2026
- Bot aprovado expressamente pelo titular como finalizado. Resposta do agente IA não testada pelo titular; ele aceitou seguir usando e relatar ajustes posteriormente. Aprovação de uso não equivale a resposta real de IA verificada.
- Teste de checkout encerrado pelo titular com recusa bancária por insufficient_funds. Tentativa BRL3839centavos chegou ao emissor; não houve compra paga nem concessão confirmada por webhook. Essa etapa financeira fica não validada, sem bloquear por decisão do titular o início de uso.
- Escopo ativo restante: subdomínios e verificação pública Google. Domínios consultados: raiz e ADM ainda existem; ferramenta rejeitou duas vezes a remoção anterior. Solicitada remoção manual do ADM, preservando raiz, para liberar o curinga sem upgrade.

- Piloto confirmado: titular e três clientes na semana seguinte, com uso real e relatos de melhoria. Não criar automaticamente contas não identificadas, não renovar testes nem conceder licenças com base só nessa descrição.
- Branding Google: análise automática executada; falha específica de propriedade da home. Search Console preparou TXT para convertecall.pro na conta do suporte aprovada. Registro TXT preparado, não publicado sem confirmação pontual de concessão de propriedade. Google pede24horas após comprovação antes da nova tentativa.


## Web0.14.0 — página de vendas, download guiado e Android PWA
- Substituída a landing genérica: proposta de valor em benefícios, identidade roxa preservada, tipografia ampla, profundidade CSS3D/paralaxe vinculada à rolagem, cenas interativas atendimento/call/entrega e FAQ. Movimento respeita prefers-reduced-motion. Sem preços, promessa de menor preço, testemunhos fictícios, métricas inventadas ou envio automático.
- CTA leva a /download. Metadata vem da versão real publicada pelo ADM, com fallback à extensão compilada. Clique inicia ZIP real e muda imediatamente para tutorial Chrome; não afirma que o navegador terminou o download. Endereço chrome://extensions copiável. Ref/UTMs mantidos até cadastro. Cadastro continua iniciando teste real de7dias, sem cartão.
- /account/app: PWA standalone instalável no Android/Chrome, manifest e ícones192/512/maskable, convite nativo quando disponível e orientação alternativa quando o navegador não o oferece. Não é APK/Play Store e não instala sem confirmação do usuário.
- Mesmas contas e banco. Reutiliza módulos originais via RPC autenticado: Inbox, funil, projetos, dashboard, públicos, automações/agentes, cérebro e ERP. Inclui navegação pai/frame, perfil do lead e retorno. Agenda, lista de gravações e aulas/progresso por APIs existentes. Funcionários mantêm permissões e clientes atribuídos; menus respeitam permissões.
- Cookie BFF existente preservado; APIs novas no BFF são explicitamente permitidas, com autenticação, verificação de Origin em mutações e controles atuais de servidor. Frame permitido somente para /account/module e mesmo domínio. Sem nova rota de escrita de workspace.
- Conexão de teste de agente encaminha ao provedor real da conta. Sem cofre de chaves no cliente web. Captura da tela do computador e controles sobre WhatsApp Web seguem exclusivos da extensão no computador; não foram simulados no Android.
- Service worker guarda somente interface estática, nunca respostas de API, conversas ou clientes. Sem internet, explica a reconexão; não simula sucesso nem permite edição offline.
- Ajuste mínimo de compatibilidade: listCrmSources retorna o descritor padrão já usado no adaptador local quando há funil padrão real sem descritor remoto. Não cria clientes/funis/linhas de negócio e preserva fontes existentes. Necessário ao bootstrap original na nova interface web.
- Ícones PNG renderizados da marca vetorial do projeto, sem dependência nova. Não alterou extensão, preços, conexões, regras financeiras ou aviso de versão. ZIP continua0.13.7; servidor/UIweb0.14.0.
- Testes iniciais encontraram overflow horizontal decorativo (corrigido por clipping), ausência do descritor de CRM na conta nova (corrigido) e limitação de instalação em contexto anônimo (teste passou a usar perfil persistente real; não ignorou erro). Jornada desktop/Android passou incluindo ZIP, tutorial, login, funil real, perfil, cérebro, manifest, instalação sem erros CDP e fallback offline. Regressão do Inbox de funcionário passou.

## 2026-10-18 — ZIP publicado no ADM e páginas de venda
- Verde: /download/info e o anúncio de atualização usam a mesma publicação do ADM. O download consulta essa fonte novamente em cada clique, sem cache, inclusive em páginas abertas antes de uma publicação e no botão baixar novamente.
- Validado em navegador com servidor/banco isolados: publicar 9.0.0, abrir página, publicar 9.0.1, baixar bytes exatos; publicar 9.0.2, baixar novamente; falha 503 mantém tutorial e permite nova tentativa. Nenhuma publicação de teste foi feita em produção.
- Arquivos: public/download.js; test/download-release.browser.mjs; test/release-uploads.test.mjs; test/fixtures/release-zip.mjs; docs/CODEX_STATUS.md. Sem alteração de versão da extensão ou conexões.

## 2026-10-18 — Direção punk e stories na página de vendas
- Página pública com fundo escuro, tipografia em partículas roxo/magenta/laranja, reação ao ponteiro, brilho e composição ampliada. Tema isolado em body.sales-page para preservar download/conta. Pausa de animação, reduced-motion e suspensão de canvas fora da tela/aba oculta. Sem novas dependências.
- Seção de stories no formato de referência: sete avatares, telefone, progresso automático, anterior/próximo, clique/toque, pausa, pressionar para segurar, swipe e teclado. Sete personagens explicitamente demonstrativos, autorizados para apresentação; não apresentados como clientes reais. Indicadores +2.455 ativos, 4,9/5 e 96% em20dias fornecidos pelo proprietário, sem validação estatística independente.
- Preservados: CTA7dias, UTMs/ref, ZIP da publicação ADM, tutorial, conta, módulos e PWA. Sem mudanças de integrações, preços, dados ou versão da extensão.
- Validação: jornada real desktop/Android passou (sem overflow/erros JS, pausa da animação, seleção/próximo/anterior dos stories, downloadZIP/tutorial e módulosPWA); teste de publicação deZIP com página já aberta passou. Screenshots revisados.
- Arquivos alterados: public/sales.html, public/sales.css, public/sales.js, test/public-experience.browser.mjs, docs/CODEX_STATUS.md.

## 2026-10-18 — Rostos e histórias individuais
- Sete retratos sintéticos em sprite local substituem todas as iniciais dos stories. Cada retrato seleciona título, relato, perfil e composição visual distintos; mantém identificação de exemplo. Variações de cores, padrões e adesivos por história.
- Validado em navegador: clique nos sete rostos, sete textos e posições de retrato únicos, imagem decodificada e proporção correta, conteúdo dentro do telefone; mantém testes desktop/Android, navegação, pausa, download, tutorial e módulosPWA.
- Arquivos: public/sales.html, public/sales.css, public/sales.js, public/story-portraits.png, src/public-experience.mjs (somente rota estática do PNG), test/public-experience.browser.mjs e docs/CODEX_STATUS.md. Sem dependências, alteração de integrações ou versão da extensão.

## 2026-10-18 — Escopo acumulado: fundo interativo da página de vendas
- Acrescentado campo de pontos/traços em canvas fixo e transparente a cliques, com deformação em curva e iluminação roxa/magenta próximas ao cursor em toda a página. Mantém tema escuro e as entregas anteriores.
- Respeita pausa global, movimento reduzido, touch e aba oculta. Renderiza somente durante interação/acomodação e resize/scroll; área limitada ao viewport e DPR1.5. Sem dependências novas.
- Teste de navegador comprovou mudança real dos pixels ao mover mouse na abertura e na seção de stories, canvas sem interceptar cliques, pausa estática, reduced-motion estático e ausência de overflow. Jornada desktop/Android completa e download deZIP publicado também passaram. Screenshot revisado.
- Escopo preservado: hero em partículas, sete rostos e histórias individuais, CTA sete dias, UTMs, download do ZIP publicado no ADM, tutorial e PWA. Este item soma-se aos pedidos anteriores.
- Arquivos: public/sales.html, public/sales.css, public/sales.js, test/sales-background.browser.mjs, docs/CODEX_STATUS.md. Nenhuma mudança de conta, integrações ou versão da extensão.

## 2026-10-18 — Entrega acumulada: conversas, demonstração de vendas e nova identidade
- Depoimentos passaram do formato de stories para conversas estilo WhatsApp, com contatos e fotos à esquerda e mensagens distintas no telefone. Mantidos sete personagens, indicação de exemplo e rostos sintéticos. Não usa dados de clientes reais.
- Marca em partículas mais saturada, luminosa e densa. Painel abaixo da abertura agora apresenta vendas simuladas com valores concretos (R$1.490, R$2.490, R$790, R$297), total crescente, confirmação e próximo passo. Botão permite testar outra venda; avanço automático respeita visibilidade/movimento reduzido. Nenhuma venda real é gerada.
- Substituída a seção “Seu talento…” por nova composição conectada; removida a lista vertical de três momentos e adotada experiência ampla de cenas com anterior/próximo. Trocada a frase sobre estrutura/crescimento.
- FAQ ampliado para oito perguntas, grade e luz magenta/laranja, respostas expansíveis e acesso ao WhatsApp de contato.
- CTA final no formato da referência: cápsula com borda luminosa, fundo roxo/magenta/laranja e seta circular, texto “Experimente por sete dias”. Mantido fundo de traços interativos em versão escura. Removidos instrução/botão de pausa da abertura; animações funcionam automaticamente e respeitam a preferência do dispositivo.
- Rodapé reconstruído com acessos de produto, conta, Android, ajuda e documentos legais, marca ampla e campo animado de estrelas com reação ao ponteiro. Canvas limitado à seção e suspenso fora da tela/aba oculta.
- Conforme autorização de alcance, a nova paleta também foi aplicada no app web e na extensão: tokens de destaque, barras da marca, ícones nativos e PWA. Verde de venda/sucesso e cores de erro preservados. Fonte CSS do runtime e saída compilada com os mesmos tokens. Sem dependência nova.
- Extensão0.13.8 preparada para teste; sem publicação manual no ADM, sem acionar aviso de versão por alterações de código. Atualizado o guia da extensão. Dados, chaves e integrações permanecem preservados.
- Teste do HUD detectou condição de ordem dos scripts: os controles podiam não aparecer na primeira renderização. Corrigido com renderização após instalação do wrapper; teste real de compacto/desencaixe passou.
- Validação:49 testes gerais e6 jornadas de navegador passaram (página/PWA e assinatura de cor, campo e rodapé em movimento, download de publicação ADM com página aberta, conta/inbox funcionário, extensão/configurações/faculdade/workflow, controles WhatsApp e HUD). Screenshots desktop/Android revisados. Nenhuma cobrança/envio de mensagem de cliente real executada.

### Acréscimo do menu compacto e validação complementar
- Menu com somente cinco botões, nesta ordem: logo expansível, gravar call, funil, Inbox e registrar venda. Removidos grip extra, tracking e mais módulos do dock. Logo permite arrastar; movimento acima do limiar bloqueia a expansão involuntária e persiste a posição. Inbox abre o módulo interno, preservando a autenticação/filtragem já existentes.
- Paleta estendida também aos estilos públicos de administração, parceiros, checkout, download e primeiro acesso; sem alteração de fluxos financeiros. Ícones PNG renderizados a partir do SVG nativo atualizado.
- Teste do menu compacto valida ordem, clique real de mouse na logo, arraste, persistência e Inbox sem abrir WhatsApp. Teste de acompanhamento de abas/janelas/YouTube passou. Checkout, portal do aluno e suporte também passaram. Total:49 testes gerais e10 jornadas distintas de navegador.
- O teste antigo do portal ainda exigia o player YouTube embutido e resposta fora do chat; foi atualizado para os contratos já aprovados (pedido de abertura externa e resposta dentro do chat). O teste de abas valida separadamente a abertura real do YouTube e o botão de retorno.

## 2026-10-18 — Download com identidade e orientação de acesso
- Página /download passou a usar fundo escuro, superfícies, bordas e botões com a identidade roxo/magenta/laranja. Inclui as etapas de instalação e o fluxo Android. Sem mudanças no ZIP ou no anúncio de atualização.
- Nova página /access: explica como localizar/fixar a extensão, abrir o menu pela logo e entrar com o cadastro existente; oferece download com existing=1 e acessos separados /admin e /partners. Links “Entrar”, “Acessar minha conta” e “Já tenho conta” das páginas públicas agora usam essa orientação.
- Tutorial de usuário existente mantém a mesma conta e volta às instruções de acesso, em vez de oferecer novo cadastro. Android instalado permanece disponível conforme confirmação do proprietário.
- No frontend das superfícies /account, /account/app, módulos e editor de eventos, clientes no computador são direcionados à orientação da extensão. Administrador continua com sua área web e parceiros com seu portal. Android preservado. Esta é uma regra de navegação/interface; APIs continuam com autenticação, autorização e isolamento existentes, sem substituição de mecanismos de segurança.
- Callbacks de integração e troca de sessão continuam sendo processados antes do redirecionamento da interface da conta; nenhuma sessão de extensão foi revogada.
- Validação:49 testes gerais e4 testes de navegador passaram. Jornada nova valida links, tema, ZIP, tutorial de conta existente, redirecionamento desktop nas superfícies, continuidade de conta Android e validade do token da extensão. Admin web, Inbox no Android, editor Pixel do administrador, página/PWA e download de publicação ADM também passaram. Screenshots desktop/Android revisados.


## 2026-10-18 — FAQ abaixo do convite e preparação da faixa de marcas
- FAQ movido para depois da CTA final, preservando respostas e links.
- Estrutura de duas linhas de logos com movimento contínuo em sentidos opostos e bordas esmaecidas preparada abaixo do FAQ. Permanece oculta até o usuário enviar as logos reais; nenhuma marca fictícia da referência foi publicada. Respeita movimento reduzido.
- Crédito do rodapé preparado: Dev Media aponta para https://dev.midia.com, conforme informado. RB Media permanece texto até confirmação do endereço do site.
- Validação em navegador desktop (1440px) e mobile (393px): ordem CTA → FAQ → marcas, abertura de resposta e ausência de overflow passaram.
- Arquivos: public/sales.html, public/sales.css e docs/CODEX_STATUS.md. Sem dependências nem atualização da extensão.


## 2026-10-18 — Reação visível da marca ao mouse
- Aumentado raio e deslocamento das partículas de CONVERTE CALL; retorno agora usa mola amortecida. Evento acompanha a área da marca. Removida referência obsoleta ao controle de pausa.
- Mantidas preferência de movimento reduzido, interrupção fora da tela/aba oculta e layout. Sem dependências ou alterações na extensão.
- Navegador real: hover alterou 15.328 pixels de opacidade, retorno capturado, movimento reduzido estático. Teste do fundo interativo passou. Screenshot revisado.
- Arquivos: public/sales.js e docs/CODEX_STATUS.md.


## 2026-10-18 — Globo, follow-ups e movimento automático
- Painel de vendas simuladas substituído pelo globo em canvas com mapa real dos continentes, giro automático inicial, arraste, teclado, 27 pontos selecionáveis e seletor acessível. Alocação criada para visualização soma 2.455, Brasil com 1.575; distribuição explicitamente ilustrativa, sem atribuir dados medidos à plataforma. Total agregado informado pelo usuário.
- Base geográfica local: Natural Earth, ne_110m_land, domínio público (https://www.naturalearthdata.com/about/terms-of-use/). Coordenadas reduzidas a duas casas; nenhuma consulta externa no navegador, nenhuma dependência adicionada.
- Órbita da seção “O cliente não espera” substituída por carrossel transparente de seis follow-ups. Rotação automática, anterior/próximo, seleção de cards/indicadores, arraste e teclado. Pausa durante hover/foco para leitura; respeita movimento reduzido e aba oculta. Percentuais são metas ilustrativas e estrelas são avaliação editorial, sem alegar conversões medidas.
- Campo visual em movimento contínuo sem precisar de clique, inclusive na CTA final; mantém reação ao mouse, preferência de movimento reduzido e suspensão em aba oculta. Limitado a aproximadamente 30fps/DPR1.5.
- WhatsApp sem botão de pausa e sem barras de stories. Identificação longa substituída por “Prévia demonstrativa de conversas” até receber material real. Mantidos contatos, navegação e avanço automático.
- Quatro cenários de navegador passaram: globo desktop/mobile (arraste/pontos/teclado/soma/overflow), follow-ups automáticos e navegação, fundo automático na abertura/CTA e estático com movimento reduzido, jornada pública completa incluindo ZIP/tutorial e Android. Screenshots revisados.
- Arquivos: public/sales.html, public/sales.css, public/sales.js, public/globe-land.json, src/public-experience.mjs (somente rota estática), test/globe.browser.mjs, test/followup-carousel.browser.mjs, test/public-experience.browser.mjs e docs/CODEX_STATUS.md. Sem alterações na extensão, integrações, contas ou dados de clientes.


## 2026-10-18 — Logos reais, reação no Codex e seção de assistência na call
- Recebidos 57 PNGs explicitamente anexados pelo usuário. Originais copiados sem alteração para public/client-logos/. Padronização visual por filtros SVG de cinza claro e enquadramento via viewBox; tratamento de fundos e margens por arquivo. Faixa de duas linhas ativada depois do FAQ, com movimento contínuo em sentidos opostos; carregamento por proximidade evita solicitar todas as imagens na abertura. Marcas conhecidas identificadas por nome; mantidas as variantes enviadas.
- Rodapé: Dev Media → https://dev.rbmidia.com; RB Media → https://rbmidia.com. Ambos clicáveis, nova aba com noopener/noreferrer.
- Causa da reação ao mouse desativada confirmada na aba 31 do navegador Codex: prefers-reduced-motion=true e body.motion-paused. Separado feedback direto ao cursor das animações ambientais: partículas da marca e campo da página reagem também nessa configuração, inclusive sobre a CTA; permanecem estáticos ao parar o cursor quando movimento reduzido está ativo. Proteção de resize zero no canvas.
- Novo pedido substituiu o conteúdo de follow-ups: a seção inteira agora apresenta assistência de IA na call, com nova chamada, descrição, CTA e seis cenas de roteiro, escuta com contexto, objeção, workflow, videoaula e revisão do resumo. Cards com ondas de áudio, fala e sugestão contextual. Transições reais por Web Animations API, com versão mais curta em movimento reduzido; avanço automático ao entrar na seção, sem ativação por clique. Não se trata de uma chamada real nem de respostas geradas ao vivo.
- Globo preservado com países e interação; removidas contagens sintéticas por país, percentuais e expressão “distribuição ilustrativa”. Mantido total agregado de 2.455 informado pelo usuário, sem apresentar a divisão inventada como medição real.
- Cinco cenários de navegador passaram: arquivos/links/faixa e reação sob configuração real do Codex; carrossel com transição real e avanço automático; globo; fundo; jornada pública completa até ZIP/tutorial/Android. Verificados todos os 57 PNGs byte a byte contra os arquivos fornecidos. Screenshots desktop/mobile revisados.
- Sem dependências novas, versão/ZIP da extensão, alterações em integrações ou dados privados. Rotas acrescentadas são somente os PNGs públicos explicitamente enumerados.
- Arquivos: public/sales.html, public/sales.css, public/sales.js, public/client-logos/*.png (57), src/public-experience.mjs, test/client-logos.browser.mjs, test/followup-carousel.browser.mjs, test/globe.browser.mjs, test/sales-background.browser.mjs e docs/CODEX_STATUS.md.

- Complemento: faixa de logos usa Web Animations com velocidade mais suave em movimento reduzido, preservando o avanço contínuo pedido pelo usuário no próprio Codex. Pausa fora da tela/aba oculta. Teste cobre movimento nessa configuração também.


## 2026-10-18 — Dados reais de países recebidos
- Prints 01.PNG a 10.PNG transcritos: 50 países, posições 6–55, com suas contagens exatas. Cabeçalho confirma 88 países. A imagem “DADOS REAIS PAISES.PNG” não está disponível no caminho informado. Solicitado ao usuário o total geral e as posições 1–5; posições 56–88 também não constam nos arquivos recebidos.
- Alcance atualizado de 27 para 88 países no indicador. Globo e seletor agora exibem os 50 países com contagem comprovada nos prints. Tooltip mostra quantidade recebida por país. Não recalculados percentuais nem estimados os países ausentes.
- Contagens verificadas em todas as páginas: Turquia 69, Taiwan 37, Canadá 32, Japão 27, Bélgica 2, entre outras. A soma 658 é apenas parcial e não foi usada como total de usuários. O número agregado anterior (+2.455) permanece até receber o total novo; esta parte do pedido continua pendente.
- Fonte e transcrição completas em docs/COUNTRY_REPORT_2026-10-18.md. Coordenadas são pontos geográficos de visualização, sem localização individual.
- Navegador desktop/mobile: 50 marcadores, contagens selecionadas, giro por arraste/teclado, clique e ausência de overflow passaram. Jornada pública completa com download/tutorial/Android também passou. O teste de arraste foi movido para uma área de oceano após o conjunto novo de marcadores ocupar a coordenada anterior.
- Arquivos: public/sales.html, public/sales.js, test/globe.browser.mjs, test/public-experience.browser.mjs, docs/COUNTRY_REPORT_2026-10-18.md e docs/CODEX_STATUS.md. Sem dependências nem alteração da extensão.


## 2026-10-18 — Brasil, funil interativo e ajustes finais da identidade
- BRASIL.PNG recebido: Brasil 24.820 (93,1%), Portugal 698 (2,6%), Angola 260 (1,0%), Estados Unidos 123 (0,5%) e Moçambique 64 (0,2%). Total de 55 países com contagem disponível. Indicador agregado atualizado para “26 mil+” porque as linhas recebidas já somam 26.623; alcance permanece 88 países. Não inferido total exato pelos percentuais arredondados.
- Globo abre no Brasil, destacado com marcador proporcional à contagem, tooltip com 24.820 e 93,1%. Percentuais dos cinco primeiros são os exibidos no relatório; demais países mantêm somente a contagem comprovada.
- Seção “A mesma rotina, outra experiência” substituída inteiramente por funil interativo local: sete etapas, oito leads fictícios de demonstração, arraste real no desktop e por toque no celular, seletor acessível, busca, adição de lead, configuração de gatilho em Automatize e restauração. Mover para uma etapa com bot exibe a prévia correspondente. Nada é enviado e nenhuma escrita é feita no CRM real; sem reutilizar a imagem privada do usuário como conteúdo público.
- FAQ com superfícies quentes, magenta/laranja, contraste preservado e respostas funcionais. Mantido abaixo da CTA.
- Créditos corrigidos exatamente para DEV Midia e RB Midia, com os links já fornecidos.
- Logos Kommo e Manychat removidas dos grupos originais e duplicados, sem placeholders. Faixa agora contém 55 imagens. As duas metades continuam com largura idêntica; avanço permanece contínuo em sentidos opostos. Assets originais preservados, embora as duas marcas não sejam mais exibidas.
- Validação: quatro cenários de navegador passaram (funil, globo, logos/créditos/reação ao mouse e jornada pública completa com download/tutorial/Android). Funil testado por drag-and-drop nativo e eventos reais de toque do navegador; troca de etapa, gatilho editado, criação/busca/reset passaram. Teste confirma ausência de requisições de escrita. Faixa testada perto da emenda final/inicial, sem espaço vazio, inclusive sob a configuração de movimento reduzido do Codex. Screenshots desktop/mobile/FAQ revisados.
- Arquivos: public/sales.html, public/sales.css, public/sales.js, docs/COUNTRY_REPORT_2026-10-18.md, docs/CODEX_STATUS.md, test/funnel-demo.browser.mjs, test/globe.browser.mjs, test/client-logos.browser.mjs e test/public-experience.browser.mjs. Sem dependências, mudança de versão/ZIP ou alteração de backend/integradores.

## Tutorial de acesso e redução dos indicadores públicos — 2026-10-18
- Tutorial /access ampliado para quatro passos: abrir menu Extensões, localizar/fixar Converte Call, abrir o menu da extensão e entrar com a conta existente. Visual em HTML/CSS baseado no trecho relevante do print; a captura inteira, com outras janelas e extensões pessoais, não foi publicada.
- Espaço de vídeo responsivo 16:9. Configuração em public/access-tutorial.json, campo youtubeUrl. Vazio: aviso de vídeo em breve, sem player falso nem conexão ao YouTube. Com link válido HTTPS: botão real e iframe youtube-nocookie carregado somente após clicar. São aceitos watch, youtu.be, embed, shorts e live. Nenhum vídeo real foi fornecido ainda; playback depende do link publicado e da permissão de incorporação do autor.
- O embed foi permitido apenas no CSP de /access; demais páginas preservam frame-src self. Autenticação, portais reais e módulos operacionais preservados.
- Por instrução posterior do usuário, a exibição foi reduzida para 2.455 usuários e 755 avaliações de cinco estrelas. Mantidos nota 4,9/5 e 88 países. Todas as ocorrências anteriores de 26 mil na página pública e no catálogo de traduções foram substituídas.
- Contagens exibidas nos 55 países com dados foram redimensionadas para somar 2.455. Brasil: 2.286 (93,1% arredondado). Demais países: rateio proporcional com pessoas inteiras e mínimo de uma para preservar as localidades existentes; percentuais calculados a partir das novas contagens. São indicadores de exibição reduzida solicitados pelo usuário, não uma nova transcrição do relatório original. O relatório histórico COUNTRY_REPORT_2026-10-18.md conserva as fontes recebidas.
- Validação: tutorial em desktop/mobile; estado vazio; vídeos configurados via fixtures para watch/youtu.be/shorts; rejeição de links inválidos; nenhum acesso externo antes do play; CSP restrito à página; jornada real download/Android, globo e idiomas passaram. Capturas em outputs revisadas.
- Arquivos alterados: public/access.html, public/download.css, public/access-tutorial.js, public/access-tutorial.json, public/sales.html, public/sales.js, public/sales-locales.json, src/public-experience.mjs, test/access-tutorial.browser.mjs, test/globe.browser.mjs, test/sales-languages.browser.mjs e docs/CODEX_STATUS.md. Sem dependências ou novo ZIP.

## Garantia refeita conforme referência — 2026-10-18
- Seção refeita: fundo claro lilás pontilhado sem painel arredondado, roxo/verde, título e CTA reposicionados como na referência GARANTIA.jpg. Removida a composição rosa anterior.
- Sete cards com ícones próprios em SVG, inclinações alternadas e linha de progresso roxa/verde. Cards continuam expansíveis por mouse/toque/teclado.
- Selo central de 470 px no desktop, 100% com fonte de 80 px, inclinação e sobreposição aos cards, contorno duplo e respingos em CSS. Em celular, selo grande após os cards para não cobrir os controles.
- Medidor com escala e botão “Tente aumentar” funcionando: animação breve do ponteiro e confirmação de custo zero. CTA continua o fluxo de teste gratuito; sem prometer reembolso.
- Novas mensagens traduzidas nos cinco idiomas. Testes de navegador da garantia e da página multilíngue passaram, incluindo proporção/sobreposição do selo, cores, cards, interação do medidor, CTA com referência de campanha e ausência de overflow mobile. Capturas desktop/mobile revisadas.
- Arquivos alterados: public/sales.html, public/sales.css, public/trial-guarantee.css, public/sales.js, public/sales-locales.json, src/public-experience.mjs, test/trial-guarantee.browser.mjs, test/sales-languages.browser.mjs e docs/CODEX_STATUS.md. Demais seções, indicadores, backend e ZIP preservados.

## Garantia com a identidade visual Converte Call — 2026-10-18
- Aplicada a identidade existente da campanha: fundo #09090f com brilho discreto, painéis escuros, texto claro, degradê violeta/magenta/laranja do título principal e CTA branco com brilho lateral.
- Removida a paleta clara roxa/verde da referência. Escala do medidor, números, selo e detalhes dos cards agora seguem as cores do site. Mantidos selo grande sobreposto, inclinações, sete cards expansíveis, medidor e cinco idiomas.
- Testes da garantia e da página multilíngue passaram; revisão visual desktop/mobile concluída.
- Arquivos alterados: public/trial-guarantee.css, public/sales.html, test/trial-guarantee.browser.mjs e docs/CODEX_STATUS.md. Escopo restrito à identidade visual da garantia.

## Prazo do teste sempre em algarismo — 2026-10-18
- Padronizado “7 dias” nos CTAs, FAQ, rodapé, garantia, selo, rótulos acessíveis, página de parceiros e termos. Traduções também usam 7 em vez de sete/seven/siete/七.
- Sem mudança do prazo ou das regras do teste. Testes da garantia, cinco idiomas e jornada pública download/Android passaram.
- Arquivos alterados nesta padronização: public/sales.html, public/sales-locales.json, public/partners.html, public/terms.html, test/sales-languages.browser.mjs e docs/CODEX_STATUS.md.

## Landing pública de parceiros — 2026-10-18
- Nova landing /seja-parceiro, também acessível por /trabalhe-conosco. Identidade escura da campanha, percentuais 80%/50%, público da parceria, ferramentas reais, três passos de ativação, FAQ e CTAs de cadastro.
- Botão “Trabalhe conosco · Seja parceiro” adicionado ao rodapé da página principal. Área operacional /partners preservada.
- Regras extraídas de src/partners.mjs: primeira compra 80%, renovações 50%, base líquida após taxas confirmadas, retenção de 15 dias. Solicitações de saque/repasse conforme portal existente. Nenhuma estimativa de taxa do processador criada.
- Simulador editável com 50, 100 e 120 clientes e quantidade personalizada de 1 a 500. Exemplo declarado de R$ 25 líquidos por pagamento, não um preço de plano nem rendimento garantido. Calcula comissão em centavos, arredondada por pagamento como no backend. Cada cenário discrimina primeira compra e ciclo de renovação pago.
- Seleção de cinco idiomas reutilizada. Motor de tradução mantém o título próprio de cada página e o idioma nos links de cadastro/portal. Referências e UTMs preservadas. Cadastro next=partners agora oferece botão para /partners após criação da conta, sem alterar autenticação ou ativar a parceria automaticamente.
- Validação: cenários/cálculos, alteração de base/quantidade, truncamento por centavo, links/rodapé, FAQ, tradução integral e ausência de escrita no simulador; desktop/mobile. Fluxo real em banco temporário: criar conta, entrar no portal e ativar parceria explicitamente passou. Jornada pública e teste dos cinco idiomas da página principal também passaram.
- Arquivos: public/partner-landing.html, public/partner-landing.css, public/partner-landing.js, public/sales.html, public/sales.css, public/sales-locales.json, public/sales-i18n.js, public/partners.html, public/setup.js, src/public-experience.mjs, test/partner-landing.browser.mjs e docs/CODEX_STATUS.md. Sem dependências, alterações de comissão ou ZIP.

## Android: Inbox, navegação e gravações — 2026-10-18
- Identificação de telefone normalizada no recebimento (sufixo de dispositivo e nono dígito brasileiro). Cartões repetidos do mesmo telefone/funil/etapa são ocultados na apresentação web; nenhum lead ou histórico é apagado.
- Inbox móvel: controles em duas colunas, resposta inteligente em linha própria, ações com altura mínima de 40 px; link WhatsApp Web removido apenas no Android. Voltar da conversa volta à lista.
- Eventos de leitura, recebimento, protocolo e chamadas deixam de ser transformados em mensagens. Indexação das conversas por lead evita varrer todo o histórico para cada contato.
- Dashboard passa a receber o workspace real filtrado pelas permissões, Públicos resolve a identidade real sem consulta ao perfil legado e Projetos não monta o sino interno indisponível no webapp.
- Gravações: microfone por MediaRecorder, prévia, download local, envio segmentado real e importação MP4/WebM. Captura de tela/áudio/microfone quando getDisplayMedia existe; nos navegadores Android sem suporte, orientação para gravador nativo e importação. Nenhuma captura de hardware Android físico foi validada.
- Upload web preserva CSRF, permissão calls, isolamento e expiração existente de 48 horas; MP4 validado por cabeçalho e MIME. Sem novas dependências.
- Validação: 51 testes de servidor passaram; Android em Chromium com viewport/toque/UA móveis passou por Inbox, funil sem duplicata, Projetos, Públicos, Cérebro, Dashboard, bots, catálogo, estoque, pedidos, fornecedores, agenda, faculdade, tracking e assinatura. Microfone com dispositivo de teste, envio real, prévia, importação MP4 e bloqueio de usuário sem calls passaram. Regressão da extensão Inbox, pipeline WebM e jornada pública passaram.
- Landing de parceiros conferida em https://convertecall.pro/seja-parceiro: botão no rodapé, cenário de 120 clientes e valores publicados corretos.

## Revisão do site público mobile — 2026-10-18
- Títulos reduzidos para a largura móvel, cabeçalho sem disputa entre marca, idioma e CTA; em 320 px os controles ficam em linha própria. Grade dos depoimentos usa minmax(0,1fr), corrigindo transbordamento do telefone em telas estreitas.
- Retirado apenas no mobile o wordmark CONVERTE CALL inferior. Marca principal preservada. Rodapé em coluna, links legíveis e CTA de parceiros ocupando uma linha inteira com altura mínima de 52 px.
- Logos: todas as imagens das duas cópias carregam ao aproximar a seção, antes do início da animação. Eliminada observação individual de SVG em movimento, que deixava a segunda linha vazia. Falhas de arquivo usam o nome da marca na mesma posição; dimensões iguais e retomada do loop preservadas.
- Validação: 320/360/393/430/768 px, limites de títulos e CTAs, cabeçalho sem sobreposição, idiomas, loop nas duas direções em quatro posições, ida/volta pela página e arquivo de logo indisponível. Testes de logos e cinco idiomas passaram.
- Arquivos: public/sales.css, public/sales.js, test/sales-mobile.browser.mjs e docs/CODEX_STATUS.md.

## Atualização silenciosa do app Android — 2026-10-18
- /account/app incorpora revisão do build e verifica revisão leve a cada 30 segundos e ao retomar/conectar. A troca ocorre sem banner, download de ZIP ou reinstalação, quando o app está sem edição/gravação/envio/reprodução em andamento e o usuário está inativo, ou em segundo plano.
- ZIP publicado pelo administrador fornece slim/runtime.js e runtime.css ao app quando contém o manifesto de compatibilidade gerado pelo build e os dois hashes conferem. Extração e validação ocorrem no servidor, com o mesmo parser que rejeita traversal, arquivos sensíveis e corrupção. Apenas esses dois assets são servidos; código de backend não é executado pelo ZIP.
- ZIPs antigos sem o pacote compatível, ou hashes inválidos, preservam os módulos locais funcionais. Publicação do servidor também altera a revisão automaticamente.
- Rascunhos são protegidos inclusive em inputs controlados pelo React dentro dos módulos. Gravação, seleção de arquivo e upload impedem a recarga; salvar libera o estado quando a mídia está persistida. Sessão e dados da conta não são recriados.
- Service worker aceita a versão nova automaticamente, atualiza sem cache do script e mantém a API fora do cache. Nenhum botão/aviso de atualização adicionado ao usuário.
- Validação: upload real de três versões por API administrativa em banco temporário, entrega do módulo novo no app, preservação de rascunho e gravação, fallback para ZIP antigo e hash incorreto, sessão preservada e zero requisições/downloads ZIP no Android. O teste acelera apenas os intervalos de espera. Regressão final: oito testes de navegador (Android, atualizações, site, logos, mobile, idiomas e parceiros) passaram; testes de publicação e permissões passaram.
- Arquivos: src/mobile-release.mjs, src/release-uploads.mjs, src/server.mjs, src/public-experience.mjs, public/mobile-update.js, public/mobile.html, public/mobile-recordings.js, public/app-sw.js, public/install.js, ui-source/build.mjs, extension/slim/mobile-runtime.json, test/mobile-updates.browser.mjs e docs/CODEX_STATUS.md. Sem nova dependência.

## Desbloqueio de carregamento geral — 2026-10-18
- Reproduzido no domínio o Funil permanecendo no estado de conexão, com recursos baixados novamente ao trocar de módulo. Site, landing de parceiros e módulos eram servidos sem compressão.
- Entrega estática passa a negociar Brotli/Gzip, reaproveitar conteúdo comprimido por hash e responder 304 para código/estilo inalterados. HTML/revisão/sessões permanecem sem cache; políticas CSP e permissões preservadas.
- Teste HTTP real conferiu descompressão byte a byte, negociação q=0, redução de transferência e 304 sem corpo. Dois testes de transporte/permissões passaram.
- Arquivos: src/static-response.mjs, src/public-experience.mjs, src/server.mjs, test/static-response.test.mjs e docs/CODEX_STATUS.md.

## Recuperação do app e ZIP 0.14.1 — 2026-10-18
- Runtime cai de 2.553.266 para 643.270 bytes na transferência Brotli (75% menor); HTML principal 86% menor e parceiros 69% menor. Arquivos dos módulos recebem URLs com revisão e cache imutável, eliminando a retransmissão ao trocar de aba. Identidade já autenticada pelo shell é reutilizada nos frames; todas as operações seguem validadas pelo backend.
- Falha transitória ao consultar a conta não é mais tratada como logout. App oferece retomar a consulta. Script de módulo indisponível mostra estado recuperável, preservando o menu; estado inicial deixa de dizer Inbox em todos os módulos.
- Sincronização da extensão passa a consultar apenas quando não houve mudança local. Comparação ordena propriedades para tolerar a serialização do Chrome. Rajadas são reunidas: 100 chamadas simultâneas geraram uma gravação e uma leitura, mantendo as alterações. Isolamento entre contas e descarte de resposta antiga preservados.
- ZIP 0.14.1 gerado com manifesto de compatibilidade web e hashes de runtime/estilo validados. Pacote inspecionado contra traversal, corrupção e arquivos sensíveis; arquivo do usuário em outputs/Converte-Call-v0.14.1.zip. Nenhuma credencial alterada.
- Validações: recuperação de conta normal em teste Android (503 e arquivo de módulo abortado), Funil/Inbox/Projetos/Dashboard/Cérebro/Bots após recuperação, jornada Android completa, atualização automática, publicação/ZIP e permissões passaram. Página de parceiros e Funil com cadastros conferidos na sessão real pelo navegador.
- Arquivos: extension/cloud-sync.js, extension/manifest.json, public/employee.html, public/mobile-module.css, public/mobile.js, public/web-bridge.js, src/mobile-release.mjs, src/public-experience.mjs, src/server.mjs, test/cloud-sync.browser.mjs, test/mobile-recovery.browser.mjs, test/static-response.test.mjs e docs/CODEX_STATUS.md.


## Identidade WhatsApp e recuperação de contatos — 2026-10-18
- Conferência na conta real encontrou dois registros chamados Ruan Barone com telefones diferentes; isso não autoriza unir contatos pelo nome. Nenhum cadastro ou histórico foi apagado.
- Webhooks com somente LID passam a registrar o contato e a mensagem, sem inventar telefone. PN/remoteJidAlt/senderPn confirmados vinculam identificadores ao mesmo cadastro; senderPn de envio não identifica o destinatário. Grupos/status continuam excluídos.
- Mensagens enviadas pela conta não copiam pushName do remetente para o cliente. Respostas recebidas atualizam somente nomes automáticos ainda controlados pelo WhatsApp, preservando nomes editados.
- Contexto da extensão normaliza o telefone com o mesmo critério do worker e não usa coincidência de nome quando um número diferente está explícito.
- Recuperação automática limitada a 100 webhooks já concluídos por lote, com progresso persistido e criptografado por workspace. Não consome eventos pendentes ao vivo. Reprocessa mensagens anteriormente descartadas e solicita nova importação de histórico, sem repetir bots. Nome legado só é corrigido com evidência do envio salvo, preservando o nome anterior.
- Sem nova tabela, dependência ou credencial. Metadados compatíveis nos leads: whatsappJids, whatsappNameSource, whatsappPushName, whatsappPreviousName. Progresso na tabela secrets existente. Telefones e identidades de outros workspaces permanecem isolados.
- Limite: sem PN confirmado, o cadastro fica sem telefone; automações de envio aguardam número identificável. Não há inferência por nome nem fusão de números distintos. Confirmação específica da Nara depende de identificar o número e verificar seu evento real após publicação.
- Validação: 55 testes do servidor passaram; regressão direcionada de recuperação/nome e agente HTTP passou após conferir também a evidência criptografada independente da sincronização local.
- Arquivos: src/whatsapp-identity.mjs, src/worker.mjs, src/inbox-context.mjs, test/whatsapp-identity.test.mjs, test/inbox-context.test.mjs e docs/CODEX_STATUS.md. Correção no servidor; ZIP 0.14.1 existente permanece compatível.

- Conferência após a publicação 6e3719a: a conta real passou a mostrar Nara na conversa antes nomeada Ruan Barone, com a mensagem original preservada. O outro número passou ao nome informado pelo WhatsApp. Confirmação independente do número informado pelo usuário ainda não recebida, mas o nome Nara está efetivamente presente no Inbox publicado.
- Inbox agrega os registros visíveis com o mesmo telefone normalizado em uma conversa, incluindo todos os históricos e estado de leitura. Negócios do CRM não são excluídos. Agrupamento ocorre após o filtro de permissões; teste com membro atribuído comprova que mensagens do cadastro não autorizado permanecem inacessíveis. Quando um LID provisório recebe vínculo confirmado ao número já cadastrado, o telefone é preenchido também no registro provisório para agregar a conversa, sem descartar mensagens.
- Arquivo adicional: src/inbox.mjs. Teste adicional de conversa única, históricos reunidos, leitura e isolamento passou.


## Recuperação da extensão e estados de integração — 2026-10-19 UTC
- A mensagem exata relatada pelo usuário pertence ao gate da extensão, não ao shell mobile. Logs recentes mostraram licença e RPC respondendo em milissegundos; não comprovam por si só que a interface saiu do estado de espera.
- Recuperação da conta tem watchdog de 15 segundos para resposta do service worker, nova tentativa explícita e mensagem recuperável. Falha temporária conserva identidade previamente confirmada; somente 401 confirmado remove a identidade da interface. Nenhuma identidade do cache é usada para conceder acesso antes da autenticação real.
- Consultas de licença/refresh têm prazo de rede de 10 segundos. Service worker preserva status HTTP no retorno. Revalidações por foco são reunidas e limitadas a uma por 30 segundos quando a identidade já foi confirmada; retry manual ignora essa janela.
- Integrações têm prazo independente de 8 segundos, estados parciais e indicação de falha na verificação; dados salvos de WhatsApp/IA/Google não são substituídos por desconectado quando há erro de rede. Tela oferece verificar conexões e distingue consulta em andamento, estado confirmado e falha temporária.
- Shell Android deixa de direcionar qualquer erro de módulo para Integrações. Oferece retomar a própria área; link Google Agenda só aparece para falha de configuração dessa agenda. Consulta inicial de licença limitada a 10 segundos.
- Preservados: vault criptografado, refresh real, isolamento entre contas, sincronização prévia no login, permissões, módulos e credenciais. Sem dependências novas.
- Validação: 56 testes de servidor passaram; navegador com extensão instalada em perfil descartável passou por resposta de conta que nunca chega, recuperação via API real, falha temporária mantendo sessão e 401 fechando acesso. Testes de sync entre contas/coalescência, seleção de conversa/perfil e recuperação Android passaram. Tempos de watchdog acelerados apenas no teste. Snapshot de integrações é de teste, não da conta pessoal do usuário.
- Extensão 0.14.2. Arquivos: extension/v9.js, extension/v11.js, extension/release.js, extension/background.js, extension/portal-services.js, extension/services.js, extension/manifest.json, public/mobile.js, test/extension-recovery.browser.mjs, test/integration-state.test.mjs, test/ai-persistence.test.mjs e este documento.


## Cupons no checkout e administrador — 2026-10-19
- Administrador /admin/cupons cria códigos em porcentagem (até 100%) ou valor fixo com moeda BRL/USD/EUR, primeira cobrança ou todas as cobranças, validade e limite total opcionais. Lista, ativação/desativação reversível e auditoria. Não foi criado cupom de produção sem um código/valor solicitado.
- Checkout autenticado permite aplicar/remover código, mostra subtotal, desconto e total. Mudança de plano/equipe/moeda invalida a prévia; o pagamento resolve o cupom novamente no servidor. Código digitado ainda não aplicado é validado antes de seguir. Valores enviados pelo navegador não definem a cobrança.
- Cupons reais são criados na Stripe, limitados ao produto Converte Call; limite de resgates e validade são validados também pelo provedor. Tentativa de criação interrompida retoma com a mesma chave de idempotência e configuração. Código fica pendente até confirmação da Stripe. Permissões insuficientes da chave geram o erro de configuração existente; nenhum segredo é enviado ao frontend.
- Migração 26: billing_coupons(id,code,definition,stripe_id,active,created_by,created_at); coluna coupon_id em billing_pending. Compatível com registros existentes; nenhuma exclusão. Cupons são globais da plataforma, administráveis apenas pelo administrador. Prévia exige sessão de checkout e titular.
- Sessão Stripe recebe discounts[0][coupon]; mudança/remoção do código expira a sessão anterior e gera nonce novo. Não há acúmulo de cupons.
- Webhook continua autenticado e consulta fatura/assinatura na Stripe. Aceita total reduzido apenas com subtotal do catálogo, descontos comprovados e total/amount_paid consistentes. Desconto de 100% também é confirmado pela fatura paga, não pelo redirecionamento. Faturas de valor zero não entram na fila de conciliação de comissões sem pagamento.
- Escopo: contratação de nova assinatura por cartão. A duração forever preserva o desconto nas renovações dessa assinatura. Pix permanece no atendimento manual, separado do cupom e indicado na interface; gestão de assinatura já ativa continua no portal atual.
- Corrigido o retorno do login de um titular que abre /account/assinatura?checkout=1 no computador: segue para checkout antes da restrição do aplicativo desktop; não libera módulos de CRM pelo navegador.
- Validação: 58 testes do servidor aprovados, incluindo autorização, valor/percentual, moeda, código inválido/desativado/expirado/esgotado, troca/remoção de sessão, webhook descontado/zero, idempotência e rejeição de valor menor sem desconto. Browser: cupons no admin/checkout mobile/desktop, checkout/login/planos/equipe/parceiros, escolha de moeda e regressão da Faculdade administrativa passaram. Adaptador Stripe controlado somente nos testes; não houve cobrança ou cupom real de produção para validar.
- Sem dependência nova. Arquivos: src/billing-coupons.mjs, src/billing.mjs, src/server.mjs, public/admin-coupons.js, public/admin.html, public/admin.js, public/admin.css, public/checkout.html, public/checkout.js, public/checkout.css, public/account.js, test/coupon-fixture.mjs, test/billing-coupons.test.mjs, test/billing-coupons.browser.mjs e este documento.


## Entrada mobile, Dashboard Pixel Call, instalação iOS e documentos — 2026-10-19
- Diagnóstico: /account mostrava apenas assinatura/integrações/tracking; era a área de gestão, não o aplicativo completo. Após autenticação real, Android/iPhone/iPad passam da raiz /account para /account/app. Áreas específicas continuam acessíveis, incluindo retorno Google em Integrações e checkout=1 antes de qualquer redirecionamento. Gestão ganha link de retorno ao app.
- Detecção compartilhada de Android, iPhone e iPad (incluindo agente desktop + MacIntel/touch). Módulos preservam as permissões do servidor e da equipe; nenhum funcionário recebe acesso adicional. Restrição desktop à extensão permanece. Instalação iOS orientada pelo Safari, ícone de tela inicial e suporte standalone. Página /ios ligada em download, acesso e rodapé. Gravação iOS orienta captura nativa pela Central de Controle e importação quando o navegador não oferece captura de tela.
- Pixel Call já recebe pageview, click, engagement, video_play/progress/complete, custom e purchase configurados. API existente passa a incluir contagem total de eventos, conversões, vídeos, origens/campanhas e agrupamento por evento nos mesmos 30 dias. Dashboard usa o transporte autenticado pixel-list já existente na extensão e agora suportado no web bridge. Mostra visitas, sessões por site, cliques, tempo ativo, conversões, eventos, páginas, vídeos e campanhas. Consulta com erro é apresentada como erro, não como sucesso com zeros. Compra repetida por orderId segue deduplicada.
- Runtime recompilado e extensão 0.14.3. Upload antigo não pode substituir o runtime mais novo embarcado no servidor nem rebaixar o download público. Upload compatível com versão igual/superior ainda alimenta o app silenciosamente; rascunhos e gravações em andamento continuam protegidos. Sem download de ZIP no celular.
- Rodapés públicos recebem CNPJ 41.374.264/0001-92 e aviso de independência da Meta, Google, TikTok e outras plataformas. Documentos separados: /privacidade, /termos, /assinatura, /cookies e /plataformas. Identificação fornecida pelo usuário: Converte Call, Av. Amazonas, 975, Balneário Remanso, Rio das Ostras – RJ. Sem CEP inventado. Privacidade cobre papéis, finalidades, direitos, integrações, IA, gravações, retenção, segurança e solicitações; assinatura descreve teste de 7 dias sem cartão, renovação, cupons, cancelamento e arrependimento sem renúncia a direitos. Sem alegação de revisão por advogado ou conformidade certificada.
- Referências consultadas: LGPD https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm ; CDC https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm ; instalação web Apple https://support.apple.com/pt-br/guide/iphone/iphea86e5236/ios . Preservadas as condições comerciais e o programa de parceiros já existentes.
- Sem dependência nova, migração de banco, exclusão de dados ou alteração de credenciais. Arquivos não rastreados preexistentes em ui-source/copied-server-source foram preservados fora da entrega.
- Validação: build do runtime e 58 testes de servidor; Android percorreu todos os módulos, Inbox, gravação e isolamento; checkout/planos/equipe/parceiros passou. Novo teste usa conta comum em período de teste (não admin), login Android/iPhone/iPad, Dashboard com eventos recebidos via HTTP real e restrições de funcionário. Números e identidade nas capturas de teste são fixtures, nunca dados alegados da produção. Sem aparelho iPhone físico/Safari real nesta validação: perfis móveis simulados em Chromium.


## Correção urgente: entrada do cadastro — 2026-10-19
- CTAs de teste grátis da landing passam diretamente a /register. Fluxo /download?existing=1 deixa de substituir o destino do botão de criar conta por /access. Página de acesso ganha link explícito de novo cadastro. Login e criação ficam separados. Nenhuma alteração de cadastro, teste ou cobrança no backend.
- Arquivos: public/sales.html, public/download.js, public/access.html, test/signup-entry.browser.mjs e este documento. Validação de navegador cobre CTA inicial, formulário de cadastro, destino do CTA em download existing=1 e link de novo cadastro no acesso.


## Fluxo de venda rápido e recuperação de senha — 2026-10-19
- Site impede a sobreposição do painel de versões antigas da própria extensão nas páginas de venda/cadastro/download/acesso. Não abre modal nem navega sem clique. Cadastro pode ser fechado pelo link Fechar.
- Novo cadastro rápido pede nome, e-mail, WhatsApp, Instagram opcional e senha; sem data de nascimento inventada. Perfil antigo permanece compatível. Após criar a conta segue automaticamente para /download?registered=1; baixar segue para /access?downloaded=1 com instruções de entrada na extensão. Conta já criada não é pedida novamente.
- Mostrar/ocultar senha e link de recuperação nas interfaces web. Redefinição por token aleatório com hash no servidor, validade de 15 minutos e consumo único; altera hash da senha e revoga sessões. Resposta não revela se o e-mail existe. Envio transacional utiliza Gmail autorizado do administrador; sem remetente conectado, informa indisponibilidade e suporte, sem fingir envio.
- Migração 28: password_resets. Teste cobre cadastro rápido sem nascimento, Instagram, link único/expirado e revogação. Browser cobre entrada por CTA, retirada do painel antigo, criação real em banco isolado, download, navegação para acesso e formulário de recuperação.


## Proteções do servidor e distribuições 0.15.0 — 2026-10-19
- Runtime cliente usa somente RPC autenticada. Repositório local e execução local de projetos deixam de entrar no bundle. Extração/aceitação de campos, análise e ações de call executam no servidor, com licença, permissões, workflow salvo e idempotência. Captura continua no dispositivo com consentimento; processamento e credenciais ficam no servidor.
- Sessões web limitadas a 5; gestão /account/seguranca lista e revoga apenas as próprias sessões. Revogação da extensão invalida também dispositivo lembrado. Migração 27 registra eventos mínimos de segurança por 30 dias; sem fingerprint/IP/segredos no registro. IA mantém limites por minuto e recebe teto de 3 operações simultâneas por usuário. Limite simultâneo vale por processo; múltiplas réplicas exigem coordenação compartilhada.
- ZIPs Chrome/Edge/Firefox com minificação complementar, sem fontes TS/TSX, source maps, documentação interna, segredos ou executor comercial local. Sem distribuição compilada, download falha fechado em vez de expor fontes. Nenhuma proteção promete impedir cópia de interface ou reconstrução por IA. Arquivo de servidor é exclusivo do operador.
- Adaptador Firefox MV3, OAuth próprio, página /firefox e aplicativo web desktop/mobile; Edge recebe distribuição própria e /edge com versão consultada dinamicamente. Android/iOS continuam web/PWA e atualização silenciosa, sem baixar ZIP. Sem suporte ao Internet Explorer descontinuado. Firefox unsigned somente para teste: instalação permanente depende de assinatura Mozilla; não publicado como extensão pronta ao cliente.
- Corrigido contrato real de mensagens internas de projetos que retornava 500; lista filtrada ao destinatário/workspace, envio exclusivo do titular e leitura isolada. Não reinsere eventos de protocolo do WhatsApp no Inbox.
- Validação: 61 testes de servidor passaram. Chrome e Edge executáveis reais com pacote minificado, login, módulos e mutação CRM persistida sem 500; Firefox executável real com addon temporário, login e mutação CRM persistida. Lint Firefox: 0 erros, 34 avisos de bibliotecas/templates existentes; requer revisão para marketplace. Browser web variantes, sessões revogáveis, cadastro rápido, checkout, site mobile/carrossel e atualização silenciosa passaram. Aparelhos físicos Android/iOS e assinatura marketplace não validados.
- Sem novas dependências de produção. Fontes preexistentes não rastreadas de integrações foram preservadas fora da entrega. Relação completa de arquivos acompanha o relatório de entrega.


## Página de acesso/download: rolagem e portais — 2026-10-19
- Introdução deixa de usar position:sticky no grid compartilhado de download/acesso; permanecia presa ao container inteiro e avançava sobre a linha do tutorial em vídeo. Agora acompanha a rolagem no próprio espaço.
- Tutorial em vídeo recebe card próprio com espaçamento e limites responsivos. Links auxiliares de acesso organizados em linhas distintas.
- Removida da página /access toda a seção “Acessos pelo site / Administração e parceiros”, incluindo os dois links e informativos. Rotas administrativas e de parceiros permanecem intactas.
- Escopo: public/access.html, public/download.css e este registro. Nenhuma alteração de autenticação, download, backend ou dados.
- Validação: rolagem das páginas /access e /download em 1440, 1024, 768, 390 e 320 px; sem sobreposição da introdução sobre vídeo, sem overflow horizontal e sem links dos portais na página de acesso.
