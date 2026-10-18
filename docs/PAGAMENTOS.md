# Pagamentos — Converte Call 0.11.0

## Planos atuais
| Plano | Stripe recorrente, USD | Pix manual, BRL | Período |
| --- | --- | --- | --- |
| Mensal | US$6,98 (698 centavos) | R$29,90 (2990 centavos) | 1 mês |
| Trimestral | US$16,58 (1658 centavos) | R$67,90 (6790 centavos) | 3 meses |

Semestral removido da oferta e dos seletores de plano. Assinaturas/registros históricos existentes não são apagados. O trial da conta permanece 7 dias sem cartão; contratar Stripe inicia a cobrança imediatamente, sem criar outro trial. USD é fixo; Adaptive Pricing fica desativado.

## Pix
Apenas com idioma pt-BR ou pt-PT a extensão mostra, discretamente, Quero pagar no pix em cada plano. O clique abre https://wa.me/5522992888971 com o texto correspondente, codificado em URL, sem enviar a mensagem automaticamente:

Mensal:
#PIXm-bR | ☝😎Olá, quero fazer o pagamento do Plano Mensal no pix! Valor -> *R$29,90*💜

Trimestral:
#PIXt-bR | ☝😎Olá, quero fazer o pagamento do Plano Trimestral no pix!Valor -> *R$67,90*💜

Em /admin > Seus clientes > Confirmar Pix, selecione o cliente/plano e confirme que recebeu. Registra valor/moeda/plano, auditoria e validade; não verifica o pagamento no banco. A concessão usa meses de calendário, com ajuste no último dia do mês. Plano pago vigente soma o período ao vencimento atual; teste/vencido inicia agora. Por ser confirmação explícita do administrador, reativa o acesso suspenso. Uma nova confirmação com outro ID é outro pagamento; repetir o mesmo ID não duplica a concessão. A edição manual por dias/data continua disponível.

Para migrar de Stripe a Pix, cancele primeiro a renovação no portal Stripe, evitando que o cliente continue sendo cobrado. Confirmação manual é bloqueada enquanto houver renovação Stripe ativa sem cancelamento programado.

## Conectar a Stripe
A conexão do app Stripe no Codex respondeu UNAUTHORIZED/requires reauthentication nesta execução. Não foi possível selecionar uma conta nem provisionar recursos reais pelo app. Nenhum pagamento, chave, produto ou conta de teste foi criado na Stripe real.

A versão 0.11.1 removeu o formulário de chave e bloqueou POST /v1/admin/billing com HTTP410, inclusive para o administrador. Configuração somente pelo ambiente privado do servidor: STRIPE_API_KEY e STRIPE_ACCOUNT_ID. Não inserir chaves no chat, na extensão ou no painel público. O provisionamento interno verifica que a chave pertence exatamente ao account ID fixado e não permite substituir uma conta já configurada por outra. Na inicialização, cria os recursos necessários de forma idempotente e cifrada. A conta live precisa estar habilitada para receber pagamentos; testes devem usar ambiente isolado. A autorização do app Stripe no Codex serve para operar a conta, mas não fornece automaticamente credenciais ao processo Railway. A ativação real continua pendente de autenticação/credencial interna.

Permissões necessárias à chave: leitura da própria conta; criação de produtos/preços/clientes; criação/leitura/expiração de Checkout Sessions; leitura de assinaturas e faturas; criação de webhook endpoints; criação de configurações e sessões do Billing Portal. Prefira chave rk_ com somente esses acessos. A configuração é cifrada no cofre do administrador no SQLite persistente. Chave e segredo do webhook nunca são retornados pelas APIs ou incluídos na extensão/GitHub. Não adicionamos dependências de produção, Actions ou .env.

A configuração salva os IDs a cada etapa para permitir retomar uma falha. Retentar criação usa idempotência. Nenhuma outra integração/instância da Saúde Slim é tocada.

## Confirmação automática
Checkout autenticado recebe somente monthly/quarterly e idioma; preços e conta são definidos pelo servidor. Associa cliente Stripe ao workspace, impede uma segunda assinatura ativa e reutiliza checkout pendente. Chaves de idempotência estabilizam as criações. Assinatura cancelada de fato pode contratar novamente.

Webhook POST /v1/hooks/stripe exige Stripe-Signature sobre corpo bruto, HMAC-SHA256, janela de 5 minutos e ambiente correspondente. Reconsulta Checkout, assinatura e fatura na Stripe; confere cliente, workspace, preço, quantidade, moeda, valor pago e período. Somente fatura paga libera prazo; página /billing/success não concede acesso. Deduplica eventos e faturas em transação. Pagamento falho não renova; cancelamento mantém o período já pago; suspensão administrativa é preservada em confirmação automática. O portal permite consultar faturas, atualizar pagamento e cancelar no fim do período. Não implementamos troca de plano/prorrata automática ou tratamento de disputas/reembolsos neste recorte.

Eventos: checkout.session.completed, checkout.session.async_payment_succeeded, invoice.paid, invoice.payment_failed, customer.subscription.created/updated/deleted. O preço precisa corresponder ao catálogo sem descontos/tributos adicionais; mudanças manuais de preços na Stripe exigem ajustar a integração. Stripe Tax não foi ativado: antes de cobrar tributos internacionais, configure os registros tributários e adapte a conferência de totais; não há cálculo automático de impostos nesta entrega.

Migração 5 aditiva: billing_customers, billing_subscriptions, billing_pending, billing_events e billing_payments. Usuários/senhas/dados do CRM e trials anteriores preservados.

## Validação
12 testes nativos passaram; os testes de cobrança usam HTTP/SQLite reais e respostas Stripe controladas. Não representam um pagamento real aprovado. Cobrem isolamento/permissões, Pix mensal/trimestral e deduplicação, datas, preços fixos, assinatura de webhook, ambiente/timestamp, liberação após confirmação, falha de renovação, portal e nova assinatura após cancelamento. Dois testes no Chrome passaram: cadastro/admin/Pix e extensão com mensagens exatas, preços e ocultação de Pix em inglês. Não foram criados registros falsos no banco público.

A proteção integral dos módulos locais, sincronização completa do CRM e executor de bots/agentes seguem pendentes. Esta entrega de pagamento não resolve essas pendências.

Referências oficiais: https://docs.stripe.com/api/checkout/sessions/create , https://docs.stripe.com/api/prices/create , https://docs.stripe.com/api/webhook_endpoints/create , https://docs.stripe.com/billing/subscriptions/webhooks , https://docs.stripe.com/events/manage-webhook-endpoints .

## Segurança 0.11.1
Mesmo uma sessão administrativa não pode inserir/trocar a chave pela API. Testes verificam HTTP410 e rejeição de chave de outra conta antes de gravar qualquer configuração. Essa medida impede a troca do recebedor por essa superfície; não representa proteção contra comprometimento do próprio servidor/ambiente privado. Login/pagamentos/cliente inicial foram preservados.


## Converte Call Equipe — preços confirmados em 18-10-2026
O titular está incluído no plano. O seletor varia de 1 a 7 pessoas no total (0 a 6 funcionários adicionais). Atualização do escopo: cada funcionário custa US$1,50 no mensal ou US$4,50 no trimestral; no Pix, R$5 no mensal ou R$15 no trimestral.

| Pessoas no total | Mensal USD | Trimestral USD | Mensal Pix BRL | Trimestral Pix BRL |
| --- | --- | --- | --- | --- |
| 1 | 6,98 | 16,58 | 29,90 | 67,90 |
| 2 | 8,48 | 21,08 | 34,90 | 82,90 |
| 7 | 15,98 | 43,58 | 59,90 | 157,90 |

O preço vem do catálogo compartilhado `vendor/billing-catalog.js` / `extension/billing-catalog.js`. O cliente informa somente plano e quantidade; o servidor valida inteiro de 1 a 7 e calcula o valor. Checkout usa um item base e um preço recorrente por funcionário, com o mesmo período do plano. O provisionamento idempotente cria dois novos preços de Equipe sem substituir os preços individuais existentes.

Abertura ou retorno do Checkout não concede funcionários. A concessão usa fatura paga, assinatura/cliente/preços/quantidades e período reconsultados no provedor. Recibos Pix exigem confirmação administrativa, registram o total e a quantidade contratada e não podem ser reutilizados com outra quantidade. O painel de confirmação exibe o total antes de salvar. Mensagens individuais de Pix foram preservadas; com Equipe, mostram o total e a composição da equipe.

Renovação conserva convites pendentes dentro da capacidade. Redução paga desativa funcionários excedentes, revoga suas sessões e remove convites excedentes; conserva o titular. O mesmo recibo ou fatura não duplica prazo/acessos. Fatura antiga não reduz os acessos de um período posterior já pago.

Validação local: `test/billing.test.mjs`, `test/team-billing.test.mjs`, `test/teams.test.mjs` e `test/experience.browser.mjs`. Provedor Stripe nas provas de contrato é um adaptador de teste isolado, não uma cobrança real. A conexão Stripe real, atualização de quantidade de assinatura já ativa e Inbox original de funcionários ainda precisam de conclusão/validação antes de anunciar Equipe comercialmente disponível. Não houve publicação desta alteração ainda.

Revisão de preço Equipe: lookup/idempotência dos novos preços usam `0150-v1`. Não atualiza assinaturas já contratadas; qualquer migração de preço vigente exige fluxo explícito. Não houve provisionamento nem cobrança real neste incremento. Pix permanece R$5/R$15 por funcionário. Sistema de parceiros e portais: [escopo](tasks/2026-10-18-partners-web-portals.md).


### Câmbio fixo e alteração de assinatura (0.13.4)
Checkout: https://convertecall.pro/checkout. Configuração: https://adm.convertecall.pro/admin/pagamentos.
BRL padrão; USD e EUR selecionáveis antes da compra. Bases USD6.98/mês e USD16.58/trimestre; funcionário adicional USD1.50/mês ou USD4.50/trimestre, até sete pessoas incluindo titular. Câmbio inicial autorizado USD1=BRL5.50/EUR1.17. ADM muda novas cotações; revisão evita compra usando cotação antiga. Assinaturas existentes preservam preço contratado.
Alterações de plano são confirmadas no portal hospedado; redução programada para fim do período, upgrade com ajuste de cobrança. Nunca liberar assentos pelo redirecionamento. Troca de moeda de assinatura ativa exige suporte por enquanto. Pix manual mantém valores próprios aprovados; indicados de parceiro não recebem opção Pix.

## 18/10/2026 — diagnóstico de chave restrita no checkout

Falha real reproduzida em uma conta de teste existente: POST /v1/prices devolveu HTTP403, código more_permissions_required. O servidor usava preços novos para BRL/EUR/equipe, mas Prices estava sem acesso na chave restrita. O preço USD já cadastrado abriu a sessão normalmente. Após Prices → Gravação, sessões reais BRL e EUR foram criadas; a página hospedada BRL exibiu R$38,39/mês. Nenhum cartão foi preenchido e nenhuma compra foi concluída.

Mínimos para este fluxo: Prices/Preços → Gravação; Customers → Gravação; Checkout Sessions → Gravação; Subscriptions → Gravação (inclui migração do formato antigo de equipe); Customer Portal → Gravação; Invoices, Payment Intents, Charges and Refunds e Balance → Leitura para confirmação e conciliação. Não é necessário conceder criação de estornos, transferências ou repasses automáticos. Não confundir acesso do conector Codex com a chave restrita do processo Railway.

Billing.api registra somente método, rota com IDs ocultos, status, código e identificador da solicitação Stripe. Chaves, corpo, query string e dados do cliente não são registrados. Teste de regressão verifica essa proteção. Sem alterações na extensão e sem anúncio de atualização por este ajuste no servidor. Uma sessão criada não comprova compra aprovada nem concessão por webhook.


## Portal de assinaturas 0.13.6
Permissões Customer Portal → Gravação e Invoices/Charges and Refunds → Leitura salvas e confirmadas. A API rejeitava `features.subscription_update.restrictions` (não documentado) e preços com intervalos duplicados por produto. Corrigido o contrato: cada configuração contém somente o preço mensal e trimestral de uma moeda e tamanho de equipe. Configuração independente e idempotente por catálogo; não muda preços nem assinaturas existentes por apenas abrir o portal. Alteração de equipe usa confirmação hospedada do preço de destino, mantendo concessão pelo webhook. Teste de regressão rejeita configurações com intervalos duplicados.
