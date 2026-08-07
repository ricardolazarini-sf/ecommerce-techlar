import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

// JWT helpers for customer auth. The token carries the minimal claims needed to
// identify the customer on subsequent requests.

export function signToken(customer) {
  const payload = {
    sub: customer.id,
    email: customer.email,
    nome: customer.nome,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export default { signToken, verifyToken };
