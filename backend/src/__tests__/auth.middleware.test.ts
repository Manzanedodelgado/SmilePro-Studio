// ─── Auth Middleware Tests ───────────────────────────────
// Tests for JWT authentication middleware: token verification, blacklist, optional auth.
import jwt from 'jsonwebtoken';

// Mock config
jest.mock('../config/index.js', () => ({
    config: {
        JWT_SECRET: 'test-secret-key-minimum-16-chars',
        JWT_REFRESH_SECRET: 'test-refresh-secret-key-16-chars',
    },
}));

// Mock the auth controller (blacklist)
const mockIsTokenRevoked = jest.fn().mockResolvedValue(false);
jest.mock('../modules/auth/auth.controller.js', () => ({
    isTokenRevoked: (...args: any[]) => mockIsTokenRevoked(...args),
}));

import { authenticate, optionalAuth, AuthError } from '../middleware/auth';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = 'test-secret-key-minimum-16-chars';

function mockReq(overrides: Partial<Request> = {}): Request {
    return {
        headers: {},
        ...overrides,
    } as Request;
}

function mockRes(): Response {
    return {} as Response;
}

describe('authenticate middleware', () => {
    it('should reject requests without Authorization header', (done) => {
        const req = mockReq();
        const res = mockRes();

        authenticate(req, res, (err) => {
            expect(err).toBeInstanceOf(AuthError);
            expect((err as AuthError).message).toContain('no proporcionado');
            done();
        });
    });

    it('should reject requests with non-Bearer authorization', (done) => {
        const req = mockReq({ headers: { authorization: 'Basic abc123' } });
        const res = mockRes();

        authenticate(req, res, (err) => {
            expect(err).toBeInstanceOf(AuthError);
            done();
        });
    });

    it('should reject expired tokens', (done) => {
        const token = jwt.sign(
            { id: 'test', email: 'a@b.com', role: 'admin', name: 'Test' },
            JWT_SECRET,
            { expiresIn: -10 } // already expired
        );
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        const res = mockRes();

        authenticate(req, res, (err) => {
            expect(err).toBeInstanceOf(AuthError);
            expect((err as AuthError).message).toContain('expirado');
            done();
        });
    });

    it('should reject invalid tokens', (done) => {
        const req = mockReq({ headers: { authorization: 'Bearer invalid.jwt.token' } });
        const res = mockRes();

        authenticate(req, res, (err) => {
            expect(err).toBeInstanceOf(AuthError);
            expect((err as AuthError).message).toContain('inválido');
            done();
        });
    });

    it('should accept valid tokens and set req.user', (done) => {
        const payload = { id: 'user-1', email: 'dr@dental.com', role: 'admin', name: 'Dr. García' };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        const res = mockRes();
        mockIsTokenRevoked.mockResolvedValue(false);

        authenticate(req, res, (err) => {
            expect(err).toBeUndefined();
            expect(req.user).toBeDefined();
            expect(req.user!.id).toBe(payload.id);
            expect(req.user!.email).toBe(payload.email);
            expect(req.user!.role).toBe(payload.role);
            done();
        });
    });

    it('should reject revoked (blacklisted) tokens', (done) => {
        const token = jwt.sign(
            { id: 'user-1', email: 'dr@dental.com', role: 'admin', name: 'Dr.' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        const res = mockRes();
        mockIsTokenRevoked.mockResolvedValue(true);

        authenticate(req, res, (err) => {
            expect(err).toBeInstanceOf(AuthError);
            expect((err as AuthError).message).toContain('revocado');
            done();
        });
    });
});

describe('optionalAuth middleware', () => {
    it('should continue without error when no token is present', (done) => {
        const req = mockReq();
        const res = mockRes();

        optionalAuth(req, res, (err) => {
            expect(err).toBeUndefined();
            expect(req.user).toBeUndefined();
            done();
        });
    });

    it('should set req.user for valid tokens', (done) => {
        const payload = { id: 'user-1', email: 'a@b.com', role: 'admin', name: 'Test' };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        const res = mockRes();

        optionalAuth(req, res, () => {
            expect(req.user).toBeDefined();
            expect(req.user!.id).toBe(payload.id);
            done();
        });
    });

    it('should continue without user for invalid tokens', (done) => {
        const req = mockReq({ headers: { authorization: 'Bearer bad-token' } });
        const res = mockRes();

        optionalAuth(req, res, () => {
            expect(req.user).toBeUndefined();
            done();
        });
    });
});

describe('AuthError', () => {
    it('should default to 401 status code', () => {
        const err = new AuthError('test');
        expect(err.statusCode).toBe(401);
        expect(err.name).toBe('AuthError');
    });

    it('should accept custom status code', () => {
        const err = new AuthError('forbidden', 403);
        expect(err.statusCode).toBe(403);
    });
});
