// Extracts the ambient request context used for event emission and cart
// resolution: the anonymous device id and (when authenticated) the customer.

export function getDeviceId(req) {
  return (
    req.get('x-device-id') ||
    req.body?.device_id ||
    req.query?.device_id ||
    null
  );
}

// Builds the canonical customer_ref for events from whatever is known on the
// request. For anonymous traffic this is usually just the device_id.
export function buildCustomerRef(req, customer = null) {
  const user = customer || req.user || null;
  return {
    email: user?.email ?? null,
    phone: user?.telefone ?? null,
    document: user?.documento ?? null,
    device_id: getDeviceId(req),
  };
}

export function getRequestContext(req) {
  return {
    deviceId: getDeviceId(req),
    customer: req.user || null,
    customerId: req.user?.id ?? null,
  };
}

export default { getDeviceId, buildCustomerRef, getRequestContext };
