import * as service from './cart.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { buildCustomerRef, getRequestContext } from '../http/context.js';

function identityOf(req) {
  const { deviceId, customerId } = getRequestContext(req);
  return {
    identity: { customerId, deviceId },
    ctx: { ref: buildCustomerRef(req), customerId },
  };
}

export const getCart = asyncHandler(async (req, res) => {
  const { identity } = identityOf(req);
  const view = await service.getCart(identity);
  res.json({ cart: view });
});

export const addItem = asyncHandler(async (req, res) => {
  const { identity, ctx } = identityOf(req);
  const { product_id, qty } = req.body || {};
  if (product_id === undefined) {
    return res.status(400).json({ error: 'product_id is required' });
  }
  const view = await service.addItem(identity, ctx, product_id, qty);
  res.status(201).json({ cart: view });
});

export const updateItem = asyncHandler(async (req, res) => {
  const { identity, ctx } = identityOf(req);
  const view = await service.updateItem(identity, ctx, req.params.productId, req.body?.qty);
  res.json({ cart: view });
});

export const removeItem = asyncHandler(async (req, res) => {
  const { identity, ctx } = identityOf(req);
  const view = await service.removeItem(identity, ctx, req.params.productId);
  res.json({ cart: view });
});

export default { getCart, addItem, updateItem, removeItem };
