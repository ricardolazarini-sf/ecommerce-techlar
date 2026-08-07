import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  round2,
  computeLineTotals,
  computeCartTotals,
  normalizeQty,
} from '../src/cart/cart.logic.js';

test('round2 rounds to cents (half-up)', () => {
  assert.equal(round2(10.005), 10.01);
  assert.equal(round2(2.675), 2.68);
  assert.equal(round2(0), 0);
});

test('computeCartTotals: empty cart is all zeros', () => {
  const totals = computeCartTotals([]);
  assert.deepEqual(totals, { subtotal: 0, warrantyTotal: 0, total: 0, itemCount: 0 });
});

test('computeCartTotals: subtotal is sum of unit_price * qty', () => {
  const totals = computeCartTotals([
    { unit_price: 100, qty: 2 },
    { unit_price: 49.9, qty: 1 },
  ]);
  assert.equal(totals.subtotal, 249.9);
  assert.equal(totals.warrantyTotal, 0);
  assert.equal(totals.total, 249.9);
  assert.equal(totals.itemCount, 3);
});

test('computeCartTotals: handles fractional prices without float drift', () => {
  const totals = computeCartTotals([{ unit_price: 10.1, qty: 3 }]);
  assert.equal(totals.subtotal, 30.3);
  assert.equal(totals.total, 30.3);
});

test('computeLineTotals: warranty adds rate * unit_price * qty', () => {
  const line = computeLineTotals({ unit_price: 200, qty: 2, warranty: true }, 0.15);
  assert.equal(line.productTotal, 400);
  assert.equal(line.warrantyTotal, 60);
  assert.equal(line.lineTotal, 460);
});

test('computeCartTotals: warranty flows into total but not subtotal', () => {
  const totals = computeCartTotals(
    [
      { unit_price: 1000, qty: 1, warranty: true },
      { unit_price: 50, qty: 2, warranty: false },
    ],
    { warrantyRate: 0.15 },
  );
  assert.equal(totals.subtotal, 1100); // 1000 + 100
  assert.equal(totals.warrantyTotal, 150); // 15% of 1000
  assert.equal(totals.total, 1250);
  assert.equal(totals.itemCount, 3);
});

test('computeCartTotals: warranty rate is configurable', () => {
  const totals = computeCartTotals([{ unit_price: 100, qty: 1, warranty: true }], {
    warrantyRate: 0.2,
  });
  assert.equal(totals.warrantyTotal, 20);
  assert.equal(totals.total, 120);
});

test('normalizeQty accepts non-negative integers', () => {
  assert.equal(normalizeQty(0), 0);
  assert.equal(normalizeQty(3), 3);
});

test('normalizeQty rejects invalid quantities', () => {
  for (const bad of [-1, 1.5, 'x', NaN, null]) {
    assert.throws(() => normalizeQty(bad), /non-negative integer/);
  }
});
