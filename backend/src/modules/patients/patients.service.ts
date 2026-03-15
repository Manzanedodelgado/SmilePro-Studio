import prisma from '../../config/database.js';
import type { CreatePatientInput, UpdatePatientInput } from './patients.schemas';

export class PatientsService {
    static async findAll(query: { search?: string; page?: string; limit?: string }) {
        const page = parseInt(query.page || '1');
        const limit = parseInt(query.limit || '20');
        const skip = (page - 1) * limit;
        const where: any = {};

        if (query.search) {
            where.OR = [
                { Nombre: { contains: query.search, mode: 'insensitive' } },
                { Apellidos: { contains: query.search, mode: 'insensitive' } },
                { NIF: { contains: query.search, mode: 'insensitive' } },
                { TelMovil: { contains: query.search } },
            ];
        }

        const [data, total] = await Promise.all([
            prisma.pacientes.findMany({ where, skip, take: limit, orderBy: { Apellidos: 'asc' } }).catch(() => []),
            prisma.pacientes.count({ where }).catch(() => 0),
        ]);

        return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    }

    static async findById(id: string) {
        const numPac = id;
        const patient = await prisma.pacientes.findFirst({ 
            where: { NumPac: numPac },
        }).catch(() => null);
        if (!patient) throw new Error('Paciente no encontrado');
        return patient;
    }

    static async create(input: CreatePatientInput) {
        // NumPac calculado como MAX(NumPac)+1 en GELITE, no Date.now()
        let numPac = input.NumPac;
        if (!numPac) {
            const maxRow = await prisma.pacientes
                .aggregate({ _max: { NumPac: true } })
                .catch(() => ({ _max: { NumPac: null } }));
            // NumPac en GELITE es string numérico ("00001234")
            const maxNum = parseInt(maxRow._max.NumPac ?? '0', 10);
            numPac = String(maxNum + 1).padStart(8, '0');
        }
        const data = { ...input, NumPac: numPac };
        return prisma.pacientes.create({ data: data as any }).catch(() => null);
    }

    static async update(id: string, input: UpdatePatientInput) {
        const numPac = id;
        // En Prisma hay que actualizar usando IDs primarios absolutos, 
        // pero buscamos el id primero si no es Primary Key:
        const existing = await prisma.pacientes.findFirst({ where: { NumPac: numPac } }).catch(() => null);
        if(!existing) throw new Error('Paciente no encontrado');

        return prisma.pacientes.update({ 
            where: { IdPac: existing.IdPac }, 
            data: input 
        }).catch(() => null);
    }

    static async delete(id: string) {
        const numPac = id;
        const existing = await prisma.pacientes.findFirst({ where: { NumPac: numPac } }).catch(() => null);
        if(!existing) throw new Error('Paciente no encontrado');
        
        return prisma.pacientes.delete({ where: { IdPac: existing.IdPac } }).catch(() => null);
    }
}
