-- 003_order_warranty_and_combo.sql — a garantia estendida passa a ser do PEDIDO,
-- e o pedido passa a registrar o combo que gerou a venda.
--
-- Motivação: a garantia era uma escolha por item (`order_items.warranty`), com a
-- taxa incidindo sobre cada item marcado. Agora é uma decisão única da compra,
-- 3% sobre o que pode ser garantido, então o valor e a escolha pertencem ao
-- cabeçalho. `combo_slug` e `discount_total` entram junto porque a mesma conta
-- decide os dois: item em promoção não recebe garantia.
--
-- `order_items.warranty` NÃO é removida: ela é o que explica de onde veio o
-- valor dos pedidos antigos. Deixa de ser escrita, continua legível.
-- Todas as colunas são aditivas com default seguro.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS warranty       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_total NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (warranty_total >= 0),
  ADD COLUMN IF NOT EXISTS combo_slug     TEXT,
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (discount_total >= 0);

-- Backfill dos pedidos que já existiam: sem isso, o histórico do perfil e as
-- confirmações antigas mostrariam garantia zero num pedido que a cobrou. O
-- valor vem da diferença que já estava no pedido (o total sempre incluiu a
-- garantia, o subtotal nunca).
UPDATE orders o
   SET warranty = true,
       warranty_total = GREATEST(o.total - o.subtotal, 0)
 WHERE o.warranty = false
   AND EXISTS (
     SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.warranty
   );

CREATE INDEX IF NOT EXISTS idx_orders_combo_slug ON orders (combo_slug)
  WHERE combo_slug IS NOT NULL;
