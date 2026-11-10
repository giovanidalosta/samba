# Revisão do Naumteria Studio

Revisão do commit `8c03a2f` (branch `main` do `giovanidalosta/samba`), feita em ambiente Linux com Chromium headless.

## O que foi feito, e o que não foi

| Etapa | Como | Resultado |
|---|---|---|
| Testes automáticos | `npm test` numa cópia, com o caminho do Chrome ajustado para este ambiente | 157 de 157 passaram (~30 s) |
| Revisão de código | skill `code-review` (nível alto) | 10 achados, todos no último commit (emojis e ícones) |
| Segurança | **à mão e rodando**, porque a skill `security-review` falhou aqui (não existe `origin/HEAD` neste clone) | 3 problemas no servidor, confirmados rodando |
| Revisão de UI | skill `ui-review`, com o app aberto em 375, 768 e 1440 px | achados abaixo |
| Comparação com apps reais (UXKIN) | **não feita**: o servidor UXKIN não conectou (proxy 403) | n/d |
| `simplify` / `ui-polish` | **não rodadas**: elas alteram código, e você pediu revisão | n/d |

Não foi coberto, e precisa de teste no aparelho:
- gravação real com microfone e câmera;
- latência e calibração;
- exportação de `.wav` e `.webm`;
- iPhone/Safari;
- qualidade do áudio e do som das amostras;
- o CSS (~5 mil linhas) linha a linha.

## Deve corrigir

### 1. Servidor (`server.js`)

**Confirmado rodando:**

- **a) Serve o repositório inteiro.** `/.git/config`, `/server.js`, `/tests/harness.js` e `/PROJECT.md` respondem 200. Quem acessar o servidor consegue baixar o histórico do projeto pelo `.git`. O servidor escuta em `0.0.0.0`, então isso vale para qualquer máquina da rede.
  - Correção: servir só uma lista de arquivos permitidos (`index.html`, `beatbox_studio.*`, `sw.js`, `manifest.json`, `assets/`). Bloquear tudo que comece com ponto.
- **b) Uma URL malformada derruba o servidor.** `GET /%E0%A4%A` lança `URIError` em `decodeURIComponent` (linha 28) e o processo morre. Depois disso o servidor não responde mais, e eu confirmei isso.
  - Correção: colocar a chamada num `try/catch` e responder 400.
- **c) Sai da pasta do app para uma pasta vizinha.** A checagem `safePath.startsWith(PUBLIC_DIR)` (linha 36) aceita `/home/user/samba-secret`, porque o nome começa igual. Pedir `/..%2fsamba-secret%2fx.txt` devolveu 200 num teste com uma pasta de teste (apagada depois).
  - Correção: comparar com `PUBLIC_DIR + path.sep`.

Para uso só local isso pesa menos, mas o `server.js` é o que o `npm start` sobe, e não tem proteção nenhuma.

### 2. Emojis ainda aparecem, e os ícones novos ficaram ambíguos

O commit `8c03a2f` dizia ter eliminado os emojis, mas na tela inicial (375 px) ainda aparecem 🎙, 🥁, 🏛 e 🎛. A contagem automática de texto na tela do Pad achou 45 emojis no celular e 53 no desktop; no Estúdio, 8 nos dois.

- `beatbox_studio.js` usa `⏹`, `⏸` e `⏳` em gravação, pausa e calibração (linhas 2635, 2757, 3172, 4258 e 4576). Esses viram emoji colorido nos celulares.
- `✂` perdeu o seletor de variação e continua emoji no iOS e no Android (linhas 783, 1237 e 1245).
- `index.html` mantém emojis em dezenas de lugares, como os botões "Ir para Gravação" (linha 1359) e o menu Salvar & Arquivo (linhas 1850–1872).
- **Risco de uso:** "Limpar gravação" e "Excluir faixa" agora têm o mesmo ícone `✕` (linhas 1148 e 1152). Uma apaga só a gravação, a outra destrói a faixa. Antes eram 🗑️ e 🔄 e se distinguiam.
- `●` virou ao mesmo tempo gravar, microfone e faixa só de áudio. `◎` é câmera e calibração. `☵` é mixer e importar bateria.
- O ponto vermelho de gravar (🔴) virou um `●` na cor do texto, então o botão principal de gravar perdeu destaque.

Correção sugerida: um conjunto único de ícones SVG, com um ícone próprio para excluir e outro para limpar.

### 3. Pad e Estúdio cortados no celular em pé (375 px)

Vi isso nas capturas de tela:
- No Pad, a grade começa na coluna dos instrumentos e só cabe parte dos botões de toque (AB, MP, CT…) e do cabeçalho do compasso.
- No Estúdio, o cartão "Estúdio / Grave sua guia…" é cortado no lado direito: o título aparece parcial.
- O aviso "Gire o celular para a horizontal" sobrepõe o conteúdo da tela.

O app tem esse aviso de propósito, porque a timeline pede tela deitada. Mesmo assim, o conteúdo em pé não deveria ficar cortado.

## Deve corrigir logo

### 4. Alvos de toque pequenos
No celular, 119 elementos visíveis no Pad e 26 no Estúdio têm menos de 44×44 px. Exemplos medidos:
- voltar e novo breque: 32×32;
- botões Pad/Estúdio: 50×28 e 69×28;
- fechar o aviso de orientação: 23×25.

Os botões de silenciar, solo e limpar de cada instrumento também são pequenos. Num app de uso no palco, com dedo e pressa, isso importa.

### 5. Botões só com ícone, sem nome acessível
Na aba do Pad, 23 botões visíveis não têm texto nem `aria-label`. No Estúdio, 2. Leitores de tela não conseguem descrevê-los.

### 6. A altura da barra inferior está escrita à mão
`beatbox_studio.css` linha 3198 usa `76px` em três lugares, e as regras-base usam 84 px e 74 px (linhas 650 e 654). No celular deitado (altura até 500 px), a regra da linha 3630 (`padding: 4px 10px 6px 10px !important`) apaga essa folga, e o rodapé de gravação pode ficar atrás da barra fixa. Não testei no aparelho deitado.

## Menores

- **Documentação:** `PROJECT.md` diz 9 faixas e o código usa 32 (`MAX_STUDIO_TRACKS`, linha 164).
- **Rota inexistente:** `index.html` linha 4282 faz `fetch('/__save_custom_grooves')`, e o `server.js` não tem essa rota. A chamada falha em silêncio. O dado continua salvo no localStorage, então não perde nada, só é código morto.
- **`＋` de largura total (U+FF0B)** usado como ícone em seis lugares: pode sair com largura e alinhamento diferentes conforme a fonte.
- **Rótulo "VOL"** com estilo inline (`beatbox_studio.js` linha 764) e sem tema pelo CSS.
- O mosaico exportado em `.webm` mostra só um ponto azul nas faixas de áudio, no lugar do ícone de microfone.

## O que já funciona bem

- **Pad e Estúdio carregam sem nenhum erro de console** nos três tamanhos (375, 768 e 1440 px), e não há rolagem horizontal.
- ~~Link compartilhado funciona~~ **ERRADO, corrigido na rodada 2:** só funciona com o app já aberto. Abrindo o link com o app fechado (o caso normal, vindo do WhatsApp), ele cai na tela inicial. Meu teste só simulou o app aberto.
- **Sem injeção por nome de breque:** um nome com `<img onerror=…>` salvo no localStorage não executa.
- **Compassos absurdos no link** (`c: 1e9`) não travam: a página responde em ~170 ms.
- Os 157 testes passam em ambiente limpo.
- A tela inicial é clara: uma ação principal ("Gravar uma ideia") e uma secundária ("Montar no Pad").

## Correção de uma informação anterior
A outra sessão (a do notebook) levantou que quem abre um link compartilhado cai na tela inicial. **Ela estava certa.** Eu disse que não se confirmava, mas meu teste só cobria o app já aberto; com o app fechado, o link cai na tela inicial (verificado na rodada 2). As outras três suspeitas dela (rota inexistente, limite de 9 contra 32 faixas, emojis que sobraram) se confirmaram.

## Capturas de tela
Capturas não incluídas (`m_` é celular, `t_` tablet, `d_` desktop).
