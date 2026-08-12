# Engajamento — os cliques do site na Data 360

Este documento explica o segundo caminho de ingestão da TechLar: o **coletor de
engajamento** (`events-server/`), que leva **cliques** para a Data 360. O
primeiro caminho, de PF/PJ e pedidos (`server/scripts/push-data360.mjs`, doc em
[INGESTAO-DATA360.md](../INGESTAO-DATA360.md)), continua exatamente como estava —
outro serviço, outro banco, outro connector.

```
navegador            coletor (:3002)              Data 360
──────────           ───────────────              ────────
clique
  └─ track() ──POST /collect──> valida
                               grava na fila (Postgres techlar_events)
                               responde 202
                                     │
                                 flusher (5s)
                                     └── JWT ──> token ──> POST /api/v1/ingest/... ──> DLO
```

## Por que um serviço separado

Clique e pedido têm exigências opostas. Pedido é raro, precisa de transação e não
pode ser perdido. Clique é volumoso, descartável na margem e chega em rajada —
uma pessoa rolando o catálogo gera mais eventos num minuto do que a loja gera
pedidos num dia. Misturar os dois significaria um pico de navegação disputando
conexão de banco com quem está pagando.

Por isso:

- **Serviço próprio** (`events-server`, porta 3002), que pode escalar e cair sem
  levar a loja junto.
- **Banco próprio** (`techlar_events`), com a fila `engagement_events`. O banco do
  site não ganhou nenhuma tabela de evento.
- **Connector próprio** na org, dedicado a engajamento. O `TechLar_Ecom` de
  PF/PJ/pedidos não é tocado por este serviço.

## Os 14 cliques capturados

A lista é curta de propósito: cada evento aqui responde a uma pergunta de
negócio. Clique que não responde nada não é capturado — volume sem pergunta só
encarece a ingestão e suja o perfil.

| Evento | Onde nasce | Pergunta que responde |
| --- | --- | --- |
| `combo_clicked` | faixa de combos da home | O anúncio de desconto puxa alguém? Qual dos três? |
| `combo_qualified` | contexto do carrinho, na virada | Quantos chegam a ter o combo formado no carrinho? |
| `cart_item_added` | cartão, PDP, barra fixa, wishlist, combo | Qual vitrine converte em carrinho? |
| `cart_item_removed` | carrinho | Que produto é abandonado, e a que preço? |
| `warranty_toggled` | carrinho | Quem CONSIDEROU a garantia (inclusive quem desmarcou) |
| `checkout_started` | revisão do checkout | Tamanho do funil entre carrinho e pagamento |
| `order_placed` | Pix aprovado | Fecha o funil, com combo e garantia no evento |
| `order_tracking_viewed` | página do pedido | Ansiedade de entrega e retorno ao site |
| `product_viewed` | PDP | Interesse por produto, com a vitrine de origem |
| `category_filtered` | chips do catálogo, home, rodapé | Que categoria a pessoa procura |
| `search_performed` | busca da navbar | O que se procura e não se encontra |
| `wishlist_toggled` | PDP e lista de desejos | Intenção guardada para depois |
| `customer_type_selected` | formulário PF/PJ | Qualifica B2B antes do cadastro terminar |
| `identify` | login e cadastro | Amarra o `device_id` anônimo a um e-mail |

Três decisões que valem explicação:

- **`warranty_toggled` também no "off"**. Sem ele, só aparece quem comprou a
  garantia; quem pensou e desistiu é justamente o público de remarketing.
- **`combo_qualified` só na virada**. O carrinho é reavaliado a cada leitura;
  emitir a cada leitura inflaria o funil. A lembrança fica na sessão, então
  recarregar a página não conta uma qualificação nova.
- **`surface` em quase todo evento**. É o campo que separa "o combo funciona" de
  "a home funciona": o mesmo `cart_item_added` vindo de `combo`, `pdp`,
  `barra-fixa` ou `wishlist` conta histórias diferentes.

## O contrato: 26 chaves, sempre todas

O registro enviado é **plano** e leva **todas** as 26 chaves do schema, sempre.
Campo que não se aplica ao evento vai como `""` (texto) ou `0` (número), nunca
ausente e nunca `null`.

Isso não é preciosismo: o Data Stream recusa com
`400 required key [x] not found` qualquer registro que omita uma propriedade
declarada — inclusive as que estão fora do `required`. Foi a lição do `phone`
opcional na ingestão de clientes. O achatador (`src/collect/contract.js`) e o
YAML (`ecommerce_events.yaml`) são checados um contra o outro em
`test/schema.test.js`, para a divergência falhar no teste e não em produção.

Os campos: `event_id`, `event_type`, `occurred_at`, `email`, `phone`, `document`,
`device_id`, `reason`, `product_id`, `sku`, `product_name`, `category`, `price`,
`action`, `order_number`, `status`, `item_count`, `subtotal`, `total`,
`items_json`, `search_term`, `surface`, `page_path`, `qty`, `combo_id`,
`discount`.

Sem array e sem objeto aninhado (a Ingestion API não aceita): a lista de itens do
pedido viaja em `items_json`, como texto.

## Identidade: device_id sempre, e-mail só com token

Todo clique carrega o `device_id` — o mesmo identificador do carrinho anônimo, em
`localStorage`. É o fio que costura a navegação de quem ainda não se
identificou.

O `email` só entra quando o POST traz um **token JWT válido**, assinado com o
mesmo `JWT_SECRET` do site. O coletor lê o token do header `Authorization` e, no
caso do `sendBeacon` (que não permite header), do campo `auth` do corpo. E-mail
mandado como propriedade do evento é **ignorado**: aceitá-lo deixaria qualquer um
poluir o perfil unificado de outra pessoa, e engajamento falso cola em perfil e
vaza para segmento.

Token inválido ou vencido não derruba o POST: o clique entra anônimo. Perder
identidade é aceitável; perder o clique, não.

Na org, quem junta as duas pontas é a Identity Resolution: o `identify` é o
evento que liga aquele `device_id` a um e-mail conhecido.

## O lado navegador (`client/src/lib/track.js`)

- Nada bloqueia o clique: o evento entra numa fila em memória e sai em lote a
  cada 2 segundos, ou quando chega a 25 eventos.
- No fechamento da aba (`pagehide`, `visibilitychange`) o lote sai por
  `navigator.sendBeacon`, que o navegador entrega mesmo depois de a página
  morrer. É onde está o clique mais interessante: o da desistência.
- Falha de rastreio é engolida. Coletor fora do ar não pode virar erro de loja.
- `VITE_TRACK=0` desliga tudo, para rodar o site sem o coletor.

## A fila (`engagement_events`)

A fila é uma tabela, não um broker. É store-and-forward: o `/collect` grava e
responde 202; o flusher lê e envia. Se a org estiver indisponível, os cliques
ficam na fila e saem depois — nada se perde e o navegador nunca espera.

| Coluna | Papel |
| --- | --- |
| `event_id` | Chave de deduplicação. `ON CONFLICT DO NOTHING` no insert, então reenvio do navegador (rede instável, beacon duplicado) não vira linha dobrada |
| `status` | `pending`, `sent` ou `rejected` |
| `attempts`, `next_attempt_at` | Retry com backoff; 5xx e 429 voltam para a fila, 4xx não |
| `last_error` | A mensagem da org, para achar o campo culpado sem adivinhar |
| `batch_id` | Liga a linha ao lote de `ingestion_batches` que a levou |

O flusher claima linhas com `FOR UPDATE SKIP LOCKED`, o que permite mais de uma
instância do serviço sem enviar a mesma linha duas vezes.

Os lotes fecham **por tamanho** (190 KB, com folga sobre o teto de 200 KB do
request), não por contagem de linhas.

## Rodando em dev

```bash
npm run install:all          # inclui o events-server
npm run migrate:events       # cria a fila no techlar_events
npm run dev:events           # coletor na 3002
npm run dev:server           # API do site na 3001
npm run dev:client           # site na 5173 (proxy /collect -> 3002)
```

Conferindo:

```bash
curl localhost:3002/health           # fila, modo do flusher e config da org
npm run queue:events                 # pendentes, enviados, recusados, últimos lotes
npm run flush:events                 # roda um ciclo do flusher na hora
```

### Testando pelo Swagger

**http://localhost:3002/docs** (a spec crua fica em `/openapi.json`). A página é
gerada a partir do contrato em `src/collect/contract.js`, então campo novo
aparece nela sozinho — documentação escrita à parte envelhece em uma semana.

O corpo do `POST /collect` vem com exemplos prontos no seletor: clique em combo,
produto visto, item no carrinho, garantia recusada, pedido pago, lote com vários
cliques e um lote com tipo desconhecido (para ver a recusa individual). Para ver
o e-mail sendo anexado, use **Authorize** com um token do site — o mesmo
`techlar_token` do `localStorage`.

Vale lembrar o que o `202` significa: o evento entrou **na fila**. Quem fala com
a Data 360 é o flusher, depois; confira em `npm run queue:events`.

`EVENTS_DOCS=false` desliga a página. Em produção, com tráfego real, é o que se
faz: o botão "Execute" grava evento de verdade, e evento de teste suja o perfil
unificado.

## Ligando a ingestão de verdade

Enquanto não existir o objeto de engajamento na org, o flusher fica em
`EVENTS_DRY_RUN=true`: ele grava, loga a amostra e marca como enviado, sem tocar
a org.

Na org (feito na interface da Data 360, uma vez):

1. **Setup → Ingestion API → New**: crie um connector novo (sugestão de nome:
   `TechLar_Engagement`) e carregue `docs/data360/ecommerce_events.yaml`.
   O arquivo declara dois objetos; crie o Data Stream **só** de
   `ecommerce_events`.
2. **Data Stream**: categoria **Engagement**, campo de data do evento
   `occurred_at`, chave primária `event_id`.
3. No `events-server/.env`, preencha `DATACLOUD_EVENTS_CONNECTOR` com o nome do
   connector.

Depois, daqui, na ordem:

```bash
cd events-server
npm run probe -- TechLar_Engagement ecommerce_events   # existe? schema bate?
EVENTS_VALIDATE_ONLY=true npm run flush                # valida em /actions/test
EVENTS_DRY_RUN=false npm run flush                     # ingere de verdade
npm run queue                                          # confere enviados
```

O `probe` usa o endpoint síncrono `/actions/test` e **não grava nada**: 404
significa nome errado, 400 traz a lista exata de campo faltante ou sobrando, 202
significa que está pronto.

Na org, a conferência final é o DLO: o registro aparece em
`ecommerce_events__dll` com o `event_id` que o `queue-status` mostrou.

## Deploy no Render

O coletor sobe **sozinho**, em serviço e blueprint próprios
(`events-server/render.yaml`): outro banco, outro ciclo de deploy. Derrubar a
loja para subir uma correção de rastreio seria juntar o que o projeto separou.

No painel: **New → Blueprint**, aponte para `events-server/render.yaml` e
**Apply**. Se preferir criar o serviço na mão, é um **Web Service** com:

| Campo | Valor |
| --- | --- |
| Root Directory | `events-server` |
| Build Command | `npm install` |
| Start Command | `npm run migrate && npm start` |
| Health Check Path | `/health` |

O `migrate` roda antes de a porta abrir, para o `/collect` nunca receber clique
sem ter onde guardar; é idempotente, então nos deploys seguintes não faz nada.

Variáveis que o Render pergunta no Apply — em dev elas vêm de `server/.env`, que
lá não existe:

| Variável | O que colocar |
| --- | --- |
| `EVENTS_DATABASE_URL` | a Internal Database URL do Postgres, **trocando o nome do database no fim** para `techlar_events` |
| `EVENTS_CORS_ORIGINS` | o domínio da loja; sem isso o navegador não consegue postar, porque o coletor vive em outra origem |
| `JWT_SECRET` | **o mesmo** do serviço da loja: com outro valor o token não confere e todo clique de gente logada entra anônimo |
| `SF_LOGIN_URL`, `SF_AUDIENCE`, `SF_CLIENT_ID`, `SF_USERNAME` | os mesmos do `server/.env` |
| `SF_JWT_KEY` | o **conteúdo** do `.pem`. A chave não vai para o repositório, então não há arquivo para apontar em `SF_JWT_KEY_PATH` |
| `DATACLOUD_EVENTS_CONNECTOR` | o connector de engajamento, quando existir |

Do lado da loja falta um passo, e ele é fácil de esquecer: o `client` precisa ser
buildado com `VITE_COLLECT_BASE` apontando para o domínio do coletor. Sem isso o
navegador continua chamando `/collect` na origem da própria loja, onde em
produção não tem ninguém ouvindo — e os cliques somem sem erro visível.

O blueprint sobe com `EVENTS_DRY_RUN=true` e `EVENTS_DOCS=false`: a fila enche e
nada vai para a org até o Data Stream existir, e a página do Swagger não fica
aberta mandando POST de verdade em produção.

## O que este serviço não faz

- **Não usa cookie de terceiro** e não tem SDK de fora: o `device_id` é próprio,
  em `localStorage`.
- **Não captura rolagem, movimento de mouse nem teclado**. Só clique
  intencional e abertura de página de produto/pedido.
- **Não manda dado sensível**: senha, CPF digitado e token nunca entram no
  evento. O achatador tem allowlist de campos, e o que não está nela é
  descartado.
