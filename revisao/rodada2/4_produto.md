# Jornadas de produto: Naumteria Studio

Testado no Chromium (Playwright) a 390, 844×390 e 1280 px, com microfone falso. Capturas nesta pasta.

## Atritos por jornada

**(a) Primeiro uso.** O Pad abre e salva sozinho (`a3`, `a4`). Mas não explica AB/MP/Ciclo, e no celular em pé o banner "Gire" cobre a grade (`a2`).

**(b) Aprender pelo link. É o mais grave.**
- Com o app fechado, o link cai na Home: `checkSharedBrequeUrl()` roda e logo depois vem `switchTab('tab-home')` (`index.html:6783-6787`, `b1`).
- "Montar no Pad" zera as 178 notas (`b3`).
- O link não leva o nome (`:5153`). O breque abre como "Novo Breque", fica fora de "Meus Breques" e some ao voltar à Home (`b4`, `b2`). São 2,9 mil caracteres e não há QR.

**(c) Ensaiar em casa**
- BPM do Pad só de 80 a 170 (`:1786`). 60% de um breque de 130 é impossível.
- Não há loop de trecho, e `speedTrainerMode` não tem interface (`:5082`).
- A contagem fica escondida em "Grade" (`c1`).
- Com o celular deitado, o transporte sai da tela e os botões têm 28 px (`c3`).

**(d) Gravar por cima da guia**
- O Gravar mira a própria guia (`beatbox_studio.js:532-546`).
- O take salvo substituiu a guia sem aviso: o clipe foi de 3,7 s para 4,3 s, ainda com uma faixa só (`d6b`, `d7b`).
- O "Parar" do dock não encerrou a gravação (`d6`).

**(e) Repertório para apresentação**
- Não há setlist, ordem nem tags, só filtros (`:6376`).
- O mapa impresso corta no 2º compasso e imprime controles da tela (`e1_print_p-1.png`). No celular não há "Imprimir" (`f2`).

**(f) Compartilhar com o naipe**
- Não há link por naipe, comentários nem versões. Mudo/solo não vão no link.

## Top 10 sugestões

| # | Sugestão | Impacto | Esforço | Por quê |
|---|---|---|---|---|
| 1 | Link abre no Pad, leva o nome e oferece "Salvar nos meus" | Alto | P | A jornada (b) não funciona |
| 2 | Gravar em faixa nova por padrão e confirmar antes de substituir | Alto | P | A guia é perdida |
| 3 | Modo ensaio: loop de compassos, BPM de 40 a 100%, speed trainer | Alto | M | Centro do estudo |
| 4 | Setlist ordenada, tocada em sequência | Alto | M | Prepara a apresentação (RoR "Song") |
| 5 | Modo palco: transporte fixo, botões ≥ 56 px | Alto | M | Uso no ensaio |
| 6 | Mapa imprimível por naipe, só com a grade | Médio | M | Estudo no papel (RoR Sheetbook) |
| 7 | QR do link e link "só meu naipe" | Médio | P | Distribuir no ensaio |
| 8 | Apito/contagem do mestre visível na barra | Médio | P | Convenção real da bateria |
| 9 | Versões do breque com data | Médio | M | Links viram cópias soltas |
| 10 | Legenda dos toques no primeiro uso | Médio | P | Novato não lê a notação |

Ficaram para depois: comentários por compasso e colaboração (G, precisam de backend) e importação de levadas (M).

## Referências

- Groove Scribe: URL única por groove, e editar não altera o original ([TomTom](https://tomtommag.com/2017/02/groove-scribe-free-online-digital-drum-transcription-tool-will-change-life/)).
- RoR Player: notas no próprio link, "Songs" como sequência de breaks, velocidade por break, MP3/WAV, cadernos impressos ([docs](https://player-docs.rhythms-of-resistance.org/guide/user/listen.html), [GitHub](https://github.com/beatboxjs/ror-player)).
- Brazilian Beats: mute/solo por pista ([synthyfrog](https://synthyfrog.com/app/brazilian-beats-the-brazilian-drum-box/)).

## Perguntas ao dono

1. O app serve ao estudo individual ou à condução do ensaio ao vivo?
2. Vai ter contas e servidor (setlist, comentários, versões compartilhadas) ou fica tudo no aparelho e no link?
3. Quem publica os breques oficiais: só a diretoria ou qualquer ritmista?
4. A setlist precisa tocar em sequência ou basta uma lista ordenada?
5. Qual o andamento mínimo de estudo, e o mapa em papel por naipe é usado?
