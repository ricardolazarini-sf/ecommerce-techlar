import { withTransaction } from '../db/index.js';
import * as cartRepo from '../cart/cart.repository.js';
import * as combosRepo from '../catalog/combos.repository.js';
import * as ordersRepo from '../orders/orders.repository.js';
import * as ordersService from '../orders/orders.service.js';
import { computeCartTotals } from '../cart/cart.logic.js';
import { generateOrderNumber, buildOrderDraft } from './checkout.logic.js';
import { config } from '../config/index.js';
import { events } from '../events/index.js';

const warrantyRate = () => config.warrantyRate;

// A garantia é uma decisão da compra: um booleano, não um mapa de product_id.
function wantsWarranty(value) {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}

function toEventItems(items) {
  return items.map((i) => ({
    product_id: i.product_id,
    qty: Number(i.qty),
    unit_price: Number(i.unit_price),
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

// Review step — computes totals (order warranty + combo discount) and emits
// checkout_started. Does not persist anything.
export async function startCheckout(identity, ctx, warranty) {
  const cart = await cartRepo.getOrCreateOpenCart(identity);
  const [rows, combos] = await Promise.all([
    cartRepo.getItemsWithProduct(cart.id),
    combosRepo.listActiveCombos(),
  ]);
  if (!rows.length) {
    const err = new Error('Não é possível iniciar o checkout com o carrinho vazio.');
    err.status = 400;
    throw err;
  }
  const totals = computeCartTotals(rows, {
    warrantyRate: warrantyRate(),
    warranty: wantsWarranty(warranty),
    combos,
  });

  events.checkoutStarted(
    ctx.ref,
    {
      items: toEventItems(rows),
      subtotal: totals.subtotal,
      total: totals.total,
      item_count: totals.itemCount,
    },
    { customerId: ctx.customerId },
  );

  return {
    cart_id: cart.id,
    items: rows.map((i) => ({
      product_id: i.product_id,
      sku: i.sku,
      nome: i.nome,
      categoria: i.categoria,
      imagem_url: i.imagem_url,
      qty: Number(i.qty),
      unit_price: Number(i.unit_price),
      in_combo: totals.discountedProductIds.includes(i.product_id),
    })),
    warrantyRate: warrantyRate(),
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
        warranty: draft.warranty,
        warrantyTotal: draft.warrantyTotal,
        comboSlug: draft.combo ? draft.combo.slug : null,
        discountTotal: draft.discountTotal,
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
  throw new Error('Não foi possível gerar um número de pedido único.');
}

// Confirmation step — persists the order + items, marks the cart converted, and
// emits order_placed. Everything DB-related happens in one transaction; the
// event is emitted only after commit so the local audit log FK is valid.
export async function confirmOrder(identity, ctx, { warranty, customer: customerInput } = {}) {
  const wantsIt = wantsWarranty(warranty);
  const combos = await combosRepo.listActiveCombos();

  const result = await withTransaction(async (client) => {
    const cart = await resolveOpenCart(client, identity);
    if (!cart) {
      const err = new Error('Nenhum carrinho aberto para finalizar.');
      err.status = 400;
      throw err;
    }

    // sku e categoria vêm junto porque a base da garantia depende deles: serviço
    // e linha coberta por combo ficam fora dos 3%.
    const { rows: itemRows } = await client.query(
      `SELECT ci.product_id, ci.qty, ci.unit_price, p.sku, p.categoria
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
        WHERE ci.cart_id = $1`,
      [cart.id],
    );
    if (!itemRows.length) {
      const err = new Error('Não é possível finalizar um carrinho vazio.');
      err.status = 400;
      throw err;
    }

    // Resolve the customer: authenticated user, or capture a guest identity.
    let customerId = ctx.customerId;
    let customerRow = null;
    if (!customerId) {
      if (!customerInput || !customerInput.email || !customerInput.nome) {
        const err = new Error('Informe ao menos nome e email para finalizar.');
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

    const draft = buildOrderDraft(itemRows, {
      warrantyRate: warrantyRate(),
      warranty: wantsIt,
      combos,
    });

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
      warranty: result.draft.warranty,
      warranty_total: result.draft.warrantyTotal,
      combo_id: result.draft.combo ? result.draft.combo.slug : '',
      discount: result.draft.discountTotal,
      status: result.order.status,
    },
    { customerId: result.customerId },
  );

  // Return an enriched order (with product names) for the confirmation page.
  const enriched = await ordersService.getMyOrder(result.customerId, result.order.order_number);
  return enriched;
}

export default { startCheckout, confirmOrder };
