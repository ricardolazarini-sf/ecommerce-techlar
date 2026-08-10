# TechLar — direção visual

Contrato de design único do SPA. Todo trabalho visual deriva **exclusivamente** deste
documento e dos tokens em `tokens.css`. Se algo não estiver aqui, não invente: derive
dos tokens.

## Assunto, público, tarefa

**TechLar** é uma varejista brasileira de tecnologia para a casa: smartphones,
notebooks, impressoras 3D e periféricos, com dois diferenciais reais — **garantia
estendida** e **instalação profissional**. O público é doméstico, compra por
comparação e precisa de confiança antes de finalizar. A tarefa de cada página é
reduzir dúvida: mostrar o produto, o preço e o que a TechLar faz junto com ele.

## De onde vem a estética: a marca

O logo é uma **casa desenhada com trilhas de circuito e nós de solda**, em latão.
Essa é a linguagem visual da marca e a origem de tudo: **traçado que percorre e
conecta um lar**. Não é ornamento — é o argumento da empresa (levar tecnologia até
dentro da casa) desenhado.

O motivo do traçado aparece de três formas, sempre com contenção:

1. **Trilha** — linha de 1px que muda de direção em ângulos de 90°/45°, nunca curva livre.
2. **Nó** — círculo pequeno (4–6px) marcando início, fim ou junção de uma trilha.
3. **Percurso** — a trilha conecta dois elementos que têm relação real (rótulo → conteúdo,
   etapa → etapa). Trilha que não conecta nada é decoração: não use.

## Tema

**Claro**, por definição da marca (`brand/` = "gold logo, light theme"). O latão é a
cor da marca e é usada com **restrição**: identidade e ação primária. Não é cor de
preenchimento.

O fundo é um neutro **frio** (`--paper`), deliberadamente não creme. Latão sobre creme
é o clichê que este projeto está saindo de; latão sobre neutro frio faz o latão ler
como marca, e não como bege decorativo.

## Cor

Use sempre a variável, nunca o hex literal.

| Token | Valor | Uso |
| --- | --- | --- |
| `--paper` | `#F1F3F6` | Fundo da página |
| `--paper-sunk` | `#E7EBF0` | Áreas rebaixadas, thumbs vazias |
| `--surface` | `#FFFFFF` | Cards, painéis, campos |
| `--ink-strong` | `#0C1119` | Título (`h1`–`h4`) |
| `--ink` | `#141B26` | Texto principal, corpo |
| `--ink-2` | `#4A5768` | Texto secundário, rótulos |
| `--ink-3` | `#7B8798` | Texto de apoio, dica de campo |
| `--ink-hint` | `#8B95A5` | Placeholder — o passo mais claro que existe |
| `--rule` | `#D3DAE3` | Hairline de 1px, bordas |
| `--brass` | `#B0862A` | Marca, ação primária, trilhas |
| `--brass-deep` | `#7C5D18` | Texto sobre lavado, hover |
| `--brass-wash` | `#F6EFDC` | Tinta de fundo do latão |
| `--signal` | `#0F7A85` | Foco, estado ativo/conectado, links |
| `--signal-wash` | `#DCEDEF` | Tinta de fundo do sinal |
| `--success` / `--success-wash` | `#1E7A4C` / `#DEF0E5` | Confirmação, estoque |
| `--alert` / `--alert-wash` | `#AE3A2D` / `#F7E3DF` | Erro, remoção |

**Proibido:** gradiente de dourado (`linear-gradient` em latão) em qualquer lugar. O
latão é chapado. O gradiente dourado é a marca registrada do visual templado que
estamos substituindo.

## Tipografia

Três papéis, três fontes. Já carregadas em `index.html`.

- **Display — `Bricolage Grotesque`** (`--font-display`): só títulos. Peso 600–800,
  tracking negativo (`--track-tight`). Tem personalidade; por isso aparece pouco.
- **Corpo — `Public Sans`** (`--font-body`): todo texto corrido, botões, campos.
- **Utilitário — `IBM Plex Mono`** (`--font-mono`): **preço, número de pedido, SKU,
  especificação, contador e eyebrow**. Numeral tabular alinha na comparação entre
  produtos — é escolha funcional, não estética.

Preço **sempre** em `--font-mono` com `font-variant-numeric: tabular-nums`.

Escala em `tokens.css` (`--fs-*`). Não crie tamanhos fora dela.

## Estrutura e forma

- Raio: `--r-1: 4px` (padrão), `--r-2: 8px` (cards/painéis), `--r-pill` só para
  badge e contador. Nada de 14px arredondado genérico.
- Separação por **hairline de 1px em `--rule`**, não por sombra. Sombra só para
  elemento que realmente flutua (dropdown, sticky sobreposto).
- Espaçamento pela escala `--s-*` (base 4px). Nunca valor solto.
- `.eyebrow` é o rótulo de seção padrão: mono, caixa alta, tracking largo, com nó de
  latão antes. Use para nomear seção — não para repetir o título.
- O **cartão de produto** mostra a mercadoria inteira (`object-fit: contain`) num palco
  quadrado, e não recortada: a foto chega de fabricantes diferentes, e recortando cada
  cartão cortava o produto num lugar diferente — a grade comparava enquadramento em vez
  de produto. O acento em repouso é **um só**: o nó de latão na régua do preço. A régua
  é a variante de cota da trilha (nó na junção, 1px correndo até encostar na moldura) e
  ocupa o lugar do divisor de ponta a ponta, porque é o preço que ela mede. No telefone
  ela sobe para cima do preço — ver **Telefone**.
- A **barra superior tem um acento só**, e ele é condicional: o carrinho ganha borda de
  latão quando há item nele. Botão cheio na barra, em qualquer região, disputa atenção
  com o hero e com o próprio carrinho — ações de conta ficam em texto. A barra é a única
  moldura presente em toda página, e por isso a mais quieta.
- Navegação por categoria pertence ao catálogo, que tem os filtros com contagem vinda da
  API. Repeti-la na barra criaria duas fontes de verdade para "onde eu estou".
- O **pagamento toma a tela inteira** (`.co-pix`), como em app de banco: no segundo em
  que o dinheiro sai, nada mais na página importa, e página inteira é a única forma de
  dizer isso. O maior elemento é o **valor** — é o que se confere —, maior que o próprio
  "Pix aprovado", que só confirma o que o valor já disse. O cartão é preso pelo topo, e
  não centrado: ao aprovar ele cresce para receber o comprovante, e centrado levaria o
  valor para cima justamente no instante em que se lê o valor.

**Marcadores numerados (01 / 02 / 03) são proibidos**, exceto no checkout, onde as
etapas são uma sequência real e a ordem informa o usuário.

## Telefone

O telefone não é a versão estreita do desktop: a tarefa é a mesma, mas rolar custa
mais e o dedo é mais grosso que o ponteiro. O que vale só ali:

- **Dois produtos por linha até 560px.** Em coluna única o cartão passa de 450px, e o
  catálogo custava 5,7 telas de rolagem para 7 itens — comparar virava exercício de
  memória. Duas colunas apertam o cartão um passo de espaçamento, e a régua do preço
  sobe para cima do valor: preço de cinco dígitos em mono tabular não divide 149px com
  uma trilha. Mesmo nó, mesma trilha correndo até a moldura, na única horizontal que
  sobrou.
- **Rótulo que não cabe encurta para o verbo; não quebra em duas linhas.** A cauda
  ("Adicionar _ao carrinho_") sai da tela por `.sr-only-narrow` e continua no nome
  acessível, então quem ouve a tela recebe a ação inteira. O ícone segura o resto do
  sentido.
- **Barra de compra fixa na página de produto** (`.pdp-bar`), e só depois que o botão
  do painel passou por cima da tela — antes dele, o painel é o próximo passo da
  rolagem, e a barra estaria adiantando a decisão. Sem ela sobravam duas telas de
  ficha e serviços sem como comprar. Mostra o total já composto (quantidade e
  garantia) e confirma no próprio botão ("Adicionado"), porque o aviso do painel está
  fora da tela quando a compra sai da barra. Um vão em fluxo com a altura da barra
  impede que ela cubra o fim do rodapé. É o único elemento do site que de fato flutua,
  e por isso o único com sombra.
- **Campo de texto nunca abaixo de 16px em dispositivo de toque.** O Safari do iPhone
  amplia o visor ao focar campo menor que isso e não desamplia depois — a página fica
  torta pelo resto da visita. A condição é `(pointer: coarse)`, não largura: tablet tem
  largura de desktop e amplia igual.
- **Bloco cuja coluna é do tamanho de um número vira coluna única.** A largura da
  coluna do dinheiro muda com o valor, então o mesmo bloco desenhava diferente em cada
  item do carrinho: "+ R$ 825,00" cabia ao lado do rótulo e "+ R$ 2.835,39" quebrava.
  Rótulo em cima, valor alinhado à direita embaixo, igual em todo item.

## Movimento

- Curva `--ease`, durações `--dur-1: 120ms` (estado), `--dur-2: 240ms` (transição),
  `--dur-3: 420ms` (entrada).
- Sequência orquestrada existe em **três lugares e três registros**: a assinatura do
  hero (ousada), o mapa da entrega (média) e o contorno do cartão de autenticação
  (quieta). Fora desses: apenas micro-interação de hover/foco. Animação espalhada faz
  o site parecer gerado por IA. **Três é o teto** — a quarta sequência não entra sem
  uma sair.
- Todo movimento dentro de `@media (prefers-reduced-motion: reduce)` é desligado.

## Linha que se desenha

O traço que se desenha é o vocabulário de movimento da marca: caminho SVG com
`pathLength="1"`, escondido por `stroke-dasharray: 1; stroke-dashoffset: 1` e revelado
animando o offset até zero. Vale em **três registros**, e a diferença entre eles é o
que mantém a hierarquia:

- **Ousado — a assinatura, exclusiva do hero (`HomePage`).** A casa da marca sendo
  energizada: as trilhas entram pela borda, percorrem o contorno da casa e acendem os
  nós em sequência. Latão e tinta de sinal, sequência longa. É o único lugar onde o
  site é ousado.
- **Médio — o mapa da entrega (`DeliveryMap`, na confirmação do pedido).** A placa de
  circuito **é** o mapa: a linguagem da marca são trilhas de 90°/45° com nós de solda,
  que é o desenho de um traçado de ruas visto de cima. Ruas em `--rule`, rota percorrida
  em latão, trecho que falta tracejado, galpão de um lado e a casa do logo do outro —
  as duas construções sem linha de base, apoiadas na rua que já corre embaixo delas,
  como a casa do hero se apoia na hairline da faixa. O percurso liga duas coisas com
  relação real (de onde saiu, para onde vai), que é a única licença que este documento
  dá para trilha. **Um laço só**, e ele carrega informação: o pulso em tinta de sinal
  que sai do galpão e para onde a encomenda está agora — latão sobre latão desaparece,
  e sinal é a tinta de "ativo/conectado". O desenho é `aria-hidden`; quem carrega a
  informação é a lista de paradas embaixo dele.
- **Quieto — o contorno do formulário (`.auth-card`).** As linhas que delimitam o
  cartão (contorno, régua da cabeça, do grupo e do pé) são traçadas em `--rule`, sem
  latão e sem nós, numa sequência curta: a folha sendo riscada. Implementado por
  `DrawnFrame` e `DrawnRule` (`components/Drawn.jsx`) sobre os primitivos `.drawn-*`.

A marca de confirmação do Pix (`.co-pix-tick-path`) usa o mesmo vocabulário, mas não é
sequência: é **um traço só**, modificador do primitivo `.drawn-path`, no instante em que
o pagamento passa.

Onde a linha vira traço, a borda de CSS correspondente sai: duas linhas no mesmo
lugar é erro. No contorno do cartão a borda fica `border-color: transparent`, porque
o 1px ainda precisa ser reservado no layout; nos divisores internos ela é removida, e
o espaçamento fica com a régua. O `<svg>` nunca é dimensionado com `calc()` em
porcentagem nem esticado por `inset` — é elemento substituído e ignora os dois; quem
recebe posição e sangria é o `div` que o embrulha.

Nenhuma outra página compete com o hero.

## Piso de qualidade (não negociável)

- Responsivo até 360px de largura.
- Foco de teclado **visível** em tudo que é focável: `outline: 2px solid var(--signal)`
  com `outline-offset: 2px`. Nunca `outline: none` sem substituto visível.
- Contraste mínimo 4.5:1 em texto. Latão (`--brass`) **não** passa contraste sobre
  branco em texto pequeno: para texto use `--brass-deep`.
- Alvo de toque mínimo 40px, inclusive no que é pequeno por hierarquia: no toque,
  tamanho e destaque são coisas diferentes. Quando o rótulo encolhe para caber, o alvo
  cresce por baixo (padding ou `min-height`), sem mexer no layout em volta.
- Ícone é **SVG inline** com `stroke="currentColor"`, `stroke-width="1.5"`,
  `aria-hidden="true"`. **Emoji não é ícone**: use `<Icon name="..." />`, e novos ícones
  entram no conjunto de `components/Icon.jsx`, nunca soltos na página.
- Controle que esconde o input nativo (o seletor de segmentos, por exemplo) **repassa o
  contorno de foco** para o elemento visível: o foco é do input invisível, e sem repasse
  quem navega por teclado não vê onde está.
- Campo com problema é marcado no próprio campo, não só na mensagem embaixo: o primitivo
  reage a `aria-invalid="true"` com borda em `--alert`. Cor sozinha não basta — a
  mensagem de texto vem sempre junto, dizendo o que corrigir.
- Formulário valida **tudo de uma vez** e mostra todos os erros; o foco vai para o
  primeiro na ordem da tela. Corrigir um campo por envio é armadilha, não validação.
- Campo vazio fala em `--ink-hint`, cheio fala em `--ink`: é assim que se enxerga o que
  falta preencher sem ler tudo. `select` não tem `::placeholder`, então quem não escolheu
  nada leva `data-empty="true"` e o primitivo cuida da cor.

## Escrita da interface

Português do Brasil, voz ativa, frase capitalizada (não Caixa Alta Em Cada Palavra).
O botão diz o que acontece: "Pagar com Pix", não "Enviar" nem "Finalizar" — quem aperta
sabe que vai pagar, e por qual meio. A ação mantém o mesmo nome do começo ao fim do
fluxo. Erro explica o que aconteceu e como resolver, sem pedir desculpa. Tela vazia é
convite para agir, com o caminho à mão.

**O que é simulado diz que é simulado**, no miúdo do lugar onde acontece: o Pix no
resumo do checkout, o rastreio embaixo do mapa. E a interface **nunca anuncia aprovação
antes de o servidor confirmar** — a tela do Pix só troca para "aprovado" depois que o
pedido existe; se a compra falha, o comprovante sai da tela sem nunca ter dito que o
pagamento passou. Animação de confirmação é ilustração de um fato, não substituto dele.

## Regras de CSS (evitam conflito entre arquivos)

1. **Nunca** redefina primitivo de `primitives.css` (`.btn`, `.field`, `.alert`,
   `.card`, `.panel`, `.chip`, `.price`, `.grid`, `.eyebrow`, `.loader`, `.qty`,
   `.img-fallback`). Estenda com modificador prefixado da sua área.
2. Toda classe nova é prefixada pela área: `home-`, `cat-`, `pdp-`, `co-`, `acc-`.
3. **Nunca** use seletor de elemento nu (`section`, `h2`, `div`) em arquivo de área —
   só classe. Seletor de elemento vaza para as outras áreas.
4. Padding e margin de seção pertencem a **uma** classe só. Não empilhe `.section` +
   `.cta` mexendo no mesmo lado da caixa: é assim que regra cancela regra.
5. Especificidade máxima de uma classe simples. Sem `!important`.
