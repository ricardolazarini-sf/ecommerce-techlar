import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

// O e-mail do clique só existe se vier de um token assinado pelo mesmo segredo
// do servidor transacional. Aceitar e-mail de campo do corpo abriria a porta
// para qualquer um poluir o perfil de outra pessoa na Data Cloud — e o dano ali
// é caro: engajamento falso cola em perfil unificado e vaza para segmento.
//
// Sem token, o clique segue anônimo, amarrado só ao device_id. É a limitação
// que o documento de engajamento registra: visitante que nunca se identificou
// só vira perfil depois de um `identify`.
export function emailFromRequest(req) {
  const token = tokenFrom(req);
  if (!token) return '';
  try {
    const claims = jwt.verify(token, config.jwtSecret);
    return String(claims?.email || '').trim().toLowerCase();
  } catch {
    // Token vencido ou forjado: trata como anônimo, sem 401. O clique é útil
    // mesmo sem identidade, e derrubar o POST perderia o dado por completo.
    return '';
  }
}

// O header é o caminho normal. O corpo é a exceção do `sendBeacon`, que entrega
// o último clique de quem fechou a aba mas não deixa mandar header. Query string
// não é aceita de propósito: token em URL vaza para log de acesso e histórico.
function tokenFrom(req) {
  const header = req.get?.('authorization') || '';
  const [scheme, headerToken] = header.split(' ');
  if (scheme === 'Bearer' && headerToken) return headerToken;
  const bodyToken = req.body?.auth;
  return typeof bodyToken === 'string' && bodyToken ? bodyToken : '';
}

export default { emailFromRequest };
