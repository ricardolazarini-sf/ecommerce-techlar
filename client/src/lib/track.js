// Rastreio de engajamento — o lado navegador do coletor (events-server, :3002).
//
// Três regras que explicam o desenho:
//
// 1. Clique nunca atrasa a interface. Nada aqui é esperado com `await` no
//    caminho de um clique: o evento entra numa fila em memória e sai em lote.
// 2. O último clique de quem fecha a aba é o mais interessante (é onde a pessoa
//    desistiu), então o descarregamento usa `navigator.sendBeacon`, que o
//    navegador entrega mesmo depois de a página morrer.
// 3. Falha de rastreio não é erro de loja. Tudo é engolido: se o coletor está
//    fora do ar, o site continua vendendo e o clique se perde — perder clique é
//    aceitável, perder venda não.
//
// O `device_id` é o mesmo do carrinho anônimo (getDeviceId, em api/client.js);
// é o que costura o visitante antes de ele se identificar. O e-mail NÃO viaja
// daqui: quem anexa identidade é o coletor, a partir do token — e é por isso que
// o token acompanha o POST.

import { getDeviceId, getToken } from '../api/client.js';

// Onde o coletor mora, do mais específico para o mais geral:
//   1. VITE_COLLECT_BASE — manda sempre que estiver definida (staging, outro host).
//   2. em dev, string vazia: o proxy do Vite entrega /collect no :3002 local.
//   3. em build de produção, o serviço do coletor no Render.
// O item 3 fica no código, e não só como variável no painel, porque o build da
// SPA congela o valor: um deploy feito sem a variável gera um site que posta em
// /collect na própria origem e recebe 404 para sempre, sem nada quebrar à vista.
const COLETOR_PRODUCAO = 'https://ecommerce-techlar.onrender.com';
const BASE = import.meta.env.VITE_COLLECT_BASE ?? (import.meta.env.DEV ? '' : COLETOR_PRODUCAO);
const ENDPOINT = `${BASE}/collect`;
// Desligável por env para quem roda o site sem o coletor de pé.
const ENABLED = import.meta.env.VITE_TRACK !== '0';

// Teto do lote alinhado com o do coletor (EVENTS_MAX_PER_REQUEST=50).
const MAX_BATCH = 25;
// Janela curta: agrupa a rajada de cliques de uma navegação sem deixar o dado
// velho o suficiente para se perder num fechamento de aba.
const FLUSH_DELAY_MS = 2_000;

let queue = [];
let timer = null;
let installed = false;

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4000-8000-${Math.random()
    .toString(16)
    .slice(2, 14)}`;

function payload(events, { withToken = false } = {}) {
  const body = { device_id: getDeviceId(), events };
  if (withToken) {
    const token = getToken();
    if (token) body.auth = token;
  }
  return JSON.stringify(body);
}

// `sendBeacon` é o único jeito de o POST sobreviver ao fechamento da aba, mas
// ele não carrega header — então, só nesse caminho, o token viaja no CORPO, onde
// o coletor também sabe procurar. Não na query: URL entra em log de acesso, no
// histórico do navegador e em Referer, e token em log é vazamento.
//
// O tipo é text/plain de propósito, mesmo o corpo sendo JSON: com application/json
// o navegador precisaria de um OPTIONS de preflight antes do POST, e preflight na
// hora em que a página está morrendo é justamente o que se perde. text/plain faz
// dele uma requisição simples, que sai direto. O coletor aceita os dois tipos.
function sendWithBeacon(events) {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
  try {
    const blob = new Blob([payload(events, { withToken: true })], {
      type: 'text/plain;charset=UTF-8',
    });
    return navigator.sendBeacon(ENDPOINT, blob);
  } catch {
    return false;
  }
}

function sendWithFetch(events) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // keepalive: o POST continua em voo se a navegação acontecer no meio dele.
  fetch(ENDPOINT, { method: 'POST', headers, body: payload(events), keepalive: true }).catch(() => {
    // Silêncio proposital — ver regra 3 no topo do arquivo.
  });
}

export function flush({ beacon = false } = {}) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue;
  queue = [];
  if (beacon && sendWithBeacon(events)) return;
  sendWithFetch(events);
}

function schedule() {
  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (timer) return;
  timer = setTimeout(flush, FLUSH_DELAY_MS);
}

// Instalado uma vez, na primeira chamada: assim quem só importa o módulo (um
// teste, por exemplo) não ganha listener global de brinde.
function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  // pagehide cobre o que `beforeunload` não cobre no Safari e no iOS.
  window.addEventListener('pagehide', () => flush({ beacon: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush({ beacon: true });
  });
}

// A API que as telas usam. `props` só precisa dos campos que aquele clique tem —
// quem completa o contrato com as 27 chaves é o coletor, na hora de enviar.
export function track(eventType, props = {}) {
  if (!ENABLED || !eventType) return;
  install();
  queue.push({
    event_id: uuid(),
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    props: {
      // Onde a pessoa estava quando clicou. Vale para todo evento, então é
      // preenchido aqui em vez de repetido em cada ponto de clique.
      page_path: typeof location !== 'undefined' ? location.pathname : '',
      ...props,
    },
  });
  schedule();
}

export default track;
