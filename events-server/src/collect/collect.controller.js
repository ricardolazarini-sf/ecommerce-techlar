import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { validateBatch } from './validate.js';
import { identityFromRequest } from './identity.js';
import * as repo from './events.repository.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const limiter = createRateLimiter({
  windowMs: config.collect.rateWindowMs,
  maxRequests: config.collect.rateMaxRequests,
  maxEvents: config.collect.rateMaxEvents,
});

// POST /collect — recebe o lote, grava na fila e responde 202. Quem conversa com
// a Data Cloud é o flusher; o navegador não espera por isso.
export async function collect(req, res) {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  const deviceId = String(req.body?.device_id || '').slice(0, 120);
  const gate = limiter.check([`ip:${req.ip}`, deviceId && `dev:${deviceId}`], events.length || 1);
  if (!gate.ok) {
    res.set('Retry-After', String(gate.retryAfterSec));
    return res.status(429).json({ error: 'Muitos eventos em pouco tempo.', reason: gate.reason });
  }

  const { email, customerId } = identityFromRequest(req);
  const { rows, rejected = [], error } = validateBatch(req.body, {
    email,
    customerId,
    maxEvents: config.collect.maxEventsPerRequest,
  });
  if (error) {
    return res.status(400).json({ error, rejected });
  }

  try {
    const { inserted } = await repo.insertEvents(rows);
    logger.debug('collect.accepted', {
      received: rows.length,
      inserted,
      duplicates: rows.length - inserted,
      rejected: rejected.length,
    });
    // 202: aceito e na fila. Não é 201 porque não existe recurso para buscar, e
    // não é 200 porque a ingestão de verdade ainda não aconteceu.
    return res.status(202).json({
      accepted: inserted,
      duplicates: rows.length - inserted,
      rejected: rejected.length,
    });
  } catch (err) {
    logger.error('collect.failed', { err: err.message, count: rows.length });
    return res.status(503).json({ error: 'A fila de eventos não está disponível.' });
  }
}

export default { collect };
