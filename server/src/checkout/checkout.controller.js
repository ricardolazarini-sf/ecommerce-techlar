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

// `warranty` é um booleano da compra inteira. Corte limpo: o formato antigo
// (array ou mapa de product_id) não é mais aceito — o front é o único cliente.
export const start = asyncHandler(async (req, res) => {
  const { identity, ctx } = identityOf(req);
  const review = await service.startCheckout(identity, ctx, req.body?.warranty);
  res.json({ review });
});

export const confirm = asyncHandler(async (req, res) => {
  const { identity, ctx } = identityOf(req);
  const order = await service.confirmOrder(identity, ctx, {
    warranty: req.body?.warranty,
    customer: req.body?.customer,
  });
  res.status(201).json({ order });
});

export default { start, confirm };
