# TechLar — E-commerce (external system)

> **O futuro na sua casa.** Loja online da TechLar (varejista de tecnologia para
> casa: eletrônicos, notebooks, periféricos, garantia estendida, instalação).

This is a **standalone external system**. It has **its own PostgreSQL database**
and it is **not** a Salesforce application. Its second job — as important as the
storefront itself — is to act as a *real data silo* that **emits business events**
through a **pluggable event sink**. One of the available sinks posts those events
to the **Salesforce Data Cloud (Data 360) Ingestion API**, but that is just an
HTTP destination that is **off by default**.

> ⚠️ **No Salesforce org is ever touched by this codebase.** There is no org
> authentication, no metadata deploy, no SOQL. The only outbound integration is
> an optional HTTP `POST` performed by the `DataCloudIngestionSink`, which is
> disabled unless you explicitly set `EVENTS_SINK=datacloud`.

---

## Monorepo layout

```
techlar-ecommerce/
├── brand/            # Brand assets (gold logo, light theme)
├── server/           # Node.js + Express REST API (layered, modular)
├── events-server/    # Engagement collector (clicks -> Data 360), own DB
├── client/           # React + Vite SPA
├── Procfile          # Heroku process types (web + release migrations)
├── package.json      # Root orchestration scripts
└── .env.example      # Root env reference
```

- **`server/`** — layered, modular backend. Independent modules: `catalog/`,
  `cart/`, `checkout/`, `customers/`, `orders/`, `events/`, `db/`, `config/`.
  Business logic is isolated from HTTP (controllers/routes) and from data access
  (repositories).
- **`events-server/`** — separate service (port 3002) that collects click events
  into its own Postgres database (`techlar_events`) and ships them to the Data 360
  Ingestion API. Clicks are high-volume and disposable; orders are not, so they do
  not share a service, a database or a connector. See
  [`docs/data360/ENGAJAMENTO.md`](docs/data360/ENGAJAMENTO.md).
- **`client/`** — componentized React SPA (Vite), consumes the REST API.

See [`server/README.md`](server/README.md) and
[`server/src/events/README.md`](server/src/events/README.md) for the backend and
event-schema details.

---

## Prerequisites

- **Node.js ≥ 20** (developed on Node 26)
- **PostgreSQL** *(optional for domain/unit tests; required to run the full app)*

---

## Quick start (local)

```bash
# 1. Install every package
npm run install:all

# 2. Configure environment
cp .env.example server/.env   # then edit server/.env (at minimum DATABASE_URL, JWT_SECRET)

# 3. Create schema + seed demo data (requires a running Postgres + DATABASE_URL)
npm run migrate               # apply versioned SQL migrations
npm run seed                  # idempotent: recreates ~40 customers, ~16 products, sample orders
npm run load:combos           # discount-combo rules used by the home page and the cart

# 4a. Run the API (terminal 1)  -> http://localhost:3001  (health: /health)
npm run dev:server

# 4b. Run the SPA (terminal 2)  -> http://localhost:5173  (proxies /api to the server)
npm run dev:client
```

The click collector is optional in local development — the site works without it
(failed tracking is swallowed on purpose, and `VITE_TRACK=0` silences it). To run
it, see [`docs/data360/ENGAJAMENTO.md`](docs/data360/ENGAJAMENTO.md):

```bash
cp events-server/.env.example events-server/.env   # set EVENTS_DATABASE_URL
npm run migrate:events
npm run dev:events            # -> http://localhost:3002 (health: /health)
```

Its endpoints can be exercised from **http://localhost:3002/docs** (Swagger, with
ready-made example payloads for each click type; spec at `/openapi.json`).

Then open **http://localhost:5173**.

### Run without a database

The **domain and event-sink unit tests do not need Postgres**:

```bash
npm test            # runs server unit tests (cart totals, order-number, event sink)
```

The server also **starts without a database** and `GET /health` never touches the
DB (the pool connects lazily on the first query).

To browse the **whole storefront** with no server and no Postgres at all — useful
for reviewing UI work — run the client in demo mode:

```bash
npm run dev:mock    # SPA on :5173, no API calls
```

Every request is served in the browser by
[`client/src/api/mock.js`](client/src/api/mock.js): the same seven products as
[`server/src/db/products.js`](server/src/db/products.js), plus an in-memory cart,
account, wishlist, checkout and order history. It answers with the exact shapes
of the real endpoints, so what you see is what the API will render. Sign in with
the seeded demo login (`demo@techlar.com` / `techlar123`) or create an account
(PF or PJ) — data lives in `sessionStorage` and dies with the tab. The mock is
compiled out of production builds.

---

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run install:all` | Install server + client + events-server dependencies |
| `npm run migrate` | Apply DB migrations (needs `DATABASE_URL`) |
| `npm run migrate:events` | Apply the collector's migrations (needs `EVENTS_DATABASE_URL`) |
| `npm run seed` | Recreate demo data, idempotently (needs `DATABASE_URL`) |
| `npm run load:combos` | Load the discount-combo rules into the `combos` table |
| `npm test` | Run backend + collector unit tests (no DB needed) |
| `npm run dev:server` | Start API with reload on `:3001` |
| `npm run dev:events` | Start the engagement collector with reload on `:3002` |
| `npm run dev:client` | Start Vite dev server on `:5173` (proxies `/api` and `/collect`) |
| `npm run dev:mock` | Start the SPA with the in-browser mock API (no server, no DB) |
| `npm run queue:events` | Show the click queue: pending, sent, rejected, last batches |
| `npm run flush:events` | Run one flusher cycle (queue -> Data 360) |
| `npm run build` | Build the client to `client/dist` |
| `npm start` | Start the API in production mode (serves `client/dist`) |

---

## Configuration

All configuration is via environment variables. See
[`.env.example`](.env.example) / [`server/.env.example`](server/.env.example).

Key variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — | Postgres connection string (this app's own DB) |
| `PGSSL` | `false` | Set `true` for Heroku Postgres (SSL) |
| `JWT_SECRET` | `dev-secret...` | Signing secret for auth tokens |
| `WARRANTY_RATE` | `0.03` | Order-level extended-warranty fee, as a fraction of the warrantable base |
| `EVENTS_SINK` | `console` | `console` \| `file` \| `datacloud` |
| `EVENTS_PERSIST_LOCAL` | `true` | Also log events into the local `events` table |
| `DATACLOUD_INGESTION_URL` | — | Data Cloud Ingestion API base URL (sink only) |
| `DATACLOUD_CONNECTOR` | — | Ingestion connector/source name |
| `DATACLOUD_TOKEN` | — | Bearer token for the Ingestion API |

The engagement collector has its own variables — including a **separate**
`EVENTS_DATABASE_URL` and its own Data 360 connector — documented in
[`events-server/.env.example`](events-server/.env.example).

### Swapping the event sink (no domain code changes)

The domain only ever calls `events.emit(event)`. The destination is chosen at
startup by `EVENTS_SINK`:

```bash
EVENTS_SINK=console   npm run dev:server   # default: prints structured events
EVENTS_SINK=file      npm run dev:server   # appends JSON lines to EVENTS_FILE_PATH
EVENTS_SINK=datacloud npm run dev:server   # POSTs to the Data Cloud Ingestion API
```

---

## Deploy to Heroku

The repo deploys as a **single dyno** that serves the API **and** the built SPA.

```bash
# From the repo root
heroku create techlar-ecommerce
heroku addons:create heroku-postgresql:essential-0   # provisions DATABASE_URL
heroku config:set PGSSL=true JWT_SECRET="$(openssl rand -hex 32)" EVENTS_SINK=console
git push heroku main
```

- **Build**: Heroku runs `heroku-postbuild` (installs both packages + builds the client).
- **Release**: the `release:` process in the [`Procfile`](Procfile) runs `npm run migrate`.
- **Web**: the `web:` process runs `npm start`, which serves the API and `client/dist`.
- Seed once after first deploy (optional): `heroku run npm run seed`.

To enable the Data Cloud sink in production:

```bash
heroku config:set EVENTS_SINK=datacloud \
  DATACLOUD_INGESTION_URL="https://<instance>" \
  DATACLOUD_CONNECTOR="<connector>" \
  DATACLOUD_TOKEN="<token>"
```

---

## Acceptance flow

Browse → add to cart (anonymous, `device_id`) → register/login → checkout
(review → confirm) → order confirmation with a generated number. Every step
emits the corresponding event through the configured sink, and all customer /
cart / order data is persisted in this app's own Postgres.
