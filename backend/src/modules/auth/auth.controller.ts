// ─── Auth Controller ────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { logger } from '../../config/logger.js';
import { prisma } from '../../config/database.js';
import { getRedis } from '../../config/redis.js';
import { generateCsrfToken, setCsrfCookie } from '../../middleware/csrf.js';

// ── Token blacklist: Redis primary (SETEX with auto-TTL) + PostgreSQL fallback ──
// Redis: O(1) lookup, auto-expiry via TTL. No cleanup interval needed.
// PostgreSQL: fallback if Redis is unavailable, with manual cleanup.

const BLACKLIST_PREFIX = 'jwt:revoked:';

const _hashToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

/**
 * Calculate TTL in seconds from JWT expiration claim.
 * Returns 900 (15min) as default if token has no exp claim.
 */
const _getTTL = (token: string): number => {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) return 900;
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    return ttl > 0 ? ttl : 1;
};

/**
 * Add a token to the blacklist.
 * Tries Redis first (SETEX with auto-TTL), falls back to PostgreSQL.
 */
const _addToBlacklist = async (token: string): Promise<void> => {
    const hash = _hashToken(token);
    const ttl = _getTTL(token);

    // 1. Try Redis (primary)
    const redis = getRedis();
    if (redis) {
        try {
            await redis.setex(`${BLACKLIST_PREFIX}${hash}`, ttl, '1');
            return; // Success — no need for PostgreSQL
        } catch (err: any) {
            logger.warn('[BLACKLIST] Redis write failed, falling back to PostgreSQL:', err.message);
        }
    }

    // 2. Fallback: PostgreSQL
    try {
        const expiresAt = new Date(Date.now() + ttl * 1000);
        await prisma.$executeRaw`
            INSERT INTO jwt_blacklist (token_hash, expires_at)
            VALUES (${hash}, ${expiresAt})
            ON CONFLICT (token_hash) DO NOTHING
        `;
    } catch (err: any) {
        logger.error('[BLACKLIST] PostgreSQL write also failed:', err.message);
    }
};

/**
 * Check if a token has been revoked.
 * Tries Redis first (EXISTS), falls back to PostgreSQL.
 */
export const isTokenRevoked = async (token: string): Promise<boolean> => {
    const hash = _hashToken(token);

    // 1. Try Redis (primary)
    const redis = getRedis();
    if (redis) {
        try {
            const exists = await redis.exists(`${BLACKLIST_PREFIX}${hash}`);
            return exists === 1;
        } catch (err: any) {
            logger.warn('[BLACKLIST] Redis read failed, falling back to PostgreSQL:', err.message);
        }
    }

    // 2. Fallback: PostgreSQL
    try {
        const rows = await prisma.$queryRaw<unknown[]>`
            SELECT 1 FROM jwt_blacklist WHERE token_hash = ${hash} AND expires_at > now() LIMIT 1
        `;
        return rows.length > 0;
    } catch {
        return false;
    }
};

// Cleanup expired tokens in PostgreSQL fallback table (every 30 min)
// Redis handles its own TTL expiry — this only cleans the fallback table.
setInterval(async () => {
    try {
        await prisma.$executeRaw`DELETE FROM jwt_blacklist WHERE expires_at < now()`;
    } catch {}
}, 30 * 60 * 1000);

export class AuthController {
    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await AuthService.login(req.body);
            logger.info(`Login exitoso: ${result.user.email}`);

            // Generate and set CSRF token
            const csrfToken = generateCsrfToken();
            setCsrfCookie(res, csrfToken);

            res.json({ success: true, data: { ...result, csrfToken } });
        } catch (error) { next(error); }
    }

    static async register(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await AuthService.register(req.body);
            logger.info(`Usuario registrado: ${user.email} (${user.role})`);
            res.status(201).json({ success: true, data: user });
        } catch (error) { next(error); }
    }

    static async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const oldRefresh = req.body.refreshToken as string;
            const tokens = await AuthService.refresh(oldRefresh);
            res.json({ success: true, data: tokens });
        } catch (error) { next(error); }
    }

    static async me(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await AuthService.getProfile(req.user!.id);
            res.json({ success: true, data: user });
        } catch (error) { next(error); }
    }

    static async logout(req: Request, res: Response) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            await _addToBlacklist(token);
            logger.info(`Token revocado para usuario: ${req.user?.email}`);
        }
        res.json({ success: true, data: { message: 'Sesión cerrada' } });
    }
}
