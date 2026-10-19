# Cadastro, instalação, entrada e publicação

O cadastro rápido mantém a rota da landing page e o formulário em modal. O telefone tem código de país separado (padrão +55) e número nacional com DDD. O cliente compõe o número internacional uma única vez; o servidor mantém a validação existente e a unicidade do telefone. O formulário /register usa o mesmo componente de composição. O API antigo que recebe o telefone completo continua compatível.

A etapa 02 (/download) reúne Chrome, Microsoft Edge, Mozilla Firefox, Android, iPhone e iPad no topo. Chrome é o padrão; a escolha explícita pode ser mantida por query platform. Chrome e Edge baixam somente o ZIP selecionado pela publicação do administrador. Firefox usa o aplicativo web; iPhone/iPad usam o fluxo do Safari. Não é oferecida como pronta uma extensão Firefox sem assinatura.

Após o cadastro e o download concluído, a etapa 03 continua em /access, preservando a plataforma. Ela usa a mesma identidade da instalação, destaca o player do tutorial no topo e coloca o guia ilustrado abaixo. Não contém CTA duplicada para baixar. O tutorial continua configurável em public/access-tutorial.json, com carregamento do YouTube apenas por clique. Nenhuma URL de vídeo foi inventada.

## Publicação exclusiva pelo administrador

latestRelease deixou de escolher um pacote do build quando não há publicação ou quando o build é mais novo. A versão pública é exatamente a registrada em extension_releases pelo upload autenticado do administrador. Sem registro, /download/info retorna published:false e nenhuma versão/URL; a interface informa indisponibilidade e o arquivo direto responde 503. Chrome e Edge recebem os mesmos bytes do ZIP publicado, com nome de download apropriado. Um deploy não passa a publicar pacotes.

O aplicativo web fixa a base já servida em data/mobile-runtime-baseline.json (conteúdo e SHA-256 de runtime/estilos e semente de revisão), criada uma única vez. Isso preserva os módulos existentes entre deploys. Somente um ZIP publicado pelo administrador, com marcador web compatível e hashes válidos, substitui esses módulos. O número do build não sobrepõe uma versão escolhida pelo administrador. Não há migração de dados de clientes nem alteração de permissões, autenticação ou credenciais.

A base é pública (somente código do aplicativo), sem segredos, e deve permanecer junto do volume persistente do servidor. Os testes usam contas e publicações isoladas em diretórios temporários; não são uploads na conta de produção.
