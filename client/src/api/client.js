// Thin fetch wrapper. Attaches the anonymous device id and (when present) the
// bearer token to every request. API base is relative so the same build works
// behind the Vite dev proxy and when served by the Express server in prod.

import { mockApi } from './mock.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'techlar_token';
const DEVICE_KEY = 'techlar_device_id';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Stable per-browser device id for anonymous carts / identity signals.
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
      `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function buildQuery(params = {}) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'x-device-id': getDeviceId() };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const httpApi = {
  // Catalog
  getProducts: (params) => request(`/catalog/products${buildQuery(params)}`),
  getFeatured: () => request('/catalog/products/featured'),
  getProduct: (id) => request(`/catalog/products/${id}`),
  getCategories: () => request('/catalog/categories'),

  // Cart
  getCart: () => request('/cart'),
  addToCart: (product_id, qty = 1) => request('/cart/items', { method: 'POST', body: { product_id, qty } }),
  updateCartItem: (productId, qty) => request(`/cart/items/${productId}`, { method: 'PATCH', body: { qty } }),
  removeCartItem: (productId) => request(`/cart/items/${productId}`, { method: 'DELETE' }),

  // Auth + profile
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  me: () => request('/customers/me'),
  updateProfile: (data) => request('/customers/me', { method: 'PATCH', body: data }),

  // Checkout
  startCheckout: (warranties) => request('/checkout/start', { method: 'POST', body: { warranties } }),
  confirmCheckout: (payload) => request('/checkout/confirm', { method: 'POST', body: payload }),

  // Orders
  getOrders: () => request('/orders'),
  getOrder: (orderNumber) => request(`/orders/${orderNumber}`),

  // Wishlist
  getWishlist: () => request('/wishlist'),
  addWishlist: (product_id) => request('/wishlist', { method: 'POST', body: { product_id } }),
  removeWishlist: (productId) => request(`/wishlist/${productId}`, { method: 'DELETE' }),
};

// Modo de demonstração: com VITE_MOCK=1 (`npm run dev:mock`) a loja roda inteira
// no browser, sem servidor nem Postgres. __TECHLAR_MOCK__ é constante de build
// (vite.config.js), então em produção isto é `false` e o mock não entra no
// bundle. O aviso no console existe para ninguém abrir bug contra preço inventado.
const useMock = __TECHLAR_MOCK__;
if (useMock) {
  console.info('[TechLar] VITE_MOCK=1: catálogo, conta e pedidos são dados falsos, só no browser.');
}

export const api = useMock ? mockApi : httpApi;

export default api;
