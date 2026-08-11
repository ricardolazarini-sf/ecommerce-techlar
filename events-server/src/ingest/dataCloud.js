// Envio para a Streaming Ingestion API.
//
// Limites oficiais respeitados: 200 KB por request (o envelope inteiro), 202
// Accepted como sucesso da ingestão e 200 na validação síncrona de
// /actions/test. Por isso o lote é fechado por TAMANHO, não por contagem.
// ref.: https://developer.salesforce.com/docs/data/data-cloud-ref/guide/c360a-api-get-started.htm

const ENVELOPE_OVERHEAD = 12; // {"data":[]}

export function bytesOf(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

// Fecha lotes cujo envelope fica sob maxBytes. Registro que sozinho não cabe é
// devolvido em `oversized` em vez de derrubar o ciclo: ele vira `rejected` com
// motivo, e o resto da fila continua andando.
export function chunkBySize(rows = [], maxBytes = 190_000) {
  const batches = [];
  const oversized = [];
  let current = [];
  let size = ENVELOPE_OVERHEAD;

  for (const row of rows) {
    const rowBytes = bytesOf(row) + 1; // +1 pela vírgula
    if (rowBytes + ENVELOPE_OVERHEAD > maxBytes) {
      oversized.push(row);
      continue;
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
  return { batches, oversized };
}

export function buildEndpoint({ host, connector, object, validate = false }) {
  const suffix = validate ? '/actions/test' : '';
  return `https://${host}/api/v1/ingest/sources/${connector}/${object}${suffix}`;
}

// Um POST, sem retry aqui: quem repete é a fila, com o backoff por linha. Retry
// dentro do POST duplicaria a política em dois lugares e esconderia do banco
// quantas tentativas o evento realmente sofreu.
export async function postBatch({
  host,
  token,
  connector,
  object,
  rows,
  validate = false,
  fetchImpl,
}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const endpoint = buildEndpoint({ host, connector, object, validate });
  const body = JSON.stringify({ data: rows });
  const startedAt = Date.now();

  const res = await doFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body,
  });
  const text = await res.text().catch(() => '');
  return {
    ok: res.ok,
    status: res.status,
    body: text,
    bytes: Buffer.byteLength(body, 'utf8'),
    durationMs: Date.now() - startedAt,
    // 4xx (fora de 429) é payload fora do contrato: repetir não conserta.
    retryable: res.status >= 500 || res.status === 429,
  };
}

export default { bytesOf, chunkBySize, buildEndpoint, postBatch };
