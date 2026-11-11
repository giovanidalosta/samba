# Plano de Revisão — Naumteria[EXECUTADO] faixa de ajuda `#padHelpStrip` + legenda `?` com[EXECUTADO] ≤600px: cabeçalho de 112px, pílulas/levada/limpar num bottom sheet, scrollbars[EXECUTADO, parcial] ver nota abaixofinasaudiçãoStudio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** eliminar as perdas silenciosas de dados, tornar o app utilizável por teclado e leitor de tela, e preparar
as melhorias maiores de UX/arquitetura para decisão do dono do produto.

**Architecture:** PWA estático sem build. Pad/Home/diálogos no `<script>` inline de `index.html`; Estúdio em
`beatbox_studio.js` (IIFE exposta como `window.BeatboxStudio`); estilos em `beatbox_studio.css`. Testes E2E com
`node --test` dirigindo o Chrome via CDP (`tests/harness.js`, `launchBrowser()` → `session.evaluate(fn)`).

**Tech Stack:** Vanilla JS ES2020, Web Audio, IndexedDB, localStorage, Service Worker, Node 18+ (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-10-revisao-app.md` (os IDs U1, V3, B1… referem-se a ela).

## Global Constraints

- Sem bundler e sem dependências npm novas.
- Preservar todos os seletores listados em `PROJECT.md` → "Interface Contracts" (os testes dependem deles).
- Textos de UI em português do Brasil.
- `npm test` precisa terminar em 157+ testes, 0 falhas, depois de cada tarefa.
- Nada é feito na `main` nem enviado por push: todo o trabalho fica no branch `review/plano-revisao`.

## Review Focus

1. Usuário fecha a aba/PWA logo após tocar numa célula → a nota precisa estar salva (Task 1 cobre com `pagehide`).
2. Link compartilhado com JSON malformado, `g` ausente ou BPM absurdo (0, 9999) → ignorar ou limitar, sem quebrar o breque aberto (Task 2).
3. Link compartilhado aberto com um breque nativo do repertório aberto (id não-`custom:`) → nada é sobrescrito (Task 2).
4. Nome de faixa com `<img onerror>` mostrado em toast → precisa aparecer como texto (Task 4).
5. Foco por teclado sobre botões amarelos e escuros → anel visível nos dois (Task 3).

---

## Status das tarefas

| Task | Assunto | IDs da spec | Status |
|---|---|---|---|
| 1 | Autosave do Pad | U1 | [EXECUTADO] `0e5825c`, revisado em `fc67d4b` |
| 2 | Link compartilhado seguro | U2 | [EXECUTADO] `0e5825c`, revisado em `fc67d4b` + último commit |
| 3 | Foco visível, movimento reduzido, nomes acessíveis | V1, V3, V5 | [EXECUTADO] `f560626` |
| 4 | Toast seguro contra HTML | FE2 | [EXECUTADO] `f560626` |
| 5 | Rótulos: "Comp.", "Faixa de Áudio", badge 0ms | V6, V9 | [EXECUTADO] `f560626` |
| 6 | Servidor não expõe dotfiles | B1 | [EXECUTADO] `8639ee7`, allowlist em `fc67d4b` |
| 7 | Higiene: `.gitignore`, `PROJECT.md` | FE5, FE6 | [EXECUTADO] `8639ee7` |
| 8 | Breques órfãos "Ideia N" | U3 | [EXECUTADO] `58ac0a5` (descarta breque vazio do atalho ao voltar para a Home) |
| 9 | Confirmar antes de substituir um take | U4 | [EXECUTADO] Gravar arma faixa vazia; substituir pergunta, com "Salvar como nova faixa"; gancho `BeatboxStudio.__test` só para testes |
| 10 | Rotas por hash + botão Voltar | U5 | [EXECUTADO] hash `#/`, `#/b/<id>/pad|estudio`, popstate; `#breque=` tem prioridade |
| 11 | Onboarding do Pad + legenda de articulações | U6 | [AGUARDA APROVAÇÃO] |
| 12 | Mobile Pad compacto | U7, V8 | [AGUARDA APROVAÇÃO] |
| 13 | Limpeza de duplicidades e avisos | U8, U9, U10, V10 | [AGUARDA APROVAÇÃO] |
| 14 | Diálogos nativos → appDialog | U11 | [EXECUTADO] alert/prompt/confirm nativos → appAlert/appPrompt/appConfirm (offset usa appPrompt, não stepper inline: Ruling) |
| 15 | Grade acessível por teclado | V2 | [EXECUTADO] role=grid, gridcell, tabindex roving, setas + Enter/Espaço |
| 16 | Sistema visual: tamanhos, paleta, emojis, marca | V4, V7, V11, V6 marca | [EXECUTADO, parcial] piso 11px, sem emoji em seletores, "Estúdio" no lugar de "Studio Multitrack"; cores de transporte e CTA único NÃO feitos (decisão visual) |
| 17 | Offline real: pré-cache de áudio, soundbank adiado | B2, B3 | [EXECUTADO] SW pré-cacheia áudios, CACHE_NAME por hash (`npm run build:sw`), soundbank com defer |
| 18 | Dados: backup geral, storage.persist, esquema versionado | F, FE3 | [EXECUTADO] exportar/importar backup, persist(), esquema v1, cópia _bak (gravações do Estúdio não entram no backup) |
| 19 | Desfazer/refazer no Pad | F | [AGUARDA APROVAÇÃO] |
| 20 | Extrair JS inline de `index.html` | FE1 | [AGUARDA APROVAÇÃO] |
| 21 | Testes: cobertura do Pad/Home, deduplicação | FE4 | [AGUARDA APROVAÇÃO] |
| 22 | Decisão de produto: back-end para repertório oficial | B4 | [AGUARDA APROVAÇÃO] |

---

## Tarefas executadas

### Task 1: Autosave do Pad (U1)

**Files:**
- Modify: `index.html` (perto de `saveActiveBrequeState`, ~5907)
- Test: `tests/review_persistence.test.js` (novo)

**Interfaces:**
- Produces: `scheduleBrequeAutosave(): void` (debounce de 400 ms) e `flushBrequeAutosave(): void` (imediato), ambos em `window`.

- [x] **Step 1: Teste que falha.** `TR1.1`: cria o breque pelo fluxo real (botão "Montar no Pad" da Home), clica em `#tracksWrapper .step-cell` nº 4, dispara
  `window.dispatchEvent(new Event('pagehide'))` e verifica que o breque ativo em `localStorage['naumteria_custom_bateria_presets_v1']`
  tem `gridData.surdo1[4]` não nulo. `TR1.2`: clica na célula nº 8, espera 700 ms sem `pagehide` e verifica que ela está salva.
- [x] **Step 2:** `node --test tests/review_persistence.test.js` → FAIL (gridData[4] null).
- [x] **Step 3: Implementar.** Listeners `pointerup`, `change`, `input` e `keyup` no `document` → `scheduleBrequeAutosave()`
  (só com o Pad aberto; marca o breque atual como *dirty*). `pagehide`, `visibilitychange` (estado `hidden`), `openBrequeProject`
  e `createNewBrequeProject` → `flushBrequeAutosave()`, que só salva se houver um *dirty* pendente **e** ele for o breque ativo.
  `TR1.3`: só visualizar não regrava o breque.
- [x] **Step 4:** teste PASS; `npm test` verde.
- [x] **Step 5:** commit `fix(pad): autosave do breque ao editar e ao fechar a página`.

### Task 2: Link compartilhado seguro (U2)

**Files:** Modify `index.html:5207` (`checkSharedBrequeUrl`); Test `tests/review_persistence.test.js`.

- [x] **Step 1: Testes.** `TR2.1`: com o breque custom aberto e 1 nota salva, aplica `location.hash = 'breque=' + b64({b:99,g:{caixa:[...]}})`,
  volta para a Home → o breque salvo continua com o `bpm` e o `gridData.surdo1` originais e **não** tem `bpm` 99.
  `TR2.2`: hash com base64 inválido → nenhuma exceção, e o título do cabeçalho não muda. `TR2.3`: `b: 9999` → `state.bpm` limitado ao `max` do
  `#bpmSlider` (80–170), com o slider concordando; `c: 0` → `measures` ≥ 1. `TR2.4`: o hash **permanece** após carregar (o reload
  reabre o breque compartilhado ainda não salvo) e some ao abrir ou criar outro breque. `TR2.5`: ao salvar o compartilhado, o hash some
  e o registro não herda `stepMeta`/`loopGridData` do breque anterior.
- [x] **Step 2:** FAIL.
- [x] **Step 3: Implementar.** Ordem: validar o payload (`g` precisa ser objeto de arrays; `b` limitado ao min/max do slider; `c` limitado a [1, 32]);
  `flushBrequeAutosave()`; `state.activeBrequeId = null`; `state.activeBrequeName = 'Breque compartilhado'`; `updateHeaderBrequeTitle()`;
  aplicar; zerar `stepMeta`/`loopGridData`/`selectedGroove`; `BeatboxStudio.loadBrequeProject('shared_breque')`. `clearSharedBrequeHash()`
  em `openBrequeProject`, `createNewBrequeProject` e no "Salvar" de Meus Breques.
- [x] **Step 4:** PASS + `npm test`.
- [x] **Step 5:** commit `fix(share): link compartilhado não sobrescreve o breque aberto e valida o payload`.

### Task 3: Foco visível, movimento reduzido, nomes acessíveis (V1, V3, V5)

**Files:** Modify `beatbox_studio.css` (final do arquivo), `index.html:1161` (alt) e o botão "+" do cabeçalho mobile; Test `tests/review_a11y.test.js`.

- [x] **Step 1: Testes.** `TR3.1`: `document.querySelector('#btnHeaderNewBreque')` recebe foco por teclado (Tab via CDP) →
  o `outlineStyle` calculado é diferente de `none`/`auto` e a `outlineColor` é a cor de destaque (`--accent` amarelo).
  `TR3.2`: `img.brand-logo` tem `alt === 'Naumteria Studio'`. `TR3.3`: todo `button` visível da Home tem nome acessível
  (`aria-label` ou texto) sem emojis isolados, ou seja, o nome casa com `/[A-Za-zÀ-ú]{3,}/`.
- [x] **Step 2:** FAIL.
- [x] **Step 3:** `:focus-visible { outline: 2px solid var(--accent-color…); outline-offset: 2px; }` usando o token de amarelo existente;
  bloco `@media (prefers-reduced-motion: reduce)` que zera `animation-duration`/`transition-duration`; corrigir o `alt`;
  `aria-label="Novo breque"` no botão "+".
- [x] **Step 4:** PASS + `npm test`.
- [x] **Step 5:** commit `fix(a11y): foco visível, movimento reduzido e nomes acessíveis`.

### Task 4: Toast seguro (FE2)

**Files:** Modify `index.html:2285` (`window.appToast`); Test `tests/review_a11y.test.js`.

- [x] **Step 1:** `TR4.1`: `appToast('<img src=x onerror="window.__xss=1">')` → nenhum `img` dentro do toast e `window.__xss` indefinido.
- [x] **Step 2:** FAIL. **Step 3:** montar os dois `<span>` com `textContent`. **Step 4:** PASS. **Step 5:** commit `fix(ui): toast trata a mensagem como texto`.

### Task 5: Rótulos (V6, V9)

**Files:** Modify `beatbox_studio.js:699, 1073, 1683, 1235, 990, 1599, 1655`, `beatbox_studio.css`; Test `tests/review_a11y.test.js`.

- [x] **Step 1:** `TR5.1`: com 1 faixa no Estúdio, a régua não contém `/\bBar\b/` e contém `Comp. 1`. `TR5.2`: o card do Mosaico não contém "Boca".
  `TR5.3`: com `offsetMs === 0`, `.item-sync-badge` tem a classe `is-zero` e `display: none`; com `offsetMs = 20`, não tem `is-zero`.
  O texto do badge continua `+0ms`/`+20ms` (os testes M2.2 leem esse texto).
- [x] **Step 2:** FAIL. **Step 3:** trocar os textos; alternar `is-zero` nos 4 pontos que escrevem o badge; CSS `.item-sync-badge.is-zero{display:none}`.
- [x] **Step 4:** PASS + `npm test`. **Step 5:** commit `fix(studio): rótulos em português e badge de sync escondido com 0ms`.

### Task 6: Servidor não expõe dotfiles (B1)

**Files:** Modify `server.js`; Test `tests/review_server.test.js`.

- [x] **Step 1:** `TR6.1`: `GET /.git/config` → 404. `TR6.2`: `GET /index.html` → 200. `TR6.3`: `GET /assets/audio/sn_2e.mp3` → 200 com `Cache-Control` contendo `max-age`.
- [x] **Step 2:** FAIL. **Step 3:** responder 404 a qualquer segmento do caminho começado com `.`; para `/assets/audio|fonts/` usar `Cache-Control: public, max-age=604800`.
- [x] **Step 4:** PASS + `npm test`. **Step 5:** commit `fix(server): bloqueia dotfiles e cacheia assets estáticos`.

### Task 7: Higiene (FE5, FE6)

- [x] Adicionar `.playwright-mcp/` ao `.gitignore`; em `PROJECT.md`, marcar M1–M3 como DONE e acrescentar a linha "M5: Revisão 2026-11-10 → ver docs/superpowers/plans/2026-11-10-revisao-app.md".
- [x] Commit `chore: gitignore de artefatos e status do PROJECT.md`.

---

## Tarefas que aguardam aprovação (decisões de produto ou mudanças grandes)

Cada uma traz a recomendação e o motivo de precisar do seu OK.

- **Task 8 (U3) Breques órfãos.** Recomendo criar o breque "Ideia N" apenas no primeiro take salvo **ou**, ao voltar para a Home,
  apagar automaticamente o breque criado pelo atalho se ele tiver 0 notas e 0 faixas gravadas. *Por que aprovar:* muda quando um breque passa a existir.
- **Task 9 (U4) Take por cima.** A Cabine deve pré-selecionar a primeira faixa **vazia** (ou "+ Nova faixa"); ao salvar um take numa faixa
  já gravada, `appConfirm("Substituir a gravação de X?")` com a opção "Salvar como nova faixa". *Por que aprovar:* muda o fluxo de gravação.
- **Task 10 (U5) Rotas.** `#/`, `#/b/<id>/pad`, `#/b/<id>/estudio` com `history.pushState`; `popstate` chama `switchTab`.
  Precisa conviver com `#breque=` (link compartilhado). *Por que aprovar:* toca em toda a navegação.
- **Task 11 (U6) Onboarding do Pad.** Faixa de ajuda acima da grade vazia ("Toque numa célula para marcar; toque de novo para trocar
  a articulação") e legenda por naipe num popover "?" que mostra sigla → nome → som (com audition). Os nomes já existem em `inst.articulations[].name`.
- **Task 12 (U7, V8) Mobile Pad.** Até 600px: cabeçalho do naipe com 112px e só nome + M/S; pílulas de articulação e o "Preencher levada"
  passam para um bottom sheet ao tocar no nome; estilizar as scrollbars (`scrollbar-width: thin; scrollbar-color`).
- **Task 13 (U8–U10, V10)** Remover o botão "Pad" duplicado da toolbar do Estúdio; um único "×" por card do Mosaico; na Cabine, o
  transporte "Gravar" e o "Iniciar Gravação" viram o mesmo controle; nunca mostrar o aviso "Gire o celular" na Cabine; mostrar no máximo
  um aviso por vez; esconder "Cortar [S]" sem faixas e o "[S]" em telas sem teclado (`@media (hover: none)`); corrigir a sobreposição MIC/selo.
- **Task 14 (U11)** Trocar os 26 `alert/confirm/prompt` nativos por `appAlert/appConfirm/appPrompt` (já existem) e o offset em ms por um
  stepper inline. Os testes aceitam diálogos nativos via CDP, então será preciso ajustar os testes que dependem disso.
- **Task 15 (V2)** Grade com `role="grid"`, células `role="gridcell"` + `tabindex` roving + `aria-label="Surdo de 1ª, compasso 1, tempo 2, semicolcheia 3: MP"`;
  setas navegam e Enter/Espaço alternam.
- **Task 16 (V4, V7, V11, marca)** Tamanho mínimo de 11px; tokens de transporte usando a paleta Naumteria (Reproduzir amarelo, Gravar vermelho
  menos saturado); um só CTA amarelo por barra; remover emojis restantes (`<option>`, pílulas, nomes); padronizar a marca como "Naumteria Studio".
  *Por que aprovar:* é decisão de identidade visual.
- **Task 17 (B2, B3)** Botão "Baixar sons para usar offline" em Configurações, pré-cacheando `assets/audio/*`, com barra de progresso; ou pré-cache
  automático no `install`. Carregar o `soundbank.js` com `defer` e usá-lo só como fallback. Gerar `CACHE_NAME` a partir de um hash.
- **Task 18 (dados)** "Exportar todos os breques" / "Importar backup" (JSON único), `navigator.storage.persist()` no primeiro save, chave de
  versão `naumteria_schema_v`, e guardar uma cópia `.bak` antes de sobrescrever um JSON corrompido.
- **Task 19 (undo)** Pilha de 50 snapshots de `gridData` no Pad (Ctrl+Z / botão), integrada ao autosave da Task 1.
- **Task 20 (FE1)** Extrair o `<script>` inline para `js/ui-dialogs.js`, `js/pad.js`, `js/home.js` e `js/share.js`, como scripts clássicos na mesma
  ordem, sem mudar comportamento, um arquivo por commit, com `npm test` entre cada um. Acrescentar ao SW `CORE_ASSETS`.
- **Task 21 (FE4)** Testes do Pad/Home (criar, editar, excluir, preset, compartilhar, exportar JSON); fundir os arquivos `challenger_*`
  duplicados; um `npm run test:quick` só com os testes da revisão.
- **Task 22 (B4)** Decidir se o repertório oficial deve ser publicado sem deploy (precisa de back-end: Supabase/Firebase ou JSON
  estático versionado no próprio repositório). Recomendo o JSON estático (`repertorio.json`) antes de qualquer back-end.

---

### Notas das Tasks 11–13

- Task 12: tocar no nome do naipe continua tocando o timbre e, no celular, também abre o sheet.
- Task 13, **Ruling:** o botão "Importar do Pad" faz algo diferente do seletor de modo "Pad"; em vez de removê-lo, o rótulo curto do celular
  ("Pad") foi removido (fica só o ícone, com `aria-label`). Custo se errado: trocar por texto curto.
- Task 13: um só "✕" por card do Mosaico (o de remover gravação virou "⌫ Limpar gravação"); "Cortar [S]" só com faixas gravadas e sem o "[S]" em telas sem hover;
  o botão Gravar do dock some na Cabine (resta "Iniciar Gravação"); aviso de fones tem prioridade sobre "Gire o celular", que já não aparecia na Cabine.
- Task 13 **não feita:** sobreposição MIC/selo (V10) — precisa de verificação visual no celular.

## Ordem sugerida após aprovação

1. Tasks 8, 9 (dados/fluxo) → 2. Tasks 11, 12, 13 (UX mobile) → 3. Task 10 (rotas) → 4. Tasks 14, 15, 16 → 5. Tasks 17, 18, 19 → 6. Tasks 20, 21 → 7. Task 22.

---

## Notas de execução (2026-11-10)

- Suíte final: **177 testes** (157 originais + 20 novos), 177/177 após as correções do code-review. Rodadas: 1ª com 19 testes *cancelados* no `before` do primeiro
  arquivo (`challenger_m1_adversarial`: subida do Chrome/servidor quando não há servidor rodando), 2ª e 3ª com 172/172.
  É intermitência do harness, não regressão: o arquivo isolado passa. Sugestão: na Task 21, aumentar a espera de
  `launchBrowser()` ou subir o servidor uma vez via `--test-global-setup`.
- U1 também foi verificado manualmente no navegador: marcar nota → recarregar imediatamente → nota preservada.
- A auditoria usou os perfis do Playwright e do harness, separados do seu Chrome; nenhum breque seu foi tocado.
- Não foram executadas as Tasks 8–22: elas mudam fluxo, identidade visual ou arquitetura e precisam do seu OK.

### Code-review do branch (skill `code-review`, nível medium)

Os 10 achados foram avaliados e corrigidos em `fc67d4b` e no commit seguinte: autosave com *dirty flag* por breque,
flush ao trocar de breque, link compartilhado sem vazamento de stepMeta/loop e com o Estúdio desligado do breque anterior,
BPM limitado ao slider, hash mantido até salvar ou abrir outro breque, allowlist no servidor (inclui nomes 8.3 do Windows),
URL malformada → 400 e formatação de offset centralizada.

### Limitações conhecidas

- O *dirty flag* do autosave é marcado por qualquer interação no Pad (por exemplo, apertar Play), não só por mudanças na grade.
  Apertar Play e depois sair da aba ainda regrava o `updatedAt`. Para refinar, chamar `scheduleBrequeAutosave()` só nos pontos de
  mutação (junto da Task 19, undo).
- A sessão do Estúdio para links compartilhados usa um id único, `shared_breque`: gravações feitas sobre o link A reaparecem ao abrir
  o link B, e salvar o compartilhado em Meus Breques não leva essas gravações junto. Isso vai para as Tasks 9 e 18.
- O `TR2.5` é um teste fraco: o breque recém-criado já tem `stepMeta` vazio, então ele não prova o vazamento. O teste forte exige
  expor `state` ou criar uma nota com velocidade via UI (Task 21).
- O FE7 (`POST /__save_custom_grooves` morto + cópia para a área de transferência) foi encontrado, mas não removido.
