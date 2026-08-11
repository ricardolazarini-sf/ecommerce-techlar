// Rate limit em memória, por janela fixa, contando duas coisas: requisições e
// eventos. Só requisição não protege — um POST com 50 cliques repetidos custa
// 50 linhas na Data Cloud, que é cobrada por linha ingerida.
//
// Limitação honesta: o contador vive no processo. Com mais de uma instância o
// teto efetivo se multiplica pelo número de instâncias; quando isso importar, o
// contador precisa sair para o Postgres da fila ou para um Redis. Para um
// coletor de um site só, memória é o custo certo.

export function createRateLimiter({ windowMs = 60_000, maxRequests = 60, maxEvents = 600 } = {}) {
  const buckets = new Map();

  function hit(key, events, now) {
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { resetAt: now + windowMs, requests: 0, events: 0 };
      buckets.set(key, bucket);
    }
    bucket.requests += 1;
    bucket.events += events;
    return bucket;
  }

  // Varre os expirados de vez em quando, para a memória não crescer com IP que
  // passou uma vez e nunca voltou.
  function sweep(now) {
    if (buckets.size < 5_000) return;
    for (const [key, bucket] of buckets) {
      if (now >= bucket.resetAt) buckets.delete(key);
    }
  }

  return {
    // Devolve { ok, retryAfterSec, reason } — quem decide o status é o chamador.
    check(keys = [], events = 1, now = Date.now()) {
      sweep(now);
      for (const key of keys.filter(Boolean)) {
        const bucket = hit(key, events, now);
        if (bucket.requests > maxRequests || bucket.events > maxEvents) {
          return {
            ok: false,
            retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
            reason: bucket.requests > maxRequests ? 'requests' : 'events',
          };
        }
      }
      return { ok: true };
    },
    size() {
      return buckets.size;
    },
  };
}

export default { createRateLimiter };
