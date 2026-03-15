// ─── Zod Validation Middleware ───────────────────────────
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Middleware factory: Validate request body/params/query against a Zod schema.
 *
 * @example
 * router.post('/patients', validate(createPatientSchema), controller.create);
 */
export function validate(schema: ZodSchema, source: 'body' | 'params' | 'query' = 'body') {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            const error = new ValidationError(result.error);
            next(error);
            return;
        }

        // Replace the source with the parsed (cleaned/transformed) data
        req[source] = result.data;
        next();
    };
}

/**
 * Validate multiple sources at once
 */
export function validateRequest(schemas: {
    body?: ZodSchema;
    params?: ZodSchema;
    query?: ZodSchema;
}) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const errors: Record<string, unknown> = {};

        for (const [source, schema] of Object.entries(schemas)) {
            if (schema) {
                const result = schema.safeParse(req[source as keyof typeof schemas]);
                if (!result.success) {
                    errors[source] = result.error.flatten().fieldErrors;
                } else {
                    (req as unknown as Record<string, unknown>)[source] = result.data;
                }
            }
        }

        if (Object.keys(errors).length > 0) {
            next(new ValidationError(errors));
            return;
        }

        next();
    };
}

export class ValidationError extends Error {
    statusCode = 400;
    errors: unknown;

    constructor(errors: ZodError | Record<string, unknown>) {
        super('Error de validación');
        this.name = 'ValidationError';
        this.errors = errors instanceof ZodError ? errors.flatten().fieldErrors : errors;
    }
}
