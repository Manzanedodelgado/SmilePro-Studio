// ─────────────────────────────────────────────────────────────────
//  services/contactos.service.ts
//  Contactos (leads primera visita) — F-001 FIX: ahora persiste en Backend.
//  Conectado a /api/patients/leads (autenticado con authFetch).
// ─────────────────────────────────────────────────────────────────
import { authFetch } from './db';

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
    esMenor?: boolean;
    nombreTutor?: string;
    apellidosTutor?: string;
    telefonoTutor?: string;
    emailTutor?: string;
    relacionTutor?: string;
    fechaCitaPrevista?: string;
    doctorAsignado?: string;
    tratamientoAdicional?: string;
}

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
    esMenor?: boolean;
    nombreTutor?: string;
    apellidosTutor?: string;
    telefonoTutor?: string;
    emailTutor?: string;
    relacionTutor?: string;
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

const API = '/api/patients/leads';

export const crearContacto = async (
    data: CrearContactoInput
): Promise<{ contacto: Contacto; linkCuestionario: string | null }> => {
    const res = await authFetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...data,
            canal: data.canalEntrada ?? data.canal ?? 'recepcion',
        }),
    });
    if (!res.ok) throw new Error('Error al crear contacto');
    const json = await res.json();
    return { contacto: json.data, linkCuestionario: null };
};

export const getContactosActivos = async (): Promise<Contacto[]> => {
    const res = await authFetch(API);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
};

export const getContactoPorId = async (id: string): Promise<Contacto | null> => {
    const res = await authFetch(`${API}/${id}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
};

export const buscarContactos = async (query: string): Promise<Contacto[]> => {
    const q = query.toLowerCase();
    const todos = await getContactosActivos();
    return todos.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.apellidos?.toLowerCase().includes(q) ||
        c.telefono.includes(q)
    );
};

export const actualizarEstadoContacto = async (id: string, estado: ContactoEstado, _motivo?: string): Promise<boolean> => {
    const res = await authFetch(`${API}/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
    });
    return res.ok;
};

export const convertirContactoEnPaciente = async (id: string, numPac: string): Promise<boolean> => {
    const res = await authFetch(`${API}/${id}/convertir`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numPac }),
    });
    return res.ok;
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
