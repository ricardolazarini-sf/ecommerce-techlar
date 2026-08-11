import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import * as repo from '../collect/events.repository.js';
import { flattenEvent } from '../collect/contract.js';
import { createTokenProvider } from './auth.js';
import { chunkBySize, postBatch, bytesOf } from './dataCloud.js';

// O flusher: tira da fila, achata no contrato e manda para a Data Cloud.
//
// Três modos, os mesmos do CLI de ingestão que já está em uso:
//   dry-run       — não autentica nem envia; loga a amostra e marca como sent,
//                   para dar para exercitar o front sem tocar a org.
//   validate-only — usa /actions/test (validação síncrona, não ingere).
//   ingest        — POST de verdade; 202 é o sucesso.
export function createFlusher({ tokenProvider, fetchImpl, repository = repo } = {}) {
  const tokens = tokenProvider || createTokenProvider({ fetchImpl });
  const mode = config.flush.dryRun ? 'dry-run' : config.flush.validateOnly ? 'validate' : 'ingest';
  let timer = null;
  let running = false;

  async function sendBatch(flat) {
    const ids = flat.map((r) => r.event_id);
    const batchId = await repository.openBatch({
      object: config.dataCloud.object,
      mode,
      rowsCount: flat.length,
      bytes: bytesOf({ data: flat }),
    });

    if (mode === 'dry-run') {
      logger.info('flush.dry_run', { rows: flat.length, sample: flat[0] });
      await repository.closeBatch(batchId, { ok: true, httpStatus: 0, response: 'dry-run', durationMs: 0 });
      await repository.markSent(ids, batchId);
      return { sent: flat.length, rejected: 0, retried: 0 };
    }

    const { token, host } = await tokens.get();
    const result = await postBatch({
      host,
      token,
      connector: config.dataCloud.connector,
      object: config.dataCloud.object,
      rows: flat,
      validate: mode === 'validate',
      fetchImpl,
    });
    await repository.closeBatch(batchId, {
      ok: result.ok,
      httpStatus: result.status,
      response: result.ok ? '' : result.body,
      durationMs: result.durationMs,
    });

    if (result.ok) {
      await repository.markSent(ids, batchId);
      logger.info('flush.sent', { rows: flat.length, mode, status: result.status, ms: result.durationMs });
      return { sent: flat.length, rejected: 0, retried: 0 };
    }

    if (!result.retryable) {
      // 400 aqui é quase sempre chave faltando no registro — o motivo fica
      // salvo em last_error, que é como se descobre o campo culpado sem abrir
      // a org.
      await repository.markRejected(ids, `HTTP ${result.status}: ${result.body}`, batchId);
      logger.error('flush.rejected', { rows: flat.length, status: result.status, body: result.body.slice(0, 400) });
      return { sent: 0, rejected: flat.length, retried: 0 };
    }

    // 5xx/429: a Data Cloud está indisponível ou pedindo calma. A linha fica
    // pendente e o backoff (aplicado no claim) segura a próxima tentativa.
    await repository.markRetry(ids, `HTTP ${result.status}: ${result.body}`);
    logger.warn('flush.retry', { rows: flat.length, status: result.status });
    return { sent: 0, rejected: 0, retried: flat.length };
  }

  async function runOnce() {
    if (running) return { skipped: true };
    running = true;
    const totals = { claimed: 0, sent: 0, rejected: 0, retried: 0 };
    try {
      const expired = await repository.exhaustAttempts(config.flush.maxAttempts);
      if (expired.length) {
        logger.warn('flush.attempts_exhausted', { count: expired.length, max: config.flush.maxAttempts });
      }

      const claimed = await repository.claimPending({
        limit: config.flush.maxRows,
        retryBaseMs: config.flush.retryBaseMs,
      });
      totals.claimed = claimed.length;
      if (!claimed.length) return totals;

      const { batches, oversized } = chunkBySize(claimed.map(flattenEvent), config.flush.maxPayloadBytes);
      if (oversized.length) {
        await repository.markRejected(
          oversized.map((r) => r.event_id),
          `Registro maior que ${config.flush.maxPayloadBytes} bytes`,
        );
        totals.rejected += oversized.length;
      }

      for (const batch of batches) {
        const result = await sendBatch(batch);
        totals.sent += result.sent;
        totals.rejected += result.rejected;
        totals.retried += result.retried;
      }
      return totals;
    } catch (err) {
      // Falha de autenticação ou de rede: nada é marcado como enviado, e o
      // próximo ciclo tenta de novo. Clique não se perde por isso.
      logger.error('flush.cycle_failed', { err: err.message });
      totals.error = err.message;
      return totals;
    } finally {
      running = false;
    }
  }

  return {
    mode,
    runOnce,
    start() {
      if (timer) return;
      // unref: o ciclo do flusher não deve segurar o processo aberto no
      // desligamento.
      timer = setInterval(() => {
        runOnce().catch((err) => logger.error('flush.tick_failed', { err: err.message }));
      }, config.flush.intervalMs);
      timer.unref?.();
      logger.info('flush.started', { mode, interval_ms: config.flush.intervalMs });
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export default { createFlusher };
