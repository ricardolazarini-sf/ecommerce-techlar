import { query } from '../db/index.js';

// Combos ativos, com cache curto em memória: a regra é avaliada em toda leitura
// de carrinho e em todo checkout, e são três linhas que quase nunca mudam.

const CACHE_TTL_MS = 60_000;
let cache = { at: 0, rows: null };

export function clearCombosCache() {
  cache = { at: 0, rows: null };
}

export async function listActiveCombos() {
  if (cache.rows && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  const { rows } = await query(
    `SELECT slug, nome, regra, descricao, percent::float AS percent, categorias, imagem_url, ativo
       FROM combos
      WHERE ativo
      ORDER BY percent ASC`,
  );
  cache = { at: Date.now(), rows };
  return rows;
}

export async function findComboBySlug(slug) {
  const combos = await listActiveCombos();
  return combos.find((c) => c.slug === slug) || null;
}

export default { listActiveCombos, findComboBySlug, clearCombosCache };
