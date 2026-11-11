# Auditoria: testes, manutenibilidade, roadmap

## Achados
**Alto**
- tests/harness.js:7-10,289-292: só caminhos Windows; em Linux lança "Neither Chrome nor Edge". Porta 3000 fixa (harness.js:20,37; também browser-verify.js, challenger_m2*.test.js, tier2). Falta `--no-sandbox` (harness.js:299). Correção: `process.env.CHROME_BIN || process.env.PLAYWRIGHT_CHROMIUM || [caminhos Win/Mac/Linux]`, `--no-sandbox` quando CI/root, porta via `PORT` e server.js lendo `process.env.PORT`.
- Cobertura nula no que importa: nenhum teste toca MediaRecorder, export .wav/.webm, IndexedDB (beatbox_studio.js:38-70) ou link `#breque=`. Os 157 testes cobrem só layout/DOM/seletores.
- Sem CI (.github inexistente), sem README.
**Médio**
- Suíte redundante: `challenger_m1_*` e `m1_challenger_*` (643+681 linhas) são duas versões do mesmo marco; `challenger_runner.js` (700) e `browser-verify.js` (608) são runners paralelos fora do `npm test`. Testes challenger/tier verificam as classes do contrato do PROJECT.md (valor como trava de regressão visual, mas acompanham a implementação). Frágeis: ~50 `setTimeout` fixos de 35–120 ms (challenger_m3*: 16 e 18) em vez de `waitFor`; asserções por texto de tooltip (m1_challenger:612).
- index.html:2268-6789: 4.500 linhas de script inline, 73 `const/let` no topo e ~151 `getElementById`; `window.*` como ponte entre os dois arquivos (index.html:2272,5139,5591,5806; beatbox_studio.js:5706).
- `escapeHtml` duplicada (index.html:6594 e beatbox_studio.js:817).
- 46 `catch` vazios (index.html 8–9, beatbox_studio.js 16–24, ex.: 1005, 1474, 2370, 2824, 2936). Em harness.js e testes também.
- sw.js:2: `CACHE_NAME` bumpado à mão (v24) e lista de assets duplicada; esquecer o bump serve JS velho.
**Baixo**
- PROJECT.md:32-35 marca M1–M4 como PLANNED, mas há 157 testes passando e os arquivos de teste de M1–M3 existem: provavelmente concluídos. Linha 22 diz 9 faixas (código: 32). Cita `samba/` como raiz inexistente.
- package.json:18-19: `license: ISC` e `author: ""` sem arquivo LICENSE.
- Idioma misto: mensagens em PT, nomes em EN (`Record`, 67 ocorrências vs `Gravar` 11).
- Logs: só `console.warn` (24), sem nível/flag; aceitável.
- Comentário morto/legado: index.html:3244. Rota `/__save_custom_grooves` já listada na revisão anterior.

## Roadmap
1. **Fase 1 (1 dia):** harness portátil (`CHROME_BIN`, `--no-sandbox`, `PORT`), CI, README, LICENSE/author. Destrava tudo e dá rede de segurança.
2. **Fase 2:** testes dos fluxos críticos: persistência (salvar, recarregar, IndexedDB), link `#breque=`, exportar JSON/WAV (decodificar blob), gravação com `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`. Trocar `setTimeout` por `waitFor`; fundir os 2 arquivos m1; mover runners para `tests/tools/`.
3. **Fase 3 (sem build):** tirar o script inline para `<script src="js/pad.js">` (não-módulo ou `type=module`; módulos funcionam sem build). Ordem: utils (`escapeHtml`, toast/dialog `window.app*`) → persistência → pad → sequenciador → atalhos. Um commit por módulo com a suíte verde. Depois fatiar beatbox_studio.js: `audio-engine`, `timeline-render`, `tcp`, `recording`, `export`, mantendo a IIFE e `window.BeatboxStudio` como fachada.
4. **Fase 4:** substituir catch vazios por `log.debug`; sw.js com versão derivada de hash/`package.json`; atualizar PROJECT.md.

## Executado vs lido
Executado: `npm test` na cópia com harness ajustado (Chrome do Playwright, --no-sandbox, porta 3105): 157/157 em 29 s; contagens por grep. Lido apenas: a qualidade das asserções, a proposta de módulos e o CI. O workflow abaixo não foi executado.

```yaml
name: tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npx -y playwright@1.49 install --with-deps chromium
      - run: |
          echo "CHROME_BIN=$(node -e "console.log(require('playwright').chromium.executablePath())")" >> $GITHUB_ENV
      - run: npm test
```
(requer `npm i -D playwright` ou usar `npx playwright` com o caminho do cache `~/.cache/ms-playwright`.)

## Perguntas ao dono
1. Posso marcar M1–M4 como CONCLUÍDOS no PROJECT.md? (sim/não)
2. Fundir os dois arquivos `m1_*` e mover `challenger_runner.js`/`browser-verify.js` para fora do `npm test`? (sim/não)
3. Divisão em módulos: A) `<script type=module>` (exige servidor, ok), B) scripts clássicos em ordem?
4. Licença: MIT, ISC ou proprietária, e qual nome de autor?
5. Aceita adicionar `playwright` como devDependency para o CI? (sim/não)
