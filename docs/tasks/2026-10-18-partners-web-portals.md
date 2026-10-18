# Parceiros, portais web e revisão Equipe

Estado: escopo solicitado e registrado em 18/10/2026. Parceiros e portais ainda não implementados nem publicados. Este registro integra a entrega consolidada; não substitui as demandas anteriores. Branch: feat/railway-server. Sem GitHub Actions, segredos no repositório ou novas dependências.

## Requisitos confirmados

| Área | Comportamento |
| --- | --- |
| Parceiro | Cadastro e link individual de indicação |
| Comissão | 80% na primeira compra e 50% em cada renovação atribuída ao parceiro; base de cálculo aguarda definição |
| Indicados | Quantidade de cadastros, testes/contas grátis e contas pagas; acesso apenas aos próprios indicados |
| Financeiro | Volume vendido, comissão retida, disponível, solicitada e paga; histórico de operações |
| Liberação | Comissão elegível 15 dias depois do pagamento confirmado, considerando reembolsos e disputas |
| Saque | Uma solicitação por semana, executada automaticamente pela integração de pagamentos quando elegível |
| Dados bancários | Cadastro e verificação pelo fluxo da Stripe, com acompanhamento de pendências |
| Formação | Faculdade de vendas específica para parceiros |
| Administração web | adm.convertecall.pro |
| Parceiros web | parceiros.convertecall.pro |
| Extensão | Experiência comum do cliente, inclusive para quem também é administrador ou parceiro |

Os 15 dias são regra comercial de retenção, não garantia de ausência de contestações posteriores. Não antecipar receita de teste gratuito como comissão.

## Administração web

- Abrir como aplicação web completa, sem depender da extensão instalada.
- Reutilizar Inbox original da Saúde Slim, alterando a identidade visual; preservar o motor e as funcionalidades.
- Gerenciar clientes, assinaturas, contas em teste e pagamentos; registrar pedidos Pix e liberar o período adquirido manualmente.
- Permitir corrigir acesso de pagamento por cartão com problema, com justificativa e trilha de auditoria. Liberação manual não comprova recebimento nem gera comissão automaticamente.
- Editar Faculdade na própria visão do aluno, usando controles de edição exclusivos da administração.
- Gerenciar parceiros, atribuições, comissões, solicitações e exceções de pagamento com auditoria.

## Portal do parceiro

- Dashboard com link copiável, conversões de cadastro em pagante, volume de vendas e comissões por período/moeda.
- Lista dos próprios indicados com informação mínima necessária para acompanhamento; sem acesso a conversas, documentos, fichas ou dados de outros parceiros.
- Extrato com origem da comissão, data de pagamento, data prevista de liberação, estado, ajustes e saque associado.
- Botão para conectar/atualizar a conta de recebimento por onboarding Stripe; mostrar verificação pendente, restrições e recebimento habilitado.
- Solicitar saque do saldo elegível, acompanhar processamento/falha/conclusão e próxima janela semanal.
- Faculdade com cursos, módulos e aulas específicos para vender Converte Call, editáveis pelo administrador.

## Autenticação e separação de ambientes

Manter identidade e integrações persistentes no servidor. Uma atualização da interface não desconecta WhatsApp/Google/IA. Autorizar cada rota no servidor por usuário, papel e contexto da sessão; esconder botões por hostname não é controle de acesso.

Sessões web devem ter audiência explícita de administração ou parceiro, cookies restritos ao host e proteção CSRF nas mutações. Tokens da extensão recebem escopo comum de cliente; possuir papel de administrador/parceiro não pode expor permissões privilegiadas nesse token. Testar chamadas diretas à API, troca de host e sessão, não apenas o menu.

Cadastros, cobrança e permissões do cliente continuam separados da participação no programa. A inscrição como parceiro não deve conceder assinatura paga ou assentos extras automaticamente.

## Atribuição e registro financeiro propostos

1. Resolver identificador público do link no servidor e guardar vínculo verificável na criação da conta.
2. Congelar a atribuição utilizada em cada pagamento; parâmetros enviados pelo navegador nunca definem comissão, valor ou favorecido.
3. Criar lançamento apenas após pagamento confirmado, com identificador único do pagamento/fatura, parceiro, base, percentual aplicado (80% primeira compra /50% renovação), centavos inteiros e moeda.
4. Usar estados: retida → disponível → reservada para saque → transferência em processamento → paga; permitir cancelamento/estorno auditado.
5. Reembolso parcial ajusta proporcionalmente o lançamento elegível. Reembolso total/disputa bloqueia ou reverte conforme estado, inclusive após os 15 dias; não apagar histórico.
6. Reservar saldo e aplicar limite semanal atomicamente. Idempotência e reprocessamento não podem duplicar comissão, transferência ou saque.
7. Conciliar eventos Stripe assinados e reconsultados, com tentativas recuperáveis e identificadores externos. Falha/timeout exige consultar a operação anterior antes de repetir.

Transferência entre contas Stripe e saque bancário são operações distintas. Só mostrar pago quando o provedor confirmar a etapa correspondente; não prometer crédito bancário imediato. Separar moedas, não somar USD e BRL como um único saldo.

## Stripe Connect: proposta a validar antes da ativação

Cobrar assinaturas do produto próprio na conta MKTON e efetuar transferências separadas para os parceiros após elegibilidade. O modelo de cobranças e transferências separadas permite desacoplar a cobrança do repasse. Não transferir os 80% imediatamente no Checkout se a regra exige retenção por 15 dias.

Usar onboarding hospedado/embutido da Stripe para informações bancárias e verificação de identidade, sem criar formulário bancário genérico próprio nem guardar dados bancários completos no CRM. Tipo/configuração de conta, capacidades, países atendidos, moedas, tarifas e disponibilidade do fluxo de repasse dependem da elegibilidade da MKTON e de cada parceiro. Não habilitar operação internacional indiscriminadamente.

A implementação deve controlar saldo disponível da plataforma, reservas, taxas, reembolsos e reversões. Pagamento Pix confirmado manualmente não cria saldo na Stripe: repasse automático dessas comissões depende de fonte de recursos e política específicas; não simular transferência.

Referências: [tipos de cobrança e responsabilidade por estornos](https://docs.stripe.com/connect/charges), [cobranças e transferências separadas](https://docs.stripe.com/connect/separate-charges-and-transfers), [onboarding hospedado](https://docs.stripe.com/connect/hosted-onboarding), [repasses internacionais](https://docs.stripe.com/connect/cross-border-payouts).

## Decisões comerciais pendentes

- Recorrência confirmada:80% na primeira compra e50% nas renovações. Base bruta/líquida perguntada ao usuário.
- Base bruta ou líquida após taxas; inclusão de adicionais Equipe e pagamentos Pix.
- Janela de atribuição e regra quando houver mais de uma indicação; tratamento de cliente já existente e autoindicação.
- Semana de calendário ou intervalo móvel de sete dias; mínimo de saque e responsabilidade por tarifas/conversão.
- Países inicialmente atendidos, tratamento de bloqueios, contestações e saldo negativo após repasse.

Não escolher silenciosamente regras financeiras que alterem a remuneração prometida.

## Equipe: preços atualizados

Titular incluído; máximo de sete pessoas, portanto até seis funcionários adicionais.

| Item | Mensal | Trimestral |
| --- | --- | --- |
| Individual USD | US$ 6,98 | US$ 16,58 |
| Cada funcionário adicional USD | US$ 1,50 | US$ 4,50 |
| Sete pessoas no total USD | US$ 15,98 | US$ 43,58 |
| Individual Pix | R$ 29,90 | R$ 67,90 |
| Cada funcionário adicional Pix | R$ 5,00 | R$ 15,00 |

Valores Pix preservados, pois não foram alterados nesta solicitação. Novos preços Stripe recebem identificador de revisão; preços imutáveis e assinaturas já contratadas não são alterados automaticamente.

## Critérios de aceite da implementação futura

- Cliente, parceiro e administrador isolados no servidor; extensão sempre usa a experiência comum.
- Indicação persiste do cadastro ao pagamento e só produz comissão após confirmação financeira.
- Webhooks repetidos, concorrência e reinício não duplicam comissão ou saque.
- Antes de 15 dias, estorno/disputa ou conta bancária pendente: saque indisponível com explicação.
- Limite semanal impede duas solicitações simultâneas; falhas não deixam saldo perdido nem permitem pagamento duplicado.
- Testes de reembolso antes/depois do repasse, falha de transferência/payout, moeda e retomada de operação.
- Admin web com Inbox original e Faculdade editável; parceiro com Faculdade exclusiva.
- DNS/HTTPS e configuração de callbacks verificados nos dois subdomínios antes da publicação.

## Estado externo conhecido

Última verificação: servidor Railway online; configuração Stripe do processo bloqueada por HTTP403 em GET /account com chave restrita. Autorização do conector do Codex não equivale à autorização da chave do servidor. Revalidar após ajuste de permissões antes de ativar pagamentos/Connect. Nenhuma conta conectada, transferência, saque ou subdomínio novo foi criado neste incremento. O domínio raiz ainda depende da conclusão de DNS. As demais demandas da entrega consolidada permanecem no escopo.

## Correções posteriores confirmadas pelo usuário
- Comissão sempre sobre o líquido após taxas:80% primeira compra,50% renovações. Não reabrir essa pergunta.
- Clientes indicados por parceiro pagam exclusivamente por cartão. Pix não aparece nem é aceito pela API para essas contas. Pix manual permanece para vendas diretas do proprietário em português.
- Planos e assinaturas na extensão mostra somente plano atual, situação e tempo restante do teste. Valores/seleção de plano/equipe/pagamento ficam no checkout web, sem landing page. Usar pay.convertecall.pro como endereço proposto, com fallback Railway/checkout até DNS pronto.
- Titular de qualquer conta, inclusive administrador principal, mantém Inbox no WhatsApp Web normal. Apenas funcionários usam Inbox próprio copiado da Saúde Slim. Automação continua pela Evolution. Esta correção substitui a exigência anterior de Inbox próprio para administrador web.
- Parceiro configura nome da agência, WhatsApp e logo PNG transparente para o convite no rodapé mostrado aos seus indicados. Sem configuração válida: RB Midia. Texto: Precisa de ajuda com seu marketing? Fale com uma empresa especialista. Vamos conversar?
- Aprovações visuais anteriores devem ser preservadas e registradas separadamente da validação operacional. Não marcar serviços externos como verdes apenas porque a interface foi aprovada.
