import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chunkBySize, buildEndpoint, bytesOf, postBatch } from '../src/ingest/dataCloud.js';

const row = (i) => ({ event_id: `id-${i}`, filler: 'x'.repeat(100) });

// O teto oficial é por REQUEST (200 KB do envelope inteiro), não por contagem de
// linhas — por isso o lote fecha por tamanho.
test('o lote fecha por tamanho, não por contagem', () => {
  const rows = Array.from({ length: 20 }, (_, i) => row(i));
  const { batches } = chunkBySize(rows, 600);
  assert.ok(batches.length > 1, 'deveria dividir em mais de um lote');
  for (const batch of batches) {
    assert.ok(bytesOf({ data: batch }) <= 600, 'nenhum lote passa do teto');
  }
  // Nenhuma linha se perde na divisão.
  assert.equal(batches.reduce((n, b) => n + b.length, 0), 20);
});

test('cabendo tudo, sai um lote só', () => {
  const { batches, oversized } = chunkBySize([row(1), row(2)], 190_000);
  assert.equal(batches.length, 1);
  assert.equal(oversized.length, 0);
});

test('registro que sozinho não cabe é separado em vez de derrubar o ciclo', () => {
  const gigante = { event_id: 'grande', items_json: 'y'.repeat(5_000) };
  const { batches, oversized } = chunkBySize([row(1), gigante, row(2)], 1_000);
  assert.equal(oversized.length, 1);
  assert.equal(oversized[0].event_id, 'grande');
  assert.equal(batches.flat().length, 2);
});

test('fila vazia não gera lote', () => {
  const { batches } = chunkBySize([], 190_000);
  assert.equal(batches.length, 0);
});

test('validate-only usa /actions/test; a ingestão usa o endpoint direto', () => {
  const base = { host: 'x.c360a.salesforce.com', connector: 'TechLar_Web', object: 'ecommerce_events' };
  assert.equal(
    buildEndpoint(base),
    'https://x.c360a.salesforce.com/api/v1/ingest/sources/TechLar_Web/ecommerce_events',
  );
  assert.equal(
    buildEndpoint({ ...base, validate: true }),
    'https://x.c360a.salesforce.com/api/v1/ingest/sources/TechLar_Web/ecommerce_events/actions/test',
  );
});

test('202 é sucesso, e o envelope vai como { data: [...] }', async () => {
  let seen = null;
  const result = await postBatch({
    host: 'h',
    token: 't',
    connector: 'c',
    object: 'ecommerce_events',
    rows: [{ event_id: 'a' }],
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return { ok: true, status: 202, text: async () => '' };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 202);
  assert.deepEqual(JSON.parse(seen.init.body), { data: [{ event_id: 'a' }] });
  assert.equal(seen.init.headers.Authorization, 'Bearer t');
});

test('4xx não é para repetir; 5xx e 429 são', async () => {
  const call = (status) =>
    postBatch({
      host: 'h',
      token: 't',
      connector: 'c',
      object: 'o',
      rows: [{}],
      fetchImpl: async () => ({ ok: false, status, text: async () => 'detalhe' }),
    });

  assert.equal((await call(400)).retryable, false);
  assert.equal((await call(401)).retryable, false);
  assert.equal((await call(429)).retryable, true);
  assert.equal((await call(503)).retryable, true);
});
