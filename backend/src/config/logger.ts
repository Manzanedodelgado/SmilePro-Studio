// ─── Winston Logger with Daily Rotation ─────────────────────────────────────
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from './index.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const devFormat = combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level, message, timestamp, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        const stackStr = stack ? `\n${stack}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}${stackStr}`;
    })
);

const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

// ── Daily rotation: 14 days retention, max 20MB per file ──
const errorRotate = new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
});

const combinedRotate = new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
});

export const logger = winston.createLogger({
    level: config.NODE_ENV === 'development' ? 'debug' : 'info',
    format: config.NODE_ENV === 'development' ? devFormat : prodFormat,
    defaultMeta: { service: 'smilepro-backend' },
    transports: [
        new winston.transports.Console(),
        ...(config.NODE_ENV === 'production'
            ? [errorRotate, combinedRotate]
            : []),
    ],
    // Never crash on transport errors
    exitOnError: false,
});

export default logger;
