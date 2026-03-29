// ─── Treatments Schemas ─────────────────────────────────
import { z } from 'zod';

export const createTreatmentSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(2),
    category: z.enum(['preventive', 'restorative', 'endodontics', 'periodontics', 'prosthodontics', 'orthodontics', 'surgery', 'aesthetics', 'diagnostics', 'other']).optional(),
    description: z.string().optional(),
    price: z.number().min(0),
    duration: z.number().int().min(5).optional(),
});

export const updateTreatmentSchema = createTreatmentSchema.partial();
export type CreateTreatmentInput = z.infer<typeof createTreatmentSchema>;
export type UpdateTreatmentInput = z.infer<typeof updateTreatmentSchema>;
