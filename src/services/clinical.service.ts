// ─────────────────────────────────────────────────────────────────
//  services/clinical.service.ts
//  Entradas médicas (historial clínico TtosMed) — backend local.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import { authFetch } from './db';

const API_BASE = 'http://localhost:3000/api/clinical';

export interface EntradaMedica {
    id: number;
    fecha: string | null;
    codigoTto: string | null;
    descripcion: string;
    referencia: string;
    comentario: string;
    piezas: number[];
    estado: number;
    importe: number | null;
    pendiente: number | null;
}

export interface EntradasPage {
    data: EntradaMedica[];
    pagination: { total: number };
}

export const getEntradasMedicas = async (
    idPac: number,
    page: number,
    pageSize: number,
    order: 'asc' | 'desc',
): Promise<EntradasPage | null> => {
    try {
        const res = await authFetch(
            `${API_BASE}/patients/${idPac}/entradas?page=${page}&pageSize=${pageSize}&order=${order}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    } catch (e) {
        logger.warn('[Clinical] getEntradasMedicas:', e);
        return null;
    }
};

export const updateEntradaMedica = async (
    idPac: number,
    entradaId: number,
    body: Partial<EntradaMedica>,
): Promise<EntradaMedica | null> => {
    try {
        const res = await authFetch(
            `${API_BASE}/patients/${idPac}/entradas/${entradaId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    } catch (e) {
        logger.error('[Clinical] updateEntradaMedica:', e);
        return null;
    }
};
