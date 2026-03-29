/**
 * centinela/engine.ts — Motor de monitorización de errores Centinela
 * Migrado y adaptado desde SmileStudio/src/centinela/engine.ts
 *
 * - Singleton global
 * - Captura window.onerror y unhandledrejection
 * - Deduplicación por fingerprint
 * - Persistencia en localStorage
 * - Módulo inferido desde la URL/stack
 * - Uptime tracking por módulo
 * - Reporte al backend /api/centinela/report (fire-and-forget)
 */

import type { CentinelaError, CentinelaModule, CentinelaState, Severity, UptimeRecord } from './types';

const STORAGE_KEY = 'centinela_state_v2';
const MAX_ERRORS  = 200;

// ── Inferir módulo desde URL o stack ─────────────────────────────

function inferModule(url?: string, stack?: string): CentinelaModule {
    const src = (stack || url || window.location.href).toLowerCase();
    if (src.includes('agenda'))     return 'Agenda';
    if (src.includes('paciente'))   return 'Pacientes';
    if (src.includes('soap'))       return 'SOAPEditor';
    if (src.includes('odontograma')) return 'Odontograma';
    if (src.includes('whatsapp'))   return 'Whatsapp';
    if (src.includes('ia') || src.includes('automatiz')) return 'IA';
    if (src.includes('inventario')) return 'Inventario';
    if (src.includes('gestoria') || src.includes('gestor')) return 'Gestoría';
    if (src.includes('radiolog'))   return 'Radiología';
    if (src.includes('auth') || src.includes('login')) return 'Auth';
    if (src.includes('backend') || src.includes('api')) return 'Backend';
    return 'Unknown';
}

// ── Fingerprint de deduplicación ───────────────────────────────

function fingerprint(message: string, stack?: string): string {
    const base = message + (stack?.split('\n')[1] || '');
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
        hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
}

// ── Inferir severidad ─────────────────────────────────────────

function inferSeverity(message: string): Severity {
    const m = message.toLowerCase();
    if (m.includes('failed to fetch') || m.includes('network') || m.includes('500') || m.includes('cors')) return 'critical';
    if (m.includes('uncaught') || m.includes('undefined') || m.includes('cannot read')) return 'error';
    if (m.includes('warning') || m.includes('deprecated')) return 'warning';
    return 'info';
}

// ── Engine ────────────────────────────────────────────────────

class CentinelaEngine {
    private static _instance: CentinelaEngine | null = null;
    private state: CentinelaState = { errors: [], uptime: [] };
    private installed = false;
    private reportUrl = '/api/centinela/report';

    static get instance(): CentinelaEngine {
        if (!CentinelaEngine._instance) CentinelaEngine._instance = new CentinelaEngine();
        return CentinelaEngine._instance;
    }

    private constructor() {
        this.loadState();
    }

    // ── Persistencia ─────────────────────────────────────────

    private loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) this.state = JSON.parse(raw);
        } catch { /* ignora errores de localStorage */ }
    }

    private saveState() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); }
        catch { /* quota exceeded – silencioso */ }
    }

    // ── Instalación de handlers globales ──────────────────────

    install() {
        if (this.installed) return;
        this.installed = true;

        window.onerror = (msg, src, _line, _col, err) => {
            this.capture(String(msg), err?.stack, src, inferSeverity(String(msg)));
            return false; // no suprimir
        };

        window.addEventListener('unhandledrejection', (e) => {
            const message = e.reason?.message || String(e.reason) || 'Unhandled Promise Rejection';
            const stack   = e.reason?.stack;
            this.capture(message, stack, undefined, 'error');
        });
    }

    // ── Captura de errores ────────────────────────────────────

    capture(
        message: string,
        stack?: string,
        url?: string,
        severity: Severity = 'error',
        extra?: Record<string, unknown>,
    ) {
        const fp  = fingerprint(message, stack);
        const mod = inferModule(url, stack);
        const now = new Date().toISOString();

        const existing = this.state.errors.find(e => e.fingerprint === fp);
        if (existing) {
            existing.count++;
            existing.lastSeen = now;
            if (!existing.resolved) {
                this.saveState();
                return existing;
            }
        }

        const error: CentinelaError = {
            id:          crypto.randomUUID(),
            fingerprint: fp,
            message,
            stack,
            url:         url || window.location.href,
            module:      mod,
            severity,
            count:       1,
            firstSeen:   now,
            lastSeen:    now,
            resolved:    false,
            tags:        [mod.toLowerCase()],
            userAgent:   navigator.userAgent.slice(0, 100),
            extra,
        };

        this.state.errors.unshift(error);
        if (this.state.errors.length > MAX_ERRORS) this.state.errors.pop();
        this.saveState();

        // Fire-and-forget al backend
        this.reportToBackend(error).catch(() => {});

        return error;
    }

    // ── Uptime tracking ───────────────────────────────────────

    checkModule(module: CentinelaModule, success: boolean) {
        const now = new Date().toISOString();
        let rec = this.state.uptime.find(u => u.module === module);
        if (!rec) {
            rec = { module, checks: 0, failures: 0, lastCheck: now };
            this.state.uptime.push(rec);
        }
        rec.checks++;
        if (!success) rec.failures++;
        rec.lastCheck = now;
        this.saveState();
    }

    // ── Resolución ────────────────────────────────────────────

    resolve(id: string) {
        const err = this.state.errors.find(e => e.id === id);
        if (err) { err.resolved = true; this.saveState(); }
    }

    resolveAll() {
        this.state.errors.forEach(e => e.resolved = true);
        this.saveState();
    }

    clear() {
        this.state = { errors: [], uptime: [] };
        this.saveState();
    }

    // ── Getters ───────────────────────────────────────────────

    getErrors(includeResolved = false): CentinelaError[] {
        return includeResolved
            ? this.state.errors
            : this.state.errors.filter(e => !e.resolved);
    }

    getActiveCount(): number { return this.getErrors(false).length; }
    getCriticalCount(): number { return this.getErrors(false).filter(e => e.severity === 'critical').length; }
    getUptime(): UptimeRecord[] { return this.state.uptime; }

    // ── Reporte al backend ─────────────────────────────────────

    private async reportToBackend(error: Omit<CentinelaError, 'id'>): Promise<void> {
        const token = sessionStorage.getItem('sb_auth_token') ?? '';
        await fetch(this.reportUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(error),
            keepalive: true,
        });
    }
}

// ── Exports ───────────────────────────────────────────────────

export const centinela = CentinelaEngine.instance;

/** Instalar handlers globales — llamar desde main.tsx */
export function setupCentinela() {
    centinela.install();
}

export default centinela;
export type { CentinelaError, CentinelaModule, CentinelaState, UptimeRecord };
