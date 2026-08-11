import { query, withTransaction } from '../db/index.js';

// Acesso à fila. Tudo o que fala SQL do engajamento está aqui.

// INSERT de várias linhas num único statement — o /collect responde 202 na hora,
// e o caminho quente do coletor é uma ida ao banco, não N.
//
// ON CONFLICT DO NOTHING resolve o reenvio do sendBeacon (a aba volta e manda o
// mesmo lote de novo): clique repetido não vira linha nova nem erro.
export async function insertEvents(rows = []) {
  if (!rows.length) return { inserted: 0 };

  const values = [];
  const params = [];
  rows.forEach((row, i) => {
    const base = i * 6;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
    params.push(
      row.event_id,
      row.event_type,
      row.occurred_at,
      row.device_id || '',
      row.email || '',
      JSON.stringify(row.props || {}),
    );
  });

  const { rowCount } = await query(
    `INSERT INTO engagement_events (event_id, event_type, occurred_at, device_id, email, props)
     VALUES ${values.join(', ')}
     ON CONFLICT (event_id) DO NOTHING`,
    params,
  );
  return { inserted: rowCount };
}

// Reserva um lote para este flusher. FOR UPDATE SKIP LOCKED deixa duas
// instâncias rodando juntas sem enviar a mesma linha duas vezes — a que chegou
// depois simplesmente pula o que já está travado.
//
// A reserva acontece dentro da transação e devolve as linhas já com
// `attempts + 1` e o próximo horário empurrado, de forma que uma queda do
// processo no meio do envio não prenda a linha: ela volta a maturar sozinha.
export function claimPending({ limit = 500, retryBaseMs = 2000 } = {}) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT event_id, event_type, occurred_at, device_id, email, props, attempts
         FROM engagement_events
        WHERE status = 'pending'
          AND next_attempt_at <= now()
        ORDER BY occurred_at
        LIMIT $1
          FOR UPDATE SKIP LOCKED`,
      [limit],
    );
    if (!rows.length) return [];
    const ids = rows.map((r) => r.event_id);
    await client.query(
      `UPDATE engagement_events
          SET attempts = attempts + 1,
              next_attempt_at = now() + ($2::int * power(2, LEAST(attempts, 6))) * interval '1 millisecond'
        WHERE event_id = ANY($1::uuid[])`,
      [ids, retryBaseMs],
    );
    return rows;
  });
}

export async function markSent(ids = [], batchId = null) {
  if (!ids.length) return;
  await query(
    `UPDATE engagement_events
        SET status = 'sent', sent_at = now(), last_error = NULL, batch_id = $2
      WHERE event_id = ANY($1::uuid[])`,
    [ids, batchId],
  );
}

// Falha definitiva: 4xx (payload fora do contrato) ou tentativas esgotadas.
// A linha fica com o motivo salvo e pode voltar para `pending` na mão depois de
// corrigir o contrato — nada é apagado.
export async function markRejected(ids = [], error = '', batchId = null) {
  if (!ids.length) return;
  await query(
    `UPDATE engagement_events
        SET status = 'rejected', last_error = $2, batch_id = $3
      WHERE event_id = ANY($1::uuid[])`,
    [ids, String(error).slice(0, 2000), batchId],
  );
}

// Falha temporária: continua pendente, com o erro registrado. O backoff já foi
// aplicado no claim.
export async function markRetry(ids = [], error = '') {
  if (!ids.length) return;
  await query(
    `UPDATE engagement_events
        SET last_error = $2
      WHERE event_id = ANY($1::uuid[])`,
    [ids, String(error).slice(0, 2000)],
  );
}

export async function exhaustAttempts(maxAttempts) {
  const { rows } = await query(
    `UPDATE engagement_events
        SET status = 'rejected'
      WHERE status = 'pending' AND attempts >= $1
      RETURNING event_id`,
    [maxAttempts],
  );
  return rows.map((r) => r.event_id);
}

export async function openBatch({ object, mode, rowsCount, bytes }) {
  const { rows } = await query(
    `INSERT INTO ingestion_batches (object, mode, rows_count, bytes)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [object, mode, rowsCount, bytes],
  );
  return rows[0].id;
}

export async function closeBatch(id, { ok, httpStatus = null, response = '', durationMs = 0 }) {
  await query(
    `UPDATE ingestion_batches
        SET ok = $2, http_status = $3, response = $4, duration_ms = $5
      WHERE id = $1`,
    [id, Boolean(ok), httpStatus, String(response || '').slice(0, 2000), Math.round(durationMs)],
  );
}

// Estado da fila para o /health: não basta o processo estar vivo, o que importa
// é se o clique está saindo. Uma fila pendente crescendo é o sintoma real.
export async function queueStats() {
  const { rows } = await query(
    `SELECT status,
            COUNT(*)::int                                        AS count,
            MIN(occurred_at)                                     AS oldest,
            MAX(sent_at)                                         AS last_sent
       FROM engagement_events
      GROUP BY status`,
  );
  const stats = { pending: 0, sent: 0, rejected: 0, oldest_pending: null, last_sent: null };
  for (const row of rows) {
    stats[row.status] = row.count;
    if (row.status === 'pending') stats.oldest_pending = row.oldest;
    if (row.status === 'sent') stats.last_sent = row.last_sent;
  }
  return stats;
}

export default {
  insertEvents,
  claimPending,
  markSent,
  markRejected,
  markRetry,
  exhaustAttempts,
  openBatch,
  closeBatch,
  queueStats,
};
