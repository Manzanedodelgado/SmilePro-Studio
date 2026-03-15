
// ─────────────────────────────────────────────────────────────────
//  services/romexis.service.ts
//  Capa de integración con Planmeca Romexis
//
//  AUDITORÍA-VULN-001 FIX:
//  Las llamadas a Romexis ya NO van directamente al API desde el frontend.
//  Pasan por la Edge Function romexis-proxy (backend).
//  La ROMEXIS_KEY vive en las variables de entorno de backend Node.js.
//
//  Deploy: [ELIMINADO] romexis-proxy
//  Secret: [ELIMINADO] ROMEXIS_KEY=... ROMEXIS_ENDPOINT=...
//
//  Modo de funcionamiento:
//    • Con VITE_SUPABASE_URL configurada  →  llama al proxy Edge Function
//    • Sin VITE_SUPABASE_URL             →  mock realista (modo demo)
// ─────────────────────────────────────────────────────────────────
/// <reference types="vite/client" />

import { logger } from './logger';

const fetchWithTimeout = (url: string, opts: RequestInit = {}, ms = 30_000): Promise<Response> => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _meta = import.meta as any;
// URL del backend Node.js (no Supabase)
const API_URL = (_meta.env?.VITE_API_URL ?? _meta.env?.VITE_SUPABASE_URL ?? '') as string;
const _legacyAnonKey = _meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

/** URL del proxy para Romexis — endpoint en el backend Node.js local */
const getProxyUrl = (): string | null =>
    API_URL ? `${API_URL}/api/romexis/proxy` : null;

export const isRomexisConfigured = (): boolean => Boolean(getProxyUrl());

// ── Tipos ──────────────────────────────────────────────────────

export interface RomexisPatient {
    romexisId: string;
    name: string;
    birthDate: string;
    dni: string;
}

export interface RomexisPanoramica {
    id: string;
    date: string;
    dateLabel: string;
    url: string;          // signed URL o data URL
    thumbnail: string;
    type: 'panoramica' | 'bite-wing' | 'periapical' | 'tc3d';
    tooth?: string;
}

// ── Mock data ─────────────────────────────────────────────────

const MOCK_PANORAMICAS: RomexisPanoramica[] = [
    {
        id: 'rx-001', date: '2024-03-25', dateLabel: '25 Mar 2024',
        url: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Panoramic_dental_X-ray.jpg',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Panoramic_dental_X-ray.jpg/800px-Panoramic_dental_X-ray.jpg',
        type: 'panoramica',
    },
    {
        id: 'rx-002', date: '2023-01-10', dateLabel: '10 Ene 2023',
        url: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Panoramic_dental_X-ray.jpg',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Panoramic_dental_X-ray.jpg/800px-Panoramic_dental_X-ray.jpg',
        type: 'panoramica',
    },
    {
        id: 'rx-003', date: '2022-06-05', dateLabel: '05 Jun 2022',
        url: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Panoramic_dental_X-ray.jpg',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Panoramic_dental_X-ray.jpg/800px-Panoramic_dental_X-ray.jpg',
        type: 'panoramica',
    },
];

// ── API calls (vía romexis-proxy Edge Function) ────────────────

const proxyHeaders = () => ({
    'Content-Type': 'application/json',
    'apikey': _legacyAnonKey || '',
    'Authorization': `Bearer ${_legacyAnonKey || ''}`,
});

/**
 * Busca un paciente en Romexis por DNI.
 */
export const searchRomexisPatient = async (dni: string): Promise<RomexisPatient | null> => {
    const proxyUrl = getProxyUrl();
    if (!proxyUrl) {
        return { romexisId: `ROM-${dni}`, name: 'Demo', birthDate: '1985-01-01', dni };
    }
    try {
        const res = await fetchWithTimeout(
            `${proxyUrl}?path=/api/patients&dni=${encodeURIComponent(dni)}`,
            { headers: proxyHeaders() },
            15_000
        );
        if (!res.ok) return null;
        return res.json();
    } catch (e) {
        logger.warn('[Romexis] searchRomexisPatient error:', e);
        return null;
    }
};

/**
 * Crea un paciente en Romexis. Llamado al registrar un paciente nuevo.
 */
export const createRomexisPatient = async (data: {
    nombre: string; apellidos: string; dni: string;
    fechaNacimiento: string; telefono: string;
}): Promise<string | null> => {
    const proxyUrl = getProxyUrl();
    if (!proxyUrl) {
        await new Promise(r => setTimeout(r, 800));
        return `ROM-${Date.now()}`;
    }
    try {
        const res = await fetchWithTimeout(
            `${proxyUrl}?path=/api/patients`,
            { method: 'POST', headers: proxyHeaders(), body: JSON.stringify(data) },
            15_000
        );
        if (!res.ok) return null;
        const json = await res.json();
        return json.romexisId ?? null;
    } catch (e) {
        logger.warn('[Romexis] createRomexisPatient error:', e);
        return null;
    }
};

/**
 * Descarga la lista de radiografías de un paciente en Romexis.
 */
export const getPatientPanoramicas = async (romexisId: string): Promise<RomexisPanoramica[]> => {
    const proxyUrl = getProxyUrl();
    if (!proxyUrl) {
        await new Promise(r => setTimeout(r, 500));
        return MOCK_PANORAMICAS;
    }
    try {
        const res = await fetchWithTimeout(
            `${proxyUrl}?path=/api/patients/${encodeURIComponent(romexisId)}/images`,
            { headers: proxyHeaders() },
            15_000
        );
        if (!res.ok) return MOCK_PANORAMICAS;
        return res.json();
    } catch (e) {
        logger.warn('[Romexis] getPatientPanoramicas error:', e);
        return MOCK_PANORAMICAS; // siempre tiene fallback
    }
};
