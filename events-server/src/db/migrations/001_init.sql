-- ==========================================================================
-- Banco de engajamento — ele NÃO é espelho, ele É a fila.
--
-- O POST /collect grava e responde 202 na hora; quem conversa com a Data Cloud
-- é o flusher, depois. Assim um deploy, um restart ou uma queda da Data Cloud
-- não perdem clique nenhum — que é justamente o que um buffer em memória
-- perderia.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS ingestion_batches (
  id          BIGSERIAL   PRIMARY KEY,
  object      TEXT        NOT NULL,
  -- ingest | validate | dry-run: o mesmo trio de modos do CLI de ingestão.
  mode        TEXT        NOT NULL,
  rows_count  INTEGER     NOT NULL CHECK (rows_count >= 0),
  bytes       INTEGER     NOT NULL CHECK (bytes >= 0),
  ok          BOOLEAN     NOT NULL DEFAULT false,
  http_status INTEGER,
  response    TEXT,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS engagement_events (
  -- Chave do contrato e da deduplicação: o sendBeacon reenvia quando a aba
  -- volta, e o mesmo clique não pode virar duas linhas na Data Cloud.
  event_id        UUID        PRIMARY KEY,
  event_type      TEXT        NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id       TEXT        NOT NULL DEFAULT '',
  -- Só é preenchido quando o POST veio com token válido do site: identidade
  -- não se aceita de campo solto vindo do navegador.
  email           TEXT        NOT NULL DEFAULT '',
  -- O resto do contrato (produto, superfície, combo, totais) fica aqui e é
  -- achatado na hora do envio, não na hora de receber.
  props           JSONB       NOT NULL DEFAULT '{}'::jsonb,

  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'sent', 'rejected')),
  attempts        SMALLINT    NOT NULL DEFAULT 0,
  -- Backoff por linha, e não sleep global: um lote problemático espera sua vez
  -- sem travar o clique que acabou de chegar.
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error      TEXT,
  sent_at         TIMESTAMPTZ,
  -- Qual POST levou esta linha — é o que responde "esse clique chegou na Data
  -- Cloud?" sem precisar consultar a org.
  batch_id        BIGINT      REFERENCES ingestion_batches (id) ON DELETE SET NULL
);

-- Índice parcial: o flusher enxerga só o que está pendente e maduro, em vez de
-- varrer a tabela inteira (que cresce para sempre).
CREATE INDEX IF NOT EXISTS engagement_events_queue_idx
  ON engagement_events (next_attempt_at, occurred_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS engagement_events_type_idx
  ON engagement_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS engagement_events_device_idx
  ON engagement_events (device_id, occurred_at DESC);
