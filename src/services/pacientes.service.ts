// ─────────────────────────────────────────────────────────────────
//  services/pacientes.service.ts
//  CRUD completo de pacientes conectado al Backend Local (Node.js/Prisma).
// ─────────────────────────────────────────────────────────────────
import { type Paciente } from '../types';
import { logger } from './logger';
import { authFetch, isDbConfigured } from './db';

export interface ValidationError { field: string; message: string; }

const API_BASE_URL = 'http://localhost:3000/api';

/** Convierte fila de Prisma al tipo Paciente del frontend */
const mapPrismaToPaciente = (row: any): Paciente => ({
    numPac: row.NumPac !== null && row.NumPac !== undefined ? String(row.NumPac) : String(row.IdPac ?? ''),
    idPac: row.IdPac,
    nombre: row.Nombre ?? '',
    apellidos: row.Apellidos ?? '',
    dni: row.NIF ?? '',
    telefono: row.TelMovil ?? row.Tel1 ?? row.Tel2 ?? '',
    fechaNacimiento: row.FecNacim ? new Date(row.FecNacim).toISOString().split('T')[0] : '',
    email: row.Email ?? undefined,
    direccion: row.Direccion ?? undefined,
    cp: row.CP ?? undefined,
    tutor: undefined,
    alergias: [],
    medicacionActual: undefined,
    deuda: false,
    historial: [],
    consentimientosFirmados: false,
});

export const searchPacientes = async (query: string): Promise<Paciente[]> => {
    try {
        const url = new URL(`${API_BASE_URL}/patients`);
        if (query.trim()) url.searchParams.append('search', query.trim());
        url.searchParams.append('limit', '50');

        const res = await authFetch(url.toString());
        if (!res.ok) throw new Error('Error buscando pacientes');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            return json.data.map(mapPrismaToPaciente);
        }
        return [];
    } catch (error) {
        logger.error('[PACIENTES] searchPacientes error:', error);
        return [];
    }
};

export const getPaciente = async (numPac: string): Promise<Paciente | null> => {
    try {
        const res = await authFetch(`${API_BASE_URL}/patients/${numPac}`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.success && json.data ? mapPrismaToPaciente(json.data) : null;
    } catch (error) {
        logger.error('[PACIENTES] getPaciente error:', error);
        return null;
    }
};

// ── Validación ────────────────────────────────────────────────────────
export const validatePaciente = (p: Partial<Omit<Paciente, 'historial'>>): ValidationError[] => {
    const errs: ValidationError[] = [];

    if (!p.nombre?.trim()) errs.push({ field: 'nombre', message: 'El nombre es obligatorio' });
    else if (p.nombre.trim().length < 2) errs.push({ field: 'nombre', message: 'Nombre: mínimo 2 caracteres' });

    if (!p.apellidos?.trim()) errs.push({ field: 'apellidos', message: 'Los apellidos son obligatorios' });
    else if (p.apellidos.trim().length < 2) errs.push({ field: 'apellidos', message: 'Apellidos: mínimo 2 caracteres' });

    if (!p.telefono?.trim()) errs.push({ field: 'telefono', message: 'El teléfono es obligatorio' });

    return errs;
};

export const createPaciente = async (p: Omit<Paciente, 'historial'>): Promise<Paciente | null> => {
    const errors = validatePaciente(p);
    if (errors.length > 0) throw new Error(`Datos inválidos: ${errors.map(e => e.message).join(', ')}`);

    try {
        const res = await authFetch(`${API_BASE_URL}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                NumPac: p.numPac || undefined,
                Nombre: p.nombre,
                Apellidos: p.apellidos,
                NIF: p.dni,
                TelMovil: p.telefono,
                Email: p.email,
                Direccion: p.direccion,
                CP: p.cp,
                FecNacim: p.fechaNacimiento || undefined,
            })
        });
        if (!res.ok) throw new Error('Error al crear paciente');
        const json = await res.json();
        return json.success && json.data ? mapPrismaToPaciente(json.data) : null;
    } catch (error) {
        logger.error('[PACIENTES] createPaciente error:', error);
        return null;
    }
};

/** Actualiza datos de un paciente existente */
export const updatePaciente = async (numPac: string, updates: Partial<Omit<Paciente, 'historial'>>): Promise<Paciente | null> => {
    try {
        const body: any = {};
        if (updates.nombre) body.Nombre = updates.nombre;
        if (updates.apellidos) body.Apellidos = updates.apellidos;
        if (updates.dni) body.NIF = updates.dni;
        if (updates.telefono) body.TelMovil = updates.telefono;
        
        const res = await authFetch(`${API_BASE_URL}/patients/${numPac}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Error al actualizar paciente');
        const json = await res.json();
        return json.success && json.data ? mapPrismaToPaciente(json.data) : null;
    } catch (error) {
        logger.error('[PACIENTES] updatePaciente error:', error);
        return null;
    }
};

export const deletePaciente = async (numPac: string): Promise<boolean> => {
    try {
        const res = await authFetch(`${API_BASE_URL}/patients/${numPac}`, { method: 'DELETE' });
        return res.ok;
    } catch (error) {
        logger.error('[PACIENTES] deletePaciente error:', error);
        return false;
    }
};

export { isDbConfigured };
