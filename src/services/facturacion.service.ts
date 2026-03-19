// ─────────────────────────────────────────────────────────────────
//  services/facturacion.service.ts
//  Gestoría — conectado al Backend Local (Node.js/Prisma).
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import { authFetch } from './db';

const API_BASE = 'http://localhost:3000/api/accounting';

// ── Interfaces UI (sin cambios — compatibles con Gestoria.tsx) ────

export interface FacturaUI {
    id: string;
    name: string;
    date: string;
    base: string;
    total: string;
    status: 'Liquidado' | 'Pendiente' | 'Impagado';
    tbai: 'Verificado' | 'Enviando...' | 'Error';
    rawDate: Date;
    rawTotal: number;
}

export interface MovimientoBancoUI {
    desc: string;
    date: string;
    amount: string;
    rawAmount: number;
    type: 'in' | 'out';
    match: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────

const formatCurrency = (val: number): string =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' })
        .format(val)
        .replace('€', '€');

const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${d.toLocaleString('es-ES', { month: 'short' })} ${d.getFullYear()}`;
};

const estadoPagoToStatus = (estado?: string | null): FacturaUI['status'] => {
    switch (estado) {
        case 'cobrada': return 'Liquidado';
        case 'impagado': return 'Impagado';
        default: return 'Pendiente';
    }
};

const mapInvoice = (r: any): FacturaUI => ({
    id: r.numeroSerie || r.id,
    name: r.nombreCliente || r.concepto || '—',
    date: formatDate(r.fechaEmision),
    base: formatCurrency(Number(r.baseImponible ?? 0)),
    total: formatCurrency(Number(r.total ?? 0)),
    status: estadoPagoToStatus(r.estadoPago),
    tbai: r.verifactuEstado === 'enviado' ? 'Verificado' : 'Enviando...',
    rawDate: new Date(r.fechaEmision),
    rawTotal: Number(r.total ?? 0),
});

const mapBankMovement = (r: any): MovimientoBancoUI => {
    const imp = Number(r.importe ?? 0);
    return {
        desc: r.conceptoBanco || '—',
        date: formatDate(r.fechaOperacion),
        amount: `${imp >= 0 ? '+' : ''}${formatCurrency(imp)}`,
        rawAmount: imp,
        type: imp >= 0 ? 'in' : 'out',
        match: r.estadoConcil === 'cruzado',
    };
};

// ── Funciones exportadas ──────────────────────────────────────────

/** Todas las facturas emitidas — para vista global Gestoría */
export const getFacturas = async (): Promise<FacturaUI[]> => {
    try {
        const res = await authFetch(`${API_BASE}/invoices?pageSize=500`);
        if (!res.ok) return [];
        const json = await res.json();
        const rows: any[] = json.data ?? [];
        return rows.map(mapInvoice);
    } catch (e) {
        logger.error('[FACTURACION] getFacturas error:', e);
        return [];
    }
};

/** Facturas de un paciente concreto — para ficha económica del paciente */
export const getFacturasByPaciente = async (numPac: string | number): Promise<FacturaUI[]> => {
    if (!numPac) return [];
    try {
        const res = await authFetch(`${API_BASE}/invoices?pageSize=500`);
        if (!res.ok) return [];
        const json = await res.json();
        const rows: any[] = json.data ?? [];
        return rows
            .filter(r => String(r.numPac ?? '') === String(numPac))
            .map(mapInvoice);
    } catch (e) {
        logger.error('[FACTURACION] getFacturasByPaciente error:', e);
        return [];
    }
};

/** Crear factura emitida */
export const createFactura = async (factura: {
    numeroSerie: string;
    numPac?: string;
    nifCliente: string;
    nombreCliente: string;
    concepto: string;
    baseImponible: number;
    ivaPct?: number;
    total: number;
    fechaEmision: string;
}): Promise<boolean> => {
    try {
        const res = await authFetch(`${API_BASE}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(factura),
        });
        return res.ok;
    } catch (e) {
        logger.error('[FACTURACION] createFactura error:', e);
        return false;
    }
};

/** Movimientos bancarios — para conciliación */
export const getMovimientosBanco = async (): Promise<MovimientoBancoUI[]> => {
    try {
        const res = await authFetch(`${API_BASE}/bank-movements?pageSize=200`);
        if (!res.ok) return [];
        const json = await res.json();
        const rows: any[] = json.data ?? [];
        return rows.map(mapBankMovement);
    } catch (e) {
        logger.error('[FACTURACION] getMovimientosBanco error:', e);
        return [];
    }
};

/** KPIs para el dashboard de Gestoría */
export const getGestoriaStats = async (): Promise<{ ingresosBrutos: string; facturasConteo: number }> => {
    try {
        const res = await authFetch(`${API_BASE}/summary`);
        if (!res.ok) return { ingresosBrutos: '—', facturasConteo: 0 };
        const json = await res.json();
        const data = json.data ?? {};
        return {
            ingresosBrutos: formatCurrency(Number(data.ingresosBrutos ?? 0)),
            facturasConteo: Number(data.facturas ?? 0),
        };
    } catch (e) {
        logger.error('[FACTURACION] getGestoriaStats error:', e);
        return { ingresosBrutos: '—', facturasConteo: 0 };
    }
};
