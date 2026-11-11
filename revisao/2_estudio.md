# Auditoria do Estúdio (beatbox_studio.js)

## Alto
1. **XSS ao abrir projeto .json** (L761-775, 1131-1140, 709/727, 5527-5560). `volume`, `offsetMs` e `id` do arquivo vão crus para `innerHTML` (`value="${track.volume}"`, `data-id="${track.id}"`, `${track.offsetMs}ms`). Só `name` é escapado. *Rodando:* um JSON com `volume:'1"><img onerror=…>'` executou script. Correção: validar tipos ao importar (Number.isFinite, id regenerado) e escapar tudo no template.
2. **Importar bateria do Pad com 32 faixas cheias sobrescreve a última faixa em silêncio** (L5606-5610). *Rodando:* o 33º import trocou "Inst31" por "EXTRA_33". Correção: avisar e recusar no limite.
3. **Falha ao salvar no IndexedDB é muda** (L24-40, 37-39). Quota cheia só dá `console.warn`; o usuário acha que salvou. *Rodando:* com `put` lançando QuotaExceeded, não houve toast nem alerta. Correção: toast de erro e `navigator.storage.persist()`.
4. **Importar .json não valida nada e destrói o projeto atual** (L5527-5565). Sem limite de 32 faixas (*rodando:* entraram 40); URLs antigas são revogadas antes do parse terminar, então um JSON ruim deixa o projeto aberto quebrado. Correção: validar e montar tudo antes de trocar o estado.

## Médio
5. **Mosaico de vídeo limitado a 3x3** (L3407-3415). Com mais de 9 faixas as extras são desenhadas fora do canvas, mas o áudio entra. *Só lido.* Correção: calcular linhas por `ceil(sqrt(n))`.
6. **Exportação de vídeo/áudio de fallback só em webm** (L3443, 3664). Em Safari/iOS sem suporte, `new MediaRecorder` lança e o usuário vê só o alerta de erro. *Só lido.* Correção: incluir `video/mp4` na lista.
7. **Exportação WAV pula faixas que não decodificam sem avisar** (L3651-3653) e segura todos os buffers decodificados ao mesmo tempo (~60 MB por faixa de 3 min estéreo; 32 faixas passam de 1,5 GB). WAV com 32 faixas curtas funcionou (*rodando*). Correção: contar falhas e avisar; somar faixa a faixa.
8. **Vídeo exportado depende de `requestAnimationFrame`** (L3523): trocar de aba congela o quadro e estraga o arquivo. *Só lido.* Correção: avisar para manter a aba aberta.
9. **Sem desfazer/refazer.** Excluir faixa, "Limpar gravação" e dividir clipe são definitivos e já gravados no IndexedDB (L2262-2322). Correção: pilha de desfazer simples ou confirmação.
10. **Gravação: permissão negada e "sem microfone" dão o mesmo alerta genérico** (L2558-2561); `new MediaRecorder` do fallback pode lançar sem tratamento (L2724-2728); não há `recorder.onerror`. *Só lido.* Correção: diferenciar `NotAllowedError` e `NotFoundError`.

## Baixo
11. `openDB()` abre uma conexão nova a cada salvamento e nunca fecha (L14-40); são 45 chamadas a `saveCurrentSession`, sem debounce, regravando todos os blobs. Correção: reaproveitar a conexão e agrupar salvamentos.
12. `localStorage` lido sem try/catch na inicialização (L157-160). *Rodando:* com `localStorage` bloqueado, o objeto `BeatboxStudio` nem foi criado (o erro pode vir também do index.html). Correção: envolver em try/catch.
13. Dividir clipe duplica o blob (L4323) e duplica o espaço no IndexedDB. `downloadBlob` revoga o URL após 1 s (L3756), arriscado para arquivos grandes.
14. `escapeHtml` não escapa aspas simples (L819); hoje os atributos usam aspas duplas, então não explora.

## Verificado e OK
Salvar e recarregar 32 faixas persistiu; remover faixa durante a reprodução pausa o áudio; nomes de faixa com `<img onerror>` são escapados; WAV exportado tem tamanho coerente. Não testei gravação real, calibração, Safari/iOS nem o vídeo exportado.

## Perguntas ao dono
1. Posso mostrar um erro visível quando o IndexedDB falhar ao salvar (A: toast; B: bloquear a edição)?
2. No limite de 32 faixas, a importação do Pad deve recusar e avisar (sim/não)? Hoje ela sobrescreve.
3. Quer desfazer/refazer no Estúdio (A: sim, simples; B: só confirmação em excluir/limpar)?
4. O mosaico deve crescer a grade para mais de 9 faixas (A) ou limitar a exportação a 9 com aviso (B)?
5. Safari/iOS é alvo oficial? Se sim, preciso priorizar o fallback em mp4 na gravação e na exportação.
