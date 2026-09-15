// Espelho do pedido no CRM (Salesforce org) — cliente HTTP do Apex REST
// EspelhoPedidoSiteService (POST /services/apexrest/web/order).
//
// Por que existe: a US7.1 (e-mail proativo de status) precisa de um Order CORE
// na org para o Record-Triggered Flow disparar. Este módulo, após a compra ser
// persistida no Postgres, espelha o pedido em Person Account/Business Account +
// Order na org, de forma IDEMPOTENTE (o Apex faz upsert por External Id).
//
// INERTE quando config.orgMirror.enabled é false: no-op, nenhuma requisição —
// preserva exatamente o comportamento atual do checkout. Segue o mesmo desenho
// do erpClient.js: fetch global + AbortController p/ timeout, e é BEST-EFFORT
// (o chamador ignora falhas; o pedido já está salvo).
//
// Auth: reusa o JWT Bearer que o site já usa p/ Data Cloud (getOrgAccessToken)
// — devolve um token de org normal, usável no Apex REST. Sem Connected App nova.

import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { getOrgAccessToken } from '../data360/dataCloudAuth.js';

// Deriva o payload que o Apex espera a partir da linha de customer do banco.
// PF usa nome+documento(CPF); PJ usa razao_social+cnpj. O Apex limpa máscara,
// valida CPF(11)/CNPJ(14) e decide o RecordType — aqui só mandamos os dados.
function buildPayload(customer, order) {
  const tipo = customer.tipo === 'PJ' ? 'PJ' : 'PF';
  const isPJ = tipo === 'PJ';
  return {
    customerId: String(customer.id),
    tipo,
    nome: (isPJ ? customer.razao_social || customer.nome : customer.nome) || '',
    email: customer.email || '',
    documento: (isPJ ? customer.cnpj || customer.documento : customer.documento) || '',
    orderNumber: order.order_number,
    occurredAt: order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString(),
  };
}

async function orgFetch(path, accessToken, instanceUrl, options = {}) {
  const { timeoutMs } = config.orgMirror;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(`${instanceUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Espelha o pedido na org. Retorna { ok, skipped?, result?, error? }. NUNCA
// lança: é best-effort, o pedido já foi persistido. No-op (skipped) se desligado
// ou sem order_number/customer. O chamador (checkout) só loga o resultado.
export async function mirrorOrder(customer, order) {
  if (!config.orgMirror.enabled) return { ok: true, skipped: 'disabled' };
  if (!customer || !order || !order.order_number) {
    return { ok: true, skipped: 'missing_data' };
  }

  try {
    // 1) token de org (JWT Bearer já usado no Data Cloud) + instanceUrl.
    const { accessToken, instanceUrl } = await getOrgAccessToken();

    // 2) POST no Apex REST com o payload do pedido.
    const payload = buildPayload(customer, order);
    const res = await orgFetch('/services/apexrest/web/order', accessToken, instanceUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      // Erro de negócio (VR, 4xx) ou de sistema (5xx): registra p/ reconciliação,
      // mas não derruba a compra já confirmada.
      logger.warn('org_mirror.rejected', {
        order_number: order.order_number,
        http: res.status,
        message: data.message || null,
      });
      return { ok: false, error: data.message || `HTTP ${res.status}` };
    }

    logger.info('org_mirror.ok', {
      order_number: order.order_number,
      account_id: data.accountId,
      order_id: data.orderId,
      matched_by: data.matchedBy,
    });
    return { ok: true, result: data };
  } catch (err) {
    // Rede/timeout/auth: best-effort — só registra.
    logger.error('org_mirror.failed', {
      order_number: order.order_number,
      err: err.message,
    });
    return { ok: false, error: err.message };
  }
}

export default { mirrorOrder };
