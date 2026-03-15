import type { Request, Response } from 'express';

export const ImagingController = {
    getStudies: async (_req: Request, res: Response) => {
        res.json({ success: true, data: [] });
    },
    getStudy: async (req: Request, res: Response) => {
        res.json({ success: true, data: { id: req.params.id } });
    },
};
