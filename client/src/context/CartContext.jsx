import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

const WARRANTY_KEY = 'techlar_warranties';
const EMPTY_CART = { cart_id: null, items: [], subtotal: 0, total: 0, warrantyTotal: 0, itemCount: 0 };

function loadWarranties() {
  try {
    return JSON.parse(localStorage.getItem(WARRANTY_KEY)) || {};
  } catch {
    return {};
  }
}

export function CartProvider({ children }) {
  const { token } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(true);
  // Warranty selection lives client-side (cart_items has no warranty column);
  // it is submitted at checkout. Keyed by product_id.
  const [warranties, setWarranties] = useState(loadWarranties);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCart();
      setCart(data.cart);
    } catch {
      setCart(EMPTY_CART);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when auth changes: the server merges the anonymous cart into the
  // customer's cart on login/register.
  useEffect(() => {
    refresh();
  }, [refresh, token]);

  useEffect(() => {
    localStorage.setItem(WARRANTY_KEY, JSON.stringify(warranties));
  }, [warranties]);

  const addItem = useCallback(async (productId, qty = 1, warranty = false) => {
    const data = await api.addToCart(productId, qty);
    setCart(data.cart);
    if (warranty) setWarranties((w) => ({ ...w, [productId]: true }));
    return data.cart;
  }, []);

  const updateItem = useCallback(async (productId, qty) => {
    const data = await api.updateCartItem(productId, qty);
    setCart(data.cart);
    return data.cart;
  }, []);

  const removeItem = useCallback(async (productId) => {
    const data = await api.removeCartItem(productId);
    setCart(data.cart);
    setWarranties((w) => {
      const next = { ...w };
      delete next[productId];
      return next;
    });
    return data.cart;
  }, []);

  const setWarranty = useCallback((productId, on) => {
    setWarranties((w) => ({ ...w, [productId]: Boolean(on) }));
  }, []);

  const resetAfterCheckout = useCallback(() => {
    setCart(EMPTY_CART);
    setWarranties({});
    refresh();
  }, [refresh]);

  const value = {
    cart,
    loading,
    warranties,
    refresh,
    addItem,
    updateItem,
    removeItem,
    setWarranty,
    resetAfterCheckout,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
