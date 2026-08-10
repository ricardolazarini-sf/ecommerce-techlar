// Carrega o catálogo da org (Price Book) no banco do site e limpa cadastros de
// teste, SEM apagar tudo com o seed completo. Faz duas coisas, numa transação:
//
//   1) SUBSTITUI o catálogo: zera dados transacionais que referenciam produtos
//      (order_items, orders, cart_items, carts, wishlist_items), apaga os
//      produtos antigos e insere os 7 produtos da org (fonte: src/db/products.js).
//   2) REMOVE só os cadastros REAIS (password_hash IS NOT NULL), preservando os
//      clientes de variância do seed (sem senha) e o login demo@techlar.com.
//
// Uso (precisa de DATABASE_URL apontando para o Postgres do site):
//   npm run load:catalog                 (na raiz)  ou
//   node scripts/load-org-catalog.mjs    (dentro de /server)
//
// No Render: Web Service > Shell > `npm run load:catalog`.
// É idempotente: pode rodar quantas vezes quiser.

import { getPool, withTransaction, closePool } from '../src/db/index.js';
import { logger } from '../src/utils/logger.js';
import { ORG_PRODUCTS, imageFor } from '../src/db/products.js';

const KEEP_DEMO_EMAIL = 'demo@techlar.com';

async function run() {
  getPool(); // valida DATABASE_URL cedo (erro claro se faltar)

  const summary = await withTransaction(async (client) => {
    // 1) Zera dados transacionais que travam a troca de produtos.
    await client.query('DELETE FROM order_items');
    await client.query('DELETE FROM orders');
    await client.query('DELETE FROM cart_items');
    await client.query('DELETE FROM carts');
    await client.query('DELETE FROM wishlist_items');

    // Substitui o catálogo. Upsert por SKU garante idempotência mesmo se algum
    // produto sobreviver a um estado inconsistente.
    await client.query('DELETE FROM products');
    for (const p of ORG_PRODUCTS) {
      await client.query(
        `INSERT INTO products (sku, nome, categoria, preco, descricao, imagem_url)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (sku) DO UPDATE SET
           nome = EXCLUDED.nome,
           categoria = EXCLUDED.categoria,
           preco = EXCLUDED.preco,
           descricao = EXCLUDED.descricao,
           imagem_url = EXCLUDED.imagem_url`,
        [p.sku, p.nome, p.categoria, p.preco, p.descricao, p.imagem_url || imageFor(p.sku)],
      );
    }

    // 2) Remove só os cadastros REAIS (têm senha), menos o login demo.
    const { rowCount: removed } = await client.query(
      `DELETE FROM customers
        WHERE password_hash IS NOT NULL AND lower(email) <> lower($1)`,
      [KEEP_DEMO_EMAIL],
    );

    const { rows: countRows } = await client.query('SELECT count(*)::int AS n FROM customers');

    return {
      products: ORG_PRODUCTS.length,
      customersRemoved: removed,
      customersRemaining: countRows[0].n,
    };
  });

  logger.info('load-catalog.done', summary);
  return summary;
}

run()
  .then((summary) => {
    // Também imprime legível no stdout do Render.
    console.log(
      `OK — ${summary.products} produtos carregados; ` +
        `${summary.customersRemoved} cadastro(s) real(is) removido(s); ` +
        `${summary.customersRemaining} cliente(s) restante(s).`,
    );
    return closePool();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('load-catalog.error', { err: err.message });
    console.error('Falhou:', err.message);
    process.exit(1);
  });
