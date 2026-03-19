// ─────────────────────────────────────────────────────────────────────────────
//  services/presupuestos.service.ts
//  CRUD completo — backend primero, localStorage como fallback offline.
// ─────────────────────────────────────────────────────────────────────────────
import { authFetch } from './db';

const LS_KEY = 'smilepro:presupuestos';
const API_BASE = 'http://localhost:3000/api/accounting';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineaPresupuesto {
    id: string;
    idPre: number;
    descripcion: string;
    pieza?: string;
    arcada?: string;
    cantidad: number;
    precioPresupuesto: number;
    precioUnitario?: number;
    descuento: number;
    importeLinea: number;
    importeCobrado: number;
    estado: 'Pendiente' | 'En tratamiento' | 'Finalizado' | 'Anulado';
    fecha?: string;
}

export interface Presupuesto {
    id: number;
    idPac: string;            // numPac del paciente
    pacienteNombre?: string;
    lineas: LineaPresupuesto[];
    importeTotal: number;
    importeCobrado: number;
    importePendiente: number;
    importePagado?: number;
    lineasPendientes: number;
    lineasFinalizadas: number;
    estado: 'Borrador' | 'Pendiente' | 'Aceptado' | 'En curso' | 'Finalizado' | 'Rechazado' | 'Caducado';
    estadoWeb?: string;
    fechaInicio?: string;
    fecha?: string;
    fechaAceptacion?: string;
    notas?: string;
    validezDias?: number;
}

export type NuevoPresupuestoInput = Omit<Presupuesto, 'id' | 'importeTotal' | 'importeCobrado' | 'importePendiente' | 'lineasPendientes' | 'lineasFinalizadas'>;

// ── Catálogo de tratamientos (offline) ───────────────────────────────────────

export interface TratamientoCatalogo {
    descripcion: string;
    precio: number;
    categoria: string;
}

export const CATALOGO_TRATAMIENTOS: TratamientoCatalogo[] = [
    { descripcion: 'Revisión y exploración bucal', precio: 40, categoria: 'General' },
    { descripcion: 'Radiografía periapical', precio: 25, categoria: 'Diagnóstico' },
    { descripcion: 'Radiografía panorámica', precio: 65, categoria: 'Diagnóstico' },
    { descripcion: 'CBCT (escáner 3D dental)', precio: 180, categoria: 'Diagnóstico' },
    { descripcion: 'Limpieza dental (tartrectomía)', precio: 80, categoria: 'Higiene' },
    { descripcion: 'Limpieza dental + fluorización', precio: 95, categoria: 'Higiene' },
    { descripcion: 'Instrucción higiene oral', precio: 30, categoria: 'Higiene' },
    { descripcion: 'Empaste (composite) 1 cara', precio: 90, categoria: 'Restauración' },
    { descripcion: 'Empaste (composite) 2 caras', precio: 120, categoria: 'Restauración' },
    { descripcion: 'Empaste (composite) 3+ caras', precio: 155, categoria: 'Restauración' },
    { descripcion: 'Endodoncia unirradicular', precio: 280, categoria: 'Endodoncia' },
    { descripcion: 'Endodoncia birradicular', precio: 350, categoria: 'Endodoncia' },
    { descripcion: 'Endodoncia multirradicular', precio: 420, categoria: 'Endodoncia' },
    { descripcion: 'Retratamiento endodóntico', precio: 380, categoria: 'Endodoncia' },
    { descripcion: 'Corona cerámica (zirconio)', precio: 850, categoria: 'Prótesis fija' },
    { descripcion: 'Corona ceramometálica', precio: 580, categoria: 'Prótesis fija' },
    { descripcion: 'Corona metal', precio: 320, categoria: 'Prótesis fija' },
    { descripcion: 'Carilla cerámica', precio: 520, categoria: 'Prótesis fija' },
    { descripcion: 'Incrustación (composite)', precio: 280, categoria: 'Prótesis fija' },
    { descripcion: 'Implante dental (titanio)', precio: 1200, categoria: 'Implantología' },
    { descripcion: 'Pilar de implante', precio: 350, categoria: 'Implantología' },
    { descripcion: 'Corona sobre implante', precio: 850, categoria: 'Implantología' },
    { descripcion: 'Cirugía de inserción de implante', precio: 350, categoria: 'Implantología' },
    { descripcion: 'Regeneración ósea guiada (ROG)', precio: 450, categoria: 'Implantología' },
    { descripcion: 'Elevación de seno maxilar', precio: 680, categoria: 'Implantología' },
    { descripcion: 'Extracción simple', precio: 80, categoria: 'Cirugía' },
    { descripcion: 'Extracción quirúrgica (molar/cordal)', precio: 180, categoria: 'Cirugía' },
    { descripcion: 'Frenectomía', precio: 180, categoria: 'Cirugía' },
    { descripcion: 'Alargamiento coronario', precio: 320, categoria: 'Cirugía' },
    { descripcion: 'Blanqueamiento dental (clínica)', precio: 280, categoria: 'Estética' },
    { descripcion: 'Blanqueamiento dental (férula domiciliaria)', precio: 150, categoria: 'Estética' },
    { descripcion: 'Ortodoncia fija (bracket metálico)', precio: 2800, categoria: 'Ortodoncia' },
    { descripcion: 'Ortodoncia fija (bracket cerámico)', precio: 3400, categoria: 'Ortodoncia' },
    { descripcion: 'Alineadores transparentes (completo)', precio: 3600, categoria: 'Ortodoncia' },
    { descripcion: 'Contenedor de retención ortodoncia', precio: 180, categoria: 'Ortodoncia' },
    { descripcion: 'Periodoncia (curetaje por cuadrante)', precio: 160, categoria: 'Periodoncia' },
    { descripcion: 'Raspado y alisado radicular', precio: 130, categoria: 'Periodoncia' },
    { descripcion: 'Cirugía periodontal (colgajo)', precio: 380, categoria: 'Periodoncia' },
    { descripcion: 'Prótesis parcial removible (acrílico)', precio: 480, categoria: 'Prótesis removible' },
    { descripcion: 'Prótesis parcial esquelética', precio: 680, categoria: 'Prótesis removible' },
    { descripcion: 'Prótesis completa (acrílico)', precio: 900, categoria: 'Prótesis removible' },
    { descripcion: 'Mantenedor de espacio', precio: 180, categoria: 'Odontopediatría' },
    { descripcion: 'Sellado de fisuras (por diente)', precio: 35, categoria: 'Odontopediatría' },
    { descripcion: 'Férula de descarga (bruxismo)', precio: 320, categoria: 'Oclusal/ATM' },
];

// ── Demo data seed ─────────────────────────────────────────────────────────────

const getDemoData = (): Presupuesto[] => [
    {
        id: 1001,
        idPac: '__DEMO__',
        pacienteNombre: 'Paciente Demo',
        lineas: [
            { id: 'L1', idPre: 1001, descripcion: 'Revisión y exploración bucal', cantidad: 1, precioPresupuesto: 40, precioUnitario: 40, descuento: 0, importeLinea: 40, importeCobrado: 40, estado: 'Finalizado' },
            { id: 'L2', idPre: 1001, descripcion: 'Radiografía panorámica', cantidad: 1, precioPresupuesto: 65, precioUnitario: 65, descuento: 0, importeLinea: 65, importeCobrado: 65, estado: 'Finalizado' },
            { id: 'L3', idPre: 1001, descripcion: 'Empaste (composite) 2 caras', pieza: '16', cantidad: 1, precioPresupuesto: 120, precioUnitario: 120, descuento: 0, importeLinea: 120, importeCobrado: 120, estado: 'Finalizado' },
            { id: 'L4', idPre: 1001, descripcion: 'Limpieza dental (tartrectomía)', cantidad: 1, precioPresupuesto: 80, precioUnitario: 80, descuento: 0, importeLinea: 80, importeCobrado: 0, estado: 'Pendiente' },
        ],
        importeTotal: 305, importeCobrado: 225, importePendiente: 80,
        importePagado: 225, lineasPendientes: 1, lineasFinalizadas: 3,
        estado: 'En curso', fechaInicio: '2026-01-15', fecha: '2026-01-15', fechaAceptacion: '2026-01-16',
        notas: 'Paciente prefiere citas los martes por la tarde.',
    },
    {
        id: 1002,
        idPac: '__DEMO__',
        pacienteNombre: 'Paciente Demo',
        lineas: [
            { id: 'L5', idPre: 1002, descripcion: 'Implante dental (titanio)', pieza: '46', cantidad: 1, precioPresupuesto: 1200, precioUnitario: 1200, descuento: 0, importeLinea: 1200, importeCobrado: 0, estado: 'Pendiente' },
            { id: 'L6', idPre: 1002, descripcion: 'Cirugía de inserción de implante', pieza: '46', cantidad: 1, precioPresupuesto: 350, precioUnitario: 350, descuento: 0, importeLinea: 350, importeCobrado: 0, estado: 'Pendiente' },
            { id: 'L7', idPre: 1002, descripcion: 'Corona cerámica (zirconio)', pieza: '46', cantidad: 1, precioPresupuesto: 850, precioUnitario: 850, descuento: 10, importeLinea: 765, importeCobrado: 0, estado: 'Pendiente' },
        ],
        importeTotal: 2315, importeCobrado: 0, importePendiente: 2315,
        importePagado: 0, lineasPendientes: 3, lineasFinalizadas: 0,
        estado: 'Pendiente', fechaInicio: '2026-03-10', fecha: '2026-03-10',
        notas: '10% de descuento aplicado en la corona.',
    },
];

// ── Internal helpers ──────────────────────────────────────────────────────────

function loadAll(): Presupuesto[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    // Seed with demo data on first load
    const demo = getDemoData();
    try { localStorage.setItem(LS_KEY, JSON.stringify(demo)); } catch { /* ignore */ }
    return demo;
}

function saveAll(data: Presupuesto[]): void {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function computeTotals(lineas: LineaPresupuesto[]): Pick<Presupuesto, 'importeTotal' | 'importeCobrado' | 'importePendiente' | 'lineasPendientes' | 'lineasFinalizadas'> {
    const importeTotal  = lineas.reduce((s, l) => s + l.importeLinea, 0);
    const importeCobrado = lineas.reduce((s, l) => s + (l.importeCobrado ?? 0), 0);
    return {
        importeTotal,
        importeCobrado,
        importePendiente: importeTotal - importeCobrado,
        lineasPendientes: lineas.filter(l => l.estado === 'Pendiente').length,
        lineasFinalizadas: lineas.filter(l => l.estado === 'Finalizado').length,
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const getPresupuestosByPaciente = async (numPac: string, _idPac?: string): Promise<Presupuesto[]> => {
    if (!numPac) return [];

    // Try backend first
    try {
        const res = await authFetch(`${API_BASE}/budgets?patientId=${encodeURIComponent(numPac)}&pageSize=200`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                return json.data as Presupuesto[];
            }
        }
    } catch { /* fallthrough to localStorage */ }

    // Fallback: localStorage
    const all = loadAll();
    const forPac = all.filter(p => p.idPac === numPac);
    if (forPac.length === 0) {
        const demo = getDemoData().map(p => ({ ...p, idPac: numPac }));
        saveAll([...all, ...demo]);
        return demo;
    }
    return forPac.sort((a, b) => b.id - a.id);
};

export const getResumenEconomico = async (numPac: string, _idPac?: string) => {
    const pres = await getPresupuestosByPaciente(numPac, _idPac);
    const totalPresupuestado = pres.reduce((s, p) => s + p.importeTotal, 0);
    const totalCobrado = pres.reduce((s, p) => s + p.importeCobrado, 0);
    const totalPendiente = pres.reduce((s, p) => s + p.importePendiente, 0);
    return {
        totalPresupuestado,
        totalCobrado,
        totalPendiente,
        totalFacturado: totalPresupuestado,
        totalPagado: totalCobrado,
        deudaPendiente: totalPendiente,
        presupuestosCount: pres.length,
    };
};

export const createPresupuesto = async (data: Omit<Presupuesto, 'id'>): Promise<Presupuesto> => {
    const all = loadAll();
    const maxId = all.reduce((m, p) => Math.max(m, p.id), 1000);
    const totals = computeTotals(data.lineas);
    const pres: Presupuesto = {
        ...data,
        ...totals,
        id: maxId + 1,
        fecha: data.fecha ?? new Date().toISOString().slice(0, 10),
        importePagado: totals.importeCobrado,
    };
    saveAll([pres, ...all]);
    return pres;
};

export const updatePresupuesto = async (id: number, updates: Partial<Presupuesto>): Promise<Presupuesto | null> => {
    const all = loadAll();
    const idx = all.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const merged: Presupuesto = { ...all[idx], ...updates };
    if (updates.lineas) {
        const totals = computeTotals(updates.lineas);
        Object.assign(merged, totals, { importePagado: totals.importeCobrado });
    }
    all[idx] = merged;
    saveAll(all);
    return merged;
};

export const deletePresupuesto = async (id: number): Promise<boolean> => {
    const all = loadAll();
    const next = all.filter(p => p.id !== id);
    if (next.length === all.length) return false;
    saveAll(next);
    return true;
};

export const aceptarPresupuesto = async (id: number, _numPac: string, _por?: string): Promise<boolean> => {
    const result = await updatePresupuesto(id, { estado: 'Aceptado', fechaAceptacion: new Date().toISOString().slice(0, 10) });
    return result !== null;
};

export const rechazarPresupuesto = async (id: number, _numPac: string, _por?: string): Promise<boolean> => {
    const result = await updatePresupuesto(id, { estado: 'Rechazado' });
    return result !== null;
};

export const registrarCobro = async (id: number, importe: number): Promise<Presupuesto | null> => {
    const all = loadAll();
    const pres = all.find(p => p.id === id);
    if (!pres) return null;
    const newCobrado = Math.min(pres.importeCobrado + importe, pres.importeTotal);
    return updatePresupuesto(id, {
        importeCobrado: newCobrado,
        importePendiente: pres.importeTotal - newCobrado,
        importePagado: newCobrado,
        estado: newCobrado >= pres.importeTotal ? 'Finalizado' : pres.estado === 'Aceptado' ? 'En curso' : pres.estado,
    });
};
