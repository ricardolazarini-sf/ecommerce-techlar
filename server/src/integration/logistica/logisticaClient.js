// Cliente HTTP do mock de logística (transportadora + ETA).
//
// O mock de logística expõe GET /tracking/:code, devolvendo o status logístico,
// a transportadora (carrier) e a previsão de entrega (eta) de um código de
// rastreio. No nosso espelho o código de rastreio É o order_number (o Apex grava
// Tracking_Code__c = orderNumber). Este módulo consulta esse endpoint de forma
// BEST-EFFORT durante o espelho do pedido, para enriquecer o Order no CRM com
// carrier/eta.
//
// INERTE quando config.logistica.baseUrl está vazia: getTracking vira no-op
// (devolve null) e nenhuma requisição de rede é feita. NUNCA lança — uma falha
// de rede/timeout/HTTP apenas devolve null, e o espelho segue sem esses campos.
//
// Contrato read-only: só faz GET; não altera o mock. Espelha o desenho do
// erpClient.js (fetch global + AbortController p/ timeout).

import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

async function logisticaFetch(path) {
  const { baseUrl, timeoutMs } = config.logistica;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(`${baseUrl}${path}`, { method: 'GET', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Consulta a transportadora e a ETA de um código de rastreio (= order_number).
// Retorna { carrier, eta } ou null (desligado / sem código / erro / sem dados).
// NUNCA lança: best-effort — o chamador ignora o null e segue sem os campos.
export async function getTracking(code) {
  if (!config.logistica.baseUrl) return null;
  if (!code) return null;
  try {
    const res = await logisticaFetch(`/tracking/${encodeURIComponent(code)}`);
    if (!res.ok) {
      logger.warn('logistica.tracking_http', { code, http: res.status });
      return null;
    }
    const data = await res.json().catch(() => ({}));
    const carrier = data && typeof data.carrier === 'string' ? data.carrier : null;
    const eta = data && typeof data.eta === 'string' ? data.eta : null;
    if (!carrier && !eta) return null;
    return { carrier, eta };
  } catch (err) {
    logger.warn('logistica.tracking_failed', { code, err: err.message });
    return null;
  }
}

export default { getTracking };
