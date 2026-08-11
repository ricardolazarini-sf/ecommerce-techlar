import * as service from './catalog.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { buildCustomerRef, getRequestContext } from '../http/context.js';

export const listProducts = asyncHandler(async (req, res) => {
  const products = await service.getProducts({
    q: req.query.q?.trim() || undefined,
    categoria: req.query.categoria?.trim() || undefined,
    combo: req.query.combo?.trim() || undefined,
  });
  res.json({ products });
});

export const listCombos = asyncHandler(async (_req, res) => {
  const combos = await service.getCombos();
  res.json({ combos });
});

export const listCategories = asyncHandler(async (_req, res) => {
  const categories = await service.getCategories();
  res.json({ categories });
});

export const listFeatured = asyncHandler(async (_req, res) => {
  const products = await service.getFeatured();
  res.json({ products });
});

export const getProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid product id' });
  }
  const { customerId } = getRequestContext(req);
  const product = await service.getProduct(id, {
    ref: buildCustomerRef(req),
    customerId,
  });
  res.json({ product });
});

export default { listProducts, listCategories, listFeatured, listCombos, getProduct };
