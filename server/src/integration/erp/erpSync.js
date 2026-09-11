// Sincroniza o espelho de estoque do banco a partir do ERP (a autoridade).
//
// O saldo real vive no ERP mock, em memória — some quando o dyno reinicia
// (deploy/hibernação), voltando ao seed. A coluna products.estoque é um espelho
// para a vitrine; este sync a reconcilia com o ERP: lê GET /admin/erp/status e
// grava cada SKU no banco. Rode antes de uma demo, ou depois de um
// POST /admin/erp/reset. No-op quando ERP_ENABLED=false.

import * as erp from './erpClient.js';
import * as productsRepo from '../../catalog/catalog.repository.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// Retorna { synced, skus } (linhas atualizadas no banco) ou { synced: 0,
// skipped: true } quando o ERP está desligado. Propaga ErpUnavailableError se o
// ERP não responder — quem chama decide se ignora (boot) ou falha (script CLI).
export async function syncStockFromErp() {
  if (!config.erp.enabled) {
    return { synced: 0, skus: 0, skipped: true };
  }
  const snapshot = await erp.fetchStockSnapshot();
  if (!snapshot || !snapshot.length) {
    return { synced: 0, skus: 0 };
  }
  const updated = await productsRepo.setStockBySku(snapshot);
  logger.info('erp.stock_synced', { skus: snapshot.length, updated });
  return { synced: updated, skus: snapshot.length };
}

export default { syncStockFromErp };
