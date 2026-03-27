// ─────────────────────────────────────────────────────────────────
//  services/supabase.service.ts
//  Alergias y medicaciones → backend propio /api/patients/:numPac/
//  (ya no usa Supabase externo — datos persisten en BD local)
// ─────────────────────────────────────────────────────────────────
import { authFetch } from './db';

const API_BASE = '/api/patients';

export const isSupabaseConfigured = (): boolean => true; // siempre disponible con backend propio

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface PatientMedication {
    id: string;
    paciente_id: string;
    nombre: string;
    dosis?: string;
    frecuencia?: string;
    importante: boolean;
    categoria?: string;
    nota?: string;
}

export interface PatientAllergy {
    id: string;
    paciente_id: string;
    nombre: string;
    severidad: 'leve' | 'moderada' | 'grave';
}

// Adapta la respuesta del backend (numPac) al tipo legacy (paciente_id)
const mapMed = (r: any): PatientMedication => ({
    id: r.id,
    paciente_id: r.numPac ?? r.num_pac ?? '',
    nombre: r.nombre,
    dosis: r.dosis ?? undefined,
    frecuencia: r.frecuencia ?? undefined,
    importante: r.importante ?? false,
    categoria: r.categoria ?? undefined,
    nota: r.nota ?? undefined,
});

const mapAllergy = (r: any): PatientAllergy => ({
    id: r.id,
    paciente_id: r.numPac ?? r.num_pac ?? '',
    nombre: r.nombre,
    severidad: r.severidad ?? 'moderada',
});

// ── MEDICACIONES ───────────────────────────────────────────────────────────

export const getMedications = async (pacienteId: string): Promise<PatientMedication[]> => {
    try {
        const res = await authFetch(`${API_BASE}/${encodeURIComponent(pacienteId)}/medications`);
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data ?? []).map(mapMed);
    } catch { return []; }
};

export const upsertMedication = async (
    med: Omit<PatientMedication, 'id'> & { id?: string }
): Promise<PatientMedication | null> => {
    try {
        const numPac = med.paciente_id;
        if (med.id) {
            const res = await authFetch(`${API_BASE}/${encodeURIComponent(numPac)}/medications/${med.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: med.nombre, dosis: med.dosis, frecuencia: med.frecuencia, importante: med.importante, categoria: med.categoria, nota: med.nota }),
            });
            if (!res.ok) return null;
            const json = await res.json();
            return mapMed(json.data);
        } else {
            const res = await authFetch(`${API_BASE}/${encodeURIComponent(numPac)}/medications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: med.nombre, dosis: med.dosis, frecuencia: med.frecuencia, importante: med.importante, categoria: med.categoria, nota: med.nota }),
            });
            if (!res.ok) return null;
            const json = await res.json();
            return mapMed(json.data);
        }
    } catch { return null; }
};

export const deleteMedication = async (id: string, pacienteId: string): Promise<boolean> => {
    try {
        const res = await authFetch(`${API_BASE}/${encodeURIComponent(pacienteId)}/medications/${id}`, { method: 'DELETE' });
        return res.ok;
    } catch { return false; }
};

// ── ALERGIAS ───────────────────────────────────────────────────────────────

export const getAllergies = async (pacienteId: string): Promise<PatientAllergy[]> => {
    try {
        const res = await authFetch(`${API_BASE}/${encodeURIComponent(pacienteId)}/allergies`);
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data ?? []).map(mapAllergy);
    } catch { return []; }
};

export const upsertAllergy = async (
    allergy: Omit<PatientAllergy, 'id'> & { id?: string }
): Promise<PatientAllergy | null> => {
    try {
        const numPac = allergy.paciente_id;
        if (allergy.id) {
            // No hay PATCH de alergias — delete + create
            await deleteMedication(allergy.id, numPac);
        }
        const res = await authFetch(`${API_BASE}/${encodeURIComponent(numPac)}/allergies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: allergy.nombre, severidad: allergy.severidad }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return mapAllergy(json.data);
    } catch { return null; }
};

export const deleteAllergy = async (id: string, pacienteId: string): Promise<boolean> => {
    try {
        const res = await authFetch(`${API_BASE}/${encodeURIComponent(pacienteId)}/allergies/${id}`, { method: 'DELETE' });
        return res.ok;
    } catch { return false; }
};

// ── Compatibilidad: migración SQL (ya no necesaria) ────────────────────────
export const SUPABASE_MIGRATION_SQL = '-- Migrado al backend local (PostgreSQL / Prisma)';
