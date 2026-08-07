import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// `pg` returns NUMERIC as strings by default (to preserve precision). Our money
// columns fit safely in a JS number, and the domain layer already rounds to
// cents, so parse them to numbers for ergonomic JSON responses.
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

let pool = null;

// The pool is created lazily on first use so that importing this module (and,
// transitively, the Express app) never opens a connection. This keeps
// `GET /health` and process start-up independent of database availability.
export function getPool() {
  if (pool) return pool;
  if (!config.databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Configure it in server/.env (see .env.example).',
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

// Runs `fn` inside a single transaction, passing it a dedicated client.
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
