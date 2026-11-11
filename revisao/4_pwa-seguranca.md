# Auditoria PWA, segurança e entrega

## Alto
1. **XSS armazenado via link `#breque=`** (index.html:5216 grava `state.bpm = data.b` sem converter; index.html:6489 imprime `${bpm}` em innerHTML). RODADO: link com `b:"<img onerror=alert(7)>"`, salvar, recarregar: o script executa a cada carga. Vale também para `data.settings.bpm` (5477) e `measures`. Correção: `parseInt` + limites em toda entrada de hash/JSON e `escapeHtml(String(bpm))`.
2. **Sem CSP** nem headers de segurança (meta ausente; server.js:47). RODADO. Correção: meta CSP `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; media-src 'self' blob: data:; img-src 'self' data: blob:`.

## Médio
3. **Google Fonts externo** (index.html:22-25): não entra no cache (sw.js:78 só guarda `basic`); offline some a JetBrains Mono, online vaza IP. LIDO. Correção: fonte local em assets/fonts + CORE_ASSETS.
4. **Cache v24 manual e `addAll().catch`** (sw.js:2, 24): instalação parcial silenciosa. Network-first sem timeout (sw.js:50-62): com Wi-Fi ruim a página pendura. LIDO. Correção: nome do cache por hash/commit, sem catch, timeout ~3 s.
5. **Fetch sem catch** (sw.js:68): offline, arquivo não pré-cacheado rejeita (RODADO: `Failed to fetch`). Correção: `.catch(() => caches.match(request))`.
6. **Cache sem limite**: `cache.put` por URL com query string cria entrada por variante (sw.js:39-48, 68-75). LIDO. Correção: `ignoreSearch` e podar fora do CORE_ASSETS.
7. **Peso morto**: assets/audio tem 145 mp3 (1,3 MB), só 20 usados, todos já embutidos no soundbank.js (528 KB base64). RODADO/contado. Correção: apagar os 125 sem uso.
8. **Microfone exige HTTPS**: em `http://IP-da-rede` falha só com `console.warn` (beatbox_studio.js:2484). LIDO. Correção: aviso visível "abra por HTTPS".

## Baixo
9. `user-scalable=no, maximum-scale=1` (index.html:7) bloqueia zoom. Correção: remover.
10. Manifest sem `id`/`screenshots`; ícones com `"any maskable"` juntos (manifest.json:17,23). Ícone 512 está na zona segura (visto). Correção: separar entradas e adicionar `id`.
11. server.js:5 fixa porta 3000. Correção: `process.env.PORT`. Sem segredos nem dependências no repositório (verificado).

## Verificado OK (rodando)
SW registra (scope `/`), precache de 14 arquivos, controla após reload; offline via `setOffline` abre o app sem erros; `file://` abre sem erros (soundbank com 42 entradas); manifest e 3 ícones respondem 200; HTML em `m`/`s`/`vol` do hash não executa.

## Hospedagem gratuita
Todas dão HTTPS (libera microfone). GitHub Pages em subpasta: SW e manifest relativos já funcionam; `fetch('/__save_custom_grooves')` (index.html:4282) aponta para a raiz e falha em silêncio (apagar). Netlify/Cloudflare aceitam `_headers` para a CSP. server.js e tests/ não sobem.

## Perguntas
1. Hospedagem: A) GitHub Pages (subpasta) ou B) Netlify/Cloudflare (domínio próprio)?
2. Posso apagar os 125 mp3 não usados (sim/não)?
3. Trocar a Google Font por cópia local (sim/não)?
4. Uso em ensaio sem internet é essencial (sim/não)?
5. Links `#breque=` vão para pessoas de fora do grupo (sim/não)? Se sim, o item 1 é urgente.
