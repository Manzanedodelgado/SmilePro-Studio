// ─── CSRF Protection Middleware ──────────────────────────
// Double Submit Cookie pattern for SPA (compatible with JWT Bearer auth).
// Generates a random CSRF token on login, validates it on state-changing requests.
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { logger } from '../config/logger.js';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

// Paths exempt from CSRF validation
const EXEMPT_PATHS = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/health',
    '/api/centinela/',
    '/api/uptime-webhook',
    '/api/communication/webhook/',
    '/api/clinical/questionnaires',  // Public questionnaire submissions
];

// Methods that don't mutate state — exempt from CSRF
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generate a new CSRF token (32 bytes hex = 64 chars).
 */
export function generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Set CSRF cookie on the response.
 * The cookie is NOT HttpOnly so the frontend can read it and send it as a header.
 */
export function setCsrfCookie(res: Response, token: string): void {
    res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,     // Frontend needs to read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches refresh token)
    });
}

/**
 * Middleware: Validate CSRF token on state-changing requests.
 * Skips safe methods (GET, HEAD, OPTIONS) and exempt paths.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
    // Skip safe methods
    if (SAFE_METHODS.has(req.method)) {
        next();
        return;
    }

    // Skip exempt paths
    const isExempt = EXEMPT_PATHS.some(p => req.path.startsWith(p));
    if (isExempt) {
        next();
        return;
    }

    // Skip if no auth header (unauthenticated requests aren't CSRF-vulnerable)
    if (!req.headers.authorization) {
        next();
        return;
    }

    // Validate: header token must match cookie token
    const headerToken = req.headers[CSRF_HEADER] as string;
    const cookieToken = req.cookies?.[CSRF_COOKIE] as string;

    if (!headerToken || !cookieToken) {
        logger.warn(`[CSRF] Missing token — path: ${req.path}, IP: ${req.ip}`);
        res.status(403).json({
            success: false,
            error: { message: 'CSRF token missing', code: 'CSRF_MISSING' },
        });
        return;
    }

    if (headerToken !== cookieToken) {
        logger.warn(`[CSRF] Token mismatch — path: ${req.path}, IP: ${req.ip}`);
        res.status(403).json({
            success: false,
            error: { message: 'CSRF token invalid', code: 'CSRF_INVALID' },
        });
        return;
    }

    next();
}
