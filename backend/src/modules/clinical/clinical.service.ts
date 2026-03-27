// ─── Clinical Service ─────────────────────────────────────────────────────────
// Conectado a tablas GELITE: TtosMed (entradas médicas) + TTipoOdg (descripción)
// Persistencia propia SmilePro: clinical_records (SOAP) + odontogram_state
import prisma from '../../config/database.js';

export interface CreateRecordInput {
    patientId: string;   // NumPac GELITE del paciente
    userId?: string;
    date?: string;
    type?: string;
    title?: string;
    content: string;     // Campo S — subjetivo
    objetivo?: string;
    analisis?: string;
    plan?: string;
    eva?: number;
    especialidad?: string;
    tratamientoId?: string;
    tratamientoNombre?: string;
    pieza?: number;
    treatments?: object[];
}

export interface UpdateOdontogramInput {
    patientId: string;   // NumPac GELITE del paciente
    data: object[];      // Array completo de DienteData[]
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

// UUID nulo para compatibilidad con campos NOT NULL legacy (se eliminará en futura migración)
const NULL_UUID = '00000000-0000-0000-0000-000000000000';

export class ClinicalService {
    // ── Historial de entradas médicas desde TtosMed (GELITE) ─────────────────
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
            const lineas    = notas.split('\n');
            const refLinea  = lineas[0]?.trim() ?? '';
            const parenMatch = notas.match(/\(([^)]*)\)/s);
            const comentario = parenMatch ? parenMatch[1].trim() : '';

            const piezasTexto = extraerPiezasTexto(refLinea);
            const piezas = piezasTexto.length > 0 ? piezasTexto : bitmaskToPiezas(r.PiezasAdu);
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

    // ── Actualizar entrada médica GELITE ──────────────────────────────────────
    // GELITE no está diseñada para edición remota libre, pero actualizamos
    // los campos seguros: StaTto (estado), Importe, Pendiente, Notas
    static async updateEntradaMedica(patientId: string, entradaId: number, body: {
        fecha?: string | null;
        descripcion?: string;
        comentario?: string;
        estado?: number;
        importe?: number | null;
        pendiente?: number | null;
    }) {
        const updateData: any = {};
        if (body.estado !== undefined)    updateData.StaTto   = body.estado;
        if (body.importe !== undefined)   updateData.Importe  = body.importe;
        if (body.pendiente !== undefined) updateData.Pendiente = body.pendiente;

        // Notas: recomponemos el campo Notas con comentario actualizado si viene
        if (body.comentario !== undefined) {
            // Obtenemos la entrada actual para mantener la referencia (#XX)
            const current = await prisma.$queryRawUnsafe<any[]>(
                `SELECT "Notas" FROM "TtosMed" WHERE "Ident" = $1 AND "IdPac" = $2`,
                entradaId, parseInt(patientId, 10)
            );
            if (current.length > 0) {
                const notasActuales = current[0].Notas ?? '';
                const lineas = notasActuales.split('\n');
                const primeraLinea = lineas[0] ?? '';
                // Rebuildo: primera línea (referencia) + comentario entre paréntesis
                const nuevoComentario = body.comentario.trim()
                    ? `\n(${body.comentario.trim()})`
                    : '';
                updateData.Notas = `${primeraLinea}${nuevoComentario}`;
            }
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.$queryRawUnsafe(
                `UPDATE "TtosMed" SET ${Object.keys(updateData).map((k, i) => `"${k}" = $${i + 3}`).join(', ')}
                 WHERE "Ident" = $1 AND "IdPac" = $2`,
                entradaId,
                parseInt(patientId, 10),
                ...Object.values(updateData)
            );
        }

        // Devolvemos la entrada actualizada
        const result = await prisma.$queryRawUnsafe<any[]>(
            `SELECT tm."Ident", tm."FecIni", tm."Notas", tm."StaTto", tm."Importe", tm."Pendiente",
                    tr."Codigo" AS codigoTto, tr."DescripMed" AS descripcionTto,
                    tm."PiezasAdu"
             FROM "TtosMed" tm
             LEFT JOIN "Tratamientos" tr ON tr."IdTratamiento" = tm."IdTto"
             WHERE tm."Ident" = $1`,
            entradaId
        );

        if (result.length === 0) return null;
        const r = result[0];
        const notas = (r.Notas ?? '').replace(/\r\n/g, '\n');
        const refLinea = notas.split('\n')[0]?.trim() ?? '';
        const parenMatch = notas.match(/\(([^)]*)\)/s);
        return {
            id:          r.Ident,
            fecha:       r.FecIni,
            codigoTto:   r.codigoTto ?? null,
            descripcion: (r.descripcionTto ?? refLinea).replace(/#\d{1,2}/g, '').trim(),
            referencia:  refLinea,
            comentario:  parenMatch ? parenMatch[1].trim() : '',
            piezas:      extraerPiezasTexto(refLinea).length > 0
                            ? extraerPiezasTexto(refLinea)
                            : bitmaskToPiezas(r.PiezasAdu),
            estado:      r.StaTto,
            importe:     r.Importe != null ? Number(r.Importe) : null,
            pendiente:   r.Pendiente != null ? Number(r.Pendiente) : null,
        };
    }

    // ── Historia clínica (compatibilidad anterior) ────────────────────────────
    static async getPatientHistory(patientId: string) {
        const entradas = await ClinicalService.getEntradasMedicas(patientId, { pageSize: 100 });
        // Incluir también notas SOAP propias de SmilePro
        const soapNotes = await ClinicalService.getSoapNotes(patientId);
        return { patientId, records: [...soapNotes, ...entradas.data], odontogram: [] };
    }

    // ── Notas SOAP propias SmilePro ───────────────────────────────────────────
    static async getSoapNotes(numPac: string) {
        const records = await prisma.clinicalRecord.findMany({
            where: { numPac },
            orderBy: { date: 'desc' },
        });
        return records.map(r => ({
            id: r.id,
            fecha: r.date.toISOString(),
            doctor: r.userId ?? '',
            especialidad: r.especialidad,
            subjetivo: r.content,
            objetivo: r.objetivo,
            analisis: r.analisis,
            plan: r.plan,
            eva: r.eva,
            firmada: r.firmada,
            timestamp: r.createdAt.toISOString(),
            alertasDetectadas: [],
            tratamiento_id: r.tratamientoId ?? undefined,
            tratamiento_nombre: r.tratamientoNombre ?? undefined,
            pieza: r.pieza ?? undefined,
        }));
    }

    // ── Crear nota SOAP (persistencia real en clinical_records) ───────────────
    static async createRecord(input: CreateRecordInput) {
        const record = await prisma.clinicalRecord.create({
            data: {
                patientId: NULL_UUID,                       // legacy UUID placeholder
                numPac:    input.patientId,                 // NumPac GELITE — clave real
                userId:    input.userId ?? null,
                date:      input.date ? new Date(input.date) : new Date(),
                type:      input.type ?? 'SOAP',
                title:     input.title ?? input.tratamientoNombre ?? 'Evolutivo',
                content:   input.content ?? '',             // Subjetivo (S)
                objetivo:  input.objetivo ?? '',
                analisis:  input.analisis ?? '',
                plan:      input.plan ?? '',
                eva:       input.eva ?? 0,
                especialidad: input.especialidad ?? 'General / Libre',
                tratamientoId:    input.tratamientoId ?? null,
                tratamientoNombre: input.tratamientoNombre ?? null,
                pieza:     input.pieza ?? null,
                firmada:   false,
                treatments: input.treatments ?? [],
            },
        });

        return {
            id: record.id,
            fecha: record.date.toISOString(),
            doctor: record.userId ?? '',
            especialidad: record.especialidad,
            subjetivo: record.content,
            objetivo: record.objetivo,
            analisis: record.analisis,
            plan: record.plan,
            eva: record.eva,
            firmada: record.firmada,
            timestamp: record.createdAt.toISOString(),
            alertasDetectadas: [],
            tratamiento_id: record.tratamientoId ?? undefined,
            tratamiento_nombre: record.tratamientoNombre ?? undefined,
        };
    }

    // ── Editar nota SOAP existente ────────────────────────────────────────────
    static async updateRecord(id: string, updates: Partial<CreateRecordInput>) {
        const data: any = {};
        if (updates.content !== undefined)   data.content    = updates.content;
        if (updates.objetivo !== undefined)  data.objetivo   = updates.objetivo;
        if (updates.analisis !== undefined)  data.analisis   = updates.analisis;
        if (updates.plan !== undefined)      data.plan       = updates.plan;
        if (updates.eva !== undefined)       data.eva        = updates.eva;
        if (updates.especialidad !== undefined) data.especialidad = updates.especialidad;
        if (updates.date !== undefined)      data.date       = new Date(updates.date);

        const record = await prisma.clinicalRecord.update({
            where: { id },
            data,
        });

        return {
            id: record.id,
            fecha: record.date.toISOString(),
            doctor: record.userId ?? '',
            especialidad: record.especialidad,
            subjetivo: record.content,
            objetivo: record.objetivo,
            analisis: record.analisis,
            plan: record.plan,
            eva: record.eva,
            firmada: record.firmada,
            timestamp: record.createdAt.toISOString(),
        };
    }

    // ── Odontograma — leer estado completo desde odontogram_state ────────────
    static async getOdontogram(numPac: string) {
        const state = await prisma.odontogramState.findUnique({
            where: { numPac },
        });
        if (!state || !state.data) {
            return { patientId: numPac, teeth: [] };
        }
        return { patientId: numPac, teeth: state.data as any[] };
    }

    // ── Odontograma — guardar estado completo (JSON de 32 piezas) ────────────
    static async saveOdontogramState(input: UpdateOdontogramInput) {
        const state = await prisma.odontogramState.upsert({
            where:  { numPac: input.patientId },
            create: { numPac: input.patientId, data: input.data },
            update: { data: input.data },
        });
        return { patientId: input.patientId, teeth: state.data as any[], updatedAt: state.updatedAt };
    }

    // Alias para compatibilidad con el controller anterior (se mantiene por si alguien lo llama)
    static async updateToothStatus(input: UpdateOdontogramInput) {
        return ClinicalService.saveOdontogramState(input);
    }

    // ── Eliminar nota SOAP ────────────────────────────────────────────────────
    static async deleteRecord(id: string) {
        try {
            await prisma.clinicalRecord.delete({ where: { id } });
        } catch {
            // Si es una entrada GELITE (id numérico), no se puede borrar
        }
        return { message: 'Eliminado' };
    }
}
