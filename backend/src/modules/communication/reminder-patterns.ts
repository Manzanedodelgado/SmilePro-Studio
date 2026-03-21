// ─── Reminder Pattern Tracking ────────────────────────────────────────────────
// Aprende el comportamiento de cada paciente (confirma siempre, falta con frecuencia...)
// y ajusta la estrategia de recordatorios en consecuencia.
// Almacén: /data/reminder-patterns.json (sin migración Prisma necesaria)
//
// Evento 'reminder_sent'  → el cron envió un recordatorio a ese teléfono
// Evento 'confirmed'      → el paciente respondió o acudió (lo registra el agente IA)
// Evento 'no_show'        → se detectó que no acudió
// ──────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATTERNS_FILE = path.join(__dirname, '../../../../data/reminder-patterns.json');

export interface PatientReminderPattern {
    phone: string;
    totalReminders: number;
    confirmations: number;
    noShows: number;
    lastReminderAt: string | null;
    lastEventAt: string | null;
    // Derived (not stored, computed on read)
    confirmationRate?: number;
    showRate?: number;
    reliabilityLabel?: 'excellent' | 'good' | 'average' | 'low' | 'unknown';
}

function readAll(): Record<string, Omit<PatientReminderPattern, 'confirmationRate' | 'showRate' | 'reliabilityLabel'>> {
    if (!fs.existsSync(PATTERNS_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8')); }
    catch { return {}; }
}

function writeAll(data: Record<string, unknown>) {
    const dir = path.dirname(PATTERNS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PATTERNS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function enrich(p: Omit<PatientReminderPattern, 'confirmationRate' | 'showRate' | 'reliabilityLabel'>): PatientReminderPattern {
    const confirmationRate = p.totalReminders > 0 ? Math.round((p.confirmations / p.totalReminders) * 100) : null;
    const showRate = p.confirmations > 0 ? Math.round(((p.confirmations - p.noShows) / p.confirmations) * 100) : null;

    let reliabilityLabel: PatientReminderPattern['reliabilityLabel'] = 'unknown';
    if (p.totalReminders >= 3) {
        const rate = showRate ?? confirmationRate ?? 0;
        if (rate >= 90) reliabilityLabel = 'excellent';
        else if (rate >= 70) reliabilityLabel = 'good';
        else if (rate >= 50) reliabilityLabel = 'average';
        else reliabilityLabel = 'low';
    }

    return { ...p, confirmationRate: confirmationRate ?? undefined, showRate: showRate ?? undefined, reliabilityLabel };
}

/** Obtener el patrón de un paciente por teléfono. */
export function getPattern(phone: string): PatientReminderPattern {
    const key = phone.replace(/\D/g, '').slice(-9);
    const all = readAll();
    const base = all[key] ?? { phone: key, totalReminders: 0, confirmations: 0, noShows: 0, lastReminderAt: null, lastEventAt: null };
    return enrich(base);
}

/** Registrar un evento para un paciente. */
export function recordEvent(phone: string, event: 'reminder_sent' | 'confirmed' | 'no_show') {
    const key = phone.replace(/\D/g, '').slice(-9);
    const all = readAll();
    const p = all[key] ?? { phone: key, totalReminders: 0, confirmations: 0, noShows: 0, lastReminderAt: null, lastEventAt: null };

    const now = new Date().toISOString();
    if (event === 'reminder_sent') {
        p.totalReminders++;
        p.lastReminderAt = now;
    } else if (event === 'confirmed') {
        p.confirmations++;
        p.lastEventAt = now;
    } else if (event === 'no_show') {
        p.noShows++;
        p.lastEventAt = now;
    }

    all[key] = p;
    writeAll(all);
    logger.debug(`[ReminderPattern] ${key}: ${event} → conf=${p.confirmations}/${p.totalReminders}`);
}

/** Resumen global de todos los patrones. */
export function getAllPatterns(): PatientReminderPattern[] {
    return Object.values(readAll()).map(enrich);
}
