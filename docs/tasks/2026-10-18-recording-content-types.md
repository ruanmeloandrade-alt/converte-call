# Gravações: calls, videoaulas e vídeos

Pedido: identificar o tipo de gravação para adaptar a análise; sugerir cortes e reorganização do roteiro em aulas/vídeos; reutilizar workflows como roteiros acompanhados ao vivo.

## Implementado localmente

- Tipo automático, call/reunião, videoaula/treinamento ou vídeo/conteúdo no início e na reanálise. Identificação automática pode ficar indeterminada; escolha manual prevalece.
- Finalidade do workflow configurável, preservada ao duplicar. Roteiro opcional e avanço manual por padrão; avanço pela IA depende de escolha explícita.
- Orientações ao vivo adaptadas à finalidade, sem obrigar ações no CRM. Extração para ficha do cliente limitada a calls com cliente associado.
- Relatório estruturado com resumo, justificativa da classificação, sequência sugerida e cortes apoiados em citações literais.
- Horários de cortes derivados somente das janelas dos segmentos capturados, quando disponíveis e dentro da duração. São janelas aproximadas, não limites exatos de edição. Sem segmentos: localizar pela citação. A mídia original não é editada.
- Relatório e tipo persistidos junto da transcrição no servidor; retenção da mídia permanece 48 horas.

## Validação

25 testes nativos passaram, incluindo classificação, correção manual, rejeição de citação inventada/horário fora da duração e preservação do relatório após expiração da mídia. Teste Chrome passou incluindo criação de workflow de videoaula e seleção do tipo/avanço manual na captura. Captura visual inspecionada em outputs/Converte-Call-Gravacao-videoaula.png.

## Limites atuais

Ainda sem teste com gravação real e API do cliente. A análise usa texto, não inspeção visual do vídeo. Transcrição direta limitada a 20 MB; resumo usa os primeiros 100.000 caracteres. Não afirmar cobertura integral de gravações acima desses limites. Horários de cortes disponíveis somente quando houver segmentos ao vivo correspondentes. Código local; não publicado nem entregue como atualização consolidada neste incremento.

## Arquivos deste incremento

extension/recording-analysis.js (novo), extension/ai-media.js, extension/background.js, extension/builders.js, extension/manifest.json, extension/offscreen.html, extension/offscreen.js, extension/panel.html, extension/recorder.html, extension/recorder.js, extension/release.js, extension/v4.js, extension/v11.js, src/recordings.mjs, test/recording-analysis.test.mjs (novo), test/recordings.test.mjs, test/experience.browser.mjs, docs/tasks/2026-10-18-recording-content-types.md e docs/CODEX_STATUS.md.
