// ─── Appointments Service — DCitas (GELITE) ─────────────
import prisma from '../../config/database.js';

// ── Helpers: GELITE integer date/time ↔ ISO ──────────────
// GELITE guarda Fecha como días desde el epoch OLE Automation: 1899-12-30
// Mismo epoch que Excel, Access y Windows COM — estándar para smalldatetime en GELITE
// VERIFICADO en patch_citas2.py: datetime(1899, 12, 30) + timedelta(days=val)
const OLE_EPOCH = new Date(Date.UTC(1899, 11, 30)); // 30-dic-1899

const geliteDateToISO = (d: number | null | undefined): string | null => {
    if (!d) return null;
    const ms = OLE_EPOCH.getTime() + d * 86400000;
    const dt = new Date(ms);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const isoToGeliteDate = (iso: string): number => {
    const dt = new Date(iso + 'T00:00:00Z');
    return Math.round((dt.getTime() - OLE_EPOCH.getTime()) / 86400000);
};

const geliteTimeToHHMM = (secs: number | null | undefined): string => {
    if (secs == null) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const hhMMtoGeliteTime = (hhmm: string): number => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60;
};

// ── Status mapping: GELITE IdSitC → string ───────────────
const STATUS_MAP: Record<number, string> = {
    0: 'scheduled',     // Planificada
    1: 'confirmed',     // Confirmada
    2: 'waiting',       // En sala espera
    3: 'in_progress',   // En consulta
    4: 'completed',     // Finalizada
    5: 'no_show',       // No presentado
    6: 'cancelled',     // Anulada
    7: 'cancelled',     // Cancelada
};

const STATUS_REVERSE_MAP: Record<string, number> = {
    'scheduled': 0, 'planificada': 0,
    'confirmed': 1, 'confirmada': 1,
    'waiting': 2,
    'in_progress': 3,
    'completed': 4, 'finalizada': 4,
    'no_show': 5,
    'cancelled': 6, 'anulada': 6, 'cancelada': 7
};

// ── Protocolo G1/G2 (README.md sec.14.2, TColabos.EsDoctor/IdTipoColab) ────────
// Fuente canónica: TColabos.IdTipoColab === 1 → Doctor → G1
// Fallback TUsuAgd: IdUsu 9 (HIGIENES), 12 (AUXILIAR) → G2
const IDUSU_G2 = new Set([9, 12]);

/** Resuelve gabinete mirando TColabos.IdTipoColab y fallback por IdUsu */
const resolveGabinete = (idCol: number | null, idUsu: number, colabMap: Map<number, number | null>): 'G1' | 'G2' => {
    if (idCol != null) {
        const tipoColab = colabMap.get(idCol);
        if (tipoColab === 1) return 'G1'; // Doctor confirmado (IdTipoColab=1)
        if (tipoColab != null) return IDUSU_G2.has(idUsu) ? 'G2' : 'G1'; // otro tipo colab
    }
    return IDUSU_G2.has(idUsu) ? 'G2' : 'G1'; // sin IdCol → fallback por IdUsu
};

// ── Transform DCitas row → API response (requiere colabMap) ─────────
const transformCita = (row: any, colabMap: Map<number, number | null>) => {
    let apellidos = '';
    let nombre = '';
    if (row.Texto) {
        const parts = row.Texto.split(',');
        apellidos = (parts[0] ?? '').trim();
        nombre = (parts[1] ?? '').trim();
    } else if (row.Contacto) {
        apellidos = row.Contacto.trim();
    }

    return {
        id: `${row.IdUsu}-${row.IdOrden}`,
        numPac: row.NUMPAC ?? '',
        apellidos,
        nombre,
        nombreCompleto: [nombre, apellidos].filter(Boolean).join(' ').trim().toUpperCase() || 'PACIENTE',
        fecha: geliteDateToISO(row.Fecha),
        hora: geliteTimeToHHMM(row.Hora),
        duracion: row.Duracion ? Math.round(row.Duracion / 60) : 30,
        estado: STATUS_MAP[row.IdSitC ?? 0] ?? 'scheduled',
        tratamiento: row.IdOpc ?? null,
        notas: row.NOTAS ?? '',
        movil: row.Movil ?? '',
        doctor: row.IdCol ?? null,
        gabinete: resolveGabinete(row.IdCol, row.IdUsu, colabMap),
        box: row.BOX ?? '',
        idCol: row.IdCol,
        idSitC: row.IdSitC,
        idOpc: row.IdOpc,
        contacto: row.Contacto ?? '',
    };
};

export class AppointmentsService {
    static async findAll(query: { date?: string; from?: string; to?: string; page?: string; limit?: string; pacienteNumPac?: string }) {
        const page = parseInt(query.page || '1');
        const limit = parseInt(query.limit || '1000');
        const skip = (page - 1) * limit;
        const where: any = {};

        if (query.date) {
            where.Fecha = isoToGeliteDate(query.date);
        } else if (query.from && query.to) {
            where.Fecha = { gte: isoToGeliteDate(query.from), lte: isoToGeliteDate(query.to) };
        }
        if (query.pacienteNumPac) {
            where.NUMPAC = query.pacienteNumPac;
        }

        const [data, total] = await Promise.all([
            prisma.dCitas.findMany({ where, skip, take: limit, orderBy: [{ Fecha: 'asc' }, { Hora: 'asc' }] }),
            prisma.dCitas.count({ where }),
        ]);

        // ── Cargar TColabos para resolveGabinete (IdTipoColab=1 → G1) ────
        const idCols = [...new Set(data.map((r: any) => r.IdCol).filter((x: any) => x != null))] as number[];
        const colabRows = idCols.length
            ? await prisma.tColabos.findMany({ where: { IdCol: { in: idCols } }, select: { IdCol: true, IdTipoColab: true } })
            : [];
        const colabMap = new Map<number, number | null>(colabRows.map((r: any) => [r.IdCol, r.IdTipoColab]));

        return { data: data.map((r: any) => transformCita(r, colabMap)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    }

    static async findById(idUsu: number, idOrden: number) {
        const row = await prisma.dCitas.findUnique({ where: { IdUsu_IdOrden: { IdUsu: idUsu, IdOrden: idOrden } } });
        if (!row) throw new Error('Cita no encontrada');
        const colabRows = row.IdCol
            ? await prisma.tColabos.findMany({ where: { IdCol: row.IdCol }, select: { IdCol: true, IdTipoColab: true } })
            : [];
        const colabMap = new Map<number, number | null>(colabRows.map((r: any) => [r.IdCol, r.IdTipoColab]));
        return transformCita(row, colabMap);
    }

    static async create(input: any) {
        const fechaInt = isoToGeliteDate(input.fecha);
        const horaInt = hhMMtoGeliteTime(input.horaInicio);
        const duracionSecs = (input.duracionMinutos || 30) * 60;
        const idUsu = input.gabinete === 'G2' ? 2 : 1;
        const texto = `${input.nombrePaciente || 'PACIENTE'},`;

        // Generate IdOrden uniquely for the Gabinete and Date. DCitas is very dense.
        // Usually, IdOrden is consecutive per IdUsu.
        const maxOrdenRow = await prisma.dCitas.aggregate({
            _max: { IdOrden: true },
            where: { IdUsu: idUsu }
        });
        const idOrden = (maxOrdenRow._max.IdOrden || 0) + 1;
        const idCita = BigInt(Date.now()); 

        const data = {
            IdUsu: idUsu,
            IdOrden: idOrden,
            Fecha: fechaInt,
            Hora: horaInt,
            Duracion: duracionSecs,
            IdSitC: STATUS_REVERSE_MAP[input.estado?.toLowerCase()] ?? 0,
            Texto: texto,
            Contacto: input.nombrePaciente,
            Movil: input.movil || '',
            NUMPAC: input.pacienteNumPac,
            NOTAS: input.notas || '',
            Recordada: 0,
            Confirmada: 0,
            IdCita: idCita,
            TipoDocIdent: 0,
            IdOrigenIns: 0,
            IdOpc: input.tratamiento || 'Control'
        };

        const result = await prisma.dCitas.create({ data });
        
        const colabRows = result.IdCol
            ? await prisma.tColabos.findMany({ where: { IdCol: result.IdCol }, select: { IdCol: true, IdTipoColab: true } })
            : [];
        const colabMap = new Map<number, number | null>(colabRows.map((r: any) => [r.IdCol, r.IdTipoColab]));
        
        return transformCita(result, colabMap);
    }

    static async update(idUsu: number, idOrden: number, input: any) {
        let updateData: any = {};
        if (input.fecha) updateData.Fecha = isoToGeliteDate(input.fecha);
        if (input.horaInicio) updateData.Hora = hhMMtoGeliteTime(input.horaInicio);
        if (input.duracionMinutos) updateData.Duracion = input.duracionMinutos * 60;
        if (input.estado) {
            const sitC = STATUS_REVERSE_MAP[input.estado.toLowerCase()];
            if (sitC !== undefined) updateData.IdSitC = sitC;
        }
        if (input.nombrePaciente) {
            updateData.Texto = `${input.nombrePaciente},`;
            updateData.Contacto = input.nombrePaciente;
        }
        if (input.tratamiento) updateData.IdOpc = input.tratamiento;
        if (input.notas !== undefined) updateData.NOTAS = input.notas;

        const result = await prisma.dCitas.update({
            where: { IdUsu_IdOrden: { IdUsu: idUsu, IdOrden: idOrden } },
            data: updateData
        });
        
        const colabRows = result.IdCol
            ? await prisma.tColabos.findMany({ where: { IdCol: result.IdCol }, select: { IdCol: true, IdTipoColab: true } })
            : [];
        const colabMap = new Map<number, number | null>(colabRows.map((r: any) => [r.IdCol, r.IdTipoColab]));

        return transformCita(result, colabMap);
    }

    static async cancel(idUsu: number, idOrden: number) {
        const result = await prisma.dCitas.update({
            where: { IdUsu_IdOrden: { IdUsu: idUsu, IdOrden: idOrden } },
            data: { IdSitC: 6 } // 6 = Anulada
        });
        
        const colabRows = result.IdCol
            ? await prisma.tColabos.findMany({ where: { IdCol: result.IdCol }, select: { IdCol: true, IdTipoColab: true } })
            : [];
        const colabMap = new Map<number, number | null>(colabRows.map((r: any) => [r.IdCol, r.IdTipoColab]));

        return transformCita(result, colabMap);
    }

    /** Devuelve la fecha ISO más reciente en la BD (para navegar al último día con datos) */
    static async getLatestDate(): Promise<string | null> {
        const row = await prisma.dCitas.findFirst({
            where: { Fecha: { not: null } },
            orderBy: { Fecha: 'desc' },
            select: { Fecha: true },
        });
        if (!row?.Fecha) return null;
        return geliteDateToISO(row.Fecha);
    }

    /** Devuelve la configuración: Tratamientos, Doctores y Estados (reemplazando mocks) */
    static async getConfig(): Promise<{ tratamientos: any[], doctores: any[], estados: any[] }> {
        // Obtenemos los Tratamientos activos (de la tabla TArticulos, filtrando los que sirven para agenda)
        // Por simplificar y coincidir con el fallback, extraeremos los más comunes o todos si son pocos
        const tratamientosRaw = await prisma.tTratamientos.findMany({
            take: 100,
            select: { DescFarmaco: true },
            distinct: ['DescFarmaco']
        });
        
        let tratamientos = tratamientosRaw
            .filter((t: any) => t.DescFarmaco)
            .map((t: any, i: number) => ({ idIcono: i + 1, descripcion: t.DescFarmaco }));

        if (tratamientos.length === 0) {
            // Si la base de datos no tiene datos coherentes de tratamientos, proveemos un fallback útil inicial.
            // Lo ideal es tener la tabla de TArticulo donde están.
            tratamientos = [
                { idIcono: 1, descripcion: 'Control' }, { idIcono: 2, descripcion: 'Urgencia' },
                { idIcono: 3, descripcion: 'Endodoncia' }, { idIcono: 4, descripcion: 'Reconstruccion' },
                { idIcono: 5, descripcion: 'Protesis Fija' }, { idIcono: 6, descripcion: 'Protesis Removible' },
                { idIcono: 7, descripcion: 'Cirugia/Injerto' }, { idIcono: 8, descripcion: 'Exodoncia' },
                { idIcono: 9, descripcion: 'Periodoncia' }, { idIcono: 10, descripcion: 'Higiene Dental' },
                { idIcono: 11, descripcion: 'Cirugia de Implante' }, { idIcono: 12, descripcion: 'Primera Visita' },
                { idIcono: 13, descripcion: 'Ajuste Prot/tto' }, { idIcono: 14, descripcion: 'Retirar Ortodoncia' },
            ];
        }

        // Doctores: TColabos
        // NOTA: en la BD actual se usa IdCol para la vinculación
        const tcolabosRaw = await prisma.tColabos.findMany({
            where: { IdTipoColab: { in: [1, 2, 3] } }, // Tipos de doctores/higienistas normales
            select: { IdCol: true, Nombre: true, Apellidos: true, IdTipoColab: true }
        });
        const doctores = tcolabosRaw.map((c: any) => ({
            idUsu: c.IdCol, // Map temporal
            idCol: c.IdCol,
            nombre: `${c.Nombre} ${c.Apellidos ?? ''}`.trim(),
            nombreCompleto: `${c.Nombre} ${c.Apellidos ?? ''}`.trim(),
            color: 0
        }));

        // Estados (TSitCita se mapean directamente a objectos simples)
        // Hardcoded en GELITE pero podemos usar los códigos standard conocidos:
        const estados = [
            { idSitC: 0, descripcion: 'Planificada', color: 0, esAnulada: false },
            { idSitC: 1, descripcion: 'Confirmada', color: 0, esAnulada: false },
            { idSitC: 2, descripcion: 'En sala espera', color: 0, esAnulada: false },
            { idSitC: 3, descripcion: 'En consulta', color: 0, esAnulada: false },
            { idSitC: 4, descripcion: 'Finalizada', color: 0, esAnulada: false },
            { idSitC: 5, descripcion: 'No presentado', color: 0, esAnulada: true },
            { idSitC: 6, descripcion: 'Anulada', color: 0, esAnulada: true },
            { idSitC: 7, descripcion: 'Cancelada', color: 0, esAnulada: true },
        ];

        return { tratamientos, doctores, estados };
    }
}
