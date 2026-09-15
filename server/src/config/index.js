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

  // Token compartilhado das rotas /api/admin (baixo volume, operacional/demo).
  // Vazio (default) => as rotas admin respondem 404 (ficam "inexistentes"),
  // então nunca há endpoint sensível aberto sem um segredo configurado.
  admin: {
    token: process.env.ADMIN_TOKEN || '',
  },

  // Garantia estendida do PEDIDO: 3% sobre a base garantível (subtotal menos
  // serviços e menos linhas em promoção), e não 15% por item como antes.
  warrantyRate: float(process.env.WARRANTY_RATE, 0.03),

  // Integração com o ERP de estoque (mock externo). Desligada por padrão: com
  // ERP_ENABLED=false o checkout se comporta exatamente como antes (sem callout).
  // Quando ligada, o checkout valida saldo antes de confirmar e dá baixa depois.
  erp: {
    enabled: bool(process.env.ERP_ENABLED, false),
    baseUrl: (process.env.ERP_BASE_URL || '').replace(/\/+$/, ''),
    timeoutMs: int(process.env.ERP_TIMEOUT_MS, 8000),
  },

  // Espelho do pedido no CRM (Salesforce org) para a US7.1 (e-mail proativo de
  // status). Desligado por padrão: com ORG_MIRROR_ENABLED=false o checkout se
  // comporta exatamente como antes (sem callout). Quando ligado, após a compra
  // ser persistida o site espelha o pedido em Person/Business Account + Order na
  // org via Apex REST (EspelhoPedidoSiteService), reusando o JWT Bearer do Data
  // Cloud (SF_*). A auth (instanceUrl) vem de getOrgAccessToken(); aqui só o
  // liga/desliga e o timeout do callout.
  orgMirror: {
    enabled: bool(process.env.ORG_MIRROR_ENABLED, false),
    timeoutMs: int(process.env.ORG_MIRROR_TIMEOUT_MS, 8000),
  },

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
