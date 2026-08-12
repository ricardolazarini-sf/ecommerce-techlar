import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

// A identidade do clique só existe se vier de um token assinado pelo mesmo
// segredo do servidor transacional. Aceitar e-mail ou id de cliente de um campo
// do corpo abriria a porta para qualquer um poluir o perfil de outra pessoa na
// Data Cloud — e o dano ali é caro: engajamento falso cola em perfil unificado
// e vaza para segmento.
//
// Sem token, o clique segue anônimo, amarrado só ao device_id. É a limitação
// que o documento de engajamento registra: visitante que nunca se identificou
// só vira perfil depois de um `identify`.

const ANONYMOUS = Object.freeze({ email: '', customerId: '' });

export function identityFromRequest(req) {
  const token = tokenFrom(req);
  if (!token) return ANONYMOUS;
  try {
    const claims = jwt.verify(token, config.jwtSecret);
    return {
      email: String(claims?.email || '').trim().toLowerCase(),
      customerId: customerIdFrom(claims),
    };
  } catch {
    // Token vencido ou forjado: trata como anônimo, sem 401. O clique é útil
    // mesmo sem identidade, e derrubar o POST perderia o dado por completo.
    return ANONYMOUS;
  }
}

// A chave que os DMOs de perfil usam como Individual Id não é o e-mail: é o
// `WEB-PF-<id>`/`WEB-PJ-<id>` que o contrato de clientes monta em
// server/src/integration/data360/contractMappers.js. Reconstruir o mesmo valor
// aqui é o que faz o clique chegar à org já ligável ao perfil, sem depender de
// uma transformação que resolva e-mail → cliente do outro lado.
//
// Token emitido antes de o `tipo` entrar no payload não permite escolher o
// prefixo. Nesses casos o id sai vazio, e não chutado: um `WEB-PF-` posto num
// cliente PJ apontaria para um Individual que não existe, e o erro seria
// invisível. Como o token dura 7 dias, a lacuna se fecha sozinha.
function customerIdFrom(claims) {
  const id = claims?.sub;
  const tipo = claims?.tipo;
  if (id === undefined || id === null || id === '') return '';
  if (tipo !== 'PF' && tipo !== 'PJ') return '';
  return `WEB-${tipo}-${id}`;
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

export default { identityFromRequest };
