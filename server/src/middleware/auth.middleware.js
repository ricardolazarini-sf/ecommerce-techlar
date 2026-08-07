import { verifyToken } from '../customers/auth.js';

function extractToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return null;
}

// Attaches req.user if a valid token is present; otherwise continues anonymously.
export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const claims = verifyToken(token);
      req.user = { id: claims.sub, email: claims.email, nome: claims.nome };
    } catch {
      // Ignore invalid tokens for optional auth — treat as anonymous.
    }
  }
  next();
}

// Requires a valid token; 401 otherwise.
export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const claims = verifyToken(token);
    req.user = { id: claims.sub, email: claims.email, nome: claims.nome };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export default { optionalAuth, requireAuth };
