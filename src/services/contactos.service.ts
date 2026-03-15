// ─────────────────────────────────────────────────────────────────
//  services/contactos.service.ts
//  Contactos (leads primera visita) — stub temporal.
//  TODO: crear /api/patients/leads en el backend.
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────

export type ContactoEstado = 'potencial' | 'confirmado' | 'convertido' | 'cancelado' | 'no_acudio';
export type ContactoOrigen = 'primera_visita' | 'whatsapp' | 'manual' | 'derivacion';
export type ContactoCanal = 'recepcion' | 'whatsapp' | 'web' | 'telefono';

export interface Contacto {
    id: string;
    nombre: string;
    apellidos?: string;
    telefono: string;
    email?: string;
    estado: ContactoEstado;
    origen: ContactoOrigen;
    canal: ContactoCanal;
    numPac?: string;
    citaId?: string;
    motivoConsulta?: string;
    notas?: string;
    createdAt: string;
    updatedAt?: string;
    // Datos de tutor (para menores de edad)
    esMenor?: boolean;
    nombreTutor?: string;
    apellidosTutor?: string;
    telefonoTutor?: string;
    emailTutor?: string;
    relacionTutor?: string;
    // Datos de cita vinculada
    fechaCitaPrevista?: string;
    doctorAsignado?: string;
    tratamientoAdicional?: string;
}

/** Input extendido para crearContacto — incluye campos de Primera Visita */
export interface CrearContactoInput {
    nombre: string;
    apellidos?: string;
    telefono: string;
    email?: string;
    estado?: ContactoEstado;
    origen?: ContactoOrigen;
    canal?: ContactoCanal;
    canalEntrada?: ContactoCanal;
    numPac?: string;
    citaId?: string;
    motivoConsulta?: string;
    notas?: string;
    // Tutor
    esMenor?: boolean;
    nombreTutor?: string;
    apellidosTutor?: string;
    telefonoTutor?: string;
    emailTutor?: string;
    relacionTutor?: string;
    // Cita
    fechaCita?: Date;
    doctorAsignado?: string;
    tratamientoAdicional?: string;
}

export interface ContactoValidationError { field: string; message: string; }

export const validateContacto = (c: Partial<Contacto>): ContactoValidationError[] => {
    const errors: ContactoValidationError[] = [];
    if (!c.nombre?.trim()) errors.push({ field: 'nombre', message: 'Nombre requerido' });
    if (!c.telefono?.trim()) errors.push({ field: 'telefono', message: 'Teléfono requerido' });
    return errors;
};

// In-memory store (stub hasta que el backend exponga /api/patients/leads)
const _store = new Map<string, Contacto>();

export const crearContacto = async (
    data: CrearContactoInput
): Promise<{ contacto: Contacto; linkCuestionario: string | null }> => {
    const id = crypto.randomUUID();
    const contacto: Contacto = {
        id,
        nombre: data.nombre,
        apellidos: data.apellidos,
        telefono: data.telefono,
        email: data.email,
        estado: data.estado ?? 'potencial',
        origen: data.origen ?? 'primera_visita',
        canal: data.canalEntrada ?? data.canal ?? 'recepcion',
        numPac: data.numPac,
        citaId: data.citaId,
        motivoConsulta: data.motivoConsulta,
        notas: data.notas,
        createdAt: new Date().toISOString(),
        esMenor: data.esMenor,
        nombreTutor: data.nombreTutor,
        apellidosTutor: data.apellidosTutor,
        telefonoTutor: data.telefonoTutor,
        emailTutor: data.emailTutor,
        relacionTutor: data.relacionTutor,
        doctorAsignado: data.doctorAsignado,
        tratamientoAdicional: data.tratamientoAdicional,
    };
    _store.set(id, contacto);
    // TODO: generar link de cuestionario real vía backend
    const linkCuestionario: string | null = null;
    return { contacto, linkCuestionario };
};

export const getContactosActivos = async (): Promise<Contacto[]> =>
    [..._store.values()].filter(c => c.estado !== 'convertido' && c.estado !== 'cancelado');

export const getContactoPorId = async (id: string): Promise<Contacto | null> =>
    _store.get(id) ?? null;

export const buscarContactos = async (query: string): Promise<Contacto[]> => {
    const q = query.toLowerCase();
    return [..._store.values()].filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.apellidos?.toLowerCase().includes(q) ||
        c.telefono.includes(q)
    );
};

export const actualizarEstadoContacto = async (id: string, estado: ContactoEstado, _motivo?: string): Promise<boolean> => {
    const c = _store.get(id);
    if (!c) return false;
    _store.set(id, { ...c, estado, updatedAt: new Date().toISOString() });
    return true;
};

export const convertirContactoEnPaciente = async (id: string, numPac: string): Promise<boolean> => {
    const c = _store.get(id);
    if (!c) return false;
    _store.set(id, { ...c, estado: 'convertido', numPac, updatedAt: new Date().toISOString() });
    return true;
};

export const generarMensajeBienvenidaContacto = (
    contacto: Contacto,
    fechaCita?: string,
    linkCuestionario?: string | null,
): string => {
    const base = `Hola ${contacto.nombre}, gracias por contactar con Rubio García Dental.`;
    if (fechaCita && linkCuestionario) {
        return `${base} Tu cita es el ${fechaCita}. Completa tu ficha de salud antes de venir: ${linkCuestionario}`;
    }
    if (fechaCita) return `${base} Tu cita está confirmada para el ${fechaCita}. Nos pondremos en contacto contigo pronto.`;
    return `${base} Nos pondremos en contacto contigo pronto.`;
};

export const asignarNumPac = async (_contactoId: string): Promise<string | null> => null;

export const vincularNumPacGelite = async (contactoId: string, geliteNumPac: string): Promise<boolean> =>
    convertirContactoEnPaciente(contactoId, geliteNumPac);

export const autocompletarDesdeFormulario = async (
    _contactoId: string,
    _formData: Record<string, any>
): Promise<Contacto | null> => null;

export const crearQuestionnaireToken = async (_contactoId: string): Promise<string | null> => null;
