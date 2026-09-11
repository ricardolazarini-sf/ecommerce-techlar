-- 005_add_estoque.sql — o catálogo passa a registrar o estoque no próprio banco.
--
-- Motivação: o saldo de estoque vivia só na memória do ERP mock (Heroku), fora
-- do banco. O site não tinha como mostrar disponibilidade e o número sumia a
-- cada restart do mock. A fonte da verdade CONTINUA sendo o ERP (a baixa é feita
-- lá, na transação da compra); esta coluna é um ESPELHO persistido — a resposta
-- autoritativa da baixa e o sync via /admin/erp/status a mantêm alinhada. Quando
-- o ERP está desligado (ERP_ENABLED=false), a coluna funciona como número de
-- vitrine (seed) e o checkout segue como antes.
--
-- Aditiva com default seguro: linhas existentes recebem 0 e são populadas abaixo.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0);

-- Backfill do estoque das linhas já existentes no Neon com o MESMO seed do mock
-- (server.js CATALOGO.estoqueInicial), para banco e ERP nascerem alinhados. Não
-- toca em orders/carts (não destrutivo).
UPDATE products SET estoque = 5  WHERE sku = 'GSGH2J23213';        -- iPhone 17
UPDATE products SET estoque = 3  WHERE sku = 'GSGH2J232111';       -- iPhone 17 Pro Max
UPDATE products SET estoque = 4  WHERE sku = 'MacBookM4Air';       -- MacBook Air M4
UPDATE products SET estoque = 2  WHERE sku = 'GSGH2J232xxsssssss'; -- MacBook Air M5
UPDATE products SET estoque = 6  WHERE sku = 'IMP-3D-PREMIUM';     -- Impressora 3D Premium
UPDATE products SET estoque = 4  WHERE sku = 'IMP-3D-PLUS';        -- Impressora 3D Plus Premium
UPDATE products SET estoque = 50 WHERE sku = 'CABO-USB';           -- Cabo USB
