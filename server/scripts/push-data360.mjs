// Push dos dados do e-commerce (Postgres) para a Data 360 Ingestion API (Streaming).
// Faz o fluxo completo, sem você montar JWT/curl na mão:
//   1) assina um JWT (RS256) com a sua chave privada;
//   2) troca por um access token da org  (OAuth 2.0 JWT Bearer Flow);
//   3) troca por um token do Data Cloud   (endpoint /services/a360/token);
//   4) (opcional) valida os registros no endpoint síncrono /actions/test;
//   5) faz POST dos registros PF, PJ e pedidos em lotes < 200 KB, com retry/backoff.
//
// Limites da Streaming Ingestion API (doc oficial):
//   - Máx. 200 KB por request (o envelope { data: [...] } inteiro) -> lotamos por TAMANHO.
//   - 250 requests/seg somando todos os endpoints; 429 = reduza a frequência.
//   - Latência assíncrona ~3 min; sucesso do POST = HTTP 202 Accepted.
//   ref.: https://developer.salesforce.com/docs/data/data-cloud-ref/guide/c360a-api-get-started.htm
//
// Uso:
//   npm run push:data360                     (raiz)  ou  node scripts/push-data360.mjs (server)
//   DRY_RUN=true    npm run push:data360      -> não autentica nem envia; só imprime amostras
//   VALIDATE_ONLY=true npm run push:data360   -> só valida (/actions/test), não ingere
//
// Variáveis de ambiente (em server/.env ou no shell):
//   SF_LOGIN_URL         ex.: https://SEU-DOMINIO.my.salesforce.com  (login/token da org)
//   SF_AUDIENCE          opcional; padrão = SF_LOGIN_URL (login/test.salesforce.com se preciso)
//   SF_CLIENT_ID         Consumer Key da Connected App / External Client App (iss do JWT)
//   SF_USERNAME          usuário de integração (o sub do JWT)
//   SF_JWT_KEY_PATH      caminho da chave privada .key (RS256)   — OU
//   SF_JWT_KEY           conteúdo PEM da chave privada (útil no Render, via env)
//   DATACLOUD_CONNECTOR  API Name do source da Ingestion API (ex.: TechLar_Ecom)
//   DATABASE_URL / PGSSL conexão com o Postgres do site
//   MAX_PAYLOAD_BYTES    opcional; padrão 190000 (margem sob o teto de 200 KB)

import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { getPool, query, closePool } from '../src/db/index.js';
import {
  toPfRow,
  toPjRow,
  toOrderRow,
  partitionByEmail,
} from '../src/integration/data360/contractMappers.js';

const {
  SF_LOGIN_URL,
  SF_AUDIENCE,
  SF_CLIENT_ID,
  SF_USERNAME,
  SF_JWT_KEY_PATH,
  SF_JWT_KEY,
  DATACLOUD_CONNECTOR,
} = process.env;

const flag = (v) => ['1', 'true', 'yes'].includes(String(v).toLowerCase());
const DRY_RUN = flag(process.env.DRY_RUN);
const VALIDATE_ONLY = flag(process.env.VALIDATE_ONLY);
// Teto oficial é 200 KB por request; deixamos margem para headers/encoding.
const MAX_PAYLOAD_BYTES = Number(process.env.MAX_PAYLOAD_BYTES) || 190_000;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripScheme = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const bytes = (obj) => Buffer.byteLength(JSON.stringify(obj), 'utf8');

function requireEnv() {
  const missing = [];
  if (!SF_LOGIN_URL) missing.push('SF_LOGIN_URL');
  if (!SF_CLIENT_ID) missing.push('SF_CLIENT_ID');
  if (!SF_USERNAME) missing.push('SF_USERNAME');
  if (!SF_JWT_KEY_PATH && !SF_JWT_KEY) missing.push('SF_JWT_KEY_PATH ou SF_JWT_KEY');
  if (!DATACLOUD_CONNECTOR) missing.push('DATACLOUD_CONNECTOR');
  if (missing.length) {
    throw new Error(`Faltam variáveis de ambiente: ${missing.join(', ')}`);
  }
}

function loadPrivateKey() {
  if (SF_JWT_KEY) return SF_JWT_KEY.replace(/\\n/g, '\n');
  return fs.readFileSync(SF_JWT_KEY_PATH, 'utf8');
}

// Passo 1 — assina o JWT (RS256).
function buildAssertion() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: SF_CLIENT_ID,
      sub: SF_USERNAME,
      aud: SF_AUDIENCE || SF_LOGIN_URL,
      exp: now + 180, // 3 min
    },
    loadPrivateKey(),
    { algorithm: 'RS256' },
  );
}

async function postForm(url, params, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }
  return { ok: res.ok, status: res.status, json, text };
}

// Passo 2 — JWT -> access token da org.
async function getOrgAccessToken() {
  const url = `${SF_LOGIN_URL.replace(/\/+$/, '')}/services/oauth2/token`;
  const { ok, status, json, text } = await postForm(url, {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: buildAssertion(),
  });
  if (!ok || !json?.access_token) {
    throw new Error(`Falha no JWT->access_token (HTTP ${status}): ${json ? JSON.stringify(json) : text}`);
  }
  return { accessToken: json.access_token, instanceUrl: json.instance_url };
}

// Passo 3 — access token da org -> token do Data Cloud (host c360a).
async function getDataCloudToken(instanceUrl, accessToken) {
  const url = `${instanceUrl.replace(/\/+$/, '')}/services/a360/token`;
  const { ok, status, json, text } = await postForm(url, {
    grant_type: 'urn:salesforce:grant-type:external:cdp',
    subject_token: accessToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
  });
  if (!ok || !json?.access_token || !json?.instance_url) {
    throw new Error(`Falha na troca p/ Data Cloud token (HTTP ${status}): ${json ? JSON.stringify(json) : text}`);
  }
  // instance_url vem sem scheme (ex.: xxxx.c360a.salesforce.com).
  return { dcToken: json.access_token, dcHost: stripScheme(json.instance_url) };
}

// Divide as linhas em lotes cujo envelope { data: [...] } fica sob MAX_PAYLOAD_BYTES.
function chunkBySize(rows, maxBytes) {
  const ENVELOPE_OVERHEAD = 12; // {"data":[]}
  const batches = [];
  let current = [];
  let size = ENVELOPE_OVERHEAD;
  for (const row of rows) {
    const rowBytes = bytes(row) + 1; // +1 pela vírgula
    if (rowBytes + ENVELOPE_OVERHEAD > maxBytes) {
      throw new Error(`Registro sozinho excede ${maxBytes} bytes — reveja o schema/campos.`);
    }
    if (current.length && size + rowBytes > maxBytes) {
      batches.push(current);
      current = [];
      size = ENVELOPE_OVERHEAD;
    }
    current.push(row);
    size += rowBytes;
  }
  if (current.length) batches.push(current);
  return batches;
}

// POST de um lote (ingest ou validação), com retry/backoff.
async function sendBatch(dcHost, dcToken, object, batch, { validate = false } = {}) {
  const suffix = validate ? '/actions/test' : '';
  const endpoint = `https://${dcHost}/api/v1/ingest/sources/${DATACLOUD_CONNECTOR}/${object}${suffix}`;
  const body = JSON.stringify({ data: batch });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${dcToken}` };

  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(endpoint, { method: 'POST', headers, body });
      if (res.ok) return; // 200 (validate) / 202 (ingest)
      const retryable = res.status >= 500 || res.status === 429;
      const detail = await res.text().catch(() => '');
      const err = new Error(`HTTP ${res.status} em ${object}${suffix}: ${detail.slice(0, 400)}`);
      if (!retryable) throw err; // 4xx = payload fora do contrato; não repetir
      lastErr = err;
    } catch (err) {
      lastErr = err;
    }
    if (attempt < MAX_RETRIES) await sleep(300 * 2 ** attempt);
  }
  throw lastErr || new Error(`Falha ao enviar lote de ${object}`);
}

async function pushObject(dcHost, dcToken, object, rows) {
  if (!rows.length) {
    console.log(`• ${object}: 0 linha(s) — nada a enviar`);
    return 0;
  }
  const batches = chunkBySize(rows, MAX_PAYLOAD_BYTES);

  if (DRY_RUN) {
    console.log(`• ${object}: ${rows.length} linha(s) em ${batches.length} lote(s) [DRY_RUN] — amostra:`);
    console.log('  ' + JSON.stringify(rows[0]));
    return rows.length;
  }

  let done = 0;
  for (const [i, batch] of batches.entries()) {
    await sendBatch(dcHost, dcToken, object, batch, { validate: VALIDATE_ONLY });
    done += batch.length;
    const kb = (bytes({ data: batch }) / 1024).toFixed(1);
    const verb = VALIDATE_ONLY ? 'validados' : 'enviados';
    console.log(`• ${object}: lote ${i + 1}/${batches.length} (${kb} KB) — ${done}/${rows.length} ${verb}`);
  }
  return done;
}

async function loadRows() {
  const { rows: pf } = await query(`SELECT * FROM customers WHERE tipo = 'PF' ORDER BY id`);
  const { rows: pj } = await query(`SELECT * FROM customers WHERE tipo = 'PJ' ORDER BY id`);
  const { rows: orders } = await query(
    `SELECT o.order_number, o.customer_id, o.total, o.created_at, c.tipo AS customer_tipo
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY o.id`,
  );
  return {
    pf: onlyWithEmail('ecommerce_customers_pf', pf.map(toPfRow)),
    pj: onlyWithEmail('ecommerce_customers_pj', pj.map(toPjRow)),
    orders: orders.map(toOrderRow),
  };
}

// `email` é obrigatório nos schemas PF/PJ, então a linha sem e-mail é avisada e
// fica fora do lote — o resto do envio segue normalmente.
function onlyWithEmail(object, mapped) {
  const { rows, missing } = partitionByEmail(mapped);
  if (missing) console.warn(`! ${object}: ${missing} linha(s) sem e-mail — fora do envio`);
  return rows;
}

async function run() {
  requireEnv();
  getPool(); // valida DATABASE_URL cedo

  const rows = await loadRows();
  console.log(
    `Lidos do banco: ${rows.pf.length} PF · ${rows.pj.length} PJ · ${rows.orders.length} pedidos`,
  );

  let dcHost = null;
  let dcToken = null;
  if (!DRY_RUN) {
    console.log('Autenticando (JWT -> org -> Data Cloud)...');
    const { accessToken, instanceUrl } = await getOrgAccessToken();
    ({ dcHost, dcToken } = await getDataCloudToken(instanceUrl, accessToken));
    const mode = VALIDATE_ONLY ? 'VALIDANDO (/actions/test)' : 'ENVIANDO';
    console.log(`OK. ${mode} para https://${dcHost} (connector ${DATACLOUD_CONNECTOR})`);
  } else {
    console.log('DRY_RUN ligado — não vou autenticar nem enviar.');
  }

  const pfN = await pushObject(dcHost, dcToken, 'ecommerce_customers_pf', rows.pf);
  const pjN = await pushObject(dcHost, dcToken, 'ecommerce_customers_pj', rows.pj);
  const orN = await pushObject(dcHost, dcToken, 'ecommerce_orders', rows.orders);

  const label = DRY_RUN ? 'DRY_RUN' : VALIDATE_ONLY ? 'Validado' : 'Enviado';
  console.log(`\n${label}: PF ${pfN} · PJ ${pjN} · Pedidos ${orN} ✅`);
  if (!DRY_RUN && !VALIDATE_ONLY) {
    console.log('202 Accepted = ingestão assíncrona; confira no Data Explorer em ~3 min.');
  }
}

run()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Falhou:', err.message);
    await closePool().catch(() => {});
    process.exit(1);
  });
