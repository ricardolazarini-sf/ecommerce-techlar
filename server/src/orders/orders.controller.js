import * as service from './orders.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const listMyOrders = asyncHandler(async (req, res) => {
  const orders = await service.getOrderHistory(req.user.id);
  res.json({ orders });
});

export const getMyOrder = asyncHandler(async (req, res) => {
  const order = await service.getMyOrder(req.user.id, req.params.orderNumber);
  res.json({ order });
});

export default { listMyOrders, getMyOrder };
