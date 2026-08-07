import { withTransaction } from '../db/index.js';
import * as cartRepo from '../cart/cart.repository.js';
import * as ordersRepo from '../orders/orders.repository.js';
import * as ordersService from '../orders/orders.service.js';
import { computeCartTotals } from '../cart/cart.logic.js';
import { generateOrderNumber, buildOrderDraft } from './checkout.logic.js';
import { config } from '../config/index.js';
import { events } from '../events/index.js';

const warrantyRate = () => config.warrantyRate;

// Accepts warranties as an object map ({ "3": true }) or an array of product
// ids, and returns a Set of product ids that should carry extended warranty.
function normalizeWarranties(warranties) {
  const set = new Set();
  if (Array.isArray(warranties)) {
    warranties.forEach((id) => set.add(Number(id)));
  } else if (warranties && typeof warranties === 'object') {
    for (const [id, on] of Object.entries(warranties)) {
      if (on) set.add(Number(id));
    }
  }
  return set;
}

function toEventItems(items) {
  return items.map((i) => ({
    product_id: i.product_id,
    qty: Number(i.qty),
    unit_price: Number(i.unit_price),
    warranty: Boolean(i.warranty),
  }));
}

function refWithCustomer(ref, customer) {
  if (!customer) return ref;
  return {
    email: customer.email ?? ref.email ?? null,
    phone: customer.telefone ?? ref.phone ?? null,
    document: customer.documento ?? ref.document ?? null,
    device_id: ref.device_id ?? null,
  };
}

// Review step — computes totals (including warranty selections) and emits
// checkout_started. Does not persist anything.
export async function startCheckout(identity, ctx, warranties) {
  const warrantySet = normalizeWarranties(warranties);
  const cart = await cartRepo.getOrCreateOpenCart(identity);
  const rows = await cartRepo.getItemsWithProduct(cart.id);
  if (!rows.length) {
    const err = new Error('Cannot start checkout with an empty cart');
    err.status = 400;
    throw err;
  }
  const items = rows.map((i) => ({ ...i, warranty: warrantySet.has(i.product_id) }));
  const totals = computeCartTotals(items, { warrantyRate: warrantyRate() });

  events.checkoutStarted(
    ctx.ref,
    {
      items: toEventItems(items),
      subtotal: totals.subtotal,
      total: totals.total,
      item_count: totals.itemCount,
    },
    { customerId: ctx.customerId },
  );

  return {
    cart_id: cart.id,
    items: items.map((i) => ({
      product_id: i.product_id,
      sku: i.sku,
      nome: i.nome,
      imagem_url: i.imagem_url,
      qty: Number(i.qty),
      unit_price: Number(i.unit_price),
      warranty: i.warranty,
    })),
    ...totals,
  };
}

async function resolveOpenCart(client, { customerId, deviceId }) {
  if (customerId) {
    const r = await client.query(
      `SELECT * FROM carts WHERE customer_id = $1 AND status = 'open' ORDER BY updated_at DESC LIMIT 1`,
      [customerId],
    );
    if (r.rows[0]) return r.rows[0];
  }
  if (deviceId) {
    const r = await client.query(
      `SELECT * FROM carts WHERE device_id = $1 AND status = 'open' AND customer_id IS NULL ORDER BY updated_at DESC LIMIT 1`,
      [deviceId],
    );
    if (r.rows[0]) return r.rows[0];
  }
  return null;
}

async function insertOrderWithUniqueNumber(client, { customerId, draft }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = generateOrderNumber();
    await client.query('SAVEPOINT ord_attempt');
    try {
      const order = await ordersRepo.insertOrder(client, {
        orderNumber,
        customerId,
        subtotal: draft.subtotal,
        total: draft.total,
        status: 'confirmed',
      });
      await client.query('RELEASE SAVEPOINT ord_attempt');
      return order;
    } catch (err) {
      if (err.code === '23505') {
        await client.query('ROLLBACK TO SAVEPOINT ord_attempt');
        continue;
      }
      throw err;
    }
  }
  throw new Error('Could not generate a unique order number');
}

// Confirmation step — persists the order + items, marks the cart converted, and
// emits order_placed. Everything DB-related happens in one transaction; the
// event is emitted only after commit so the local audit log FK is valid.
export async function confirmOrder(identity, ctx, { warranties, customer: customerInput } = {}) {
  const warrantySet = normalizeWarranties(warranties);

  const result = await withTransaction(async (client) => {
    const cart = await resolveOpenCart(client, identity);
    if (!cart) {
      const err = new Error('No open cart to check out');
      err.status = 400;
      throw err;
    }

    const { rows: itemRows } = await client.query(
      `SELECT product_id, qty, unit_price FROM cart_items WHERE cart_id = $1`,
      [cart.id],
    );
    if (!itemRows.length) {
      const err = new Error('Cannot check out an empty cart');
      err.status = 400;
      throw err;
    }

    // Resolve the customer: authenticated user, or capture a guest identity.
    let customerId = ctx.customerId;
    let customerRow = null;
    if (!customerId) {
      if (!customerInput || !customerInput.email || !customerInput.nome) {
        const err = new Error('Guest checkout requires at least nome and email');
        err.status = 400;
        throw err;
      }
      const inserted = await client.query(
        `INSERT INTO customers (nome, email, telefone, documento, device_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nome, email, telefone, documento`,
        [
          customerInput.nome,
          customerInput.email,
          customerInput.telefone || null,
          customerInput.documento || null,
          identity.deviceId || null,
        ],
      );
      customerRow = inserted.rows[0];
      customerId = customerRow.id;
    }

    // Attach the cart to the resolved customer if it was anonymous.
    if (cart.customer_id !== customerId) {
      await client.query(`UPDATE carts SET customer_id = $1 WHERE id = $2`, [customerId, cart.id]);
    }

    const orderItemsInput = itemRows.map((i) => ({
      product_id: i.product_id,
      qty: Number(i.qty),
      unit_price: Number(i.unit_price),
      warranty: warrantySet.has(i.product_id),
    }));
    const draft = buildOrderDraft(orderItemsInput, { warrantyRate: warrantyRate() });

    const order = await insertOrderWithUniqueNumber(client, { customerId, draft });
    await ordersRepo.insertOrderItems(client, order.id, draft.items);
    await client.query(`UPDATE carts SET status = 'converted', updated_at = now() WHERE id = $1`, [
      cart.id,
    ]);

    return { order, draft, customerId, customerRow };
  });

  // Emit after commit (best-effort; never blocks or breaks the response).
  events.orderPlaced(
    refWithCustomer(ctx.ref, result.customerRow),
    {
      order_number: result.order.order_number,
      items: result.draft.items,
      subtotal: result.draft.subtotal,
      total: result.draft.total,
      status: result.order.status,
    },
    { customerId: result.customerId },
  );

  // Return an enriched order (with product names) for the confirmation page.
  const enriched = await ordersService.getMyOrder(result.customerId, result.order.order_number);
  return { ...enriched, warrantyTotal: result.draft.warrantyTotal };
}

export default { startCheckout, confirmOrder };
