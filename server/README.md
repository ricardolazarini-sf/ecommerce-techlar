# TechLar server (API)

Node.js + Express REST API with a **layered, modular** architecture. Business
logic is isolated from HTTP (controllers/routes) and from data access
(repositories). The event-emission layer is a **pluggable sink** — see
[`src/events/README.md`](src/events/README.md).

## Module layout

```
src/
├── config/        # env-driven configuration (no side effects on import)
├── db/            # pg pool (lazy), migration runner, migrations/, seed
├── events/        # pluggable event sink (Console/File/DataCloud) + facade
├── catalog/       # products: repository / service / controller / routes
├── cart/          # cart + pure pricing logic (cart.logic.js)
├── checkout/      # order creation + pure order-number logic (checkout.logic.js)
├── customers/     # auth (JWT), password hashing (scrypt), profile
├── orders/        # order history / detail
├── wishlist/      # optional wishlist
├── middleware/    # auth, error handling, request logging
├── http/          # request-context helpers (device id, customer_ref)
├── utils/         # structured logger
├── app.js         # Express app factory (also serves client/dist in prod)
└── index.js       # process entrypoint (listen + graceful shutdown)
```

Each domain module keeps the same seams:

- **repository** — SQL only, no business rules.
- **service** — business logic; emits events via `events.*`; never talks HTTP.
- **controller** — request/response mapping; delegates to the service.
- **routes** — Express wiring.
- **`*.logic.js`** — pure, dependency-free functions (the unit-tested core).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Start the API (`node src/index.js`) |
| `npm run dev` | Start with `--watch` reload |
| `npm run migrate` | Apply SQL migrations (needs `DATABASE_URL`) |
| `npm run seed` | Recreate demo data idempotently (needs `DATABASE_URL`) |
| `npm test` | Run unit tests with the built-in Node test runner (no DB) |

## HTTP API

Base path `/api`. `x-device-id` header carries the anonymous device id; a
`Bearer` token authenticates a customer.

| Method & path | Auth | Description |
| --- | --- | --- |
| `GET /health` | — | Liveness (never touches the DB) |
| `GET /api/catalog/products?q=&categoria=` | — | List/search products |
| `GET /api/catalog/products/featured` | — | Highlighted products |
| `GET /api/catalog/products/:id` | — | Product detail (emits `product_viewed`) |
| `GET /api/catalog/categories` | — | Categories with counts |
| `GET /api/cart` | optional | Current cart (creates one if needed) |
| `POST /api/cart/items` | optional | Add item (emits `cart_updated`) |
| `PATCH /api/cart/items/:productId` | optional | Change qty (emits `cart_updated`) |
| `DELETE /api/cart/items/:productId` | optional | Remove item (emits `cart_updated`) |
| `POST /api/auth/register` | — | Register (emits `identify`) → `{ token, customer }` |
| `POST /api/auth/login` | — | Login (emits `identify`) → `{ token, customer }` |
| `GET /api/customers/me` | required | Profile + order history |
| `PATCH /api/customers/me` | required | Update profile |
| `POST /api/checkout/start` | optional | Review + totals (emits `checkout_started`) |
| `POST /api/checkout/confirm` | optional | Create order (emits `order_placed`) |
| `GET /api/orders` | required | Order history |
| `GET /api/orders/:orderNumber` | required | Order detail |
| `GET/POST/DELETE /api/wishlist` | required | Optional wishlist |

Configuration is documented in [`.env.example`](.env.example).
