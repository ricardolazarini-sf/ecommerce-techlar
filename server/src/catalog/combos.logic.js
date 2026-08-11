import { round2 } from '../cart/cart.logic.js';

// Pure logic do anúncio do combo — sem I/O, testável.
//
// O "a partir de" é o menor conjunto que qualifica a regra: o produto mais
// barato de cada categoria, calculado do catálogo real e não escrito à mão, para
// o card nunca prometer um preço que o catálogo não tem. Combo cuja regra o
// catálogo não consegue satisfazer não é anunciado.
export function buildComboOffers(combos = [], cheapestByCategory = []) {
  const byCategory = new Map(cheapestByCategory.map((p) => [p.categoria, p]));

  return combos
    .map((combo) => {
      const categorias = Array.isArray(combo?.categorias) ? combo.categorias : [];
      const produtos = categorias.map((cat) => byCategory.get(cat)).filter(Boolean);
      if (!categorias.length || produtos.length !== categorias.length) return null;

      const percent = Number(combo.percent) || 0;
      const from = produtos.reduce((sum, p) => round2(sum + Number(p.preco)), 0);
      const saving = round2((from * percent) / 100);
      return {
        ...combo,
        percent,
        produtos,
        from,
        from_discounted: round2(from - saving),
        saving,
      };
    })
    .filter(Boolean);
}

export default { buildComboOffers };
