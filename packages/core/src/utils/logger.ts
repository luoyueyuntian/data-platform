/**
 * Lightweight structured logger for the SSAS platform.
 *
 * Usage:
 *   import { createLogger } from '@ssas/core';
 *   const log = createLogger('api');
 *   log.info({ userId: '123' }, 'user logged in');
 *   log.error({ err }, 'something broke');
 */

export interface Logger {
  info(obj: Record<string, unknown> | string, msg?: string): void;
  warn(obj: Record<string, unknown> | string, msg?: string): void;
  error(obj: Record<string, unknown> | string, msg?: string): void;
  debug(obj: Record<string, unknown> | string, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

/**
 * Create a logger instance for a given module/service name.
 */
export function createLogger(service: string): Logger {
  return createConsoleLogger(service);
}

function createConsoleLogger(service: string): Logger {
  const prefix = `[${service}]`;
  const isProduction = process.env.NODE_ENV === 'production';

  function format(obj: Record<string, unknown> | string, msg?: string): string {
    if (typeof obj === 'string') return `${prefix} ${obj}`;
    return `${prefix} ${msg ?? ''} ${JSON.stringify(obj)}`;
  }

  return {
    info: (obj, msg) => {
      if (isProduction) {
        process.stdout.write(JSON.stringify({ level: 'info', service, ...(typeof obj === 'object' ? obj : {}), msg: typeof obj === 'string' ? obj : msg, time: new Date().toISOString() }) + '\n');
      } else {
        console.log(format(obj, msg));
      }
    },
    warn: (obj, msg) => {
      if (isProduction) {
        process.stdout.write(JSON.stringify({ level: 'warn', service, ...(typeof obj === 'object' ? obj : {}), msg: typeof obj === 'string' ? obj : msg, time: new Date().toISOString() }) + '\n');
      } else {
        console.warn(format(obj, msg));
      }
    },
    error: (obj, msg) => {
      if (isProduction) {
        process.stderr.write(JSON.stringify({ level: 'error', service, ...(typeof obj === 'object' ? obj : {}), msg: typeof obj === 'string' ? obj : msg, time: new Date().toISOString() }) + '\n');
      } else {
        console.error(format(obj, msg));
      }
    },
    debug: (obj, msg) => {
      if (!isProduction) {
        console.debug(format(obj, msg));
      }
    },
    child: (bindings) => {
      const childPrefix = `${prefix} ${JSON.stringify(bindings)}`;
      return {
        info: (o, m) => console.log(`${childPrefix} ${typeof o === 'string' ? o : m ?? ''}`, typeof o === 'object' ? o : ''),
        warn: (o, m) => console.warn(`${childPrefix} ${typeof o === 'string' ? o : m ?? ''}`, typeof o === 'object' ? o : ''),
        error: (o, m) => console.error(`${childPrefix} ${typeof o === 'string' ? o : m ?? ''}`, typeof o === 'object' ? o : ''),
        debug: (o, m) => console.debug(`${childPrefix} ${typeof o === 'string' ? o : m ?? ''}`, typeof o === 'object' ? o : ''),
        child: (b) => createConsoleLogger(`${service} ${JSON.stringify({ ...bindings, ...b })}`),
      };
    },
  };
}
