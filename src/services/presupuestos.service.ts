// ─────────────────────────────────────────────────────────────────
//  services/presupuestos.service.ts
//  Presupuestos — stub temporal.
//  TODO: exponer /api/accounting/patients/:numPac/budgets en el backend
//  (modelos Presutto/Presu ya existen en Prisma).
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';

export interface LineaPresupuesto {
    id: string;
    idPre: number;
    descripcion: string;
    pieza?: string;
    arcada?: string;
    cantidad?: number;
    precioPresupuesto: number;
    precioUnitario?: number;
    descuento?: number;
    importeLinea?: number;
    importeCobrado: number;
    estado: 'Pendiente' | 'En tratamiento' | 'Finalizado' | 'Anulado';
    fecha?: string;
}

export interface Presupuesto {
    id: number;
    idPac: string;
    lineas: LineaPresupuesto[];
    importeTotal: number;
    importeCobrado: number;
    importePendiente: number;
    importePagado?: number;
    lineasPendientes: number;
    lineasFinalizadas: number;
    estado: 'Pendiente' | 'Aceptado' | 'En curso' | 'Finalizado' | 'Rechazado' | 'Caducado';
    estadoWeb?: string;
    fechaInicio?: string;
    fecha?: string;
    fechaAceptacion?: string;
}

export const getPresupuestosByPaciente = async (_numPac: string, _idPac?: string): Promise<Presupuesto[]> => {
    logger.warn('[PRESUPUESTOS] endpoint no implementado aún en backend');
    return [];
};

export const getResumenEconomico = async (_numPac: string, _idPac?: string) => ({
    totalPresupuestado: 0,
    totalCobrado: 0,
    totalPendiente: 0,
    totalFacturado: 0,
    totalPagado: 0,
    deudaPendiente: 0,
    presupuestosCount: 0,
});

export const aceptarPresupuesto = async (_idPre: number, _numPac: string, _aceptadoPor?: string): Promise<boolean> => false;
export const rechazarPresupuesto = async (_idPre: number, _numPac: string, _rechazadoPor?: string): Promise<boolean> => false;
