import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Duas fontes de env, nesta ordem de precedência:
//   1. events-server/.env — o que é só deste serviço (porta, banco da fila).
//   2. server/.env        — credenciais que já existem lá e não vale duplicar:
//                           o JWT_SECRET do site (é o que autoriza anexar
//                           e-mail a um clique) e as chaves SF_* da org.
// dotenv não sobrescreve variável já definida, então o arquivo local ganha.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../server/.env') });

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const list = (value, fallback = []) => {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.EVENTS_PORT, 3002),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Em dev pode ser outro database na mesma instância; em produção é um banco
  // separado de verdade, para um pico de cliques não atrapalhar quem compra.
  databaseUrl: process.env.EVENTS_DATABASE_URL || '',
  pgSsl: bool(process.env.EVENTS_PGSSL, false),

  // Em produção o coletor fica em outro domínio, então precisa de allowlist.
  // Em dev o navegador chega por proxy do Vite, mesma origem.
  corsOrigins: list(process.env.EVENTS_CORS_ORIGINS),

  // Mesmo segredo do servidor transacional: é assim que o coletor sabe que o
  // e-mail vem de alguém realmente logado, e não de quem inventou um POST.
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',

  // Swagger em /docs. Ligado por padrão porque este serviço não tem interface
  // nenhuma além dele, e é como se testa o /collect antes de apontar o site.
  // Desligue quando o coletor estiver recebendo tráfego real: a página manda
  // POST de verdade, e evento de teste em produção suja o perfil na Data 360.
  docsEnabled: bool(process.env.EVENTS_DOCS, true),

  collect: {
    maxEventsPerRequest: int(process.env.EVENTS_MAX_PER_REQUEST, 50),
    maxBodyBytes: int(process.env.EVENTS_MAX_BODY_BYTES, 64 * 1024),
    // Janela de rate limit por IP e por device. Coletor público é alvo fácil.
    rateWindowMs: int(process.env.EVENTS_RATE_WINDOW_MS, 60_000),
    rateMaxRequests: int(process.env.EVENTS_RATE_MAX_REQUESTS, 60),
    rateMaxEvents: int(process.env.EVENTS_RATE_MAX_EVENTS, 600),
  },

  flush: {
    enabled: bool(process.env.EVENTS_FLUSH_ENABLED, true),
    intervalMs: int(process.env.EVENTS_FLUSH_INTERVAL_MS, 5_000),
    maxRows: int(process.env.EVENTS_FLUSH_MAX_ROWS, 500),
    // Teto oficial da Streaming Ingestion API é 200 KB por request.
    maxPayloadBytes: int(process.env.EVENTS_MAX_PAYLOAD_BYTES, 190_000),
    maxAttempts: int(process.env.EVENTS_MAX_ATTEMPTS, 5),
    retryBaseMs: int(process.env.EVENTS_RETRY_BASE_MS, 2_000),
    dryRun: bool(process.env.EVENTS_DRY_RUN, false),
    validateOnly: bool(process.env.EVENTS_VALIDATE_ONLY, false),
  },

  dataCloud: {
    loginUrl: process.env.SF_LOGIN_URL || '',
    audience: process.env.SF_AUDIENCE || '',
    clientId: process.env.SF_CLIENT_ID || '',
    username: process.env.SF_USERNAME || '',
    jwtKeyPath: process.env.SF_JWT_KEY_PATH || '',
    jwtKey: process.env.SF_JWT_KEY || '',
    // Connector novo, dedicado a engajamento — o de PF/PJ/pedidos não é tocado.
    connector: process.env.DATACLOUD_EVENTS_CONNECTOR || '',
    object: process.env.DATACLOUD_EVENTS_OBJECT || 'ecommerce_events',
  },

  isProduction() {
    return this.env === 'production';
  },
};

// O que falta para o flusher conseguir falar com a Data Cloud. Devolver a lista
// (em vez de lançar no import) deixa o /health explicar o serviço meio
// configurado, que é o estado normal em dev.
export function missingDataCloudConfig() {
  const d = config.dataCloud;
  const missing = [];
  if (!d.loginUrl) missing.push('SF_LOGIN_URL');
  if (!d.clientId) missing.push('SF_CLIENT_ID');
  if (!d.username) missing.push('SF_USERNAME');
  if (!d.jwtKeyPath && !d.jwtKey) missing.push('SF_JWT_KEY_PATH ou SF_JWT_KEY');
  if (!d.connector) missing.push('DATACLOUD_EVENTS_CONNECTOR');
  return missing;
}

export default config;
