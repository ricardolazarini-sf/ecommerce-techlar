import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_TYPES,
  CONTRACT_KEYS,
  isKnownEventType,
  sanitizeProps,
  flattenEvent,
} from '../src/collect/contract.js';

// O teste que paga a dívida mais cara da ingestão de clientes: o Data Stream
// recusa com 400 `required key [x] not found` o registro que omite qualquer
// propriedade declarada no schema, mesmo as de fora do `required`.
test('o achatador emite SEMPRE o conjunto completo de chaves do contrato', () => {
  const flat = flattenEvent({
    event_id: '0f7f3e6a-1c2b-4d3e-8a9b-0c1d2e3f4a5b',
    event_type: 'search_performed',
    occurred_at: '2026-08-11T12:00:00.000Z',
    device_id: 'c-1-2',
    props: { search_term: 'notebook' },
  });

  assert.deepEqual(Object.keys(flat).sort(), [...CONTRACT_KEYS].sort());
  assert.equal(Object.keys(flat).length, 27);
});

test('customer_id sai da linha da fila, não das props do navegador', () => {
  const flat = flattenEvent({
    event_id: 'a1b2c3d4-0000-4000-8000-000000000002',
    event_type: 'product_viewed',
    occurred_at: '2026-08-11T12:00:00.000Z',
    customer_id: 'WEB-PJ-42',
    props: { customer_id: 'WEB-PF-1' },
  });

  assert.equal(flat.customer_id, 'WEB-PJ-42');
  // Anônimo não vira null: o Data Stream recusa chave ausente e null.
  assert.equal(flattenEvent({ event_type: 'product_viewed' }).customer_id, '');
});

test('campo que não se aplica ao evento vai como string vazia ou zero, nunca ausente', () => {
  const flat = flattenEvent({
    event_id: 'a1b2c3d4-0000-4000-8000-000000000001',
    event_type: 'identify',
    occurred_at: '2026-08-11T12:00:00.000Z',
    email: 'ana@example.com',
    props: { reason: 'login' },
  });

  assert.equal(flat.email, 'ana@example.com');
  assert.equal(flat.reason, 'login');
  // Texto vazio, não null: null também quebraria o Data Stream.
  assert.equal(flat.sku, '');
  assert.equal(flat.combo_id, '');
  assert.equal(flat.total, 0);
  assert.equal(flat.discount, 0);
  for (const value of Object.values(flat)) {
    assert.notEqual(value, null);
    assert.notEqual(value, undefined);
  }
});

test('sanitizeProps descarta campo desconhecido e traduz o vocabulário do site', () => {
  const props = sanitizeProps({
    nome: 'MacBook Air M4',
    categoria: 'notebooks',
    preco: '10000',
    combo_slug: 'casa-inteira',
    qty: '2',
    senha: 'nao-deve-passar',
    token: 'nem-este',
  });

  assert.equal(props.product_name, 'MacBook Air M4');
  assert.equal(props.category, 'notebooks');
  assert.equal(props.price, 10000);
  assert.equal(props.combo_id, 'casa-inteira');
  assert.equal(props.qty, 2);
  assert.equal('senha' in props, false);
  assert.equal('token' in props, false);
});

test('items (array) vira items_json, porque o contrato não aceita array', () => {
  const props = sanitizeProps({ items: [{ product_id: 10, qty: 1 }] });
  assert.equal(typeof props.items_json, 'string');
  assert.deepEqual(JSON.parse(props.items_json), [{ product_id: 10, qty: 1 }]);
});

test('número inválido vira 0 e dinheiro fica em duas casas', () => {
  const props = sanitizeProps({ price: 'abc', discount: 12.345, total: '2892.96' });
  assert.equal(props.price, 0);
  assert.equal(props.discount, 12.35);
  assert.equal(props.total, 2892.96);
});

test('occurred_at sai sempre em ISO, mesmo recebendo Date ou lixo', () => {
  const fromDate = flattenEvent({ occurred_at: new Date('2026-08-11T12:00:00.000Z') });
  assert.equal(fromDate.occurred_at, '2026-08-11T12:00:00.000Z');
  // Data impossível não pode virar "Invalid Date" no payload.
  assert.match(flattenEvent({ occurred_at: 'nao-e-data' }).occurred_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('a allowlist tem os 14 cliques do plano e recusa o resto', () => {
  assert.equal(EVENT_TYPES.length, 14);
  assert.ok(isKnownEventType('combo_clicked'));
  assert.ok(isKnownEventType('warranty_toggled'));
  assert.equal(isKnownEventType('tecla_apertada'), false);
  assert.equal(isKnownEventType(''), false);
  assert.equal(isKnownEventType(undefined), false);
});
