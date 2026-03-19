// ─────────────────────────────────────────────────────────────────
//  services/citas.service.ts
//  CRUD de citas → backend local Node.js (localhost:3000/api/appointments)
//  Datos reales: 47.712 citas en PostgreSQL local (réplica GELITE DCitas).
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { type Cita, type EstadoCita, type TratamientoCategoria } from '../types';
import { logger } from './logger';
import { authFetch } from './db';

const API_BASE = 'http://localhost:3000/api/appointments';

// ── Estado: backend string → EstadoCita ──────────────────────────
// El backend devuelve 'scheduled', 'confirmed', 'no_show', etc.
const estadoFromBackend = (estado: string): EstadoCita => {
    switch (estado) {
        case 'scheduled':   return 'planificada';
        case 'confirmed':   return 'confirmada';
        case 'waiting':     return 'espera';
        case 'in_progress': return 'gabinete';
        case 'completed':   return 'finalizada';
        case 'no_show':     return 'fallada';
        case 'cancelled':   return 'anulada';
        default:            return 'planificada';
    }
};

// ── EstadoCita → backend string ───────────────────────────────────
const estadoToBackend = (estado: EstadoCita): string => {
    switch (estado) {
        case 'planificada': return 'scheduled';
        case 'confirmada':  return 'confirmed';
        case 'espera':      return 'waiting';
        case 'gabinete':    return 'in_progress';
        case 'finalizada':  return 'completed';
        case 'fallada':     return 'no_show';
        case 'anulada':     return 'cancelled';
        case 'cancelada':   return 'cancelled';
        default:            return 'scheduled';
    }
};

// ── Tratamiento → categoría UI ────────────────────────────────────
const tratamientoToCategoria = (tto?: string): TratamientoCategoria => {
    switch (tto) {
        case 'Control':
        case 'Primera Visita':
        case 'Estudio Ortodoncia':
        case 'Rx/escaner':
            return 'Diagnostico';
        case 'Urgencia': return 'Urgencia';
        case 'Protesis Fija':
        case 'Protesis Removible':
        case 'Ajuste Prot/tto': return 'Protesis';
        case 'Cirugia/Injerto':
        case 'Exodoncia': return 'Cirugía';
        case 'Retirar Ortodoncia':
        case 'Colocacion Ortodoncia':
        case 'Mensualidad Ortodoncia': return 'Ortodoncia';
        case 'Periodoncia': return 'Periodoncia';
        case 'Cirugia de Implante': return 'Implante';
        case 'Higiene Dental': return 'Higiene';
        case 'Endodoncia': return 'Endodoncia';
        case 'Reconstruccion': return 'Conservadora';
        default: return 'Diagnostico';
    }
};

// ── Mapper: respuesta backend → Cita ─────────────────────────────
const mapRowToCita = (r: any): Cita => ({
    id: String(r.id),
    pacienteNumPac: r.numPac ?? '',
    nombrePaciente: r.nombreCompleto ?? r.apellidos ?? 'PACIENTE',
    gabinete: r.gabinete ?? 'G1',
    horaInicio: r.hora ?? '00:00',
    duracionMinutos: Number(r.duracion ?? 30),
    tratamiento: r.tratamiento ?? 'Control',
    categoria: tratamientoToCategoria(r.tratamiento),
    estado: estadoFromBackend(r.estado ?? 'scheduled'),
    doctor: r.idCol != null ? DOCTOR_MAP[r.idCol] ?? `Col.${r.idCol}` : (r.doctor ?? ''),
    fecha: r.fecha ?? undefined,
    alertasMedicas: [],
    alertasLegales: [],
    alertasFinancieras: false,
    notas: r.notas ?? '',
});

// ── Date helper ───────────────────────────────────────────────────
export const dateToISO = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// ── isDbConfigured — siempre true (backend siempre disponible) ────
export const isDbConfigured = (): boolean => true;

// ── Mapa IdUsu → Nombre agenda (TUsuAgd, Rubio García Dental) ────
// Fuente: SELECT IdUsu, Descripcio FROM TUsuAgd ORDER BY IdUsu
// G1: IdUsu 1-8, 10, 11 (doctores + Miriam)
// G2: IdUsu 9 (HIGIENES), 12 (AUXILIAR)
export const IDUSU_NOMBRE_MAP: Record<number, string> = {
    1:  'Lucia Guillén',
    2:  'Carolina Nieto',
    3:  'Mario Rubio',
    4:  'Irene García',
    5:  'Marta Pérez',
    6:  'Águeda Díaz',
    7:  'Tatiana Martín',
    8:  'Virginia Tresgallo',
    9:  'Higienes',
    10: 'Miriam Carrasco',
    11: 'Miriam',
    12: 'Auxiliar',
};

/** Extrae el IdUsu del id de cita (formato "IdUsu-IdOrden") */
export const getIdUsuFromCitaId = (id: string): number => {
    const n = parseInt(id.split('-')[0]);
    return isNaN(n) ? 0 : n;
};

/** Nombre del agenda/doctor para un IdUsu */
export const nombreAgendaByIdUsu = (idUsu: number): string =>
    IDUSU_NOMBRE_MAP[idUsu] ?? `Gabinete ${idUsu}`;

// ─────────────────────────────────────────────────────────────────
//  LECTURA
// ─────────────────────────────────────────────────────────────────

/** Todas las citas de un día concreto */
export const getCitasByFecha = async (fecha: Date): Promise<Cita[]> => {
    const fechaStr = dateToISO(fecha);
    logger.info('[CITAS] Buscando fecha:', fechaStr);
    try {
        const res = await authFetch(`${API_BASE}?date=${fechaStr}&limit=500`);
        if (!res.ok) { logger.error('[CITAS] Error cargando citas:', res.status); return []; }
        const json = await res.json();
        const rows: any[] = json.data ?? [];
        logger.info('[CITAS] Rows recibidas:', rows.length);
        return rows.map(mapRowToCita);
    } catch (e) {
        logger.error('[CITAS] getCitasByFecha error:', e);
        return [];
    }
};

/** Citas de un rango de fechas */
export const getCitasRangoFecha = async (from: Date, to: Date): Promise<Cita[]> => {
    try {
        const res = await authFetch(`${API_BASE}?from=${dateToISO(from)}&to=${dateToISO(to)}&limit=2000`);
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data ?? []).map(mapRowToCita);
    } catch (e) {
        logger.error('[CITAS] getCitasRangoFecha error:', e);
        return [];
    }
};

/** Citas de un paciente por NumPac */
export const getCitasByPaciente = async (numPac: string): Promise<Cita[]> => {
    if (!numPac) return [];
    try {
        const res = await authFetch(`${API_BASE}?pacienteNumPac=${encodeURIComponent(numPac)}&limit=200`);
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data ?? []).map(mapRowToCita);
    } catch (e) {
        logger.error('[CITAS] getCitasByPaciente error:', e);
        return [];
    }
};

// ─────────────────────────────────────────────────────────────────
//  ESCRITURA
// ─────────────────────────────────────────────────────────────────

/** Crea una nueva cita en DCitas vía backend */
export const createCita = async (cita: Omit<Cita, 'id'>, fecha: Date): Promise<Cita | null> => {
    try {
        const res = await authFetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fecha: cita.fecha ?? dateToISO(fecha),
                horaInicio: cita.horaInicio,
                duracionMinutos: cita.duracionMinutos,
                gabinete: cita.gabinete,
                pacienteNumPac: cita.pacienteNumPac,
                nombrePaciente: cita.nombrePaciente,
                estado: estadoToBackend(cita.estado),
                tratamiento: cita.tratamiento,
                notas: cita.notas ?? '',
            }),
        });
        if (!res.ok) { logger.error('[CITAS] createCita error HTTP:', res.status); return null; }
        const json = await res.json();
        return mapRowToCita(json.data ?? json);
    } catch (e) {
        logger.error('[CITAS] createCita error:', e);
        return null;
    }
};

/** Actualiza una cita existente. El id tiene formato "IdUsu-IdOrden". */
export const updateCita = async (
    id: string,
    updates: Partial<Cita>,
    _nuevaFecha?: Date
): Promise<Cita | null> => {
    try {
        const body: Record<string, any> = {};
        if (updates.fecha)              body.fecha = updates.fecha;
        if (updates.horaInicio)         body.horaInicio = updates.horaInicio;
        if (updates.duracionMinutos)    body.duracionMinutos = updates.duracionMinutos;
        if (updates.estado)             body.estado = estadoToBackend(updates.estado);
        if (updates.nombrePaciente)     body.nombrePaciente = updates.nombrePaciente;
        if (updates.tratamiento)        body.tratamiento = updates.tratamiento;
        if (updates.notas !== undefined) body.notas = updates.notas;

        const res = await authFetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) { logger.error('[CITAS] updateCita error HTTP:', res.status); return null; }
        const json = await res.json();
        return mapRowToCita(json.data ?? json);
    } catch (e) {
        logger.error('[CITAS] updateCita error:', e);
        return null;
    }
};

/** Actualiza solo el estado de una cita */
export const updateEstadoCita = async (id: string, estado: EstadoCita): Promise<boolean> => {
    try {
        if (estado === 'anulada' || estado === 'cancelada') {
            const res = await authFetch(`${API_BASE}/${id}/cancel`, { method: 'PATCH' });
            return res.ok;
        }
        const res = await authFetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: estadoToBackend(estado) }),
        });
        return res.ok;
    } catch (e) {
        logger.error('[CITAS] updateEstadoCita error:', e);
        return false;
    }
};

/** Elimina (cancela) una cita */
export const deleteCita = async (id: string): Promise<boolean> => {
    return updateEstadoCita(id, 'anulada');
};

// ─────────────────────────────────────────────────────────────────
//  COLABORADORES / DOCTORES
// ─────────────────────────────────────────────────────────────────

export const DOCTOR_MAP: Record<number, string> = {
    1:  'Lucia Guillén',
    2:  'Dr. Mario Rubio',
    3:  'Dra. Irene García',
    4:  'Lydia Abalos',
    5:  'Águeda Díaz',
    6:  'Primeras Visitas',
    7:  'José Manuel Rizo',
    8:  'María Manzano',
    9:  'Fátima Regodon',
    10: 'Juan Antonio',
    11: 'Vivian Martínez',
    12: 'Carolina Nieto',
    13: 'Marta Pérez',
    14: 'Patricia López',
    15: 'Yolanda Ballesteros',
    16: 'Virginia Tresgallo',
    17: 'Ignacio Ferrero',
    18: 'Miriam Carrasco',
    21: 'Borja Galera',
    22: 'Alicia',
    23: 'Tatiana Martín',
    24: 'Daniel González',
};

/** Nombre del colaborador por IdCol */
export const getColaboradorNombre = async (idCol?: number): Promise<string> => {
    if (!idCol) return 'Sin asignar';
    return DOCTOR_MAP[idCol] ?? `Col. ${idCol}`;
};

// ─────────────────────────────────────────────────────────────────
//  ENTRADAS MÉDICAS (TtosMed GELITE via backend /api/clinical)
// ─────────────────────────────────────────────────────────────────

const CLINICAL_BASE = 'http://localhost:3000/api/clinical';

export interface EntradaMedica {
    id: number;
    fecha: string | null;
    tratamiento: string;
    notas: string;
    piezas: number[];
    importe: number;
    estado: number;
}

export const getEntradasMedicas = async (
    idPac: number,
    opts: { page?: number; pageSize?: number; order?: 'asc' | 'desc' } = {}
): Promise<EntradaMedica[]> => {
    if (!idPac) return [];
    try {
        const params = new URLSearchParams({
            page: String(opts.page ?? 1),
            pageSize: String(opts.pageSize ?? 100),
            order: opts.order ?? 'desc',
        });
        const res = await authFetch(`${CLINICAL_BASE}/patients/${idPac}/entradas?${params}`);
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data ?? []) as EntradaMedica[];
    } catch (e) {
        logger.warn('[ENTRADAS] Error cargando entradas médicas:', e);
        return [];
    }
};

export const getHistorialCitasPaciente = async (
    _apellidos: string,
    _nombre: string,
    _idPac?: number
): Promise<import('../types').SOAPNote[]> => [];

export const getTratamientosPaciente = async (
    _idPac: number
): Promise<{ id: number; fecha: string; tratamientos: string[]; total: number; estado: string }[]> => [];

