/**
 * centinela/simulator.ts — Simulador de errores para testing de Centinela
 * Migrado desde SmileStudio/src/centinela/simulator.ts
 *
 * Genera errores realistas de todos los módulos para testear el motor Centinela.
 */

import centinela from './engine';
import type { CentinelaModule, Severity } from './types';

interface ErrorTemplate {
    module:   CentinelaModule;
    severity: Severity;
    message:  string;
    stack?:   string;
}

const TEMPLATES: ErrorTemplate[] = [
    // Agenda
    { module: 'Agenda',    severity: 'error',    message: 'Cannot read properties of undefined (reading \'horaInicio\')', stack: 'TypeError at Agenda.tsx:412' },
    { module: 'Agenda',    severity: 'warning',  message: 'Cita sin gabinete asignado detectada al renderizar', stack: 'Warning at CitaCard.tsx:88' },
    { module: 'Agenda',    severity: 'critical', message: 'Failed to fetch /api/appointments — Network Error', stack: 'FetchError at agenda.service.ts:56' },
    // Pacientes
    { module: 'Pacientes', severity: 'error',    message: 'Failed to save SOAP note: 500 Internal Server Error', stack: 'Error at soap.service.ts:93' },
    { module: 'Pacientes', severity: 'error',    message: 'Odontogram state corrupted — JSON parse failed', stack: 'SyntaxError at Odontograma.tsx:201' },
    { module: 'Pacientes', severity: 'warning',  message: 'getQuestionnaireDatosPorPaciente returned 404 — paciente sin cuestionario', stack: 'Warning at AnamnesisPanel.tsx:88' },
    { module: 'Pacientes', severity: 'critical', message: 'RGPD: intento de acceso a historial clínico sin autenticación', stack: 'AuthError at Pacientes.tsx:78' },
    // SOAPEditor
    { module: 'SOAPEditor', severity: 'error',   message: 'Web Speech API recognition.start() failed — microphone denied', stack: 'DOMException at SOAPEditor.tsx:312' },
    { module: 'SOAPEditor', severity: 'warning', message: 'SOAP note not saved — backend timeout > 10s', stack: 'TimeoutError at soap.service.ts:67' },
    // Whatsapp
    { module: 'Whatsapp',  severity: 'critical', message: 'Evolution API: 504 Gateway Timeout — cola detenida', stack: 'FetchError at evolution.service.ts:145' },
    { module: 'Whatsapp',  severity: 'error',    message: 'Chatwoot sync failed: duplicate conversation ID', stack: 'Error at evolution.service.ts:221' },
    { module: 'Whatsapp',  severity: 'warning',  message: 'AI response truncated — context window exceeded', stack: 'Warning at ia-dental.service.ts:156' },
    // IA
    { module: 'IA',        severity: 'error',    message: 'Groq API: 429 Rate limit exceeded — retry after 60s', stack: 'APIError at ia-dental.service.ts:89' },
    { module: 'IA',        severity: 'warning',  message: 'Automatización rem-24h: 0 pacientes en ventana horaria', stack: 'Warning at automations.service.ts:178' },
    { module: 'IA',        severity: 'critical', message: 'analyzeTranscript injection attempt blocked — sanitizeInput', stack: 'SecurityError at ia-dental.service.ts:44' },
    // Inventario
    { module: 'Inventario', severity: 'critical', message: 'FDW TArticulo: columna stock_real desincronizada — GELITE offline', stack: 'FDWError at inventario.service.ts:67' },
    { module: 'Inventario', severity: 'error',    message: 'stock_ajustes_pendientes: pg_notify timeout > 5s', stack: 'Error at inventario.service.ts:134' },
    { module: 'Inventario', severity: 'warning',  message: 'Artículo GEL-04812 bajo stock mínimo: 2 unidades restantes', stack: 'Warning at inventario.service.ts:198' },
    // Gestoría
    { module: 'Gestoría',  severity: 'error',    message: 'Gmail OAuth token expired — re-auth required', stack: 'OAuthError at gmail.service.ts:34' },
    { module: 'Gestoría',  severity: 'warning',  message: 'invoice-parser: 3 facturas sin NIF detectable en el cuerpo', stack: 'Warning at invoice-parser.service.ts:45' },
    // Radiología
    { module: 'Radiología', severity: 'critical', message: 'Orthanc container unreachable — /api/imaging returns 502', stack: 'FetchError at dicom.service.ts:23' },
    { module: 'Radiología', severity: 'error',    message: 'DICOM viewer: cornerstone renderingEngine init failed', stack: 'Error at DicomViewer.tsx:88' },
    // Auth
    { module: 'Auth',      severity: 'critical', message: 'JWT token validation failed — possible replay attack', stack: 'AuthError at auth.middleware.ts:56' },
    { module: 'Auth',      severity: 'warning',  message: 'Session expired silently — user logged out', stack: 'Warning at AuthContext.tsx:78' },
    // Backend
    { module: 'Backend',   severity: 'critical', message: 'Prisma: P2002 Unique constraint violation on ClinicalRecord', stack: 'PrismaError at clinical.service.ts:134' },
    { module: 'Backend',   severity: 'error',    message: 'PostgreSQL connection pool exhausted — max 10 connections', stack: 'Error at db.ts:45' },
    { module: 'Backend',   severity: 'warning',  message: 'Slow query detected: getHistorialCitasPaciente > 2s', stack: 'Warning at clinical.service.ts:298' },
];

/** Dispara un error aleatorio del simulador */
export function simulateRandom() {
    const tmpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    centinela.capture(tmpl.message, tmpl.stack, undefined, tmpl.severity);
}

/** Dispara N errores aleatorios con delay */
export async function simulateBurst(n = 5, delayMs = 300) {
    for (let i = 0; i < n; i++) {
        simulateRandom();
        if (i < n - 1) await new Promise(r => setTimeout(r, delayMs));
    }
}

/** Dispara un critical específico */
export function simulateCritical() {
    const criticals = TEMPLATES.filter(t => t.severity === 'critical');
    const tmpl = criticals[Math.floor(Math.random() * criticals.length)];
    centinela.capture(tmpl.message, tmpl.stack, undefined, 'critical');
}

/** Dispara todos los templates (para demo completa) */
export async function simulateAll() {
    for (let i = 0; i < TEMPLATES.length; i++) {
        const t = TEMPLATES[i];
        centinela.capture(t.message, t.stack, undefined, t.severity);
        await new Promise(r => setTimeout(r, 80));
    }
}

export { TEMPLATES };
