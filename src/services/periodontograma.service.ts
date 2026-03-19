// ─────────────────────────────────────────────────────────────────
//  services/periodontograma.service.ts
//  Persistencia del periodontograma — backend local (Node.js/Prisma).
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import { authFetch } from './db';

const API_BASE = 'http://localhost:3000/api/clinical';

export const getPeriodontograma = async (numPac: string): Promise<Record<string, any> | null> => {
    if (!numPac) return null;
    try {
        const res = await authFetch(`${API_BASE}/patients/${encodeURIComponent(numPac)}/periodontogram`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.data ?? null;
    } catch (e) {
        logger.warn('[Periodontograma] Error cargando:', e);
        return null;
    }
};

export const savePeriodontograma = async (numPac: string, datos: Record<string, any>): Promise<boolean> => {
    if (!numPac) return false;
    try {
        const res = await authFetch(`${API_BASE}/periodontogram`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId: numPac, data: datos }),
        });
        return res.ok;
    } catch (e) {
        logger.error('[Periodontograma] Error guardando:', e);
        return false;
    }
};
