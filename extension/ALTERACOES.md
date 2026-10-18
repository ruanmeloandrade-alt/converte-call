# Alterações — 0.11.0

- Planos em USD: Mensal US$6,98, Trimestral US$16,58; removida oferta semestral.
- Links Pix discretos somente em português, com as duas mensagens exatas.
- Novo fluxo de Checkout/portal autenticados pelo servidor; chaves ficam somente no servidor.
- Administrador: conectar Stripe e confirmar Pix recebido com plano, validade e auditoria.
- Webhooks: assinatura, deduplicação e verificação de fatura antes de conceder acesso.
- Ativação da Stripe real pendente da conexão/credencial da conta. Não houve cobrança real no teste.

# Alterações — 0.10.0

- Conta: 7 dias grátis sem convite/documento; e-mail e ambos os telefones únicos, com telefones somente numéricos.
- Idiomas: preferência persistente e catálogo local para menus/comandos em português, inglês, espanhol, mandarim, japonês, francês, alemão e italiano. Conteúdos e construtores legados preservados.
- v9.js/v9.css: Faculdade acima de Integrações, Suporte abaixo de Notificações, player YouTube e FAQ com indicação de IA/guia.
- portal-services.js: conta autenticada para Faculdade e suporte, token apenas em sessão, emissor de mensagem restrito às páginas da extensão.
- background.js/internal-config.js: conexão da conta separada do gateway integral do CRM, preservando a operação local anterior.
- panel.html/manifest.json: novos recursos, versão 0.10 e frame-src restrito ao YouTube sem cookies.
- Documentação e testes correspondentes no repositório.

Nenhum módulo aprovado de Inbox, funil, cérebro, bots, agente, projetos ou gravação foi redesenhado. O executor remoto de bots/agentes e a sincronização integral continuam pendentes.
