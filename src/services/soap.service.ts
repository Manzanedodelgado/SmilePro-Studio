// ─────────────────────────────────────────────────────────────────
//  services/soap.service.ts
//  Notas SOAP — usa /api/clinical/records del backend.
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { type SOAPNote } from '../types';
import { logger } from './logger';

const API_BASE = 'http://localhost:3000/api/clinical';

const mapRecord = (r: any): SOAPNote => ({
    id: r.id,
    fecha: r.date ?? r.fecha ?? new Date().toISOString(),
    doctor: r.doctorId ?? r.doctor ?? '',
    especialidad: r.specialty ?? r.especialidad ?? '',
    subjetivo: r.content ?? r.subjetivo ?? '',
    objetivo: r.objetivo ?? '',
    analisis: r.evaluacion ?? r.analisis ?? '',
    plan: r.plan ?? '',
    eva: Number(r.evaScore ?? r.eva_score ?? r.eva ?? 0),
    firmada: r.firmada ?? false,
    timestamp: r.createdAt ?? r.timestamp ?? r.date ?? new Date().toISOString(),
    alertasDetectadas: r.alertas_detectadas ?? r.alertasDetectadas ?? [],
    tratamiento_id: r.treatmentId ?? r.tratamiento_id ?? undefined,
});

export const getSoapNotes = async (numPac: string): Promise<SOAPNote[]> => {
    try {
        const res = await fetch(`${API_BASE}/patients/${encodeURIComponent(numPac)}/history`);
        if (!res.ok) return [];
        const json = await res.json();
        const records: any[] = json.data?.records ?? json.data ?? [];
        return records.map(mapRecord);
    } catch (e) {
        logger.error('[SOAP] getSoapNotes error:', e);
        return [];
    }
};

/** numPac es el NumPac GELITE del paciente; note es el cuerpo de la nota */
export const createSoapNote = async (numPac: string, note: Omit<SOAPNote, 'id'>): Promise<SOAPNote | null> => {
    try {
        const res = await fetch(`${API_BASE}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patientId: numPac,
                doctorId: note.doctor,
                type: 'SOAP',
                content: note.subjetivo,
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

export const updateSoapNote = async (id: string, _updates: Partial<SOAPNote>): Promise<SOAPNote | null> => {
    // TODO: exponer PATCH /api/clinical/records/:id en el backend
    logger.warn('[SOAP] updateSoapNote no implementado aún en backend', id);
    return null;
};

export const deleteSoapNote = async (id: string): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/records/${id}`, { method: 'DELETE' });
        return res.ok;
    } catch { return false; }
};
