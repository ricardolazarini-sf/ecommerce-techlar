// Minimal dependency-free structured logger. Emits one JSON object per line,
// which plays nicely with log processors (and Heroku's log drain).

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function currentThreshold() {
  const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[configured] ?? LEVELS.info;
}

function write(level, msg, meta) {
  if (LEVELS[level] < currentThreshold()) return;
  const record = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(meta && typeof meta === 'object' ? meta : {}),
  };
  let line;
  try {
    line = JSON.stringify(record);
  } catch {
    // Fall back if meta has circular refs.
    line = JSON.stringify({ level, time: record.time, msg });
  }
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(line + '\n');
}

export const logger = {
  debug: (msg, meta) => write('debug', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};

export default logger;
