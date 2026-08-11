import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateOrderNumber,
  isValidOrderNumber,
  buildOrderDraft,
} from '../src/checkout/checkout.logic.js';

test('generateOrderNumber is deterministic given now + random', () => {
  const now = new Date(2026, 7, 7); // Aug 7, 2026 (month is 0-indexed)
  const orderNumber = generateOrderNumber({ now, random: () => 0 });
  assert.equal(orderNumber, 'TL-20260807-AAAAAA');
});

test('generateOrderNumber pads month and day', () => {
  const now = new Date(2026, 0, 3); // Jan 3, 2026
  const orderNumber = generateOrderNumber({ now, random: () => 0 });
  assert.equal(orderNumber, 'TL-20260103-AAAAAA');
});

test('generateOrderNumber always matches the expected format', () => {
  for (let i = 0; i < 500; i += 1) {
    const orderNumber = generateOrderNumber();
    assert.match(orderNumber, /^TL-\d{8}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    assert.ok(isValidOrderNumber(orderNumber));
  }
});

test('generateOrderNumber suffix avoids ambiguous characters (0/O/1/I)', () => {
  // random -> last index deterministically maps into the safe alphabet.
  const orderNumber = generateOrderNumber({ now: new Date(2026, 7, 7), random: () => 0.999999 });
  const suffix = orderNumber.split('-')[2];
  assert.doesNotMatch(suffix, /[01OI]/);
});

test('generateOrderNumber produces high uniqueness', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i += 1) seen.add(generateOrderNumber());
  // 32^6 space — collisions across 5000 draws should be effectively none.
  assert.ok(seen.size > 4990, `expected near-unique numbers, got ${seen.size}`);
});

test('isValidOrderNumber rejects malformed values', () => {
  assert.equal(isValidOrderNumber('TL-2026-ABCDEF'), false);
  assert.equal(isValidOrderNumber('XX-20260807-ABCDEF'), false);
  assert.equal(isValidOrderNumber('TL-20260807-ABC0EF'), false); // 0 not in alphabet
  assert.equal(isValidOrderNumber(''), false);
  assert.equal(isValidOrderNumber(null), false);
});

test('buildOrderDraft computes totals and normalizes items', () => {
  const draft = buildOrderDraft(
    [
      { product_id: 1, qty: 1, unit_price: 1000, categoria: 'notebooks' },
      { product_id: 2, qty: 2, unit_price: 50, categoria: 'perifericos' },
    ],
    { warrantyRate: 0.03, warranty: true },
  );
  assert.equal(draft.subtotal, 1100);
  assert.equal(draft.warranty, true);
  assert.equal(draft.warrantyTotal, 33);
  assert.equal(draft.total, 1133);
  assert.equal(draft.itemCount, 3);
  // A linha não guarda garantia: a escolha é do pedido.
  assert.deepEqual(draft.items, [
    { product_id: 1, qty: 1, unit_price: 1000 },
    { product_id: 2, qty: 2, unit_price: 50 },
  ]);
});

test('buildOrderDraft sem garantia escolhida cobra só os produtos', () => {
  const draft = buildOrderDraft([{ product_id: 1, qty: 1, unit_price: 1000, categoria: 'notebooks' }]);
  assert.equal(draft.warranty, false);
  assert.equal(draft.warrantyTotal, 0);
  assert.equal(draft.total, 1000);
});

test('buildOrderDraft guarda a atribuição do combo e o desconto', () => {
  const combos = [
    { slug: 'mesa-de-trabalho', nome: 'Mesa de trabalho', percent: 8, categorias: ['notebooks', 'smartphones'] },
  ];
  const draft = buildOrderDraft(
    [
      { product_id: 1, qty: 1, unit_price: 10000, categoria: 'notebooks' },
      { product_id: 2, qty: 1, unit_price: 8608, categoria: 'smartphones' },
    ],
    { warrantyRate: 0.03, warranty: true, combos },
  );
  assert.equal(draft.combo.slug, 'mesa-de-trabalho');
  assert.equal(draft.discountTotal, 1488.64);
  // Carrinho inteiramente em combo: nada sobra para a garantia medir.
  assert.equal(draft.warranty, false);
  assert.equal(draft.warrantyTotal, 0);
  assert.equal(draft.total, 17119.36);
});

test('buildOrderDraft rejects an empty cart with status 400', () => {
  assert.throws(
    () => buildOrderDraft([]),
    (err) => err.status === 400 && /carrinho vazio/i.test(err.message),
  );
});
