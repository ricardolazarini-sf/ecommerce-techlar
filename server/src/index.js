import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { closePool } from './db/index.js';
import { syncStockFromErp } from './integration/erp/erpSync.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('server.listening', {
    port: config.port,
    env: config.env,
    events_sink: config.events.sink,
    db_configured: Boolean(config.databaseUrl),
  });

  // Reconcilia o espelho de estoque com o ERP no boot (best-effort): após um
  // deploy/restart o mock volta ao seed, então realinhamos o banco. Nunca
  // bloqueia o start nem derruba o processo — no-op quando ERP_ENABLED=false.
  syncStockFromErp()
    .then((r) => {
      if (r && !r.skipped) logger.info('server.stock_sync_on_boot', r);
    })
    .catch((err) => logger.warn('server.stock_sync_on_boot_failed', { err: err.message }));
});

async function shutdown(signal) {
  logger.info('server.shutdown', { signal });
  server.close(async () => {
    try {
      await closePool();
    } catch (err) {
      logger.error('server.shutdown_error', { err: err.message });
    }
    process.exit(0);
  });
  // Force-exit if connections do not drain in time.
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
