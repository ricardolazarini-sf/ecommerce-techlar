# Event layer (→ Data 360)

This is the **most important integration** in the app. The storefront emits
**server-side business events** through a **pluggable sink**. The rest of the
codebase only ever calls `events.emit(event)` (or a typed helper such as
`events.orderPlaced(...)`) and has **no knowledge of the destination**.

```
domain/services ──▶ events.emit(event) ──▶ EventBus ──▶ [ sink ]
                                              │            ├─ ConsoleSink  (default)
                                              │            ├─ FileSink
                                              │            └─ DataCloudIngestionSink → Data 360 Ingestion API
                                              └─▶ local `events` table (best-effort audit log)
```

- **Swap destinations with one env var**, no domain changes:
  `EVENTS_SINK=console | file | datacloud`.
- Both the local persistence and the sink call are **best-effort**: a failure is
  logged and swallowed, so a broken ingestion endpoint or database **never**
  breaks a purchase.
- The `DataCloudIngestionSink` retries with exponential backoff and is **off by
  default**. It performs a plain HTTPS `POST` — **no Salesforce org auth, no
  SOQL, no metadata deploy**.

## Envelope

Every event shares this canonical shape:

```jsonc
{
  "event_type": "order_placed",
  "event_id": "0f8c...-uuid",           // unique per event (idempotency key)
  "occurred_at": "2026-08-07T12:34:56.000Z",
  "customer_ref": {                      // identifiers for Identity Resolution
    "email": "ana.souza@example.com",
    "phone": "+55 (11) 98765-4321",
    "document": "390.533.447-05",
    "device_id": "web-3-a"               // anonymous browsing key
  },
  "payload": { /* event-specific */ }
}
```

`customer_ref` intentionally carries whatever identifiers are known at emit time
(often only `device_id` for anonymous traffic). This — combined with the
identity variance in the seed — is what lets **Data 360 resolve identities**
across events.

## Event catalog (minimum set — section 8)

| `event_type` | Emitted when | Key `payload` fields |
| --- | --- | --- |
| `identify` | Registration and login | `reason` (`register` \| `login`) |
| `product_viewed` | A product detail page is fetched | `product_id`, `sku`, `nome`, `categoria`, `preco` |
| `cart_updated` | Item added / removed / qty changed | `action`, `items[]`, `subtotal`, `item_count` |
| `checkout_started` | Checkout review begins | `items[]`, `subtotal`, `total`, `item_count` |
| `order_placed` | Order is created | `order_number`, `items[]`, `subtotal`, `total`, `status` |

`items[]` entries look like `{ product_id, qty, unit_price }` (plus `warranty`
for `order_placed`).

## Abandonment is derived downstream — not here

Per the spec, the site does **not** compute "abandoned cart". It only emits the
raw signals. Because `cart_updated` and `checkout_started` are emitted with a
stable `customer_ref`/`device_id` and timestamps, and `order_placed` is emitted
on conversion, **Data 360 can derive abandonment** (a cart/checkout signal not
followed by an `order_placed` within a window).

## Adding a new sink

1. Create `sinks/MySink.js` exporting a class with `name` and
   `async send(event)`.
2. Add a `case` in [`sinks/index.js`](sinks/index.js).
3. Select it with `EVENTS_SINK=mysink`.

No domain or service code changes.
