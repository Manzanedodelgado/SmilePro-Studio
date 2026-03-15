// ─────────────────────────────────────────────────────────────────
//  services/questionnaire.service.ts
//  Cuestionario Primera Visita — in-memory (stub temporal).
//  TODO: exponer /api/clinical/questionnaires en el backend.
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────

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

const _tokens = new Map<string, QuestionnaireRecord & { data?: QuestionnaireData }>();

export const crearQuestionnaireToken = async (
    entityId: string,
    fechaCita: Date,
    entityType: 'contacto' | 'paciente' = 'paciente',
): Promise<string | null> => {
    const token = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(fechaCita.getTime() + 60 * 60 * 1000).toISOString();
    const record: QuestionnaireRecord = {
        id: crypto.randomUUID(),
        token,
        [entityType === 'contacto' ? 'contacto_id' : 'num_pac']: entityId,
        estado: 'pendiente',
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
    };
    _tokens.set(token, record);
    const base = window?.location?.origin ?? 'https://gestion.rubiogarciadental.com';
    return `${base}/cuestionario?token=${token}`;
};

export const getQuestionnaireByToken = async (token: string): Promise<QuestionnaireRecord | null> =>
    _tokens.get(token) ?? null;

export const guardarRespuestasQuestionnaire = async (
    token: string,
    data: QuestionnaireData,
): Promise<boolean> => {
    const record = _tokens.get(token);
    if (!record) return false;
    _tokens.set(token, { ...record, estado: 'completado', completado_at: new Date().toISOString(), data });
    return true;
};

export const getQuestionnairePorPaciente = async (numPac: string): Promise<QuestionnaireRecord | null> => {
    for (const r of _tokens.values()) {
        if (r.num_pac === numPac && r.estado === 'completado') return r;
    }
    return null;
};

export const generarMensajeQuestionnaire = (nombrePaciente: string, url: string, fechaCita: string): string =>
    `📋 ¡Bienvenido/a a Rubio García Dental, ${nombrePaciente}!

Antes de tu primera visita el ${fechaCita}, necesitamos que completes un breve cuestionario de salud (3-5 minutos):

👉 ${url}

⏰ El enlace es válido hasta 1h tras tu cita.

Si tienes dudas, llámanos al 📞 [TELÉFONO_CLÍNICA].

¡Hasta pronto! 😊`;
