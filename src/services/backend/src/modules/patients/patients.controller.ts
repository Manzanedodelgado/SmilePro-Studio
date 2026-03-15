import { Request, Response, NextFunction } from 'express';
import { PatientsService } from './patients.service.js';
import { logger } from '../../config/logger.js';
import { createPatientFolder } from '../gdrive/gdrive.service.js';

export class PatientsController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await PatientsService.findAll(req.query as any);
            res.json({ success: true, ...result });
        } catch (error) { next(error); }
    }

    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const patient = await PatientsService.findById(req.params.id);
            res.json({ success: true, data: patient });
        } catch (error) { next(error); }
    }

    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const patient = await PatientsService.create(req.body);
            logger.info(`Paciente creado con NumPac: ${patient?.NumPac}`);

            // ── Auto-crear carpeta Drive en background (no bloquea la respuesta) ──
            if (patient?.NumPac && patient?.Apellidos) {
                setImmediate(async () => {
                    try {
                        const folder = await createPatientFolder(
                            patient.NumPac!,
                            patient.Apellidos ?? '',
                            patient.Nombre ?? '',
                        );
                        if (folder) logger.info(`[GDrive] Carpeta creada: ${folder.name}`);
                        else logger.warn(`[GDrive] No se pudo crear carpeta para ${patient.NumPac}`);
                    } catch (e) {
                        logger.error('[GDrive] Error al crear carpeta en background:', e);
                    }
                });
            }

            res.status(201).json({ success: true, data: patient });
        } catch (error) { next(error); }
    }


    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const patient = await PatientsService.update(req.params.id, req.body);
            logger.info(`Paciente actualizado: ${req.params.id}`);
            res.json({ success: true, data: patient });
        } catch (error) { next(error); }
    }

    static async remove(req: Request, res: Response, next: NextFunction) {
        try {
            await PatientsService.delete(req.params.id);
            logger.info(`Paciente eliminado: ${req.params.id}`);
            res.json({ success: true, data: { message: 'Paciente eliminado' } });
        } catch (error) { next(error); }
    }
}
