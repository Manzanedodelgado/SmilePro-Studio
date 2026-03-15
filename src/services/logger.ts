// ─────────────────────────────────────────────────────────────────
//  services/logger.ts
//  Logger seguro para producción.
//
//  AUDITORÍA-VULN-006 FIX:
//  Reemplaza console.log/warn/error con un logger que silencia
//  mensajes con datos sensibles en producción (VITE_MODE=production).
//
//  USO:
//    import { logger } from './logger';
//    logger.warn('[Citas] NumPac no encontrado:', numPac);
//    logger.error('[Auth] Token inválido:', error);
//    logger.info('[Automations] Seeded');
// ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_DEV = (import.meta as any).env?.DEV === true;
const IS_PROD = !IS_DEV;

/** Niveles de log */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Patrones de datos sensibles que NUNCA deben aparecer en producción.
 * Si algún argumento contiene estos patrones, el log se suprime.
 */
const SENSITIVE_PATTERNS = [
    /NumPac=\d+/,
    /IdPac=\d+/,
    /eyJ[A-Za-z0-9+/=]{10,}/, // JWT tokens
    /gsk_[A-Za-z0-9]{10,}/,   // Groq API keys
    /Bearer\s+\S{10,}/,
];

const containsSensitiveData = (args: unknown[]): boolean => {
    const str = args.map(a => {
        try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    return SENSITIVE_PATTERNS.some(p => p.test(str));
};

const createLogger = (level: LogLevel) => (...args: unknown[]): void => {
    // En producción: suprimir debug e info siempre
    if (IS_PROD && (level === 'debug' || level === 'info')) return;

    // En producción: suprimir logs con datos sensibles detectados
    if (IS_PROD && containsSensitiveData(args)) return;

    /* eslint-disable no-console */
    switch (level) {
        case 'debug': console.debug(...args); break;
        case 'info': console.info(...args); break;
        case 'warn': console.warn(...args); break;
        case 'error': console.error(...args); break;
    }
    /* eslint-enable no-console */
};

export const logger = {
    debug: createLogger('debug'),
    info: createLogger('info'),
    warn: createLogger('warn'),
    error: createLogger('error'),
};
