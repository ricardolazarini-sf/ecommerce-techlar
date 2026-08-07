import * as repo from './catalog.repository.js';
import { events } from '../events/index.js';

export function getProducts(filters) {
  return repo.listProducts(filters);
}

export function getCategories() {
  return repo.listCategories();
}

export function getFeatured() {
  return repo.listFeatured(8);
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

export default { getProducts, getCategories, getFeatured, getProduct };
