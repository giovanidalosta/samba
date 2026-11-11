# Fluxos de mídia, ponta a ponta (Playwright + Chromium headless, fake device)

## Resultado
1. **Gravação pela Cabine: FUNCIONA.** Contagem a cada 500 ms (120 BPM). A 1ª batida do metrônomo cai a 6 ms da grade. Áudio: webm/opus, 4,50 s. Câmera: vp8+opus, 4,56 s. A faixa aparece, toca e persiste após reload (IndexedDB).
2. **Calibração: PARCIAL.** Termina em cerca de 1,8 s. Loopback simulado de 0/40/120/250 ms deu 48–60/84–104/166–202/292–314 ms: viés de +55 ms e variação de ±18 ms. **Falso positivo:** sem caminho acústico, ela "calibra com sucesso" em 195–201 ms. Sem mic ou permissão, mostra o erro cru em inglês, sem travar.
3. **Pad → Estúdio: FUNCIONA.** WAV PCM16, estéreo, 44,1 kHz. Duração igual a compassos × tempo, com erro ≤0,02 ms nos 3 casos (2/4, 4/4, fusa). Pico em 0,96 e 6 ms de silêncio inicial.
4. **Exportação: WAV FUNCIONA, vídeo PARCIAL.** O WAV respeita o offset de +250 ms (±1 ms). O .webm sai em 1280×720, mas a cerca de 6 fps, e o vídeo **termina cerca de 2 s antes do áudio** em 4 de 4 exportações (pode ser limite de CPU do host). A sincronia entre faixas teve erro de até 21 ms.
5. **12 e 32 faixas de 60 s: PARCIAL.** O WAV levou 2,6 s e 8,4 s; o RSS subiu cerca de +1,2 GB (aproximado). Persistência OK. Mosaico: **T10+ não aparecem**. O mix **satura**: 73% e 68% das amostras ficam clipadas.
6. **Dividir, cortar e offset: FUNCIONA** no WAV (divisão e offset de +4000 ms exatos; corte de 1 s/1 s gera som de 1–7 s). Problemas de duração nos bugs 3 e 4.

## Bugs (beatbox_studio.js)
| P | Bug | Linha | Correção |
|---|---|---|---|
| Alto | Mixdown sem limitador: clipping | 3668 | Teto/normalização como no Pad (`index.html:3570`) |
| Alto | Mosaico fixo em 3×3, faixas acima da 9ª somem (confirmado rodando) | 3411-3416 | `cols=ceil(√n)`, `rows=ceil(n/cols)` |
| Médio | Modo Livre corta o final: offset de +250 ms gera WAV de 8,0 s e perde os últimos 250 ms | 466-470 | Exportar até o fim real do conteúdo |
| Médio | `projectDurationSec` nunca diminui: WAV com 1–2 s de silêncio sobrando | 442-452 | Recalcular a partir das faixas |
| Médio | Calibração aceita 2 de 3 picos sem checar dispersão; o carimbo de tempo é enviesado | 4633, 4753-4767 | Exigir 3 de 3 com dispersão <10 ms; usar AudioWorklet |
| Médio | Sem mic aparecem 3 `alert()` seguidos | 2560, 2622 | Um aviso só, separando `NotAllowed` de `NotFound` |
| Médio | Cada "Enviar p/ Estúdio" cria mais uma "Bateria (Pad)", e as antigas ficam com o BPM velho | 5604-5611 | Substituir ou perguntar |
| Médio | Vídeo: `stop()` logo após o último rAF | 3520-3524 | Desenhar por timer e chamar `requestData()` antes de parar |
| Baixo | Corte em tempo real por `setTimeout` deixa vazar o som (clique 2 ms após o corte) | 2820-2828 | Agendar com mais precisão |

## Não testado
- Latência acústica real: não há hardware.
- `NotAllowedError` verdadeiro: o headless devolve `NotSupportedError`.
- Modo Fixo com auto-stop.
- Safari/iOS.
- Aba em segundo plano.
- fps em GPU real.

Scripts e JSONs ficam nesta pasta.
