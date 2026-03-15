// ─── Auth Service ───────────────────────────────────────
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../../config/index.js';
import prisma from '../../config/database.js';
import type { AuthUser } from '../../middleware/auth.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const SALT_ROUNDS = 12;

export class AuthService {
    /**
     * Hash a password with bcrypt
     */
    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }

    /**
     * Compare a plain password with a hashed one
     */
    static async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Generate access + refresh token pair
     */
    static generateTokens(user: AuthUser): { accessToken: string; refreshToken: string } {
        const accessPayload = { id: user.id, email: user.email, role: user.role, name: user.name };
        const refreshPayload = { id: user.id };

        const accessOptions: SignOptions = { expiresIn: 900 }; // 15 minutes
        const refreshOptions: SignOptions = { expiresIn: 604800 }; // 7 days

        const accessToken = jwt.sign(accessPayload, config.JWT_SECRET, accessOptions);
        const refreshToken = jwt.sign(refreshPayload, config.JWT_REFRESH_SECRET, refreshOptions);

        return { accessToken, refreshToken };
    }

    /**
     * Verify a refresh token and return the decoded payload
     */
    static verifyRefreshToken(token: string): { id: string } {
        return jwt.verify(token, config.JWT_REFRESH_SECRET) as { id: string };
    }

    /**
     * Login with email and password
     */
    static async login(input: LoginInput) {
        const user = await prisma.user.findUnique({
            where: { email: input.email },
        });

        if (!user || !user.active) {
            throw new Error('Credenciales inválidas');
        }

        const validPassword = await this.comparePassword(input.password, user.password);
        if (!validPassword) {
            throw new Error('Credenciales inválidas');
        }

        const authUser: AuthUser = {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
        };

        const tokens = this.generateTokens(authUser);

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        return { user: authUser, ...tokens };
    }

    /**
     * Register a new user (admin only)
     */
    static async register(input: RegisterInput) {
        const existing = await prisma.user.findUnique({
            where: { email: input.email },
        });

        if (existing) {
            throw new Error('El email ya está registrado');
        }

        const hashedPassword = await this.hashPassword(input.password);

        const user = await prisma.user.create({
            data: {
                email: input.email,
                password: hashedPassword,
                name: input.name,
                role: input.role || 'auxiliary',
            },
        });

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
    }

    /**
     * Refresh tokens using a valid refresh token
     */
    static async refresh(refreshToken: string) {
        const decoded = this.verifyRefreshToken(refreshToken);

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user || !user.active) {
            throw new Error('Usuario no encontrado o inactivo');
        }

        const authUser: AuthUser = {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
        };

        return this.generateTokens(authUser);
    }

    /**
     * Get current user profile
     */
    static async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                specialty: true,
                createdAt: true,
                lastLogin: true,
            },
        });

        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        return user;
    }
}
