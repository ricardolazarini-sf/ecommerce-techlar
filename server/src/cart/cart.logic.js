// Pure cart pricing logic — no I/O, fully unit-testable.
//
// Money is handled in BRL and rounded to cents. Two things ride on top of the
// subtotal, and the order of the accounts matters:
//
//   subtotal  → desconto do combo → garantia estendida → total
//
// A garantia estendida (seção 5) é UMA escolha da compra, não de cada item:
// `warrantyRate` × a base garantível do pedido. A base é o subtotal menos o que
// não pode ser garantido — linhas de serviço e linhas cobertas por um combo,
// porque produto com desconto não leva garantia estendida. Carrinho inteiramente
// em combo, portanto, não tem garantia a oferecer.
//
// O carrinho persistido (cart_items) não guarda garantia nem desconto: a regra
// do combo é avaliada a cada leitura, então o desconto nunca fica velho no
// carrinho de alguém.

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Serviço não recebe garantia estendida. O catálogo marca serviço pela
// categoria; o SKU com prefixo SVC- é a convenção da org para o mesmo caso.
export function isServiceItem(item) {
  const sku = String(item?.sku || '').toUpperCase();
  return item?.categoria === 'servicos' || sku.startsWith('SVC-');
}

export function computeLineTotals(item) {
  const qty = Number(item?.qty) || 0;
  const unitPrice = Number(item?.unit_price) || 0;
  const productTotal = round2(unitPrice * qty);
  return { productTotal, lineTotal: productTotal };
}

// Um combo é uma regra sobre categorias, não uma lista fixa de SKU: o carrinho
// qualifica quando tem pelo menos um item de CADA categoria da regra, e o
// desconto incide sobre as linhas dessas categorias.
//
// Escolhe o combo que economiza mais (não o de maior percentual: 12% de um
// carrinho pequeno pode valer menos que 8% de um grande), e devolve as linhas
// cobertas, que é o que a garantia precisa saber para tirar da sua base.
export function applyCombo(items = [], combos = []) {
  const empty = { combo: null, discountTotal: 0, discountedProductIds: new Set() };
  if (!Array.isArray(items) || !items.length || !Array.isArray(combos) || !combos.length) {
    return empty;
  }

  let best = empty;
  for (const combo of combos) {
    if (combo?.ativo === false) continue;
    const categorias = Array.isArray(combo?.categorias) ? combo.categorias : [];
    if (!categorias.length) continue;

    const covered = items.filter((i) => categorias.includes(i?.categoria));
    const satisfied = categorias.every((cat) => items.some((i) => i?.categoria === cat));
    if (!satisfied) continue;

    const coveredTotal = covered.reduce(
      (sum, i) => round2(sum + computeLineTotals(i).productTotal),
      0,
    );
    const discountTotal = round2(coveredTotal * (Number(combo.percent) || 0) / 100);
    if (discountTotal <= best.discountTotal) continue;

    best = {
      combo: { slug: combo.slug, nome: combo.nome, percent: Number(combo.percent) || 0 },
      discountTotal,
      discountedProductIds: new Set(covered.map((i) => i.product_id)),
    };
  }
  return best;
}

// Aggregates a list of items into cart/order totals.
//   subtotal          = soma das linhas de produto (sem desconto e sem garantia)
//   discountTotal     = desconto do melhor combo aplicável
//   warrantyBase      = subtotal menos serviços e menos linhas em combo
//   warrantyTotal     = warrantyRate × warrantyBase, se a garantia foi escolhida
//   total             = subtotal − desconto + garantia
export function computeCartTotals(
  items = [],
  { warrantyRate = 0.03, warranty = false, combos = [] } = {},
) {
  let subtotal = 0;
  let itemCount = 0;
  for (const item of items) {
    subtotal = round2(subtotal + computeLineTotals(item).productTotal);
    itemCount += Number(item?.qty) || 0;
  }

  const { combo, discountTotal, discountedProductIds } = applyCombo(items, combos);

  let warrantyBase = 0;
  for (const item of items) {
    if (isServiceItem(item)) continue;
    if (discountedProductIds.has(item?.product_id)) continue;
    warrantyBase = round2(warrantyBase + computeLineTotals(item).productTotal);
  }

  const warrantyAvailable = warrantyBase > 0;
  const warrantyOn = Boolean(warranty) && warrantyAvailable;
  const warrantyTotal = warrantyOn ? round2(warrantyBase * warrantyRate) : 0;

  return {
    subtotal,
    discountTotal,
    combo,
    // Quais linhas o combo cobriu — é o que a interface usa para marcar a linha
    // em promoção e explicar por que ela ficou fora da garantia.
    discountedProductIds: [...discountedProductIds],
    warranty: warrantyOn,
    warrantyAvailable,
    warrantyBase,
    warrantyTotal,
    total: round2(subtotal - discountTotal + warrantyTotal),
    itemCount,
  };
}

// Normalizes a qty coming from an untrusted source (request body): a positive
// integer, or 0 to signal removal. Missing / non-numeric / negative values throw.
export function normalizeQty(value) {
  if (value === null || value === undefined || value === '') {
    const err = new Error('Quantidade inválida.');
    err.status = 400;
    throw err;
  }
  const qty = Number(value);
  if (!Number.isInteger(qty) || qty < 0) {
    const err = new Error('Quantidade inválida.');
    err.status = 400;
    throw err;
  }
  return qty;
}

export default {
  round2,
  isServiceItem,
  computeLineTotals,
  applyCombo,
  computeCartTotals,
  normalizeQty,
};
