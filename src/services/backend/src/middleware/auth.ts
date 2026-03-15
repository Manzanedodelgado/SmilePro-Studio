// ─── JWT Authentication Middleware ───────────────────────
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import type { UserRole } from '@prisma/client';

// Extend Express Request to include user
export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    name: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
        super(message);
        this.name = 'AuthError';
        this.statusCode = statusCode;
    }
}

// ── T-001: Importación lazy de la blacklist para evitar circular dependency ──
// La blacklist vive en auth.controller.ts (mismo proceso Node).
// Se importa dinámicamente para no crear dependencia circular.
let _isRevoked: ((token: string) => boolean) | null = null;
const isRevoked = async (token: string): Promise<boolean> => {
    if (!_isRevoked) {
        try {
            const mod = await import('../modules/auth/auth.controller.js');
            _isRevoked = mod.isTokenRevoked;
        } catch {
            return false; // Si falla el import, no bloquear
        }
    }
    return _isRevoked(token);
};

/**
 * Middleware: Verify JWT access token from Authorization header
 * T-001: también comprueba la blacklist de tokens revocados tras logout.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        next(new AuthError('Token de acceso no proporcionado'));
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as AuthUser;

        // T-001: Verificar blacklist (logout revocó este token)
        isRevoked(token).then(revoked => {
            if (revoked) {
                next(new AuthError('Token revocado — inicia sesión de nuevo'));
                return;
            }
            req.user = decoded;
            next();
        }).catch(() => {
            // Si la comprobación falla, continuar con el token válido
            req.user = decoded;
            next();
        });
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            next(new AuthError('Token expirado'));
        } else {
            next(new AuthError('Token inválido'));
        }
    }
}

/**
 * Middleware: Optional authentication — sets req.user if token is present but doesn't require it
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        next();
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as AuthUser;
        req.user = decoded;
    } catch {
        // Token invalid/expired — continue without user
    }

    next();
}
