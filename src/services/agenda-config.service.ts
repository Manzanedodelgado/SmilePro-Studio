// ─────────────────────────────────────────────────────────────────
//  services/agenda-config.service.ts
//  Configuración de agenda — datos estáticos (fallbacks).
//  TODO: exponer /api/appointments/config en el backend.
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────

export interface TratamientoAgenda { idIcono: number; descripcion: string; }
export interface EstadoCitaAgenda { idSitC: number; descripcion: string; color: number; esAnulada: boolean; }
export interface DoctorAgenda { idUsu: number; idCol: number; nombre: string; nombreCompleto: string; color: number; }

const TRATAMIENTOS_FALLBACK: TratamientoAgenda[] = [
    { idIcono: 1, descripcion: 'Control' }, { idIcono: 2, descripcion: 'Urgencia' },
    { idIcono: 3, descripcion: 'Endodoncia' }, { idIcono: 4, descripcion: 'Reconstruccion' },
    { idIcono: 5, descripcion: 'Protesis Fija' }, { idIcono: 6, descripcion: 'Protesis Removible' },
    { idIcono: 7, descripcion: 'Cirugia/Injerto' }, { idIcono: 8, descripcion: 'Exodoncia' },
    { idIcono: 9, descripcion: 'Periodoncia' }, { idIcono: 10, descripcion: 'Higiene Dental' },
    { idIcono: 11, descripcion: 'Cirugia de Implante' }, { idIcono: 12, descripcion: 'Primera Visita' },
    { idIcono: 13, descripcion: 'Ajuste Prot/tto' }, { idIcono: 14, descripcion: 'Retirar Ortodoncia' },
    { idIcono: 15, descripcion: 'Colocacion Ortodoncia' }, { idIcono: 16, descripcion: 'Mensualidad Ortodoncia' },
    { idIcono: 17, descripcion: 'Estudio Ortodoncia' }, { idIcono: 18, descripcion: 'Blanqueamiento' },
    { idIcono: 19, descripcion: 'Rx/escaner' },
];

const ESTADOS_FALLBACK: EstadoCitaAgenda[] = [
    { idSitC: 0, descripcion: 'Planificada', color: 0, esAnulada: false },
    { idSitC: 1, descripcion: 'Anulada', color: 0, esAnulada: true },
    { idSitC: 5, descripcion: 'Finalizada', color: 0, esAnulada: false },
    { idSitC: 7, descripcion: 'Confirmada', color: 0, esAnulada: false },
    { idSitC: 8, descripcion: 'Cancelada', color: 0, esAnulada: true },
    { idSitC: 9, descripcion: 'Fallada', color: 0, esAnulada: true },
];

const DOCTORES_FALLBACK: DoctorAgenda[] = [
    { idUsu: 1, idCol: 2, nombre: 'Dr. Mario Rubio', nombreCompleto: 'Dr. Mario Rubio García', color: 0 },
    { idUsu: 2, idCol: 3, nombre: 'Dra. Irene García', nombreCompleto: 'Dra. Irene García Sanz', color: 0 },
    { idUsu: 3, idCol: 11, nombre: 'Dra. Vivian Martínez', nombreCompleto: 'Dra. Vivian Martínez Pérez', color: 0 },
    { idUsu: 4, idCol: 17, nombre: 'Dr. Ignacio Ferrero', nombreCompleto: 'Dr. Ignacio Ferrero', color: 0 },
    { idUsu: 5, idCol: 1, nombre: 'Lucía Guillén', nombreCompleto: 'Lucía Guillén Abasolo', color: 0 },
    { idUsu: 6, idCol: 18, nombre: 'Miriam Carrasco', nombreCompleto: 'Miriam Carrasco', color: 0 },
];

export const getTratamientosAgenda = async (): Promise<TratamientoAgenda[]> => TRATAMIENTOS_FALLBACK;
export const getEstadosCita = async (): Promise<EstadoCitaAgenda[]> => ESTADOS_FALLBACK;
export const getDoctoresAgenda = async (): Promise<DoctorAgenda[]> => DOCTORES_FALLBACK;
export const invalidateAgendaConfigCache = (): void => { /* no-op */ };
export const loadAgendaConfig = async () => ({
    tratamientos: TRATAMIENTOS_FALLBACK,
    estados: ESTADOS_FALLBACK,
    doctores: DOCTORES_FALLBACK,
});
