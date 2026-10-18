# Publicação autorizada

Destino solicitado: repositório público `ruanmeloandrade-alt/converte-call`. O proprietário poderá mudar a visibilidade depois. Nenhuma credencial pode entrar no repositório ou no histórico Git.

## Distribuição dos componentes

- GitHub: código do servidor, código/pacote da extensão e documentação. Conteúdo estático de ajuda pode ser servido por GitHub Pages usando uma branch, sem Actions.
- Hospedagem com processo persistente: API autenticada, webhook, worker, Evolution e banco/cache da Evolution. Esses processos não são executados pelo GitHub Pages.
- Vídeos, arquivos, dados de clientes, sessões de WhatsApp e banco nunca entram no GitHub.

## Escolha de hospedagem em aberto

O usuário citou Heroku nesta mensagem; o acesso verificado antes era Railway. A confirmação foi solicitada para não criar recursos no provedor errado. A instalação WhatsApp será nova e separada. Não presumir instalação anterior com nome de fabricante.

O projeto local usa SQLite em volume persistente e uma réplica. Se a opção for Heroku, adaptar persistência para banco gerenciado e storage externo antes do deploy: o filesystem de dynos não é armazenamento persistente.

O plano de recursos e estimativa de custo devem refletir API/worker, Evolution, banco e cache. Recursos gratuitos de código não equivalem a hospedagem gratuita desses serviços 24 horas.

## Situação do acesso GitHub

Conector conectado para operações em repositórios existentes; ferramenta de criação de repositório não está disponível. GitHub CLI sem autenticação. A criação foi aberta no navegador integrado, que solicitou login. Nenhum token foi extraído do navegador e nenhuma senha foi solicitada no chat.

## Publicação sem Actions

Trabalho na branch `feat/railway-server`. Não criar `.github/workflows`. Usar Dockerfile e ligação direta do host ao repositório/branch, ou deploy nativo da plataforma. Validar saúde, persistência e os fluxos funcionais antes de chamar a implantação de pronta.

## Base Evolution verificada
Release oficial consultado: 2.3.7 (https://github.com/evolution-foundation/evolution-api/releases/tag/2.3.7). O schema de webhook desta versão exige o objeto webhook com enabled, url, byEvents, base64 e events. Configuração conferida no código-fonte oficial, sem usar credenciais de exemplo. A imagem deve ser fixada por versão e validada antes do provisionamento.

Repositório público criado e verificado: https://github.com/ruanmeloandrade-alt/converte-call . Aguardando autorização do commit inicial e escolha do host para seguir.

## Provedor confirmado
O usuário confirmou Railway. O projeto Converte Call foi criado e quatro serviços/volumes/configurações foram deixados em staged, sem execução. Heroku foi descartado. Veja railway-deployment.json e CUSTOS.md. A inicialização da branch remota continua dependendo da confirmação do README inicial solicitada por causa do AGENTS.md.
