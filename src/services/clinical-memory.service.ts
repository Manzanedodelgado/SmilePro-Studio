// ─────────────────────────────────────────────────────────────────
//  services/clinical-memory.service.ts
//  Almacén en memoria para medicaciones y alergias del paciente.
//  Stub temporal — sin dependencia de ninguna base de datos externa.
//  TODO: conectar a la API del backend cuando esté disponible.
// ─────────────────────────────────────────────────────────────────

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

// Almacenes en memoria (se pierden al reiniciar el servidor)
const _meds = new Map<string, PatientMedication[]>();
const _allergies = new Map<string, PatientAllergy[]>();

export const getMedications = async (pacienteId: string): Promise<PatientMedication[]> =>
    _meds.get(pacienteId) ?? [];

export const upsertMedication = async (med: Omit<PatientMedication, 'id'> & { id?: string }): Promise<PatientMedication | null> => {
    const id = med.id ?? crypto.randomUUID();
    const full: PatientMedication = { ...med, id };
    const list = _meds.get(med.paciente_id) ?? [];
    const idx = list.findIndex(m => m.id === id);
    if (idx >= 0) list[idx] = full; else list.push(full);
    _meds.set(med.paciente_id, list);
    return full;
};

export const deleteMedication = async (id: string): Promise<boolean> => {
    for (const [pid, list] of _meds) {
        const idx = list.findIndex(m => m.id === id);
        if (idx >= 0) { list.splice(idx, 1); _meds.set(pid, list); return true; }
    }
    return false;
};

export const getAllergies = async (pacienteId: string): Promise<PatientAllergy[]> =>
    _allergies.get(pacienteId) ?? [];

export const upsertAllergy = async (alergy: Omit<PatientAllergy, 'id'> & { id?: string }): Promise<PatientAllergy | null> => {
    const id = alergy.id ?? crypto.randomUUID();
    const full: PatientAllergy = { ...alergy, id };
    const list = _allergies.get(alergy.paciente_id) ?? [];
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) list[idx] = full; else list.push(full);
    _allergies.set(alergy.paciente_id, list);
    return full;
};

export const deleteAllergy = async (id: string): Promise<boolean> => {
    for (const [pid, list] of _allergies) {
        const idx = list.findIndex(a => a.id === id);
        if (idx >= 0) { list.splice(idx, 1); _allergies.set(pid, list); return true; }
    }
    return false;
};
