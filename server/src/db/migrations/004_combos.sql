-- 004_combos.sql — combos de desconto.
--
-- O combo é uma regra sobre CATEGORIAS (o catálogo tem 7 produtos; combo de SKU
-- fixo aí viraria vitrine de duas gôndolas), então a tabela guarda a regra, não
-- os produtos. `categorias` casa com products.categoria.
--
-- Nada é gravado no carrinho: a regra é avaliada a cada leitura, para o desconto
-- nunca ficar velho no carrinho de alguém. O que o pedido guarda é a atribuição
-- (orders.combo_slug e orders.discount_total, na migration 003).

CREATE TABLE IF NOT EXISTS combos (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  regra       TEXT NOT NULL,
  descricao   TEXT,
  percent     NUMERIC(5, 2) NOT NULL CHECK (percent > 0 AND percent < 100),
  categorias  TEXT[] NOT NULL CHECK (array_length(categorias, 1) >= 2),
  imagem_url  TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_combos_ativo ON combos (ativo);
