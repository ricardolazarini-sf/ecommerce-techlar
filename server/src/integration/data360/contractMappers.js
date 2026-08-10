// Mapeadores banco -> Contrato de Dados (Sprint IV / Data 360).
// Funções PURAS (sem I/O) que transformam uma linha do nosso Postgres no formato
// exato exigido pelos schemas da Ingestion API (seção 4 do contrato):
//   - IDs, CPF, CNPJ e telefone sempre TEXT
//   - telefone em E.164 (+55DDDNUMERO)
//   - datas em ISO 8601 (DateTime)
//   - customer_id prefixado por canal/tipo (WEB-PF- / WEB-PJ-)
// Mantê-las puras torna o contrato trivialmente testável.

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

// Normaliza qualquer formato de telefone BR para E.164 (+55 + DDD + número).
// Aceita "(11) 98765-4321", "11987654321", "+55 11 98765-4321", etc.
export function toE164BR(phone) {
  let d = onlyDigits(phone);
  if (!d) return null;
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2); // remove DDI duplicado
  if (d.length !== 10 && d.length !== 11) return null; // fora do padrão BR
  return `+55${d}`;
}

// Converte para ISO 8601 (UTC). Retorna null se a data for inválida.
export function toISO(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Divide "nome completo" em first_name / last_name. Se houver só um token,
// repete no last_name (Last Name é required na DMO Individual).
export function splitName(nome) {
  const parts = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

export const pfCustomerId = (id) => `WEB-PF-${id}`;
export const pjCustomerId = (id) => `WEB-PJ-${id}`;
export const customerIdFor = (row) =>
  row.tipo === 'PJ' ? pjCustomerId(row.id) : pfCustomerId(row.id);

// ---- Linha do stream ecommerce_customers_pf (contrato §4.1.a) ----
export function toPfRow(c) {
  const { first_name, last_name } = splitName(c.nome);
  return {
    customer_id: pfCustomerId(c.id),
    first_name,
    last_name,
    cpf: onlyDigits(c.documento),
    id_type: 'CPF',
    id_name: 'CPF',
    email: c.email ?? '',
    phone: toE164BR(c.telefone) ?? '',
    address_line1: c.address_line1 ?? '',
    city: c.city ?? '',
    country: c.country ?? 'Brasil',
    updated_at: toISO(c.updated_at || c.created_at),
  };
}

// ---- Linha do stream ecommerce_customers_pj (contrato §4.1.b) ----
export function toPjRow(c) {
  return {
    customer_id: pjCustomerId(c.id),
    account_name: c.razao_social ?? c.nome ?? '',
    cnpj: onlyDigits(c.cnpj),
    email: c.email ?? '',
    phone: toE164BR(c.telefone) ?? '',
    address_line1: c.address_line1 ?? '',
    city: c.city ?? '',
    country: c.country ?? 'Brasil',
    updated_at: toISO(c.updated_at || c.created_at),
  };
}

// ---- Linha do stream ecommerce_orders (contrato §4.1.c) ----
// `order` deve trazer o tipo do cliente (join) para prefixar o customer_id certo.
export function toOrderRow(order) {
  const tipo = order.customer_tipo === 'PJ' ? 'PJ' : 'PF';
  const custId = tipo === 'PJ' ? pjCustomerId(order.customer_id) : pfCustomerId(order.customer_id);
  return {
    sales_order_id: order.order_number,
    customer_id: order.customer_id == null ? '' : custId,
    total_amount: Number(order.total),
    order_date: toISO(order.created_at),
  };
}

export default {
  onlyDigits,
  toE164BR,
  toISO,
  splitName,
  pfCustomerId,
  pjCustomerId,
  customerIdFor,
  toPfRow,
  toPjRow,
  toOrderRow,
};
