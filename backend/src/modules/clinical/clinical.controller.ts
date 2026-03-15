// ─── Clinical Controller ──────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { ClinicalService } from './clinical.service.js';

export class ClinicalController {
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

    static async getHistory(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await ClinicalService.getPatientHistory(req.params.patientId) });
        } catch (error) { next(error); }
    }

    static async createRecord(req: Request, res: Response, next: NextFunction) {
        try {
            const record = await ClinicalService.createRecord(req.body);
            res.status(201).json({ success: true, data: record });
        } catch (error) { next(error); }
    }

    static async deleteRecord(req: Request, res: Response, next: NextFunction) {
        try {
            await ClinicalService.deleteRecord(req.params.id);
            res.json({ success: true });
        } catch (error) { next(error); }
    }

    static async getOdontogram(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await ClinicalService.getOdontogram(req.params.patientId) });
        } catch (error) { next(error); }
    }

    static async updateOdontogram(req: Request, res: Response, next: NextFunction) {
        try {
            const entry = await ClinicalService.updateToothStatus(req.body);
            res.json({ success: true, data: entry });
        } catch (error) { next(error); }
    }
}
