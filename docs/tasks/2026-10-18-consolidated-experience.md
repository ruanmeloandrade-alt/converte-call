# Entrega consolidada — Converte Call

Branch: feat/railway-server. Fonte de cópia somente leitura: ruanmeloandrade-alt/saude-slim, main, 7632a7bc76dbe1e0ef9738eaf5292028b2e0cb6a. Não usar GitHub Actions ou dependências novas de produção.

## Requisitos e andamento
- Em validação: identidade persistente, login único, perfil completo; Pixel independente do WhatsApp; suporte com segmentação; RB Midia compacto; checkout único com entrega/frete/quantidade; faculdade com módulos, edição inline administrativa e comunidade sem links; canvas da call com configuração sob seleção e pan.
- Em implementação: seguir abas com instância ativa única; accordion exclusivo; layout sem scroll duplo; home.
- A implementar e validar: dashboard configurável copiada da fonte; Kanban e automações copiados; públicos e disparo copiados; erro de grupos; mídia no servidor por 48h com transcrição e análise preservadas e TXT no PC; provedores OpenAI/Gemini/Anthropic; QR WhatsApp com sincronização automática; Google Agenda/Gmail e instruções para autorizações externas.
- Preservar cérebro, funil, automações e construtores aprovados, calendário aprovado, conta administrativa, preços US$6,98 / US$16,58 e Pix R$29,90 / R$67,90. SMS permanece pendente por decisão do usuário.
- Entregar um pacote consolidado, sem chamar funcionalidades incompletas de prontas.

## Evidências atuais
- node --test test/experience.test.mjs: PASS identidade, perfil criptografado, telefone, suporte grátis/pago, Pixel sem WhatsApp, admin/aluno, fóruns e proibição de links.
- node --test test/experience.browser.mjs: PASS Chrome real para identidade sem botões de login, perfil, treinamento, publicação, suporte e canvas. Transporte de teste HTTP local, não valida serviços externos.
- Nenhum deploy desta entrega foi feito ainda.

## Limites externos já conhecidos
Stripe ainda sem credenciais reais e conector requer reautenticação. OAuth Google precisa de cliente próprio deste produto e consentimento. Não reutilizar segredos da Saúde Slim. Não criar contas ou cobranças de teste em produção.


## Equipe — definição aprovada e incremento atual
- Aprovado: limite 7 pessoas incluindo titular; US$1/funcionário/mês ou US$3/trimestre; Pix R$5/mês ou R$15/trimestre. Não existem pacotes fixos 3/5/10.
- Implementado localmente: catálogo compartilhado, seletor +/- de pessoas com totais, checkout com item base e funcionários, confirmação Pix com quantidade e total, concessão após confirmação, convites individuais com permissões, página de aceitação, revogação ao reduzir capacidade.
- PASS local: testes HTTP de cobrança/equipe/convites e Chrome com contador e totais. Sem cobrança real. Conector Stripe permanece sem reautenticação; não publicado/deployado.
- Ainda necessário antes de vender Equipe: Inbox original adaptado ao transporte remoto, alteração de quantidade em assinatura ativa, validação ponta a ponta em ambiente Stripe isolado.
- Google: projeto próprio numeric-habitat-512016-c3; suporte autorizado ruan.melo.andrade@gmail.com; política de dados aceita mediante confirmação explícita. Branding OAuth concluído; cliente OAuth ainda em preparação.
- Dependências de produção autorizadas explicitamente: recharts, @radix-ui/react-accordion, @radix-ui/react-label, html-to-image. Nenhuma outra foi adicionada.


## Conexões externas verificadas nesta continuação
- Stripe MCP reconectado; usuário confirmou conta recebedora MKTON, acct_1TnS0nGR5Qi9qGC4, produção. Somente STRIPE_ACCOUNT_ID foi salvo no ambiente Railway sem redeploy. Chave de API restrita do servidor ainda não criada/configurada; painel Stripe aguarda login no navegador lateral. Nenhuma cobrança real executada.
- Google OAuth criado com retornos Railway e convertecall.pro. Credenciais GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET salvas somente no serviço privado Railway, sem redeploy; nenhum segredo salvo em arquivo do repositório. Calendar e Gmail APIs ativadas mediante aceite explícito dos termos. Aplicativo ainda em Testing; validação real e verificação pública do Google pendentes.
- Usuário comprou convertecall.pro na Hostinger. Custom domain criado na Railway (porta8080). Exige ALIAS/CNAME raiz para mdq49kxy.up.railway.app e TXT _railway-verify para propriedade. Domínio ainda não declarado ativo: configuração DNS/SSL em andamento.
- Proteção adicional de sincronização: request carrega X-Workspace-Id, servidor rejeita sessão de outra workspace; cache local identifica userId e workspaceId. Dados anteriores são copiados para backup local antes de trocar conta, evitando importar dados de outro usuário. Regressão específica de cache ainda pendente.
