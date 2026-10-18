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
