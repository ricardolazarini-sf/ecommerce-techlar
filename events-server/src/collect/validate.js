import { randomUUID } from 'node:crypto';
import { isKnownEventType, sanitizeProps } from './contract.js';

// Valida o lote que chega do navegador e devolve as linhas prontas para a fila.
//
// Nada aqui confia no cliente: o tipo tem que estar na allowlist, o horário do
// clique não pode vir do futuro nem de antes de ontem (relógio errado de
// máquina é comum, e evento com data absurda estraga a janela do segmento), e
// a identidade vem de fora — do token verificado, nunca do corpo.
//
// Pure logic: recebe o corpo e o e-mail já autenticado, devolve linhas e
// recusas. Sem I/O, testável.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);

function resolveOccurredAt(value, now) {
  const date = value ? new Date(value) : new Date(now);
  if (Number.isNaN(date.getTime())) return new Date(now);
  const t = date.getTime();
  // Relógio adiantado do visitante não pode empurrar o evento para o futuro.
  if (t > now + MAX_CLOCK_SKEW_MS) return new Date(now);
  // Clique guardado numa aba esquecida por dias entra com a hora de agora, para
  // não reescrever o passado de um segmento.
  if (t < now - MAX_AGE_MS) return new Date(now);
  return date;
}

export function validateBatch(body, { email = '', maxEvents = 50, now = Date.now() } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Corpo inválido: esperado um objeto { device_id, events }.' };
  }
  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) {
    return { error: 'Nenhum evento no lote: `events` deve ser um array não vazio.' };
  }
  if (events.length > maxEvents) {
    return { error: `Lote grande demais: ${events.length} eventos, o teto é ${maxEvents}.` };
  }

  const batchDevice = clean(body.device_id);
  const rows = [];
  const rejected = [];
  const seen = new Set();

  for (const raw of events) {
    if (!raw || typeof raw !== 'object') {
      rejected.push({ reason: 'formato' });
      continue;
    }
    const eventType = clean(raw.event_type, 60);
    if (!isKnownEventType(eventType)) {
      rejected.push({ event_type: eventType, reason: 'tipo desconhecido' });
      continue;
    }
    const eventId = UUID_RE.test(String(raw.event_id || '')) ? String(raw.event_id).toLowerCase() : randomUUID();
    // Duplicata dentro do mesmo POST: o banco resolve entre POSTs, aqui evita
    // gastar linha do INSERT.
    if (seen.has(eventId)) continue;
    seen.add(eventId);

    const { device_id: propDevice, ...props } = raw.props && typeof raw.props === 'object' ? raw.props : raw;
    rows.push({
      event_id: eventId,
      event_type: eventType,
      occurred_at: resolveOccurredAt(raw.occurred_at, now),
      device_id: clean(raw.device_id || propDevice || batchDevice),
      email: clean(email, 200).toLowerCase(),
      props: sanitizeProps(props),
    });
  }

  if (!rows.length) {
    return { error: 'Nenhum evento aproveitável no lote.', rejected };
  }
  return { rows, rejected };
}

export default { validateBatch };
