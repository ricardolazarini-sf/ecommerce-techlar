import * as repo from './orders.repository.js';

export function getOrderHistory(customerId) {
  return repo.listByCustomer(customerId);
}

export async function getMyOrder(customerId, orderNumber) {
  const order = await repo.findByCustomerAndNumber(customerId, orderNumber);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  return order;
}

export default { getOrderHistory, getMyOrder };
