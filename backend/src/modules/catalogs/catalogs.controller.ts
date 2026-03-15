import type { Request, Response } from 'express';
import { CatalogsService } from './catalogs.service.js';

export const CatalogsController = {
    getSpecialties: async (_req: Request, res: Response) => {
        try {
            const data = await CatalogsService.getSpecialties();
            res.json({ success: true, data });
        } catch (e) {
            res.status(500).json({ success: false, message: String(e) });
        }
    },
    getTaxes: async (_req: Request, res: Response) => {
        try {
            const data = await CatalogsService.getTaxes();
            res.json({ success: true, data });
        } catch (e) {
            res.status(500).json({ success: false, message: String(e) });
        }
    },
};
