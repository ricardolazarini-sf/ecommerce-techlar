import { query } from '../db/index.js';

const COLUMNS = 'id, sku, nome, categoria, preco, descricao, imagem_url, estoque';

export async function listProducts({ q, categoria, categorias } = {}) {
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
  // Vitrine de um combo: as categorias da regra, para o clique no card cair numa
  // vitrine que faz sentido em vez de no catálogo inteiro.
  if (Array.isArray(categorias) && categorias.length) {
    params.push(categorias);
    clauses.push(`categoria = ANY($${params.length})`);
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

// O produto mais barato de cada categoria — é o que dá o "a partir de" do card
// de combo, calculado do catálogo real e não escrito à mão.
export async function cheapestByCategories(categorias = []) {
  if (!categorias.length) return [];
  const { rows } = await query(
    `SELECT DISTINCT ON (categoria) ${COLUMNS}
       FROM products
      WHERE categoria = ANY($1)
      ORDER BY categoria, preco ASC`,
    [categorias],
  );
  return rows;
}

// Espelha no banco o saldo autoritativo vindo do ERP (a baixa do checkout e o
// sync via /admin/erp/status). É best-effort e por SKU: um SKU que não exista no
// catálogo do site simplesmente não atualiza nenhuma linha (0 rows), sem erro.
// `itens`: [{ sku, quantidadeDisponivel }] — o formato que o mock retorna.
export async function setStockBySku(itens = []) {
  let updated = 0;
  for (const it of itens) {
    const sku = it && it.sku;
    const qtd = Number(it && it.quantidadeDisponivel);
    if (!sku || !Number.isFinite(qtd) || qtd < 0) continue;
    const { rowCount } = await query(
      `UPDATE products SET estoque = $2 WHERE sku = $1`,
      [sku, Math.trunc(qtd)],
    );
    updated += rowCount;
  }
  return updated;
}

export default {
  listProducts,
  getProductById,
  listCategories,
  listFeatured,
  cheapestByCategories,
  setStockBySku,
};
