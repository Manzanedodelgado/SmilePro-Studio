// ─── Accounting / Gestoría Service ───────────────────────────────────────────
import prisma from '../../config/database.js';
import { Decimal } from '@prisma/client/runtime/library.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toNumber(d: Decimal | null | undefined): number {
    if (d == null) return 0;
    return d.toNumber();
}

function buildPagination(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
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
    const [emitidas, emailPendientes, movPendientes, modelos, pendientesCount, cobradasCount] = await Promise.all([
        prisma.gestFacturasEmitidas.aggregate({
            _sum: { baseImponible: true, total: true },
            _count: { id: true },
        }),
        prisma.gestFacturasEmail.count({ where: { estado: 'pendiente' } }),
        prisma.gestMovimientosBancarios.count({ where: { estadoConcil: 'abierto' } }),
        prisma.gestModelosFiscales.groupBy({ by: ['estado'], _count: { id: true } }),
        prisma.gestFacturasEmitidas.count({ where: { estadoPago: 'pendiente' } }),
        prisma.gestFacturasEmitidas.count({ where: { estadoPago: 'cobrada' } }),
    ]);

    const modelosMap = modelos.reduce<Record<string, number>>((acc, g) => {
        acc[g.estado ?? 'borrador'] = g._count.id;
        return acc;
    }, {});

    return {
        ingresosBrutos: toNumber(emitidas._sum.total),
        facturas: emitidas._count.id,
        facturasEmitidas: { pendientes: pendientesCount, cobradas: cobradasCount },
        facturasPendientesCruce: emailPendientes,
        movimientosPendientes: movPendientes,
        modelosFiscales: {
            borrador: modelosMap['borrador'] ?? 0,
            presentado: modelosMap['presentado'] ?? 0,
        },
    };
}

// ─── Facturas Emitidas ────────────────────────────────────────────────────────
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
    const pageSize = Math.min(100, parseInt(query.pageSize ?? '20', 10));
    const skip = (page - 1) * pageSize;

    const where: Parameters<typeof prisma.gestFacturasEmitidas.findMany>[0]['where'] = {};

    if (query.search) {
        const s = query.search.trim();
        where.OR = [
            { nombreCliente: { contains: s, mode: 'insensitive' } },
            { nifCliente: { contains: s, mode: 'insensitive' } },
            { numeroSerie: { contains: s, mode: 'insensitive' } },
            { concepto: { contains: s, mode: 'insensitive' } },
        ];
    }
    if (query.estadoPago) where.estadoPago = query.estadoPago;
    if (query.desde) where.fechaEmision = { ...where.fechaEmision as object, gte: new Date(query.desde) };
    if (query.hasta) where.fechaEmision = { ...where.fechaEmision as object, lte: new Date(query.hasta) };

    const [data, total] = await Promise.all([
        prisma.gestFacturasEmitidas.findMany({
            where,
            orderBy: { fechaEmision: 'desc' },
            skip,
            take: pageSize,
        }),
        prisma.gestFacturasEmitidas.count({ where }),
    ]);

    return { data, pagination: buildPagination(page, pageSize, total) };
}

async function getEmittedInvoiceById(id: string) {
    return prisma.gestFacturasEmitidas.findUniqueOrThrow({ where: { id } });
}

type CreateEmittedInvoiceInput = {
    numeroSerie: string;
    numPac?: string;
    nifCliente: string;
    nombreCliente: string;
    concepto: string;
    baseImponible: number;
    ivaPct?: number;
    total: number;
    fechaEmision: string;
};

async function createEmittedInvoice(input: CreateEmittedInvoiceInput) {
    return prisma.gestFacturasEmitidas.create({
        data: {
            numeroSerie: input.numeroSerie,
            numPac: input.numPac,
            nifCliente: input.nifCliente,
            nombreCliente: input.nombreCliente,
            concepto: input.concepto,
            baseImponible: input.baseImponible,
            ivaPct: input.ivaPct ?? 0,
            total: input.total,
            fechaEmision: new Date(input.fechaEmision),
        },
    });
}

async function updateEmittedInvoiceStatus(id: string, estadoPago: string) {
    return prisma.gestFacturasEmitidas.update({
        where: { id },
        data: { estadoPago },
    });
}

// ─── Facturas Email (recibidas) ───────────────────────────────────────────────
type EmailInvoiceQuery = {
    page?: string;
    pageSize?: string;
    search?: string;
    estado?: string;
    proveedorId?: string;
};

async function getEmailInvoices(query: EmailInvoiceQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(100, parseInt(query.pageSize ?? '20', 10));
    const skip = (page - 1) * pageSize;

    const where: Parameters<typeof prisma.gestFacturasEmail.findMany>[0]['where'] = {};

    if (query.search) {
        const s = query.search.trim();
        where.OR = [
            { proveedorExtraido: { contains: s, mode: 'insensitive' } },
            { numeroFactura: { contains: s, mode: 'insensitive' } },
        ];
    }
    if (query.estado) where.estado = query.estado;
    if (query.proveedorId) where.proveedorId = query.proveedorId;

    const [data, total] = await Promise.all([
        (prisma.gestFacturasEmail as any).findMany({
            where,
            include: { proveedor: { select: { id: true, nombreFiscal: true, cifNif: true } } },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
        }),
        prisma.gestFacturasEmail.count({ where }),
    ]);

    return { data, pagination: buildPagination(page, pageSize, total) };
}

async function updateEmailInvoiceEstado(gmailMessageId: string, estado: string, proveedorId?: string) {
    return prisma.gestFacturasEmail.update({
        where: { gmailMessageId },
        data: { estado, ...(proveedorId ? { proveedorId } : {}) },
    });
}

// ─── Proveedores ──────────────────────────────────────────────────────────────
async function getSuppliers(query: { search?: string; page?: string; pageSize?: string }) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(100, parseInt(query.pageSize ?? '50', 10));
    const skip = (page - 1) * pageSize;

    const where: Parameters<typeof prisma.gestProveedores.findMany>[0]['where'] = {};
    if (query.search) {
        const s = query.search.trim();
        where.OR = [
            { nombreFiscal: { contains: s, mode: 'insensitive' } },
            { cifNif: { contains: s, mode: 'insensitive' } },
        ];
    }

    const [data, total] = await Promise.all([
        prisma.gestProveedores.findMany({ where, orderBy: { nombreFiscal: 'asc' }, skip, take: pageSize }),
        prisma.gestProveedores.count({ where }),
    ]);

    return { data, pagination: buildPagination(page, pageSize, total) };
}

async function getSupplierById(id: string) {
    return prisma.gestProveedores.findUniqueOrThrow({ where: { id } });
}

type CreateSupplierInput = {
    nombreFiscal: string;
    cifNif?: string;
    emailContacto?: string;
    categoriaDefecto?: string;
    iban?: string;
};

async function createSupplier(input: CreateSupplierInput) {
    return prisma.gestProveedores.create({ data: input });
}

async function updateSupplier(id: string, input: Partial<CreateSupplierInput>) {
    return prisma.gestProveedores.update({ where: { id }, data: input });
}

// ─── Movimientos Bancarios ────────────────────────────────────────────────────
type BankMovQuery = {
    page?: string;
    pageSize?: string;
    estadoConcil?: string;
    desde?: string;
    hasta?: string;
    ibanCuenta?: string;
};

async function getBankMovements(query: BankMovQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(100, parseInt(query.pageSize ?? '20', 10));
    const skip = (page - 1) * pageSize;

    const where: Parameters<typeof prisma.gestMovimientosBancarios.findMany>[0]['where'] = {};
    if (query.estadoConcil) where.estadoConcil = query.estadoConcil;
    if (query.ibanCuenta) where.ibanCuenta = query.ibanCuenta;
    if (query.desde) where.fechaOperacion = { ...where.fechaOperacion as object, gte: new Date(query.desde) };
    if (query.hasta) where.fechaOperacion = { ...where.fechaOperacion as object, lte: new Date(query.hasta) };

    const [data, total] = await Promise.all([
        (prisma.gestMovimientosBancarios as any).findMany({
            where,
            include: {
                facturaEmitida: { select: { id: true, numeroSerie: true, nombreCliente: true } },
                facturaRecibida: { select: { gmailMessageId: true, proveedorExtraido: true, numeroFactura: true } },
            },
            orderBy: { fechaOperacion: 'desc' },
            skip,
            take: pageSize,
        }),
        prisma.gestMovimientosBancarios.count({ where }),
    ]);

    return { data, pagination: buildPagination(page, pageSize, total) };
}

async function reconcileBankMovement(id: string, fEmitidaId?: string, fRecibidaId?: string) {
    return prisma.gestMovimientosBancarios.update({
        where: { id },
        data: {
            estadoConcil: 'cruzado',
            ...(fEmitidaId ? { fEmitidaId } : {}),
            ...(fRecibidaId ? { fRecibidaId } : {}),
        },
    });
}

// ─── Modelos Fiscales ─────────────────────────────────────────────────────────
async function getTaxModels(query: { ejercicio?: string; estado?: string }) {
    const where: Parameters<typeof prisma.gestModelosFiscales.findMany>[0]['where'] = {};
    if (query.ejercicio) where.ejercicio = parseInt(query.ejercicio, 10);
    if (query.estado) where.estado = query.estado;

    return prisma.gestModelosFiscales.findMany({
        where,
        orderBy: [{ ejercicio: 'desc' }, { modelo: 'asc' }],
    });
}

type TaxModelInput = {
    modelo: string;
    ejercicio: number;
    periodo: string;
    estado?: string;
    fechaLimite: string;
    cuotaResultante?: number;
    archivoJustif?: string;
};

async function upsertTaxModel(input: TaxModelInput) {
    const { modelo, ejercicio, periodo, estado, fechaLimite, cuotaResultante, archivoJustif } = input;
    return prisma.gestModelosFiscales.upsert({
        where: { modelo_ejercicio_periodo: { modelo, ejercicio, periodo } },
        create: {
            modelo, ejercicio, periodo,
            estado: estado ?? 'borrador',
            fechaLimite: new Date(fechaLimite),
            cuotaResultante: cuotaResultante ?? null,
            archivoJustif: archivoJustif ?? null,
        },
        update: {
            ...(estado ? { estado } : {}),
            fechaLimite: new Date(fechaLimite),
            ...(cuotaResultante !== undefined ? { cuotaResultante } : {}),
            ...(archivoJustif !== undefined ? { archivoJustif } : {}),
        },
    });
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export const AccountingService = {
    // Summary
    getSummary,
    // Facturas emitidas
    getEmittedInvoices,
    getEmittedInvoiceById,
    createEmittedInvoice,
    updateEmittedInvoiceStatus,
    // Facturas email (recibidas)
    getEmailInvoices,
    updateEmailInvoiceEstado,
    // Proveedores
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    // Banco
    getBankMovements,
    reconcileBankMovement,
    // Modelos fiscales
    getTaxModels,
    upsertTaxModel,
    // Legacy (compatibilidad rutas antiguas)
    getInvoices: getEmittedInvoices,
    getInvoiceById: getEmittedInvoiceById,
    createInvoice: createEmittedInvoice,
    getPayments: async (_q: any) => ({ data: [], pagination: buildPagination(1, 20, 0) }),
    createPayment: async (input: any) => ({ id: 'TODO', ...input }),
    getBudgets: async (_q: any) => ({ data: [], pagination: buildPagination(1, 20, 0) }),
    getBudgetById: async (id: string) => ({ id, items: [], total: 0 }),
    createBudget: async (input: any) => ({ id: 'TODO', ...input }),
    approveBudget: async (id: string) => ({ id, status: 'approved' }),
    getPatientBalance: async (patientId: string) => ({ patientId, invoiced: 0, paid: 0, pending: 0 }),
};
