import { computeCartTotals } from '../cart/cart.logic.js';

// Pure checkout logic — no I/O, fully unit-testable.

// Unambiguous alphabet (no 0/O/1/I) for human-readable order suffixes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Builds an order number like `TL-20260807-K7QP2M`.
// `now` and `random` are injectable so the output is deterministic in tests.
export function generateOrderNumber({ now = new Date(), random = Math.random, prefix = 'TL', suffixLength = 6 } = {}) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  let suffix = '';
  for (let i = 0; i < suffixLength; i += 1) {
    const index = Math.floor(random() * ALPHABET.length) % ALPHABET.length;
    suffix += ALPHABET[index];
  }
  return `${prefix}-${year}${month}${day}-${suffix}`;
}

// Validates that a value looks like an order number produced above.
export function isValidOrderNumber(value) {
  return /^TL-\d{8}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(String(value || ''));
}

// Given priced line items (each: { product_id, qty, unit_price, warranty? }),
// produces the persisted order shape: normalized items + subtotal/total.
export function buildOrderDraft(items = [], { warrantyRate = 0.15 } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Cannot check out an empty cart');
    err.status = 400;
    throw err;
  }

  const totals = computeCartTotals(items, { warrantyRate });
  const orderItems = items.map((item) => ({
    product_id: item.product_id,
    qty: Number(item.qty),
    unit_price: Number(item.unit_price),
    warranty: Boolean(item.warranty),
  }));

  return {
    items: orderItems,
    subtotal: totals.subtotal,
    total: totals.total,
    warrantyTotal: totals.warrantyTotal,
    itemCount: totals.itemCount,
  };
}

export default { generateOrderNumber, isValidOrderNumber, buildOrderDraft };
