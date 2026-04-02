// ─── Treatments Controller (Scaffold) ───────────────────
import { Request, Response, NextFunction } from 'express';
import { TreatmentsService } from './treatments.service';
import { logger } from '../../config/logger.js';
import { logAudit } from '../../middleware/audit.js';

export class TreatmentsController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try { res.json({ success: true, data: await TreatmentsService.findAll(req.query as any) }); }
        catch (error) { next(error); }
    }

    static async getById(req: Request, res: Response, next: NextFunction) {
        try { res.json({ success: true, data: await TreatmentsService.findById(req.params.id) }); }
        catch (error) { next(error); }
    }

    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const t = await TreatmentsService.create(req.body);
            logger.info(`Tratamiento creado: ${t.name}`);
            res.status(201).json({ success: true, data: t });
        } catch (error) { next(error); }
    }

    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const t = await TreatmentsService.update(req.params.id, req.body);
            res.json({ success: true, data: t });
        } catch (error) { next(error); }
    }

    static async remove(req: Request, res: Response, next: NextFunction) {
        try {
            const dataBefore = await TreatmentsService.findById(req.params.id).catch(() => null);
            await TreatmentsService.delete(req.params.id);
            logAudit({ req, action: 'DELETE', entity: 'treatments', entityId: req.params.id, dataBefore, dataAfter: { ...dataBefore as any, active: false } });
            res.json({ success: true, data: { message: 'Tratamiento desactivado' } });
        }
        catch (error) { next(error); }
    }
}
