/// <reference types="vite/client" />
// ─────────────────────────────────────────────────────────────────
//  services/supabase.service.ts
//  Integración con Supabase para medicaciones y alergias.
//
//  Configurar en .env.local:
//    VITE_SUPABASE_URL=https://xxxx.supabase.co
//    VITE_SUPABASE_ANON_KEY=eyJhbGci...
//
//  Sin credenciales → modo local (sin persistencia)
// ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meta = import.meta as any;
const SUPABASE_URL = meta.env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = (): boolean =>
    Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ── Tipos ──────────────────────────────────────────────────────

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

// ── SQL de migración (copiar en Supabase SQL Editor) ──────────
export const SUPABASE_MIGRATION_SQL = `
-- Medicaciones del paciente
CREATE TABLE IF NOT EXISTS patient_medications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id   text NOT NULL,
  nombre        text NOT NULL,
  dosis         text,
  frecuencia    text,
  importante    boolean DEFAULT false,
  categoria     text,
  nota          text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Alergias del paciente
CREATE TABLE IF NOT EXISTS patient_allergies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id   text NOT NULL,
  nombre        text NOT NULL,
  severidad     text DEFAULT 'moderada',
  created_at    timestamptz DEFAULT now()
);

-- Row Level Security
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_allergies   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_full_access_medications" ON patient_medications FOR ALL USING (true);
CREATE POLICY "clinic_full_access_allergies"   ON patient_allergies   FOR ALL USING (true);

-- Índices
CREATE INDEX IF NOT EXISTS patient_medications_paciente_id ON patient_medications(paciente_id);
CREATE INDEX IF NOT EXISTS patient_allergies_paciente_id   ON patient_allergies(paciente_id);
`.trim();

// ── Helper fetch ───────────────────────────────────────────────

const sbFetch = async (path: string, options?: RequestInit) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
            'apikey': SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            ...(options?.headers ?? {}),
        },
    });
};

// ── MEDICACIONES ───────────────────────────────────────────────

export const getMedications = async (pacienteId: string): Promise<PatientMedication[]> => {
    if (!isSupabaseConfigured()) return [];
    const res = await sbFetch(`patient_medications?paciente_id=eq.${encodeURIComponent(pacienteId)}&order=importante.desc,nombre.asc`);
    if (!res.ok) return [];
    return res.json();
};

export const upsertMedication = async (med: Omit<PatientMedication, 'id'> & { id?: string }): Promise<PatientMedication | null> => {
    if (!isSupabaseConfigured()) {
        return { ...med, id: med.id ?? crypto.randomUUID() } as PatientMedication;
    }
    const res = await sbFetch('patient_medications', {
        method: med.id ? 'PATCH' : 'POST',
        headers: med.id ? { 'id': `eq.${med.id}` } : {},
        body: JSON.stringify(med),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
};

export const deleteMedication = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) return true;
    const res = await sbFetch(`patient_medications?id=eq.${id}`, { method: 'DELETE' });
    return res.ok;
};

// ── ALERGIAS ───────────────────────────────────────────────────

export const getAllergies = async (pacienteId: string): Promise<PatientAllergy[]> => {
    if (!isSupabaseConfigured()) return [];
    const res = await sbFetch(`patient_allergies?paciente_id=eq.${encodeURIComponent(pacienteId)}&order=severidad.asc`);
    if (!res.ok) return [];
    return res.json();
};

export const upsertAllergy = async (alergy: Omit<PatientAllergy, 'id'> & { id?: string }): Promise<PatientAllergy | null> => {
    if (!isSupabaseConfigured()) {
        return { ...alergy, id: alergy.id ?? crypto.randomUUID() } as PatientAllergy;
    }
    const res = await sbFetch('patient_allergies', {
        method: alergy.id ? 'PATCH' : 'POST',
        body: JSON.stringify(alergy),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
};

export const deleteAllergy = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) return true;
    const res = await sbFetch(`patient_allergies?id=eq.${id}`, { method: 'DELETE' });
    return res.ok;
};
