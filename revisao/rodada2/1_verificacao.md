# Verificação dos itens [L] — rodando no Chromium (Playwright), porta 3121

Scripts: t_pad.js, t_a5b.js, t_studio.js, t_clear.js, t_split.js, t_pwa.js, t_font.js (saídas em out_*.json).

| Item | Veredito | Evidência (1 linha) |
|---|---|---|
| 1.3 Confirmação/desfazer | PARCIAL (em boa parte REFUTADO) | Excluir faixa (mosaico e timeline) e Limpar gravação já abrem appConfirm; Dividir clipe (tecla S) corta na hora, sem confirmação; não há desfazer |
| 1.4 Link/import com Pad tocando | PARCIAL | Link: isPlaying segue true e stepMeta antigo fica. Import JSON: já chama stopPlayback (isPlaying=false), mas stepMeta antigo fica |
| 1.5 IndexedDB | CONFIRMADO | 10 mudanças de volume deram +10 indexedDB.open, +10 put, 0 close (21 aberturas no total); 45 chamadas a saveCurrentSession() |
| 2.5 user-scalable=no | CONFIRMADO | Meta presente; pinça 2,5× no contexto móvel deixa visualViewport.scale = 1 |
| 2.9 prefers-reduced-motion | CONFIRMADO | Com reducedMotion=reduce: 8 @keyframes, 14 regras com animação, 5 infinitas, 0 media queries de reduced-motion |
| 4.1 Service worker (partes [L]) | CONFIRMADO | Offline: `beatbox_studio.css?v=2` e `icon.svg?v=2` dão "Failed to fetch" (sem ignoreSearch e sem .catch); `nao_existe.js` devolve index.html com 200; CSS lento demora 8015 ms (sem timeout); cache fixo `naumteria-studio-v24` |
| 4.2 Google Font | CONFIRMADO | Online: pedidos a fonts.googleapis.com e fonts.gstatic.com; o SW não guarda a fonte; offline, document.fonts.load carrega 0 faces |
| 4.3 Manifest | CONFIRMADO | Page.getAppManifest: sem `id`; purposes = any, "any maskable", "any maskable" |
| 4.4 Aviso HTTPS em http://IP | REFUTADO | Em http://192.0.2.2:3121 (isSecureContext=false) aparece o alert "O acesso ao microfone/câmera requer conexão segura (HTTPS ou localhost)." O aviso já existe (é um alert, não um toast) |
| 4.5 /__save_custom_grooves | CONFIRMADO | Salvar a levada faz POST /__save_custom_grooves; o servidor estático responde 501 (e server.js não tem essa rota) |
| 4.6 Áudios sem uso | CORRIGIDO: 103 | Ver a seção abaixo |
| 6.1b Choke de rufada offline | CONFIRMADO | Num OfflineAudioContext, a rufada não entra em `_activeChokeVoices` (false); playSample entra (true); ao vivo a rufada entra (true) |
| 6.1c preloadSamples() | CONFIRMADO | Retorno: `undefined` (não é Promise) |
| 6.2 buildExtendedRufadaBuffer | CONFIRMADO | 9 rufadas tocadas geraram 9 buffers construídos (sem cache) |
| 6.3 Lookahead | CONFIRMADO | Maior antecedência de agendamento: 32 ms; travar a thread por 400 ms deixou 3 notas agendadas no passado |
| 6.4 statechange | CONFIRMADO | Com ctx.suspend(): state=suspended, isPlaying=true, botão "Pausar", 0 listeners de statechange |
| 6.5a Mosaico >3×3 | CONFIRMADO | 12 faixas: 630 de 2562 desenhos com y ≥ 720 (fora do canvas), maxY=942 |
| 6.5b mp4 no export | CONFIRMADO | Com só mp4 suportado: alert "NotSupportedError: video/webm" |
| 6.5c Faixa que não decodifica | CONFIRMADO | O WAV baixa com "exportado com sucesso!"; a falha só vai ao console (warn) |
| 6.5d Memória com 32 faixas longas | INCONCLUSIVO | Não medido; o código mantém os buffers decodificados de todas as faixas ao mesmo tempo |
| 6.7 Tema claro | CONFIRMADO (não existe) | colorScheme=light: o body continua rgb(10,9,12); 0 prefers-color-scheme; sem botão de tema |
| Áudio 2: gridData inválido | CONFIRMADO, e pior | Link com g.caixa="forteforte" é aceito como string; depois renderStudio lança "gridData[inst.id].map is not a function" |
| Áudio 4: payload do link | CONFIRMADO | Chaves: v,b,m,s,c,vol,t,g; sem stepMeta e sem mudo/solo |
| Áudio 5b: fallback no ctx ao vivo | CONFIRMADO, com ressalva | Só a rufada sem sample cai no fallback (2 chamadas, 4 nós no ctx ao vivo, WAV com pico 0); nota comum sem sample some do WAV em silêncio, sem fallback |
| Áudio 10: duplicação | CONFIRMADO (contagem estática) | `meter === '2/4' ? 2 : 4` aparece 9× (8× com `state.`); createDynamicsCompressor aparece 2× |
| Áudio 12: customGrooves | CONFIRMADO | Import com customGrooves.caixa="LIXO" grava "LIXO" no localStorage |
| Áudio 13: metrônomo | CONFIRMADO | 3 conexões GainNode→destination vindas de playMetronome (index.html:3491) |
| Estúdio 5/6 | CONFIRMADO | Ver 6.5a e 6.5b |
| Estúdio 7 | PARCIAL | Aviso ausente confirmado (6.5c); memória não medida |
| Estúdio 8: rAF em segundo plano | INCONCLUSIVO | O headless não reproduz o throttling de aba de forma confiável |
| Estúdio 10: mensagens de erro | CONFIRMADO | NotAllowedError e NotFoundError mostram o mesmo alert genérico |
| Estúdio 11: openDB | CONFIRMADO | Ver 1.5 |
| Estúdio 13: split duplica blob | CONFIRMADO | No IndexedDB, "S1" e "S1 (Pt. 2)" guardam cada uma 88.244 bytes (o arquivo inteiro) |

## Áudios sem uso (4.6)

Contagem exata: **103 de 145** arquivos não são referenciados em lugar nenhum.

Como cheguei nela:
- Procurei o nome (sem extensão) de cada arquivo em index.html, beatbox_studio.js, sw.js, server.js, tests/*.js e PROJECT.md.
- Extraí as chaves de assets/soundbank.js.
- Procurei caminhos montados dinamicamente (concatenação com `'assets/audio/'`, template com `${}.mp3`): não há nenhum. Toda referência é literal.

Conjuntos:
- `sampleConfig` (index.html): 28 arquivos (20 mp3 + 8 wav).
- soundbank.js: 42 chaves, que contêm os 28. As 14 a mais (ot_d0, ot_d1, ot_d4, re_2e, re_58, re_66, re_72, re_flam_real, re_open_mao, re_policarpo_slap, re_slap_mao, ta_estacio_forte/fraco/medio) são decodificadas no início, mas nunca tocadas.
- sw.js e tests/ não citam nenhum áudio.
- Rodando o app, **nenhum** arquivo de assets/audio é pedido à rede: tudo sai do soundbank em base64. Os arquivos físicos são só reserva para os 28 do sampleConfig.

De onde vêm os números dos relatórios:
- **117** = 145 − 28: conta como sem uso também os 14 que só aparecem no soundbank.
- **125** = 145 − 20: contou só os 20 mp3 do sampleConfig e esqueceu os 8 wav. Está errado: apagaria wav em uso.

Arquivos: so_soundbank_14.txt (os 14 só no soundbank) e nao_referenciados_103.txt (a lista abaixo).

### Lista dos 103 arquivos não referenciados
- ag_2e.mp3
- ag_72.mp3
- hs_68.mp3
- ls_72.mp3
- ls_73.mp3
- ls_74.mp3
- ms_72.mp3
- ms_73.mp3
- ms_74.mp3
- ot_23.mp3
- ot_24.mp3
- ot_25.mp3
- ot_26.mp3
- ot_27.mp3
- ot_28.mp3
- ot_29.mp3
- ot_31.mp3
- ot_32.mp3
- ot_33.mp3
- ot_34.mp3
- ot_35.mp3
- ot_36.mp3
- ot_37.mp3
- ot_38.mp3
- ot_39.mp3
- ot_41.mp3
- ot_42.mp3
- ot_43.mp3
- ot_44.mp3
- ot_45.mp3
- ot_46.mp3
- ot_47.mp3
- ot_48.mp3
- ot_49.mp3
- ot_4a.mp3
- ot_4b.mp3
- ot_4c.mp3
- ot_4d.mp3
- ot_4e.mp3
- ot_4f.mp3
- ot_50.mp3
- ot_51.mp3
- ot_52.mp3
- ot_53.mp3
- ot_54.mp3
- ot_55.mp3
- ot_56.mp3
- ot_57.mp3
- ot_59.mp3
- ot_5a.mp3
- ot_5b.mp3
- ot_5c.mp3
- ot_5e.mp3
- ot_5f.mp3
- ot_60.mp3
- ot_62.mp3
- ot_63.mp3
- ot_64.mp3
- ot_65.mp3
- ot_67.mp3
- ot_69.mp3
- ot_6a.mp3
- ot_6b.mp3
- ot_6c.mp3
- ot_6d.mp3
- ot_6e.mp3
- ot_70.mp3
- ot_71.mp3
- ot_75.mp3
- ot_76.mp3
- ot_77.mp3
- ot_78.mp3
- ot_79.mp3
- ot_7b.mp3
- ot_7c.mp3
- ot_7d.mp3
- ot_7e.mp3
- ot_c0.mp3
- ot_c1.mp3
- ot_c2.mp3
- ot_c3.mp3
- ot_c4.mp3
- ot_c5.mp3
- ot_c6.mp3
- ot_c7.mp3
- ot_c8.mp3
- ot_c9.mp3
- ot_ca.mp3
- ot_cb.mp3
- ot_cc.mp3
- ot_cd.mp3
- ot_ce.mp3
- ot_cf.mp3
- ot_d2.mp3
- ot_d3.mp3
- re_68.mp3
- re_73.mp3
- re_7a.mp3
- ta_58.mp3
- ta_66.mp3
- ta_ella_forte.wav
- ta_ella_fraco.wav
- ta_ella_medio.wav

### 14 só no soundbank (embutidos, nunca tocados)
- ot_d0.mp3
- ot_d1.mp3
- ot_d4.mp3
- re_2e.mp3
- re_58.mp3
- re_66.mp3
- re_72.mp3
- re_flam_real.wav
- re_open_mao.wav
- re_policarpo_slap.wav
- re_slap_mao.wav
- ta_estacio_forte.wav
- ta_estacio_fraco.wav
- ta_estacio_medio.wav
