import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  round2,
  isServiceItem,
  computeLineTotals,
  applyCombo,
  computeCartTotals,
  normalizeQty,
} from '../src/cart/cart.logic.js';

// Combos de teste com a mesma forma de src/db/combos.js.
const COMBOS = [
  { slug: 'mesa-de-trabalho', nome: 'Mesa de trabalho', percent: 8, categorias: ['notebooks', 'smartphones'] },
  { slug: 'casa-inteira', nome: 'Casa inteira', percent: 12, categorias: ['notebooks', 'smartphones', 'impressoras-3d'] },
];

const notebook = (over = {}) => ({ product_id: 1, categoria: 'notebooks', unit_price: 10000, qty: 1, ...over });
const phone = (over = {}) => ({ product_id: 2, categoria: 'smartphones', unit_price: 8608, qty: 1, ...over });
const printer = (over = {}) => ({ product_id: 3, categoria: 'impressoras-3d', unit_price: 5500, qty: 1, ...over });
const cable = (over = {}) => ({ product_id: 4, categoria: 'perifericos', unit_price: 20, qty: 1, ...over });
const service = (over = {}) => ({ product_id: 5, sku: 'SVC-INSTALL', categoria: 'servicos', unit_price: 300, qty: 1, ...over });

test('round2 rounds to cents (half-up)', () => {
  assert.equal(round2(10.005), 10.01);
  assert.equal(round2(2.675), 2.68);
  assert.equal(round2(0), 0);
});

test('computeCartTotals: empty cart is all zeros and offers no warranty', () => {
  const totals = computeCartTotals([]);
  assert.equal(totals.subtotal, 0);
  assert.equal(totals.total, 0);
  assert.equal(totals.itemCount, 0);
  assert.equal(totals.warrantyTotal, 0);
  assert.equal(totals.warrantyAvailable, false);
  assert.equal(totals.combo, null);
  assert.equal(totals.discountTotal, 0);
});

test('computeCartTotals: subtotal is sum of unit_price * qty', () => {
  const totals = computeCartTotals([
    { product_id: 1, unit_price: 100, qty: 2 },
    { product_id: 2, unit_price: 49.9, qty: 1 },
  ]);
  assert.equal(totals.subtotal, 249.9);
  assert.equal(totals.warrantyTotal, 0);
  assert.equal(totals.total, 249.9);
  assert.equal(totals.itemCount, 3);
});

test('computeCartTotals: handles fractional prices without float drift', () => {
  const totals = computeCartTotals([{ product_id: 1, unit_price: 10.1, qty: 3 }]);
  assert.equal(totals.subtotal, 30.3);
  assert.equal(totals.total, 30.3);
});

test('computeLineTotals: a linha é só produto, sem garantia embutida', () => {
  const line = computeLineTotals({ unit_price: 200, qty: 2 });
  assert.equal(line.productTotal, 400);
  assert.equal(line.lineTotal, 400);
});

test('garantia é do pedido: 3% do subtotal, uma vez', () => {
  const totals = computeCartTotals([notebook(), cable({ qty: 2 })], {
    warrantyRate: 0.03,
    warranty: true,
  });
  assert.equal(totals.subtotal, 10040);
  assert.equal(totals.warrantyBase, 10040);
  assert.equal(totals.warrantyTotal, 301.2);
  assert.equal(totals.total, 10341.2);
});

test('garantia não escolhida não cobra nada, mas segue disponível', () => {
  const totals = computeCartTotals([notebook()], { warranty: false });
  assert.equal(totals.warrantyTotal, 0);
  assert.equal(totals.warrantyAvailable, true);
  assert.equal(totals.total, 10000);
});

test('serviço fica fora da base da garantia', () => {
  const totals = computeCartTotals([notebook(), service()], { warranty: true });
  assert.equal(totals.subtotal, 10300);
  assert.equal(totals.warrantyBase, 10000); // o serviço de 300 não entra
  assert.equal(totals.warrantyTotal, 300);
  assert.equal(totals.total, 10600);
});

test('carrinho só de serviços não tem garantia a oferecer', () => {
  const totals = computeCartTotals([service(), service({ product_id: 6, sku: 'SVC-SETUP' })], {
    warranty: true,
  });
  assert.equal(totals.warrantyAvailable, false);
  assert.equal(totals.warranty, false);
  assert.equal(totals.warrantyTotal, 0);
  assert.equal(totals.total, 600);
});

test('isServiceItem reconhece categoria e prefixo de SKU', () => {
  assert.equal(isServiceItem({ categoria: 'servicos' }), true);
  assert.equal(isServiceItem({ sku: 'svc-instalacao' }), true);
  assert.equal(isServiceItem({ sku: 'CABO-USB', categoria: 'perifericos' }), false);
});

test('applyCombo: sem as duas categorias não há desconto', () => {
  const { combo, discountTotal } = applyCombo([notebook()], COMBOS);
  assert.equal(combo, null);
  assert.equal(discountTotal, 0);
});

test('applyCombo: escolhe o combo que economiza mais, não o de maior percentual', () => {
  const { combo, discountTotal } = applyCombo([notebook(), phone(), printer()], COMBOS);
  assert.equal(combo.slug, 'casa-inteira');
  assert.equal(discountTotal, round2((10000 + 8608 + 5500) * 0.12));
});

test('carrinho misto com combo: a garantia mede só o que sobrou', () => {
  const totals = computeCartTotals([notebook(), phone(), cable({ qty: 3 })], {
    warrantyRate: 0.03,
    warranty: true,
    combos: COMBOS,
  });
  assert.equal(totals.combo.slug, 'mesa-de-trabalho');
  assert.equal(totals.subtotal, 18668); // 10000 + 8608 + 60
  assert.equal(totals.discountTotal, 1488.64); // 8% de 18608
  assert.equal(totals.warrantyBase, 60); // só o cabo, fora do combo
  assert.equal(totals.warrantyTotal, 1.8);
  assert.equal(totals.total, round2(18668 - 1488.64 + 1.8));
  assert.deepEqual(totals.discountedProductIds, [1, 2]);
});

test('carrinho inteiramente em combo: garantia zero e nem oferecida', () => {
  const totals = computeCartTotals([notebook(), phone()], {
    warranty: true,
    combos: COMBOS,
  });
  assert.equal(totals.combo.slug, 'mesa-de-trabalho');
  assert.equal(totals.warrantyBase, 0);
  assert.equal(totals.warrantyAvailable, false);
  assert.equal(totals.warranty, false);
  assert.equal(totals.warrantyTotal, 0);
  assert.equal(totals.total, round2(18608 - 1488.64));
});

test('computeCartTotals: warranty rate is configurable', () => {
  const totals = computeCartTotals([{ product_id: 1, unit_price: 100, qty: 1 }], {
    warrantyRate: 0.2,
    warranty: true,
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
    assert.throws(() => normalizeQty(bad), /Quantidade inv/);
  }
});
