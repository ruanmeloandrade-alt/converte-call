# Vendas na ficha do cliente

A partir da versão 0.15.2, o workspace.sales existente também guarda vendas avulsas criadas na ficha. Não há nova tabela, nova dependência nem alteração no estoque.

Cada registro possui id UUID, lead (cliente), title, soldOn (data comercial YYYY-MM-DD), amount, payments.entry e payments.delivery (amount, received, date), status, origin, created, updatedAt e revision. O total é calculado no servidor em centavos a partir da entrada e da entrega. Datas de recebimento não representam cobranças executadas pelo sistema. Datas comerciais e recebimentos confirmados não podem ser futuros; previsões podem.

Operações getLeadSales e saveLeadSale usam o RPC autenticado, licença vigente, permissão de edição clients e escopo de clientes atribuídos. A revisão evita sobrescrever alterações concorrentes; o UUID torna a repetição idêntica idempotente.

O campo anterior Valor da venda (R$) continua preservado. Na primeira adição de outra venda sem pedidos ou vendas existentes, seu valor é importado como custom-field-import, sem inventar data da venda ou recebimentos. Um cliente ganho com valor antigo também é preservado. Havendo pedidos, sua contabilização continua autoritativa e o campo antigo não cria uma venda duplicada.

Pedidos e espelhos com o mesmo ID contam uma única vez. A Dashboard conta vendas distintas, mantém conversão baseada em clientes únicos e exclui vendas canceladas. Registros cancelados impedem reativar indevidamente um campo legado como receita.

Validação: test/lead-sales.test.mjs e test/packaged-extension.browser.mjs, incluindo persistência HTTP real, isolamento, permissões, edição, repetição, datas retroativas e formulário em largura de celular.
