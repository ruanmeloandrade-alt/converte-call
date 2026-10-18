# Custos da configuração inicial

Railway confirmada pelo proprietário. Projeto separado Converte Call. Configuração preparada, ainda não aplicada; os quatro serviços não estão rodando.

Uma API com SQLite persistente, uma Evolution, PostgreSQL e Redis exclusivos para a Evolution, uma réplica por serviço. Quatro volumes de 512 MB. Evolution e bancos ficam na rede privada; somente a API terá domínio público.

A Railway cobra por consumo real. A documentação oficial consultada informa RAM a US$10/GB-mês, CPU a US$20/vCPU-mês e saída de rede a US$0,05/GB. Armazenamento e o plano da conta também devem ser considerados conforme a conta.

Cenário ilustrativo de 0,8–1,2 GB de RAM média somada e 0,05–0,15 vCPU média somada: US$9–15/mês de RAM+CPU, antes de armazenamento/egress/plano. Não é medição da implantação nem garantia de preço: as instâncias ainda não existem. A Evolution pode consumir mais ao conectar/importar mensagens; vídeos e IA têm custos separados. Não tratar limites de recurso como teto de cobrança.

Após o primeiro teste real, medir o consumo dos quatro serviços e ajustar limites/armazenamento. O sleep está desativado para não interromper WhatsApp e gatilhos. Histórico completo inicial da Evolution está desativado para reduzir consumo. Não criar réplicas extras.

A tentativa de aplicar limites a serviço ainda staged foi recusada por Service Instance not found. Limites de recursos ainda precisam ser aplicados após materializar a instância. Não afirmar que estão ativos.

Fonte: https://docs.railway.com/guides/right-size-cpu-memory
