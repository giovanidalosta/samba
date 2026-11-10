# Crítica ao plano

**Modelo de ameaça:** sem contas e sem backend, dados só no navegador. Os links chegam de colegas pelo WhatsApp. O repo é **público** e o **Pages está ativo** (API: `visibility: public`, `has_pages: true`). O `server.js` serve só para desenvolvimento.

## 1. Severidades
- **server.js (0.4) cai para Baixo.** O `.git` já é público.
- **XSS (0.2) fica em Médio-Alto, por outro motivo.** O risco real é ler e enviar para fora as gravações de voz e vídeo do IndexedDB. No Pages, a origem `giovanidalosta.github.io` é a mesma de todos os outros sites Pages do dono.
- **33º import (1.2) cai para Baixo.** Exige 32 faixas já com mídia (`beatbox_studio.js:5606`).
- **IndexedDB mudo (1.1) sobe para Alto.** Medi `persisted:false`, e o Safari apaga os dados após 7 dias sem uso.
- **`✕` igual em Excluir e Limpar (Fase 3) é risco de perder dados.** Deve ir junto com 1.3.

## 2. Achados reabertos
1. **XSS por bpm: se sustenta.** O valor entra cru em `index.html:5216` e chega ao `innerHTML` em `6489`. Exige que a vítima salve o breque.
2. **CSP 0.5: não se sustenta.** Rodando, o `onerror` executou (por causa de `'unsafe-inline'`) e as 4 fontes locais foram bloqueadas (`font-src`). O valor real estaria em `connect-src 'self'`, contra exfiltração.
3. **Áudios: os números do plano estão errados.** São 145 arquivos (127 mp3 + 18 wav): 42 referenciados, 103 sem uso, nenhum caminho dinâmico.
4. **IndexedDB: se sustenta, mas a correção falha.** Quota cheia dispara `abort`, e não há `tx.onabort` (`beatbox_studio.js:33-36`). A promise pendura e um toast no `catch` nunca apareceria.
5. **SW 4.1: achado fraco.** O código já é network-first (`sw.js:50-62`), então o hash no nome do cache ganha pouco. O risco real é misturar versões (HTML novo com JS do cache) somado a `skipWaiting`.
6. **`localStorage` sem try/catch (`beatbox_studio.js:157`): se sustenta.** Baixo.

## 3. Faltou
- **Licenças:** `Arboria-Book.otf` diz "Type-O-Tones… All rights reserved" e é um kit webfont do MyFonts. As duas Myriad são da Adobe, "All rights reserved". A Diamante está sem a tabela `name`. Todas estão redistribuídas num repo público. As amostras não têm procedência, então a pergunta 19 (MIT) não pode cobrir esses assets.
- **LGPD e direito de imagem:** faltam "apagar todos os dados", aviso de consentimento ao filmar e regra para divulgar o mosaico.
- **Backup:** não há "exportar tudo". O export do Estúdio põe cada vídeo em base64 dentro de um JSON (`beatbox_studio.js:5499`): +33% de tamanho e risco de estourar a memória no celular. Se o armazenamento for limpo, não há recuperação.
- **Acessibilidade auditiva:** o Estúdio já tem LED de pulso (`:3054`). Falta conferir o pré-roll e o Pad.
- **Não testado:** atualização após deploy e Safari. O i18n é dispensável (`lang="pt-BR"`).

## 4. Sprints
- **S1 (2 dias):** sanitização única (0.1–0.3, 0.6) com testes maliciosos; `onabort` + toast + `persist()`; confirmação e ícones distintos em Excluir/Limpar; liberar o zoom.
- **S2 (1 dia):** fontes livres ou licença (reescrevendo o histórico) ou repo privado; procedência das amostras; LICENSE e README; apagar os 103 áudios.
- **S3:** harness portátil, CI e testes de persistência, link e export, antes de refatorar.
- **S4:** celular em pé, toque, contraste e foco.
- **S5:** fonte local, CSP com `connect-src`, fallback do SW, "exportar/importar/apagar tudo".
- **S6:** Fase 6 e, por último, a modularização (5.6). O `server.js` entra em qualquer sprint.

## 5. Perguntas
- **Sobram:** 1 e 3 (óbvias), 16 (repete a 12), 17, 20 e 21 (técnicas). A 11 está meio respondida: o Pages já está ativo.
- **Reformular:** a 5 vira a primeira ("os links circulam fora do grupo?"). A 12 e a 13 vêm logo depois, porque definem as prioridades.
- **Faltam:**
  - Há licença das fontes? O repo precisa ser público?
  - Qual a origem das amostras?
  - Quantos membros usam iPhone?
  - Qual a duração e o número de faixas típicos de uma gravação?
  - Quem autoriza publicar vídeos com rosto de membros?
  - É preciso trocar projetos entre membros?
