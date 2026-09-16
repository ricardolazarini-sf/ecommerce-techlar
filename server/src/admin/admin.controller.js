// Endpoints administrativos de baixo volume (uso operacional/demo). Hoje: mudar
// o status logístico de um pedido e re-empurrá-lo para o CRM, disparando o
// e-mail proativo da US7.1 (Record-Triggered Flow reage à mudança na org).
//
// Protegido por token compartilhado (x-admin-token vs config.admin.token). NÃO é
// o mesmo eixo de auth dos clientes (JWT) — é uma barreira operacional simples,
// proporcional a um ambiente de mock/demo. Ver admin.routes.js.

import { config } from '../config/index.js';
import * as ordersRepo from '../orders/orders.repository.js';
import * as customersRepo from '../customers/customers.repository.js';
import * as orgMirror from '../integration/org/orgMirrorClient.js';
import { logger } from '../utils/logger.js';

// Espelha a picklist RESTRITA Status_Logistica__c da org e o STATUSES do mock.
// Validamos aqui para dar 400 claro antes de qualquer callout; o Apex também
// ignora valores fora da lista como rede de segurança.
const STATUS_VALIDOS = ['Aguardando', 'Confirmado', 'Em Transporte', 'Entregue'];

// POST /api/admin/orders/:orderNumber/status  { status }
// Muda o status logístico do pedido no CRM (via Apex REST) para disparar o
// e-mail proativo. Best-effort no callout, mas com resposta síncrona clara para
// o operador (ao contrário do checkout, aqui a ação É o callout).
export async function updateOrderStatus(req, res, next) {
  try {
    const { orderNumber } = req.params;
    const status = (req.body && req.body.status ? String(req.body.status) : '').trim();

    if (!status) {
      return res.status(400).json({ error: 'Informe o campo "status".' });
    }
    // Comparação case-insensitive; normaliza para o valor canônico da picklist.
    const canonical = STATUS_VALIDOS.find((v) => v.toLowerCase() === status.toLowerCase());
    if (!canonical) {
      return res.status(400).json({
        error: `status inválido: "${status}". Use um de: ${STATUS_VALIDOS.join(', ')}.`,
      });
    }

    if (!config.orgMirror.enabled) {
      // Sem o espelho ligado não há para onde empurrar; deixa explícito ao operador.
      return res.status(409).json({
        error: 'Espelho do CRM desligado (ORG_MIRROR_ENABLED=false). Nada foi enviado.',
      });
    }

    const order = await ordersRepo.findByNumber(orderNumber);
    if (!order) {
      return res.status(404).json({ error: `Pedido ${orderNumber} não encontrado.` });
    }

    const customer = await customersRepo.findById(order.customer_id);
    if (!customer) {
      return res.status(404).json({ error: `Cliente do pedido ${orderNumber} não encontrado.` });
    }

    const result = await orgMirror.pushStatus(customer, order, canonical);
    if (!result.ok) {
      // O callout falhou (VR, rede, auth): 502 — a origem (site) está ok, o
      // destino (org) que recusou/caiu.
      logger.warn('admin.status_push_failed', { order_number: orderNumber, status: canonical, error: result.error });
      return res.status(502).json({ error: `Falha ao atualizar no CRM: ${result.error}` });
    }

    return res.json({
      ok: true,
      order_number: orderNumber,
      status: canonical,
      crm: { orderId: result.result?.orderId, accountId: result.result?.accountId, matchedBy: result.result?.matchedBy },
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/admin/orders — lista os pedidos recentes p/ a interface admin escolher
// qual operar. Read-only (Postgres). Não toca no CRM.
export async function listOrders(_req, res, next) {
  try {
    const orders = await ordersRepo.listRecent(50);
    return res.json({ ok: true, orders });
  } catch (err) {
    return next(err);
  }
}

export default { updateOrderStatus, listOrders };
