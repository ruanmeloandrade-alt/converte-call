# Arquivos alterados — 0.8.0

- `content.js`: remove logo no Inbox; ancora Tags ao texto WhatsApp; ancora Perfil e Funil/etapa ao nome do contato; mantém compositor e funções de atendimento.
- `slim/runtime.js`, `slim/source-manifest.json`, `slim/rpc-contract.json`: recompilação do adaptador original. Uma seleção por etapa com o mesmo callback de seleção e ações em massa.
- `slim/runtime.css`: bordas e campos suaves restritos à página Cérebro IA.
- `v8.js`, `v8.css`: área Pixel Call no Tracking, cadastro de site e cópia de código, métricas consultadas do servidor.
- `services.js`: transporte autenticado para cadastro/consulta dos pixels, sem dados simulados.
- `panel.html`, `manifest.json`: novos recursos e versão.
- `LEIA-ME.txt`, `VALIDACAO.md`, `INTEGRACAO.md`: estado real e contratos.
- Fontes de build: `slim-runtime/build.mjs` e `styles.css`. Nenhuma fonte canônica da Saúde Slim foi editada.

## Servidor em preparação, ainda sem deploy

`converte-call-server/src/{server,database,security,evolution,assets,brain,worker,rpc,pixel}.mjs`, `public/setup.*`, `vendor/*`, `test/*`, `Dockerfile`, `railway.json`, `package.json` e `docs/*`.
O código local está em feat/railway-server. Publicação/documentação no GitHub pendentes da confirmação do repositório. O executor completo de bots/agentes ainda falta; não há sucesso simulado.
