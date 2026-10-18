# Diagnóstico de inicialização Stripe

O evento stripe-configuration-failed informa status interno, status HTTP da Stripe, etapa de configuração e categoria da chave. Não registra valor da chave, corpo da resposta do provedor, cabeçalhos de autenticação ou webhook secret.

Etapas possíveis: /account, /products, /prices, /webhook_endpoints, /billing_portal/configurations e validation. HTTP401 indica credencial recusada; HTTP403 indica acesso insuficiente; HTTP400 exige revisão da requisição. A etapa e a resposta devem ser verificadas antes de atribuir a causa a uma permissão específica.

Espaços acidentais antes/depois da chave são removidos antes da validação. O formato, a conta recebedora e o ambiente continuam sendo conferidos. Nenhuma cobrança é feita por este diagnóstico.
