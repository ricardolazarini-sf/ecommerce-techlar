import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { config, missingDataCloudConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Autenticação da Data Cloud em três passos, igual ao CLI de ingestão
// (server/scripts/push-data360.mjs):
//   1. assina um JWT RS256 com a chave privada;
//   2. troca por access token da org (OAuth 2.0 JWT Bearer Flow);
//   3. troca por token do Data Cloud (/services/a360/token).
//
// A diferença aqui é o cache: o flusher roda a cada poucos segundos, e refazer
// as três chamadas em cada ciclo gastaria três round-trips na org por lote —
// além de bater no limite de login por hora num pico de cliques. O token é
// reusado e renovado ANTES de vencer.
//
// Nada disso muda a org: é o mesmo External Client App já autorizado.

const RENEW_MARGIN_MS = 60_000;
const stripScheme = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

export function createTokenProvider({ fetchImpl, now = () => Date.now() } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  let cached = null;
  let inFlight = null;

  function loadPrivateKey() {
    if (config.dataCloud.jwtKey) return config.dataCloud.jwtKey.replace(/\\n/g, '\n');
    return fs.readFileSync(config.dataCloud.jwtKeyPath, 'utf8');
  }

  function buildAssertion() {
    const seconds = Math.floor(now() / 1000);
    return jwt.sign(
      {
        iss: config.dataCloud.clientId,
        sub: config.dataCloud.username,
        aud: config.dataCloud.audience || config.dataCloud.loginUrl,
        exp: seconds + 180,
      },
      loadPrivateKey(),
      { algorithm: 'RS256' },
    );
  }

  async function postForm(url, params) {
    const res = await doFetch(url, {
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

  async function authenticate() {
    const missing = missingDataCloudConfig();
    if (missing.length) {
      throw new Error(`Faltam variáveis para falar com a Data Cloud: ${missing.join(', ')}`);
    }

    const orgUrl = `${config.dataCloud.loginUrl.replace(/\/+$/, '')}/services/oauth2/token`;
    const org = await postForm(orgUrl, {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildAssertion(),
    });
    if (!org.ok || !org.json?.access_token) {
      throw new Error(
        `Falha no JWT->access_token (HTTP ${org.status}): ${org.json ? JSON.stringify(org.json) : org.text}`,
      );
    }

    const dcUrl = `${String(org.json.instance_url).replace(/\/+$/, '')}/services/a360/token`;
    const dc = await postForm(dcUrl, {
      grant_type: 'urn:salesforce:grant-type:external:cdp',
      subject_token: org.json.access_token,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    });
    if (!dc.ok || !dc.json?.access_token || !dc.json?.instance_url) {
      throw new Error(
        `Falha na troca p/ Data Cloud token (HTTP ${dc.status}): ${dc.json ? JSON.stringify(dc.json) : dc.text}`,
      );
    }

    // `expires_in` vem em segundos; sem ele, assume 30 min e renova cedo.
    const ttlMs = (Number(dc.json.expires_in) || 1_800) * 1000;
    cached = {
      token: dc.json.access_token,
      host: stripScheme(dc.json.instance_url),
      expiresAt: now() + ttlMs,
    };
    logger.info('datacloud.token.renewed', { host: cached.host, ttl_ms: ttlMs });
    return cached;
  }

  return {
    async get() {
      if (cached && cached.expiresAt - RENEW_MARGIN_MS > now()) return cached;
      // Um ciclo do flusher pode pedir token em paralelo com outro; uma
      // autenticação só, compartilhada, em vez de duas idas à org.
      if (!inFlight) {
        inFlight = authenticate().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
    peek() {
      return cached;
    },
    reset() {
      cached = null;
    },
  };
}

export default { createTokenProvider };
