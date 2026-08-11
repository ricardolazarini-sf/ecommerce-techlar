import { randomUUID } from 'node:crypto';

// Pure builders for the canonical event envelope (section 8):
//   { event_type, event_id, occurred_at, customer_ref{email,phone,document,device_id}, payload }
// Keeping these pure (no I/O) makes the emitted shape trivially testable.

export function normalizeCustomerRef(ref = {}) {
  return {
    email: ref.email ?? null,
    phone: ref.phone ?? ref.telefone ?? null,
    document: ref.document ?? ref.documento ?? null,
    device_id: ref.device_id ?? ref.deviceId ?? null,
  };
}

export function buildEvent(eventType, customerRef, payload = {}, occurredAt) {
  return {
    event_type: eventType,
    event_id: randomUUID(),
    occurred_at: occurredAt || new Date().toISOString(),
    customer_ref: normalizeCustomerRef(customerRef),
    payload,
  };
}

export const buildIdentifyEvent = (ref, { reason } = {}) =>
  buildEvent('identify', ref, { reason: reason || 'identify' });

export const buildProductViewedEvent = (ref, product) =>
  buildEvent('product_viewed', ref, {
    product_id: product.id,
    sku: product.sku,
    nome: product.nome,
    categoria: product.categoria,
    preco: Number(product.preco),
  });

export const buildCartUpdatedEvent = (ref, { action, items, subtotal, item_count }) =>
  buildEvent('cart_updated', ref, {
    action,
    items,
    subtotal,
    item_count,
  });

export const buildCheckoutStartedEvent = (ref, { items, subtotal, total, item_count }) =>
  buildEvent('checkout_started', ref, { items, subtotal, total, item_count });

// A garantia e o desconto são do pedido: viajam no cabeçalho do evento, e o
// combo é o que fecha o funil clique → qualificado → pedido.
export const buildOrderPlacedEvent = (
  ref,
  { order_number, items, subtotal, total, status, warranty = false, warranty_total = 0, combo_id = '', discount = 0 },
) =>
  buildEvent('order_placed', ref, {
    order_number,
    items,
    subtotal,
    total,
    warranty,
    warranty_total,
    combo_id,
    discount,
    status,
  });

export default {
  normalizeCustomerRef,
  buildEvent,
  buildIdentifyEvent,
  buildProductViewedEvent,
  buildCartUpdatedEvent,
  buildCheckoutStartedEvent,
  buildOrderPlacedEvent,
};
