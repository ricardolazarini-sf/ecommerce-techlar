import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

// JWT helpers for customer auth. The token carries the minimal claims needed to
// identify the customer on subsequent requests.

export function signToken(customer) {
  const payload = {
    sub: customer.id,
    email: customer.email,
    nome: customer.nome,
    // The engagement collector rebuilds the Data Cloud individual key from
    // sub + tipo (WEB-PF-<id> / WEB-PJ-<id>, see contractMappers.js). Without
    // tipo it can't tell which prefix to use, and the click reaches the org
    // with no way to attach to a profile.
    tipo: customer.tipo === 'PJ' ? 'PJ' : 'PF',
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export default { signToken, verifyToken };
