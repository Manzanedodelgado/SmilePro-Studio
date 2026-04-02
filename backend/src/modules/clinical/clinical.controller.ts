// ─── Clinical Controller ──────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { ClinicalService } from './clinical.service.js';
import prisma from '../../config/database.js';
import { logAudit } from '../../middleware/audit.js';

export class ClinicalController {
    // ── Entradas médicas GELITE (TtosMed) ──────────────────
    static async getEntradasMedicas(req: Request, res: Response, next: NextFunction) {
        try {
            const { page, pageSize, order } = req.query as Record<string, string>;
            const result = await ClinicalService.getEntradasMedicas(req.params.patientId, {
                page: page ? parseInt(page, 10) : 1,
                pageSize: pageSize ? parseInt(pageSize, 10) : 50,
                order: order === 'asc' ? 'asc' : 'desc',
            });
            res.json({ success: true, ...result });
        } catch (error) { next(error); }
    }

    // ── Actualizar entrada médica GELITE ────────────────────
    static async updateEntradaMedica(req: Request, res: Response, next: NextFunction) {
        try {
            const { patientId, entradaId } = req.params;
            const result = await ClinicalService.updateEntradaMedica(
                patientId,
                parseInt(entradaId, 10),
                req.body
            );
            if (!result) {
                res.status(404).json({ success: false, message: 'Entrada no encontrada' });
                return;
            }
            res.json({ success: true, data: result });
        } catch (error) { next(error); }
    }

    // ── Historia clínica (SOAP + TtosMed) ──────────────────
    static async getHistory(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await ClinicalService.getPatientHistory(req.params.patientId) });
        } catch (error) { next(error); }
    }

    // ── Notas SOAP propias de SmilePro ─────────────────────
    static async getSoapNotes(req: Request, res: Response, next: NextFunction) {
        try {
            const notes = await ClinicalService.getSoapNotes(req.params.patientId);
            res.json({ success: true, data: notes });
        } catch (error) { next(error); }
    }

    // ── Crear nota SOAP (persiste en clinical_records) ─────
    static async createRecord(req: Request, res: Response, next: NextFunction) {
        try {
            const record = await ClinicalService.createRecord(req.body);
            res.status(201).json({ success: true, data: record });
        } catch (error) { next(error); }
    }

    // ── Editar nota SOAP existente ─────────────────────────
    static async updateRecord(req: Request, res: Response, next: NextFunction) {
        try {
            const record = await ClinicalService.updateRecord(req.params.id, req.body);
            res.json({ success: true, data: record });
        } catch (error) { next(error); }
    }

    // ── Eliminar nota SOAP ─────────────────────────────────
    static async deleteRecord(req: Request, res: Response, next: NextFunction) {
        try {
            // GDPR: capture record before deletion
            let dataBefore: unknown = null;
            try { dataBefore = await prisma.clinicalRecord.findUnique({ where: { id: req.params.id } }); } catch {}

            await ClinicalService.deleteRecord(req.params.id);

            // Audit: clinical record deletion
            logAudit({ req, action: 'DELETE', entity: 'clinical_records', entityId: req.params.id, dataBefore });

            res.json({ success: true });
        } catch (error) { next(error); }
    }

    // ── Odontograma — leer estado ──────────────────────────
    static async getOdontogram(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await ClinicalService.getOdontogram(req.params.patientId) });
        } catch (error) { next(error); }
    }

    // ── Odontograma — guardar estado completo ──────────────
    static async updateOdontogram(req: Request, res: Response, next: NextFunction) {
        try {
            // Frontend envía: { patientId: numPac, data: DienteData[] }
            const { patientId, data } = req.body;
            if (!patientId || !Array.isArray(data)) {
                res.status(400).json({ success: false, message: 'patientId y data[] son requeridos' });
                return;
            }
            const entry = await ClinicalService.saveOdontogramState({ patientId, data });
            res.json({ success: true, data: entry });
        } catch (error) { next(error); }
    }
}
