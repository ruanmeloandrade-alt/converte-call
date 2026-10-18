# Atualizações, credenciais e RB Mídia — 0.12.0

## Menu
O indicador aparece abaixo do grupo Conta. Verde: a versão instalada corresponde à publicada (ou é mais recente em desenvolvimento). Vermelho: o servidor publicou uma versão maior; aparece Baixe a versão atualizada. Falha/rede indisponível: estado neutro e Verificar novamente. Há consulta ao abrir/focar e a cada cinco minutos com a interface aberta. A comparação é numérica (0.12 > 0.9), não textual. O indicador refere-se à interface instalada; atualizações exclusivas do servidor não precisam forçar download de interface.

GET /v1/releases/latest é público, não revela conta/credenciais e retorna a versão real do manifest, URL HTTPS e SHA256 do ZIP. /downloads/Converte-Call-v<VERSAO>.zip entrega um arquivo real gerado no servidor com módulos nativos, timestamps fixos, UTF-8 e CRC32. A imagem Docker inclui extension/. Nenhum serviço de hospedagem pago novo ou GitHub Actions foi adicionado.

O Chrome não instala automaticamente um ZIP carregado manualmente. O botão baixa o pacote. O usuário extrai/sobrescreve a MESMA pasta já carregada e usa Recarregar em chrome://extensions; depois atualiza as abas abertas. Não remover a extensão nem trocar o caminho/ID ou limpar os dados. As gravações em andamento devem terminar antes de recarregar. O status começa a existir nesta versão 0.12: versões anteriores precisam receber este pacote primeiro. A publicação futura exige aumentar a versão do manifest, publicar e verificar ZIP/metadados antes de anunciar.

## Preservação
Atualizar não chama logout, exclusão de credenciais, limpeza de workspace, criação de usuário ou reset de conexão WhatsApp. As instâncias/credenciais Evolution já são persistidas no servidor e volumes existentes; esta versão não reinicia nem recria instâncias. Revogação pelo próprio WhatsApp/provedor ainda pode exigir autorização nova, independentemente de atualização.

Encontrada limitação da versão anterior: tokens e API key estavam apenas em chrome.storage.session, que é temporário. Agora ccAccountToken/ccRefreshToken/ccOpenAIKey/ccGatewayToken ficam também cifrados com AES-GCM no storage.local; a chave CryptoKey não extraível é persistida no IndexedDB da origem da extensão, nunca dentro do workspace/exportações. O contexto do gravador usa o mesmo cofre. Sessões antigas ainda disponíveis são migradas ao serem lidas. Um segredo que já foi perdido pelo armazenamento temporário anterior não pode ser recuperado por esta migração.

O login da extensão pede rememberDevice. O servidor emite credencial de dispositivo aleatória, guarda apenas hash, validade de 90 dias renovada pelo uso e refaz a sessão curta de 12 horas automaticamente. Migração aditiva6: device_sessions. Sobrevive a reinício do servidor; logout ou novo login que substitua a sessão revoga o dispositivo anterior, mantendo a regra de acesso único. Um primeiro login pode ser necessário ao migrar de uma versão antiga sem credencial persistente. As configurações das integrações não são apagadas por isso. A chave OpenAI é sincronizada também ao cofre cifrado do servidor ao salvar/logar com conta ativa; se offline/não autenticado, o cofre local a preserva. Remover chave é ação explícita e apaga a cópia remota quando conectado. Logout explícito limpa credenciais locais sensíveis; não é uma ação de atualização. Troca de conta limpa chave/gateway da conta anterior.

Limites anteriores preservados: gateway integral/CRM remoto ainda não concluídos; não afirmar que todos os dados locais já migraram para nuvem. O mecanismo do gateway legado e OAuth Google não foram substituídos. As conexões existentes não foram revogadas, e o cadastro OAuth real continua pendente. Não existe garantia de reconexão sem autenticação após revogação, troca de perfil/ID ou limpeza de dados do Chrome.

## RB Mídia
Convite no rodapé do menu, no local marcado no print. Logo fornecida em PNG foi copiada sem edição e sem fundo adicional na imagem; identidade Converte Call preservada. Contato adotado: WhatsApp 5522992888971, o mesmo informado anteriormente para o negócio. O clique busca a situação REAL da conta no servidor (não usa seleção local de plano): trial, vencida, suspensa ou sem licença usa grupo grátis; assinatura paga ativa usa grupo paga. Administrador tem acesso integral e usa grupo paga. Sem login/rede não classificamos arbitrariamente: pede acesso ou exibe erro.

Textos exatos, sem aspas:
#CC-cG | Olá, vim da Converte Call e preciso de ajuda com o meu Marketing
#CC-cP | Olá, vim da Converte Call e preciso de ajuda com o meu Marketing

A URL abre uma conversa pronta; não envia mensagem automaticamente. O endpoint autenticado é GET /v1/account/marketing-link. Não altera licença e não realiza disparos.

## Verificação
13 testes nativos passaram, incluindo ZIP real, hash/manifest/assets, renovação de acesso, persistência após reabrir SQLite, revogação e autorização. Chrome real: menu, estado atual/desatualizado, frases de conta grátis/paga após pagamento local; cofre testado após reiniciar o processo do Chrome, chave não exportável e ausência de texto puro no storage.local. Testes usam contas descartáveis locais, sem mensagens/pagamentos/credenciais reais. Não há gravação real nova ou teste de QR/Evolution nesta entrega.
