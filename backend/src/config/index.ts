// ─── SmileStudio Backend Config ──────────────────────────
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    // Database
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().optional().default('redis://localhost:6379'),

    // Auth
    JWT_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // Server
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    // IA — Proveedores
    GEMINI_API_KEY:     z.string().optional(),
    GROQ_API_KEY:       z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    DEEPSEEK_API_KEY:   z.string().optional(),

    // Storage
    UPLOAD_DIR: z.string().default('./uploads'),

    // Evolution API (WhatsApp)
    EVOLUTION_API_URL:   z.string().url().optional(),
    EVOLUTION_API_KEY:   z.string().optional(),
    EVOLUTION_INSTANCE:  z.string().optional(),

    // Chatwoot
    CHATWOOT_URL:        z.string().url().optional(),
    CHATWOOT_TOKEN:      z.string().optional(),
    CHATWOOT_ACCOUNT_ID: z.coerce.number().optional(),
    CHATWOOT_INBOX_ID:   z.coerce.number().optional(),

    // Google Drive (fotos pacientes)
    GDRIVE_FOLDER_ID:   z.string().optional(), // 1R0xewRUWYnLfakIMwhsdhl1R76kb-cno
    GDRIVE_SA_KEY_JSON: z.string().optional(), // JSON de Service Account (base64 o raw)
    GMAIL_CLIENT_ID:    z.string().optional(),
    GMAIL_CLIENT_SECRET:z.string().optional(),
    GMAIL_USER_EMAIL:   z.string().email().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
