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
      { product_id: 1, qty: 1, unit_price: 1000, warranty: true },
      { product_id: 2, qty: 2, unit_price: 50, warranty: false },
    ],
    { warrantyRate: 0.15 },
  );
  assert.equal(draft.subtotal, 1100);
  assert.equal(draft.warrantyTotal, 150);
  assert.equal(draft.total, 1250);
  assert.equal(draft.itemCount, 3);
  assert.deepEqual(draft.items, [
    { product_id: 1, qty: 1, unit_price: 1000, warranty: true },
    { product_id: 2, qty: 2, unit_price: 50, warranty: false },
  ]);
});

test('buildOrderDraft rejects an empty cart with status 400', () => {
  assert.throws(
    () => buildOrderDraft([]),
    (err) => err.status === 400 && /empty cart/i.test(err.message),
  );
});
