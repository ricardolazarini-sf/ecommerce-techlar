import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import { warrantyFee } from '../lib/format.js';
import { track } from '../lib/track.js';

const CartContext = createContext(null);

// A garantia estendida é uma decisão da COMPRA: um booleano, não um mapa por
// produto. A chave antiga é apagada na primeira carga para não deixar lixo no
// navegador de quem já usou o site.
const WARRANTY_KEY = 'techlar_warranty';
const LEGACY_WARRANTY_KEY = 'techlar_warranties';

const EMPTY_CART = {
  cart_id: null,
  items: [],
  subtotal: 0,
  total: 0,
  discountTotal: 0,
  combo: null,
  warrantyBase: 0,
  warrantyAvailable: false,
  warrantyTotal: 0,
  itemCount: 0,
};

function loadWarranty() {
  try {
    localStorage.removeItem(LEGACY_WARRANTY_KEY);
    return localStorage.getItem(WARRANTY_KEY) === '1';
  } catch {
    return false;
  }
}

export function CartProvider({ children }) {
  const { token } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(true);
  // A escolha vive no cliente (cart_items não tem coluna de garantia) e é
  // enviada no checkout, onde os totais passam a ser autoritativos.
  const [warranty, setWarrantyState] = useState(loadWarranty);

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
    try {
      localStorage.setItem(WARRANTY_KEY, warranty ? '1' : '0');
    } catch {
      // Navegador sem storage: a escolha vale só para esta sessão.
    }
  }, [warranty]);

  // `combo_qualified` é o meio do caminho entre clicar no anúncio e pagar, e só
  // vale na VIRADA: enquanto o combo continuar o mesmo, cada releitura do
  // carrinho repetiria o evento e inflaria o funil.
  //
  // A lembrança fica na sessão, e não só em memória, porque recarregar a página
  // (ou abrir o site em outra aba) monta o contexto de novo e o carrinho já
  // chega qualificado — sem isto, cada F5 no carrinho contaria uma qualificação
  // nova.
  const COMBO_SEEN_KEY = 'techlar_combo_seen';
  const lastCombo = useRef(null);
  useEffect(() => {
    // Enquanto o carrinho não voltou do servidor ele parece vazio, e apagar a
    // lembrança aqui faria cada recarga de página emitir a qualificação de novo.
    if (loading) return;
    const slug = cart.combo?.slug || null;
    let seen = lastCombo.current;
    try {
      seen = seen ?? sessionStorage.getItem(COMBO_SEEN_KEY);
    } catch {
      // Sem storage: a memória da aba basta.
    }
    if (slug && slug !== seen) {
      track('combo_qualified', {
        combo_id: slug,
        discount: cart.discountTotal,
        subtotal: cart.subtotal,
        item_count: cart.itemCount,
      });
    }
    lastCombo.current = slug;
    try {
      if (slug) sessionStorage.setItem(COMBO_SEEN_KEY, slug);
      else sessionStorage.removeItem(COMBO_SEEN_KEY);
    } catch {
      // Idem.
    }
  }, [loading, cart.combo?.slug, cart.discountTotal, cart.subtotal, cart.itemCount]);

  // Os eventos de carrinho são emitidos AQUI, e não em cada tela: assim nenhum
  // caminho de "adicionar" escapa da medição, e o evento sai com o produto que o
  // servidor devolveu — nome, categoria e preço de verdade, não o que a tela
  // achava que tinha em mãos. `surface` é a única coisa que a tela informa,
  // porque é a única que ela sabe melhor que o servidor.
  const addItem = useCallback(async (productId, qty = 1, { surface = '' } = {}) => {
    const data = await api.addToCart(productId, qty);
    setCart(data.cart);
    const item = data.cart.items.find((i) => i.product_id === Number(productId));
    track('cart_item_added', {
      product_id: productId,
      sku: item?.sku,
      nome: item?.nome,
      categoria: item?.categoria,
      preco: item?.unit_price,
      qty,
      surface,
    });
    return data.cart;
  }, []);

  const updateItem = useCallback(async (productId, qty) => {
    const data = await api.updateCartItem(productId, qty);
    setCart(data.cart);
    return data.cart;
  }, []);

  // O produto é lido antes da remoção: depois dela a linha não existe mais, e um
  // evento de abandono sem SKU não serve para nada.
  const removeItem = useCallback(async (productId, { surface = 'carrinho' } = {}) => {
    const removed = cart.items.find((i) => i.product_id === Number(productId));
    const data = await api.removeCartItem(productId);
    setCart(data.cart);
    track('cart_item_removed', {
      product_id: productId,
      sku: removed?.sku,
      nome: removed?.nome,
      categoria: removed?.categoria,
      preco: removed?.unit_price,
      qty: removed?.qty,
      surface,
    });
    return data.cart;
  }, [cart.items]);

  const setWarranty = useCallback(
    (on) => {
      const next = Boolean(on);
      setWarrantyState(next);
      // O clique que hoje se perde: sem isto, só quem COMPRA a garantia aparece,
      // e quem considerou e desmarcou é invisível.
      track('warranty_toggled', {
        action: next ? 'on' : 'off',
        subtotal: cart.warrantyBase,
        total: next ? warrantyFee(cart.warrantyBase, cart.warrantyRate) : 0,
      });
    },
    [cart.warrantyBase, cart.warrantyRate],
  );

  const resetAfterCheckout = useCallback(() => {
    setCart(EMPTY_CART);
    setWarrantyState(false);
    refresh();
  }, [refresh]);

  // O servidor decide se a garantia se aplica: carrinho todo em combo ou só de
  // serviços não tem base para medir, e aí a escolha guardada não vale.
  const warrantyOn = warranty && Boolean(cart.warrantyAvailable);
  const warrantyTotal = warrantyOn ? warrantyFee(cart.warrantyBase, cart.warrantyRate) : 0;

  const value = {
    cart,
    loading,
    warranty,
    warrantyOn,
    warrantyTotal,
    total: Math.round((Number(cart.subtotal || 0) - Number(cart.discountTotal || 0) + warrantyTotal) * 100) / 100,
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
