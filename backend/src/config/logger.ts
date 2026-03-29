// ─── Winston Logger ─────────────────────────────────────
import winston from 'winston';
import { config } from './index.js';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss' }),
    printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
    })
);

const prodFormat = combine(
    timestamp(),
    json()
);

export const logger = winston.createLogger({
    level: config.NODE_ENV === 'development' ? 'debug' : 'info',
    format: config.NODE_ENV === 'development' ? devFormat : prodFormat,
    transports: [
        new winston.transports.Console(),
        // In production, also log to files
        ...(config.NODE_ENV === 'production'
            ? [
                new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/combined.log' }),
            ]
            : []),
    ],
});

export default logger;
