import { createApp } from './app.js';
import { config, missingDataCloudConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { closePool } from './db/index.js';
import { createFlusher } from './ingest/flusher.js';

const flusher = createFlusher();
const app = createApp({ flusher });

const server = app.listen(config.port, () => {
  logger.info('events.listening', {
    port: config.port,
    env: config.env,
    mode: flusher.mode,
    db_configured: Boolean(config.databaseUrl),
    datacloud_missing: missingDataCloudConfig(),
  });
});

if (config.flush.enabled) {
  flusher.start();
} else {
  logger.warn('flush.disabled', { hint: 'EVENTS_FLUSH_ENABLED=false — a fila só acumula.' });
}

async function shutdown(signal) {
  logger.info('events.shutdown', { signal });
  flusher.stop();
  server.close(async () => {
    try {
      await closePool();
    } catch (err) {
      logger.error('events.shutdown_error', { err: err.message });
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
