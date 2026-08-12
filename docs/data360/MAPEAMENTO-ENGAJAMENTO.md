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
| Nomes de DMO e de campo da seção 3 | consulta ao modelo da org (`MktDataModelObject`, `MktDataModelField`) |

Para **executar** o que está aqui — o passo a passo de criar o connector, o Data
Stream e o DMO, na ordem, com o que preencher em cada tela — use o
[RUNBOOK-STREAM-ENGAJAMENTO.md](RUNBOOK-STREAM-ENGAJAMENTO.md). Este documento
explica o significado; o runbook diz o que clicar.

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

## 2. O formato da linha: 27 colunas, sempre todas

Cada evento chega **plano**, sem array e sem objeto aninhado, e com **as 27
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
| `customer_id` | string | **coletor**, a partir do token JWT | `WEB-PF-<id>`/`WEB-PJ-<id>` — a chave de `Individual` na org. `""` quando anônimo. Nunca vem do corpo |
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

### 3.1 Os treze DMOs, e quem recebe o quê

Consultei o modelo da org (`MktDataModelObject` e `MktDataModelField`, org
`demo-org`): os treze DMOs padrão de engajamento de commerce **existem todos**, com
os nomes de API usados aqui, e cada campo citado em 3.2 foi conferido um a um.

**Decisão tomada: só os padrão, sem DMO próprio.** Duas consequências, e é melhor
conhecê-las antes de escrever o primeiro Calculated Insight.

A boa: tudo cai em modelo que a plataforma entende, com relacionamento pronto para
Individual e Product, e sem manutenção de schema custom.

A cara: **o funil deixa de morar numa linha do tempo só.** `product_viewed` fica em
`ProductBrowseEngagement`, o carrinho em `ShoppingCartEngagement`, a busca em
`WebSearchEngagement`. A pergunta que este dataset foi desenhado para responder é
sequencial — "de que vitrine veio quem comprou" — e ela passa a custar junção entre
DMOs por `IndividualId` e horário. Some a isso o que não tem campo em lugar nenhum
do modelo padrão (`items_json`, `status`, a base garantível do `warranty_toggled` e
o percentual do `combo_clicked`): essas quatro informações **saem do DLO e não
chegam a DMO nenhum**. Continuam existindo em `ecommerce_events__dll`, então nada é
perdido de verdade — só deixa de estar no modelo harmonizado.

Dez dos treze recebem evento. Um é tabela de referência e os outros dois são do
caminho de pedidos:

| DMO | Recebe (`event_type`) | Papel |
| --- | --- | --- |
| `ProductBrowseEngagement` | `product_viewed` | Produto visto |
| `ShoppingCartEngagement` | `cart_item_added`, `cart_item_removed`, `checkout_started`, `order_placed`, `combo_qualified` | O carrinho inteiro, de item a compra |
| `ShoppingCartProductEngagement` | `cart_item_added`, `cart_item_removed` | Linha do carrinho, filha da anterior |
| `ShoppingCartEventType` | — | Tabela de referência, 5 linhas fixas (ver 3.2) |
| `ShoppingWishlistEngagement` | `wishlist_toggled` | Cabeçalho sintético, só para a filha ter mãe |
| `ShoppingWishlistItemEngagement` | `wishlist_toggled` | O produto que entrou/saiu da lista |
| `WebSearchEngagement` | `search_performed` | Busca no site |
| `WebsiteEngagement` | `category_filtered`, `order_tracking_viewed`, `customer_type_selected`, `identify`, `warranty_toggled` | Os cinco que não têm casa nativa |
| `WebsiteItemEngagement` | `category_filtered`, `warranty_toggled` | Dá destino ao `item_count` e ao valor da garantia |
| `PromotionEngagement` | `combo_clicked` | Clique no anúncio de combo |
| `PromotionItemEngagement` | `combo_clicked` | O combo como item, com o preço de vitrine |
| `SalesOrder` | — | Já vem de `ecommerce_orders`. Ver 3.2 antes de apontar evento para cá |
| `SalesOrderProduct` | — | Sem fonte: item de pedido só existe em `items_json` (3.2) |

Três regras de transformação valem para qualquer destino:

- **Traduzir `""` e `0` para nulo** antes de qualquer agregação: eles significam
  "não se aplica", não "vazio de verdade" nem "zero".
- **Filtrar por `event_type` sempre**, e não só nas métricas que usam `action`,
  `surface`, `discount`, `subtotal`, `total` ou `item_count` (seção 8): enquanto não
  houver roteamento, todo DMO recebe os 14 tipos. A expressão exata de cada um está
  em 3.1.2.
- **Nunca mapear `email = ""`** em nada ligado a identidade (3.4 e seção 7).

### 3.1.1 O roteamento: o mapeamento não filtra linha

Este é o detalhe que decide o desenho, e ele não aparece na tela de mapeamento:
**mapear uma DLO em N DMOs escreve *toda* linha da DLO nos N.** Não existe filtro
por linha no mapeamento — ele é campo a campo, e vale para o objeto inteiro.

Se `ecommerce_events__dll` for mapeada direto nos dez DMOs, cada `search_performed`
vira também um `ProductBrowseEngagement` sem produto, um `ShoppingCartEngagement`
com valor zero e mais sete registros vazios. Dez vezes o volume, lixo em todo DMO,
e métrica de contagem inutilizada em todos eles.

> **Decisão: conviver com o espalhamento, por enquanto.** O roteamento não foi
> implementado, e isso é escolha, não pendência esquecida. O que pesou: as
> transforms **não são metadado deployável** nesta org (procurado nos 447 tipos do
> catálogo), então seriam oito objetos construídos à mão na UI e fora do git; e
> refazer os 105 mapeamentos contra as DLOs derivadas é parte do preço. Em troca,
> como `event_type` é identificável nos dez DMOs (ver 3.1.2), nenhuma análise fica
> impossível — fica só mais cara e mais fácil de errar. Revisitar quando o volume
> ou um segmento errado justificar. O desenho abaixo é o plano de quando isso
> acontecer.

A saída é **Data Transform**: um por destino, com filtro de `event_type`, gravando
numa DLO derivada; o mapeamento acontece a partir dela. A DLO de saída precisa ser
criada na UI (transform não escreve na DLO de um Data Stream). São oito:

| Transform | Filtro `event_type IN (...)` | DLO de saída | Mapeada em |
| --- | --- | --- | --- |
| 1 | `product_viewed` | `ev_product_browse` | `ProductBrowseEngagement` |
| 2 | `cart_item_added`, `cart_item_removed`, `checkout_started`, `order_placed`, `combo_qualified` | `ev_cart` | `ShoppingCartEngagement` |
| 3 | `cart_item_added`, `cart_item_removed` | `ev_cart_item` | `ShoppingCartProductEngagement` |
| 4 | `wishlist_toggled` | `ev_wishlist` | `ShoppingWishlistEngagement` **e** `ShoppingWishlistItemEngagement` |
| 5 | `search_performed` | `ev_search` | `WebSearchEngagement` |
| 6 | `category_filtered`, `order_tracking_viewed`, `customer_type_selected`, `identify`, `warranty_toggled` | `ev_website` | `WebsiteEngagement` |
| 7 | `category_filtered`, `warranty_toggled` | `ev_website_item` | `WebsiteItemEngagement` |
| 8 | `combo_clicked` | `ev_promotion` | `PromotionEngagement` **e** `PromotionItemEngagement` |

Repare em 4 e 8: ali o "escreve toda linha nos dois" é exatamente o que se quer —
cada clique gera o cabeçalho e o item de uma vez. Já 2 e 3 precisam ser separadas
porque `checkout_started` e `order_placed` não podem virar linha de produto.

Além do filtro, a transform é onde nascem as coisas que o mapeamento não sabe fazer:

- **Constante** (`ProductBrowseEventType = 'view'`, `IsPageView = false`, o
  `ItemId = 'garantia-estendida'`). O mapeamento liga campo a campo e não escreve
  literal.
- **`""`/`0` → nulo** (`NULLIF`), pela regra acima.
- **Normalização do `event_type`** para o vocabulário do DMO (`cart_item_added` →
  `add`), quando não quiser o nome do nosso contrato dentro do modelo deles.

Um campo de destino aceita **uma origem só**, então duas colunas nossas nunca podem
apontar para o mesmo campo deles. Onde isso ameaçava acontecer (`surface` × `action`),
a saída foi usar `PageName` para o `surface` em vez de coluna derivada — ver 3.2.

### 3.1.2 Enquanto não há roteamento: como filtrar cada DMO

Sem as transforms, **todo DMO recebe os 14 tipos de evento**. Consulta, Calculated
Insight e segmento precisam filtrar — sempre. Esta é a expressão exata por DMO, e
todas são precisas: nenhuma depende de inferir por campo vazio.

| DMO | Filtro que isola os eventos que pertencem ali |
| --- | --- |
| `ProductBrowseEngagement` | `ProductBrowseEventType = 'product_viewed'` |
| `ShoppingCartEngagement` | `ShoppingCartEventTypeId IN ('cart_item_added','cart_item_removed','checkout_started','order_placed','combo_qualified')` |
| `ShoppingCartProductEngagement` | `EngagementType IN ('cart_item_added','cart_item_removed')` |
| `WebSearchEngagement` | `EngagementType = 'search_performed'` |
| `WebsiteEngagement` | `EngagementTypeId IN ('category_filtered','order_tracking_viewed','customer_type_selected','identify','warranty_toggled')` |
| `ShoppingWishlistEngagement` e `…ItemEngagement` | `EngagementType IN ('add','remove')` |
| `PromotionEngagement` e `PromotionItemEngagement` | `EngagementType IN ('montar','vitrine')` |
| `WebsiteItemEngagement` | `EngagementType IN ('on','off')` para a garantia; o `category_filtered` se reconhece por `ItemCategory1Name <> ''` |

Os quatro primeiros e o `WebsiteEngagement` carregam o `event_type` em campo
próprio. Nos de wishlist e de promoção o campo carrega o `action`, e isso basta
porque o vocabulário é exclusivo: só o `wishlist_toggled` produz `add`/`remove`, só
o `combo_clicked` produz `montar`/`vitrine` (seção 5). O `WebsiteItemEngagement` é o
único com um caso imperfeito, o `category_filtered`.

O `WebSearchEngagement` era o único sem discriminador nenhum — uma busca e um login
cairiam lá indistinguíveis. Ganhou `event_type` → `EngagementType`, que estava
livre, justamente para não depender de "tem `SearchQueryText` preenchido".

### 3.2 Campo a campo, por DMO

Nomes conferidos um por um no modelo da org (`MktDataModelField`, via Tooling API).
Onde a tabela diz "sem destino", é porque o campo **não existe** naquele DMO — não
é escolha de estilo.

Quatro armadilhas de nomenclatura, todas já verificadas:

1. A data do evento é **`EngagementDateTm`** em `ProductBrowseEngagement`,
   `ShoppingCartEngagement`, `ShoppingCartProductEngagement`, `WebSearchEngagement`
   e `WebsiteEngagement`, e **`EngagementDateTime`** em `PromotionEngagement`,
   `PromotionItemEngagement`, `WebsiteItemEngagement` e nos dois de wishlist. Não é
   a mesma string, e a UI não avisa.
2. O preço é `ProductPriceAmount` em quase todos, mas **`ProductPrice`** em
   `ShoppingCartProductEngagement`.
3. O SKU é `ProductSKU` em `ProductBrowseEngagement`, **`ProductSKUNumber`** em
   `ShoppingCartProductEngagement`, e os dois existem em `ShoppingCartEngagement`.
4. Nos DMOs de item (`WebsiteItemEngagement`, `PromotionItemEngagement`) o produto
   se chama `Item*`, não `Product*`: `ItemId`, `ItemPriceAmount`, `ItemQuantity`.

O que vale para **todos**:

| Nossa coluna | Campo do DMO |
| --- | --- |
| `event_id` | `Id` — é a chave; mesma coisa que a PK do Data Stream |
| `event_id` | Também a FK da filha para a mãe, nos quatro pares (a mãe usa o mesmo `event_id` como `Id`) |
| `occurred_at` | `EngagementDateTm` ou `EngagementDateTime`, conforme a armadilha 1 |
| `email` | Não vai em campo de evento: alimenta a identidade (3.4) |
| `device_id` | `WebCookieId` — existe só em `ProductBrowseEngagement`, `ShoppingCartEngagement`, `WebSearchEngagement` e `WebsiteEngagement` |
| `page_path` | `PageURL` (é caminho relativo, não URL completa — ver 8.9) |
| `event_type` | O discriminador: vira o filtro da transform e o tipo específico do DMO |
| `phone`, `document` | **Nunca mapear**: chegam sempre `""` (8.6) |

**`ProductBrowseEngagement`** ← `product_viewed` (transform 1)

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `product_id` | `ProductId` | Texto, mesmo sendo numérico na loja |
| `sku` | `ProductSKU` | |
| `product_name` | `Name` | Rótulo do registro. O nome canônico mora no DMO `Product`, alcançado por `ProductId` — aqui é conveniência de leitura |
| `category` | `ProductCategoryName` | |
| `price` | `ProductPriceAmount` | Preço de catálogo, unitário (8.3) |
| `device_id` | `WebCookieId` | |
| `page_path` | `PageURL` | |
| `surface` | `EngagementNotesTxt` | `home`, `catalogo`, `busca`, `combo`, `wishlist`, `direto` |
| constante `view` | `ProductBrowseEventType` | Nasce na transform |
| — | `SessionId`, `ShoppingCartId` | Ficam vazios (3.3) |

**`ShoppingCartEngagement`** ← `cart_item_added`, `cart_item_removed`,
`checkout_started`, `order_placed`, `combo_qualified` (transform 2)

O DMO mais carregado: cinco tipos numa tabela só, distinguidos pelo
`ShoppingCartEventTypeId`. Comum aos cinco:

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `event_id` | `Id` | |
| `occurred_at` | `EngagementDateTm` | |
| `device_id` | `WebCookieId` | |
| `page_path` | `PageURL` | |
| `event_type` | `ShoppingCartEventTypeId` | `add`, `remove`, `checkout`, `purchase`, `promotion_qualified` |

Só nos dois de item (`cart_item_added`, `cart_item_removed`):

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `product_id` | `ProductId` | |
| `sku` | `ProductSKU` | `ProductSKUNumber` também existe aqui; escolha um e mantenha |
| `product_name` | `Name` | |
| `category` | `ProductCategoryName` | |
| `price` | `ProductPriceAmount` | Unitário (8.3) |
| `qty` | `ProductQuantity` | No `removed`, a quantidade que **estava** na linha |
| `surface` | `PageName` | A vitrine de origem. Ver o aviso abaixo sobre por que não é `EngagementNotesTxt` |

Só nos três de valor (`checkout_started`, `order_placed`, `combo_qualified`):

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `item_count` | `TotalProductQuantity` | |
| `subtotal` | `TotalProductAmount` | |
| `total` | `NetOrderAmount` | Só `checkout_started` e `order_placed` têm total transacionado (8.2) |
| `discount` | `TotalAdjustmentAmount` | Em reais nos três — o percentual só existe no `combo_clicked` (8.1) |
| `combo_id` | `PromotionCouponId` | |
| `action` (`com-garantia`/`sem-garantia`) | `EngagementNotesTxt` | |
| `order_number` | `SalesOrderId` | Só `order_placed`. **É o laço com o pedido faturado**: o mapeamento de `ecommerce_orders` usa `sales_order_id ← order_number` (`contractMappers.js:107`), então o valor é o mesmo dos dois lados |
| `status` | **Sem destino** | O status do pedido vive em `SalesOrder` |
| `items_json` | **Sem destino** | Ver a nota de `SalesOrderProduct`, adiante |

> **Por que `surface` vai em `PageName`.** `surface` e `action` disputariam o
> `EngagementNotesTxt`, e um campo de destino aceita uma origem só. Dava para
> resolver com coluna derivada na transform, mas não precisa: `PageName` está livre
> e o significado casa ("de qual vitrine partiu"). Um campo para cada, sem fórmula.
> É assim que está deployado hoje (3.2.2).

Ficam vazios, e é o que 3.3 destrava: `ShoppingCartId`, `CheckoutId`, `SessionId`,
`WebSession`.

Sobre o `order_placed`: ele **não substitui** o `ecommerce_orders`. Aquele é o
pedido como fato, este é o pedido como interação, fechando o funil na mesma linha
do tempo dos cliques.

**`ShoppingCartProductEngagement`** ← `cart_item_added`, `cart_item_removed`
(transform 3)

A linha do carrinho, filha da anterior. Vale mapear mesmo sem `cart_id`: a mãe
existe (é o próprio evento), e é aqui que o nome do produto e o valor da linha
cabem sem gambiarra.

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `event_id` | `Id` | |
| `event_id` | `ShoppingCartEngagementId` | A mãe usa o mesmo `event_id` como `Id` — é o que amarra as duas |
| `occurred_at` | `EngagementDateTm` | Não é `DateTime`, apesar de ser DMO de item |
| `product_id` | `ProductId` | |
| `sku` | `ProductSKUNumber` | **Não** `ProductSKU`: não existe aqui |
| `product_name` | `ShoppingCartProductItemName` | Campo dedicado a nome de item |
| `category` | `ProductCategoryName` | |
| `price` | `ProductPrice` | **Não** `ProductPriceAmount` |
| `qty` | `ProductQuantity` | |
| `price × qty` | `ProductAmount` | Calculado na transform, se quiserem valor de linha pronto |
| `event_type` → `add`/`remove` | `EngagementType` | |
| `surface` | `ProductListName` | De qual vitrine veio o item |
| `device_id` | **Sem destino** | Este DMO não tem `WebCookieId`; o clique anônimo só se pendura na mãe |

**`ShoppingCartEventType`** — tabela de referência, não recebe evento

Ela só tem `Id` e `Name`. O `ShoppingCartEventTypeId` que a mãe grava aponta para
cá; sem os registros, o valor fica órfão e a junção não resolve. São cinco linhas
fixas (`add`, `remove`, `checkout`, `purchase`, `promotion_qualified`), que entram
por um Data Stream de arquivo com duas colunas. Cinco minutos, uma vez.

**`WebSearchEngagement`** ← `search_performed` (transform 5)

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `event_id` | `Id` | |
| `occurred_at` | `EngagementDateTm` | |
| `search_term` | `SearchQueryText` | Existem também `OriginalSearchQueryText` e `SearchKeywordsTxt`, e dá para mandar a mesma coluna para os três (3.2.2, item 5) |
| `device_id` | `WebCookieId` | |
| `page_path` | `PageURL` | Sempre `/produtos` ou a rota de onde buscou — o termo **não** está na URL (8.9) |
| `surface` (`navbar`) | `EngagementNotesTxt` | Hoje é constante; ganha sentido se a busca aparecer em outro lugar |
| constante `false` | `IsPageView` | Busca não é página vista |
| — | `ResultsReturnedQuantity` | Fica vazio, e é uma pena: com ele "busca sem resultado" seria filtro, e não inferência por ausência (3.3) |

**`ShoppingWishlistEngagement` + `ShoppingWishlistItemEngagement`** ←
`wishlist_toggled` (transform 4, mapeada nos dois)

O item exige uma mãe (`ShoppingWishlistEngagementId`), e nosso contrato não tem
evento de cabeçalho. A saída é sintetizar: a mesma linha vira os dois registros,
com o `event_id` servindo de `Id` na mãe e de FK na filha.

Na mãe (`ShoppingWishlistEngagement`):

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `event_id` | `Id` | |
| `occurred_at` | `EngagementDateTime` | |
| `page_path` | `PageURL` | |
| `action` | `EngagementType` | `add` ou `remove` |
| `price` | `TotalProductAmount` | O valor do que entrou/saiu; é o único campo de dinheiro do cabeçalho |
| constante `false` | `IsPageView` | |

Na filha (`ShoppingWishlistItemEngagement`):

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `event_id` | `Id` e `ShoppingWishlistEngagementId` | |
| `occurred_at` | `EngagementDateTime` | |
| `action` | `EngagementType` | |
| `product_id` | `ProductId` | |
| `product_name` | `Name` | |
| `price` | `ProductPriceAmount` | |
| `category` | `ProductCategory1Name` | Note o `1`: aqui a categoria é numerada |
| `surface` | `ProductListName` | `pdp` ou `wishlist` |
| `sku` | **Sem destino** | Este DMO não tem campo de SKU. Se o SKU importar na análise de wishlist, ele é alcançável pelo `ProductId` |
| `device_id`, `page_path` | **Sem destino** | Nenhum dos dois existe na filha |

Nenhum dos dois tem `WebCookieId`, e aqui isso não dói: a lista de desejos exige
login (`wishlist.routes.js` aplica `requireAuth`), então todo `wishlist_toggled`
chega com e-mail.

**`PromotionEngagement` + `PromotionItemEngagement`** ← `combo_clicked`
(transform 8, mapeada nos dois)

Mesmo arranjo do wishlist: a mesma linha vira cabeçalho e item. Aqui o "item" é o
próprio combo, e é a filha que dá destino ao preço de vitrine.

Na mãe (`PromotionEngagement`):

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `event_id` | `Id` | |
| `occurred_at` | `EngagementDateTime` | |
| `combo_id` | `PromotionName` e `PromotionObjectId` | Slug do combo nos dois |
| `action` | `EngagementType` | `montar` ou `vitrine` |
| `surface` (`home`) | `ContentSlotName` | O campo existe justamente para "onde na página estava o anúncio" |
| `page_path` | `PageURL` | |
| constante `false` | `IsPageView` | |
| `device_id` | **Sem destino** | Este DMO não tem `WebCookieId` — e o `combo_clicked` é da home, onde o tráfego anônimo é maior. É a perda mais sentida do modelo padrão |
| `discount` (percentual) | **Sem destino** | O DMO não tem campo de valor, e o nosso é percentual (8.1). Não force num campo `Amount` |

Na filha (`PromotionItemEngagement`):

| Nossa coluna | Campo do DMO | Nota |
| --- | --- | --- |
| `event_id` | `Id` e `PromotionEngagementId` | |
| `occurred_at` | `EngagementDateTime` | |
| `combo_id` | `ItemId`, `PromotionName`, `PrimaryCouponName` | |
| `total` | `ItemPriceAmount` | O "a partir de" do card. **Vitrine, não transação** (8.2) — deixe isso claro em qualquer métrica |
| `action` | `EngagementType` | |
| `surface` | `ContentSlotName` | |
| constante `1` | `ItemQuantity` | |
| `discount` (percentual) | **Não mapear** em `ItemTotalDiscountAmount` | O campo é valor em reais; o nosso é percentual. Misturar aqui é o 8.1 virando número errado com cara de certo |

O `combo_qualified` **não** vem para cá: ele é dinheiro de carrinho, e vai em
`ShoppingCartEngagement` com o tipo `promotion_qualified` (ver acima).

**`WebsiteEngagement`** ← `category_filtered`, `order_tracking_viewed`,
`customer_type_selected`, `identify`, `warranty_toggled` (transform 6)

O destino dos cinco que não têm casa nativa. O encaixe é fraco por definição — o
modelo padrão não previu "categoria filtrada" nem "garantia marcada" — mas os
campos genéricos de formulário e botão dão conta do vocabulário.

Comum aos cinco: `event_id` → `Id`, `occurred_at` → `EngagementDateTm`,
`device_id` → `WebCookieId`, `page_path` → `PageURL` e `event_type` →
`EngagementTypeId`. Este último é o que separa os cinco tipos depois, e vale ainda
mais aqui do que nos outros DMOs: sem ele, cinco eventos diferentes viram uma
massa só.

| Evento | Nossa coluna | Campo do DMO |
| --- | --- | --- |
| `category_filtered` | `category` | `ItemListName` (ou `WebsiteCatalogCategoryId`, se criarem registros de categoria) |
| | `surface` (`home`/`catalogo`/`rodape`) | `PageName` |
| | `item_count` | Vai na filha `WebsiteItemEngagement` — ver adiante |
| `order_tracking_viewed` | `order_number` | `SalesOrderId` |
| | `surface` (`primeira-vez`/`retorno`) | `PageName` |
| | constante `true` | `IsPageView` |
| `customer_type_selected` | `reason` (`cadastro`) | `FormName` |
| | `action` (`PF`/`PJ`) | `DisplayButtonLabelText` |
| | `page_path` | `PageURL` — **é o que separa** `/cadastro` de `/checkout` (o `reason` é `cadastro` nos dois) |
| `identify` | `reason` (`login`/`cadastro`) | `FormName` |
| | `action` (`PF`/`PJ`) | `DisplayButtonLabelText` |
| `warranty_toggled` | `action` (`on`/`off`) | `DisplayButtonLabelText` |
| | `total` (valor da garantia) | `TotalAmount` |
| | `subtotal` (base garantível) | **Sem destino** — o DMO tem um campo de valor só |

> Mesma solução do carrinho: `surface` sai do `DisplayButtonLabelText` e vai para o
> `PageName`, deixando o botão só para o `action`. Cada coluna nossa num campo
> deles, sem fórmula e sem coluna derivada.

O `identify` merece um aviso: ele **não é engajamento**. Vira registro aqui para
não sumir, mas o valor dele é ligar `device_id` a e-mail, e isso acontece na
identidade (3.4), não neste DMO.

**`WebsiteItemEngagement`** ← `category_filtered`, `warranty_toggled` (transform 7)

Existe para dar destino a duas coisas que o cabeçalho não comporta: quantos
produtos a categoria tem, e a garantia como se fosse um item.

| Evento | Nossa coluna | Campo do DMO |
| --- | --- | --- |
| ambos | `event_id` | `Id` e `WebsiteEngagementId` |
| ambos | `occurred_at` | `EngagementDateTime` (aqui é `DateTime`, na mãe é `DateTm`) |
| `category_filtered` | `category` | `ItemId`, `ItemListName` e `ItemCategory1Name` |
| | `item_count` | `ItemQuantity` — lembrando que aqui significa "produtos na categoria", e vem `0` no clique do rodapé (8.4) |
| | constante `category_filtered` | `EngagementType` |
| `warranty_toggled` | constante `garantia-estendida` | `ItemId` e `Name` |
| | `total` | `ItemPriceAmount` (o valor da garantia, 3% da base) |
| | `action` (`on`/`off`) | `EngagementType` |

**`SalesOrder` e `SalesOrderProduct`** — não receba evento aqui

- **`SalesOrder`** já é alimentado por `ecommerce_orders`, com `Id ← sales_order_id`.
  Mapear `order_placed` também para cá cria um **segundo produtor no mesmo `Id`**,
  com menos campos: o evento não carrega `customer_id`, então `SoldToCustomerId`
  chegaria vazio e disputaria com o valor bom. O laço entre os dois mundos já
  existe pelo `ShoppingCartEngagement.SalesOrderId`, que é o mesmo número.
- **`SalesOrderProduct`** fica vazio, e não há como preencher daqui: a única fonte
  de linha de pedido é o `items_json`, que é **texto**. Explodir JSON em linhas não
  é mapeamento nem transform simples. É exatamente o buraco que um objeto de itens
  na ingestão resolveria — hoje inexistente (o `ecommerce_order_items` do YAML não
  tem produtor, ver seção 1).

### 3.2.1 Índice reverso: onde cada uma das 27 colunas vai parar

A mesma informação, virada do avesso — útil na hora de conferir se alguma coluna
ficou para trás.

| Nossa coluna | Campo(s) de destino |
| --- | --- |
| `event_id` | `Id` nos dez DMOs; e a FK da filha nos quatro pares (`ShoppingCartEngagementId`, `ShoppingWishlistEngagementId`, `WebsiteEngagementId`, `PromotionEngagementId`) |
| `event_type` | `ShoppingCartEventTypeId`, `ProductBrowseEventType`, `EngagementType` — e o filtro de toda transform |
| `occurred_at` | `EngagementDateTm` (ProductBrowse, ShoppingCart, ShoppingCartProduct, WebSearch, Website) · `EngagementDateTime` (os dois de wishlist, os dois de promotion, WebsiteItem) |
| `email` | Nenhum campo de evento. Serve à identidade e à Identity Resolution (3.4) |
| `customer_id` | `IndividualId` nos dez DMOs — é o que liga o clique ao perfil (3.4) |
| `device_id` | `WebCookieId` em ProductBrowse, ShoppingCart, WebSearch e Website. **Sem destino** nos outros seis |
| `page_path` | `PageURL` em ProductBrowse, ShoppingCart, WebSearch, Website, Promotion e WishlistEngagement |
| `surface` | `EngagementNotesTxt` (ProductBrowse, WebSearch) · `PageName` (ShoppingCart, Website) · `ProductListName` (ShoppingCartProduct, WishlistItem) · `ContentSlotName` (Promotion, PromotionItem) |
| `action` | `EngagementType` (ShoppingCartProduct, wishlist, promotion, WebsiteItem) · `DisplayButtonLabelText` (Website) · `EngagementNotesTxt` (ShoppingCart, `com-garantia`/`sem-garantia`) |
| `reason` | `FormName` (Website) |
| `product_id` | `ProductId` (ProductBrowse, ShoppingCart, ShoppingCartProduct, WishlistItem) |
| `sku` | `ProductSKU` (ProductBrowse, ShoppingCart) · `ProductSKUNumber` (ShoppingCartProduct) · **sem destino** no WishlistItem |
| `product_name` | `Name` (ProductBrowse, ShoppingCart, WishlistItem) · `ShoppingCartProductItemName` (ShoppingCartProduct) |
| `category` | `ProductCategoryName` (ProductBrowse, ShoppingCart, ShoppingCartProduct) · `ProductCategory1Name` (WishlistItem) · `ItemListName`/`ItemId`/`ItemCategory1Name` (WebsiteItem) |
| `price` | `ProductPriceAmount` (ProductBrowse, ShoppingCart, WishlistItem) · `ProductPrice` (ShoppingCartProduct) · `TotalProductAmount` (WishlistEngagement) |
| `qty` | `ProductQuantity` (ShoppingCart, ShoppingCartProduct) |
| `search_term` | `SearchQueryText` (+ `OriginalSearchQueryText`) |
| `combo_id` | `PromotionCouponId` (ShoppingCart) · `PromotionName`/`PromotionObjectId` (Promotion) · `ItemId`/`PrimaryCouponName` (PromotionItem) |
| `discount` | `TotalAdjustmentAmount` (ShoppingCart) — **só os reais**. O percentual do `combo_clicked` **não tem destino**, de propósito (8.1) |
| `item_count` | `TotalProductQuantity` (ShoppingCart) · `ItemQuantity` (WebsiteItem, no `category_filtered`) |
| `subtotal` | `TotalProductAmount` (ShoppingCart). A base garantível do `warranty_toggled` **não tem destino** (8.5) |
| `total` | `NetOrderAmount` (ShoppingCart) · `TotalAmount` (Website, garantia) · `ItemPriceAmount` (PromotionItem, vitrine) |
| `order_number` | `SalesOrderId` — em ShoppingCart (`order_placed`) e em Website (`order_tracking_viewed`) |
| `status` | **Sem destino.** Vive em `SalesOrder.SalesOrderStatus`, do outro caminho |
| `items_json` | **Sem destino.** Precisaria de `SalesOrderProduct`, que não tem como ser preenchido daqui |
| `phone` | **Sem destino.** Sempre `""` (8.6) |
| `document` | **Sem destino.** Sempre `""` (8.6) |

### 3.2.2 Estado na org, e o que a prática ensinou

O Data Stream existe: `Techlar_Engagement_ecommerce_events_BC4B90B7` (label
"Techlar Engagement-ecommerce_events"), com o DLO
`Techlar_Engagement_ecommerce_ev_BC4B90B7__dll` já criado, as 27 colunas dentro e
`KQ_event_id__c` como chave. **Os dez DMOs estão mapeados**, com 105 mapeamentos de
negócio no total (cada um tem ainda dois de sistema, `DataSource` e
`DataSourceObject`, que a própria org cria):

| DMO | Campos mapeados |
| --- | --- |
| `ssot__ShoppingCartEngagement__dlm` | 20 |
| `ssot__ProductBrowseEngagement__dlm` | 12 |
| `ssot__ShoppingCartProductEngagement__dlm` | 12 |
| `ssot__WebsiteEngagement__dlm` | 12 |
| `ssot__ShoppingWishlistItemEngagement__dlm` | 10 |
| `ssot__PromotionItemEngagement__dlm` | 9 |
| `ssot__PromotionEngagement__dlm` | 8 |
| `ssot__WebsiteItemEngagement__dlm` | 8 |
| `ssot__WebSearchEngagement__dlm` | 8 |
| `ssot__ShoppingWishlistEngagement__dlm` | 6 |

Os dez incluem `customer_id__c` → `ssot__IndividualId__c`, que é o que liga o
clique ao perfil (3.4). Vinte e duas das 27 colunas do contrato chegam a algum DMO.
As cinco que não chegam são exatamente as previstas em 3.2.1: `phone` e `document`
(sempre vazias),
`items_json` (precisaria de `SalesOrderProduct`), `status` (vive em `SalesOrder`) e
`email` (não é campo de evento — alimenta a identidade, 3.4).

O caminho foi: semear cada DMO na UI com o mínimo (`event_id` na chave e o campo de
data), e completar o resto por deploy de metadado. Cinco coisas aprendidas fazendo,
que economizam tempo de quem continuar:

1. **O mapeamento é metadado deployável** (`ObjectSourceTargetMap`, com
   `fieldSourceTargetMaps` aninhados). Dá para versionar e subir por CLI em vez de
   arrastar campo por campo na tela.
2. **Mas só para DMO que já existe no data space.** Deploy apontando para um DMO
   padrão nunca usado falha com erro genérico ("An unexpected error occurred" + um
   ErrorId). Comprovado por bissecção: o mesmo XML mínimo validou contra
   `ssot__Individual__dlm` (em uso) e falhou contra
   `ssot__ProductBrowseEngagement__dlm` (não instanciado). **O primeiro mapeamento
   de cada DMO tem de ser criado na UI** — é isso que instancia o objeto. Depois
   disso, o resto vai por deploy.
3. **O filtro por tipo de evento não funciona neste caminho.** O metadado tem
   `filterApplied`/`filterValue`, a documentação os descreve como filtro de event
   type, e o deploy com `filterApplied=true` + `filterValue=product_viewed`
   retornou `Succeeded`. Só que ao reler o mapa da org, ele voltou com
   `filterApplied=false`: a plataforma **aceitou e descartou** em silêncio. A UI
   também não oferece a opção. Ou seja, não há atalho — **as transforms de 3.1.1
   continuam sendo o jeito de rotear por `event_type`**. Não vale a pena tentar de
   novo.
4. **O deploy é aditivo no nível de campo.** Subir o mapa sem um mapeamento não o
   remove: um `product_id → ProductListId` errado sobreviveu ao redeploy e ficou
   convivendo com o `product_id → ProductId` certo. Para tirar um mapeamento errado
   é preciso **apagar o `ObjectSourceTargetMap` inteiro e recriá-lo** (`sf project
   delete source`, depois deploy). Apagar não desinstancia o DMO — testado.
5. **Uma coluna nossa pode alimentar dois campos deles.** O que não pode é o
   contrário (dois de origem no mesmo destino). Está em uso em `combo_id` →
   `PromotionName` + `PromotionObjectId` e em `category` → `ItemCategory1Name` +
   `ItemListName`.
6. **Coluna nova no schema não chega sozinha ao Data Stream.** Ao acrescentar o
   `customer_id`, subir o YAML no connector fez a tela dele mostrar 27 atributos —
   e mais nada: o Data Stream continuou com 26, o DLO sem a coluna, e o
   `/actions/test` recusando o registro com `extraneous key [customer_id] is not
   permitted`. Falta o passo do outro lado: **Data Streams → o stream →
   `Add Source Fields`**, que é o que cria a coluna no DLO. Só depois disso o
   mapeamento tem o que mapear. O `npm run probe` distingue os dois estados em
   dois segundos: `400` com o nome do campo culpado, ou `202`.

### 3.3 O que falta do nosso lado (e por que agora é barato)

Cinco acréscimos ao contrato destravariam o modelo padrão. Nenhum é grande:

| Campo novo | Destrava | Custo do lado do site |
| --- | --- | --- |
| `cart_id` | `ShoppingCartId` nos eventos de carrinho — e, de quebra, **carrinho abandonado contado por carrinho**, não por dispositivo | o carrinho já tem id no banco; é passar para o front |
| `session_id` | `SessionId`/`WebSession`: sessionização nativa, em vez de janela inventada na org | gerar um id por aba em `sessionStorage` |
| ~~`customer_id` no formato `WEB-PF-<id>`~~ | ~~`IndividualId` direto~~ | ✅ **feito** — ver 3.4 |
| `results_count` no `search_performed` | `ResultsReturnedQuantity`: busca sem resultado vira filtro | a tela já sabe quantos resultados voltaram |
| `discount` em uma unidade só | Some a armadilha 8.1 | trocar o que o `combo_clicked` manda |

**O custo de acrescentar coluna, agora que o stream existe.** Antes era de graça;
hoje envolve reenviar o schema ao connector para o DLO ganhar a coluna. Continua
não exigindo remapeamento — os mapeamentos existentes não são tocados, só entra um
mapeamento novo para a coluna nova. O que segue barato de verdade é fazer isso
**enquanto o coletor está em `dry-run`**: sem dado dentro, não há histórico com
buraco na coluna nova.

### 3.4 Identidade no mapeamento

O ponto que mais atrapalha, e que sem DMO próprio deixou de ser detalhe: **os
eventos não carregam a chave que os DMOs usam como `IndividualId`.** No mapeamento
de PF/PJ, o `Individual.Id` é `WEB-PF-<id>`/`WEB-PJ-<id>` (`CONTRATO-RICARDO.md`,
seção 3); os eventos carregam **e-mail**.

Isso era bloqueante: `IndividualId` vazio é engajamento que não se pendura em
perfil nenhum, e os dez DMOs viravam tabelas de clique soltas. Sem DMO próprio,
também não sobrava onde o e-mail ficaria guardado para reconstruir o vínculo
depois.

**Resolvido do lado do site (a saída 1 abaixo).** O evento passou a carregar
`customer_id` no mesmo formato do contrato de clientes:

- `signToken` inclui `tipo` no JWT (`server/src/customers/auth.js`) — o `sub` já
  vinha;
- o coletor remonta `WEB-PF-<id>`/`WEB-PJ-<id>` a partir do token **verificado**
  (`events-server/src/collect/identity.js`), nunca do corpo do evento, pelo mesmo
  motivo do e-mail: id de cliente aceito do cliente é convite para poluir o perfil
  alheio;
- a coluna entrou no contrato, na fila (migration `002_customer_id.sql`) e no
  `ecommerce_events.yaml`.

Token emitido antes da mudança não tem `tipo`; nesses casos o id sai **vazio**, e
não chutado — um `WEB-PF-` num cliente PJ apontaria para um `Individual` que não
existe, e o erro seria invisível. Como o token dura 7 dias, a lacuna se fecha
sozinha.

**E resolvido do lado da org.** O schema foi reenviado ao connector, o Data Stream
absorveu a coluna (`Add Source Fields`, item 6 de 3.2.2) e `customer_id__c` →
`ssot__IndividualId__c` está mapeado **nos dez DMOs**. Os 94 mapeamentos anteriores
não foram tocados: entraram dez novos, por deploy.

O que isso não resolve, e continua valendo: quem nunca se identificou não tem
`customer_id` nenhum. O anônimo segue amarrado só ao `device_id`, e só ganha dono
quando dispara um `identify`.

As outras duas saídas, que deixam de ser necessárias mas ficam registradas:

2. **Resolver e-mail → `customer_id` dentro da transform.** Como toda linha já
   passa por uma (3.1.1), um nó de Join contra a DLO de clientes pelo e-mail custa
   pouco a mais. Alcança só quem já é cliente conhecido.
3. **`ContactPointId`**, que existe em `ProductBrowseEngagement`,
   `ShoppingCartEngagement`, `WebSearchEngagement` e `WebsiteEngagement` — quatro
   dos dez. Se o `Id` do `ContactPointEmail` no stream de PF/PJ for o próprio
   e-mail, dá para mapear `email` → `ContactPointId` e chegar ao perfil por aí.
   Confira o que foi usado como `Id` lá antes de contar com isso.

Em qualquer das três vale a regra da seção 7: **filtre `email = ""` antes**. String
vazia virando chave é o erro mais caro possível neste dataset.

Sobre o anônimo: `device_id` vai em `WebCookieId`, que existe em
`ProductBrowseEngagement`, `ShoppingCartEngagement`, `WebSearchEngagement` e
`WebsiteEngagement`. **Não existe** nos outros seis. Nos DMOs filhos dá para
contornar — a mãe tem o cookie, e a filha aponta para a mãe. Em
`PromotionEngagement` não dá: ele é cabeçalho e mesmo assim não tem o campo, então
o clique anônimo no combo da home fica sem identificador nenhum. Como a home é
justamente onde o tráfego anônimo é maior, essa é a perda concreta de não ter DMO
próprio. O `customer_id` do item 1 não resolve (o anônimo não tem); só o
`session_id` de 3.3 ajudaria.

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
- Atenção a um detalhe que só aparece na hora de mapear: a chave que os DMOs de
  perfil usam como `Individual Id` **não é o e-mail**, é o `WEB-PF-<id>` do
  contrato de clientes. Como resolver isso está em 3.4.

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
(um pedido teria de ser enorme para chegar lá). **Ele não chega a DMO nenhum**
(3.2): `SalesOrderProduct` só se preencheria explodindo esse JSON em linhas, o que
o mapeamento não faz. Hoje ele serve para ter o pedido inteiro dentro do evento no
DLO, sem uma segunda consulta — e o valor de pedido harmonizado vem de
`ecommerce_orders`, casado por `order_number`.

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
