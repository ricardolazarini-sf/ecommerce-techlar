import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildComboOffers } from '../src/catalog/combos.logic.js';

// Preços reais do catálogo da org, para o "a partir de" ser conferível.
const CHEAPEST = [
  { id: 10, nome: 'MacBook Air M4', categoria: 'notebooks', preco: 10000 },
  { id: 8, nome: 'iPhone 17', categoria: 'smartphones', preco: 8608 },
  { id: 12, nome: 'Impressora 3D Premium', categoria: 'impressoras-3d', preco: 5500 },
];

const COMBOS = [
  { slug: 'mesa-de-trabalho', nome: 'Mesa de trabalho', percent: 8, categorias: ['notebooks', 'smartphones'] },
  { slug: 'casa-inteira', nome: 'Casa inteira', percent: 12, categorias: ['notebooks', 'smartphones', 'impressoras-3d'] },
];

test('o "a partir de" é o produto mais barato de cada categoria da regra', () => {
  const [mesa] = buildComboOffers(COMBOS, CHEAPEST);
  assert.equal(mesa.from, 18608); // 10000 + 8608
  assert.equal(mesa.saving, 1488.64);
  assert.equal(mesa.from_discounted, 17119.36);
  assert.deepEqual(
    mesa.produtos.map((p) => p.nome),
    ['MacBook Air M4', 'iPhone 17'],
  );
});

test('a ordem dos produtos segue a ordem da regra, que é a do card', () => {
  const [, casa] = buildComboOffers(COMBOS, CHEAPEST);
  assert.deepEqual(
    casa.produtos.map((p) => p.categoria),
    ['notebooks', 'smartphones', 'impressoras-3d'],
  );
  assert.equal(casa.from, 24108);
  assert.equal(casa.from_discounted, 21215.04);
});

test('combo que o catálogo não consegue satisfazer não é anunciado', () => {
  const offers = buildComboOffers(
    [{ slug: 'monitores-e-notebook', percent: 5, categorias: ['notebooks', 'monitores'] }],
    CHEAPEST,
  );
  assert.deepEqual(offers, []);
});

test('regra sem categorias é ignorada', () => {
  assert.deepEqual(buildComboOffers([{ slug: 'vazio', percent: 10 }], CHEAPEST), []);
  assert.deepEqual(buildComboOffers([], CHEAPEST), []);
});
