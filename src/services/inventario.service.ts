// ─────────────────────────────────────────────────────────────────
//  services/inventario.service.ts
//  Inventario — backend local (Node.js/Prisma).
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { type ItemInventario, type Lote, type EstadoLote } from '../types';
import { logger } from './logger';
import { authFetch } from './db';

const API_BASE = '/api/inventory';

const mapLote = (l: any): Lote => ({
    batchId: String(l.id ?? l.batchId ?? crypto.randomUUID()),
    loteFabricante: l.lotNumber ?? l.numero ?? l.loteFabricante ?? '',
    fechaCaducidad: l.expiryDate ?? l.fechaCaducidad ?? '',
    cantidad: Number(l.quantity ?? l.cantidad ?? 0),
    estado: (l.estado ?? 'OK') as EstadoLote,
    ubicacion: l.location ?? l.ubicacion ?? '',
    temperaturaAlerta: l.temperaturaAlerta ?? false,
});

const mapProduct = (r: any): ItemInventario => ({
    id: r.id,
    nombre: r.name ?? r.nombre ?? '',
    sku: r.sku ?? r.codigo ?? String(r.id),
    categoria: r.category ?? r.categoria ?? 'Desechable',
    stockFisico: Number(r.stock ?? r.stockActual ?? r.stockFisico ?? 0),
    stockVirtual: Number(r.stockVirtual ?? 0),
    minimoReorden: Number(r.minReorder ?? r.stockMinimo ?? r.minimoReorden ?? 0),
    lotes: (r.lots ?? r.lotes ?? []).map(mapLote),
});

export const getItemsInventario = async (): Promise<ItemInventario[]> => {
    try {
        const res = await authFetch(`${API_BASE}/products`);
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data ?? []).map(mapProduct);
    } catch (e) {
        logger.error('[INVENTARIO] getItemsInventario error:', e);
        return [];
    }
};

export const updateStock = async (productId: string, quantity: number, reason?: string): Promise<boolean> => {
    try {
        const res = await authFetch(`${API_BASE}/movements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity, reason: reason ?? 'Ajuste manual' }),
        });
        return res.ok;
    } catch (e) {
        logger.error('[INVENTARIO] updateStock error:', e);
        return false;
    }
};

export const addLote = async (productId: string, lotNumber: string, quantity: number, expiryDate?: string): Promise<boolean> => {
    try {
        const res = await authFetch(`${API_BASE}/lots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, lotNumber, quantity, expiryDate }),
        });
        return res.ok;
    } catch (e) {
        logger.error('[INVENTARIO] addLote error:', e);
        return false;
    }
};

// ── Patrón FDW-safe: stock_ajustes_pendientes ─────────────────────────────────
// En lugar de escribir directamente al FDW de GELITE (TArticulo en SQL Server),
// registramos el ajuste en una tabla local de PostgreSQL (`stock_ajustes_pendientes`).
// El backend emite pg_notify cuando GELITE está online y aplica los ajustes pendientes.
// Esto evita errores de escritura si GELITE está offline.

export interface AjusteStock {
    id?: string;
    productId: string;
    productNombre?: string;
    cantidad: number;
    motivo: string;
    tipo: 'entrada' | 'salida' | 'ajuste';
    usuarioId?: string;
    estado?: 'pendiente' | 'aplicado' | 'error';
    createdAt?: string;
    aplicadoAt?: string;
}

export const registrarAjusteStock = async (ajuste: Omit<AjusteStock, 'id' | 'estado' | 'createdAt' | 'aplicadoAt'>): Promise<boolean> => {
    try {
        const res = await authFetch(`${API_BASE}/adjustments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...ajuste, estado: 'pendiente', createdAt: new Date().toISOString() }),
        });
        return res.ok;
    } catch (e) {
        logger.error('[INVENTARIO] registrarAjusteStock error:', e);
        return false;
    }
};

export const getAjustesPendientes = async (): Promise<AjusteStock[]> => {
    try {
        const res = await authFetch(`${API_BASE}/adjustments?estado=pendiente`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.data ?? [];
    } catch (e) {
        logger.error('[INVENTARIO] getAjustesPendientes error:', e);
        return [];
    }
};

export const getItemsBajoStock = async (): Promise<ItemInventario[]> => {
    const items = await getItemsInventario();
    return items.filter(i => i.stockFisico <= i.minimoReorden);
};

export const getLotesProximosACaducar = async (diasAlerta = 30): Promise<{ item: ItemInventario; lote: Lote }[]> => {
    const items = await getItemsInventario();
    const hoy = new Date();
    const resultado: { item: ItemInventario; lote: Lote }[] = [];
    for (const item of items) {
        for (const lote of item.lotes) {
            if (!lote.fechaCaducidad) continue;
            const fc = new Date(lote.fechaCaducidad);
            const dias = Math.ceil((fc.getTime() - hoy.getTime()) / 86400000);
            if (dias >= 0 && dias <= diasAlerta) resultado.push({ item, lote });
        }
    }
    return resultado.sort((a, b) => new Date(a.lote.fechaCaducidad).getTime() - new Date(b.lote.fechaCaducidad).getTime());
};

