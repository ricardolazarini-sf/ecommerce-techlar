import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';

// As duas coisas que fazem o clique do navegador chegar (ou não) até aqui são
// invisíveis do lado do servidor: a liberação de origem e o tipo do corpo. Um
// coletor que recusa a origem da loja responde 200 ao preflight e o navegador
// descarta o POST em silêncio; um coletor que não lê `text/plain` transforma todo
// beacon de aba fechando em "corpo inválido". Nenhum dos dois aparece em log de
// erro, então ficam presos aqui.

const LOJA = config.corsOrigins[0];

// Sobe em porta efêmera e devolve a base, para o teste falar HTTP de verdade —
// é o preflight do navegador que está sob teste, e ele é protocolo, não função.
async function servidor(t) {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

const preflight = (base, origin) =>
  fetch(`${base}/collect`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });

test('a origem da loja está liberada por padrão, sem depender do painel', async (t) => {
  const base = await servidor(t);
  assert.ok(LOJA, 'a allowlist não pode nascer vazia');

  const res = await preflight(base, LOJA);
  assert.equal(res.headers.get('access-control-allow-origin'), LOJA);
  assert.match(res.headers.get('access-control-allow-methods') || '', /POST/);
});

test('origem de fora da lista não recebe liberação', async (t) => {
  const base = await servidor(t);
  const res = await preflight(base, 'https://loja-que-nao-existe.example.com');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

// O corpo é o mesmo JSON; só o cabeçalho muda, para o beacon virar requisição
// simples e escapar do preflight na hora em que a página morre.
test('o corpo do sendBeacon (text/plain) é lido como JSON', async (t) => {
  const base = await servidor(t);
  const res = await fetch(`${base}/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ device_id: 'dev-1', events: [{ event_type: 'inventado' }] }),
  });

  // 400 pelo tipo de evento desconhecido, não pelo corpo: a recusa nominal só
  // existe se o JSON foi realmente lido.
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.deepEqual(body.rejected, [{ event_type: 'inventado', reason: 'tipo desconhecido' }]);
});
