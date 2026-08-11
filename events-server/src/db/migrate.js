import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from './index.js';
import { logger } from '../utils/logger.js';

// Runner de migration próprio, mesmo desenho do servidor transacional: aplica
// cada *.sql de ./migrations uma vez só, em ordem de nome, cada um na sua
// transação, marcando o que já rodou em `schema_migrations`. As migrations do
// engajamento moram aqui porque o banco é outro.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function readMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export async function migrate() {
  const pool = getPool();
  const client = await pool.connect();
  const applied = [];
  try {
    await ensureMigrationsTable(client);
    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const done = new Set(rows.map((r) => r.filename));

    for (const filename of readMigrationFiles()) {
      if (done.has(filename)) {
        logger.info('migrate.skip', { filename });
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        applied.push(filename);
        logger.info('migrate.applied', { filename });
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('migrate.failed', { filename, err: err.message });
        throw err;
      }
    }
  } finally {
    client.release();
  }
  return applied;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then((applied) => {
      logger.info('migrate.done', { count: applied.length, applied });
      return closePool();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('migrate.error', { err: err.message });
      process.exit(1);
    });
}
