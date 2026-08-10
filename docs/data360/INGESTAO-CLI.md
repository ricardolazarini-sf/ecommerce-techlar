# Ingestão Data 360 — Streaming (site → Data Cloud) + CLI `push:data360`

Guia **guiado, do zero ao fim**, para levar os dados do e-commerce (Postgres)
até a **Data 360** pela **Ingestion API em modo Streaming**. Inclui a ferramenta
que automatiza autenticação e envio, e o passo a passo de configuração na org,
com links para a documentação oficial.

> **Sim, a ingestão do site é Streaming** (JSON via `POST /api/v1/ingest/...`).
> O CSV/Bulk é usado só para simular o app mobile. As duas fontes se encontram na
> **Identity Resolution** para formar o Golden Record.

## Documentação de referência (Salesforce)

- [Get Started with Ingestion API (limites, auth, visão geral)](https://developer.salesforce.com/docs/data/data-cloud-ref/guide/c360a-api-get-started.htm)
- [Streaming Ingestion Walkthrough (passo a passo oficial)](https://developer.salesforce.com/docs/data/data-cloud-int/references/data-cloud-ingestionapi-ref/c360-a-api-streaming-insert-example.html)
- [Ingestion API Reference](https://developer.salesforce.com/docs/data/data-cloud-int/references/data-cloud-ingestionapi-ref/c360-a-api-get-started.html)

## Limites reais da Streaming Ingestion API (o que importa aqui)

| Item | Valor | Impacto no CLI |
| --- | --- | --- |
| Tamanho por request | **200 KB** por request (o envelope `{ "data": [...] }` inteiro) | lotamos por **tamanho**, não por nº de registros (margem 190 KB) |
| Throughput | **250 requests/seg** somando todos os endpoints | 429 → retry/backoff |
| Latência | **~3 min**, assíncrona | dados aparecem no Data Explorer depois de alguns minutos |
| Sucesso do POST | **HTTP 202 Accepted** | 202 = aceito p/ processamento (não é confirmação de gravação) |
| Delete | máx. **200 registros** por request | (não usamos delete no CLI) |
| Validação síncrona | endpoint `.../actions/test` | valida o payload **antes** de ingerir |

> ⚠️ Aquele "lotes de 200" que apareceu antes estava errado — 200 é o limite de
> **delete**, não de insert. Insert é limitado por **tamanho (200 KB)**.

---

## Visão geral do fluxo

```
Postgres (site)
   │  contractMappers.js  (E.164, ISO 8601, prefixos WEB-PF-/WEB-PJ-)
   ▼
CLI push:data360
   1) JWT (RS256)  ──► 2) /services/oauth2/token  (access token da org)
                        └► 3) /services/a360/token (token do Data Cloud, host c360a)
   4) (opcional) POST .../actions/test   ← validação síncrona
   5) POST /api/v1/ingest/sources/{connector}/{object}  ← lotes < 200 KB, 202
   ▼
DLOs  ──► (mapear) DMOs  ──► Identity Resolution ──► Golden Record
```

O CLI reaproveita os mesmos mapeadores puros do export CSV, então **streaming e
bulk geram exatamente o mesmo payload** — um só contrato para manter e testar.

---

## Dados que o CLI precisa

Junte estes valores. Para preencher com segurança, use a planilha
**`docs/data360/dados-cli.local.md`** (está no `.gitignore`, não vai pro git).
Depois copie tudo para `server/.env`.

| Variável | O que é | Onde obter |
| --- | --- | --- |
| `SF_LOGIN_URL` | My Domain / endpoint de login da org | Setup → **My Domain** (sandbox: `https://test.salesforce.com`) |
| `SF_CLIENT_ID` | Consumer Key do app (`iss` do JWT) | App Manager → seu app → **Manage Consumer Details** |
| `SF_USERNAME` | usuário de integração (`sub` do JWT) | o usuário pré-autorizado no app |
| `SF_JWT_KEY_PATH` **ou** `SF_JWT_KEY` | chave privada RS256 (arquivo ou PEM) | gerada no Passo 1 (`techlar_ingest.key`) |
| `DATACLOUD_CONNECTOR` | API Name do source da Ingestion API | Data Cloud → Ingestion API (ex.: `TechLar_Ecom`) |
| `DATABASE_URL` | conexão do Postgres do site | Render/Heroku → Database → *External URL* |
| `PGSSL` | SSL do Postgres | `true` no Render/Heroku |
| `SF_AUDIENCE` *(opcional)* | `aud` do JWT | padrão = `SF_LOGIN_URL` |
| `MAX_PAYLOAD_BYTES` *(opcional)* | teto do lote em bytes | padrão `190000` (< 200 KB) |

> **Segurança:** `.key`, `.crt`, `.pem`, `.env` e `*.local.md` estão todos no
> `.gitignore`. A chave privada nunca sai da sua máquina/host de execução.

## Passo 1 — Gerar o par de chaves (JWT RS256)

```bash
openssl genrsa -out techlar_ingest.key 2048          # chave PRIVADA (fica com você)
openssl req -new -x509 -key techlar_ingest.key \
  -out techlar_ingest.crt -days 365 \
  -subj "/CN=techlar-ingest"                          # certificado PÚBLICO (sobe no app)
```

- `.key` → o CLI usa para **assinar** o JWT. **Nunca** commitar (já no `.gitignore`).
- `.crt` → upload no app (opção *Use digital signatures*).

## Passo 2 — External Client App (OAuth JWT)

Setup → **App Manager** → **New External Client App** (ou Connected App clássica):

1. **Enable OAuth** ✔
2. **Callback URL**: `https://login.salesforce.com/services/oauth2/callback`
   (obrigatório, mas o JWT não o usa).
3. **Use digital signatures** ✔ → upload de `techlar_ingest.crt`.
4. **OAuth Scopes**:
   - `Manage Data Cloud Ingestion API data (cdp_ingest_api)`
   - `Access the Salesforce API Platform (api)`
   - `Perform requests at any time (refresh_token, offline_access)`
5. Salve → **copie o Consumer Key** → é o `SF_CLIENT_ID` (e o `iss` do JWT).
6. **Policies** → *Permitted Users* = **Admin approved users are pre-authorized**.
7. **Autorize o usuário de integração** (o `sub` do JWT): crie um Permission Set,
   adicione o app em *Assigned Connected Apps* / *External Client Apps* e atribua
   o Permission Set ao seu usuário. Sem isso: `user hasn't approved this consumer`.

## Passo 3 — Source + schema na Ingestion API

Data Cloud → **Ingestion API** → **New** → nome do source (ex.: `TechLar_Ecom`)
→ upload de `docs/data360/ecommerce_contract.yaml`.

- O nome do source é o `DATACLOUD_CONNECTOR`.
- O schema precisa ser o **mínimo** (sem `info`/`paths`; `type: number`, não
  `integer`) — já corrigido no arquivo do repo.

## Passo 4 — Data Streams (um por objeto)

Para cada objeto do source, crie um Data Stream:

| Objeto                    | Categoria | Primary key       | Event/Record time | Refresh    |
| ------------------------- | --------- | ----------------- | ----------------- | ---------- |
| `ecommerce_customers_pf`  | Profile   | `customer_id`     | `updated_at`      | **Upsert** |
| `ecommerce_customers_pj`  | Profile   | `customer_id`     | `updated_at`      | **Upsert** |
| `ecommerce_orders`        | Other     | `sales_order_id`  | `order_date`      | **Upsert** |

**Upsert** (update+insert por primary key) torna o envio **idempotente**:
reenviar o mesmo `customer_id` atualiza em vez de duplicar. Pode rodar o CLI
quantas vezes quiser.

## Passo 5 — Configurar o CLI (`server/.env`)

```bash
SF_LOGIN_URL=https://SEU-DOMINIO.my.salesforce.com   # sandbox: https://test.salesforce.com
SF_CLIENT_ID=<Consumer Key da app>
SF_USERNAME=voce@empresa.com                          # sub do JWT (pré-autorizado)
SF_JWT_KEY_PATH=./techlar_ingest.key                  # ou SF_JWT_KEY com o PEM inline
DATACLOUD_CONNECTOR=TechLar_Ecom
DATABASE_URL=postgres://...                            # Postgres do site
PGSSL=true                                             # true no Render/Heroku
# opcionais:
# SF_AUDIENCE=https://login.salesforce.com
# MAX_PAYLOAD_BYTES=190000
```

## Passo 6 — Validar antes de enviar (recomendado)

```bash
# 1) sanidade local: lê o banco, mostra amostra e nº de lotes (não autentica):
DRY_RUN=true npm run push:data360

# 2) validação síncrona na org (/actions/test): confirma o payload SEM ingerir:
VALIDATE_ONLY=true npm run push:data360
```

O endpoint `/actions/test` é o passo de *Synchronous Record Validation* da doc:
se algum registro estiver fora do schema, ele retorna quais e por quê, **sem**
gravar nada no data lake.

## Passo 7 — Enviar (streaming)

```bash
npm run push:data360
```

Saída esperada:

```
Lidos do banco: 8 PF · 3 PJ · 12 pedidos
Autenticando (JWT -> org -> Data Cloud)...
OK. ENVIANDO para https://xxxx.c360a.salesforce.com (connector TechLar_Ecom)
• ecommerce_customers_pf: lote 1/1 (2.1 KB) — 8/8 enviados
• ecommerce_customers_pj: lote 1/1 (0.9 KB) — 3/3 enviados
• ecommerce_orders: lote 1/1 (1.4 KB) — 12/12 enviados

Enviado: PF 8 · PJ 3 · Pedidos 12 ✅
202 Accepted = ingestão assíncrona; confira no Data Explorer em ~3 min.
```

## Passo 8 — Verificar e unificar

1. **Data Explorer** → confira os 3 DLOs populados (aguarde ~3 min).
2. **Data Model** → mapeie os DLOs para os DMOs padrão:
   - `ecommerce_customers_pf` → **Individual** (+ Contact Point Email/Phone)
   - `ecommerce_customers_pj` → **Account**
   - `ecommerce_orders` → **Sales Order**
3. **Identity Resolution** → ruleset casando por **CPF/CNPJ** e por **email**.
4. Valide: um cliente que existe no site **e** no app vira **um** Unified Individual.
5. (Se aplicável) **Calculated Insights** (CLV, RFM) sobre o perfil unificado.

---

## É o caminho certo? (boa prática — revisão)

| Decisão | Por quê | Fonte |
| --- | --- | --- |
| **Streaming** para o site | dados near-real-time e volume pequeno por request | doc: streaming = "small payloads up to 200 KB" |
| **JWT Bearer Flow** | integração server-to-server sem senha/secret; prova é a assinatura RS256 | padrão OAuth Salesforce |
| **Troca dupla de token** (`oauth2/token` → `a360/token`) | o host de ingestão (`c360a`) ≠ `instance_url` normal | doc de Authentication da Ingestion API |
| **Lotar por tamanho (<200 KB)** | é o limite real por request (não nº de registros) | doc: Streaming Ingest API Limits |
| **`/actions/test` antes de ingerir** | valida o payload sincronicamente; evita registros descartados | doc: Streaming Walkthrough |
| **Retry/backoff só em 5xx/429** | 429 = "reduza a frequência"; 4xx = contrato errado (falha rápido) | doc: 429 Too Many Requests |
| **Upsert por primary key** | idempotência + alinhamento com Identity Resolution | config de Data Stream |
| **Segredos via env/arquivos gitignored** | `.key`/`.crt`/`.pem`/`.env` fora do git | boa prática de segurança |

**Quando usar cada modo:**
- **CLI (Streaming, carga)** → carga inicial e reprocessos do histórico do site.
- **`DataCloudIngestionSink` (Streaming, evento a evento)** → tempo real quando o
  site emite eventos de compra em produção (precisa de token válido em runtime).
- **Bulk (CSV até 150 MB)** → grandes volumes / simulação do app mobile.

**Limitação:** o CLI faz uma carga do snapshot atual do banco; não é streaming
contínuo. Para tempo real é o sink do site que atua.

---

## Troubleshooting

| Erro | Causa provável | Correção |
| --- | --- | --- |
| `user hasn't approved this consumer` | usuário não pré-autorizado no app | Permission Set com o app atribuído ao `sub` |
| `invalid subject token` na 2ª troca (`/services/a360/token`) | usuário **não provisionado no Data Cloud** (a 1ª troca funciona e o token é opaco) | atribuir **Permission Set + Permission Set License "Data Cloud Admin"** ao usuário; conferir que a caixa "Issue JWT-based access tokens" está **desmarcada** |
| `invalid_grant` / `invalid_assertion` | `aud`/`iss`/`sub` ou `.crt`↔`.key` divergentes | conferir My Domain no `aud`, Consumer Key no `iss`, mesmo par de chaves |
| Falha na troca `a360/token` | scope `cdp_ingest_api` ausente ou sem acesso ao Data Cloud | adicionar scope + permission set de Data Cloud |
| `HTTP 400` no POST | payload fora do schema (tipo/campo) | rode `VALIDATE_ONLY=true`; conferir `ecommerce_contract.yaml` |
| `HTTP 413` / payload grande | request acima de 200 KB | reduzir `MAX_PAYLOAD_BYTES` (o CLI já lota por tamanho) |
| `HTTP 429` | acima de 250 req/s | o CLI já faz backoff; reduza paralelismo se necessário |
| Dados não aparecem | ingestão é assíncrona (~3 min) | aguardar; checar status/erros do Data Stream |
| `File contains invalid schema` (upload) | YAML com `info`/`paths`/`integer` | usar o schema mínimo já corrigido (`type: number`) |
