import { query } from '../db/index.js';

export async function add(customerId, productId) {
  await query(
    `INSERT INTO wishlist_items (customer_id, product_id)
     VALUES ($1, $2) ON CONFLICT (customer_id, product_id) DO NOTHING`,
    [customerId, productId],
  );
}

export async function remove(customerId, productId) {
  await query(`DELETE FROM wishlist_items WHERE customer_id = $1 AND product_id = $2`, [
    customerId,
    productId,
  ]);
}

export async function listByCustomer(customerId) {
  const { rows } = await query(
    `SELECT p.id AS product_id, p.sku, p.nome, p.categoria, p.preco, p.imagem_url, w.created_at
       FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
      WHERE w.customer_id = $1
      ORDER BY w.created_at DESC`,
    [customerId],
  );
  return rows;
}

export default { add, remove, listByCustomer };
