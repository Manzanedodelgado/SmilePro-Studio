// ─── Auth Controller ────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { logger } from '../../config/logger.js';
import { config } from '../../config/index';

// ── T-001 FIX: Token blacklist en memoria ────────────────
// Almacena los JTI (o tokens raw) invalidados hasta su expiración natural.
// Para producción real se recomienda Redis, pero esto es efectivo en desarrollo.
// Se limpia automáticamente cada 15 minutos para evitar memory leaks.

const _blacklist = new Map<string, number>(); // token → expiry timestamp (ms)

const _addToBlacklist = (token: string): void => {
    try {
        const decoded = jwt.decode(token) as { exp?: number } | null;
        const expMs = decoded?.exp ? decoded.exp * 1000 : Date.now() + 900_000; // 15 min fallback
        _blacklist.set(token, expMs);
    } catch {
        _blacklist.set(token, Date.now() + 900_000);
    }
};

// Limpieza automática de tokens expirados cada 15 min
setInterval(() => {
    const now = Date.now();
    for (const [token, exp] of _blacklist) {
        if (exp < now) _blacklist.delete(token);
    }
}, 15 * 60 * 1000);

/**
 * Comprueba si un token está en la blacklist (revocado).
 * Importar este helper desde auth.ts para proteger todas las rutas.
 */
export const isTokenRevoked = (token: string): boolean => {
    const exp = _blacklist.get(token);
    if (!exp) return false;
    if (Date.now() > exp) {
        _blacklist.delete(token);
        return false;
    }
    return true;
};

export class AuthController {
    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await AuthService.login(req.body);
            logger.info(`Login exitoso: ${result.user.email}`);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async register(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await AuthService.register(req.body);
            logger.info(`Usuario registrado: ${user.email} (${user.role})`);
            res.status(201).json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    }

    static async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            // Invalidar el refresh token usado (rotación de tokens)
            const oldRefresh = req.body.refreshToken as string;
            const tokens = await AuthService.refresh(oldRefresh);
            res.json({ success: true, data: tokens });
        } catch (error) {
            next(error);
        }
    }

    static async me(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await AuthService.getProfile(req.user!.id);
            res.json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    }

    // T-001 FIX: Logout ahora invalida el access token en la blacklist
    static async logout(req: Request, res: Response) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            _addToBlacklist(token);
            logger.info(`Token revocado para usuario: ${req.user?.email}`);
        }
        res.json({ success: true, data: { message: 'Sesión cerrada' } });
    }
}
