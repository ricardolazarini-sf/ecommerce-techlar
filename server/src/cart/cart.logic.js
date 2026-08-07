// Pure cart pricing logic — no I/O, fully unit-testable.
//
// Money is handled in BRL and rounded to cents. Extended warranty (section 5)
// is an optional per-line fee of `warrantyRate` × unit price × qty. The
// persistent cart (cart_items) does not store warranty (per the schema); the
// warranty flag is applied at checkout, but the same function powers both the
// cart subtotal preview and the order totals.

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function computeLineTotals(item, warrantyRate = 0.15) {
  const qty = Number(item.qty) || 0;
  const unitPrice = Number(item.unit_price) || 0;
  const productTotal = round2(unitPrice * qty);
  const warrantyTotal = item.warranty ? round2(unitPrice * warrantyRate * qty) : 0;
  return {
    productTotal,
    warrantyTotal,
    lineTotal: round2(productTotal + warrantyTotal),
  };
}

// Aggregates a list of items into cart/order totals.
//   subtotal      = sum of product line totals (excludes warranty)
//   warrantyTotal = sum of warranty fees
//   total         = subtotal + warrantyTotal
//   itemCount     = sum of quantities
export function computeCartTotals(items = [], { warrantyRate = 0.15 } = {}) {
  let subtotal = 0;
  let warrantyTotal = 0;
  let itemCount = 0;

  for (const item of items) {
    const line = computeLineTotals(item, warrantyRate);
    subtotal = round2(subtotal + line.productTotal);
    warrantyTotal = round2(warrantyTotal + line.warrantyTotal);
    itemCount += Number(item.qty) || 0;
  }

  return {
    subtotal,
    warrantyTotal,
    total: round2(subtotal + warrantyTotal),
    itemCount,
  };
}

// Normalizes a qty coming from an untrusted source (request body): a positive
// integer, or 0 to signal removal. Missing / non-numeric / negative values throw.
export function normalizeQty(value) {
  if (value === null || value === undefined || value === '') {
    const err = new Error('qty must be a non-negative integer');
    err.status = 400;
    throw err;
  }
  const qty = Number(value);
  if (!Number.isInteger(qty) || qty < 0) {
    const err = new Error('qty must be a non-negative integer');
    err.status = 400;
    throw err;
  }
  return qty;
}

export default { round2, computeLineTotals, computeCartTotals, normalizeQty };
