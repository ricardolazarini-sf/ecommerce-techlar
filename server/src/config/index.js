import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load server/.env when present. Kept side-effect-light so importing config
// never touches the database or any network resource.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const float = (value, fallback) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 3001),
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  databaseUrl: process.env.DATABASE_URL || '',
  pgSsl: bool(process.env.PGSSL, false),

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Garantia estendida do PEDIDO: 3% sobre a base garantível (subtotal menos
  // serviços e menos linhas em promoção), e não 15% por item como antes.
  warrantyRate: float(process.env.WARRANTY_RATE, 0.03),

  events: {
    sink: (process.env.EVENTS_SINK || 'console').toLowerCase(),
    persistLocal: bool(process.env.EVENTS_PERSIST_LOCAL, true),
    filePath: process.env.EVENTS_FILE_PATH || './events.log',
    dataCloud: {
      url: process.env.DATACLOUD_INGESTION_URL || '',
      connector: process.env.DATACLOUD_CONNECTOR || '',
      token: process.env.DATACLOUD_TOKEN || '',
      object: process.env.DATACLOUD_OBJECT || 'ecommerce_events',
      maxRetries: int(process.env.DATACLOUD_MAX_RETRIES, 3),
      retryBaseMs: int(process.env.DATACLOUD_RETRY_BASE_MS, 300),
    },
  },

  isProduction() {
    return this.env === 'production';
  },
};

export default config;
