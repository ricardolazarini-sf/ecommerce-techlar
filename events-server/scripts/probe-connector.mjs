// Descobre, contra a org, se um conector/objeto de ingestão existe e se ele
// aceita o registro do contrato — sem gravar nada, usando só /actions/test.
//
// Uso:
//   node scripts/probe-connector.mjs                       (usa o .env)
//   node scripts/probe-connector.mjs TechLar_Ecom ecommerce_events
//
// Serve para o momento em que o conector novo de engajamento é criado na org:
// roda isto e a resposta diz se o nome está certo e se o schema já tem os campos
// de clique, antes de deixar o flusher ingerir de verdade.

import { config, missingDataCloudConfig } from '../src/config/index.js';
import { createTokenProvider } from '../src/ingest/auth.js';
import { buildEndpoint } from '../src/ingest/dataCloud.js';
import { flattenEvent } from '../src/collect/contract.js';

const connector = process.argv[2] || config.dataCloud.connector;
const object = process.argv[3] || config.dataCloud.object;

if (!connector) {
  console.error('Informe o conector: node scripts/probe-connector.mjs <conector> [objeto]');
  process.exit(1);
}

const missing = missingDataCloudConfig().filter((v) => !v.startsWith('DATACLOUD_EVENTS_CONNECTOR'));
if (missing.length) {
  console.error('Faltam variáveis da org:', missing.join(', '));
  process.exit(1);
}

const amostra = flattenEvent({
  event_id: `probe-${Date.now()}`,
  event_type: 'combo_clicked',
  occurred_at: new Date().toISOString(),
  device_id: 'probe-device',
  email: '',
  props: { combo_id: 'casa-inteira', discount: 12, surface: 'home', page_path: '/' },
});

// O conector vem por argumento, então preenche o que a autenticação exige antes
// de pedir o token (o guard de config é o mesmo que o flusher usa).
config.dataCloud.connector = connector;

const tokens = createTokenProvider();
const { token, host } = await tokens.get();
const url = buildEndpoint({ host, connector, object, validate: true });
console.log('POST', url);

const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: [amostra] }),
});
const body = await res.text();

console.log('HTTP', res.status);
console.log(body || '(corpo vazio)');

if (res.ok) {
  console.log('\nOK: o conector existe e aceita o registro do contrato.');
} else if (res.status === 404) {
  console.log('\nConector ou objeto não existe nesta org com esse nome.');
} else if (res.status === 400) {
  console.log('\nO conector existe, mas o schema não bate com o registro (veja a mensagem acima).');
}
process.exit(res.ok ? 0 : 1);
