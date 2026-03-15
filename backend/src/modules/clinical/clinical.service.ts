// ─── Clinical Service ────────────────────────────────────
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

export class ClinicalService {
    static async getPatientHistory(patientId: string) {
        const [records, odontogram] = await Promise.all([
            prisma.clinicalRecord.findMany({
                where: { patientId },
                orderBy: { date: 'desc' },
            }),
            prisma.odontogramEntry.findMany({
                where: { patientId },
            }),
        ]);
        return { patientId, records, odontogram };
    }

    static async createRecord(input: CreateRecordInput) {
        return prisma.clinicalRecord.create({
            data: {
                patientId: input.patientId,
                userId: input.userId,
                date: input.date ? new Date(input.date) : new Date(),
                type: input.type ?? 'visit',
                title: input.title,
                content: input.content,
                treatments: input.treatments ?? [],
            },
        });
    }

    static async getOdontogram(patientId: string) {
        const teeth = await prisma.odontogramEntry.findMany({
            where: { patientId },
        });
        return { patientId, teeth };
    }

    static async updateToothStatus(input: UpdateOdontogramInput) {
        return prisma.odontogramEntry.upsert({
            where: {
                patientId_toothNumber: {
                    patientId: input.patientId,
                    toothNumber: input.toothNumber,
                },
            },
            update: {
                status: input.status,
                faces: input.faces ?? {},
                notes: input.notes,
                userId: input.userId,
            },
            create: {
                patientId: input.patientId,
                toothNumber: input.toothNumber,
                status: input.status,
                faces: input.faces ?? {},
                notes: input.notes,
                userId: input.userId,
            },
        });
    }

    static async deleteRecord(id: string) {
        return prisma.clinicalRecord.delete({ where: { id } });
    }
}
