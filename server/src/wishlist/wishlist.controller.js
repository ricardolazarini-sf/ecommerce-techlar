import * as repo from './wishlist.repository.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const list = asyncHandler(async (req, res) => {
  const items = await repo.listByCustomer(req.user.id);
  res.json({ items });
});

export const add = asyncHandler(async (req, res) => {
  const productId = Number(req.body?.product_id);
  if (!Number.isInteger(productId)) {
    return res.status(400).json({ error: 'product_id is required' });
  }
  await repo.add(req.user.id, productId);
  const items = await repo.listByCustomer(req.user.id);
  res.status(201).json({ items });
});

export const remove = asyncHandler(async (req, res) => {
  await repo.remove(req.user.id, Number(req.params.productId));
  const items = await repo.listByCustomer(req.user.id);
  res.json({ items });
});

export default { list, add, remove };
