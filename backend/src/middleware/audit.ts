// ─── Audit Logging Middleware (GDPR Compliance) ─────────
// Logs all data mutations (CREATE, UPDATE, DELETE) with before/after snapshots.
// Writes asynchronously to avoid blocking the HTTP response.
import { Request } from 'express';
import prisma from '../config/database.js';
import { logger } from '../config/logger.js';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

interface AuditParams {
    req: Request;
    action: AuditAction;
    entity: string;          // e.g. 'patients', 'clinical_records', 'treatments'
    entityId: string;
    dataBefore?: unknown;    // Snapshot of record before mutation
    dataAfter?: unknown;     // Snapshot of record after mutation (null for DELETE)
}

/**
 * Log an auditable action. Fire-and-forget — does not block the response.
 * 
 * Usage in route handlers:
 *   // Before delete:
 *   const record = await prisma.patient.findUnique({ where: { id } });
 *   await prisma.patient.delete({ where: { id } });
 *   logAudit({ req, action: 'DELETE', entity: 'patients', entityId: id, dataBefore: record });
 */
export function logAudit({ req, action, entity, entityId, dataBefore, dataAfter }: AuditParams): void {
    // Fire-and-forget — errors are logged but don't affect the response
    _writeAuditLog(req, action, entity, entityId, dataBefore, dataAfter).catch((err) => {
        logger.error(`[AUDIT] Failed to write ${action} log for ${entity}/${entityId}:`, err.message);
    });
}

/**
 * Async version that returns a promise — use when you need to ensure the log is written.
 */
export async function logAuditAsync(params: AuditParams): Promise<void> {
    return _writeAuditLog(params.req, params.action, params.entity, params.entityId, params.dataBefore, params.dataAfter);
}

async function _writeAuditLog(
    req: Request,
    action: AuditAction,
    entity: string,
    entityId: string,
    dataBefore?: unknown,
    dataAfter?: unknown,
): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: req.user?.id ?? null,
                userEmail: req.user?.email ?? null,
                action,
                entity,
                entityId: String(entityId),
                dataBefore: dataBefore ? JSON.parse(JSON.stringify(dataBefore)) : undefined,
                dataAfter: dataAfter ? JSON.parse(JSON.stringify(dataAfter)) : undefined,
                ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
                userAgent: req.headers['user-agent'] || null,
            },
        });

        logger.info(`[AUDIT] ${action} ${entity}/${entityId} by ${req.user?.email || 'unknown'}`);
    } catch (err: any) {
        logger.error(`[AUDIT] DB write failed: ${err.message}`);
    }
}
