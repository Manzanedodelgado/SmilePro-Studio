// ─── Centralized Error Handler ───────────────────────────
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { AuthError } from './auth.js';
import { ValidationError } from './validate.js';

interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code?: string;
        details?: unknown;
    };
}

/**
 * Global error handler middleware. Must be registered LAST in the middleware chain.
 */
export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    // Log the error
    logger.error(`${req.method} ${req.path} — ${err.message}`, {
        stack: err.stack,
        userId: req.user?.id,
        ip: req.ip,
    });

    const response: ErrorResponse = {
        success: false,
        error: { message: 'Error interno del servidor' },
    };

    // Authentication errors
    if (err instanceof AuthError) {
        response.error.message = err.message;
        response.error.code = 'AUTH_ERROR';
        res.status(err.statusCode).json(response);
        return;
    }

    // Validation errors
    if (err instanceof ValidationError) {
        response.error.message = err.message;
        response.error.code = 'VALIDATION_ERROR';
        response.error.details = err.errors;
        res.status(err.statusCode).json(response);
        return;
    }

    // Prisma errors
    if (err.name === 'PrismaClientKnownRequestError') {
        const prismaErr = err as Error & { code: string; meta?: Record<string, unknown> };
        switch (prismaErr.code) {
            case 'P2002':
                response.error.message = 'Ya existe un registro con esos datos';
                response.error.code = 'DUPLICATE_ENTRY';
                res.status(409).json(response);
                return;
            case 'P2025':
                response.error.message = 'Registro no encontrado';
                response.error.code = 'NOT_FOUND';
                res.status(404).json(response);
                return;
            default:
                response.error.message = 'Error de base de datos';
                response.error.code = 'DB_ERROR';
                res.status(400).json(response);
                return;
        }
    }

    // Default: 500 Internal Server Error
    // In development, include the actual error message
    if (process.env.NODE_ENV === 'development') {
        response.error.message = err.message;
        response.error.details = err.stack;
    }

    res.status(500).json(response);
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        success: false,
        error: {
            message: `Ruta no encontrada: ${req.method} ${req.path}`,
            code: 'NOT_FOUND',
        },
    });
}
