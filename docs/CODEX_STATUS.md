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
