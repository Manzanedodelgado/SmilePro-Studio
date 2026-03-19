// ─────────────────────────────────────────────────────────────────
//  services/tratamientos.service.ts
//  Catálogo de tratamientos — backend local (Node.js/Prisma).
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import { authFetch } from './db';

const API_BASE = 'http://localhost:3000/api';

export interface Tratamiento {
    id: string;
    nombre: string;
    categoria: string;
    tipo_aplicacion: 'pieza' | 'arcada' | 'cuadrante' | 'boca';
    precio: number;
    activo: boolean;
}

let _cache: Tratamiento[] | null = null;

const mapTratamiento = (r: any): Tratamiento => ({
    id: r.id,
    nombre: r.name ?? r.nombre ?? '',
    categoria: r.category ?? r.categoria ?? 'General',
    tipo_aplicacion: (r.applicationType ?? r.tipo_aplicacion ?? 'pieza') as Tratamiento['tipo_aplicacion'],
    precio: Number(r.price ?? r.precio ?? 0),
    activo: r.active ?? r.activo ?? true,
});

export const getCatalogoTratamientos = async (): Promise<Tratamiento[]> => {
    if (_cache) return _cache;
    try {
        const res = await authFetch(`${API_BASE}/treatments`);
        if (!res.ok) return [];
        const json = await res.json();
        const rows: any[] = json.data ?? [];
        _cache = rows.map(mapTratamiento);
        return _cache;
    } catch (e) {
        logger.error('[TRATAMIENTOS] getCatalogoTratamientos error:', e);
        return [];
    }
};

export const getCategorias = async (): Promise<string[]> => {
    const ttos = await getCatalogoTratamientos();
    return [...new Set(ttos.map(t => t.categoria))].sort();
};

export const searchTratamientos = async (query: string, categoria?: string): Promise<Tratamiento[]> => {
    const all = await getCatalogoTratamientos();
    const q = query.toLowerCase();
    return all.filter(t =>
        (!q || t.nombre.toLowerCase().includes(q)) &&
        (!categoria || t.categoria === categoria)
    ).slice(0, 50);
};

export const invalidateCache = (): void => { _cache = null; };
