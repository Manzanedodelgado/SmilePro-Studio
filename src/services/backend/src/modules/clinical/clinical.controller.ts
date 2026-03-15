// ─── Clinical Controller ──────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { ClinicalService } from './clinical.service.js';

export class ClinicalController {
    static async getHistory(req: Request, res: Response, next: NextFunction) {
        try {
            res.json({ success: true, data: await ClinicalService.getPatientHistory(req.params.patientId) });
        } catch (error) { next(error); }
    }

    static async createRecord(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.id;
            const record = await ClinicalService.createRecord({ ...req.body, userId });
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
            const userId = (req as any).user?.id;
            const entry = await ClinicalService.updateToothStatus({ ...req.body, userId });
            res.json({ success: true, data: entry });
        } catch (error) { next(error); }
    }
}
