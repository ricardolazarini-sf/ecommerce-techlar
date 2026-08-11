// Estado da fila e dos últimos POSTs — responde "esse clique chegou na Data
// Cloud?" sem abrir a org.
import { query, closePool } from '../src/db/index.js';
import { queueStats } from '../src/collect/events.repository.js';

const stats = await queueStats();
console.log(
  `Fila: ${stats.pending} pendente(s) · ${stats.sent} enviado(s) · ${stats.rejected} recusado(s)`,
);
if (stats.oldest_pending) console.log(`Mais antigo pendente: ${new Date(stats.oldest_pending).toISOString()}`);
if (stats.last_sent) console.log(`Último envio: ${new Date(stats.last_sent).toISOString()}`);

const { rows: byType } = await query(
  `SELECT event_type, status, COUNT(*)::int AS n
     FROM engagement_events
    GROUP BY event_type, status
    ORDER BY event_type, status`,
);
if (byType.length) {
  console.log('\nPor tipo de evento:');
  for (const r of byType) console.log(`  ${r.event_type.padEnd(24)} ${r.status.padEnd(9)} ${r.n}`);
}

const { rows: batches } = await query(
  `SELECT id, object, mode, rows_count, bytes, ok, http_status, duration_ms, created_at,
          LEFT(COALESCE(response, ''), 160) AS response
     FROM ingestion_batches
    ORDER BY id DESC
    LIMIT 10`,
);
if (batches.length) {
  console.log('\nÚltimos lotes:');
  for (const b of batches) {
    const flag = b.ok ? 'ok ' : 'ERR';
    console.log(
      `  #${b.id} ${flag} ${b.mode.padEnd(8)} ${String(b.rows_count).padStart(4)} linha(s) ` +
        `${(b.bytes / 1024).toFixed(1)} KB HTTP ${b.http_status ?? '-'} ${b.duration_ms ?? '-'}ms ` +
        `${new Date(b.created_at).toISOString()}${b.response ? ` :: ${b.response}` : ''}`,
    );
  }
}

const { rows: errors } = await query(
  `SELECT event_id, event_type, attempts, LEFT(last_error, 200) AS last_error
     FROM engagement_events
    WHERE status = 'rejected'
    ORDER BY received_at DESC
    LIMIT 5`,
);
if (errors.length) {
  console.log('\nRecusados (últimos 5):');
  for (const e of errors) console.log(`  ${e.event_type} ${e.event_id} (${e.attempts}x) :: ${e.last_error}`);
}

await closePool();
process.exit(0);
