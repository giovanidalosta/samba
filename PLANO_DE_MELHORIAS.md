# Plano de melhorias v2: Naumteria Studio

**v2: 10/11/2026.** Esta versão reavalia e substitui a v1. Ela junta 12 auditorias em duas rodadas, com 6 agentes em paralelo em cada uma. A segunda rodada verificou rodando o que a primeira só tinha lido, testou gravação e exportação de ponta a ponta, mediu o desempenho num celular simulado, percorreu as jornadas de uso, especificou a execução e criticou o próprio plano.

**Nada foi aplicado ao código do app.** A Fase 0 foi provada **numa cópia**: a suíte foi de 157 para 166 testes, todos passando, e o XSS e o travamento sumiram. O diff está pronto em `revisao/rodada2/prova-fase0/` e espera a sua aprovação.

**Legenda:**
- **Evidência:** `[R]` verificado rodando; `[L]` só lido no código.
- **Esforço:** P (até 1 h), M (1–3 h), G (mais de 3 h).
- **IDs:** cada item tem um ID (S1.3, S4.2…) para você citar ao responder.

---

## 1. O que mudou desde a v1

| v1 dizia | v2, depois de verificar |
|---|---|
| "Link compartilhado funciona" (eu afirmei) | **Errado.** Abrindo o link com o app fechado, o caso normal vindo do WhatsApp, ele cai na **tela inicial** `[R]`. Meu teste só cobria o app aberto. A sessão do notebook estava certa |
| 117 ou 125 áudios sem uso | **103** de 145 arquivos (127 mp3 + 18 wav). Apagar pela conta de 125 teria removido 8 wav em uso `[R]` |
| CSP como correção de XSS (0.5) | **Não funciona:** com `'unsafe-inline'` o script executa mesmo assim, e a CSP proposta bloqueava as fontes locais `[R]`. O que tem valor é `connect-src 'self'` |
| Toast quando o IndexedDB falha (1.1) | Não bastaria: quota cheia dispara `abort`, que o código não trata. A promise fica pendurada e o toast nunca apareceria `[R]` |
| Estúdio vazio: falta `flex-wrap` (2.2) | Causa errada: é `.reaper-daw-main{min-width:880px}` (`beatbox_studio.css:876`) `[R]` |
| Falta confirmação em Excluir e Limpar (1.3) | Já existe. Falta **desfazer** e confirmação ao Dividir clipe `[R]` |
| Aviso "abra por HTTPS" (4.4) | **Refutado:** o app já avisa `[R]` |
| `server.js` exposto: Alto | **Baixo:** o repositório já é público e o `server.js` é só de desenvolvimento |
| Sem auditoria de mídia | Gravação, WAV do Pad e corte de clipes **funcionam**. A exportação do Estúdio **satura** e o mosaico **perde as faixas a partir da 10ª** `[R]` |
| Sem medida de desempenho | Carga a frio de **10 s** em 3G com CPU 4x. Dá para chegar a ~2,5 s `[R]` |

**Novos achados:**
- licença das fontes comerciais num repositório público com Pages ativo;
- gravar por cima da guia **apaga a guia** sem aviso;
- XSS pelo toast;
- travamento no metrônomo do Estúdio;
- falso positivo na calibração;
- "Enviar p/ Estúdio" duplica a faixa de bateria;
- a faixa de BPM do Pad (80–170) não permite estudar devagar.

---

## 2. Diagnóstico por área

| Área | Estado | Resumo |
|---|---|---|
| Áudio do Pad | 🟢 bom | Tempo exato em 2/4, 4/4, fusa, tercina e sextina, de 95 a 300 BPM `[R]`. WAV com erro de duração ≤ 0,02 ms `[R]`. Atrasa até 73 ms quando você mexe na grade tocando `[R]` |
| Gravação (Cabine) | 🟢 bom | Contagem e metrônomo a 6 ms da grade; take persiste `[R]` |
| Exportação do Estúdio | 🔴 ruim | WAV satura (73% das amostras cortadas com 12 faixas); mosaico perde da 10ª faixa em diante; vídeo termina ~2 s antes do áudio `[R]` |
| Segurança de entrada | 🔴 ruim | XSS por link, por JSON e pelo toast; BPM inválido trava a aba `[R]` |
| Dados do usuário | 🟠 frágil | Erros de gravação não aparecem; armazenamento não persistente (Safari apaga em 7 dias); não há "exportar tudo"; gravar apaga a guia `[R]` |
| Jornada do link | 🔴 quebrada | Cai na tela inicial, perde o nome e é zerada por "Montar no Pad" `[R]` |
| Celular em pé | 🔴 ruim | Pad cortado, botões do Estúdio fora da tela, aviso "Gire" cobrindo a grade `[R]` |
| Acessibilidade | 🟠 fraca | Zoom bloqueado, 4 cores de nota abaixo de 4.5:1, foco invisível, 25 botões sem nome `[R]` |
| Desempenho | 🟠 médio | 1,67 MB no caminho crítico; sem vazamento de memória nem de listeners `[R]` |
| Testes e CI | 🟠 médio | 157 testes passando, mas só de layout; não rodam fora do Windows; sem CI |
| Jurídico e privacidade | 🔴 risco | Fontes Adobe e MyFonts redistribuídas em repo público; voz e imagem de estudantes sem opção de apagar tudo |

---

## 3. Antes de começar: 5 decisões que mudam a ordem

Estas perguntas estão repetidas na seção 9. Elas definem o que vem primeiro.

1. **D1. As fontes (Arboria, Myriad, Diamante) têm licença para web e para repositório público?** O repo é público e o Pages está ativo. Opções: **A) trocar por fontes livres parecidas** / B) tornar o repo privado / C) comprar a licença webfont.
2. **D2. Os links `#breque=` circulam fora do grupo?** Se sim, o S1 é urgente.
3. **D3. Qual a origem das amostras de áudio?** Gravação própria, banco livre ou outro? Isso decide se dá para pôr uma licença aberta.
4. **D4. O app é para estudo individual, para conduzir o ensaio ao vivo, ou para os dois?** Isso decide entre "modo ensaio" e "modo palco".
5. **D5. Tudo fica no aparelho e no link, ou vai haver contas e servidor?** Recomendo **tudo local** por agora.

---

## 4. Roadmap em sprints

Cada sprint termina com a suíte verde, um commit por item e um deploy testável.

### S1: proteger links, dados e gravações (~2 dias) · prioridade máxima

| ID | Item | Onde | Ev. | Esf. | Critério de pronto |
|---|---|---|---|---|---|
| S1.1 | `sanitizeBreque()` única para link, JSON, preset e sessão restaurada: BPM 30–300, compassos 1–32, compasso e subdivisão da lista permitida, articulações válidas, volumes 0–1,5, nunca lança | `index.html:5213-5249, 5476` | `[R]` | M | Link e JSON maliciosos do teste T0.1 não alteram o estado nem lançam erro |
| S1.2 | Escapar todos os templates `innerHTML` (BPM, compassos, volume, offset, id) e o **toast** | `index.html:2285, 6489`; `beatbox_studio.js:709-775, 1131-1140` | `[R]` | P | O payload `<img onerror>` salvo e recarregado não executa (8 → 0 alertas na prova) |
| S1.3 | Limite de iterações no agendador do Pad **e no metrônomo do Estúdio** | `index.html:5335`; `beatbox_studio.js:3077, 3091, 3122` | `[R]` | P | bpm −120 e 1e9 respondem em < 5 ms (antes: aba travada por mais de 8 s) |
| S1.4 | Import de projeto `.json` atômico: validar tudo, ids regenerados, só `data:` em `mediaDataUrl`, limite de 32 faixas, e só então trocar o estado | `beatbox_studio.js:5527-5565` | `[R]` | M | JSON ruim não altera o projeto aberto; 40 faixas são recusadas com aviso |
| S1.5 | **Link abre no Pad**, leva o nome do breque, oferece "Salvar nos meus breques" e limpa o `#breque=` da URL depois de aplicar | `index.html:5153, 5207-5242, 6783-6787` | `[R]` | P | Teste de página nova abre no Pad com o nome; recarregar não reaplica o link |
| S1.6 | Abrir link ou importar: parar o som e zerar `stepMeta` | `index.html:5240, 5476` | `[R]` | P | Acentos do breque anterior não aparecem no novo |
| S1.7 | **Gravar não substitui a guia:** gravar em faixa nova por padrão e pedir confirmação para regravar uma faixa existente | `beatbox_studio.js:532-546` | `[R]` | P | Depois de "Enviar p/ Estúdio" + gravar, existem 2 faixas |
| S1.8 | IndexedDB: tratar `tx.onabort`, mostrar toast de erro e pedir `navigator.storage.persist()` | `beatbox_studio.js:24-40` | `[R]` | P | Simular QuotaExceeded mostra o toast; a promise resolve ou rejeita |
| S1.9 | Ícones diferentes para **Excluir faixa** e **Limpar gravação** (hoje os dois são `✕`) | `beatbox_studio.js:1148, 1152` | `[R]` | P | Ícones distintos, com `aria-label` |
| S1.10 | Desfazer de 1 nível em Dividir clipe, Excluir e Limpar | `beatbox_studio.js:2262-2322, 4307` | `[R]` | M | "Desfazer" no toast restaura o estado |
| S1.11 | Remover `user-scalable=no, maximum-scale=1` | `index.html:7` | `[R]` | P | Pinça dá zoom |
| S1.12 | CSP mínima útil: `connect-src 'self'` (impede mandar gravações para fora); `font-src 'self' fonts.gstatic.com` | `index.html` (cabeçalho) | `[R]` | P | `fetch('https://outro.site')` é bloqueado; fontes locais carregam |

O diff de S1.1–S1.3 (mais o `server.js`, ver S6.6) já existe e passou em 166 testes. S1.4–S1.12 são novos.

### S2: rede de segurança (~1 dia)

| ID | Item | Ev. | Esf. | Critério de pronto |
|---|---|---|---|---|
| S2.1 | `tests/harness.js` portátil: `CHROME_BIN`, lista de caminhos Win/Mac/Linux, `--no-sandbox` no CI, `PORT` por variável | `[R]` | P | `npm test` passa em Linux sem editar nada |
| S2.2 | GitHub Actions rodando a suíte com o Chromium do Playwright a cada push e PR | `[L]` | P | Selo verde no PR |
| S2.3 | Testes dos fluxos críticos: link de página nova, salvar e recarregar (IndexedDB), import e export JSON, WAV do Pad (duração), gravação com dispositivo falso, payloads maliciosos (o `tier5_fase0_seguranca.test.js` já está pronto) | `[R]` | M | Pelo menos 15 testes novos, cada um falhando no código antigo |
| S2.4 | Trocar ~50 `setTimeout` fixos por `waitFor`; fundir `challenger_m1_*` com `m1_challenger_*`; mover `challenger_runner.js` e `browser-verify.js` para `tests/tools/` | `[L]` | M | Suíte estável em 5 execuções seguidas |

### S3: áudio e exportação corretos (~2–3 dias)

| ID | Item | Onde | Ev. | Esf. | Critério de pronto |
|---|---|---|---|---|---|
| S3.1 | **Limitador no WAV do Estúdio**, o mesmo teto do Pad | `beatbox_studio.js:3668`; ref. `index.html:3570` | `[R]` | P | 12 faixas: 0% de amostras saturadas (hoje 73%) |
| S3.2 | **Mosaico com grade dinâmica** `ceil(√n)` | `beatbox_studio.js:3411-3416` | `[R]` | P | Exportar 12 faixas mostra as 12 |
| S3.3 | Vídeo: desenhar por timer com timestamp, `requestData()` antes de `stop()`, aviso "mantenha a aba aberta" | `:3520-3524` | `[R]` | M | Duração do vídeo = duração do áudio ± 100 ms |
| S3.4 | Duração do projeto recalculada a cada exportação; modo Livre exporta até o fim real do conteúdo | `:442-452, 466-470` | `[R]` | P | Offset ±, corte e WAV com duração = conteúdo |
| S3.5 | Avisar quando uma faixa não decodifica no export; somar as faixas uma a uma (memória) | `:3651-3653` | `[R]` | M | Toast "1 faixa não entrou"; pico de memória menor com 32 faixas |
| S3.6 | Calibração: exigir 3 de 3 picos com dispersão < 10 ms, corrigir o viés de ~55 ms, falhar com mensagem clara quando não há caminho acústico | `:4633, 4753-4767` | `[R]` | M | Loopback 40 ms mede 40 ± 10; sem som, "não consegui ouvir os bipes" |
| S3.7 | Mensagens de microfone: separar permissão negada de "sem dispositivo", um aviso só, em português | `:2558-2561, 2622` | `[R]` | P | 1 aviso, texto em PT |
| S3.8 | "Enviar p/ Estúdio" substitui a faixa vinda do Pad (ou pergunta) em vez de criar outra | `:5604-5611` | `[R]` | P | 3 envios = 1 faixa de bateria |
| S3.9 | Agendador do Pad com antecedência de 100–120 ms; mute, solo e pincel atualizam só a linha afetada | `index.html:5340, 5352, 4763-4787` | `[R]` | M | Com toques durante a reprodução: 0 notas atrasadas (hoje 5 de 96, pior −73 ms) |
| S3.10 | WAV do Pad: choke da rufada no render offline, rampa partindo do volume real, `preloadSamples` aguardando de verdade, fallback sintético dentro do offline | `index.html:2866, 2969, 3235, 3340` | `[R]` | M | WAV do Pad igual ao que se ouve (cauda do tamborim sem +25%) |
| S3.11 | Cache de `buildExtendedRufadaBuffer`; metrônomo e pré-roll passando pelo limiter | `index.html:3074` | `[R]` | P | 9 rufadas = 1 buffer |
| S3.12 | `AudioContext` suspenso ou interrompido (iOS): retomar ou mostrar o estado real | `index.html:2805` | `[R]` | P | Suspenso, a UI mostra "Tocar" e não "Pausar" |
| S3.13 | Dividir clipe sem duplicar o blob inteiro no IndexedDB | `beatbox_studio.js:4323` | `[R]` | M | Dividir não dobra o armazenamento |
| S3.14 | IndexedDB com conexão única e salvamentos agrupados, capturando o `projectId` e gravando no `pagehide` | `:14-40` | `[R]` | M | 10 mudanças = 1 abertura; **nenhuma faixa vai parar no projeto errado** (risco alto, requer teste) |

### S4: celular e acessibilidade (~2–3 dias)

| ID | Item | Ev. | Esf. | Critério de pronto |
|---|---|---|---|---|
| S4.1 | Estúdio vazio: classe `is-empty` zera o `min-width: 880px` | `[R]` | P | Em 375 px os dois botões do hero ficam visíveis |
| S4.2 | Pad em pé: coluna do instrumento de ~170 para ~120 px, toques AB/MP/CT num popover | `[R]` | G | Em 390 px aparecem pelo menos 8 passos; atenção ao teste `menus_usability_responsive.test.js:457-480` |
| S4.3 | Aviso "Gire o celular": fechar com 44×44, lembrar que foi fechado, ocultar em ≥ 600 px e não cobrir a grade | `[R]` | P | Tablet em pé sem aviso |
| S4.4 | Alvos de toque de 44 px (área com `::after` para não aumentar a toolbar do desktop) | `[R]` | G | 0 alvos < 44 px no Pad e no Estúdio em 375 px |
| S4.5 | Contraste: notas FT/CE/AF/FR, `.ruler-sub-label`, `.pill-native` em ≥ 4.5:1 | `[R]` | M | Todas as cores medidas ≥ 4.5:1 |
| S4.6 | Foco visível (`:focus-visible` dourado) no lugar dos 9 `outline: none` | `[R]` | P | Tab mostra o anel em todos os controles |
| S4.7 | `aria-label` em sliders e nos 25 botões só de ícone (mantendo `title`, que os testes conferem) | `[R]` | M | 0 botões sem nome |
| S4.8 | `prefers-reduced-motion` global | `[R]` | P | Com a preferência ligada, as 5 animações infinitas param |
| S4.9 | Transporte (tocar e parar) sempre visível com o celular deitado | `[R]` | M | Em 844×390, tocar e parar visíveis sem rolar |
| S4.10 | Ampliar a faixa de BPM dos sliders: Pad 80–170 → 30–300 (ou 40–220), alinhada à sanitização | `[R]` | P | Breque a 130 estudado a 60% (78 BPM) |

### S5: desempenho e PWA (~1–2 dias)

Números medidos com CPU 4x, Fast 3G, carga a frio:

| ID | Item | Ganho medido/estimado | Esf. |
|---|---|---|---|
| S5.1 | Tirar o `soundbank.js` (541 KB em base64) do caminho crítico: carregar sob demanda os mp3/wav que já existem | DCL 10,1 → 6,2 s `[R]` | M |
| S5.2 | Service worker: cache-first versionado para os assets (hoje o soundbank vai sempre à rede) + timeout de 3 s no HTML + `.catch` no fetch + `ignoreSearch` + `.js` que não existe não devolve `index.html` | evita 10 s de recarga com cache expirado `[R]` | M |
| S5.3 | Logo de 1024² PNG (197 KB) para webp de 128 px | −190 KB `[R]` | P |
| S5.4 | JetBrains Mono local (some offline e bloqueia a renderização) | FCP −1,5–2 s em 3G (estimado) | P |
| S5.5 | Fontes OTF → woff2 com subset | −100–170 KB (estimado) | P |
| S5.6 | Hospedagem com brotli (Pages e Netlify já comprimem) | 1.675 → ~790 KB | — |
| S5.7 | Carregar o Estúdio só ao abrir a aba | −70 ms de CPU, −26,5 KB br | M |
| S5.8 | Manifest com `id` e ícones `any` e `maskable` separados | instalabilidade | P |
| | **Combinado** | caminho crítico 1.675 → ~215 KB; DCL ~10 s → **~2,5 s** | |

### S6: limpeza e projeto (~1 dia)

| ID | Item | Ev. | Esf. |
|---|---|---|---|
| S6.1 | Ícones SVG únicos no lugar de emojis e glifos (`⏹ ⏸ ⏳ ✂ ＋ ● ◎ ☵`); ponto de gravar vermelho de novo | `[R]` | M |
| S6.2 | Apagar as **63 regras CSS mortas** (~8,9 KB, lista na rodada 2) e `window.appAlert` | `[R]` | P |
| S6.3 | Apagar os **103 áudios sem uso** (`revisao/rodada2/audios_sem_uso_103.txt`) e os 14 que estão só no soundbank e nunca tocam | `[R]` | P |
| S6.4 | Apagar `fetch('/__save_custom_grooves')` (hoje responde 501) e o handler legado `.btn-tcp-clear` | `[R]` | P |
| S6.5 | Validar `customGrooves` antes de gravar no `localStorage`; `localStorage` em try/catch na inicialização | `[R]` | P |
| S6.6 | `server.js`: lista de arquivos permitidos, URL malformada → 400, `path.sep`, `PORT` (já no diff da prova) | `[R]` | P |
| S6.7 | `PROJECT.md` atualizado (32 faixas, M1–M4), README, LICENSE e autor, separando código e assets | `[L]` | P |
| S6.8 | Trocar os 46 `catch` vazios por log de depuração; extrair `meter === '2/4' ? 2 : 4` (9×), o limiter duplicado e o choke duplicado | `[L]` | M |

### S7: produto (depois de S1–S4)

Ordenado por impacto/esforço, a partir das jornadas percorridas no app:

| ID | Sugestão | Impacto | Esf. | Por quê |
|---|---|---|---|---|
| S7.1 | **Modo ensaio:** loop de compassos, andamento de 40–100%, ativar o speed trainer que já existe no código sem botão (`index.html:5082`) | Alto | M | É o centro do estudo em casa |
| S7.2 | **Setlist:** lista ordenada de breques, tocada em sequência | Alto | M | Preparar apresentação (o RoR Player faz isso com "Songs") |
| S7.3 | **Modo palco:** transporte fixo, botões ≥ 56 px, tela que não apaga (Wake Lock) | Alto | M | Uso no ensaio ao vivo |
| S7.4 | **Exportar, importar e apagar tudo** (backup em arquivo, LGPD) | Alto | M | Hoje, limpar o navegador perde tudo |
| S7.5 | **Mapa impresso por naipe**, só a grade (hoje corta no 2º compasso e imprime os controles) | Médio | M | Estudo no papel |
| S7.6 | **QR code** do link e link "só meu naipe" | Médio | P | Distribuir no ensaio |
| S7.7 | Legenda dos toques (AB, MP, AF, Ciclo…) no primeiro uso | Médio | P | O novato não lê a notação |
| S7.8 | Apito e chamada do mestre e contagem visível na barra | Médio | P | Convenção real da bateria |
| S7.9 | Versões do breque com data | Médio | M | Hoje cada link vira uma cópia solta |
| S7.10 | Link com acentos/velocidades e mudo/solo, comprimido (hoje 2,9–17 KB, cheio de `null`) | Médio | M | Fidelidade do que é compartilhado |
| S7.11 | Aviso de consentimento ao filmar e regra para publicar o mosaico | Médio | P | Imagem de estudantes |
| S7.12 | Tema claro (sol) | Baixo | M | Uso ao ar livre |

Fica para depois (exige servidor): comentários por compasso, colaboração em tempo real, contas.

### S8: modularização (por último, com CI verde)

Tirar as ~4.500 linhas de script inline do `index.html` para `js/*.js`, um commit por módulo: utils (`escapeHtml` duplicada), persistência, Pad, sequenciador, atalhos. Depois fatiar o `beatbox_studio.js` (áudio, timeline, gravação, exportação), mantendo `window.BeatboxStudio` como fachada. Atualizar a lista de permitidos do `server.js` (`js/`) e a CSP.

---

## 5. Linha do tempo sugerida

| Semana | Sprints | Entregável |
|---|---|---|
| 1 | Decisão D1 + S1 + S2 | App seguro contra links e JSON, dados protegidos, CI verde |
| 2 | S3 | Exportações corretas, Pad sem atrasos |
| 3 | S4 + S5 | Celular em pé, acessibilidade, carga de ~2,5 s |
| 4 | S6 + início do S7 (S7.1, S7.4, S7.6, S7.7) | App limpo, modo ensaio, backup, QR |
| 5+ | S7 restante, S8 | Setlist, modo palco, código modular |

---

## 6. Jurídico e privacidade

- **Fontes:**
  - `Arboria-Book.otf` ("Type-O-Tones… All rights reserved", kit MyFonts) e as duas Myriad (Adobe) estão num repo **público** com Pages ativo. É provável que a licença não permita isso.
  - A Diamante não tem metadados; a origem é desconhecida.
  - Resolver isso exige trocar de fonte **e reescrever o histórico do git**, ou tornar o repo privado.
- **Amostras de áudio:** procedência desconhecida. Sem isso, a licença do projeto (MIT/ISC) só pode cobrir o código.
- **Voz e imagem (LGPD):** são gravações de estudantes no aparelho. Faltam "apagar todos os meus dados", aviso de consentimento ao filmar e uma regra de quem autoriza publicar o mosaico.
- **XSS e o Pages:** a origem `giovanidalosta.github.io` é compartilhada por todos os sites Pages do dono. Um XSS aqui conseguiria ler gravações do IndexedDB. Esse é o motivo real para S1.1, S1.2 e S1.12.

---

## 7. O que já funciona bem (não mexer sem motivo)

- **Tempo do Pad:** exato em todas as fórmulas de compasso e subdivisões; o WAV do Pad tem duração precisa e pico limitado a −0,35 dBFS.
- **Cabine:** contagem, metrônomo e persistência confiáveis.
- **Corte, divisão e offset:** respeitados no WAV com erro de ±1 ms.
- **Memória:** sem vazamento de memória nem de listeners em 20 trocas de aba; heap estável.
- **Offline:** funciona depois da primeira carga; também abre por `file://`.
- **Nome de breque e de faixa:** já é escapado.
- **Confirmação:** Excluir faixa e Limpar gravação já pedem confirmação.

---

## 8. O que continua sem verificação

- **Sem verificação:** Safari/iOS, aparelho real, latência real alto-falante→microfone, fps do vídeo com GPU (aqui deu ~6 fps sem GPU), aba em segundo plano exportando, memória exata com 32 faixas longas e permissão negada real.
- **Precisa de você ou de um ritmista:** testar num iPhone e num Android médio. Sugiro fazer isso depois do S1, com uma lista de 10 passos que eu preparo.

---

## 9. Perguntas

### Bloco A: decidem a ordem (responda primeiro)

1. **D1.** Fontes: **A) trocar por fontes livres parecidas** / B) tornar o repo privado / C) comprar a licença.
2. **D2.** Os links `#breque=` vão para gente de fora do grupo? Sim / Não.
3. **D3.** As amostras de áudio são: A) gravação própria / B) banco livre (qual?) / C) não sei.
4. **D4.** O app serve para: A) estudo individual / B) conduzir o ensaio ao vivo / **C) os dois**.
5. **D5.** **A) Tudo no aparelho e no link** / B) contas e servidor.
6. O GitHub Pages é a versão que os ritmistas usam? Sim / Não (qual endereço?).

### Bloco B: produto

7. Quem publica os breques oficiais: A) só a diretoria / B) qualquer ritmista.
8. A setlist precisa tocar em sequência ou basta uma lista ordenada? **A) tocar em sequência** / B) lista ordenada.
9. Qual o andamento mínimo útil para estudo? A) 50% / **B) 40%** / C) outro.
10. O mapa em papel por naipe é usado de fato? Sim / Não.
11. Celular em pé no Pad e no Estúdio: **A) suportar** / B) só deitado, com a tela "gire".
12. Mais ou menos quantos membros usam iPhone?
13. Uma gravação típica tem quantas faixas e quantos minutos?
14. Quem autoriza publicar vídeos com o rosto de membros?
15. Os membros precisam trocar **projetos do Estúdio** entre si, ou só links do Pad?
16. Uso em ensaio sem internet é essencial? Sim / Não.

### Bloco C: técnicos (sigo a sugestão se você não responder)

17. Valor fora do limite no link: **A) corrigir para o mais próximo, com aviso** / B) rejeitar o link inteiro.
18. Gravar com uma faixa selecionada: **A) sempre em faixa nova; regravar só com confirmação** / B) perguntar sempre.
19. Desfazer: **A) 1 nível, pelo toast** / B) histórico completo.
20. Mosaico com mais de 9 faixas: **A) grade cresce** / B) limitar a 9 com aviso.
21. Link com acentos e mudo/solo: **A) sim, comprimido** / B) só as notas.
22. Faixa de BPM dos sliders: **A) 40–220** / B) 30–300.
23. Licença do código: **A) MIT** / B) ISC / C) proprietária. Nome do autor?
24. Tema claro: A) agora / **B) depois do S7**.

---

## 10. Arquivos de apoio

- `revisao/0_revisao-geral.md`: revisão inicial (com a correção do erro sobre o link).
- `revisao/1…5_*.md`: rodada 1 (áudio, Estúdio, interface, PWA/segurança, testes).
- `revisao/rodada2/`:
  - `1_verificacao.md`: os itens que só tinham sido lidos, testados rodando.
  - `2_midia.md`: gravação e exportação de ponta a ponta.
  - `3_desempenho.md`: medições, cobertura e as 63 regras CSS mortas.
  - `4_produto.md`: jornadas e sugestões, com referências a outros apps.
  - `5_especificacoes.md`: especificação item a item das Fases 0–2 (critério de pronto, teste, risco).
  - `6_critica.md`: modelo de ameaça, licenças, ordem dos sprints.
  - `audios_sem_uso_103.txt`.
  - `prova-fase0/fase0.diff` e `tier5_fase0_seguranca.test.js`: prova de conceito do S1.1–S1.3 + `server.js` (166/166 testes). Pronta para aplicar quando você aprovar.
