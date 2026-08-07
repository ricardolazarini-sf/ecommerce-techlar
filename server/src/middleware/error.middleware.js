import { logger } from '../utils/logger.js';

// Wraps an async route handler so thrown/rejected errors reach the error handler.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(req, res) {
  res.status(404).json({ error: 'Não encontrado.', path: req.originalUrl });
}

// Centralized error handler. Domain errors set `err.status`; anything else is a
// 500. Never leaks internals to the client, but logs them server-side.
export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    logger.error('request.error', { method: req.method, url: req.originalUrl, err: err.message, stack: err.stack });
  } else {
    logger.warn('request.client_error', { method: req.method, url: req.originalUrl, status, err: err.message });
  }
  res.status(status).json({
    error: status >= 500 ? 'Erro interno do servidor.' : err.message,
  });
}

export default { asyncHandler, notFound, errorHandler };
