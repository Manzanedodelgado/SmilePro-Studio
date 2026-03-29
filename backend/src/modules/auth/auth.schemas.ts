// ─── Auth Zod Schemas ───────────────────────────────────
import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const registerSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string()
        .min(12, 'La contraseña debe tener al menos 12 caracteres')
        .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
        .regex(/[a-z]/, 'Debe contener al menos una minúscula')
        .regex(/[0-9]/, 'Debe contener al menos un número'),
    name: z.string().min(2, 'El nombre es obligatorio'),
    role: z.enum(['admin', 'doctor', 'hygienist', 'reception', 'accounting', 'auxiliary']).optional(),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token requerido'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
