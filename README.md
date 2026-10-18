# Converte Call — servidor em preparação

Servidor próprio para a extensão Chrome, com deploy na Railway. **Não usar GitHub Actions.** Repositório público: [ruanmeloandrade-alt/converte-call](https://github.com/ruanmeloandrade-alt/converte-call). Código e documentação publicados na branch `feat/railway-server`. API, Evolution, PostgreSQL e Redis online em 18/10/2026. Saúde pública: https://converte-api-production.up.railway.app/health/ready . A Evolution é uma instalação nova e separada. Conta administrativa inicial criada pelo proprietário. A versão 0.10 adiciona cadastro automático de 7 dias sem documentos, Faculdade e suporte; a conexão integral do CRM e o vínculo real do WhatsApp ainda estão pendentes.

## Estado real

Implementado e testado localmente: HTTP, login com senha scrypt, sessão única por usuário, isolamento entre workspaces, persistência SQLite/WAL, CRUD dos módulos no contrato original da extensão, fontes do cérebro, arquivos, fila de eventos, motor de projetos reaproveitado e Pixel Call.

Preparado, ainda sem teste de conexão real: adaptador Evolution com instância exclusiva por conta, QR, status, webhook autenticado e envio de texto. Não toca instâncias da Saúde Slim.

**Não está pronto para produção ou para testar todas as automações.** O despacho de bots/agentes retorna HTTP 503 enquanto o port do executor original é concluído. Jobs sem executor geram falha auditável, nunca sucesso falso. Também faltam upload segmentado das gravações, transcrição hospedada, indexação PDF/DOCX, RAG semântico, OAuth Google/Gmail e ativação/validação da cobrança real Stripe. A busca de conhecimento implementada é lexical, sem embeddings.

## Desenvolvimento

Node 24.15+ da linha 24. Não há dependências de produção externas.

- `npm test`: HTTP real, isolamento, sessão única, persistência após reabertura, CRUD, fontes e eventos do Pixel Call.
- `node --test test/pixel.browser.mjs`: teste de navegador opcional; requer Playwright disponível em `PLAYWRIGHT_MODULE` ou como ferramenta de desenvolvimento.
- `npm start`: requer `ENCRYPTION_KEY` (32 bytes hex), `BOOTSTRAP_TOKEN` (token aleatório) e `DATA_DIR`.

Nunca commitar valores de credenciais, `.env`, dados SQLite ou arquivos de clientes.

## Implantação planejada — sem Actions

1. Repositório público e projeto Railway criados, separados da Saúde Slim. README inicial na main autorizado pelo proprietário; demais alterações na branch de desenvolvimento.
2. Publicar código na branch `feat/railway-server`; não trabalhar diretamente em main.
3. Conectar Railway à branch, build pelo Dockerfile. Não ativar Wait for CI.
4. Montar volume persistente em `/data`, manter **uma réplica**, desativar sleep e configurar healthcheck `/health/ready`.
5. Variáveis: `ENCRYPTION_KEY`, `BOOTSTRAP_TOKEN`, `DATA_DIR=/data`, `PUBLIC_URL`, `EVOLUTION_URL`, `EVOLUTION_API_KEY`. Credenciais apenas nos secrets/variáveis do serviço.
6. Validar domínio HTTPS, saúde, retenção, backup e restauração antes de uso com dados reais.
7. Criar a conta inicial pelo link `/setup#TOKEN`, e entrar pela extensão. O token não fica no histórico/Referer. Uma conta inicial apenas.
8. Importar os dados locais uma vez via endpoint autenticado, com revisão, antes de trocar a extensão para modo remoto.
9. Escanear QR da **nova instância exclusiva do Converte Call**, testar recebimento, deduplicação, parada e envio para um destinatário de teste escolhido pelo proprietário.

Não basta o healthcheck passar: os fluxos de bots, agentes, mídia, OAuth e automação precisam de testes completos antes da liberação.

## Documentação

- [Contratos e limites](docs/ARQUITETURA.md)
- [Pixel Call](docs/PIXEL-CALL.md)
- [Andamento e solicitações](docs/CODEX_STATUS.md)
- [Cadastro de 7 dias e administração de assinaturas](docs/LICENCAS.md)
- [Suporte, Faculdade e idiomas](docs/SUPORTE-FACULDADE.md)
- [Pagamentos Stripe e Pix](docs/PAGAMENTOS.md)
- [Atualizações, credenciais e convite RB Mídia](docs/ATUALIZACOES.md)

Referências oficiais: [Railway autodeploy](https://docs.railway.com/deployments/github-autodeploys), [Evolution OpenAPI v2](https://github.com/evolution-foundation/docs-evolution/blob/main/openapi/openapi-v2.json), [SQLite no Node 24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).

## Código da extensão

extension/ contém a extensão pronta para carregar no Chrome. ui-source/ contém os fontes e o build dos componentes originais reutilizados, sem node_modules. Veja ui-source/REPRODUZIR.txt.

## Pagamentos 0.11
Mensal US$6,98 e Trimestral US$16,58; sem semestral. Pix em português R$29,90/R$67,90 via WhatsApp e confirmação manual em /admin. Código de Checkout/assinaturas/webhooks implementados; configuração Stripe exclusiva do ambiente privado do servidor; ativação e validação com a conta real pendentes da reconexão/credencial Stripe. Ver PAGAMENTOS.md.


### Acessos da versão 0.13

- `/`: página inicial de vendas, sem preços; `/register`: cadastro com sete dias de teste.
- `/account`: conta, checkout externo, Google Agenda/Gmail e gerador/configurador do Pixel Call.
- `/account/inbox?module=inbox`: Inbox original para funcionários autorizados; titular utiliza WhatsApp Web.
- `/admin`: administração, criação de funcionário de teste e publicação de ZIP de atualização.
- `/checkout`: checkout com acesso de uso único gerado pela conta; não aceita pagamento pela conta administrativa.

Atualizações de ZIP exigem `manifest.json` MV3 na raiz, nome Converte Call e versão maior. O arquivo validado fica no volume persistente; `/v1/releases/latest` anuncia a versão. Atualizar a interface não remove vínculos WhatsApp/Google/chaves no servidor.

Pixel Call: instale o código no `head`, configure eventos na conta e use o seletor visual para botões. Compras externas precisam disparar `PixelCall.track('Nome cadastrado', {orderId:'pedido_123', valueMinor:2990, currency:'BRL'})` após confirmação do checkout. Esse evento é analítico, não libera assinatura nem comissão. Vídeo nativo HTML5 tem play/progresso/conclusão; players de terceiros requerem integração própria.

Limitações operacionais atuais: o motor completo de bots/agentes, recursos avançados de mídia no Inbox e saque de parceiros ainda não estão liberados. Teste de contrato não substitui cobrança/consentimento/pareamento reais. SMS permanece pendente. Deploy por conexão da branch Railway; sem GitHub Actions.
