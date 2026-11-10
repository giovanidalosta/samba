# Auditoria UI (CSS + index.html) - Naumteria Studio
Renderizado em 375x740, 390x844, 768x1024, 1440x900, 844x390. Capturas: v_*, st_*, scroll_375.png (nesta pasta).

## ALTO
1. **Zoom bloqueado**: index.html:7 `maximum-scale=1.0, user-scalable=no`. Remover. (lido)
2. **Pad em pé 375/390**: coluna do instrumento ocupa ~170 de 375px; toques AB/MP/CT cortados, nomes truncados ("Caixa de...", "Repique..."), ~4 passos visíveis. Em portrait <=480px, reduzir a coluna a ~120px e mover os toques para popover. (renderizado)
3. **Estúdio vazio 375**: `.btn-hero-import/.btn-hero-add` em x=381..671 (fora da tela); cartão cortado. `flex-wrap:wrap; width:100%` no hero (css:3715/3727). (renderizado)
4. **Aviso "Gire o celular"** (.mobile-orient-banner, css:2940-2960): aparece também em tablet 768x1024 em pé, cobre a linha "Caixa" do Pad; fechar = 23x25px. Botão 44x44, lembrar fechamento, ocultar >=600px. (renderizado)
5. **Contraste (calculado)**: nota FT branco/rosa 3.26:1, CE 3.38, AF 3.97, FR 4.27 (9px, `.step-node.note-*`); `.ruler-sub-label` #5C5D66 = 2.90:1 (css:964); `.pill-native` #247BB8 11px = 3.90:1. Usar #8EC5EC e #8A8B96; escurecer fundos das notas.
6. **Toque <44px**: Estúdio 375 tem 26 alvos: abas Faixas/Mosaico/Cabine 28px, Pad/+Faixa/engrenagem 32px, BPM +/- e `btnStudioTap` 28x28 (index.html:1714). Deitado 844x390 as abas caem para 20px (header com `!important`, css:3587). Mínimo 44px no palco.

## MÉDIO
7. **Foco**: 9 `outline:none` (css:1118,1367,1792,1969,2299,2430,2724,3975,4827) e só 2 `:focus-visible`; anel real = auto 1px. Adicionar `:focus-visible{outline:2px solid var(--naum-gold);outline-offset:2px}`.
8. **Sem `prefers-reduced-motion`**: 14 animações, 5 infinitas (css:638,2495,2552,2597,3582). Bloco global.
9. **Sem tema claro** (nenhum `prefers-color-scheme`): ruim ao sol.
10. **!important: 320**, concentrados em @media (2851-3600). Duplicadas: `.mosaic-workspace` (649/1669), `.record-workspace` (653/2216), `.record-device-bar` (2393/4277), `.studio-empty-mosaic-hero` (3715/3727).
11. **Tokens**: 251 hex soltos vs 409 `var()`; 12 tamanhos de fonte (7x 9px, 15x 10px); 154-211 textos <11px por tela. Criar `--fs-xs:12px` e `--space-*`.
12. **A11y**: `bpmSlider`, `inst-vol-slider` (x8), `studioBpm`, `homeBrequeSearch` sem aria-label; só 7 aria-label e 82 `title` (inútil no toque); poucos role=dialog/aria-live (1).
13. **Fontes**: 325 KB locais, cacheadas no sw.js (ok). JetBrains Mono vem do Google (index.html:23), fora do cache offline. Arboria só 400: negrito sintético.

## BAIXO
14. Copy: "Cabine" vs "Gravação" como sinônimos; rótulo e placeholder da busca repetem "nome ou BPM".
15. Safe-area: 8 `env()`; header (css:2861) sem left/right no notch deitado. `transition:all` x36.
16. OK: título longo trunca, sem rolagem horizontal da página em nenhum viewport.

Não verificado: iOS/Safari, aparelho real, 32 faixas, gravando.

## Perguntas
1. Suportar uso em pé no Pad/Estúdio (A) ou só deitado com tela "gire" (B)?
2. Remover `user-scalable=no`? (sim/não)
3. Criar tema claro? (sim/não)
4. Escurecer cores das notas/azul para 4.5:1, alterando levemente a paleta? (sim/não)
5. Mínimo de 44px em todo botão, mesmo com toolbar mais alta? (sim/não)
