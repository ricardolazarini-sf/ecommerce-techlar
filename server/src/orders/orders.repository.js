import { query } from '../db/index.js';

// Write helpers take an explicit client so checkout can run them inside one
// transaction. Read helpers use the pool directly.

export async function insertOrder(client, { orderNumber, customerId, subtotal, total, status }) {
  const { rows } = await client.query(
    `INSERT INTO orders (order_number, customer_id, subtotal, total, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, order_number, customer_id, subtotal, total, status, created_at`,
    [orderNumber, customerId, subtotal, total, status],
  );
  return rows[0];
}

export async function insertOrderItems(client, orderId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, qty, unit_price, warranty)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, item.product_id, item.qty, item.unit_price, Boolean(item.warranty)],
    );
  }
}

const ITEMS_AGG = `
  COALESCE(
    json_agg(
      json_build_object(
        'product_id', oi.product_id,
        'sku', p.sku,
        'nome', p.nome,
        'imagem_url', p.imagem_url,
        'qty', oi.qty,
        'unit_price', oi.unit_price,
        'warranty', oi.warranty
      ) ORDER BY p.nome
    ) FILTER (WHERE oi.id IS NOT NULL),
    '[]'
  ) AS items`;

export async function listByCustomer(customerId) {
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.subtotal, o.total, o.status, o.created_at, ${ITEMS_AGG}
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.customer_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC`,
    [customerId],
  );
  return rows;
}

export async function findByCustomerAndNumber(customerId, orderNumber) {
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.subtotal, o.total, o.status, o.created_at, ${ITEMS_AGG}
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.customer_id = $1 AND o.order_number = $2
      GROUP BY o.id`,
    [customerId, orderNumber],
  );
  return rows[0] || null;
}

export default { insertOrder, insertOrderItems, listByCustomer, findByCustomerAndNumber };
