// ─── Accounting Schemas ─────────────────────────────────
import { z } from 'zod';

export const createInvoiceSchema = z.object({
    patientId: z.string().cuid(),
    items: z.array(z.object({
        treatmentId: z.string().cuid().optional(),
        description: z.string(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
        tax: z.number().min(0).optional(),
    })).min(1),
    notes: z.string().optional(),
});

export const createPaymentSchema = z.object({
    invoiceId: z.string().cuid(),
    amount: z.number().min(0),
    method: z.enum(['cash', 'card', 'transfer', 'financing']),
    reference: z.string().optional(),
});

export const createBudgetSchema = z.object({
    patientId: z.string().cuid(),
    items: z.array(z.object({
        treatmentId: z.string().cuid().optional(),
        description: z.string(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
    })).min(1),
    validUntil: z.string().datetime().optional(),
    notes: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
