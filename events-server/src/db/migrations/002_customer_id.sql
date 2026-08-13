-- ==========================================================================
-- `customer_id`: a chave que a Data Cloud usa como Individual Id.
--
-- O e-mail identifica a pessoa para nós, mas não para o modelo da org: lá o
-- `Individual.Id` é `WEB-PF-<id>`/`WEB-PJ-<id>`, montado pelo contrato de
-- clientes. Sem essa coluna, todo engajamento chega à org sem conseguir se
-- pendurar num perfil — vira contagem de clique, não comportamento de gente.
--
-- Fica em coluna própria, ao lado do e-mail, e não dentro de `props`, pela
-- mesma razão: `props` é o que o navegador manda, e identidade não se aceita do
-- cliente. Quem preenche é o coletor, a partir do token verificado.
-- ==========================================================================

ALTER TABLE engagement_events
  ADD COLUMN IF NOT EXISTS customer_id TEXT NOT NULL DEFAULT '';

-- Responde "o que esse cliente andou fazendo no site?" sem varrer a tabela.
-- Parcial porque a maior parte do tráfego é anônima e não interessa ao índice.
CREATE INDEX IF NOT EXISTS engagement_events_customer_idx
  ON engagement_events (customer_id, occurred_at DESC)
  WHERE customer_id <> '';
