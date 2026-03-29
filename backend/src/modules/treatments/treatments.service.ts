// ─── Treatments Service (Scaffold) ──────────────────────
import prisma from '../../config/database.js';
import type { CreateTreatmentInput, UpdateTreatmentInput } from './treatments.schemas';

export class TreatmentsService {
    static async findAll(query: { category?: string; active?: string }) {
        const where: any = {};
        if (query.category) where.category = query.category;
        if (query.active !== undefined) where.active = query.active === 'true';
        return prisma.treatment.findMany({ where, orderBy: { category: 'asc' } });
    }

    static async findById(id: string) {
        const t = await prisma.treatment.findUnique({ where: { id } });
        if (!t) throw new Error('Tratamiento no encontrado');
        return t;
    }

    static async create(input: CreateTreatmentInput) {
        return prisma.treatment.create({ data: { ...input, price: input.price } as any });
    }

    static async update(id: string, input: UpdateTreatmentInput) {
        return prisma.treatment.update({ where: { id }, data: input as any });
    }

    static async delete(id: string) {
        return prisma.treatment.update({ where: { id }, data: { active: false } });
    }
}
