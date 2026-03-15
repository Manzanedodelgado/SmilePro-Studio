import { z } from 'zod';

export const createPatientSchema = z.object({
    NumPac: z.string().optional(),
    Nombre: z.string().min(2, 'Nombre obligatorio'),
    Apellidos: z.string().min(2, 'Apellido obligatorio'),
    NIF: z.string().optional(),
    TelMovil: z.string().min(9, 'Teléfono obligatorio'),
    Email: z.string().email('Email inválido').optional(),
    FecNacim: z.string().datetime().optional(),
    Direccion: z.string().optional(),
    IdPoblacio: z.number().int().optional(),
    CP: z.string().optional(),
    Notas: z.string().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const patientQuerySchema = z.object({
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientQuery = z.infer<typeof patientQuerySchema>;
