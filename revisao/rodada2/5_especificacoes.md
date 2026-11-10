# Especificações de execução: Fases 0, 1 e 2 (Naumteria Studio)

Base: `PLANO_DE_MELHORIAS.md` e `revisao/*.md`, conferidos contra o código do commit `afcef8b`. As linhas citadas são do repositório original, não da cópia.
Esforço: P (<1h), M (1-3h), G (>3h). Testes: no estilo de `tests/tier*.test.js` (`node:test` + `launchBrowser()` + `session.evaluate`).
Prova de conceito de 0.1–0.4 (mais um achado novo de 0.2): cópia em `.../r2_spec/copy`, diff em `.../r2_spec/fase0.diff`, teste novo em `copy/tests/tier5_fase0_seguranca.test.js`.

## Tabela-resumo

| Item | Esforço | Risco | Depende de |
|---|---|---|---|
| 0.1 sanitizeBreque + sanitização do Estúdio | M | médio (presets nativos, sliders) | — |
| 0.2 Escapar templates + appToast | P | baixo | 0.1 (ids seguros) |
| 0.3 Limite no agendador (Pad **e metrônomo do Estúdio**) | P | baixo | — |
| 0.4 server.js | P | baixo (lista de permitidos x 5.6) | — |
| 0.5 Meta CSP | P | médio (bloquear recurso legítimo) | 4.2, 5.6 (para endurecer) |
| 0.6 Importar .json do Estúdio de forma atômica | M | médio | 0.1 |
| 1.1 Erro do IndexedDB visível + persist() | P | baixo | 0.2 (toast seguro); fazer junto com 1.5 |
| 1.2 Limite de 32 no import do Pad | P | baixo | — |
| 1.3 Confirmação/desfazer (**já existe confirmação**) | M (1 nível) / G (pilha) | médio | 1.5 |
| 1.4 Parar Pad e zerar stepMeta ao abrir link/JSON | P | baixo | 0.1 |
| 1.5 Conexão única do IndexedDB + debounce | M | **alto** (salvar no projeto errado) | 1.1 |
| 2.1 Pad em pé (coluna de 120 px + popover) | G | **alto** (menus test 390 px) | 2.4, P6 |
| 2.2 Estúdio vazio 375 px (**a causa é outra**) | P | baixo | — |
| 2.3 Aviso "Gire o celular" | P | baixo-médio | 2.4 |
| 2.4 Alvos de toque de 44 px | G | **alto** (altura da toolbar ≤68 px) | 2.1, 2.2, P9 |
| 2.5 Liberar o zoom | P | baixo (zoom em input no iOS) | — |
| 2.6 Contraste | M | médio (paleta) | P8 |
| 2.7 Foco visível | P | baixo | — |
| 2.8 aria-label | M | baixo (não remover `title`) | Fase 3 (ícones) |
| 2.9 prefers-reduced-motion | P | baixo | — |

Ordem sugerida: 0.4 → 0.1 → 0.2 → 0.3 → 0.6 → 0.5 → 1.4 → 1.2 → 1.1+1.5 → 1.3 → 2.2 → 2.5 → 2.7 → 2.9 → 2.3 → 2.8 → 2.6 → 2.1 → 2.4.

---

## Fase 0

### 0.1 Sanitização única de entrada
**Arquivos e linhas**
- `index.html:5207-5249` `checkSharedBrequeUrl` (atribuições cruas em 5222-5228).
- `index.html:5474-5496` `importFromJSON`, ramo `settings` (5476-5484 e 5494).
- `index.html:4436-4458` `applyBateriaPresetObject`. Recebe presets do localStorage e de arquivo, e o plano não cita esse caminho.
- `beatbox_studio.js:5527-5560` (import do projeto) e `beatbox_studio.js:3848-3876` `restoreSession`. O IndexedDB pode já conter dados ruins, e o plano não cita esse caminho.
- Novo bloco antes de `checkSharedBrequeUrl` e, no Estúdio, depois de `createTrack` (`:190`).

**Abordagem.** Escrever uma função pura `sanitizeBreque(raw)` que nunca lança. Ela aceita o formato do link (`b/m/s/c/vol/t/g`) e o do JSON (`bpm/meter/…/gridData`) e devolve um estado completo mais `warnings[]`:
```js
const BREQUE_LIMITS = { BPM_MIN:30, BPM_MAX:300, MEAS_MIN:1, MEAS_MAX:32, VOL_MIN:0, VOL_MAX:1.5 };
function clampNumber(v,min,max,def,int){ if(v==null||v===''||typeof v==='boolean')return def;
  let n=Number(v); if(!Number.isFinite(n))return def; if(int)n=Math.round(n); return Math.min(max,Math.max(min,n)); }
// meter ∈ ['2/4','4/4']; subdivision ∈ ['semicolcheia','fusa'];
// gridData[inst] = Array(totalSteps) com ids de inst.articulations (após normalizeArticulationId) ou null;
// beatTuplets: chaves inteiras < totalBeats, valores 3|6; volumes clampados; stepMeta {tipo∈acento|medio, vel 0..127}.
```
No Estúdio: `sanitizeStudioSettings(o)` (bpm, meter, mode∈free|fixed, measures, zoomLevel∈[100,125,150,200], viewMode) e `applySanitizedTrackFields(tr, src, usedIds)`. Ela aceita só ids `/^[A-Za-z0-9_-]{1,64}$/` sem repetição (senão usa o id de `createTrack`), volume 0–1,5, offsetMs inteiro de -5000 a 3 600 000, `trim*` dentro de `duration`, `waveformPeaks` só com números finitos (≤20 000), `mediaType` só audio|video e `mediaDataUrl` só com prefixo `data:`.
Fora do limite: corrigir para o valor mais próximo e mostrar um toast ("valores ajustados"). Se a resposta à P1 for "rejeitar", basta trocar para `if (warnings.length) return abort()`.

**Pronto quando**
- -120→30, 1e9→300, "abc"→120, `"<img…>"`→120;
- compassos 1e9→32, -3→1, 2,6→3;
- `7/8`→2/4;
- articulações desconhecidas viram `null`;
- os 7 presets nativos passam pela função sem perder nenhuma nota;
- ids duplicados ou hostis no .json são regenerados.

**Teste** (feito na PoC): `T0.1a` (unidade via `window.sanitizeBreque`) e `T0.1b` (round-trip de todos os `BATERIA_PRESETS`), em `tier5_fase0_seguranca.test.js`.

**Risco**
- Os sliders têm faixas diferentes do limite: `#bpmSlider` vai de 80 a 170 (`index.html:1788`) e `#studioBpm` de 60 a 200 (`:1716`). Um link com 300 BPM toca a 300, mas o slider mostra 170, e isso já acontece hoje. É preciso decidir entre alinhar os sliders a 30–300 ou limitar a 80–170.
- O `normalizeArticulationId` legado (ganzá frente/trás) precisa rodar antes da lista de permitidos.
- `beatTuplets` de preset sem `measures` precisa usar o `state.measures` atual. Corrigido na PoC.

**Dependências:** nenhuma. Os itens 0.2, 0.6 e 1.4 usam esta função.

### 0.2 Escapar o que vai para `innerHTML`
**Arquivos e linhas**
- `index.html:6497-6499`: `${bpm}`, `${measures}`, `${studioRecorded}/${studioTracks}` no card da Home. É este o ponto que reproduz o XSS armazenado.
- **Achado novo:** `index.html:2285`. O `window.appToast` usa `innerHTML` com `msg`. Os chamadores `beatbox_studio.js:2255` (`Faixa "${source.name}" duplicada.`) e `:2286` (Limpar) interpolam o nome da faixa. Reproduzi: uma faixa com nome `<img src=x onerror=…>` executa o script ao duplicar. O nome pode vir de um .json importado.
- `beatbox_studio.js:764-765` e `772` (`value="${track.volume}"`, `${track.offsetMs}ms`), `:1136` (`data-id`) e `:817-820` (`escapeHtml` sem aspas simples).

**Abordagem.** Na Home: `escapeHtml(String(bpm))` e `Number(x)|0` nas contagens. No `appToast`: montar com `textContent` (`replaceChildren` + dois `span`). No Estúdio: `escapeHtml` nos campos numéricos e no id dos templates citados, e `'`→`&#39;`. Os outros ~80 `data-id="${track.id}"` ficam seguros por construção depois de 0.1, porque o id passa a seguir o padrão restrito. Um passo extra, opcional, é um teste de grep que proíba `${track.` sem `escapeHtml` em templates.

**Pronto quando**
- Fluxo do link: payload `b:'<img src=x onerror=alert(7)>'`, salvar, recarregar, abrir a Home → 0 `alert`, 0 `<img>` em `#homeBrequeList`, e a pílula mostra "120 BPM".
- Dado legado já gravado no localStorage aparece como texto.
- Um .json com `volume/id/offsetMs` hostis não injeta HTML.
- Um nome de faixa com HTML aparece literalmente no toast.

**Teste** (feito na PoC): `T0.2a` (link + salvar + recarregar, contando `Page.javascriptDialogOpening`), `T0.2b` (localStorage legado), `T0.2c` (.json do Estúdio via `DataTransfer` em `#projectFileInput`) e `T0.2d` (toast).

**Risco:** baixo. O `escapeHtml` do index devolve `''` para valores falsy, o que não pega o bpm porque ele é ≥30. Nenhum teste lê o `innerHTML` do toast.

**Dependências:** 0.1.

### 0.3 Limite de iterações no agendador
**Arquivos e linhas**
- `index.html:5323-5348` `startPlayback`, com o `while` na linha 5335.
- **Achado novo:** o metrônomo do Estúdio tem o mesmo laço sem limite em `beatbox_studio.js:3077` (`60/state.bpm`), `:3091` e `:3118-3122` (`resyncMetronomeToLoop`). Com bpm ≤ 0 vindo de um .json ou do IndexedDB, a aba do Estúdio trava do mesmo jeito.

**Abordagem**
```js
const MAX_STEPS_PER_TICK = 64, MIN_STEP_DUR_SEC = 0.005; // menor passo legítimo: 300 BPM em fusa = 25 ms
let guard = 0;
while (state.nextNoteTime <= now + 0.035) {
  if (++guard > MAX_STEPS_PER_TICK) { state.nextNoteTime = now + 0.02; break; } // ressincroniza
  const stepDur = getStepDurationSec(stepToPlay);
  if (!Number.isFinite(stepDur) || stepDur < MIN_STEP_DUR_SEC) { stopPlayback(); return; }
  ...
```
No metrônomo: `60 / clampNum(state.bpm,30,300,120)`, `guard++ < 32` e ressincronizar se ficou mais de 1 s atrasado.

**Pronto quando:** bpm -120, 1e9, 0 ou NaN injetados direto no `state` em execução fazem `startPlayback()` voltar em menos de 3 s com `isPlaying=false`. O link com esses valores toca normalmente com o BPM corrigido.

**Teste** (feito na PoC): `T0.3a` (link + `#btnPlay` com prazo de 4 s) e `T0.3b` (estado corrompido). Falta um teste para o metrônomo do Estúdio, que precisa de um gancho de teste para `state.bpm`, por exemplo `BeatboxStudio.__setBpmForTest`, ou pode passar pelo `.json` importado com o metrônomo ligado.

**Risco:** baixo. O limite de 64 só dispara com mais de 1,6 s de atraso, o que em uso normal só acontece com a aba em segundo plano (melhor que a rajada de hoje).

**Dependências:** nenhuma.

### 0.4 server.js
**Arquivos e linhas:** `server.js:5` (PORT), `:27-39` (decode e prefixo) e `:41-57`.

**Abordagem**
- `PORT = Number(process.env.PORT) || 3000` e `HOST` por variável de ambiente.
- `decodeURIComponent` dentro de `try/catch`, com resposta 400. Recusar `\0`.
- Checar `safePath.startsWith(PUBLIC_DIR + path.sep)`.
- Lista de permitidos `{/index.html, /beatbox_studio.js, /beatbox_studio.css, /sw.js, /manifest.json}` mais o prefixo `/assets/`, e recusar qualquer segmento que comece com `.`.
- Cabeçalho `X-Content-Type-Options: nosniff` e `stream.on('error')`.
- `require.main === module` e `module.exports = { server, isAllowed }`, para teste de unidade.

**Pronto quando**
- `/`, `/index.html`, `/assets/soundbank.js` e `/sw.js` → 200;
- `/.git/config`, `/server.js`, `/tests/harness.js`, `/PROJECT.md`, `/package.json` e `/assets/.hidden` → 404;
- `/%E0%A4%A` → 400, e o servidor continua respondendo;
- `/..%2f<pasta>-secret%2fx.txt` → 403 ou 404.

**Teste** (feito na PoC): `T0.4`, com `http.request` cru para não normalizar o caminho. O teste cria e apaga a pasta vizinha.

**Risco**
- A extração para `js/*.js` (5.6) precisa entrar em `ALLOWED_DIRS`, senão o app quebra.
- `fetch('/__save_custom_grooves')` continua dando 404, como já dá hoje.

**Dependências:** nenhuma. O 5.1 (harness com `PORT`) se beneficia.

### 0.5 Meta CSP (não aplicado na PoC)
**Arquivo:** `index.html`, logo depois da linha 5.
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline';
 style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;
 img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' data: blob:; worker-src 'self';
 manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
```
**Atenção:** com `'unsafe-inline'`, que é obrigatório enquanto houver 4,5 mil linhas de script inline e `onclick=` (por exemplo `index.html` no estado vazio da Home), a CSP **não impede** o `<img onerror>` reproduzido. Ela só impede carregar script externo e exfiltrar dados por `fetch`/`img` para outro domínio. Por isso 0.5 é defesa extra e não substitui 0.1 e 0.2. `frame-ancestors` é ignorado em `<meta>`; ele precisa ir num `_headers`, se a hospedagem for Netlify ou Cloudflare.

**Pronto quando:** carregar o app, tocar o Pad por 1 s, importar um .json com `mediaDataUrl: data:` e exportar o JSON gera 0 eventos `securitypolicyviolation`. Um `<script src="https://example.invalid/x.js">` injetado gera exatamente 1 violação.

**Teste:** `T0.5` em tier5. `Page.addScriptToEvaluateOnNewDocument` registra um listener de `securitypolicyviolation` em `window.__csp=[]`.

**Risco:** `connect-src` sem `data:` quebra o `dataURLToBlob` (`beatbox_studio.js:3773`). Sem `blob:` em `media-src`, a reprodução das faixas para.

**Dependências:** 4.2 (fonte local, que remove os domínios do Google) e 5.6 (para tirar `'unsafe-inline'` do `script-src`).

### 0.6 Importar .json do Estúdio de forma atômica
**Arquivos e linhas:** `beatbox_studio.js:5520-5580`. As URLs antigas são revogadas em 5546-5548, antes do `Promise.all`. Não há limite de faixas, e não há `sessionEpoch++`, o que deixa uma corrida aberta com `restoreSession`.

**Abordagem**
1. Fazer o `JSON.parse` e checar `Array.isArray(data.tracks)`.
2. Se `tracks.length > MAX_STUDIO_TRACKS`, recusar com `appAlert` (P3).
3. Montar `newTracks` numa variável local, com `applySanitizedTrackFields` e o `dataURLToBlob` aguardado.
4. Se qualquer passo lançar, revogar as URLs criadas para `newTracks` e manter o `state` intacto.
5. Só depois disso: `stopStudioPlayback()`, `sessionEpoch++`, `Object.assign(state, sanitizeStudioSettings(data))`, revogar as URLs antigas, `state.tracks = newTracks` e `saveCurrentSession()`.

**Pronto quando:** com 2 faixas gravadas abertas, importar um JSON inválido (`tracks:"x"`, ou uma faixa com um getter que lança) ou com 40 faixas mantém `getProjectSummary().totalTracks===2`, e o `fetch(track.mediaUrl)` das faixas antigas continua funcionando. Importar um JSON válido troca o projeto.

**Teste:** `T0.6` em tier5. Usar `DataTransfer` em `#projectFileInput` (como no `T0.2c`) e expor `getProjectSummary` (já exportado).

**Risco:** médio. A mensagem "Projeto carregado" (alert) precisa continuar no fim. O harness aceita diálogos automaticamente.

**Dependências:** 0.1 (a parte de sanitização já está na PoC; a ordem atômica ainda não).

---

## Fase 1

### 1.1 Falha do IndexedDB visível
**Arquivos e linhas:** `beatbox_studio.js:27-40` `saveProjectToDB` e `:3782-3814` `saveCurrentSession`.

**Abordagem**
- Ouvir também `tx.onabort`. A cota estourada no IndexedDB costuma chegar como **abort** com `QuotaExceededError`, e não como `error`. Hoje a promessa só espera `oncomplete`/`onerror`, então pode ficar pendurada para sempre.
- `saveProjectToDB` passa a devolver `true/false`. Quando der `false`, `saveCurrentSession` mostra `appToast('Não foi possível salvar no aparelho (espaço cheio?). Exporte o projeto em .json.', 'error', 8000)`, no máximo uma vez a cada 30 s.
- No `init()`: `navigator.storage?.persist?.().catch(()=>{})`.

**Pronto quando:** com `IDBObjectStore.prototype.put` trocado para lançar `new DOMException('x','QuotaExceededError')`, chamar `addTrack()` mostra `#globalAppToast` com /salvar/. Uma segunda falha dentro de 30 s não mostra outro toast.

**Teste:** `T1.1` (tier5_dados.test.js).

**Risco:** baixo (excesso de toasts, resolvido pelo intervalo de 30 s).

**Dependências:** 0.2 (toast seguro). Fazer junto com 1.5, porque mexe na mesma função.

### 1.2 Import do Pad no limite de 32
**Arquivos e linhas:** `beatbox_studio.js:5592-5610` (ramo `else` em 5606-5608) e o chamador em `index.html:5563-5570`.

**Abordagem:** checar o limite **antes** de `stopStudioPlayback()` e de `sessionEpoch++`. Sem faixa vazia e com `length>=MAX`, chamar `appToast('Limite de 32 faixas…','warn')` e `return false`. O chamador não muda de aba nem mostra mensagem de sucesso quando recebe `false`.

**Pronto quando:** com 32 faixas preenchidas, o 33º `importSequencerBounce(new Blob(...),1,120,'2/4',4,'EXTRA')` devolve `false` e o nome da faixa 32 continua igual.

**Teste:** `T1.2`. Usar 32 chamadas a `importSequencerBounce` com um WAV mínimo gerado no próprio teste.

**Risco:** baixo.

**Dependências:** nenhuma.

### 1.3 Confirmação / desfazer
**Correção ao plano.** A confirmação **já existe**:
- Excluir: `beatbox_studio.js:842` (mosaico) e `:1923` (timeline);
- Limpar: `:886` e `:1907`.

O que falta:
- O handler legado `.btn-tcp-clear` (`:1996-2001`) limpa sem confirmar. Nenhum template gera essa classe, então ele deve ser apagado.
- Dividir (`splitTrackAtMediaTime`, `:4295`, chamado pelo atalho S em `:4362` e pelo modal em `:4430`) não destrói nada, mas não tem volta.

**Abordagem (P4 = B, mais barato):** um "Desfazer" de um nível dentro do toast, por 8 s, para Excluir, Limpar e Dividir. Guardar um snapshot da faixa: campos e a referência do `mediaBlob`, mais o índice. Para desfazer, reinserir, recriar a `objectURL` e chamar `saveCurrentSession()`. Isso exige que o `appToast` aceite `{ actionLabel, onAction }`, criando o botão com `textContent`.

**Pronto quando**
- `appConfirm` trocado para devolver `false` → a faixa continua;
- Dividir e depois Desfazer → `tracks.length` e `trimStart/trimEnd` voltam ao original;
- Excluir e depois Desfazer → a faixa volta com `mediaUrl` válido.

**Teste:** `T1.3a-c`. O `resetStudioState` do harness já troca `appConfirm` por `true`, então o teste precisa trocar localmente por `false`.

**Risco:** médio (a `objectURL` revogada em `removeTrack` precisa ser recriada).

**Dependências:** 1.5 (o salvamento agrupado não pode gravar a exclusão antes de o Desfazer ter chance).

### 1.4 Abrir link ou importar com o Pad tocando
**Correção parcial.** O `importFromJSON` já chama `stopPlayback()` (`index.html:5475`). Faltam três coisas:
1. `stopPlayback()` em `checkSharedBrequeUrl` (`:5213`);
2. `state.stepMeta = clean.stepMeta` (ou `{}`), `state.loopGridData = {}` e `state.selectedGroove = {}` nos dois caminhos;
3. **Achado novo:** o hash `#breque=` continua na URL. Recarregar a página aplica o link de novo por cima das edições, e é isso que faz o XSS armazenado disparar a cada recarga mesmo sem salvar. A correção é `history.replaceState(null,'',location.pathname+location.search)` depois de aplicar o link.

**Pronto quando:** com o Pad tocando e `stepMeta.caixa[0]={tipo:'acento',vel:125}`, disparar o `hashchange` para um link deixa `isPlaying=false` e `stepMeta.caixa` todo `null`, e o `location.hash` fica vazio.

**Teste:** `T1.4`.

**Risco:** baixo. O teste de compartilhamento abre o Pad pelo link e continua passando.

**Dependências:** 0.1.

### 1.5 Conexão única e salvamento agrupado
**Arquivos e linhas:** `beatbox_studio.js:13-25` `openDB`, `:3782` `saveCurrentSession` (45 chamadores) e `:3816`/`:3906` (troca de projeto).

**Abordagem**
- Guardar `let dbPromise` com `db.onversionchange = () => { db.close(); dbPromise = null; }`, e zerar em caso de erro.
- Criar `scheduleSave()` com espera de 300–500 ms que **captura o `projectId` no agendamento**.
- Gravar imediatamente (flush) em `pagehide` e em `visibilitychange→hidden`, e **antes** de `restoreSession`/`loadBrequeProject` trocarem o `state.projectId`.
- `saveCurrentSession()` continua devolvendo uma promessa resolvida só depois da gravação, porque há chamadores com `await`, como `:5635`.

**Pronto quando**
- 20 chamadas seguidas a `saveCurrentSession()` resultam em ≤2 `put` e 1 `indexedDB.open` (contados embrulhando os protótipos);
- trocar de projeto com uma gravação pendente grava no projeto antigo, e não no novo;
- `pagehide` grava a mudança pendente.

**Teste:** `T1.5a-c`.

**Risco:** **alto**. O erro clássico é gravar as faixas de A no id de B. Além disso, `onStudioSessionUpdated` passa a atualizar a contagem da Home com atraso; nenhum teste atual depende disso, segundo o grep.

**Dependências:** 1.1.

---

## Fase 2

### 2.1 Pad em pé
**Arquivos e linhas**
- `beatbox_studio.css:3334-3343`: `.track-header` com 156 px dentro de `@media (max-width:768px)`, que começa em `:2851`. O ~170 px do plano inclui padding e sombra.
- `index.html:500-502`: base de 330 px.
- `index.html:4810-4845`: os botões `art-brush-pill` (AB/MP/CT).

**Abordagem:** dentro de `@media (max-width:480px) and (orientation:portrait)`:
- `.track-header{width:120px;min-width:120px}`, com nome e seletor de levada em duas linhas;
- trocar o grupo de botões de toque por um botão `.btn-brush-popover` ("AB ▾") que abre um popover com as articulações e o apagar;
- reaproveitar o fechamento por Esc e clique fora dos popovers que já existem.

**Pronto quando:** em 375×740, o cabeçalho tem ≤125 px, ficam visíveis ≥8 `.step-cell` na primeira linha e todas as articulações podem ser escolhidas pelo popover.

**Teste:** `T2.1` (tier6_mobile.test.js, com `Emulation.setDeviceMetricsOverride`).

**Risco:** **alto**. O `menus_usability_responsive.test.js:457-480` exige, em 390×844, `nameWidth ≥ 55`, `.inst-groove-select ≥ 65`, slider sem estourar, régua alinhada (≤1,5 px) e 8 cabeçalhos. Também é preciso manter `.track-header` e `.track-info` (contrato do PROJECT.md).

**Dependências:** 2.4 (botão do popover com 44 px) e P6.

### 2.2 Estúdio vazio em 375 px
**Correção ao plano.** O `.empty-hero-actions` **já tem** `flex-wrap: wrap` (`beatbox_studio.css:3799-3805`). Medi a causa real: `.reaper-daw-main{min-width:880px}` (`css:876`). O hero fica centralizado numa pilha de 880 px (x=162, w=570), e os botões caem em x=223–671 numa tela de 375 px.

**Abordagem:** no ramo vazio do `renderTimeline` (`beatbox_studio.js:~1085-1112`), aplicar `dom.reaperDawMain.classList.toggle('is-empty', state.tracks.length===0)`. No CSS: `.reaper-daw-main.is-empty{min-width:0}` e `.studio-empty-project-hero{max-width:min(680px,100%);box-sizing:border-box}`. Juntar as regras duplicadas de `:3715/3727`.

**Pronto quando:** em 375×740 com o projeto vazio, todo `button` do hero tem `left≥0` e `right≤375`, e `#reaperDawScroll.scrollWidth ≤ clientWidth+1`. Com 1 faixa, `min-width` volta a 880 px.

**Teste:** `T2.2`.

**Risco:** baixo. Os testes de TCP fixo (sticky) e de scroll rodam com faixas.

**Dependências:** nenhuma.

### 2.3 Aviso "Gire o celular"
**Arquivos e linhas:** `index.html:1222-1228` (marcação), `:6668-6694` (`checkOrientation`, chave do sessionStorage) e `beatbox_studio.css:2784` e `:2940-2960`.

**Abordagem**
- `.btn-orient-close{min-width:44px;min-height:44px}`.
- Guardar o fechamento em `localStorage` (com `try/catch`), lendo as duas chaves.
- `isMobile = Math.min(innerWidth, innerHeight) < 600`, para não aparecer em tablet 768×1024 em pé.
- Se o aviso cobrir a linha da Caixa, deslocar com `bottom` acima da barra.

**Pronto quando**
- em 768×1024 em pé: `display:none`;
- em 390×844 no Pad e na timeline: `flex`;
- depois de fechar e recarregar, continua `none`;
- o botão de fechar tem ≥44×44.

**Teste:** `T2.3`.

**Risco:** o `menus_usability_responsive.test.js:36-68` limpa só `sessionStorage` e espera `flex` em 390. Atualizar esse teste para limpar também o `localStorage`.

**Dependências:** 2.4.

### 2.4 Alvos de toque de 44 px
**Arquivos e linhas**
- `@media (max-width:768px)` em `beatbox_studio.css:2851-3586`;
- `@media (max-height:500px) and (orientation:landscape)` em `:3587+`, onde há `!important` no header e as abas caem para 20 px;
- `index.html:1714` (`btnStudioTap` 28×28 e BPM ±);
- abas Faixas/Mosaico/Cabine com 28 px, voltar e novo breque com 32 px.

**Abordagem:** criar o token `--touch-min:44px`. Nos botões só de ícone, **aumentar a área de toque sem aumentar o desenho**: `position:relative` mais `::after{content:'';position:absolute;inset:-8px}`. Nos botões com texto, usar `min-height:44px`.

**Pronto quando:** em 375×740 e 844×390, nas abas Home, Pad e Estúdio (com 1 faixa), todo elemento interativo visível tem área de toque ≥44×44. A área conta como válida se `elementFromPoint` nos pontos centro±22 px (horizontal e vertical) cai no próprio elemento ou num descendente.

**Teste:** `T2.4` (varredura genérica, com a lista de exceções explícita).

**Risco:** **alto**. Os testes do menus exigem toolbar de desktop ≤68 px (`:433`), toolbar do celular sem estouro horizontal, popovers dentro da tela e `inViewport` do kebab. Os `::after` sobrepostos podem roubar cliques de vizinhos (os testes de `elementFromPoint` em `:300-315` ajudam a pegar isso).

**Dependências:** 2.1, 2.2 e P9.

### 2.5 Liberar o zoom
**Arquivo:** `index.html:7`, que passa a ser `content="width=device-width, initial-scale=1.0, viewport-fit=cover"`. Adicionar `touch-action: manipulation` em `.step-cell` e nos botões de transporte, contra o zoom por toque duplo (já existe em `css:2780`). Os `input` no celular precisam de `font-size ≥16px`, senão o iOS dá zoom ao focar.

**Pronto quando:** a meta não casa com `/user-scalable=no|maximum-scale/`, e o `touchAction` calculado de `.step-cell` é `manipulation`.

**Teste:** `T2.5`.

**Risco:** baixo.

### 2.6 Contraste
**Arquivos e linhas:** cores das notas em `index.html:798-970`: `.note-forte` (FT), `.note-meio` (CE), `.note-abafado` (AF) e `.note-fraco`/`.note-intermedio` (FR). `.ruler-sub-label` em `beatbox_studio.css:964` (#5C5D66 → #8A8B96) e `.home-badge-pill.pill-native` em `:4549` (texto #247BB8 → #8EC5EC).

**Abordagem:** escurecer o fundo das notas (ou trocar o texto para escuro) até chegar a ≥4.5:1, porque o texto tem 9 px.

**Pronto quando:** uma função de contraste WCAG rodando na página, compondo o `rgba` sobre #121116, dá ≥4.5 para cada `art.css` de `INSTRUMENTS`, para `.ruler-sub-label` e para `.pill-native`.

**Teste:** `T2.6`, que cria um `.step-node.<css>` fora da tela e lê `getComputedStyle`.

**Risco:** médio (identidade visual). Nenhum teste compara cores (conferido com grep).

**Dependências:** P8.

### 2.7 Foco visível
**Arquivos e linhas:** 10 `outline:none` (`beatbox_studio.css:1118, 1367, 1792, 1969, 2299, 2430, 2724, 3975, 4827` e um no `<style>` do `index.html`). Hoje só existem 2 `:focus-visible` (`:4736` e `:5126`).

**Abordagem:** trocar cada `outline:none` por `:focus:not(:focus-visible){outline:none}` e criar a regra global `:focus-visible{outline:2px solid var(--naum-gold);outline-offset:2px}`.

**Pronto quando:** Tab via CDP (`dispatchKey('Tab')`) até `#btnPlay` deixa `outlineStyle` diferente de `none` e com largura ≥2px. Um clique com o mouse não deixa `:focus-visible`.

**Teste:** `T2.7`.

**Risco:** baixo.

### 2.8 Nome acessível
**Arquivos e linhas**
- `#bpmSlider` (`index.html:1788`) e `#studioBpm` (`:1716`);
- `inst-vol-slider` (`:4910-4917`, com `aria-label = Volume de ${inst.name}`);
- `btn-icon-mini` mudo/solo (`:4757`, `:4767`, com `aria-label` e `aria-pressed`);
- `btn-beat-tuplet` (`:4704`);
- os 2 botões de ícone do Estúdio;
- `#homeBrequeSearch` já tem `<label for>` (`:1283`). O problema dele é só a repetição do texto.

**Pronto quando:** em `#tab-sequencer` e `#tab-beatbox` (com 1 faixa), todo `button`, `input[type=range]` e `select` visível tem nome. Vale `aria-label`, `aria-labelledby`, `label[for]` ou texto com pelo menos uma letra; o `title` não conta.

**Teste:** `T2.8` (ou `Accessibility.getFullAXTree` via CDP).

**Risco:** baixo. **Não** remover o `title`: o `m1_challenger_adversarial.test.js:612` verifica o texto do tooltip.

**Dependências:** Fase 3. Fazer junto com a troca de ícones, para não rotular duas vezes.

### 2.9 prefers-reduced-motion
**Arquivos:** fim de `beatbox_studio.css` e do `<style>` do `index.html`, que somam 14 animações, 5 delas infinitas.
```css
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;
 animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
```
Manter o indicador de gravação sem animação, só com a cor.

**Pronto quando:** com `Emulation.setEmulatedMedia({features:[{name:'prefers-reduced-motion',value:'reduce'}]})`, todo elemento com `animationName≠none` tem `animationDuration≤0.00001s`.

**Teste:** `T2.9`.

**Risco:** baixo. Nenhum código espera `animationend`/`transitionend` (conferido com grep).

---

## Prova de conceito (0.1–0.4 e o achado no toast)
- Ambiente, só na cópia (`ambiente.diff`): caminho do Chromium do Playwright, `--no-sandbox` e porta 3125 em `harness.js`, `browser-verify.js` e `server.js`.
- Antes: suíte com 157/157. `repro_antes.log`:
  - XSS: `alert(7)` disparou 8 vezes, e o `<img>` foi injetado na Home;
  - bpm -120 e 1e9: a aba não respondeu em 8 s;
  - bpm "abc": "Pausar" mudo;
  - toast: `xss:true`.
- Depois: suíte com 166/166 (157 originais + 9 do `tier5_fase0_seguranca.test.js`). `repro_depois.log`:
  - XSS: 0 alertas, 0 `<img>`, a pílula mostra "120 BPM";
  - bpm -120→30, 1e9→300, "abc"→120, todos respondendo em 1–2 ms;
  - toast: `xss:false`.
- Contraprova: os 8 primeiros testes novos falharam todos (0/8) no código original, com o arquivo de teste copiado para uma árvore sem as correções. O `T0.2d` foi validado antes da correção pelo `tools/toast.js`, que deu `xss:true`.
- Diff do produto: `fase0.diff` (4 arquivos, +466/-91).
