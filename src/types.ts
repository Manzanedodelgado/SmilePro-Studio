
// INTERVENCIÓN-004: Eliminado 'Configuración' — tipo huérfano sin vista ni ruta
export type Area =
    | 'CLÍNICA'
    | 'Agenda'
    | 'Pacientes'
    | 'Radiología'
    | 'IA & Automatización'
    | 'Gestoría'
    | 'Inventario'
    | 'Whatsapp';

export interface SubNavItem {
    name: string;
    icon: string;
}

export interface MenuItem {
    name: Area;
    icon: string;
    title?: string;
    children?: SubNavItem[];
}

// --- PACIENTES & CLÍNICA ---
export interface SOAPNote {
    id: string;
    fecha: string;
    doctor: string;
    especialidad: string;
    subjetivo: string;
    objetivo: string;
    analisis: string;
    plan: string;
    firmada: boolean;
    timestamp: string;
    eva: number;
    alertasDetectadas: string[];
    // Tratamiento vinculado (nuevo)
    tratamiento_id?: string | number;
    tratamiento_nombre?: string;
    pieza?: number;          // 11-48
    cuadrante?: number;      // 1-4
    arcada?: string;         // 'superior' | 'inferior'
}

export interface Paciente {
    numPac: string;
    idPac?: number;         // IdPac interno GELITE — para queries en DCitas/PRESUTTO
    nombre: string;
    apellidos: string;
    dni: string;
    telefono: string;
    fechaNacimiento: string;
    tutor?: string;
    alergias: string[];
    medicacionActual?: string;
    deuda: boolean;
    historial: SOAPNote[];
    consentimientosFirmados: boolean;
}

// --- 1.2 AGENDA SEMÁNTICA ---
export type TratamientoCategoria =
    | 'Cirugía'
    | 'Implante'
    | 'Endodoncia'
    | 'Higiene'
    | 'Ortodoncia'
    | 'Diagnostico'
    | 'Urgencia'
    | 'Protesis'
    | 'Conservadora'
    | 'Periodoncia';

export type EstadoCita =
    | 'planificada' // Borde punteado
    | 'confirmada'  // Borde sólido
    | 'espera'      // Parpadeo suave
    | 'gabinete'    // Saturación aumentada
    | 'finalizada'  // Semitransparente
    | 'fallada'     // No-Show
    | 'anulada'     // Sql: IdSitC 1
    | 'cancelada'   // Sql: IdSitC 8
    | 'desconocido'
    | 'bloqueo_bio'; // Trama rayada (1.5)

export interface Cita {
    id: string;
    gabinete: string;
    pacienteNumPac: string;
    nombrePaciente: string;
    horaInicio: string; // HH:MM
    duracionMinutos: number;
    tratamiento: string;
    categoria: TratamientoCategoria;
    estado: EstadoCita;
    doctor: string;
    fecha?: string;

    // 1.3 HUD ALERTAS
    alertasMedicas: string[]; // Prioridad Roja (Glow)
    alertasLegales: string[]; // Prioridad Amarilla (Interlock)
    alertasFinancieras: boolean; // Prioridad Naranja

    // 1.5 BIOSEGURIDAD
    esPadreDesinfeccion?: boolean; // Si genera bloqueo hijo

    // 1.2.E ICONOGRAFÍA OVERLAY
    presupuestoPendiente?: boolean; // Icono $
    pruebasPendientes?: boolean; // Icono Rayos X
    trabajoLaboratorio?: boolean; // Icono Matraz
    notas?: string;              // NOTAS de DCitas
}

// --- 5.0 INVENTARIO & TRAZABILIDAD ---
export type EstadoLote = 'OK' | 'Caducidad_Proxima' | 'Caducado' | 'Cuarentena_Sanitaria';

export interface Lote {
    batchId: string;
    loteFabricante: string;
    fechaCaducidad: string;
    cantidad: number;
    estado: EstadoLote;
    ubicacion: string;
    temperaturaAlerta?: boolean;
}

export interface ItemInventario {
    id: string;
    nombre: string;
    sku: string;
    categoria: 'Implante' | 'Desechable' | 'Instrumental';
    stockFisico: number;
    stockVirtual: number; // Reservado por agenda
    minimoReorden: number;
    lotes: Lote[];
}

// --- 1.9 BI & KPIS ---
export interface KPI {
    label: string;
    valor: string | number;
    unidad: string;
    trend: number;
    target: number;
}
