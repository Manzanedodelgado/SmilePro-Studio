// ─────────────────────────────────────────────────────────────────
//  services/questionnaire.service.ts
//  F-002 FIX: ahora persiste en Backend /api/clinical/questionnaires
//  (en lugar del Map in-memory original).
// ─────────────────────────────────────────────────────────────────
import { authFetch } from './db';

export interface QuestionnaireData {
    fechaNacimiento?: string;
    sexo?: 'Masculino' | 'Femenino' | 'Otro' | 'Prefiero no indicar';
    profesion?: string;
    motivoConsulta?: string;
    ultimaVisitaDentista?: '< 6 meses' | '6-12 meses' | '1-2 años' | '> 2 años' | 'Nunca';
    enfermedadCardiaca?: boolean;
    hipertension?: boolean;
    diabetes?: 'No' | 'Tipo 1' | 'Tipo 2' | 'Prediabetes';
    asmaCopd?: boolean;
    cancer?: boolean;
    embarazo?: boolean;
    semanasEmbarazo?: number;
    otrasEnfermedades?: string;
    tomaMedicacion?: boolean;
    listaMedicacion?: string;
    anticoagulantes?: boolean;
    bisfosfonatos?: boolean;
    antibioticosActuales?: boolean;
    alergiaPenicilina?: boolean;
    alergiaAspirina?: boolean;
    alergiaIbuprofeno?: boolean;
    alergiaAnestesia?: boolean;
    alergiaLatex?: boolean;
    alergiaMetal?: boolean;
    otrasAlergias?: string;
    fumador?: 'No' | 'Ocasional' | 'Diario' | 'Ex-fumador';
    alcohol?: 'No' | 'Ocasional' | 'Frecuente';
    bruxismo?: boolean;
    higieneOral?: '1 vez/día' | '2 veces/día' | '3 veces/día';
    usaHiloDental?: boolean;
    usaEnjuague?: boolean;
    extracciones?: boolean;
    endodoncias?: boolean;
    implantes?: boolean;
    ortodoncia?: boolean;
    protesis?: 'No' | 'Parcial removible' | 'Total removible' | 'Fija';
    miedosDentista?: string;
    aceptaLopd: boolean;
    aceptaPoliticaPrivacidad: boolean;
    aceptaTratamientoDatos: boolean;
}

export interface QuestionnaireRecord {
    id: string;
    num_pac?: string;
    contacto_id?: string;
    token: string;
    estado: 'pendiente' | 'completado' | 'expirado';
    expires_at: string;
    completado_at?: string;
    created_at: string;
}

const API = '/api/clinical/questionnaires';

export const crearQuestionnaireToken = async (
    entityId: string,
    fechaCita: Date,
    entityType: 'contacto' | 'paciente' = 'paciente',
): Promise<string | null> => {
    try {
        const res = await authFetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entityId, entityType, fechaCita: fechaCita.toISOString() }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data?.url ?? null;
    } catch {
        return null;
    }
};

export const getQuestionnaireByToken = async (token: string): Promise<QuestionnaireRecord | null> => {
    try {
        const res = await fetch(`${API}/token/${token}`); // pública, sin auth
        if (!res.ok) return null;
        const json = await res.json();
        return json.data ?? null;
    } catch {
        return null;
    }
};

export const guardarRespuestasQuestionnaire = async (
    token: string,
    data: QuestionnaireData,
): Promise<boolean> => {
    try {
        const res = await fetch(`${API}/token/${token}/submit`, { // pública, sin auth
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.ok;
    } catch {
        return false;
    }
};

export const getQuestionnairePorPaciente = async (numPac: string): Promise<QuestionnaireRecord | null> => {
    try {
        const res = await authFetch(`${API}/paciente/${numPac}`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.data ?? null;
    } catch {
        return null;
    }
};

export const generarMensajeQuestionnaire = (nombrePaciente: string, url: string, fechaCita: string): string =>
    `📋 ¡Bienvenido/a a Rubio García Dental, ${nombrePaciente}!

Antes de tu primera visita el ${fechaCita}, necesitamos que completes un breve cuestionario de salud (3-5 minutos):

👉 ${url}

⏰ El enlace es válido hasta 1h tras tu cita.

Si tienes dudas, llámanos al 📞 [TELÉFONO_CLÍNICA].

¡Hasta pronto! 😊`;
