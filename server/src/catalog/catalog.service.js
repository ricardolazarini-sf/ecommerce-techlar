import * as repo from './catalog.repository.js';
import * as combosRepo from './combos.repository.js';
import { buildComboOffers } from './combos.logic.js';
import { events } from '../events/index.js';

// `combo` filtra pelas categorias da regra; `categoria` continua valendo sozinho.
export async function getProducts({ q, categoria, combo } = {}) {
  let categorias;
  if (combo) {
    const found = await combosRepo.findComboBySlug(combo);
    if (!found) {
      const err = new Error('Combo não encontrado.');
      err.status = 404;
      throw err;
    }
    categorias = found.categorias;
  }
  return repo.listProducts({ q, categoria, categorias });
}

export function getCategories() {
  return repo.listCategories();
}

export function getFeatured() {
  return repo.listFeatured(8);
}

export async function getCombos() {
  const combos = await combosRepo.listActiveCombos();
  const categorias = [...new Set(combos.flatMap((c) => c.categorias))];
  const cheapest = await repo.cheapestByCategories(categorias);
  return buildComboOffers(combos, cheapest);
}

export async function getProduct(id, { ref = null, customerId = null } = {}) {
  const product = await repo.getProductById(id);
  if (!product) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  // Fire-and-forget: emitting a product_viewed event must not slow or break the
  // response. `events.*` never rejects (failures are swallowed internally).
  if (ref) {
    events.productViewed(ref, product, { customerId });
  }
  return product;
}

export default { getProducts, getCategories, getFeatured, getCombos, getProduct };
