# Revisão completa — Naumteria Studio (achados / spec)

> Data: 2026-11-10 · Branch: `review/plano-revisao` · Base: `main@8c03a2f`
> Método: app rodando localmente (`node server.js`), navegado com Playwright em 390×844 (mobile) e 1280×800 (desktop),
> leitura do código (`index.html`, `beatbox_studio.js`, `beatbox_studio.css`, `sw.js`, `server.js`), suíte `npm test` (157/157 passando),
> checklist da skill `ui-design-review:ui-review`.
> Cada achado marcado **[REPRODUZIDO]** foi confirmado no navegador; **[CÓDIGO]** foi visto só no código.

---

## 1. Objetivo e personas

**O que o app é:** PWA offline da Bateria Universitária Naumteria (UNESP Bauru) para **criar, ouvir e ensaiar breques**.
São dois modos dentro de cada "breque":
- **Pad / Sequenciador:** grade de 8 naipes (surdos 1ª/2ª/3ª, caixa, repique, tamborim, agogô, ganzá) com articulações,
  levadas-base, presets do repertório, export JSON, link de compartilhamento.
- **Estúdio Multitrack:** gravação por microfone ou câmera com metrônomo e contagem 1-2-3-4, timeline estilo DAW,
  Mosaico de vídeo, corte, offset/latência, export WAV e vídeo.

**Personas:**
1. **Ritmista** (maioria, no celular): abre um breque do repertório, ouve, estuda e grava a própria parte por cima.
2. **Mestre / diretoria de bateria** (desktop + celular): compõe breques no Pad e manda por link no WhatsApp.
3. **Ritmista novo:** não conhece siglas (AB, MP, FT, RS...), precisa entender o que cada naipe toca.

**A ação que precisa ser óbvia:** "abrir um breque → ouvir → (editar ou gravar) → **não perder nada**".

**Leitura geral:** o produto já é rico em funcionalidades e a suíte de testes cobre bem o Estúdio. Os maiores riscos hoje
não são de funcionalidade que falta, e sim de **confiança nos dados**: três caminhos reproduzidos perdem ou corrompem
trabalho em silêncio. Em seguida vêm acessibilidade/teclado e a densidade da interface no mobile.

`PROJECT.md` está desatualizado: R1.1–R3.4 (M1–M3) já estão implementados no código (sync pill, limite de faixas
`is-capped`, `border-left` transparente, clamp de 96% removido), mas a tabela ainda marca tudo como PLANNED.

---

## 2. Fluxos de uso

| # | Fluxo | Situação |
|---|---|---|
| F1 | Home → "Montar no Pad" → cria "Breque N" → edita grade | Funciona, mas **as edições só são salvas ao trocar de aba ou voltar para a Home** (ver U1) |
| F2 | Home → "Gravar uma ideia" → Cabine | Funciona, mas cria o breque "Ideia N" **antes** de gravar; ao voltar sem gravar sobra um breque vazio na Home (U3) |
| F3 | Pad → "Enviar p/ Estúdio" / "Importar do Pad" | Importa só os naipes que têm notas: ok. O card do Mosaico mostra o rótulo "Faixa de Áudio (Boca)", herança do app beatbox (V6) |
| F4 | Link compartilhado `#breque=` | **Sobrescreve o breque aberto** e o cabeçalho continua com o nome antigo (U2). O hash fica na URL e é reaplicado |
| F5 | Botão Voltar do navegador / Android | A URL nunca muda (`/`). O Voltar do Android **fecha o app** em vez de voltar à Home (U5) |
| F6 | Gravar um novo take numa faixa que já tem gravação | `keepCurrentTake()` substitui a mídia sem confirmação e sem desfazer (U4) |
| F7 | Offline (PWA) | Áudios `.mp3`/`.wav` não são pré-cacheados: o primeiro uso offline de um naipe nunca tocado fica mudo (B2) |

---

## 3. Usabilidade

### Precisa corrigir
- **U1 [REPRODUZIDO] Perda de edições no Pad.** `saveActiveBrequeState()` (`index.html:5907`) só roda ao trocar de aba
  (`switchTab`), ao renomear e em "Salvar". Com a ordem nota → recarregar a página, a 2ª nota sumiu: estava 1 nota
  salva no `localStorage`, contra 2 na tela. Fechar a aba, o celular matar o PWA ou acabar a bateria = trabalho perdido.
  Não há `pagehide`/`beforeunload`.
- **U2 [REPRODUZIDO] Link compartilhado sobrescreve o breque aberto.** `checkSharedBrequeUrl()` (`index.html:5207`)
  escreve em `state.*` sem limpar `state.activeBrequeId`; o `switchTab` seguinte salva a grade recebida **dentro do breque
  do usuário**. Teste: abrir "Breque 1", aplicar o hash com `b:99` → o armazenamento passou a ter `bpm: 99` e a grade da
  caixa substituída. O payload também não é validado (`state.gridData = data.g`).
- **U3 [REPRODUZIDO] Breques órfãos.** "Gravar uma ideia" + Voltar deixa "Ideia N" vazio na lista (2 → 3 breques).
- **U4 [CÓDIGO] Take novo substitui o anterior sem aviso** (`beatbox_studio.js:2978`). A Cabine pré-seleciona a faixa
  1 mesmo quando ela já tem gravação ("Faixa 1: Surdo de 1ª (Gravada)").
- **U5 [REPRODUZIDO] Sem histórico de navegação.** Home/Pad/Estúdio não geram entradas no histórico; o gesto de voltar
  no Android sai do app.

### Deveria corrigir
- **U6** Pad sem estado vazio/ajuda: grade preta sem explicar que tocar numa célula percorre as articulações
  (vazio → AB → MP → …). As siglas (AB, MP, AF, CT, AR, RL, FT, FR, RS, RF, CE, MA, MD, AG, B1–B4) não têm legenda.
- **U7** Mobile Pad: o cabeçalho de cada naipe ocupa cerca de 40% da largura, com scrollbar nativa branca dentro dele;
  os nomes ficam truncados ("Caixa de …"); só cabe ~1 tempo da grade na tela.
- **U8** Dois botões de gravar na Cabine ("Iniciar Gravação" + "Gravar" no transporte); dois "×" de excluir no card do
  Mosaico; "Pad" aparece duas vezes no Estúdio (switch do cabeçalho + botão da toolbar).
- **U9** Avisos empilhados: o aviso de fones e o "Gire o celular" aparecem juntos na Cabine mobile; o de girar não faz
  sentido na Cabine e cobre o conteúdo.
- **U10** Atalho "Cortar [S]" aparece no mobile e com a timeline vazia (atalho de teclado sem teclado).
- **U11** 26 `alert()`/`prompt()`/`confirm()` nativos convivem com `appAlert`/`appConfirm`/`appPrompt` do próprio app;
  o offset em ms usa `prompt()` nativo.

### Detalhe
- **U12** O texto da Home diz "120 BPM", mas o preset principal é de 130 BPM, uma inconsistência pequena.

---

## 4. Visual

O que já funciona: identidade forte (preto + amarelo Naumteria, fonte display Diamante), o switch Pad/Estúdio está claro
e o estado vazio do Estúdio, com três ações, está bem resolvido.

### Precisa corrigir (acessibilidade)
- **V1 [REPRODUZIDO] Foco invisível.** Não há `:focus-visible` global (só em 2 componentes); o foco nativo
  calculado é `outline: auto 1px rgb(16,16,16)` sobre fundo quase preto. Existem 10 regras `outline: none`.
  Navegar por teclado é impraticável.
- **V2 [CÓDIGO] Células da grade são `<div>` sem `tabindex`/`role`/`aria-label`**: o Pad é inacessível por teclado e leitor de tela.
- **V3 [REPRODUZIDO] Nomes acessíveis ruins:** o botão do cabeçalho mobile se chama "➕"; o logo tem `alt="Logo Naumtestudio"`
  (erro de digitação); botões "M", "S", "✕", "⏹", "3x" sem rótulo descritivo.
- **V4 [CÓDIGO] Textos de 6–9px** (10 regras; o badge da Home tem 9px) e pílula "0/1 Faixas" com contraste de ~1.8:1.
- **V5 [CÓDIGO] Sem `prefers-reduced-motion`.**

### Deveria corrigir
- **V6** Rótulos herdados/mistos: "Faixa de Áudio (Boca)" no Mosaico (`beatbox_studio.js:699`) e "Bar 1" na régua
  (`beatbox_studio.js:1073, 1683`), enquanto o Pad usa "Compasso 1". Marca alternando entre "NAUMTE STUDIO" e "Naumteria Studio".
- **V7** Paleta do transporte do Estúdio (verde "Reproduzir" e vermelho "Gravar" saturados) foge do sistema amarelo/preto; no Pad,
  o "Reproduzir" é amarelo. Dois botões amarelos primários competem no Pad ("Reproduzir" e "Enviar p/ Estúdio").
- **V8** Scrollbars nativas brancas no mobile (timeline do Estúdio e cabeçalho do naipe).
- **V9** Badge "+0ms" no clipe aparece mesmo com offset zero (R2.2 previa esconder).
- **V10** Medidor "MIC" sobrepõe o selo "Captação Direta de Microfone" na Cabine mobile.
- **V11** Emojis restantes na marcação (🥁 🎙️ 🏛️ ⭐ 💾 🗑) apesar do commit 8c03a2f ("eliminação de emojis"):
  aparecem em `<option>`, nomes acessíveis e pílulas da Home.

---

## 5. Funcionalidades

- **Faltam (alto valor para a persona):**
  - Desfazer/refazer no Pad e no Estúdio.
  - Indicador "salvo / salvando" (depende de U1).
  - Legenda de articulações por naipe (U6).
  - Duplicar breque.
  - Exportar/backup de *todos* os breques (hoje é JSON por breque; o `localStorage` some ao limpar dados do navegador).
  - `navigator.storage.persist()` para reduzir a chance de o navegador apagar o IndexedDB das gravações.
- **Bem resolvidas:** tap tempo, speed trainer, contagem pré-roll, calibração de latência, link de compartilhamento, export WAV/vídeo.
- **A revisar:** o link compartilhado não leva o nome do breque nem volumes por naipe de forma validada;
  o limite é 32 faixas no Estúdio (ok).

---

## 6. Front-end (arquitetura e código)

- **FE1** `index.html` tem 6.792 linhas: ~1.200 de CSS inline + **~4.500 linhas de JS inline** (Pad, Home, diálogos, link,
  tap tempo). `beatbox_studio.js` tem 5.736 linhas numa única IIFE. Comunicação entre as duas metades via `window.*`
  (`window.saveActiveBrequeState`, `window.BeatboxStudio`, `window.appConfirm`, `window.onStudioSessionUpdated`).
  Isso dificulta testes e revisão. Proposta: extrair o JS inline para `js/pad.js`, `js/home.js`, `js/ui-dialogs.js`,
  sem bundler (scripts clássicos, mesma ordem). **Aguarda aprovação: é refatoração grande.**
- **FE2** Duas `escapeHtml` (uma em cada arquivo); `appToast` usa `innerHTML` com nomes de faixa digitados pelo usuário
  (`index.html:2285`, chamado em `beatbox_studio.js:2255, 2286`), o que é XSS de si mesmo (baixo risco, mas trivial de corrigir).
- **FE3** Persistência dividida: breques no `localStorage` (`naumteria_custom_bateria_presets_v1`, `..._grooves_v1`),
  gravações no IndexedDB `SambaBrequeStudioDB`. Sem versão de esquema nem migração. `loadCustomBateriaPresets` (`index.html:4360`) devolve `{}` se o JSON estiver
  corrompido, e o próximo save grava por cima: um dado corrompido vira perda total silenciosa (melhor guardar uma cópia de backup antes).
- **FE4** Testes: 157 casos E2E via Chrome/CDP (`tests/harness.js`), todos verdes, quase todos no Estúdio. Lacunas: **nenhum
  teste de persistência do Pad**, link compartilhado ou Home. Arquivos duplicados por nome (`m1_challenger_adversarial`
  vs `challenger_m1_adversarial`).
- **FE5** `PROJECT.md` desatualizado (ver §1).
- **FE7 [CÓDIGO]** Ao salvar uma levada, `index.html:~4287` faz `POST /__save_custom_grooves`, endpoint que **não existe**
  em `server.js` (resquício de uma ferramenta em `tools/`, que está no `.gitignore`), e copia o JSON para a área de
  transferência sem avisar o usuário. Recomendo remover as duas coisas (Task 21).
- **FE6** `.playwright-mcp/` (artefatos de navegação) não está no `.gitignore`.

---

## 7. Back-end / PWA / infraestrutura

Não existe back-end de aplicação: `server.js` é um servidor estático de 60 linhas, sem API, sem banco e sem autenticação.
Todos os dados ficam no aparelho. Os pontos reais:

- **B1 [REPRODUZIDO]** `server.js`: `GET /.git/config` → **200**. A proteção contra path traversal usa `startsWith(PUBLIC_DIR)`, que é ok, mas serve **qualquer arquivo** da pasta
  (`.git/`, `tests/`, `PROJECT.md`, `package.json`) quando hospedado assim. Se o deploy de produção usar este servidor,
  convém uma lista de permissões (allowlist). `Cache-Control: no-cache` em tudo, inclusive nos áudios imutáveis.
- **B2** `sw.js`: os áudios (`assets/audio/*.mp3|wav`, ~150 arquivos) **não** estão em `CORE_ASSETS`; eles são cacheados só
  depois de tocar uma vez. Offline real exige pré-cache (ou cache sob demanda ao abrir o app). `CACHE_NAME` é atualizado
  manualmente (`v24`).
- **B3** `soundbank.js` tem 540 KB embutidos e é carregado de forma síncrona antes do JS do app, o que atrasa o primeiro render no mobile.
- **B4** Sem servidor, não há sincronização entre aparelhos: o "repertório" está fixo no código. Se a diretoria quiser publicar
  breques oficiais sem editar código, isso exige um back-end (fora do escopo desta revisão; registrado como decisão de produto).
