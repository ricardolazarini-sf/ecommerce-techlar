import * as repo from './cart.repository.js';
import * as catalogRepo from '../catalog/catalog.repository.js';
import * as combosRepo from '../catalog/combos.repository.js';
import { computeCartTotals, computeLineTotals, normalizeQty } from './cart.logic.js';
import { config } from '../config/index.js';
import { events } from '../events/index.js';

const warrantyRate = () => config.warrantyRate;

function toEventItems(items) {
  return items.map((i) => ({
    product_id: i.product_id,
    qty: Number(i.qty),
    unit_price: Number(i.unit_price),
  }));
}

// A garantia não é lida aqui: o carrinho persistido não guarda a escolha, então
// a view devolve a base garantível e a taxa, e a caixa do carrinho mostra o
// valor. Quem decide de verdade é o checkout, com o booleano no corpo.
async function buildView(cart) {
  const [rows, combos] = await Promise.all([
    repo.getItemsWithProduct(cart.id),
    combosRepo.listActiveCombos(),
  ]);
  const totals = computeCartTotals(rows, { warrantyRate: warrantyRate(), combos });
  const items = rows.map((i) => ({
    product_id: i.product_id,
    sku: i.sku,
    nome: i.nome,
    categoria: i.categoria,
    imagem_url: i.imagem_url,
    qty: Number(i.qty),
    unit_price: Number(i.unit_price),
    line_total: computeLineTotals(i).lineTotal,
    in_combo: totals.discountedProductIds.includes(i.product_id),
  }));
  return {
    cart_id: cart.id,
    status: cart.status,
    items,
    warrantyRate: warrantyRate(),
    ...totals,
  };
}

function emitCartUpdated(view, action, ref, customerId) {
  events.cartUpdated(
    ref,
    {
      action,
      items: toEventItems(view.items),
      subtotal: view.subtotal,
      item_count: view.itemCount,
    },
    { customerId },
  );
}

export async function getCart(identity) {
  const cart = await repo.getOrCreateOpenCart(identity);
  return buildView(cart);
}

export async function addItem(identity, { ref, customerId }, productId, qtyInput) {
  const qty = normalizeQty(qtyInput ?? 1) || 1;
  const product = await catalogRepo.getProductById(Number(productId));
  if (!product) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  const cart = await repo.getOrCreateOpenCart(identity);
  await repo.addOrIncrementItem(cart.id, product, qty);
  const view = await buildView(cart);
  emitCartUpdated(view, 'add', ref, customerId);
  return view;
}

export async function updateItem(identity, { ref, customerId }, productId, qtyInput) {
  const qty = normalizeQty(qtyInput);
  const cart = await repo.getOrCreateOpenCart(identity);
  await repo.setItemQty(cart.id, Number(productId), qty);
  const view = await buildView(cart);
  emitCartUpdated(view, qty <= 0 ? 'remove' : 'update', ref, customerId);
  return view;
}

export async function removeItem(identity, { ref, customerId }, productId) {
  const cart = await repo.getOrCreateOpenCart(identity);
  await repo.removeItem(cart.id, Number(productId));
  const view = await buildView(cart);
  emitCartUpdated(view, 'remove', ref, customerId);
  return view;
}

export { buildView };
export default { getCart, addItem, updateItem, removeItem };
