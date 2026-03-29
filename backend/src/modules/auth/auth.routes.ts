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

// Public
router.post('/login', loginLimiter, validate(loginSchema), AuthController.login);
router.post('/refresh', validate(refreshTokenSchema), AuthController.refresh);

// Authenticated
router.get('/me', authenticate, AuthController.me);
router.post('/logout', authenticate, AuthController.logout);

// Admin only
router.post('/register', authenticate, requireRole('admin'), validate(registerSchema), AuthController.register);

export default router;
