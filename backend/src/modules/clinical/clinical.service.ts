// ─── Clinical Service ─────────────────────────────────────────────────────────
// Conectado a tablas GELITE: TtosMed (entradas médicas) + TTipoOdg (descripción)
import prisma from '../../config/database.js';

export interface CreateRecordInput {
    patientId: string;
    userId?: string;
    date?: string;
    type?: string;
    title: string;
    content: string;
    treatments?: object[];
}

export interface UpdateOdontogramInput {
    patientId: string;
    toothNumber: number;
    status: string;
    faces?: object;
    notes?: string;
    userId?: string;
}

// Convierte bitmask GELITE a lista de piezas dentales (numeración FDI)
function bitmaskToPiezas(mask: string | null): number[] {
    if (!mask) return [];
    const n = parseInt(mask, 10);
    if (!n || n <= 0) return [];
    const FDI_MAP = [
        18,17,16,15,14,13,12,11,
        21,22,23,24,25,26,27,28,
        48,47,46,45,44,43,42,41,
        31,32,33,34,35,36,37,38,
    ];
    const piezas: number[] = [];
    for (let i = 0; i < FDI_MAP.length; i++) {
        if (n & (1 << i)) piezas.push(FDI_MAP[i]);
    }
    return piezas;
}

// Extrae piezas dentales del texto libre (#XX) — fuente primaria y fiable
function extraerPiezasTexto(texto: string): number[] {
    return [...texto.matchAll(/#(\d{1,2})/g)]
        .map(m => parseInt(m[1], 10))
        .filter(n => n >= 11 && n <= 48);
}

export class ClinicalService {
    // ── Historial de entradas médicas desde TtosMed ───────────────────────────
    static async getEntradasMedicas(
        patientId: string,
        opts: { page?: number; pageSize?: number; order?: 'asc' | 'desc' } = {}
    ) {
        const idpac = parseInt(patientId, 10);
        const page = opts.page ?? 1;
        const pageSize = Math.min(opts.pageSize ?? 50, 200);
        const skip = (page - 1) * pageSize;
        const order = opts.order ?? 'desc';

        const rows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT
                tm."Ident", tm."FecIni", tm."FecFin", tm."Notas",
                tm."PiezasAdu", tm."PiezasNum", tm."StaTto", tm."IdTipoOdg",
                tm."Importe", tm."Pendiente",
                tr."Codigo"    AS codigoTto,
                tr."DescripMed" AS descripcionTto
            FROM "TtosMed" tm
            LEFT JOIN "Tratamientos" tr ON tr."IdTratamiento" = tm."IdTto"
            WHERE tm."IdPac" = $1
              AND (tr."DescripMed" IS NULL OR tr."DescripMed" NOT ILIKE 'PAGO%')
            ORDER BY tm."FecIni" ${order === 'asc' ? 'ASC' : 'DESC'} NULLS LAST,
                     tm."Ident"  ${order === 'asc' ? 'ASC' : 'DESC'}
            LIMIT $2 OFFSET $3
        `, idpac, pageSize, skip);

        const countRow = await prisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*) AS total
            FROM "TtosMed" tm
            LEFT JOIN "Tratamientos" tr ON tr."IdTratamiento" = tm."IdTto"
            WHERE tm."IdPac" = $1
              AND (tr."DescripMed" IS NULL OR tr."DescripMed" NOT ILIKE 'PAGO%')
        `, idpac);
        const total = Number(countRow[0]?.total ?? 0);

        const data = rows.map(r => {
            const notas     = (r.Notas ?? '').replace(/\r\n/g, '\n');
            // GELITE: línea 1 es código/referencia, entre paréntesis es comentario libre
            const lineas    = notas.split('\n');
            const refLinea  = lineas[0]?.trim() ?? '';
            const parenMatch = notas.match(/\(([^)]*)\)/s);
            const comentario = parenMatch ? parenMatch[1].trim() : '';

            const piezasTexto = extraerPiezasTexto(refLinea);
            const piezas = piezasTexto.length > 0 ? piezasTexto : bitmaskToPiezas(r.PiezasAdu);
            // Limpiar referencias de pieza (#XX) del nombre del tratamiento
            const descripcionLimpia = (r.descripcionTto ?? refLinea).replace(/#\d{1,2}/g, '').replace(/\s{2,}/g, ' ').trim();

            return {
                id:          r.Ident,
                fecha:       r.FecIni,
                fechaFin:    r.FecFin,
                codigoTto:   r.codigoTto ?? null,
                descripcion: descripcionLimpia,
                referencia:  refLinea,
                comentario,
                piezas,
                estado:      r.StaTto,
                importe:     r.Importe != null ? Number(r.Importe) : null,
                pendiente:   r.Pendiente != null ? Number(r.Pendiente) : null,
            };
        });

        return { data, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } };
    }

    // ── Historia clínica (compatibilidad anterior) ────────────────────────────
    static async getPatientHistory(patientId: string) {
        const entradas = await ClinicalService.getEntradasMedicas(patientId, { pageSize: 100 });
        return { patientId, records: entradas.data, odontogram: [] };
    }

    static async createRecord(_input: CreateRecordInput) {
        return { id: 'readonly', message: 'Entradas médicas GELITE son de solo lectura' };
    }

    static async getOdontogram(patientId: string) {
        return { patientId, teeth: [] };
    }

    static async updateToothStatus(_input: UpdateOdontogramInput) {
        return { message: 'Odontograma en GELITE es de solo lectura' };
    }

    static async deleteRecord(_id: string) {
        return { message: 'Operación no permitida en entradas GELITE' };
    }
}
