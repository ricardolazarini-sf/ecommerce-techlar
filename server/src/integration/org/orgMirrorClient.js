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
// status (opcional): quando presente, o Apex grava Status_Logistica__c no Order
// (re-push de status). Ausente => o Apex cria em 'Aguardando' e, em re-envio,
// preserva o status atual (não reseta, não dispara e-mail à toa).
function buildPayload(customer, order, status) {
  const tipo = customer.tipo === 'PJ' ? 'PJ' : 'PF';
  const isPJ = tipo === 'PJ';
  const payload = {
    customerId: String(customer.id),
    tipo,
    nome: (isPJ ? customer.razao_social || customer.nome : customer.nome) || '',
    email: customer.email || '',
    documento: (isPJ ? customer.cnpj || customer.documento : customer.documento) || '',
    orderNumber: order.order_number,
    occurredAt: order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString(),
  };
  if (status) payload.status = status;
  return payload;
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

// Núcleo compartilhado: autentica, faz o POST no Apex REST e trata a resposta.
// NUNCA lança — devolve { ok, result?, error? }. `evt` só rotula os logs.
async function postEspelho(payload, evt) {
  try {
    // 1) token de org (JWT Bearer já usado no Data Cloud) + instanceUrl.
    const { accessToken, instanceUrl } = await getOrgAccessToken();

    // 2) POST no Apex REST com o payload do pedido.
    const res = await orgFetch('/services/apexrest/web/order', accessToken, instanceUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      // Erro de negócio (VR, 4xx) ou de sistema (5xx): registra p/ reconciliação.
      logger.warn(`${evt}.rejected`, {
        order_number: payload.orderNumber,
        http: res.status,
        message: data.message || null,
      });
      return { ok: false, error: data.message || `HTTP ${res.status}` };
    }

    logger.info(`${evt}.ok`, {
      order_number: payload.orderNumber,
      account_id: data.accountId,
      order_id: data.orderId,
      matched_by: data.matchedBy,
      status: payload.status || null,
    });
    return { ok: true, result: data };
  } catch (err) {
    // Rede/timeout/auth: best-effort — só registra.
    logger.error(`${evt}.failed`, {
      order_number: payload.orderNumber,
      err: err.message,
    });
    return { ok: false, error: err.message };
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
  return postEspelho(buildPayload(customer, order), 'org_mirror');
}

// Re-empurra uma mudança de status logístico para a org (mesmo Apex REST, agora
// com `status` no payload → o Flow Record-Triggered reage e manda o e-mail).
// Idempotente e seguro no Apex: o upsert por order_number não duplica, e um
// status desconhecido é ignorado lá. Diferente de mirrorOrder, aqui o status
// vem do chamador (endpoint admin), não da compra.
export async function pushStatus(customer, order, status) {
  if (!config.orgMirror.enabled) return { ok: true, skipped: 'disabled' };
  if (!customer || !order || !order.order_number || !status) {
    return { ok: true, skipped: 'missing_data' };
  }
  return postEspelho(buildPayload(customer, order, status), 'org_status');
}

export default { mirrorOrder, pushStatus };
