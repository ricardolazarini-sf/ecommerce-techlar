import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { closePool } from './db/index.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('server.listening', {
    port: config.port,
    env: config.env,
    events_sink: config.events.sink,
    db_configured: Boolean(config.databaseUrl),
  });
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
