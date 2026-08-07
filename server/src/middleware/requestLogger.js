import { logger } from '../utils/logger.js';

// Structured access log: one line per completed request.
export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
    });
  });
  next();
}

export default requestLogger;
