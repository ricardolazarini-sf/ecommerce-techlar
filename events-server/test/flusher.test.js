import { test } from 'node:test';
import assert from 'node:assert/strict';

import { config } from '../src/config/index.js';
import { createFlusher } from '../src/ingest/flusher.js';

// Repositório de mentira, com a mesma superfície do de verdade. O que interessa
// no flusher é a DECISÃO por resposta HTTP — enviado, recusado ou tentar de
// novo — e isso é testável sem banco.
function fakeRepo(pending = []) {
  const calls = { sent: [], rejected: [], retried: [], batches: [], closed: [] };
  return {
    calls,
    async exhaustAttempts() {
      return [];
    },
    async claimPending() {
      return pending;
    },
    async openBatch(info) {
      calls.batches.push(info);
      return calls.batches.length;
    },
    async closeBatch(id, info) {
      calls.closed.push({ id, ...info });
    },
    async markSent(ids) {
      calls.sent.push(...ids);
    },
    async markRejected(ids, error) {
      calls.rejected.push({ ids, error });
    },
    async markRetry(ids, error) {
      calls.retried.push({ ids, error });
    },
  };
}

const row = (over = {}) => ({
  event_id: '11111111-2222-4333-8444-555555555555',
  event_type: 'combo_clicked',
  occurred_at: new Date('2026-08-11T12:00:00.000Z'),
  device_id: 'c-1-2',
  email: '',
  props: { combo_id: 'casa-inteira', discount: 12 },
  attempts: 0,
  ...over,
});

function setMode({ dryRun = false, validateOnly = false } = {}) {
  config.flush.dryRun = dryRun;
  config.flush.validateOnly = validateOnly;
  config.dataCloud.connector = 'TechLar_Web';
  config.dataCloud.object = 'ecommerce_events';
}

const fakeTokens = { get: async () => ({ token: 'dc-token', host: 'abc.c360a.salesforce.com' }) };

test('202 marca a linha como enviada e fecha o lote com sucesso', async () => {
  setMode();
  const repo = fakeRepo([row()]);
  const flusher = createFlusher({
    repository: repo,
    tokenProvider: fakeTokens,
    fetchImpl: async () => ({ ok: true, status: 202, text: async () => '' }),
  });

  const totals = await flusher.runOnce();
  assert.equal(totals.sent, 1);
  assert.equal(repo.calls.sent.length, 1);
  assert.equal(repo.calls.closed[0].ok, true);
  assert.equal(repo.calls.closed[0].httpStatus, 202);
});

test('400 vira recusa definitiva, com o motivo salvo para achar o campo culpado', async () => {
  setMode();
  const repo = fakeRepo([row()]);
  const flusher = createFlusher({
    repository: repo,
    tokenProvider: fakeTokens,
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      text: async () => '{"message":"required key [surface] not found"}',
    }),
  });

  const totals = await flusher.runOnce();
  assert.equal(totals.rejected, 1);
  assert.equal(totals.sent, 0);
  assert.equal(repo.calls.retried.length, 0, '4xx não se repete');
  assert.match(repo.calls.rejected[0].error, /required key \[surface\] not found/);
});

test('503 mantém a linha pendente para o próximo ciclo, sem perder clique', async () => {
  setMode();
  const repo = fakeRepo([row()]);
  const flusher = createFlusher({
    repository: repo,
    tokenProvider: fakeTokens,
    fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'indisponível' }),
  });

  const totals = await flusher.runOnce();
  assert.equal(totals.retried, 1);
  assert.equal(repo.calls.sent.length, 0);
  assert.equal(repo.calls.rejected.length, 0);
});

test('validate-only bate em /actions/test e não ingere', async () => {
  setMode({ validateOnly: true });
  const repo = fakeRepo([row()]);
  let endpoint = '';
  const flusher = createFlusher({
    repository: repo,
    tokenProvider: fakeTokens,
    fetchImpl: async (url) => {
      endpoint = url;
      return { ok: true, status: 200, text: async () => '' };
    },
  });

  assert.equal(flusher.mode, 'validate');
  await flusher.runOnce();
  assert.match(endpoint, /\/actions\/test$/);
  assert.equal(repo.calls.batches[0].mode, 'validate');
});

test('dry-run não autentica nem faz POST', async () => {
  setMode({ dryRun: true });
  const repo = fakeRepo([row()]);
  const flusher = createFlusher({
    repository: repo,
    tokenProvider: {
      get: async () => {
        throw new Error('dry-run não deveria pedir token');
      },
    },
    fetchImpl: async () => {
      throw new Error('dry-run não deveria fazer POST');
    },
  });

  assert.equal(flusher.mode, 'dry-run');
  const totals = await flusher.runOnce();
  assert.equal(totals.sent, 1);
  assert.equal(repo.calls.closed[0].response, 'dry-run');
});

test('falha de autenticação não marca nada como enviado', async () => {
  setMode();
  const repo = fakeRepo([row()]);
  const flusher = createFlusher({
    repository: repo,
    tokenProvider: {
      get: async () => {
        throw new Error('invalid_grant');
      },
    },
    fetchImpl: async () => ({ ok: true, status: 202, text: async () => '' }),
  });

  const totals = await flusher.runOnce();
  assert.match(totals.error, /invalid_grant/);
  assert.equal(repo.calls.sent.length, 0);
});

test('fila vazia é um ciclo sem POST e sem lote aberto', async () => {
  setMode();
  const repo = fakeRepo([]);
  const flusher = createFlusher({
    repository: repo,
    tokenProvider: fakeTokens,
    fetchImpl: async () => {
      throw new Error('não deveria enviar nada');
    },
  });

  const totals = await flusher.runOnce();
  assert.equal(totals.claimed, 0);
  assert.equal(repo.calls.batches.length, 0);
});

test('o que vai no POST é o registro achatado, com as 26 chaves do contrato', async () => {
  setMode();
  const repo = fakeRepo([row()]);
  let body = null;
  const flusher = createFlusher({
    repository: repo,
    tokenProvider: fakeTokens,
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return { ok: true, status: 202, text: async () => '' };
    },
  });

  await flusher.runOnce();
  assert.equal(body.data.length, 1);
  assert.equal(Object.keys(body.data[0]).length, 26);
  assert.equal(body.data[0].combo_id, 'casa-inteira');
  assert.equal(body.data[0].discount, 12);
  assert.equal(body.data[0].sku, '', 'campo que não se aplica vai vazio, não ausente');
});
