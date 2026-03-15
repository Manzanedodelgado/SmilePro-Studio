// ─────────────────────────────────────────────────────────────────
//  services/odontograma.service.ts
//  Persistencia del odontograma — backend local (Node.js/Prisma).
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';

const API_BASE = 'http://localhost:3000/api/clinical';

export const getOdontograma = async (numPac: string): Promise<any[] | null> => {
    if (!numPac) return null;
    try {
        const res = await fetch(`${API_BASE}/patients/${encodeURIComponent(numPac)}/odontogram`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.data ?? null;
    } catch (e) {
        logger.warn('[Odontograma] Error cargando:', e);
        return null;
    }
};

export const saveOdontograma = async (numPac: string, datos: any[]): Promise<boolean> => {
    if (!numPac) return false;
    try {
        const res = await fetch(`${API_BASE}/odontogram`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId: numPac, data: datos }),
        });
        return res.ok;
    } catch (e) {
        logger.error('[Odontograma] Error guardando:', e);
        return false;
    }
};
