// ─── Appointments Zod Schemas ───────────────────────────
import { z } from 'zod';

export const createAppointmentSchema = z.object({
    patientId: z.string().cuid(),
    doctorId: z.string().cuid(),
    operatoryId: z.string().cuid(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    treatment: z.string().min(1),
    notes: z.string().optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
    status: z.enum(['scheduled', 'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
    arrivalTime: z.string().datetime().optional(),
});

export const appointmentQuerySchema = z.object({
    date: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    doctorId: z.string().optional(),
    operatoryId: z.string().optional(),
    status: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentQuery = z.infer<typeof appointmentQuerySchema>;
