import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRateLimiter } from '../src/middleware/rateLimit.js';

const NOW = Date.parse('2026-08-11T12:00:00.000Z');

test('o teto de requisições segura quem insiste', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3, maxEvents: 100 });
  for (let i = 0; i < 3; i += 1) {
    assert.equal(limiter.check(['ip:1.2.3.4'], 1, NOW).ok, true, `chamada ${i + 1} deveria passar`);
  }
  const blocked = limiter.check(['ip:1.2.3.4'], 1, NOW);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'requests');
  assert.ok(blocked.retryAfterSec > 0, 'a resposta 429 precisa dizer quando voltar');
});

// Só contar requisição não protege: um POST com 50 cliques repetidos custa 50
// linhas ingeridas, e a Data Cloud cobra por linha.
test('o teto de eventos segura o lote gordo que passaria pelo teto de requisições', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 100, maxEvents: 60 });
  assert.equal(limiter.check(['ip:1.2.3.4'], 50, NOW).ok, true);
  const blocked = limiter.check(['ip:1.2.3.4'], 50, NOW);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'events');
});

test('a janela zera e o visitante volta a ser atendido', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1, maxEvents: 10 });
  assert.equal(limiter.check(['ip:1.2.3.4'], 1, NOW).ok, true);
  assert.equal(limiter.check(['ip:1.2.3.4'], 1, NOW).ok, false);
  assert.equal(limiter.check(['ip:1.2.3.4'], 1, NOW + 60_001).ok, true);
});

test('a conta é por chave: um IP estourado não bloqueia o resto do mundo', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1, maxEvents: 10 });
  assert.equal(limiter.check(['ip:1.1.1.1'], 1, NOW).ok, true);
  assert.equal(limiter.check(['ip:1.1.1.1'], 1, NOW).ok, false);
  assert.equal(limiter.check(['ip:2.2.2.2'], 1, NOW).ok, true);
});

test('IP e device são contados juntos, então trocar de device não escapa do IP', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, maxEvents: 100 });
  assert.equal(limiter.check(['ip:1.1.1.1', 'dev:a'], 1, NOW).ok, true);
  assert.equal(limiter.check(['ip:1.1.1.1', 'dev:b'], 1, NOW).ok, true);
  const blocked = limiter.check(['ip:1.1.1.1', 'dev:c'], 1, NOW);
  assert.equal(blocked.ok, false, 'o balde do IP já estourou');
});
