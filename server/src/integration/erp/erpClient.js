// Cliente HTTP do ERP de estoque (mock externo).
//
// O ERP é a fonte da verdade do inventário — o site apenas o consulta e dá
// baixa. Este módulo é INERTE quando config.erp.enabled é false: todas as
// funções viram no-op e nenhuma requisição de rede é feita, preservando o
// comportamento original do checkout.
//
// Usa o fetch global (Node >= 20) com AbortController para timeout. Erros de
// rede/timeout/5xx são traduzidos para um erro de "ERP indisponível"; um 409 do
// endpoint de baixa vira um erro de negócio (sem estoque) — decisão de como
// tratar cada um fica com o chamador (checkout).

import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// Agrupa itens por SKU somando as quantidades, para consultar/baixar cada SKU
// uma única vez mesmo quando o carrinho tem linhas repetidas.
function groupBySku(items = []) {
  const bySku = new Map();
  for (const it of items) {
    const sku = it && it.sku;
    const qtd = Number(it && (it.qty ?? it.qtd)) || 0;
    if (!sku || qtd <= 0) continue;
    bySku.set(sku, (bySku.get(sku) || 0) + qtd);
  }
  return [...bySku.entries()].map(([sku, qtd]) => ({ sku, qtd }));
}

async function erpFetch(path, options = {}) {
  const { baseUrl, timeoutMs } = config.erp;
  if (!baseUrl) throw new ErpUnavailableError('ERP_BASE_URL não configurada.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal });
  } catch (err) {
    throw new ErpUnavailableError(`Falha ao contatar o ERP: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// Erro de infraestrutura: ERP fora do ar / timeout / não configurado.
export class ErpUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErpUnavailableError';
  }
}

// Verifica se há saldo para todos os itens. Retorna { ok, faltantes }.
// faltantes: [{ sku, solicitado, disponivel, nome }]. No-op (ok:true) se desligado.
export async function checkStock(items = []) {
  if (!config.erp.enabled) return { ok: true, faltantes: [] };
  const linhas = groupBySku(items);
  if (!linhas.length) return { ok: true, faltantes: [] };

  const faltantes = [];
  for (const { sku, qtd } of linhas) {
    const res = await erpFetch(`/estoque/${encodeURIComponent(sku)}`, { method: 'GET' });
    if (res.status === 503) throw new ErpUnavailableError('ERP temporariamente indisponível.');
    if (!res.ok) throw new ErpUnavailableError(`ERP respondeu HTTP ${res.status} na consulta.`);
    const data = await res.json().catch(() => ({}));
    const disponivel = Number(data.quantidadeDisponivel) || 0;
    if (disponivel < qtd) {
      faltantes.push({ sku, solicitado: qtd, disponivel, nome: data.nome || sku });
    }
  }
  return { ok: faltantes.length === 0, faltantes };
}

// Dá baixa no estoque (após a compra). Retorna { ok, itens } em caso de sucesso.
// Lança ErpUnavailableError (rede/503) — o chamador decide se ignora (a compra
// já foi persistida). No-op (ok:true) se desligado.
export async function decrementStock(items = []) {
  if (!config.erp.enabled) return { ok: true, itens: [] };
  const linhas = groupBySku(items);
  if (!linhas.length) return { ok: true, itens: [] };

  const res = await erpFetch('/estoque/baixa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itens: linhas }),
  });
  if (res.status === 503) throw new ErpUnavailableError('ERP temporariamente indisponível.');
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) {
    // Estoque acabou entre a validação e a baixa: registra, mas não derruba o
    // pedido já confirmado. O operador reconcilia via /admin/erp no mock.
    logger.warn('erp.decrement_conflict', { faltantes: data.faltantes });
    return { ok: false, faltantes: data.faltantes || [] };
  }
  if (!res.ok) throw new ErpUnavailableError(`ERP respondeu HTTP ${res.status} na baixa.`);
  return { ok: true, itens: data.itens || [] };
}

export default { checkStock, decrementStock, ErpUnavailableError };
