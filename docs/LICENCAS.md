# Cadastro direto e assinatura — 0.10.0

Cada conta começa com 7 dias grátis, sem cartão, documento ou convite. O prazo começa na criação da conta e usa o relógio do servidor. O administrador mantém liberação manual em /admin por dias/data. A versão 0.11 adiciona confirmação manual do Pix e fluxo Stripe recorrente por webhook, que depende da conexão real da conta Stripe. Veja PAGAMENTOS.md.

/register pede nome, sobrenome, nascimento, e-mail, senha, WhatsApp principal e segundo WhatsApp opcional. CPF, CNPJ e documentos de outros países não são solicitados nem armazenados. E-mail é normalizado para minúsculas e sem espaços nas extremidades; a unicidade também é imposta no banco.

Ambos os telefones são únicos entre contas, independentemente de serem principal ou secundário. Não se pode informar o mesmo número nos dois campos. O valor deve conter somente dígitos, com código internacional e DDD; exemplo brasileiro: 5522992888971. Não aceitamos letras, espaços, +, hífens ou parênteses. Há validação de comprimento internacional e formato brasileiro/norte-americano. Isso não comprova que a linha existe, tem WhatsApp ou pertence ao usuário: verificação por SMS/OTP ainda não foi implementada. Os dois contatos não equivalem a duas conexões de automação.

O perfil é cifrado com AES-256-GCM. A busca de telefone usa HMAC com segredo do servidor, sem telefone em texto puro no índice. Migração aditiva 3 cria account_profiles e account_phones, preservando usuário, senha e workspace do administrador existente. A versão anterior publicada era 0.9 e não coletava documentos; a proposta intermediária de CPF/CNPJ foi retirada antes de publicação.

E-mails e telefones continuam reservados após vencer o teste. Login e reinstalação não reiniciam o prazo. Não apagamos contas automaticamente. Operações de domínio continuam bloqueadas por HTTP402 após o prazo; consulta de licença e suporte ficam disponíveis. As verificações de duplicidade são repetidas dentro da transação de cadastro.

POST /v1/admin/licenses retorna HTTP410: os códigos deixaram de ser necessários. Registros históricos/auditoria são preservados. /activate abre o cadastro comum. Uma instalação nova deve concluir o bootstrap antes de aceitar cadastros públicos.

A extensão 0.10 conecta a conta para Faculdade e FAQ. A sincronização integral do CRM, o bloqueio integral dos módulos locais e o executor de bots/agentes permanecem pendentes. Não distribuir como versão comercial final com todos os módulos protegidos.
