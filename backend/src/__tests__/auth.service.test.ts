// ─── Auth Service Tests ─────────────────────────────────
// Tests for password hashing, token generation, and token verification.
import { AuthService } from '../modules/auth/auth.service';

// Mock Prisma client
jest.mock('../config/database.js', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    },
    prisma: {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    },
}));

// Mock config
jest.mock('../config/index.js', () => ({
    config: {
        JWT_SECRET: 'test-secret-key-minimum-16-chars',
        JWT_REFRESH_SECRET: 'test-refresh-secret-key-minimum-16',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
    },
}));

describe('AuthService', () => {
    describe('hashPassword', () => {
        it('should hash a password with bcrypt', async () => {
            const password = 'test-password-123';
            const hash = await AuthService.hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
        });

        it('should produce different hashes for same password (salt)', async () => {
            const password = 'same-password';
            const hash1 = await AuthService.hashPassword(password);
            const hash2 = await AuthService.hashPassword(password);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('comparePassword', () => {
        it('should return true for matching password', async () => {
            const password = 'my-secure-password';
            const hash = await AuthService.hashPassword(password);

            const match = await AuthService.comparePassword(password, hash);
            expect(match).toBe(true);
        });

        it('should return false for non-matching password', async () => {
            const hash = await AuthService.hashPassword('correct-password');

            const match = await AuthService.comparePassword('wrong-password', hash);
            expect(match).toBe(false);
        });
    });

    describe('generateTokens', () => {
        const mockUser = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'test@rubiogarciadental.com',
            role: 'admin' as const,
            name: 'Dr. Test',
        };

        it('should generate both access and refresh tokens', () => {
            const tokens = AuthService.generateTokens(mockUser);

            expect(tokens.accessToken).toBeDefined();
            expect(tokens.refreshToken).toBeDefined();
            expect(typeof tokens.accessToken).toBe('string');
            expect(typeof tokens.refreshToken).toBe('string');
        });

        it('should generate valid JWT access tokens with user payload', () => {
            const tokens = AuthService.generateTokens(mockUser);

            // JWT has 3 parts separated by dots
            const parts = tokens.accessToken.split('.');
            expect(parts).toHaveLength(3);

            // Decode payload (base64url)
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            expect(payload.id).toBe(mockUser.id);
            expect(payload.email).toBe(mockUser.email);
            expect(payload.role).toBe(mockUser.role);
            expect(payload.name).toBe(mockUser.name);
            expect(payload.exp).toBeDefined(); // has expiration
        });

        it('should generate different tokens for different users', () => {
            const tokens1 = AuthService.generateTokens(mockUser);
            const tokens2 = AuthService.generateTokens({
                ...mockUser,
                id: 'different-id',
                email: 'other@rubiogarciadental.com',
            });

            expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
            expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
        });
    });

    describe('verifyRefreshToken', () => {
        const mockUser = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'test@rubiogarciadental.com',
            role: 'admin' as const,
            name: 'Dr. Test',
        };

        it('should verify a valid refresh token and return user id', () => {
            const { refreshToken } = AuthService.generateTokens(mockUser);

            const decoded = AuthService.verifyRefreshToken(refreshToken);
            expect(decoded.id).toBe(mockUser.id);
        });

        it('should throw for invalid refresh token', () => {
            expect(() => AuthService.verifyRefreshToken('invalid-token')).toThrow();
        });

        it('should throw for access token used as refresh (wrong secret)', () => {
            const { accessToken } = AuthService.generateTokens(mockUser);

            // Access token is signed with JWT_SECRET, not JWT_REFRESH_SECRET
            expect(() => AuthService.verifyRefreshToken(accessToken)).toThrow();
        });
    });
});
