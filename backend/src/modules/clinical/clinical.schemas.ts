// ─── Clinical Schemas ───────────────────────────────────
import { z } from 'zod';

export const createClinicalRecordSchema = z.object({
    patientId: z.string().cuid(),
    appointmentId: z.string().cuid().optional(),
    doctorId: z.string().cuid(),
    type: z.enum(['visit_note', 'odontogram', 'prescription', 'treatment_plan']),
    content: z.any(),
    notes: z.string().optional(),
});

export const odontogramEntrySchema = z.object({
    patientId: z.string().cuid(),
    toothNumber: z.number().int().min(11).max(85),
    condition: z.string(),
    surface: z.string().optional(),
    notes: z.string().optional(),
});

export const prescriptionSchema = z.object({
    patientId: z.string().cuid(),
    doctorId: z.string().cuid(),
    medications: z.array(z.object({
        name: z.string(),
        dosage: z.string(),
        frequency: z.string(),
        duration: z.string(),
    })),
    notes: z.string().optional(),
});

export type CreateClinicalRecordInput = z.infer<typeof createClinicalRecordSchema>;
export type OdontogramEntryInput = z.infer<typeof odontogramEntrySchema>;
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;
