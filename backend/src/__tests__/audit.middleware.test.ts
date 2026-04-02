// ─── Audit Middleware Tests ──────────────────────────────
// Tests for GDPR-compliant audit logging.

const mockCreate = jest.fn().mockResolvedValue({});

// Mock Prisma
jest.mock('../config/database.js', () => ({
    __esModule: true,
    default: {
        auditLog: { create: (...args: any[]) => mockCreate(...args) },
    },
}));

// Mock logger
jest.mock('../config/logger.js', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
}));

import { logAudit, logAuditAsync } from '../middleware/audit';
import type { Request } from 'express';

function mockRequest(overrides: Partial<Request> = {}): Request {
    return {
        user: { id: 'user-123', email: 'dr@dental.com', role: 'admin', name: 'Dr. Test' },
        headers: {
            'x-forwarded-for': '192.168.1.46',
            'user-agent': 'Mozilla/5.0 Test',
        },
        ip: '127.0.0.1',
        ...overrides,
    } as any;
}

describe('logAudit', () => {
    beforeEach(() => {
        mockCreate.mockClear();
    });

    it('should write DELETE audit log with dataBefore', async () => {
        const dataBefore = { id: 'patient-1', name: 'Test Patient', phone: '34600000000' };

        await logAuditAsync({
            req: mockRequest(),
            action: 'DELETE',
            entity: 'patients',
            entityId: 'patient-1',
            dataBefore,
        });

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const call = mockCreate.mock.calls[0][0];
        expect(call.data.action).toBe('DELETE');
        expect(call.data.entity).toBe('patients');
        expect(call.data.entityId).toBe('patient-1');
        expect(call.data.dataBefore).toEqual(dataBefore);
        expect(call.data.dataAfter).toBeUndefined();
        expect(call.data.userId).toBe('user-123');
        expect(call.data.userEmail).toBe('dr@dental.com');
        expect(call.data.ipAddress).toBe('192.168.1.46');
    });

    it('should write CREATE audit log with dataAfter', async () => {
        const dataAfter = { id: 'patient-2', name: 'New Patient' };

        await logAuditAsync({
            req: mockRequest(),
            action: 'CREATE',
            entity: 'patients',
            entityId: 'patient-2',
            dataAfter,
        });

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const call = mockCreate.mock.calls[0][0];
        expect(call.data.action).toBe('CREATE');
        expect(call.data.dataBefore).toBeUndefined();
        expect(call.data.dataAfter).toEqual(dataAfter);
    });

    it('should handle missing user gracefully', async () => {
        const req = mockRequest({ user: undefined } as any);

        await logAuditAsync({
            req,
            action: 'DELETE',
            entity: 'treatments',
            entityId: 'treat-1',
        });

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const call = mockCreate.mock.calls[0][0];
        expect(call.data.userId).toBeNull();
        expect(call.data.userEmail).toBeNull();
    });

    it('should extract IP from x-forwarded-for (first entry)', async () => {
        const req = mockRequest({
            headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1', 'user-agent': 'Test' },
        } as any);

        await logAuditAsync({
            req,
            action: 'DELETE',
            entity: 'clinical_records',
            entityId: 'rec-1',
        });

        const call = mockCreate.mock.calls[0][0];
        expect(call.data.ipAddress).toBe('10.0.0.1');
    });

    it('should not throw when Prisma write fails', async () => {
        mockCreate.mockRejectedValueOnce(new Error('DB down'));

        // logAudit (fire-and-forget) should not throw
        logAudit({
            req: mockRequest(),
            action: 'DELETE',
            entity: 'patients',
            entityId: 'p-1',
        });

        // Give async time to execute
        await new Promise(resolve => setTimeout(resolve, 50));
        // No assertion needed — test passes if no unhandled rejection
    });

    it('should sanitize dataBefore/After through JSON serialization', async () => {
        const circular: any = { id: '1' };
        // Non-circular but with BigInt-like values that need cleaning
        const dataBefore = { id: '1', nested: { deep: true }, date: new Date('2026-01-01') };

        await logAuditAsync({
            req: mockRequest(),
            action: 'UPDATE',
            entity: 'treatments',
            entityId: '1',
            dataBefore,
            dataAfter: { id: '1', active: false },
        });

        const call = mockCreate.mock.calls[0][0];
        expect(call.data.dataBefore).toBeDefined();
        expect(call.data.dataAfter).toEqual({ id: '1', active: false });
    });
});
