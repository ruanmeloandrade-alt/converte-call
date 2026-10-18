# Suporte e Faculdade — 0.10.0

## Menu e acesso

Em Conta, Faculdade aparece imediatamente acima de Integrações. Suporte aparece imediatamente abaixo de Notificações. A extensão usa um transporte autenticado da conta, sem ativar prematuramente a sincronização integral do CRM. Desde 0.12, tokens ficam em cofre cifrado persistente e cache de sessão; não entram em exportações de dados. Detalhes em ATUALIZACOES.md.

O suporte humano abre https://wa.me/5522992888971, correspondente a (22) 99288-8971. O clique abre uma conversa; não envia mensagens automaticamente.

## FAQ inteligente

O usuário escreve uma pergunta. O servidor usa exclusivamente o guia técnico do Converte Call, sem enviar a ficha, documento, contatos ou conversas comerciais como contexto. Se a chave OpenAI e o modelo estiverem configurados, o transporte autenticado sincroniza a chave para o cofre cifrado da conta e o servidor usa a Responses API com store:false e sem ferramentas. A resposta é marcada como IA. Não usar o cérebro comercial do cliente como base do suporte do produto.

Sem chave/modelo, ou com assinatura vencida, a resposta vem da busca no guia e é marcada como Resposta do guia. Não é apresentada como IA. Erro do provedor gera erro explícito; não há sucesso simulado. As perguntas e respostas concluídas ficam cifradas no banco, por workspace. Há limite de dez perguntas por minuto por usuário. Os testes do provedor usam um retorno controlado; uma chamada paga real não foi executada.

O guia descreve somente recursos e limitações verificados. Usuários são orientados a não colocar senhas, documentos ou chaves na pergunta. Uma pergunta digitada pelo usuário é enviada ao provedor quando usa o modo IA; o guia não significa que textos pessoais digitados serão removidos automaticamente.

## Faculdade

O administrador cadastra, edita, publica/despublica e exclui aulas em /admin. Campos: título, descrição, categoria, ordem, link YouTube e publicação. O servidor extrai um ID de vídeo de onze caracteres e aceita somente HTTPS nos hosts oficiais do YouTube; não faz download ou requisição para URLs fornecidas pelo usuário.

Usuários comuns veem apenas aulas publicadas e só podem assistir e marcar conclusão. Essas permissões são exigidas na API, não apenas nos botões. O progresso é separado por usuário. A exclusão é lógica e preserva registros de conclusão. A reprodução usa youtube-nocookie.com; há um botão opcional para abrir no YouTube quando o autor não permitir incorporação. Não foram cadastradas aulas de demonstração em produção.

Migração aditiva 4: academy_lessons, academy_progress, support_questions.

Rotas: GET /v1/academy; PUT /v1/academy/:id/progress; GET/POST /v1/admin/academy; PUT/DELETE /v1/admin/academy/:id; GET /v1/support; POST /v1/support/ask; GET /v1/account/profile.

Documentação OpenAI usada: https://developers.openai.com/api/docs/guides/text

## Idiomas
Configurações > Idioma da interface oferece pt-BR, pt-PT, en, es, zh-CN, ja, fr, de e it. Preferência por navegador em chrome.storage.local.ccLanguage, sincronizada entre páginas abertas da extensão; não muda mensagens, notas, modelos ou cadastros. Catálogo embarcado, sem rede ou dependências. Menus e comandos traduzidos; textos explicativos e construtores legados ainda têm cobertura parcial. pt-PT usa o catálogo português compartilhado. Datas/dados existentes mantêm sua representação original; não há tradução automática de todo o conteúdo.
