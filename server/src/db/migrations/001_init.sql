-- 001_init.sql — initial TechLar schema (this app's OWN database).
-- All tables follow the data model in the specification (section 6). The only
-- additive column is customers.password_hash (nullable) so that customers who
-- register through the site can authenticate; seeded identity-variance records
-- leave it NULL.

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL,
  telefone      TEXT,
  documento     TEXT,
  device_id     TEXT,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Intentionally NOT unique: identity variance (section 7) stores the same real
-- person multiple times with small divergences, to be resolved later in Data 360.
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers (lower(email));
CREATE INDEX IF NOT EXISTS idx_customers_device_id ON customers (device_id);

CREATE TABLE IF NOT EXISTS products (
  id         SERIAL PRIMARY KEY,
  sku        TEXT NOT NULL UNIQUE,
  nome       TEXT NOT NULL,
  categoria  TEXT NOT NULL,
  preco      NUMERIC(12, 2) NOT NULL CHECK (preco >= 0),
  descricao  TEXT,
  imagem_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_categoria ON products (categoria);

CREATE TABLE IF NOT EXISTS carts (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers (id) ON DELETE SET NULL,
  device_id   TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'converted', 'abandoned')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_carts_customer ON carts (customer_id);
CREATE INDEX IF NOT EXISTS idx_carts_device ON carts (device_id);
-- At most one OPEN cart per anonymous device / per customer.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_cart_per_device
  ON carts (device_id) WHERE status = 'open' AND customer_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_cart_per_customer
  ON carts (customer_id) WHERE status = 'open' AND customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS cart_items (
  id         SERIAL PRIMARY KEY,
  cart_id    INTEGER NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products (id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  UNIQUE (cart_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items (cart_id);

CREATE TABLE IF NOT EXISTS orders (
  id           SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id  INTEGER REFERENCES customers (id),
  subtotal     NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  total        NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  status       TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('pending', 'confirmed', 'cancelled', 'fulfilled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products (id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  warranty   BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- Local append-only log of every emitted business event (section 6). This is
-- independent of the event SINK: it mirrors what was emitted for auditing.
CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers (id) ON DELETE SET NULL,
  device_id   TEXT,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_device ON events (device_id);

-- Optional wishlist (section 5).
CREATE TABLE IF NOT EXISTS wishlist_items (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
