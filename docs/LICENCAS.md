# Licenças, teste e liberação manual

## Jornada comercial

1. O cliente chega pelo WhatsApp e recebe o atendimento comercial.
2. O administrador entrega a extensão e o tutorial de instalação. O empacotamento da extensão conectada ainda está pendente; a extensão local 0.8 não é uma distribuição comercial com expiração.
3. Em `/admin`, o administrador emite uma licença de teste. Pode restringi-la a um e-mail.
4. O cliente usa o código em `/activate` ou abre o link de ativação recebido. Cria seu próprio e-mail e senha. Não é solicitado cartão.
5. O servidor consome a licença uma única vez e define vencimento em exatamente 7 × 24 horas após a ativação. Emitir a licença ainda não inicia o prazo. Reinstalação, novo login ou relógio local não mudam a validade do servidor.
6. Depois do pagamento, o administrador seleciona o cliente em `/admin`, escolhe o nome do plano e acrescenta dias ou define uma data/hora de vencimento. Não há cobrança automática nesta implementação.
7. É possível suspender e reativar a assinatura. Reativar uma assinatura vencida não acrescenta tempo: é necessário editar seu vencimento.

Os dias acrescentados contam a partir do maior valor entre o vencimento atual e o horário atual. Os dias de teste restantes são preservados. A data escolhida no painel usa o horário local do administrador e é enviada com fuso horário explícito.

## Administração e segurança

O primeiro usuário do cadastro inicial é o administrador. A migração 2 reconhece a conta inicial criada na versão anterior sem recriar usuários, trocar senhas ou alterar dados de CRM. Não transforma clientes futuros em administradores. O cadastro de clientes exige uma licença emitida pelo administrador; o cliente não escolhe seu papel nem envia uma validade aceita pelo servidor.

Chaves de licença têm entropia criptográfica e são armazenadas somente por SHA-256. O código é apresentado apenas na emissão. Não há recuperação do código original: se ainda não foi utilizado, revogue-o e emita outro. Links de ativação usam fragmento (`#license=...`), removido do histórico antes do envio do formulário. Não publicar códigos em repositórios.

O painel exige sessão administrativa. Clientes recebem HTTP 403 em todas as operações administrativas, mesmo que modifiquem a interface. Uma licença não é um token administrativo. As sessões continuam únicas por usuário e duram até 12 horas.

## Vencimento

O login e a consulta da própria licença continuam disponíveis para mostrar a situação e permitir renovação. As rotas de operação do CRM, WhatsApp, fontes, arquivos e tracking retornam HTTP 402 para clientes sem licença, suspensos ou vencidos. O worker para de executar os projetos e jobs desses clientes. Novos eventos de entrada são marcados como bloqueados e não são reproduzidos automaticamente depois da renovação. Os dados existentes não são apagados pelo vencimento.

O cliente não pode reiniciar o teste no mesmo e-mail com outro código. Uma licença já usada não cria outra conta. Novos e-mails exigem novas licenças deliberadamente emitidas pelo administrador; não há tentativa de identificar dispositivos ou impedir que a mesma pessoa use outro e-mail autorizado.

O código local da extensão ainda não consulta esta licença; logo, o bloqueio demonstrado nesta entrega é do servidor. Concluir o login, sincronização e bloqueio da interface da extensão é necessário antes de distribuir o teste ao público. Não apresentar o ZIP antigo como licença de 7 dias.

## Rotas

- `POST /v1/auth/register`: cadastro com `email`, `password`, `licenseKey`.
- `GET /v1/account/license`: papel e situação da conta autenticada.
- `GET /v1/admin/accounts`: clientes e respectivas validades.
- `GET/POST /v1/admin/licenses`: listagem sem os códigos secretos e emissão de teste de 7 dias.
- `DELETE /v1/admin/licenses/:id`: revogar um convite ainda não ativado.
- `PATCH /v1/admin/accounts/:workspaceId/subscription`: `plan`, `days` ou `expiresAt` e `suspended`.
- `GET /v1/admin/license-audit`: registro de emissão, ativação, revogação e alterações de assinatura.

Tabelas novas: `account_roles`, `subscriptions`, `license_invites`, `license_audit`. Migração aditiva e transacional, sem alterar colunas de usuários existentes. Não há dependência de produção nova.

## Validação

Testes HTTP/SQLite cobrem consumo único, rollback de cadastro inválido, autorização por papel, expiração pelo relógio do servidor, renovação por dias e data, suspensão, persistência após reabertura, migração do dono existente, negação do Pixel vencido e ausência de starvation do worker por contas vencidas. O teste de navegador usa contas locais descartáveis, não credenciais reais, e cobre emissão, ativação, edição, suspensão, reativação e layout móvel.

Este módulo não completa o executor de bots/agentes, o vínculo real do WhatsApp, OAuth, transcrição hospedada ou a distribuição comercial da extensão. Esses pontos continuam separados no status do projeto.
