import type { Request, Response } from 'express';

export const GdriveController = {
    listFiles: async (_req: Request, res: Response) => {
        try {
            // TODO: implementar listado de Google Drive
            res.json({ success: true, data: [] });
        } catch (e) {
            res.status(500).json({ success: false, message: String(e) });
        }
    },
    uploadFile: async (_req: Request, res: Response) => {
        res.status(501).json({ success: false, message: 'No implementado' });
    },
};
