# Runbook — criar o Data Stream de engajamento com o DMO mapeado

Passo a passo de execução, na ordem, para ligar os cliques do site à Data 360.
Companheiro do [`MAPEAMENTO-ENGAJAMENTO.md`](MAPEAMENTO-ENGAJAMENTO.md): lá está
**o que** cada campo significa e por quê; aqui está **o que clicar**.

**A Parte 1 é o caminho mínimo que funciona hoje** e entrega dado consultável na
org (~30 a 40 minutos). A Parte 2 liga clique a pessoa. A Parte 3 projeta nos DMOs
padrão de commerce. Cada parte é útil sozinha, nesta ordem.

Um aviso de rótulo antes de começar: a org está na v67 e o menu pode aparecer como
**Data Cloud** ou como **Data 360**, dependendo da tela. Onde o nome do botão
mudou entre releases, aponto as duas formas.

## 0. Estado conferido da org

Consultado em 12/08/2026 na org `trailsignup.2230eb84a63b58@salesforce.com`
(alias `demo-org`), via `MktDataLakeObject` e `MktDataModelObject`:

| O que | Estado |
| --- | --- |
| Connector Ingestion API `TechLar_Ecom` | Existe, com três streams vivos |
| DLO de clientes PF | `TechLar_Ecom_ecommerce_customer_42B910D7` |
| DLO de clientes PJ | `TechLar_Ecom_ecommerce_customer_A0DE7B8E` |
| DLO de pedidos | `TechLar_Ecom_ecommerce_orders_37D49C99` |
| DLO de eventos | **Não existe** — nada aqui remapeia ou apaga trabalho de ninguém |
| DMOs padrão de commerce | Existem todos (lista em `MAPEAMENTO-ENGAJAMENTO.md`, §3.1) |
| Coletor em produção | Recebe e guarda; `EVENTS_DRY_RUN=true` e `DATACLOUD_EVENTS_CONNECTOR` vazio |

Ou seja: o clique já está sendo capturado e enfileirado no banco do coletor. O que
falta é o destino existir e o envio ser destravado.

---

# Parte 1 — o Data Stream e o DMO próprio

## Passo 1. Criar um connector de Ingestion API só para eventos

Setup → **Data Cloud Setup** → **Ingestion API** → **New**.

| Campo | Valor |
| --- | --- |
| Name / Label | `TechLar Ecom Events` |
| API Name | `TechLar_Ecom_Events` |

O API Name precisa ser exatamente esse, ou ser copiado com exatidão para o passo
5: é ele que entra na URL do POST
(`/api/v1/ingest/sources/<connector>/ecommerce_events`).

**Por que um connector novo, e não o `TechLar_Ecom` que já existe.** Subir schema
novo num connector que já tem três streams configurados mexe no schema daquele
connector — risco desnecessário sobre o que já está mapeado e funcionando.
Engajamento também tem outro ritmo (streaming contínuo, volume alto) e outro
serviço produzindo, com credencial e ciclo de vida próprios. O código já assume
isso: a variável se chama `DATACLOUD_EVENTS_CONNECTOR`, separada da do site.

Não é preciso criar External Client App nem chave nova: o fluxo JWT é da org, não
do connector, e o app `TechLar_Ecom_Ingest_oauth` (com o escopo `api`) já serve.

## Passo 2. Subir o schema

Na tela do connector recém-criado, **Upload Schema** e escolha
[`docs/data360/ecommerce_events.yaml`](ecommerce_events.yaml).

Duas coisas para não estranhar:

- O arquivo declara **dois** objetos: `ecommerce_events` e
  `ecommerce_order_items`. Só o primeiro tem produtor (o coletor). O segundo é
  herança do outro caminho de ingestão e hoje não tem ninguém enviando — ignore
  na hora de escolher objetos no passo 3.
- O arquivo já respeita as manhas do validador da Ingestion API (sem `info`, sem
  `paths`, sem array, sem `integer`, `description` só em comentário). Se aparecer
  "File contains invalid schema", o arquivo foi editado — compare com o do repo.

## Passo 3. Criar o Data Stream

Data Cloud → aba **Data Streams** → **New** → **Ingestion API** → connector
`TechLar Ecom Events` → marque o objeto **`ecommerce_events`** → Next.

Na tela de configuração do objeto:

| Ajuste | Valor |
| --- | --- |
| Category | **Engagement** |
| Primary Key | `event_id` |
| Event Time Field | `occurred_at` |
| Data Space | o mesmo dos outros três streams (confira no registro de um deles) |

E os tipos dos 26 campos. São 19 de texto, 1 de data/hora e 6 numéricos:

| Campo | Tipo | Observação |
| --- | --- | --- |
| `event_id` | Text | Primary Key |
| `event_type` | Text | Discriminador dos 14 tipos |
| `occurred_at` | Date Time | Event Time Field |
| `email` | Text | Ver nota abaixo |
| `device_id` | Text | |
| `phone` | Text | |
| `document` | Text | |
| `reason` | Text | |
| `product_id` | Text | Id numérico do catálogo, mas viaja como texto |
| `sku` | Text | |
| `product_name` | Text | |
| `category` | Text | |
| `action` | Text | Multiuso — vocabulário por evento no MAPEAMENTO §6 |
| `order_number` | Text | |
| `status` | Text | |
| `items_json` | Text | Até 4.000 caracteres |
| `search_term` | Text | |
| `surface` | Text | |
| `page_path` | Text | |
| `combo_id` | Text | |
| `price` | Number | |
| `item_count` | Number | |
| `subtotal` | Number | |
| `total` | Number | |
| `qty` | Number | |
| `discount` | Number | Duas unidades conforme o evento — MAPEAMENTO §8.1 |

**Sobre o `email` como Text.** Os streams de PF/PJ usam o tipo Email e este usa
Text, e isso não é problema: o tipo do campo no Data Stream não muda o casamento
de identidade, que acontece no mapeamento e nas regras de match. O que importa é o
valor estar normalizado, e ele está (minúsculas e sem espaço, feito no coletor).

**Deploy.**

O DLO nasce com nome gerado, seguindo o padrão dos que já existem: label
`TechLar Ecom Events-ecommerce_events` e um `DeveloperName` truncado com hash
(como `TechLar_Ecom_ecommerce_orders_37D49C99`). Anote o `DeveloperName`: é ele,
com o sufixo `__dll`, que se consulta no Data Explorer.

## Passo 4. Criar o DMO próprio, já mapeado

No registro do Data Stream, **Start Data Mapping** (em algumas versões, "Review
and Map Fields").

No canvas, crie um DMO novo a partir deste DLO:

| Campo | Valor |
| --- | --- |
| Label | `Ecommerce Event` |
| API Name | `Ecommerce_Event__dlm` |
| Category | **Engagement** |
| Primary Key | `event_id` |
| Event Time Field | `occurred_at` |

Se a sua versão não oferecer "criar DMO" dentro do canvas, crie antes em **Data
Model** → **New** → *Start from Scratch* e volte ao mapeamento.

**O mapeamento é 1:1**: aceite os 26 campos propostos com os mesmos nomes do DLO
(a plataforma cria os campos do DMO com sufixo `__c`). Não há campo derivado nem
conversão nesta parte — é de propósito. Este DMO é a fonte fiel do DLO; quem
interpreta, filtra e converte é a Parte 3 e as transformações.

Antes de salvar, confira que **nenhum dos 26 ficou sem par**. Campo esquecido aqui
não dá erro: dá coluna vazia meses depois.

Salve e faça o deploy do mapeamento.

## Passo 5. Destravar o envio no coletor

No Render, serviço **techlar-events** → Environment. Os nomes são exatos:

| Variável | Valor |
| --- | --- |
| `DATACLOUD_EVENTS_CONNECTOR` | `TechLar_Ecom_Events` |
| `DATACLOUD_EVENTS_OBJECT` | `ecommerce_events` (já é o padrão do código) |
| `SF_LOGIN_URL` | mesmo valor do serviço da loja |
| `SF_AUDIENCE` | idem |
| `SF_CLIENT_ID` | idem |
| `SF_USERNAME` | idem |
| `SF_JWT_KEY` | a chave privada inteira, com as linhas `BEGIN`/`END` |
| `EVENTS_DRY_RUN` | `false` — **este é o último a mudar** |

A ordem importa: credenciais e connector primeiro, `EVENTS_DRY_RUN=false` só
depois de validar. Enquanto o `dry-run` está ligado, nada sai — e nada se perde,
porque o clique continua guardado na fila.

Para validar antes de abrir a torneira, com o repo em mãos:

```bash
cd events-server
npm run probe TechLar_Ecom_Events ecommerce_events   # espera 202 no /actions/test
EVENTS_VALIDATE_ONLY=true npm run flush              # valida o lote sem gravar na org
```

`EVENTS_VALIDATE_ONLY` manda o lote para `/actions/test`: a org valida o formato e
descarta. É o teste que prova o schema sem sujar o DLO.

Depois, com `EVENTS_DRY_RUN=false` no ar:

```bash
npm run queue    # pending, sent, rejected, último lote e último erro
```

## Passo 6. Conferir na org

1. **Data Stream** → contagem de registros maior que zero.
2. **Data Explorer** → o DLO `<DeveloperName>__dll` → confira uma linha inteira:
   as 27 colunas presentes, `occurred_at` com fuso, `""` e `0` onde o evento não
   se aplica (é esperado, ver MAPEAMENTO §2).
3. **Data Model** → `Ecommerce Event` → contagem de registros acompanhando o DLO.
4. Fila do coletor: `npm run queue` com `rejected = 0`.

Se houver rejeitado, o erro da org vem gravado em `last_error` na fila, por linha.

---

# Parte 2 — ligar o clique à pessoa

Ao fim da Parte 1 o evento está amarrado ao **dispositivo** (`device_id`), não à
pessoa. O motivo está no MAPEAMENTO §3.4 e vale repetir: no contrato de clientes,
o `Individual.Id` é `WEB-PF-<id>`/`WEB-PJ-<id>`; os eventos carregam **e-mail**.
São chaves diferentes, e relacionar por e-mail não casa com nada.

**Opção A (recomendada) — acrescentar `customer_id` ao evento.** Precisa de uma
mudança pequena no site, ainda não feita: o token já traz `sub` (id do cliente) e
falta só o `tipo` para escolher o prefixo (`signToken`, em
`server/src/customers/auth.js`). Depois disso: coluna nova no
`ecommerce_events.yaml`, campo novo no Data Stream e no DMO, e um relacionamento
`Ecommerce_Event__dlm.customer_id__c` → `Individual.Id` (N:1) em Data Model →
Relationships. Fica direto, sem intermediário.

**Opção B — resolver na org.** Uma Data Transform que junte o DLO de eventos com
os DLOs de clientes (`TechLar_Ecom_ecommerce_customer_42B910D7` para PF,
`..._A0DE7B8E` para PJ) por e-mail, produzindo `customer_id` num DLO de saída, que
então recebe o relacionamento com `Individual`. Funciona sem mexer no site, mas só
alcança quem já é cliente cadastrado, e é um passo a mais para manter.

Em qualquer das duas: **não mapeie `email = ""`** em nada de identidade. Vazio ali
significa visitante anônimo, e um "" tratado como valor junta pessoas diferentes
no mesmo perfil.

---

# Parte 3 — projetar nos DMOs padrão de commerce (opcional)

## Por que não basta mapear o mesmo DLO em vários DMOs

Se o DLO de eventos for mapeado direto para `ProductBrowseEngagement` **e**
`ShoppingCartEngagement`, **toda linha vai para os dois**: um `product_viewed`
viraria um registro de carrinho com campos vazios, e a contagem de "itens
adicionados" ficaria inflada por navegação. O mapeamento não tem filtro.

O filtro por `event_type` mora em **Data Transform**. O padrão é: uma transform
por família de evento, filtrando `event_type`, gravando num DLO de saída, e aí sim
esse DLO de saída mapeado para o DMO padrão.

| Transform | Filtro `event_type` | DLO de saída | DMO destino |
| --- | --- | --- | --- |
| `evt_product_view` | `product_viewed` | `evt_product_view__dll` | `ProductBrowseEngagement` |
| `evt_cart` | `cart_item_added`, `cart_item_removed` | `evt_cart__dll` | `ShoppingCartEngagement` |
| `evt_checkout` | `checkout_started` | `evt_checkout__dll` | `ShoppingCartEngagement` |
| `evt_order` | `order_placed` | `evt_order__dll` | `ShoppingCartEngagement` |
| `evt_search` | `search_performed` | `evt_search__dll` | `WebSearchEngagement` |
| `evt_wishlist` | `wishlist_toggled` | `evt_wishlist__dll` | `ShoppingWishlistItemEngagement` |
| `evt_promo` | `combo_clicked` | `evt_promo__dll` | `PromotionEngagement` |
| `evt_promo_qualified` | `combo_qualified` | `evt_promo_qual__dll` | `ShoppingCartEngagement` |

O mapeamento campo a campo de cada uma está no MAPEAMENTO §3.2, com os nomes de
API já conferidos na org. Duas armadilhas de lá que aparecem justamente aqui: a
data do evento se chama `EngagementDateTm` em quatro DMOs e `EngagementDateTime`
em três; e `ShoppingCartEventTypeId` é relacionamento, não texto — precisa de
registros na tabela `ShoppingCartEventType` (ela só tem `Id` e `Name`), que se
criam com um CSV de quatro linhas (`add`, `remove`, `checkout`, `purchase`)
ingerido como stream categoria **Other** e mapeado nesse DMO.

**Sugestão de ordem**, se for fazer aos poucos: comece por `evt_product_view`,
`evt_search` e `evt_order` — os três de encaixe mais limpo e maior valor imediato
(afinidade de produto, intenção de busca, e o laço com o pedido faturado via
`SalesOrderId ← order_number`). Deixe os de carrinho para depois de existir
`cart_id` (MAPEAMENTO §3.3): sem ele, `ShoppingCartEngagement` fica sem a coluna
que dá sentido a agrupar linha de carrinho.

---

# Checklist de execução

- [ ] Connector `TechLar_Ecom_Events` criado
- [ ] Schema `ecommerce_events.yaml` subido (só `ecommerce_events` usado)
- [ ] Data Stream: Engagement, PK `event_id`, event time `occurred_at`, 26 campos tipados
- [ ] Deploy do stream, `DeveloperName` do DLO anotado
- [ ] DMO `Ecommerce_Event__dlm` criado, categoria Engagement, 26 campos mapeados
- [ ] Render/techlar-events: `SF_*` e `DATACLOUD_EVENTS_CONNECTOR` preenchidos
- [ ] `npm run probe` devolvendo 202
- [ ] `EVENTS_VALIDATE_ONLY=true npm run flush` sem rejeição
- [ ] `EVENTS_DRY_RUN=false`
- [ ] DLO e DMO com registro, `npm run queue` com `rejected = 0`
- [ ] (Parte 2) `customer_id` ou transform de e-mail, e relacionamento com `Individual`
- [ ] (Parte 3) transforms por família e mapeamento nos DMOs padrão

# Se der errado

Erros que já aconteceram neste projeto, com a causa real:

| Sintoma | Causa e saída |
| --- | --- |
| `invalid subject token` no login JWT | Falta o escopo `api` na External Client App. Foi exatamente o que travou a ingestão de clientes |
| `400 required key [x] not found` | O schema subido tem propriedade que o achatador não emite. O coletor manda sempre as 27; compare o schema do connector com o YAML do repo |
| `404` no `npm run probe` | Nome do connector ou do objeto diferente do que está na org. Confira `DATACLOUD_EVENTS_CONNECTOR` sem espaço e com o mesmo maiúsculo/minúsculo |
| Fila cresce e `sent` fica em zero | `EVENTS_DRY_RUN` ainda `true`, ou `SF_*` faltando. `GET /health` lista o que falta pelo nome da variável |
| Evento chegando com `email` vazio para quem está logado | `JWT_SECRET` diferente entre a loja e o coletor. Já aconteceu em produção; os dois serviços precisam do mesmo valor |
| DLO com registro e DMO vazio | Mapeamento não deployado, ou campo sem par no canvas |
