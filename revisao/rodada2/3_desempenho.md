# Desempenho medido: Naumteria Studio

Playwright 1.63 + Chromium headless, CDP. Celular médio emulado: CPU 4x (`Emulation.setCPUThrottlingRate`), viewport 412x860 @2x. Servidor `python3 -m http.server 3123` (**sem gzip/brotli**). Google Fonts bloqueado (`Network.setBlockedURLs`), porque o sandbox não alcança o host. Scripts e saídas JSON/TXT estão nesta pasta: `load.js`, `throttle_proxy.js`, `sw_nocache.js`, `compare.js`, `usage.js`, `stress.js`, `coverage.js`, `analyze_cov.py`, `weight/`.

## Números medidos

| Cenário (CPU 4x) | FCP | DCL ≈ TTI | Samples prontos | Long tasks (soma/máx) | Bytes |
|---|---|---|---|---|---|
| Fast 3G, frio | 3,6 s | 10,1 s | 10,2 s | 3 (230 / 91–120 ms) | 1.675 KB |
| Slow 4G, frio | 2,4 s | 8,3 s | 8,4 s | 3 (219 / 101 ms) | 1.675 KB |
| Com SW ou cache HTTP | 0,09–0,12 s | 0,15–0,23 s | 0,2 s | 0 | 0 |
| Offline com SW | 0,1 s | 0,16 s | 0,2 s | 0 | 0 |
| **SW instalado + cache HTTP expirado** (proxy 3G) | 3,1 s | **10,0 s** | – | – | 1.675 KB |
| Variante: soundbank fora do caminho crítico + logo 128 px | 2,6 s | **6,2 s** | 11,7 s | – | 1.357 KB |

O TTI é aproximado: fim da última long task, ou o DCL. Antes do DCL o main thread fica quase todo ocioso, esperando a rede. Também medi com um proxy próprio de latência e banda (`throttle_proxy.js`), que afeta também o fetch do SW, porque a emulação do CDP não alcança o SW. Os resultados bateram (FCP 3,8 s, DCL 10,0 s).

| Uso (CPU 4x) | Resultado |
|---|---|
| Pad, 8 instrumentos, Samba Reto, 130 BPM, 20 s, sem mexer | 0 long tasks; 59,9 fps; 3 quadros acima de 25 ms (máx. 33 ms); 175 notas; antecedência mediana 27,7 ms (p5 16 ms); 1 nota atrasada (−9 ms, a 1ª); intervalo agendado exato (115,385 ms); playStep médio 1,5 ms (máx. 26 ms); updateCursor 0,8 ms; até 15 vozes simultâneas |
| Pad tocando + toques do usuário (célula / mute-solo → `renderStudio`) | **5 de 96 notas atrasadas; pior −73 ms (4x), −92 ms (6x)**; renderStudio leva 15–31 ms (4x); clique em célula 32–120 ms |
| Memória após 3×20 s de Pad (com GC) | heap 2,10 → 2,96 → 3,02 → 3,07 MB; nós 4061 → 4065; listeners 1318 → 1327 e depois estáveis. **Sem vazamento relevante** (+50 KB por ciclo, em parte da própria instrumentação) |
| 20 trocas Pad↔Estúdio | heap 3,07 → 3,30 → 3,31 MB (estável entre a 10ª e a 20ª); nós +6; listeners 1327 → 1327; window/document 27/4 → 27/4. **Sem vazamento.** `switchTab` para o Pad: 37–61 ms síncronos (4x) |

## Peso (bytes)

| Arquivo | Bruto | gzip | brotli | Minificado + br |
|---|---|---|---|---|
| index.html (markup 59K + JS inline 185K + CSS inline 26K) | 270K | 55K | 46K | ≈37K |
| beatbox_studio.js | 225K | 50K | 40K | 26,5K |
| beatbox_studio.css | 116K | 19K | 15,8K | 13,1K |
| assets/soundbank.js (42 samples: 403K binários em base64) | 541K | 352K | 335K | – |
| logo-naumteria.png (1024², exibido a 40 px) | 197K | 191K | – | 6,4K (webp 128 px) |
| 4 fontes OTF/TTF | 325K | 188K | 158K | ≈150K como woff2 (estimativa) |

## Cobertura (Início, Pad, menus, diálogos, Estúdio Faixas, Mosaico, Cabine)

| | Não usado |
|---|---|
| JS inline do index.html | 39,6% de 184K |
| beatbox_studio.js | 64,1% de 225K |
| beatbox_studio.css | 41,6% (384 de 737 regras, 48K) |
| CSS inline | 24,3% (6,4K) |

Quase tudo isso é estado não exercitado (exportar, calibrar, modal de corte, media queries de retrato), não código morto.

**Morto confirmado** (sem nenhuma referência em HTML/JS fora do CSS, verificado com grep):

- CSS: 63 regras, cerca de 8,9 KB.
  - `beatbox_studio.css`: `.app-tabs-nav`/`.tab-btn` (8–40), `.studio-btn-primary` (154–169), `.btn-record` (175–195), `.metronome-box`/`.btn-metro-toggle` (237–264, 3102–3108), `.reaper-lcd-rack`/`.lcd-*` (134–139, 295–327), `.record-modal-*` (2319–2340, 2651, 3477), `.mobile-bottom-bar`/`.mob-bar-*`/`#mobGlobalRecord` (3239–3578), `.empty-hero-presets` (3756), `.metro-led.pulse` (564).
  - `index.html`: `.brand-subtitle` (176), `.btn-success` (245–251), `.top-subbar` (314), `.preset-selector` (325), `.inst-vol-val` (662), `.step-hand-tag` (895), `.note-frente`/`.note-tras` (961–966), `.btn-share-link` (1057–1064), `.speed-toast-pill` (1142).
- JS: `window.appAlert` (`index.html:2293`, 1,6 KB): definida, nunca chamada. As outras funções não executadas têm chamadores, entre elas `playFallbackInstrument` (8,7K), exportação, calibração e gravação.

## Gargalos, em ordem de prioridade

1. **`<script src="assets/soundbank.js">` síncrono** (`index.html:2267`): 541K, maior que todo o resto do código somado. Base64 incompressível (+34% sobre os binários), seguido de decodificação com atob em laço (`index.html:2905-2915`). Ganho medido: DCL 10,1 → 6,2 s em Fast 3G. Carregar sob demanda os 42 samples (os `assets/audio/*.mp3` já existem) ou usar `defer`.
2. **SW network-first para qualquer `.js`** (`sw.js:53-57`): inclui o soundbank. Com o cache HTTP expirado, cada abertura baixa de novo 1,67 MB (medido: 10 s). Usar cache-first ou stale-while-revalidate com versionamento, ao menos para `assets/`.
3. **Sem compressão no servidor** (`server.js` e o http.server): 1.675K hoje, cerca de 790K com brotli.
4. **Logo 1024² PNG** (`index.html:1161`, 197K) exibida a 40 px: 6,4K em webp, cerca de 190K a menos (≈1 s em 3G).
5. **Agendador do Pad com folga curta** (`index.html:5340`, 35 ms de antecedência, `setInterval` 15 ms em `5352`) somado a `renderStudio()` completo a cada mute/solo/pincel (`index.html:4763, 4773, 4787`): notas saem até 90 ms atrasadas quando o usuário interage. Subir a antecedência para 100–120 ms e trocar `renderStudio` por atualização da linha afetada.
6. **Google Fonts bloqueante** (`index.html:24`), externo e que o SW não guarda (`sw.js:80` só faz cache de `type 'basic'`): estimativa de +1,5–2 s de FCP em 3G real (DNS+TLS+CSS). Servir a JetBrains Mono localmente ou usar `media=print onload`.
7. **Estúdio carregado sempre** (`index.html:6790`, 225K, 64% não usado no fluxo do Pad; long task de 60–77 ms ao avaliar): carregar sob demanda ao abrir o Estúdio economiza 26,5K br e cerca de 70 ms de CPU na carga.
8. Minificar JS/CSS/HTML: cerca de 40K a menos no total com brotli (de ≈140K para ≈100K). Fontes em woff2 com subset: cerca de 100–170K.

**Estimativa combinada (1–4, 6–8):** caminho crítico de cerca de 1.675K para cerca de 215K. DCL/TTI em Fast 3G de 10 s para cerca de 2,5 s. FCP de 3,6 s para cerca de 1,5 s.
