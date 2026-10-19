# Página pública — garantia, idiomas e prova social

Data: 2026-10-18. Branch: `feat/railway-server`.

- Garantia abaixo das conversas de WhatsApp: sete dias de teste, sem cartão e sem cobrança automática. Composição própria em HTML/CSS baseada na referência GARANTIA.jpg: medidor em zero, sete cards expansíveis e selo de teste grátis. Não anuncia devolução de pagamento.
- Faixa discreta após os botões principais: +26 mil usuários ativos; 4,9 de 5; 2.455 avaliações cinco estrelas; teste de sete dias. Números e qualificação de atividade fornecidos diretamente pelo usuário nesta conversa.
- Bandeiras locais no topo: Brasil (padrão), Estados Unidos, Espanha, China e Japão. Português, inglês, espanhol, mandarim e japonês cobrem a página de vendas, FAQ, cards da call, demonstração de conversas e funil interativo. Nomes de pessoas/marcas são preservados. Seleção persistida no navegador e no parâmetro `lang`; links de acesso/download preservam referências de campanha.
- Traduções locais em JSON, sem chamada a serviços de tradução, sem nova dependência. Rotas públicas adicionais servem apenas esses arquivos estáticos. A aplicação e as páginas de download/acesso não foram traduzidas nesta entrega.
- Sete cenários de navegador passaram: idiomas/garantia/prova social, funil, globo, logos, jornada de download/Android, carrossel e fundo interativo. Conferidos desktop, mobile, toque e preferência de movimento reduzido. O teste de idiomas verifica tradução de todo texto inicial exceto nomes próprios e a prévia de bot após mudar a etapa.
- A demonstração do funil permanece local. Não envia mensagem nem escreve no CRM. Nenhuma alteração nos módulos operacionais, cobrança, autenticação ou ZIP da extensão.

Arquivos: public/sales.html, public/sales.css, public/sales.js, public/sales-i18n.js, public/sales-locales.json, src/public-experience.mjs, test/sales-languages.browser.mjs e este registro.
