// Roda UM ciclo do flusher e sai — é como se valida a ingestão sem subir o
// serviço, e como se reprocessa a fila depois de corrigir o contrato.
//
//   npm run flush                        (envia de verdade)
//   EVENTS_VALIDATE_ONLY=true npm run flush   (só /actions/test)
//   EVENTS_DRY_RUN=true npm run flush         (nem autentica)
import { createFlusher } from '../src/ingest/flusher.js';
import { closePool } from '../src/db/index.js';

const flusher = createFlusher();
console.log(`Modo: ${flusher.mode}`);

const totals = await flusher.runOnce();
console.log(
  `Ciclo: ${totals.claimed} reservado(s) · ${totals.sent} enviado(s) · ` +
    `${totals.rejected} recusado(s) · ${totals.retried} para tentar de novo`,
);
if (totals.error) {
  console.error('Falhou:', totals.error);
  await closePool().catch(() => {});
  process.exit(1);
}
await closePool();
process.exit(0);
