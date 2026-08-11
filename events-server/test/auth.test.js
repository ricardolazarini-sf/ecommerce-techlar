import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import { config } from '../src/config/index.js';
import { createTokenProvider } from '../src/ingest/auth.js';

// Chave descartável só para assinar o JWT do teste — nada aqui sai da máquina.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function withFakeOrg() {
  config.dataCloud.loginUrl = 'https://exemplo.my.salesforce.com';
  config.dataCloud.clientId = 'client-id';
  config.dataCloud.username = 'integracao@exemplo.com';
  config.dataCloud.jwtKey = privateKey;
  config.dataCloud.jwtKeyPath = '';
  config.dataCloud.connector = 'TechLar_Web';
}

// Cada autenticação são DUAS chamadas: JWT -> token da org, e token da org ->
// token do Data Cloud.
function fakeFetch(counter, { expiresIn = 1800 } = {}) {
  return async (url) => {
    counter.calls += 1;
    if (url.endsWith('/services/oauth2/token')) {
      counter.orgCalls += 1;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ access_token: 'org-token', instance_url: 'https://exemplo.my.salesforce.com' }),
      };
    }
    counter.dcCalls += 1;
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: `dc-token-${counter.dcCalls}`,
          instance_url: 'https://abc.c360a.salesforce.com',
          expires_in: expiresIn,
        }),
    };
  };
}

test('o token é reusado entre ciclos do flusher, sem voltar na org', async () => {
  withFakeOrg();
  const counter = { calls: 0, orgCalls: 0, dcCalls: 0 };
  const tokens = createTokenProvider({ fetchImpl: fakeFetch(counter) });

  const first = await tokens.get();
  const second = await tokens.get();

  assert.equal(first.token, 'dc-token-1');
  assert.equal(second.token, 'dc-token-1');
  assert.equal(first.host, 'abc.c360a.salesforce.com', 'o host vem sem scheme');
  assert.equal(counter.orgCalls, 1, 'uma autenticação só para os dois pedidos');
});

test('o token é renovado antes de vencer, não depois', async () => {
  withFakeOrg();
  const counter = { calls: 0, orgCalls: 0, dcCalls: 0 };
  let agora = Date.parse('2026-08-11T12:00:00.000Z');
  const tokens = createTokenProvider({
    fetchImpl: fakeFetch(counter, { expiresIn: 120 }),
    now: () => agora,
  });

  assert.equal((await tokens.get()).token, 'dc-token-1');
  // Faltando 30s para vencer: dentro da margem de renovação, então renova.
  agora += 90_000;
  assert.equal((await tokens.get()).token, 'dc-token-2');
  assert.equal(counter.orgCalls, 2);
});

test('dois pedidos simultâneos compartilham uma autenticação', async () => {
  withFakeOrg();
  const counter = { calls: 0, orgCalls: 0, dcCalls: 0 };
  const tokens = createTokenProvider({ fetchImpl: fakeFetch(counter) });

  const [a, b] = await Promise.all([tokens.get(), tokens.get()]);
  assert.equal(a.token, b.token);
  assert.equal(counter.orgCalls, 1);
});

test('configuração incompleta falha dizendo qual variável falta', async () => {
  withFakeOrg();
  config.dataCloud.connector = '';
  const tokens = createTokenProvider({ fetchImpl: async () => ({ ok: true, text: async () => '{}' }) });
  await assert.rejects(() => tokens.get(), /DATACLOUD_EVENTS_CONNECTOR/);
});

test('recusa da org sobe como erro legível, com o corpo da resposta', async () => {
  withFakeOrg();
  const tokens = createTokenProvider({
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'invalid_grant' }),
    }),
  });
  await assert.rejects(() => tokens.get(), /invalid_grant/);
});
