# Plano de melhorias: Naumteria Studio

Base: revisão geral + 5 auditorias paralelas (áudio, Estúdio, interface, PWA/segurança, testes). Os relatórios completos estão em `revisao/`.
Nada neste plano foi aplicado ao código. Tudo depende das suas respostas na seção "Perguntas".

**Como ler:** `[R]` = verificado rodando no Chromium. `[L]` = só lido no código.

## Resumo em 6 linhas

1. **Segurança de entrada é o problema mais sério.** Link `#breque=`, projeto `.json` e BPM sem validação podem executar script ou **travar a aba** (`bpm` negativo ou 1e9 passa de 8 s sem voltar) `[R]`.
2. O servidor (`server.js`) expõe o `.git`, cai com URL malformada e sai da pasta `[R]`.
3. A interface em pé no celular (375–390 px) quebra: Pad cortado, Estúdio vazio com botões fora da tela `[R]`.
4. Perda silenciosa de dados: falha ao salvar no IndexedDB não avisa, importar passa do limite de 32 faixas e a 33ª sobrescreve a última `[R]`.
5. Os 157 testes passam, mas só cobrem layout e seletores, não gravação, exportação, persistência nem link. Não há CI.
6. O áudio do Pad está sólido: o tempo está exato em 2/4, 4/4, fusa, tercina e sextina, de 120 a 300 BPM `[R]`.

## Fase 0: segurança e travamentos (primeiro, é rápido)

| # | O que fazer | Onde | Status |
|---|---|---|---|
| 0.1 | Uma função de sanitização para tudo que vem de link ou JSON: BPM 30–300, compassos inteiros 1–32, meter e subdivisão só da lista permitida, volumes numéricos, ids regenerados | `index.html:5213-5249`, `5476`; `beatbox_studio.js:5527-5565` | `[R]` |
| 0.2 | Escapar `bpm`, `measures` e demais campos nos templates `innerHTML` (XSS armazenado: abrir link malicioso, salvar, recarregar executa script; reproduzi) | `index.html:6489`; `beatbox_studio.js:761-775, 1131-1140` | `[R]` |
| 0.3 | Limite de iterações no agendador do Pad, para não travar com passo ≤ 0 | `index.html:5335` | `[R]` |
| 0.4 | `server.js`: lista de arquivos permitidos, `try/catch` em `decodeURIComponent`, comparar com `PUBLIC_DIR + path.sep`, `PORT` por variável de ambiente | `server.js:28-36` | `[R]` |
| 0.5 | Meta CSP (`default-src 'self'; script-src 'self' 'unsafe-inline'; …`) | `index.html` (cabeçalho) | `[R]` |
| 0.6 | Importar JSON: validar e montar tudo antes de trocar o estado (hoje um JSON ruim deixa o projeto aberto quebrado) | `beatbox_studio.js:5527-5565` | `[R]/[L]` |

## Fase 1: não perder dados

- 1.1 Toast de erro quando o IndexedDB falha (quota cheia) e pedir `navigator.storage.persist()` (`beatbox_studio.js:24-40`) `[R]`
- 1.2 Importação do Pad no limite de 32 faixas: recusar e avisar (hoje sobrescreve) (`:5606-5610`) `[R]`
- 1.3 Desfazer/refazer, ou ao menos confirmação em Excluir faixa, Limpar gravação e Dividir clipe (`:2262-2322`) `[L]`
- 1.4 Abrir link ou importar com o Pad tocando: parar o som e zerar `stepMeta` (`index.html:5240, 5476`) `[L]`
- 1.5 Reaproveitar a conexão do IndexedDB e agrupar salvamentos (hoje 45 pontos de chamada, sem debounce) `[L]`

## Fase 2: celular em pé e acessibilidade

- 2.1 Pad em pé: coluna do instrumento de ~170 px para ~120 px, toques AB/MP/CT num popover `[R]`
- 2.2 Estúdio vazio 375 px: botões do hero em x=381–671, fora da tela. `flex-wrap: wrap; width: 100%` em `beatbox_studio.css:3715/3727` `[R]`
- 2.3 Aviso "Gire o celular": fechar com 44×44 px, lembrar que foi fechado, ocultar em ≥ 600 px `[R]`
- 2.4 Alvos de toque: mínimo de 44 px (Estúdio 375 px tem 26 pequenos; deitado as abas caem para 20 px) `[R]`
- 2.5 Remover `user-scalable=no, maximum-scale=1` (`index.html:7`) `[L]`
- 2.6 Contraste (medido): notas FT 3.26:1, CE 3.38, AF 3.97, FR 4.27; `.ruler-sub-label` 2.90:1; `.pill-native` 3.90:1 `[R]`
- 2.7 Foco visível: 9 `outline: none` e só 2 `:focus-visible` `[R]`
- 2.8 `aria-label` nos sliders e nos 23 botões só de ícone do Pad (mais 2 no Estúdio) `[R]`
- 2.9 `prefers-reduced-motion` (14 animações, 5 infinitas) `[L]`

## Fase 3: ícones e emojis (já na revisão geral)

Conjunto único de ícones SVG, com ícones distintos para **Excluir faixa** e **Limpar gravação**. Remover `⏹ ⏸ ⏳ ✂ ＋` e os emojis restantes do HTML.

## Fase 4: PWA e hospedagem

- 4.1 Service worker: nome do cache por hash/versão, sem `.catch` no `addAll`, `.catch` no fetch, timeout de ~3 s no network-first, `ignoreSearch` e poda `[R]/[L]`
- 4.2 Trocar a Google Font (JetBrains Mono) por cópia local: some offline e vaza IP online (`index.html:22-25`) `[L]`
- 4.3 Manifest: `id`, separar ícones `any` e `maskable` `[L]`
- 4.4 Aviso visível "abra por HTTPS" quando o microfone falha em `http://IP` (`beatbox_studio.js:2484`) `[L]`
- 4.5 Apagar `fetch('/__save_custom_grooves')` (rota que não existe) `[L]`
- 4.6 Apagar áudios não usados em `assets/audio` (145 mp3 no total; só 20 usados). Os agentes contaram **117** e **125** sem uso: conferir antes de apagar `[L]`

## Fase 5: qualidade e testes

- 5.1 `tests/harness.js` portátil (`CHROME_BIN`, `--no-sandbox`, `PORT`) + workflow de CI no GitHub Actions `[R]`
- 5.2 README, LICENSE e autor no `package.json`
- 5.3 Testes dos fluxos críticos: persistência, link, exportação JSON/WAV, gravação com microfone falso
- 5.4 Trocar ~50 `setTimeout` fixos nos testes por `waitFor`; fundir `challenger_m1_*` e `m1_challenger_*`; mover os runners para `tests/tools/`
- 5.5 Atualizar `PROJECT.md` (diz 9 faixas, o código usa 32; M1–M4 marcados como planejados)
- 5.6 Tirar os ~4.500 linhas de script inline do `index.html` para `js/*.js`, um commit por módulo com a suíte verde; depois fatiar `beatbox_studio.js`
- 5.7 Trocar os 46 `catch` vazios por log de depuração

## Fase 6: melhorias de áudio e exportação (depois)

- 6.1 WAV do Pad: choke offline começa a rampa em ganho 1.0 (cauda 25% mais alta) `[R]`; choke de rufada não registrado no contexto offline `[L]`; `preloadSamples()` não espera nada `[L]`
- 6.2 `buildExtendedRufadaBuffer` roda a cada rufada no timer de 15 ms: guardar em cache `[L]`
- 6.3 Lookahead de 35 ms é curto para aba em segundo plano; subir para 100–150 ms `[L]`
- 6.4 `AudioContext` suspenso/interrompido no iOS: tratar `statechange` `[L]`
- 6.5 Exportação do Estúdio: mosaico cresce além de 3×3 (hoje faixas extras caem fora do canvas), mp4 como alternativa ao webm no Safari, avisar faixa que não decodifica, somar faixas uma a uma (estimativa de >1,5 GB com 32 faixas longas) `[L]`
- 6.6 Link compartilhado: incluir acentos/velocidades e mudo/solo, com grade comprimida (hoje 17 KB para 8 compassos em 4/4 com fusa) `[R]`
- 6.7 Tema claro (uso ao sol) `[L]`

## Perguntas (responda só a letra; minha sugestão vem primeiro)

**Segurança e dados**
1. Rejeitar links/JSON fora de BPM 30–300 e compassos 1–32, com aviso? **Sim** / Não
2. Quando o IndexedDB falhar ao salvar: **A) toast de erro** / B) bloquear a edição
3. No limite de 32 faixas, o import do Pad deve **recusar e avisar**? Sim / Não
4. Desfazer/refazer no Estúdio: A) completo / **B) só confirmação em excluir/limpar** (mais barato)
5. Os links `#breque=` vão para gente de fora do grupo? **Sim** (então a Fase 0 é urgente) / Não

**Interface**
6. Suportar o celular em pé no Pad e no Estúdio (**A**) ou só deitado, com a tela "gire" (B)?
7. Remover `user-scalable=no` (permitir zoom)? **Sim** / Não
8. Escurecer as cores das notas e do azul para chegar a 4.5:1, mudando levemente a paleta? **Sim** / Não
9. Mínimo de 44 px em todo botão, mesmo com a barra mais alta? **Sim** / Não
10. Criar tema claro? Sim / **Depois**

**Entrega**
11. Onde vai hospedar? **A) GitHub Pages** / B) Netlify ou Cloudflare Pages
12. Uso em ensaio **sem internet** é essencial? Sim / Não (se sim, o item 4.2 sobe de prioridade)
13. Safari/iOS é alvo oficial? Sim (então mp4 sobe de prioridade) / Não
14. Uso com tela bloqueada ou em segundo plano é requisito? Sim (mais lookahead) / **Não**
15. Posso apagar os áudios não usados (4.6), depois de eu conferir a lista? **Sim** / Não
16. Trocar a Google Font por cópia local? **Sim** / Não

**Código e projeto**
17. Marcar M1–M4 como concluídos no `PROJECT.md`? Sim / Não
18. Dividir em módulos com **A) `<script type="module">`** (precisa de servidor, sem build) ou B) scripts clássicos em ordem?
19. Licença e autor: MIT, ISC ou proprietária? Qual nome?
20. Adicionar `playwright` como devDependency para o CI? **Sim** / Não
21. Fundir `m1_*` e tirar os runners do `npm test`? **Sim** / Não
22. Aceita o link compartilhado maior (acentos + mudo/solo, comprimido)? **A) sim** / B) só as notas

## Ordem que eu seguiria

Fase 0 → Fase 1 → 5.1 (CI) → Fase 2 → Fase 3 → Fase 4 → resto. Cada etapa num commit separado, com a suíte verde, e só depois da sua aprovação.

## O que nenhuma das auditorias cobriu

Gravação real com microfone e câmera, calibração de latência, o vídeo mosaico exportado, iPhone/Safari, aparelho real, 32 faixas longas e qualidade do som das amostras. Isso precisa de teste no seu aparelho.
