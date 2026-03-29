// ─── Auth Controller ────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { logger } from '../../config/logger.js';
import { prisma } from '../../config/database.js';

// ── A-3 FIX: Token blacklist persistente en PostgreSQL ────────────────
// Reemplaza el Map en memoria que se perdía en cada reinicio/despliegue.

const _hashToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

const _addToBlacklist = async (token: string): Promise<void> => {
    try {
        const decoded = jwt.decode(token) as { exp?: number } | null;
        const expiresAt = decoded?.exp
            ? new Date(decoded.exp * 1000)
            : new Date(Date.now() + 900_000);
        const hash = _hashToken(token);
        await prisma.$executeRaw`
            INSERT INTO jwt_blacklist (token_hash, expires_at)
            VALUES (${hash}, ${expiresAt})
            ON CONFLICT (token_hash) DO NOTHING
        `;
    } catch (err) {
        logger.error('Error añadiendo token a blacklist:', err);
    }
};

// Limpieza automática de tokens expirados cada 15 min
setInterval(async () => {
    try {
        await prisma.$executeRaw`DELETE FROM jwt_blacklist WHERE expires_at < now()`;
    } catch {}
}, 15 * 60 * 1000);

export const isTokenRevoked = async (token: string): Promise<boolean> => {
    try {
        const hash = _hashToken(token);
        const rows = await prisma.$queryRaw<unknown[]>`
            SELECT 1 FROM jwt_blacklist WHERE token_hash = ${hash} AND expires_at > now() LIMIT 1
        `;
        return rows.length > 0;
    } catch {
        return false;
    }
};

export class AuthController {
    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await AuthService.login(req.body);
            logger.info(`Login exitoso: ${result.user.email}`);
            res.json({ success: true, data: result });
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
