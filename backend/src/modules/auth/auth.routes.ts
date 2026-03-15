// ─── Auth Routes ────────────────────────────────────────
import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { loginSchema, registerSchema, refreshTokenSchema } from './auth.schemas';

const router = Router();

// Public
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', validate(refreshTokenSchema), AuthController.refresh);

// Authenticated
router.get('/me', authenticate, AuthController.me);
router.post('/logout', authenticate, AuthController.logout);

// Admin only
router.post('/register', authenticate, requireRole('admin'), validate(registerSchema), AuthController.register);

export default router;
