# Engajamento — especificação dos eventos e do mapeamento na Data 360

Documento de **entrega para quem vai modelar na org**. Ele responde três
perguntas: que eventos o site captura, o que exatamente vem em cada coluna, e
como isso deveria ser mapeado no Data Stream e nos DMOs.

O que está aqui foi conferido no código, não na lembrança. A fonte de cada
afirmação:

| Assunto | Arquivo |
| --- | --- |
| Lista de eventos, colunas, tipos e apelidos | `events-server/src/collect/contract.js` |
| Schema enviado à Ingestion API | `docs/data360/ecommerce_events.yaml` |
| O que cada clique manda | os pontos de `track(...)` em `client/src/` |
| Regras de horário e recusa na entrada | `events-server/src/collect/validate.js` |
| Envio (envelope, lote, retry) | `events-server/src/ingest/` |

Contexto de engenharia (por que existe um serviço separado, como rodar, como
subir) está em [ENGAJAMENTO.md](ENGAJAMENTO.md). O caminho de **PF/PJ e
pedidos** é outro, com outro connector, e não é assunto deste documento:
[INGESTAO-DATA360.md](../INGESTAO-DATA360.md).

---

## 1. Escopo e estado atual

Um único objeto de ingestão: **`ecommerce_events`**, uma linha por evento,
enviada por streaming.

O que o site **não** captura, para calibrar expectativa: nada de rolagem,
movimento de mouse ou teclado, nenhum cookie de terceiro, nenhum SDK externo.
Nada de senha, CPF/CNPJ ou telefone. São 14 interações escolhidas, cada uma
respondendo a uma pergunta de negócio.

| Item | Valor |
| --- | --- |
| Connector | **novo, dedicado a engajamento** (sugestão: `TechLar_Engagement`). O `TechLar_Ecom` de PF/PJ/pedidos não é tocado |
| Objeto | `ecommerce_events` (nome vem de `DATACLOUD_EVENTS_OBJECT`) |
| Endpoint | `POST /api/v1/ingest/sources/{connector}/ecommerce_events` |
| Envelope | `{"data":[ ... ]}`, lotes fechados por tamanho (≤190 KB), sucesso = `202` |
| Schema para carregar no connector | `docs/data360/ecommerce_events.yaml` |
| Estado hoje | coletor em produção recebendo cliques; **`EVENTS_DRY_RUN=true`**, ou seja nada foi ingerido na org ainda |

Dois avisos sobre o YAML e o nome:

- O arquivo declara **dois** objetos, `ecommerce_events` e
  `ecommerce_order_items`. Só o primeiro é escrito pelo coletor. O segundo está
  lá por herança do contrato antigo e **ninguém escreve nele hoje** — não crie
  Data Stream para ele esperando dado.
- O nome `ecommerce_events` também aparece num sink antigo do servidor da loja
  (`server/src/events/sinks/DataCloudIngestionSink.js`), que está **desligado**
  em produção (`EVENTS_SINK=console`). Se algum dia ele for ligado, aponte-o
  para outro objeto: dois produtores no mesmo objeto com formatos diferentes
  seria fonte de linha recusada.

---

## 2. O formato da linha: 26 colunas, sempre todas

Cada evento chega **plano**, sem array e sem objeto aninhado, e com **as 26
colunas presentes em toda linha**. Coluna que não se aplica àquele evento vem
como `""` (texto) ou `0` (número) — nunca ausente, nunca `null`.

Isso não é estilo, é exigência: o Data Stream recusa com
`400 required key [x] not found` qualquer registro que omita uma propriedade
declarada no schema, inclusive as que estão fora de `required`.

**Consequência direta para o mapeamento: `""` e `0` significam "não se aplica",
não "zero de verdade".** Quem descarta o vazio é a transformação na org.

| Coluna | Tipo | Preenchida por | Observação |
| --- | --- | --- | --- |
| `event_id` | string | navegador (UUID v4) | Chave de deduplicação. Sempre presente; o coletor gera um novo se vier fora do formato |
| `event_type` | string | navegador | Um dos 14 nomes da seção 4. Valor fora da lista é recusado com 400 e não chega |
| `occurred_at` | date-time | navegador (relógio do visitante) | ISO 8601 UTC. Ver seção 6 |
| `email` | string | **coletor**, a partir do token JWT | `""` quando anônimo. Nunca vem do corpo do evento |
| `device_id` | string | navegador (`localStorage`) | Sempre presente. Mesmo id do carrinho anônimo |
| `page_path` | string | navegador, em **todo** evento | Só o caminho (`/produtos`), **sem query string** |
| `surface` | string | navegador | De onde partiu o clique. Vocabulário por evento na seção 5 |
| `action` | string | navegador | Multiuso: vocabulário **diferente por evento**. Seção 5 |
| `reason` | string | navegador | Só em `identify` e `customer_type_selected` |
| `product_id` | string | navegador | Numérico na loja, chega **como texto** |
| `sku` | string | navegador | |
| `product_name` | string | navegador | Vem do campo `nome` do site |
| `category` | string | navegador | Slug: `notebooks`, `smartphones`, `impressoras-3d`, `servicos`… |
| `price` | number | navegador | Preço unitário. Ver cuidado 8.3 |
| `qty` | number | navegador | Quantidade do clique. Em `cart_item_removed`, a quantidade que estava na linha |
| `search_term` | string | navegador | Só em `search_performed` |
| `combo_id` | string | navegador | Slug do combo: `mesa-de-trabalho`, `bancada-do-atelie`, `casa-inteira` |
| `discount` | number | navegador | **Atenção: unidade muda por evento.** Ver cuidado 8.1 |
| `item_count` | number | navegador | Significado muda por evento. Ver cuidado 8.4 |
| `subtotal` | number | navegador | Idem. Ver cuidado 8.5 |
| `total` | number | navegador | Idem. Ver cuidados 8.2 e 8.5 |
| `order_number` | string | navegador | Só em `order_placed` e `order_tracking_viewed` |
| `status` | string | navegador | Só em `order_placed`; hoje sempre `confirmed` |
| `items_json` | string | navegador | JSON em texto, truncado em 4.000 caracteres. Ver cuidado 8.7 |
| `phone` | string | — | **Nunca preenchida** hoje. Sempre `""`. Ver cuidado 8.6 |
| `document` | string | — | **Nunca preenchida** hoje. Sempre `""`. Ver cuidado 8.6 |

Campos de texto são cortados em 500 caracteres (`items_json` em 4.000). Números
são arredondados em duas casas. Campo que o navegador mande e não esteja nesta
lista é **descartado na entrada**: o schema é fechado, e ninguém cria coluna
nova na org por acidente.

---

## 3. Configuração do Data Stream

| Ajuste | Valor | Por quê |
| --- | --- | --- |
| Categoria | **Engagement** | Uma linha por interação, com horário próprio |
| Event Time Field | `occurred_at` | A categoria Engagement exige um campo de data/hora do evento |
| Primary Key | `event_id` | É a chave de deduplicação. Ver cuidado 8.8 |

O DLO resultante é `ecommerce_events__dll` — é onde conferir o primeiro
registro depois de ligar a ingestão.

### 3.1 Do DLO para os DMOs

A decisão de modelo é da org, mas o formato do dado empurra para um caminho, e
vale registrar por quê.

**O dataset é homogêneo em formato e heterogêneo em significado**: uma linha por
interação, sempre com as mesmas 26 colunas, mas com colunas multiuso cujo
sentido depende do `event_type` (seções 5 e 8). Isso favorece:

1. **Um DMO de engajamento** recebendo os 14 tipos, com `event_id` como chave
   primária, `occurred_at` como data do evento e `event_type` como discriminador.
   É o mapeamento mais simples de manter, e o que preserva o funil inteiro numa
   linha do tempo só — a pergunta que este dataset foi desenhado para responder é
   sequencial ("de que vitrine veio quem comprou"), e sequência quebrada em
   vários DMOs custa junção.
2. **Transformações por família de evento**, se houver interesse em alimentar
   DMOs padrão de commerce (navegação de produto, carrinho, pedido). Aqui vale um
   aviso honesto: **confirme na org quais DMOs padrão existem e quais campos eles
   pedem** antes de prometer o mapeamento. Não recomendo mapear os 14 tipos para
   DMOs padrão diferentes sem antes olhar campo a campo, porque as colunas
   multiuso precisariam de conversão diferente em cada destino.

Em qualquer um dos dois caminhos, três regras de transformação:

- **Descartar `""` e `0`** (traduzir para nulo) antes de qualquer agregação:
  eles significam "não se aplica", não "vazio de verdade" nem "zero".
- **Filtrar por `event_type`** em toda métrica que use `action`, `surface`,
  `discount`, `subtotal`, `total` ou `item_count`.
- **Não mapear `email = ""`** em nada ligado a identidade (seção 7).

O `order_number` é a junção natural com o outro caminho de ingestão
(`ecommerce_orders`, connector `TechLar_Ecom`): é assim que o clique de origem se
liga ao pedido faturado.

---

## 4. Os 14 eventos, campo por campo

Nas tabelas abaixo, só as colunas **efetivamente preenchidas**. Todas as outras
chegam como `""` ou `0`.

Além delas, **todo** evento traz `event_id`, `event_type`, `occurred_at`,
`device_id`, `page_path` e — quando a pessoa está logada — `email`.

### 4.1 Combos (atribuição da faixa promocional da home)

#### `combo_clicked`
Clique no anúncio de combo na home. É a ponta do funil de promoção.

| Coluna | Conteúdo |
| --- | --- |
| `combo_id` | slug do combo anunciado |
| `action` | `montar` (botão "Montar combo", que joga os produtos no carrinho) ou `vitrine` (clique no card para ver os produtos) |
| `surface` | sempre `home` |
| `discount` | **o percentual do combo** (8, 10 ou 12) — não reais |
| `total` | preço "a partir de" já com desconto, do card. **Vitrine, não transação** |

#### `combo_qualified`
Não é clique: dispara quando o **carrinho passa a satisfazer** a regra de um
combo (ao menos um item de cada categoria da regra). Vale inclusive para quem
montou o carrinho sem nunca ver o anúncio.

| Coluna | Conteúdo |
| --- | --- |
| `combo_id` | slug do combo formado |
| `discount` | desconto **em reais** aplicado ao carrinho |
| `subtotal` | subtotal do carrinho antes do desconto |
| `item_count` | itens no carrinho |

Emitido **na virada**, não a cada leitura do carrinho: recarregar a página não
gera qualificação nova. Se o carrinho deixar de qualificar e voltar a qualificar
o mesmo combo, aí sim sai um evento novo. Para funil, trate como "o carrinho
qualificou", não como "clique".

### 4.2 Funil de compra

#### `search_performed`
Busca enviada pela navbar (só quando o termo não está vazio).

| Coluna | Conteúdo |
| --- | --- |
| `search_term` | o que foi digitado |
| `surface` | sempre `navbar` |

Serve principalmente para **busca sem resultado**: cruzar com a ausência de
`product_viewed` na sequência do mesmo `device_id`.

#### `product_viewed`
Abertura da página de produto (dispara quando o produto carrega, uma vez por
carregamento — não é clique).

| Coluna | Conteúdo |
| --- | --- |
| `product_id`, `sku`, `product_name`, `category`, `price` | o produto aberto |
| `surface` | vitrine de origem: `home`, `catalogo`, `busca`, `combo`, `wishlist` ou `direto` (link direto, recarga, sem origem interna) |

#### `cart_item_added`
Produto adicionado ao carrinho.

| Coluna | Conteúdo |
| --- | --- |
| `product_id`, `sku`, `product_name`, `category` | o produto |
| `price` | preço **unitário** da linha |
| `qty` | quantidade **adicionada neste clique** |
| `surface` | `pdp` (botão da página), `barra-fixa` (barra de compra do celular), `catalogo`, `home`, `busca`, `combo` (montagem pelo anúncio) ou `wishlist` |

O `surface` aqui é o campo que responde "qual vitrine converte" — em especial
`pdp` contra `barra-fixa`, que são duas decisões diferentes de comprar.

#### `cart_item_removed`
Produto removido do carrinho.

| Coluna | Conteúdo |
| --- | --- |
| `product_id`, `sku`, `product_name`, `category` | o produto |
| `price` | preço unitário |
| `qty` | quantidade que **estava** na linha removida |
| `surface` | `carrinho` |

#### `warranty_toggled`
Marcação da garantia estendida no carrinho. A garantia é **do pedido inteiro**
(3% da base garantível), não por produto.

| Coluna | Conteúdo |
| --- | --- |
| `action` | `on` (marcou) ou `off` (desmarcou) |
| `subtotal` | **base garantível**: subtotal menos serviços e menos linhas em combo |
| `total` | valor da garantia (3% da base) quando `on`; `0` quando `off` |

O evento existe nos dois sentidos de propósito: quem desmarcou é o público que
considerou e desistiu.

#### `checkout_started`
Revisão do checkout carregada.

| Coluna | Conteúdo |
| --- | --- |
| `item_count` | itens do pedido em revisão |
| `subtotal` | soma dos produtos |
| `total` | valor final (já com desconto e garantia) |
| `discount` | desconto do combo **em reais** |
| `combo_id` | slug do combo, se houver |
| `action` | `com-garantia` ou `sem-garantia` |

#### `order_placed`
Pedido confirmado (Pix aprovado na simulação).

| Coluna | Conteúdo |
| --- | --- |
| `order_number` | número do pedido — é a chave para casar com `ecommerce_orders` do outro caminho de ingestão |
| `status` | status do pedido; hoje sempre `confirmed` |
| `item_count` | número de linhas |
| `subtotal`, `total` | valores do pedido |
| `discount` | desconto do combo em reais |
| `combo_id` | slug do combo, se houver |
| `action` | `com-garantia` ou `sem-garantia` |
| `items_json` | as linhas do pedido em JSON, com três campos por linha: `[{"product_id":4,"qty":1,"unit_price":10000},{"product_id":7,"qty":2,"unit_price":249.9}]` |

### 4.3 Afinidade

#### `category_filtered`
Escolha de categoria.

| Coluna | Conteúdo |
| --- | --- |
| `category` | slug da categoria |
| `surface` | `home`, `catalogo` ou `rodape` |
| `item_count` | quantos **produtos existem** na categoria (vem `0` quando o clique é no rodapé) |

#### `wishlist_toggled`
Coração da lista de desejos.

| Coluna | Conteúdo |
| --- | --- |
| `action` | `add` ou `remove` |
| `product_id`, `sku`, `product_name`, `category`, `price` | o produto |
| `surface` | `pdp` ou `wishlist` |

### 4.4 Identidade e pós-compra

#### `identify`
Login ou cadastro concluído. **É o evento que costura** a navegação anônima
daquele `device_id` a um e-mail.

| Coluna | Conteúdo |
| --- | --- |
| `email` | preenchido (o token já existe quando o evento é emitido) |
| `reason` | `login` ou `cadastro` |
| `action` | tipo de pessoa: `PF` ou `PJ` (pode vir `""` se o cadastro não informou) |

#### `customer_type_selected`
Alternância entre pessoa física e jurídica no formulário (só quando muda).

| Coluna | Conteúdo |
| --- | --- |
| `action` | `PF` ou `PJ` |
| `reason` | sempre `cadastro` — **inclusive quando o formulário está no checkout**, porque é o mesmo componente. Para separar, use `page_path`: `/cadastro` ou `/checkout` |

Serve para qualificar B2B **antes** de o cadastro terminar: quem marcou PJ e
abandonou não aparece em lugar nenhum além daqui.

#### `order_tracking_viewed`
Abertura da página de acompanhamento do pedido.

| Coluna | Conteúdo |
| --- | --- |
| `order_number` | pedido acompanhado |
| `surface` | `primeira-vez` ou `retorno` (segunda visita à mesma página, na mesma sessão) |

---

## 5. Vocabulários controlados

`action` e `surface` são colunas multiuso: o vocabulário depende do
`event_type`. **Nunca agrupe por `action` ou `surface` sem filtrar `event_type`
antes** — `on`/`off` de garantia e `add`/`remove` de wishlist conviveriam no
mesmo balde.

| Evento | `action` | `surface` |
| --- | --- | --- |
| `combo_clicked` | `montar`, `vitrine` | `home` |
| `combo_qualified` | — | — |
| `search_performed` | — | `navbar` |
| `product_viewed` | — | `home`, `catalogo`, `busca`, `combo`, `wishlist`, `direto` |
| `warranty_toggled` | `on`, `off` | — |
| `cart_item_added` | — | `pdp`, `barra-fixa`, `catalogo`, `home`, `busca`, `combo`, `wishlist` |
| `cart_item_removed` | — | `carrinho` |
| `checkout_started` | `com-garantia`, `sem-garantia` | — |
| `order_placed` | `com-garantia`, `sem-garantia` | — |
| `category_filtered` | — | `home`, `catalogo`, `rodape` |
| `wishlist_toggled` | `add`, `remove` | `pdp`, `wishlist` |
| `identify` | `PF`, `PJ` | — |
| `customer_type_selected` | `PF`, `PJ` | — |
| `order_tracking_viewed` | — | `primeira-vez`, `retorno` |

Outros enumerados: `reason` ∈ {`login`, `cadastro`}; `status` ∈ {`confirmed`}
hoje (o banco admite `pending`, `cancelled`, `fulfilled`); `combo_id` ∈
{`mesa-de-trabalho`, `bancada-do-atelie`, `casa-inteira`}.

---

## 6. Horário do evento

`occurred_at` é o **relógio do navegador** no instante do clique, em ISO 8601
UTC. O coletor não confia nele cegamente:

- clique com data mais de **5 minutos no futuro** entra com a hora de agora
  (relógio adiantado de máquina é comum);
- clique com mais de **24 horas** de idade — aba esquecida aberta por dias —
  também entra com a hora de agora, para não reescrever o passado de um
  segmento.

Fora dessas travas, o valor é preservado como veio. **Não existe timestamp de
recebimento no payload**: a fila guarda um `received_at` para auditoria, mas ele
não é enviado à org. Se a diferença entre "quando clicou" e "quando chegou"
virar necessidade de análise, é mudança de schema — fale com o time do site.

---

## 7. Identidade: o que mapear e o que não mapear

| Coluna | Quando vem preenchida | Papel |
| --- | --- | --- |
| `device_id` | **sempre** | Costura a navegação de quem ainda não se identificou |
| `email` | só quando o POST trouxe token JWT válido | Chave forte de identidade |

O `email` é anexado **pelo coletor**, a partir do token assinado com o mesmo
segredo do site — e-mail enviado como propriedade do evento é ignorado de
propósito. Token vencido ou forjado não derruba o clique: ele entra anônimo.

Verificado em produção: logado, os cliques chegam com o e-mail; sem login,
chegam com `email = ""`.

Normalização na entrada: o e-mail é gravado em **minúsculas**, sem espaços nas
pontas, limitado a 200 caracteres; o `device_id`, a 120.

Recomendações para a modelagem:

- **Filtre `email = ""` antes de qualquer mapeamento de identidade.** String
  vazia mapeada em Contact Point Email vira uma chave compartilhada por todos os
  visitantes anônimos, e a Identity Resolution uniria pessoas diferentes num
  perfil só. É o erro mais caro possível neste dataset.
- `device_id` como identificador **secundário** (Party Identification com um tipo
  próprio, algo como "Device Id"), nunca como chave de unificação sozinho: um
  computador de casa pode ser de duas pessoas.
- O `identify` é a ponte entre os dois. A maior parte do volume é anônima **antes**
  do primeiro `identify` de cada dispositivo; a atribuição retroativa dessa
  navegação depende do casamento `device_id` → `email`, e é decisão da org até
  onde levar isso.

---

## 8. Cuidados de mapeamento (os que dão erro silencioso)

Esta seção é a mais importante do documento. Nada aqui gera erro de ingestão —
tudo gera **número errado com cara de certo**.

**8.1 `discount` tem duas unidades.** Em `combo_clicked` ele é o **percentual**
do combo (8, 10, 12). Em `combo_qualified`, `checkout_started` e `order_placed`
ele é **reais**. Somar a coluna sem filtrar `event_type` mistura as duas.
Recomendação: exponha duas medidas separadas na transformação.

**8.2 `total` em `combo_clicked` é preço de vitrine.** É o "a partir de" do card
(o conjunto mais barato que satisfaz a regra, já com desconto), não algo que
alguém pagou. Só `checkout_started` e `order_placed` trazem `total`
transacionado.

**8.3 `price` é sempre unitário**, nunca linha × quantidade. Em eventos de
carrinho é o preço unitário da linha; em `product_viewed` e `wishlist_toggled`,
o preço de catálogo.

**8.4 `item_count` tem dois sentidos.** Em `category_filtered` é **quantos
produtos a categoria tem** (catálogo); nos eventos de carrinho e pedido é
**quantos itens** o carrinho/pedido tem. E vem `0` no `category_filtered` do
rodapé, porque ali a tela não conhece a contagem.

**8.5 `subtotal`/`total` em `warranty_toggled` não são valores de pedido.** São
a base garantível e a taxa de 3%. Se entrarem numa métrica de receita, inflam.

**8.6 `phone` e `document` nunca são preenchidos.** Existem no schema por
simetria com o contrato de clientes, e chegam sempre `""`. Nenhum clique manda
telefone ou CPF/CNPJ — dado sensível não entra em evento de engajamento. Não
crie campo de DMO esperando conteúdo aqui.

**8.7 `items_json` é texto, e pode estar truncado.** Formato: array de objetos
com `product_id`, `qty` e `unit_price`, cortado em 4.000 caracteres
(um pedido teria de ser enorme para chegar lá). Para análise por linha de
pedido, prefira `ecommerce_orders`/itens do outro caminho de ingestão, usando
`order_number` como junção; `items_json` serve para ter o pedido inteiro dentro
do evento sem uma segunda consulta.

**8.8 O mesmo `event_id` pode chegar duas vezes.** A fila é store-and-forward
com retry: um POST que falha depois de a org já ter aceito o lote volta a ser
tentado. `event_id` como Primary Key do Data Stream é o que impede a linha
dobrada — não é opcional.

**8.9 `page_path` não tem query string.** É `location.pathname`, então a busca
aparece como `/produtos` e o termo só existe em `search_term`.

**8.10 Três eventos não são cliques.** `product_viewed` (abertura de página),
`combo_qualified` (estado do carrinho) e `order_tracking_viewed` (abertura de
página) não representam uma ação deliberada de clicar. Contá-los como clique
distorce qualquer taxa de conversão por clique.

---

## 9. Volume e limites (para dimensionar)

| Limite | Valor | Onde |
| --- | --- | --- |
| Eventos por POST do navegador | 25 (teto do coletor: 50) | `client/src/lib/track.js`, `EVENTS_MAX_PER_REQUEST` |
| Frequência de envio do navegador | a cada 2s, ou ao fechar a aba | `track.js` |
| Rate limit do coletor | 60 requisições e 600 eventos por minuto, por IP **e** por dispositivo | `EVENTS_RATE_*` |
| Ciclo do flusher | a cada 5s, até 500 linhas | `EVENTS_FLUSH_*` |
| Tamanho do lote enviado à org | ≤190 KB por request (teto oficial 200 KB) | `EVENTS_MAX_PAYLOAD_BYTES` |

Ordem de grandeza esperada por sessão: muitos `product_viewed` e
`category_filtered`, alguns `cart_item_*`, raros `order_placed`. Um evento de
pedido vale, em análise, muito mais do que cem de navegação.

---

## 10. Como validar antes de confiar no dado

Do lado do site, dois comandos que **não gravam nada** na org:

```bash
cd events-server
npm run probe -- TechLar_Engagement ecommerce_events   # nome existe? schema bate?
EVENTS_VALIDATE_ONLY=true npm run flush                # valida em /actions/test
```

`404` significa nome de connector/objeto errado; `400` traz a lista exata de
campo faltante ou sobrando; `202` significa pronto. Depois disso,
`EVENTS_DRY_RUN=false` liga a ingestão de verdade, e `npm run queue` mostra
enviados, recusados e o erro que a org devolveu por linha.

A conferência final é o DLO `ecommerce_events__dll`, procurando o `event_id`
que a fila mostrou.

Se algum campo deste documento precisar mudar de nome, tipo ou significado, a
alteração tem de acontecer **junto** no `ecommerce_events.yaml` e no
`contract.js` — existe um teste (`events-server/test/schema.test.js`) que falha
quando os dois divergem, justamente para o schema da org e o do site não
seguirem caminhos separados.
