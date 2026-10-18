# Validação — 0.12.0

13 testes nativos passaram. Chrome real: menu/atualizações/RB Mídia e persistência do cofre após reiniciar Chrome; CryptoKey não extraível. ZIP real foi descompactado nos testes e comparado ao manifest/hash; conta grátis/paga verificadas contra API local real, sem envio de mensagens. Nenhum QR ou pagamento real nesta entrega.

# Validação — 0.11.0

12 testes nativos passaram, incluindo preços/Pix, permissões, recebimento/idempotência, webhook assinado, fatura paga, renovação falha, cancelamento/portal e nova assinatura. Dois testes de Chrome passaram, incluindo liberação manual Pix e mensagens exatas; Pix não aparece em inglês. Stripe foi substituída por respostas controladas SOMENTE NOS TESTES. A implementação de produção faz requisições reais, sem simular sucesso quando desconectada. Conta Stripe exige reconexão/credencial; pagamento real/sandbox real não validados.

# Validação — 0.10.0

Dez testes nativos passaram: HTTP/SQLite, telefones numéricos, unicidade de e-mail e dos dois telefones, perfil cifrado, teste automático de 7 dias, permissões, vencimento, assinatura manual, Faculdade, progresso por usuário, FAQ/contrato da IA e transporte da conta da extensão.

Navegador: cadastro direto, assinatura e CRUD de aulas pelo administrador; navegação real da extensão Chrome, posições dos menus, player incorporado e conclusão, FAQ com backend local real por transporte de teste. O destino do suporte foi verificado pela chamada chrome.tabs.create com a URL exata, sem abrir contato real.

Os vídeos de teste e as contas eram locais e descartáveis. Reprodução real de vídeo no YouTube, chamada paga da IA, login da conta real na extensão e mensagens de WhatsApp não foram validados. Não há dados fictícios publicados em produção.

O controle do servidor não representa bloqueio completo dos módulos locais. O executor dos bots/agentes continua pendente, assim como a sincronização integral do CRM.

Idioma: teste real no Chrome troca português, inglês, espanhol, mandarim, japonês, francês, alemão e italiano; verifica persistência após recarregar e preservação de título de projeto. Cobertura inicial do catálogo é de menus/comandos, não tradução integral dos construtores legados ou dos textos de ajuda.
