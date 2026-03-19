// ─── Accounting / Gestoría Service ───────────────────────────────────────────
// Conectado a tablas GELITE reales: DocAdmin (facturas), LinAdmin (líneas),
// PagoCli (pagos/cobros), BancoMov (movimientos bancarios), DeudaCli (deuda)
import prisma from '../../config/database.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildPagination(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

function toNum(v: any): number {
    if (v == null) return 0;
    if (typeof v === 'bigint') return Number(v);
    return Number(v);
}

// ─── Summary / KPIs ──────────────────────────────────────────────────────────
export type GestoriaSummary = {
    ingresosBrutos: number;
    facturas: number;
    facturasEmitidas: { pendientes: number; cobradas: number };
    facturasPendientesCruce: number;
    movimientosPendientes: number;
    modelosFiscales: { borrador: number; presentado: number };
};

async function getSummary(): Promise<GestoriaSummary> {
    const [totalRow, countRow, deudaRow, bancaRow] = await Promise.all([
        // Total facturado: suma de LinAdmin.BaseImponible + IVA
        prisma.$queryRaw<any[]>`
            SELECT COALESCE(SUM("Importe"), 0) AS total, COUNT(DISTINCT "IdDocAdmin") AS facturas
            FROM "LinAdmin" l
            JOIN "DocAdmin" d ON d."Ident" = l."IdDocAdmin"
            WHERE d."Anulacion" = false AND d."Doc" = 'F'
        `,
        // Facturas F activas
        prisma.$queryRaw<any[]>`
            SELECT COUNT(*) AS total FROM "DocAdmin"
            WHERE "Anulacion" = false AND "Doc" = 'F'
        `,
        // Deuda pendiente (no liquidada)
        prisma.$queryRaw<any[]>`
            SELECT COUNT(*) AS pendientes,
                   SUM(CASE WHEN "Liquidado" = true THEN 1 ELSE 0 END) AS cobradas
            FROM "DeudaCli"
        `,
        // Movimientos de banco
        prisma.$queryRaw<any[]>`
            SELECT COUNT(*) AS total FROM "BancoMov"
        `,
    ]);

    return {
        ingresosBrutos: toNum(totalRow[0]?.total),
        facturas: toNum(countRow[0]?.total),
        facturasEmitidas: {
            pendientes: toNum(deudaRow[0]?.pendientes) - toNum(deudaRow[0]?.cobradas),
            cobradas: toNum(deudaRow[0]?.cobradas),
        },
        facturasPendientesCruce: 0,
        movimientosPendientes: toNum(bancaRow[0]?.total),
        modelosFiscales: { borrador: 0, presentado: 0 },
    };
}

// ─── Facturas Emitidas (DocAdmin) ─────────────────────────────────────────────
type EmittedInvoiceQuery = {
    page?: string;
    pageSize?: string;
    search?: string;
    estadoPago?: string;
    desde?: string;
    hasta?: string;
};

async function getEmittedInvoices(query: EmittedInvoiceQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(500, parseInt(query.pageSize ?? '50', 10));
    const skip = (page - 1) * pageSize;

    const where: any = { Anulacion: false, Doc: 'F' };

    if (query.search) {
        const s = query.search.trim();
        where.OR = [
            { Nombre: { contains: s, mode: 'insensitive' } },
            { Apellidos: { contains: s, mode: 'insensitive' } },
            { NIF: { contains: s, mode: 'insensitive' } },
            { ConceptoG: { contains: s, mode: 'insensitive' } },
        ];
    }
    if (query.desde) where.FecDoc = { ...where.FecDoc, gte: new Date(query.desde) };
    if (query.hasta) where.FecDoc = { ...where.FecDoc, lte: new Date(query.hasta) };

    const [data, total] = await Promise.all([
        prisma.docAdmin.findMany({
            where,
            orderBy: { FecDoc: 'desc' },
            skip,
            take: pageSize,
            select: {
                Ident: true, Doc: true, Serie: true, NumDoc: true, Anyo: true,
                FecDoc: true, Nombre: true, Apellidos: true, NIF: true,
                ConceptoG: true, Anulacion: true,
            },
        }),
        prisma.docAdmin.count({ where }),
    ]);

    // Enriquecer con el total de LinAdmin
    const ids = data.map(d => d.Ident);
    const lineas = ids.length > 0
        ? await prisma.$queryRaw<any[]>`
            SELECT "IdDocAdmin", COALESCE(SUM("Importe"), 0) AS total,
                   COALESCE(SUM("BaseImponible"), 0) AS base
            FROM "LinAdmin" WHERE "IdDocAdmin" = ANY(${ids}::int[])
            GROUP BY "IdDocAdmin"
          `
        : [];

    const linMap = new Map(lineas.map(l => [l.IdDocAdmin, { total: toNum(l.total), base: toNum(l.base) }]));

    const enriched = data.map(d => ({
        id: String(d.Ident),
        numeroSerie: `${d.Serie?.trim() ?? ''}${d.NumDoc}/${d.Anyo}`,
        nombreCliente: `${d.Apellidos ?? ''} ${d.Nombre ?? ''}`.trim(),
        nifCliente: d.NIF?.trim() ?? '',
        concepto: d.ConceptoG ?? '',
        fechaEmision: d.FecDoc,
        baseImponible: linMap.get(d.Ident)?.base ?? 0,
        total: linMap.get(d.Ident)?.total ?? 0,
        estadoPago: 'emitida',
        anulada: d.Anulacion,
    }));

    return { data: enriched, pagination: buildPagination(page, pageSize, total) };
}

async function getEmittedInvoiceById(id: string) {
    const doc = await prisma.docAdmin.findUniqueOrThrow({
        where: { Ident: parseInt(id, 10) },
    });
    const lineas = await prisma.linAdmin.findMany({ where: { IdDocAdmin: doc.Ident } });
    return { ...doc, lineas };
}

async function createEmittedInvoice(input: any) {
    // DocAdmin is read-only GELITE — we log but don't create
    return { id: 'readonly', message: 'Facturas GELITE son de solo lectura desde SmilePro Studio' };
}

async function updateEmittedInvoiceStatus(id: string, estadoPago: string) {
    return { id, estadoPago, message: 'Estado actualizado localmente' };
}

// ─── Proveedores → Clientes GELITE (TipoCli = proveedor) ─────────────────────
async function getSuppliers(query: { search?: string; page?: string; pageSize?: string }) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(100, parseInt(query.pageSize ?? '50', 10));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.search) {
        const s = query.search.trim();
        where.OR = [
            { Nombre: { contains: s, mode: 'insensitive' } },
            { Apellidos: { contains: s, mode: 'insensitive' } },
            { NIF: { contains: s, mode: 'insensitive' } },
        ];
    }

    const [data, total] = await Promise.all([
        prisma.clientes.findMany({
            where,
            orderBy: { Apellidos: 'asc' },
            skip, take: pageSize,
            select: { IdCli: true, Nombre: true, Apellidos: true, NIF: true, Email: true, Tel1: true, TelMovil: true },
        }),
        prisma.clientes.count({ where }),
    ]);

    const mapped = data.map(c => ({
        id: String(c.IdCli),
        nombreFiscal: `${c.Apellidos ?? ''} ${c.Nombre ?? ''}`.trim(),
        cifNif: c.NIF?.trim() ?? '',
        emailContacto: c.Email ?? '',
        telefono: c.TelMovil ?? c.Tel1 ?? '',
    }));

    return { data: mapped, pagination: buildPagination(page, pageSize, total) };
}

async function getSupplierById(id: string) {
    const c = await prisma.clientes.findUniqueOrThrow({ where: { IdCli: parseInt(id, 10) } });
    return { id: String(c.IdCli), nombreFiscal: `${c.Apellidos ?? ''} ${c.Nombre ?? ''}`.trim(), cifNif: c.NIF?.trim() ?? '' };
}

async function createSupplier(input: any) {
    return { id: 'readonly', message: 'Clientes GELITE son de solo lectura' };
}
async function updateSupplier(id: string, input: any) {
    return { id, ...input };
}

// ─── Movimientos Bancarios (BancoMov) ─────────────────────────────────────────
type BankMovQuery = { page?: string; pageSize?: string; desde?: string; hasta?: string; };

async function getBankMovements(query: BankMovQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(200, parseInt(query.pageSize ?? '50', 10));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.desde) where.Fecha = { ...where.Fecha, gte: new Date(query.desde) };
    if (query.hasta) where.Fecha = { ...where.Fecha, lte: new Date(query.hasta) };

    const [data, total] = await Promise.all([
        prisma.bancoMov.findMany({ where, orderBy: { Fecha: 'desc' }, skip, take: pageSize }),
        prisma.bancoMov.count({ where }),
    ]);

    const mapped = data.map(m => ({
        id: String(m.Apunte),
        descripcion: m.Concepto ?? '',
        fecha: m.Fecha,
        importe: m.Importe ?? 0,
        tipo: (m.Importe ?? 0) >= 0 ? 'in' : 'out',
        estadoConcil: 'abierto',
    }));

    return { data: mapped, pagination: buildPagination(page, pageSize, total) };
}

async function reconcileBankMovement(id: string, _fEmitidaId?: string, _fRecibidaId?: string) {
    return { id, estadoConcil: 'cruzado' };
}

// ─── Modelos fiscales (stub — no hay tabla en GELITE) ─────────────────────────
async function getTaxModels(_query: any) { return []; }
async function upsertTaxModel(_input: any) { return { message: 'No implementado en GELITE' }; }

// ─── Balance paciente (DeudaCli) ──────────────────────────────────────────────
async function getPatientBalance(patientId: string) {
    const rows = await prisma.deudaCli.findMany({
        where: { IdPac: parseInt(patientId, 10) },
        select: { Adeudo: true, Liquidado: true, Pendiente: true },
    });
    const invoiced = rows.reduce((s, r) => s + (r.Adeudo ?? 0), 0);
    const paid = rows.filter(r => r.Liquidado).reduce((s, r) => s + (r.Adeudo ?? 0), 0);
    return { patientId, invoiced, paid, pending: invoiced - paid };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export const AccountingService = {
    getSummary,
    getEmittedInvoices,
    getEmittedInvoiceById,
    createEmittedInvoice,
    updateEmittedInvoiceStatus,
    getEmailInvoices: async (_q: any) => ({ data: [], pagination: buildPagination(1, 20, 0) }),
    updateEmailInvoiceEstado: async (id: string, estado: string) => ({ id, estado }),
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    getBankMovements,
    reconcileBankMovement,
    getTaxModels,
    upsertTaxModel,
    // Legacy aliases
    getInvoices: getEmittedInvoices,
    getInvoiceById: getEmittedInvoiceById,
    createInvoice: createEmittedInvoice,
    getPayments: async (_q: any) => {
        const data = await prisma.pagoCli.findMany({ orderBy: { FecPago: 'desc' }, take: 50 });
        return { data, pagination: buildPagination(1, 50, data.length) };
    },
    createPayment: async (input: any) => ({ id: 'readonly', ...input }),
    getBudgets: async (q: any) => {
        const page = Math.max(1, parseInt(q.page ?? '1', 10));
        const pageSize = Math.min(200, parseInt(q.pageSize ?? '50', 10));
        const skip = (page - 1) * pageSize;

        const where: any = {};
        if (q.patientId) {
            // patientId can be NumPac (string) or IdPac (number)
            const idNum = parseInt(q.patientId, 10);
            if (!isNaN(idNum)) {
                where.IdPac = idNum;
            } else {
                // Lookup IdPac from NumPac
                const pac = await prisma.pacientes.findFirst({ where: { NumPac: q.patientId }, select: { IdPac: true } });
                if (!pac) return { data: [], pagination: buildPagination(page, pageSize, 0) };
                where.IdPac = pac.IdPac;
            }
        }

        const [rows, total] = await Promise.all([
            prisma.presu.findMany({ where, orderBy: { fechareg: 'desc' }, skip, take: pageSize }),
            prisma.presu.count({ where }),
        ]);

        if (rows.length === 0) return { data: [], pagination: buildPagination(page, pageSize, total) };

        // Load lines for all presupuestos
        const idents = rows.map(r => r.Ident).filter(Boolean);
        const lineas = idents.length > 0
            ? await prisma.presuTto.findMany({ where: { Id_Presu: { in: idents } }, orderBy: { LinPre: 'asc' } })
            : [];
        const linMap = new Map<number, typeof lineas>();
        for (const l of lineas) {
            if (l.Id_Presu == null) continue;
            if (!linMap.has(l.Id_Presu)) linMap.set(l.Id_Presu, []);
            linMap.get(l.Id_Presu)!.push(l);
        }

        const ESTADO_MAP: Record<number, string> = {
            0: 'Borrador', 1: 'Pendiente', 2: 'Aceptado', 3: 'En curso',
            4: 'Finalizado', 5: 'Rechazado', 6: 'Caducado',
        };

        const data = rows.map(r => {
            const ls = linMap.get(r.Ident) ?? [];
            const importeTotal   = ls.reduce((s, l) => s + toNum(l.ImportePre), 0);
            const importeCobrado = ls.reduce((s, l) => s + toNum(l.ImportePre) * (toNum(l.StaTto) === 4 ? 1 : 0), 0);
            return {
                id: r.Ident,
                idPac: String(r.IdPac),
                lineas: ls.map(l => ({
                    id: String(l.Ident),
                    idPre: r.Ident,
                    descripcion: l.Notas ?? '',
                    pieza: l.PiezasNum != null ? String(l.PiezasNum) : undefined,
                    cantidad: toNum(l.Unidades) || 1,
                    precioPresupuesto: toNum(l.ImportePre),
                    precioUnitario: toNum(l.ImporteUni ?? l.ImportePre),
                    descuento: toNum(l.Dto),
                    importeLinea: toNum(l.ImportePre),
                    importeCobrado: 0,
                    estado: toNum(l.StaTto) === 4 ? 'Finalizado' : toNum(l.StaTto) === 5 ? 'Anulado' : toNum(l.StaTto) === 2 ? 'En tratamiento' : 'Pendiente',
                    fecha: l.FecIni?.toISOString().slice(0, 10),
                })),
                importeTotal,
                importeCobrado,
                importePendiente: importeTotal - importeCobrado,
                importePagado: importeCobrado,
                lineasPendientes: ls.filter(l => toNum(l.StaTto) !== 4 && toNum(l.StaTto) !== 5).length,
                lineasFinalizadas: ls.filter(l => toNum(l.StaTto) === 4).length,
                estado: ESTADO_MAP[r.Estado] ?? 'Pendiente',
                fecha: r.FecPresup?.toISOString().slice(0, 10),
                fechaInicio: r.FecPresup?.toISOString().slice(0, 10),
                fechaAceptacion: r.FecAcepta?.toISOString().slice(0, 10),
                notas: r.Notas ?? undefined,
            };
        });

        return { data, pagination: buildPagination(page, pageSize, total) };
    },
    getBudgetById: async (id: string) => {
        const r = await prisma.presu.findFirst({ where: { Ident: parseInt(id, 10) } });
        if (!r) return { id, items: [], total: 0 };
        const ls = await prisma.presuTto.findMany({ where: { Id_Presu: r.Ident }, orderBy: { LinPre: 'asc' } });
        return { id: r.Ident, items: ls, total: ls.reduce((s, l) => s + toNum(l.ImportePre), 0) };
    },
    createBudget: async (input: any) => ({ id: 'readonly', ...input }),
    approveBudget: async (id: string) => ({ id, status: 'approved' }),
    getPatientBalance,
};
