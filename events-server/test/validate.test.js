import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateBatch } from '../src/collect/validate.js';

const NOW = Date.parse('2026-08-11T12:00:00.000Z');
const clique = (over = {}) => ({ event_type: 'combo_clicked', props: { combo_id: 'casa-inteira' }, ...over });

test('lote válido vira linhas da fila', () => {
  const { rows, rejected } = validateBatch({ device_id: 'c-1-2', events: [clique()] }, { now: NOW });
  assert.equal(rows.length, 1);
  assert.equal(rejected.length, 0);
  assert.equal(rows[0].event_type, 'combo_clicked');
  assert.equal(rows[0].device_id, 'c-1-2');
  assert.equal(rows[0].props.combo_id, 'casa-inteira');
});

test('tipo fora da allowlist é recusado, e o resto do lote continua valendo', () => {
  const { rows, rejected } = validateBatch(
    { device_id: 'c-1-2', events: [clique(), { event_type: 'tecla_apertada' }] },
    { now: NOW },
  );
  assert.equal(rows.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, 'tipo desconhecido');
});

test('event_id repetido dentro do mesmo POST entra uma vez só', () => {
  const event_id = '11111111-2222-4333-8444-555555555555';
  const { rows } = validateBatch(
    { device_id: 'c-1-2', events: [clique({ event_id }), clique({ event_id })] },
    { now: NOW },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_id, event_id);
});

test('sem event_id o coletor gera um, para a chave de deduplicação nunca faltar', () => {
  const { rows } = validateBatch({ device_id: 'c-1-2', events: [clique()] }, { now: NOW });
  assert.match(rows[0].event_id, /^[0-9a-f-]{36}$/);
});

test('event_id que não é uuid é substituído em vez de aceito', () => {
  const { rows } = validateBatch(
    { device_id: 'c-1-2', events: [clique({ event_id: 'quero-essa-chave' })] },
    { now: NOW },
  );
  assert.notEqual(rows[0].event_id, 'quero-essa-chave');
  assert.match(rows[0].event_id, /^[0-9a-f-]{36}$/);
});

test('o e-mail vem do token verificado, e o do corpo é ignorado', () => {
  const { rows } = validateBatch(
    { device_id: 'c-1-2', events: [clique({ props: { email: 'invasor@example.com' } })] },
    { email: 'Ana@Example.com', now: NOW },
  );
  assert.equal(rows[0].email, 'ana@example.com');
  assert.equal('email' in rows[0].props, false);
});

test('lote acima do teto é recusado inteiro', () => {
  const events = Array.from({ length: 51 }, () => clique());
  const { error, rows } = validateBatch({ device_id: 'c-1-2', events }, { maxEvents: 50, now: NOW });
  assert.match(error, /teto/);
  assert.equal(rows, undefined);
});

test('lote vazio ou corpo torto é recusado com mensagem', () => {
  assert.match(validateBatch({ events: [] }).error, /Nenhum evento/);
  assert.match(validateBatch(null).error, /Corpo inválido/);
  assert.match(validateBatch({ events: 'nao-e-array' }).error, /array/);
});

test('relógio adiantado do visitante não empurra o clique para o futuro', () => {
  const futuro = new Date(NOW + 60 * 60 * 1000).toISOString();
  const { rows } = validateBatch(
    { device_id: 'c-1-2', events: [clique({ occurred_at: futuro })] },
    { now: NOW },
  );
  assert.equal(rows[0].occurred_at.getTime(), NOW);
});

test('clique guardado por dias numa aba esquecida entra com a hora de agora', () => {
  const antigo = new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { rows } = validateBatch(
    { device_id: 'c-1-2', events: [clique({ occurred_at: antigo })] },
    { now: NOW },
  );
  assert.equal(rows[0].occurred_at.getTime(), NOW);
});

test('horário plausível é preservado como veio', () => {
  const agora = new Date(NOW - 30_000).toISOString();
  const { rows } = validateBatch(
    { device_id: 'c-1-2', events: [clique({ occurred_at: agora })] },
    { now: NOW },
  );
  assert.equal(rows[0].occurred_at.toISOString(), agora);
});

test('device_id do lote vale para o evento que não trouxe o seu', () => {
  const { rows } = validateBatch({ device_id: 'c-9-9', events: [clique()] }, { now: NOW });
  assert.equal(rows[0].device_id, 'c-9-9');
});
