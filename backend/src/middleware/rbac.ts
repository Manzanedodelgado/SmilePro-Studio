// ─── Role-Based Access Control Middleware ────────────────
import { Request, Response, NextFunction } from 'express';
import { AuthError } from './auth.js';
import type { UserRole } from '@prisma/client';

/**
 * Middleware factory: Require that the authenticated user has one of the specified roles.
 * Must be used AFTER authenticate middleware.
 *
 * @example
 * router.get('/admin', authenticate, requireRole('admin'), handler);
 * router.get('/clinical', authenticate, requireRole('admin', 'doctor', 'hygienist'), handler);
 */
export function requireRole(...roles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new AuthError('Autenticación requerida'));
            return;
        }

        if (!roles.includes(req.user.role)) {
            next(new AuthError(`Acceso denegado. Se requiere rol: ${roles.join(', ')}`, 403));
            return;
        }

        next();
    };
}

/**
 * Permission definitions per role.
 * Used for fine-grained access control beyond simple role checks.
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    admin: ['*'], // All permissions
    doctor: [
        'patients:read', 'patients:write',
        'appointments:read', 'appointments:write',
        'treatments:read', 'treatments:write',
        'billing:read',
        'imaging:read', 'imaging:write',
        'communication:read', 'communication:write',
        'ai:use',
    ],
    hygienist: [
        'patients:read',
        'appointments:read', 'appointments:write:own',
        'treatments:read',
        'imaging:read',
    ],
    reception: [
        'patients:read', 'patients:write:basic',
        'appointments:read', 'appointments:write',
        'billing:read', 'billing:write:payments',
        'communication:read', 'communication:write',
    ],
    accounting: [
        'patients:read:basic',
        'billing:read', 'billing:write',
        'accounting:read', 'accounting:write',
    ],
    auxiliary: [
        'patients:read:basic',
        'appointments:read',
    ],
};

/**
 * Middleware factory: Require a specific permission.
 * Admin role has wildcard '*' permission (access to everything).
 */
export function requirePermission(permission: string) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new AuthError('Autenticación requerida'));
            return;
        }

        const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];

        if (userPermissions.includes('*') || userPermissions.includes(permission)) {
            next();
            return;
        }

        next(new AuthError(`Permiso denegado: ${permission}`, 403));
    };
}
