# Pixel Call

O cliente cadastra o endereço do site em Tracking e recebe um script para o head. Cada origem (domínio/subdomínio/protocolo/porta) tem seu próprio pixel.

O código registra pageview, cliques em links/botões e batimentos de tempo ativo. O tempo acumula somente quando a página está visível e com foco. UTMs aceitas: source, medium, campaign, content, term. Query strings gerais são descartadas para evitar capturar e-mail ou outros dados de URL. Referrer guarda apenas origem/caminho.

O identificador de sessão fica no sessionStorage da própria origem; não faz fingerprint nem identifica o visitante como cliente do CRM. Não lê campos de formulário, senhas, conteúdo de mensagens ou texto arbitrário da página. Para nomear um clique use `data-call-label="comprar"`. `window.PixelCall.track("nome_evento")` registra um evento próprio sem propriedades pessoais.

O script respeita Do Not Track. Se o site usa consentimento, carregue o script apenas depois da autorização definida pelo próprio site. Nenhum consentimento é presumido pela extensão.

O identificador do pixel é público e não serve como credencial administrativa. A ingestão verifica origem cadastrada, tamanho, frequência e IDs de eventos para deduplicar. Isso reduz abuso acidental; código público não autentica um navegador contra um atacante que forja HTTP. Ações de CRM não são autorizadas por eventos públicos do pixel.

Dados iniciais: visitas, sessões, cliques, tempo ativo total e páginas. Não confundir sessões com visitantes únicos nem tempo total com média. Nesta etapa não há associação automática de visitante anônimo a lead, crawler, histórico SPA completo ou atribuição de vendas sem identificação.

Testes locais passaram para carregamento do script real, beacon, cliques rotulados, UTMs, exclusão de query sensível, tempo ativo, isolamento entre contas e deduplicação. Instalação em site público depende do domínio final do servidor, ainda não criado.
