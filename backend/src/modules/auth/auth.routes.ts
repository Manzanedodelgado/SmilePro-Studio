// ─── Auth Routes ────────────────────────────────────────
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { loginSchema, registerSchema, refreshTokenSchema } from './auth.schemas';

// Rate limiter específico para login: máx 10 intentos por IP cada 15 min
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true, // no cuenta intentos exitosos
    message: { success: false, error: { message: 'Demasiados intentos de login. Espera 15 minutos.', code: 'LOGIN_RATE_LIMIT' } },
});

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login con email y contraseña
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       429:
 *         description: Demasiados intentos de login
 */
router.post('/login', loginLimiter, validate(loginSchema), AuthController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar tokens con refresh token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens renovados
 */
router.post('/refresh', validate(refreshTokenSchema), AuthController.refresh);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *       401:
 *         description: Token inválido o expirado
 */
router.get('/me', authenticate, AuthController.me);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión (revocar token)
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Sesión cerrada — token añadido a blacklist
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar nuevo usuario (solo admin)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, dentist, reception, hygienist, auxiliary, manager]
 *     responses:
 *       201:
 *         description: Usuario registrado
 *       403:
 *         description: Solo administradores pueden registrar usuarios
 */
router.post('/register', authenticate, requireRole('admin'), validate(registerSchema), AuthController.register);

export default router;
