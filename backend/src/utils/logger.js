const timestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

export const logger = {
  info: (msg, meta = '') => console.log(`[${timestamp()}] [INFO] [API] ${msg}`, meta ? meta : ''),
  warn: (msg, meta = '') => console.warn(`[${timestamp()}] [WARN] [API] ${msg}`, meta ? meta : ''),
  error: (msg, meta = '') => console.error(`[${timestamp()}] [ERROR] [API] ${msg}`, meta ? meta : ''),
  debug: (msg, meta = '') => {
    if (process.env.DEBUG) console.log(`[${timestamp()}] [DEBUG] [API] ${msg}`, meta ? meta : '');
  }
};

