import { query, withTransaction } from '../db/index.js';

// Data access for carts. All business rules (pricing, event emission) live in
// the service; this layer only reads/writes rows.

async function selectOpenCartRow(client, { customerId, deviceId }) {
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

// Returns an open cart for the given identity, creating one if necessary.
export async function getOrCreateOpenCart({ customerId = null, deviceId = null } = {}) {
  return withTransaction(async (client) => {
    const existing = await selectOpenCartRow(client, { customerId, deviceId });
    if (existing) return existing;
    try {
      const { rows } = await client.query(
        `INSERT INTO carts (customer_id, device_id, status) VALUES ($1, $2, 'open') RETURNING *`,
        [customerId, deviceId],
      );
      return rows[0];
    } catch (err) {
      // Lost a race against the partial unique index — re-read the winner.
      if (err.code === '23505') {
        const again = await selectOpenCartRow(client, { customerId, deviceId });
        if (again) return again;
      }
      throw err;
    }
  });
}

export async function getItemsWithProduct(cartId) {
  const { rows } = await query(
    `SELECT ci.product_id, ci.qty, ci.unit_price,
            p.nome, p.sku, p.categoria, p.imagem_url
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = $1
      ORDER BY p.nome ASC`,
    [cartId],
  );
  return rows;
}

export async function addOrIncrementItem(cartId, product, qty) {
  await query(
    `INSERT INTO cart_items (cart_id, product_id, qty, unit_price)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty`,
    [cartId, product.id, qty, product.preco],
  );
  await touchCart(cartId);
}

export async function setItemQty(cartId, productId, qty) {
  if (qty <= 0) {
    await removeItem(cartId, productId);
    return;
  }
  await query(`UPDATE cart_items SET qty = $3 WHERE cart_id = $1 AND product_id = $2`, [
    cartId,
    productId,
    qty,
  ]);
  await touchCart(cartId);
}

export async function removeItem(cartId, productId) {
  await query(`DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2`, [cartId, productId]);
  await touchCart(cartId);
}

export async function touchCart(cartId) {
  await query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [cartId]);
}

export async function markConverted(cartId) {
  await query(`UPDATE carts SET status = 'converted', updated_at = now() WHERE id = $1`, [cartId]);
}

// Attaches an anonymous device cart to a customer on login/checkout, merging
// into the customer's existing open cart when needed (section 7).
export async function linkDeviceCartToCustomer(deviceId, customerId) {
  if (!deviceId || !customerId) return;
  await withTransaction(async (client) => {
    const anon = (
      await client.query(
        `SELECT id FROM carts WHERE device_id = $1 AND status = 'open' AND customer_id IS NULL ORDER BY updated_at DESC LIMIT 1`,
        [deviceId],
      )
    ).rows[0];
    if (!anon) return;

    const customerCart = (
      await client.query(
        `SELECT id FROM carts WHERE customer_id = $1 AND status = 'open' ORDER BY updated_at DESC LIMIT 1`,
        [customerId],
      )
    ).rows[0];

    if (!customerCart) {
      await client.query(`UPDATE carts SET customer_id = $1, updated_at = now() WHERE id = $2`, [
        customerId,
        anon.id,
      ]);
      return;
    }
    if (customerCart.id === anon.id) return;

    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, qty, unit_price)
       SELECT $1, product_id, qty, unit_price FROM cart_items WHERE cart_id = $2
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty`,
      [customerCart.id, anon.id],
    );
    await client.query(`UPDATE carts SET status = 'abandoned', updated_at = now() WHERE id = $1`, [
      anon.id,
    ]);
    await client.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [customerCart.id]);
  });
}

export default {
  getOrCreateOpenCart,
  getItemsWithProduct,
  addOrIncrementItem,
  setItemQty,
  removeItem,
  touchCart,
  markConverted,
  linkDeviceCartToCustomer,
};
