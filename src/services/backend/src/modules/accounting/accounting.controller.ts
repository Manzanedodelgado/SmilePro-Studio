// ─── Accounting / Gestoría Controller ────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { AccountingService } from './accounting.service.js';

export class AccountingController {
    // ── Summary ───────────────────────────────────────────────────────────────
    static async getSummary(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await AccountingService.getSummary() });
        } catch (e) { next(e); }
    }

    // ── Facturas emitidas ─────────────────────────────────────────────────────
    static async listInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, ...await AccountingService.getEmittedInvoices(req.query as any) });
        } catch (e) { next(e); }
    }

    static async getInvoice(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await AccountingService.getEmittedInvoiceById(req.params.id) });
        } catch (e) { next(e); }
    }

    static async createInvoice(req: Request, res: Response, next: NextFunction) {
        try {
            res.status(201).json({ success: true, data: await AccountingService.createEmittedInvoice(req.body) });
        } catch (e) { next(e); }
    }

    static async updateInvoiceStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const { estadoPago } = req.body;
            res.json({ success: true, data: await AccountingService.updateEmittedInvoiceStatus(req.params.id, estadoPago) });
        } catch (e) { next(e); }
    }

    // ── Facturas email (recibidas) ────────────────────────────────────────────
    static async listEmailInvoices(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, ...await AccountingService.getEmailInvoices(req.query as any) });
        } catch (e) { next(e); }
    }

    static async updateEmailInvoice(req: Request, res: Response, next: NextFunction) {
        try {
            const { estado, proveedorId } = req.body;
            res.json({ success: true, data: await AccountingService.updateEmailInvoiceEstado(req.params.gmailMessageId, estado, proveedorId) });
        } catch (e) { next(e); }
    }

    // ── Proveedores ───────────────────────────────────────────────────────────
    static async listSuppliers(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, ...await AccountingService.getSuppliers(req.query as any) });
        } catch (e) { next(e); }
    }

    static async getSupplier(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await AccountingService.getSupplierById(req.params.id) });
        } catch (e) { next(e); }
    }

    static async createSupplier(req: Request, res: Response, next: NextFunction) {
        try {
            res.status(201).json({ success: true, data: await AccountingService.createSupplier(req.body) });
        } catch (e) { next(e); }
    }

    static async updateSupplier(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await AccountingService.updateSupplier(req.params.id, req.body) });
        } catch (e) { next(e); }
    }

    // ── Banco ─────────────────────────────────────────────────────────────────
    static async listBankMovements(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, ...await AccountingService.getBankMovements(req.query as any) });
        } catch (e) { next(e); }
    }

    static async reconcileMovement(req: Request, res: Response, next: NextFunction) {
        try {
            const { fEmitidaId, fRecibidaId } = req.body;
            res.json({ success: true, data: await AccountingService.reconcileBankMovement(req.params.id, fEmitidaId, fRecibidaId) });
        } catch (e) { next(e); }
    }

    // ── Modelos Fiscales ──────────────────────────────────────────────────────
    static async listTaxModels(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await AccountingService.getTaxModels(req.query as any) });
        } catch (e) { next(e); }
    }

    static async upsertTaxModel(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await AccountingService.upsertTaxModel(req.body) });
        } catch (e) { next(e); }
    }

    // ── Legacy ────────────────────────────────────────────────────────────────
    static async listPayments(req: Request, res: Response, next: NextFunction) {
        try { res.json({ success: true, ...await AccountingService.getPayments(req.query) }); } catch (e) { next(e); }
    }

    static async createPayment(req: Request, res: Response, next: NextFunction) {
        try { res.status(201).json({ success: true, data: await AccountingService.createPayment(req.body) }); } catch (e) { next(e); }
    }

    static async listBudgets(req: Request, res: Response, next: NextFunction) {
        try { res.json({ success: true, ...await AccountingService.getBudgets(req.query) }); } catch (e) { next(e); }
    }

    static async createBudget(req: Request, res: Response, next: NextFunction) {
        try { res.status(201).json({ success: true, data: await AccountingService.createBudget(req.body) }); } catch (e) { next(e); }
    }

    static async patientBalance(req: Request, res: Response, next: NextFunction) {
        try { res.json({ success: true, data: await AccountingService.getPatientBalance(req.params.patientId) }); } catch (e) { next(e); }
    }
}
