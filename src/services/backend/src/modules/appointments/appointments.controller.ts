// ─── Appointments Controller ────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { AppointmentsService } from './appointments.service.js';
import { logger } from '../../config/logger.js';

export class AppointmentsController {
    static async latestDate(req: Request, res: Response, next: NextFunction) {
        try {
            const date = await AppointmentsService.getLatestDate();
            res.json({ success: true, latestDate: date });
        } catch (error) {
            next(error);
        }
    }

    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await AppointmentsService.findAll(req.query as any);
            res.json({ success: true, ...result });
        } catch (error) {
            logger.error('Error listando citas:', error);
            next(error);
        }
    }

    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            // ID format: "IdUsu-IdOrden"
            const [idUsu, idOrden] = req.params.id.split('-').map(Number);
            if (isNaN(idUsu) || isNaN(idOrden)) {
                res.status(400).json({ success: false, error: { message: 'ID inválido (formato: IdUsu-IdOrden)' } });
                return;
            }
            const data = await AppointmentsService.findById(idUsu, idOrden);
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await AppointmentsService.create(req.body);
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const [idUsu, idOrden] = req.params.id.split('-').map(Number);
            if (isNaN(idUsu) || isNaN(idOrden)) {
                res.status(400).json({ success: false, error: { message: 'ID inválido (formato: IdUsu-IdOrden)' } });
                return;
            }
            const data = await AppointmentsService.update(idUsu, idOrden, req.body);
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    static async cancel(req: Request, res: Response, next: NextFunction) {
        try {
            const [idUsu, idOrden] = req.params.id.split('-').map(Number);
            if (isNaN(idUsu) || isNaN(idOrden)) {
                res.status(400).json({ success: false, error: { message: 'ID inválido (formato: IdUsu-IdOrden)' } });
                return;
            }
            const data = await AppointmentsService.cancel(idUsu, idOrden);
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    static async config(req: Request, res: Response, next: NextFunction) {
        try {
            const config = await AppointmentsService.getConfig();
            res.json({ success: true, ...config });
        } catch (error) {
            next(error);
        }
    }
}
