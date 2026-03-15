// ─────────────────────────────────────────────────────────────────
//  services/inventario.service.ts
//  Inventario — backend local (Node.js/Prisma).
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { type ItemInventario, type Lote, type EstadoLote } from '../types';
import { logger } from './logger';

const API_BASE = 'http://localhost:3000/api/inventory';

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
        const res = await fetch(`${API_BASE}/products`);
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
        const res = await fetch(`${API_BASE}/movements`, {
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
        const res = await fetch(`${API_BASE}/lots`, {
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
