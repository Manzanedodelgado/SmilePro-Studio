// ─────────────────────────────────────────────────────────────────
//  services/soap.service.ts
//  Notas SOAP — usa /api/clinical del backend (persistencia real BD).
// ─────────────────────────────────────────────────────────────────
import { type SOAPNote } from '../types';
import { logger } from './logger';
import { authFetch } from './db';

const API_BASE = '/api/clinical';

const mapRecord = (r: any): SOAPNote => ({
    id: r.id,
    fecha: r.date ?? r.fecha ?? new Date().toISOString(),
    doctor: r.doctorId ?? r.doctor ?? r.userId ?? '',
    especialidad: r.specialty ?? r.especialidad ?? '',
    subjetivo: r.content ?? r.subjetivo ?? '',
    objetivo: r.objetivo ?? '',
    analisis: r.analisis ?? r.evaluacion ?? '',
    plan: r.plan ?? '',
    eva: Number(r.evaScore ?? r.eva_score ?? r.eva ?? 0),
    firmada: r.firmada ?? false,
    timestamp: r.createdAt ?? r.timestamp ?? r.date ?? new Date().toISOString(),
    alertasDetectadas: r.alertas_detectadas ?? r.alertasDetectadas ?? [],
    tratamiento_id: r.treatmentId ?? r.tratamiento_id ?? r.tratamientoId ?? undefined,
    tratamiento_nombre: r.tratamiento_nombre ?? r.tratamientoNombre ?? undefined,
});

/** Obtiene las notas SOAP propias de SmilePro para un paciente (por NumPac) */
export const getSoapNotes = async (numPac: string): Promise<SOAPNote[]> => {
    try {
        const res = await authFetch(`${API_BASE}/patients/${encodeURIComponent(numPac)}/soap`);
        if (!res.ok) return [];
        const json = await res.json();
        const records: any[] = json.data ?? [];
        return records.map(mapRecord);
    } catch (e) {
        logger.error('[SOAP] getSoapNotes error:', e);
        return [];
    }
};

/** Crea una nota SOAP nueva — persiste en clinical_records */
export const createSoapNote = async (numPac: string, note: Omit<SOAPNote, 'id'>): Promise<SOAPNote | null> => {
    try {
        const res = await authFetch(`${API_BASE}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patientId: numPac,
                doctorId: note.doctor,
                type: 'SOAP',
                content: note.subjetivo,
                objetivo: note.objetivo,
                analisis: note.analisis,
                plan: note.plan,
                eva: note.eva,
                especialidad: note.especialidad,
                tratamientoId: note.tratamiento_id,
                tratamientoNombre: note.tratamiento_nombre,
                date: note.fecha,
            }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return mapRecord(json.data ?? json);
    } catch (e) {
        logger.error('[SOAP] createSoapNote error:', e);
        return null;
    }
};

/** Edita una nota SOAP existente — PATCH en clinical_records */
export const updateSoapNote = async (id: string, updates: Partial<SOAPNote>): Promise<SOAPNote | null> => {
    try {
        const res = await authFetch(`${API_BASE}/records/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content:     updates.subjetivo,
                objetivo:    updates.objetivo,
                analisis:    updates.analisis,
                plan:        updates.plan,
                eva:         updates.eva,
                especialidad: updates.especialidad,
                date:        updates.fecha,
            }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return mapRecord(json.data ?? json);
    } catch (e) {
        logger.error('[SOAP] updateSoapNote error:', e);
        return null;
    }
};

/** Elimina una nota SOAP */
export const deleteSoapNote = async (id: string): Promise<boolean> => {
    try {
        const res = await authFetch(`${API_BASE}/records/${id}`, { method: 'DELETE' });
        return res.ok;
    } catch { return false; }
};
