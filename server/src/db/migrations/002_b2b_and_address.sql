-- 002_b2b_and_address.sql — suporte a B2B (PJ/CNPJ) e endereço no cadastro.
-- Motivação: alinhamento ao Contrato de Dados da Sprint IV (Data 360). O site
-- passa a distinguir PF (CPF) e PJ (CNPJ) e a coletar endereço, para alimentar
-- as DMOs Individual/Account + ContactPoint(Email/Phone/Address) na ingestão.
-- Todas as colunas são aditivas e opcionais (default seguro), então a migração
-- não quebra registros existentes nem o seed de variância de identidade.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tipo          TEXT NOT NULL DEFAULT 'PF'
    CHECK (tipo IN ('PF', 'PJ')),
  ADD COLUMN IF NOT EXISTS razao_social  TEXT,           -- account_name (PJ)
  ADD COLUMN IF NOT EXISTS cnpj          TEXT,           -- 14 dígitos (PJ)
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,           -- logradouro + número
  ADD COLUMN IF NOT EXISTS city          TEXT,
  ADD COLUMN IF NOT EXISTS state         TEXT,           -- UF
  ADD COLUMN IF NOT EXISTS postal_code   TEXT,           -- CEP (só dígitos)
  ADD COLUMN IF NOT EXISTS country        TEXT DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_customers_tipo ON customers (tipo);
CREATE INDEX IF NOT EXISTS idx_customers_cnpj ON customers (cnpj);
