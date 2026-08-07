import { query } from '../db/index.js';

const COLUMNS = 'id, sku, nome, categoria, preco, descricao, imagem_url';

export async function listProducts({ q, categoria } = {}) {
  const clauses = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(nome ILIKE $${params.length} OR descricao ILIKE $${params.length} OR sku ILIKE $${params.length})`);
  }
  if (categoria) {
    params.push(categoria);
    clauses.push(`categoria = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM products ${where} ORDER BY nome ASC`,
    params,
  );
  return rows;
}

export async function getProductById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function listCategories() {
  const { rows } = await query(
    `SELECT categoria, COUNT(*)::int AS count FROM products GROUP BY categoria ORDER BY categoria ASC`,
  );
  return rows;
}

export async function listFeatured(limit = 8) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM products ORDER BY preco DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export default { listProducts, getProductById, listCategories, listFeatured };
