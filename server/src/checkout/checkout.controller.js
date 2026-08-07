import * as service from './checkout.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { buildCustomerRef, getRequestContext } from '../http/context.js';

function identityOf(req) {
  const { deviceId, customerId } = getRequestContext(req);
  return {
    identity: { customerId, deviceId },
    ctx: { ref: buildCustomerRef(req), customerId },
  };
}

export const start = asyncHandler(async (req, res) => {
  const { identity, ctx } = identityOf(req);
  const review = await service.startCheckout(identity, ctx, req.body?.warranties);
  res.json({ review });
});

export const confirm = asyncHandler(async (req, res) => {
  const { identity, ctx } = identityOf(req);
  const order = await service.confirmOrder(identity, ctx, {
    warranties: req.body?.warranties,
    customer: req.body?.customer,
  });
  res.status(201).json({ order });
});

export default { start, confirm };
