import { query } from '../db/index.js';

// Write helpers take an explicit client so checkout can run them inside one
// transaction. Read helpers use the pool directly.

// Garantia e desconto moram no cabeçalho: são decisões do pedido inteiro.
// order_items.warranty existe para explicar os pedidos antigos e não é mais
// escrita nem lida.
export async function insertOrder(
  client,
  { orderNumber, customerId, subtotal, total, status, warranty = false, warrantyTotal = 0, comboSlug = null, discountTotal = 0 },
) {
  const { rows } = await client.query(
    `INSERT INTO orders
       (order_number, customer_id, subtotal, total, status,
        warranty, warranty_total, combo_slug, discount_total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, order_number, customer_id, subtotal, total, status, created_at,
               warranty, warranty_total, combo_slug, discount_total`,
    [orderNumber, customerId, subtotal, total, status, Boolean(warranty), warrantyTotal, comboSlug, discountTotal],
  );
  return rows[0];
}

export async function insertOrderItems(client, orderId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, qty, unit_price)
       VALUES ($1, $2, $3, $4)`,
      [orderId, item.product_id, item.qty, item.unit_price],
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
        'unit_price', oi.unit_price
      ) ORDER BY p.nome
    ) FILTER (WHERE oi.id IS NOT NULL),
    '[]'
  ) AS items`;

// NUMERIC volta como string do pg; o cabeçalho do pedido é lido direto pela
// interface, então sai como número.
const ORDER_COLUMNS = `o.id, o.order_number, o.subtotal::float AS subtotal, o.total::float AS total,
       o.status, o.created_at, o.warranty,
       o.warranty_total::float AS warranty_total,
       o.combo_slug, o.discount_total::float AS discount_total`;

export async function listByCustomer(customerId) {
  const { rows } = await query(
    `SELECT ${ORDER_COLUMNS}, ${ITEMS_AGG}
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
    `SELECT ${ORDER_COLUMNS}, ${ITEMS_AGG}
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
