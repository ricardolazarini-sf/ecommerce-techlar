// Reconcilia o espelho de estoque do banco com o ERP (a autoridade).
//
// Lê GET /admin/erp/status no ERP mock e grava products.estoque no banco do
// site. Útil antes de uma demo, ou depois de um POST /admin/erp/reset (que volta
// o ERP ao seed). No-op se ERP_ENABLED=false.
//
// Uso (precisa de DATABASE_URL, ERP_ENABLED=true e ERP_BASE_URL):
//   npm run sync:estoque                 (na raiz)  ou
//   node scripts/sync-estoque.mjs        (dentro de /server)
//
// No Render: Web Service > Shell > `npm run sync:estoque`.
// É idempotente: pode rodar quantas vezes quiser.

import { getPool, closePool } from '../src/db/index.js';
import { syncStockFromErp } from '../src/integration/erp/erpSync.js';
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

async function run() {
  if (!config.erp.enabled) {
    console.log('ERP_ENABLED=false — nada a sincronizar (o estoque fica no valor do banco).');
    return { synced: 0, skus: 0, skipped: true };
  }
  getPool(); // valida DATABASE_URL cedo (erro claro se faltar)
  return syncStockFromErp();
}

run()
  .then((r) => {
    if (!r.skipped) {
      console.log(`OK — ${r.skus} SKU(s) lido(s) do ERP; ${r.synced} linha(s) atualizada(s) no banco.`);
    }
    return closePool();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('sync-estoque.error', { err: err.message });
    console.error('Falhou:', err.message);
    process.exit(1);
  });
