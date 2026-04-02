// ─── Redis Client Singleton ─────────────────────────────
// Used for JWT blacklist (TTL-based), session cache, and IA state.
// Falls back gracefully if Redis is unavailable.
import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from './logger.js';

let redis: Redis | null = null;
let isConnected = false;

/**
 * Get or create the Redis singleton.
 * If REDIS_URL is not set or connection fails, returns null (caller must handle).
 */
export function getRedis(): Redis | null {
    if (redis) return redis;

    try {
        redis = new Redis(config.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 5) {
                    logger.warn('[REDIS] Max reconnection attempts reached — giving up');
                    return null; // stop retrying
                }
                return Math.min(times * 200, 3000);
            },
            lazyConnect: false,
            db: 0, // DB 0 assigned to backend
        });

        redis.on('connect', () => {
            isConnected = true;
            logger.info('[REDIS] Connected successfully');
        });

        redis.on('error', (err) => {
            isConnected = false;
            logger.error('[REDIS] Connection error:', err.message);
        });

        redis.on('close', () => {
            isConnected = false;
            logger.warn('[REDIS] Connection closed');
        });

        return redis;
    } catch (err: any) {
        logger.error('[REDIS] Failed to create client:', err.message);
        return null;
    }
}

/**
 * Check if Redis is currently connected and responsive.
 */
export function isRedisConnected(): boolean {
    return isConnected && redis !== null;
}

/**
 * Graceful shutdown — close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
        isConnected = false;
        logger.info('[REDIS] Connection closed (graceful shutdown)');
    }
}
