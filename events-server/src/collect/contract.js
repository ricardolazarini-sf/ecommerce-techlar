// O contrato de engajamento: quais cliques existem, quais campos cada um pode
// trazer, e como uma linha da fila vira um registro do objeto `ecommerce_events`
// de docs/data360/ecommerce_events.yaml.
//
// Pure logic, sem I/O — é o que os testes cobrem.

// Os 14 cliques escolhidos. Tipo fora desta lista é recusado com 400: coletor
// público aceita o que o produto emite, não qualquer string que chegar.
export const EVENT_TYPES = [
  // Combos
  'combo_clicked',
  'combo_qualified',
  // Funil de compra
  'search_performed',
  'product_viewed',
  'warranty_toggled',
  'cart_item_added',
  'cart_item_removed',
  'checkout_started',
  'order_placed',
  // Afinidade
  'category_filtered',
  'wishlist_toggled',
  // Identidade e pós-compra
  'identify',
  'customer_type_selected',
  'order_tracking_viewed',
];

const EVENT_TYPE_SET = new Set(EVENT_TYPES);

export function isKnownEventType(type) {
  return EVENT_TYPE_SET.has(String(type || ''));
}

// Campos de texto e numéricos do contrato, fora das chaves de cabeçalho
// (event_id, event_type, occurred_at, email, device_id). Campo que não está
// aqui é descartado na entrada — schema fechado, sem campo surpresa virando
// coluna na Data Cloud.
export const TEXT_PROPS = [
  'phone',
  'document',
  'reason',
  'product_id',
  'sku',
  'product_name',
  'category',
  'action',
  'order_number',
  'status',
  'items_json',
  'search_term',
  'surface',
  'page_path',
  'combo_id',
];

export const NUMBER_PROPS = ['price', 'item_count', 'subtotal', 'total', 'qty', 'discount'];

// Apelidos do domínio do site para o nome do contrato: o front fala `nome`,
// `categoria`, `preco` e `items`, e o YAML fala `product_name`, `category`,
// `price` e `items_json`. Traduzir aqui evita renomear no ponto do clique.
const ALIASES = {
  nome: 'product_name',
  categoria: 'category',
  preco: 'price',
  combo_slug: 'combo_id',
  term: 'search_term',
};

const TEXT_SET = new Set(TEXT_PROPS);
const NUMBER_SET = new Set(NUMBER_PROPS);

const MAX_TEXT = 500;
// items_json é o único campo que legitimamente cresce (um pedido inteiro).
const MAX_ITEMS_JSON = 4_000;

function trimText(value, max = MAX_TEXT) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.slice(0, max);
}

function toNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  // Duas casas: o contrato só carrega dinheiro e contagem.
  return Math.round(n * 100) / 100;
}

// Mantém apenas o que o contrato conhece, já normalizado. `items` (array) é
// serializado aqui, porque o contrato não aceita array.
export function sanitizeProps(input = {}) {
  const props = {};
  if (!input || typeof input !== 'object') return props;

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = ALIASES[rawKey] || rawKey;
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    if (key === 'items') {
      try {
        props.items_json = JSON.stringify(rawValue).slice(0, MAX_ITEMS_JSON);
      } catch {
        /* item impossível de serializar não vira campo */
      }
      continue;
    }
    if (key === 'items_json') {
      props.items_json = trimText(rawValue, MAX_ITEMS_JSON);
      continue;
    }
    if (TEXT_SET.has(key)) {
      const text = trimText(rawValue);
      if (text) props[key] = text;
      continue;
    }
    if (NUMBER_SET.has(key)) {
      props[key] = toNumber(rawValue);
      continue;
    }
    // Qualquer outra chave é descartada em silêncio.
  }
  return props;
}

// Achata uma linha da fila no registro do contrato.
//
// TODAS as chaves saem SEMPRE, com "" e 0 no que não se aplica: o Data Stream
// recusa com 400 `required key [x] not found` o registro que omite uma
// propriedade declarada no schema — inclusive as de fora do `required`. Quem
// descarta o que está em branco é a transformação na Data 360.
export function flattenEvent(row = {}) {
  const props = row.props && typeof row.props === 'object' ? row.props : {};
  const flat = {
    event_id: trimText(row.event_id),
    event_type: trimText(row.event_type),
    occurred_at: toIsoString(row.occurred_at),
    email: trimText(row.email),
    device_id: trimText(row.device_id),
  };
  for (const key of TEXT_PROPS) {
    flat[key] = key === 'items_json' ? trimText(props[key], MAX_ITEMS_JSON) : trimText(props[key]);
  }
  for (const key of NUMBER_PROPS) {
    flat[key] = toNumber(props[key]);
  }
  return flat;
}

function toIsoString(value) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

// O conjunto completo de chaves do contrato, na ordem em que o achatador emite.
// Serve aos testes e ao /health, que mostra o contrato em vigor.
export const CONTRACT_KEYS = [
  'event_id',
  'event_type',
  'occurred_at',
  'email',
  'device_id',
  ...TEXT_PROPS,
  ...NUMBER_PROPS,
];

export default {
  EVENT_TYPES,
  CONTRACT_KEYS,
  TEXT_PROPS,
  NUMBER_PROPS,
  isKnownEventType,
  sanitizeProps,
  flattenEvent,
};
