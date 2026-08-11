import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Pool próprio, apontando para EVENTS_DATABASE_URL — nenhuma tabela de
// engajamento vive no Postgres do site. Criado na primeira consulta, para
// importar este módulo (e subir o /health) não depender do banco.
let pool = null;

export function getPool() {
  if (pool) return pool;
  if (!config.databaseUrl) {
    throw new Error(
      'EVENTS_DATABASE_URL não está definida. Configure em events-server/.env (ver .env.example).',
    );
  }
  pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.pgSsl ? { rejectUnauthorized: false } : false,
    max: 10,
  });
  pool.on('error', (err) => {
    logger.error('pg.pool.error', { err: err.message });
  });
  logger.info('pg.pool.created');
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('pg.rollback.error', { err: rollbackErr.message });
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default { getPool, query, withTransaction, closePool };
