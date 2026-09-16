// Autenticação no Data Cloud (OAuth 2.0 JWT Bearer Flow), em 3 passos:
//   1) assina um JWT RS256 com a chave privada da Connected/External Client App;
//   2) troca por um access token da org        (/services/oauth2/token);
//   3) troca por um token do Data Cloud        (/services/a360/token).
//
// O token do passo 3 é opaco e só vale para o host `*.c360a.salesforce.com`
// devolvido junto — é ele que dá acesso à Ingestion, Metadata e Query APIs.
//
// As variáveis de ambiente são lidas na CHAMADA (não no import) para que o
// dotenv possa carregar o .env antes.

import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const stripScheme = (u) =>
  String(u || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');

const trimSlash = (u) => String(u || '').replace(/\/+$/, '');

function readEnv() {
  const {
    SF_LOGIN_URL,
    SF_AUDIENCE,
    SF_CLIENT_ID,
    SF_USERNAME,
    SF_JWT_KEY_PATH,
    SF_JWT_KEY,
  } = process.env;

  const missing = [];
  if (!SF_LOGIN_URL) missing.push('SF_LOGIN_URL');
  if (!SF_CLIENT_ID) missing.push('SF_CLIENT_ID');
  if (!SF_USERNAME) missing.push('SF_USERNAME');
  if (!SF_JWT_KEY_PATH && !SF_JWT_KEY) missing.push('SF_JWT_KEY_PATH ou SF_JWT_KEY');
  if (missing.length) {
    throw new Error(`Faltam variáveis de ambiente: ${missing.join(', ')}`);
  }

  return { SF_LOGIN_URL, SF_AUDIENCE, SF_CLIENT_ID, SF_USERNAME, SF_JWT_KEY_PATH, SF_JWT_KEY };
}

// Normaliza um PEM que pode ter sofrido corrupção ao ser colado num campo de
// env var (Render, Heroku): aspas em volta, `\n` literais, `\\n` duplo-escapado,
// CRLF, ou até quebras achatadas em espaço. Reconstrói cabeçalho + corpo base64
// (linhas de 64) + rodapé a partir do que sobrou — se não casar o formato PEM,
// devolve o texto só com escapes convertidos (fallback conservador).
function normalizePrivateKey(raw) {
  let k = String(raw || '').trim();
  // 1) remove aspas externas (o .env.example mostra SF_JWT_KEY="...").
  if (
    k.length > 1 &&
    ((k[0] === '"' && k[k.length - 1] === '"') || (k[0] === "'" && k[k.length - 1] === "'"))
  ) {
    k = k.slice(1, -1);
  }
  // 2) converte escapes literais e remove CR.
  k = k.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '');
  // 3) se é um PEM reconhecível, reconstrói corpo em linhas de 64 chars.
  const m = k.match(/-----BEGIN ([A-Z0-9 ]+?)-----([\s\S]*?)-----END \1-----/);
  if (m) {
    const label = m[1].trim();
    const body = m[2].replace(/[^A-Za-z0-9+/=]/g, '');
    const wrapped = body.match(/.{1,64}/g) || [];
    return `-----BEGIN ${label}-----\n${wrapped.join('\n')}\n-----END ${label}-----\n`;
  }
  return `${k.trim()}\n`;
}

function loadPrivateKey(env) {
  if (env.SF_JWT_KEY) return normalizePrivateKey(env.SF_JWT_KEY);
  return fs.readFileSync(env.SF_JWT_KEY_PATH, 'utf8');
}

export function buildAssertion(env = readEnv()) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: env.SF_CLIENT_ID,
      sub: env.SF_USERNAME,
      aud: env.SF_AUDIENCE || env.SF_LOGIN_URL,
      exp: now + 180,
    },
    loadPrivateKey(env),
    { algorithm: 'RS256' },
  );
}

async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

export async function getOrgAccessToken(env = readEnv()) {
  const url = `${trimSlash(env.SF_LOGIN_URL)}/services/oauth2/token`;
  const { ok, status, json, text } = await postForm(url, {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: buildAssertion(env),
  });
  if (!ok || !json?.access_token) {
    throw new Error(
      `Falha no JWT->access_token (HTTP ${status}): ${json ? JSON.stringify(json) : text}`,
    );
  }
  return { accessToken: json.access_token, instanceUrl: json.instance_url };
}

export async function getDataCloudToken(instanceUrl, accessToken) {
  const url = `${trimSlash(instanceUrl)}/services/a360/token`;
  const { ok, status, json, text } = await postForm(url, {
    grant_type: 'urn:salesforce:grant-type:external:cdp',
    subject_token: accessToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
  });
  if (!ok || !json?.access_token || !json?.instance_url) {
    throw new Error(
      `Falha na troca p/ Data Cloud token (HTTP ${status}): ${json ? JSON.stringify(json) : text}`,
    );
  }
  return { dcToken: json.access_token, dcHost: stripScheme(json.instance_url) };
}

// Atalho: faz os 3 passos e devolve { dcHost, dcToken }.
export async function authenticateDataCloud() {
  const env = readEnv();
  const { accessToken, instanceUrl } = await getOrgAccessToken(env);
  return getDataCloudToken(instanceUrl, accessToken);
}

export default { buildAssertion, getOrgAccessToken, getDataCloudToken, authenticateDataCloud };
