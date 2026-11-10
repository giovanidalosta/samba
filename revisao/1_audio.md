# Auditoria: motor de áudio e Pad (index.html, assets/soundbank.js)

Legenda: [R] verificado rodando (Chromium, porta 3101), [L] só lido.

## ALTO
1. **BPM inválido no link ou JSON trava a aba.** index.html:5222 (`data.b || 120`) e :5476 (`settings.bpm || 120`) não validam. Em `startPlayback` (:5335) o `while` não termina: com bpm=-120 ou 1e9 o stepDur é negativo ou ~0 e a aba congela. [R] os dois casos passaram de 8 s e não voltaram. bpm="abc" gera NaN e fica mudo com "tocando" ligado; bpm=0.001 toca uma nota e para. [R] Correção: `clamp(Number(b), 30, 300)` em uma função única de sanitização, e um limite de iterações no `while`.
2. **Estado inválido fica pela metade.** Link/JSON aceitam `measures` negativo, string, fracionário ou 1e7, meter "7/8" e subdivision `<img>`. [R] sem erro visível, mas `state` fica corrompido: `new Array(-n)` lança dentro do try e só dá `console.warn` (:5213-5249). Também aceita `gridData` com strings/objetos [L]. Correção: whitelist de meter/subdivision, measures inteiro entre 1 e 32, e cada trilha como array de ids de articulação válidos.

## MÉDIO
3. **Importar/abrir link não zera `stepMeta`** (:5240, :5476). Velocidades/acentos do breque anterior ficam grudados na grade nova. [L] Correção: `state.stepMeta = {}` e `stopPlayback()` antes de aplicar.
4. **Link e JSON perdem dados.** `stepMeta`, mudo/solo e tercinas por nota não vão no payload (:5152, :5427). [L] Link de 8 compassos 4/4 fusa tem 17 KB, cheio de `null`. [R] Correção: incluir stepMeta e comprimir a grade (índice:articulação).
5. **Render WAV (`renderSequenceToWavBlob`, :3520) tem três defeitos.**
   - `await this.preloadSamples()` não espera nada, pois a função devolve undefined (:2866). [L] Hoje não causa falha, porque o soundbank decodifica na hora (0 notas de fallback, [R]).
   - Se um sample faltar, `playFallbackInstrument` (:3340) usa `this.ctx` ao vivo e ignora o contexto offline: o som sai no alto-falante e não entra no WAV. [L]
   - O choke em rufada não é registrado no contexto offline (:3235 só registra se `ctx===this.ctx`), então o WAV difere do Pad. [L]
6. **Choke no render offline começa a rampa em ganho 1.0.** `gain.value` lê o valor padrão no contexto offline (:2969). [R] No tamborim:fraco a cauda cortada ficou 25% mais alta que sem choke. Correção: guardar `voice.vol` e usar `setValueAtTime(prev.vol, t)`.
7. **`buildExtendedRufadaBuffer` roda a cada rufada** (:3074) dentro do timer de 15 ms. Aloca AudioBuffer e processa amostras na thread principal. [L] Correção: cache por (url, dur, runCount).
8. **Agendador frágil em segundo plano.** `setInterval` de 15 ms com lookahead de 35 ms (:5335). Abas em segundo plano limitam o timer a 1 s, o que causa rajada ou perda de notas. [L] O timing normal está correto: 2/4, 4/4, fusa, tercina e sextina medidos em 120, 200 e 300 BPM, com intervalos exatos. [R] Correção: lookahead de 100 a 150 ms e timer de 25 ms.

## BAIXO
9. Sem tratamento de `statechange`/"interrupted" do AudioContext (iOS). O `init()` só chama resume() (:2805). Com o contexto suspenso a UI mostra "Pausar" mudo. [L]
10. Código duplicado.
    - Bloco de choke repetido em `playSample` e `playExtendedRufada`.
    - Limiter montado duas vezes (:2815 e :2834).
    - `state.meter === '2/4' ? 2 : 4` aparece 8 vezes.
    - Fallback procedural de ~200 linhas. [L]
11. Soundbank: 540 KB, bloqueia o carregamento por ser script síncrono (:2267). Mesmo assim DOMContentLoaded ficou em 391 ms e as 42 amostras decodificaram em menos de 1,5 s. [R] 117 de 145 arquivos em assets/audio (801 KB) não são referenciados em lugar nenhum. Correção: apagar ou mover esses arquivos.
12. `importFromJSON` faz `Object.assign(customGrooves, data.customGrooves)` e grava no localStorage sem validar (:5486). [L]
13. Metrônomo e pré-roll vão direto ao `destination`, sem passar pelo limiter. [L]

## Perguntas ao dono
1. Posso limitar BPM a 30-300, compassos a 1-32 e rejeitar links fora disso com aviso? (sim/não)
2. O link compartilhado deve incluir acentos/velocidades (stepMeta) e mudo/solo? (A: sim, link maior comprimido; B: não, só notas)
3. Posso apagar os 117 arquivos de áudio não usados em assets/audio? (sim/não)
4. Ao abrir link ou importar JSON com o Pad tocando, parar o som e zerar acentos antigos? (sim/não)
5. Uso em segundo plano ou tela bloqueada é requisito? (A: sim, aumento o lookahead; B: não, só aba ativa)
