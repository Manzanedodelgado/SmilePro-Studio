// ─────────────────────────────────────────────────────────────────────
//  backend/src/modules/gdrive/gdrive.routes.ts
//  Rutas de la API de GDrive:
//
//  POST /api/gdrive/patient-folder   → crea carpeta para 1 paciente
//  POST /api/gdrive/bulk-create      → crea carpetas para todos los pacientes (paginado)
//  GET  /api/gdrive/photos/:numPac   → lista fotos de un paciente
// ─────────────────────────────────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { createPatientFolder, getPatientPhotos } from './gdrive.service.js';
import { logger } from '../../config/logger.js';
import prisma from '../../config/database.js';

const router = Router();
router.use(authenticate);

// ── POST /api/gdrive/patient-folder ───────────────────────────────────
// Body: { numPac, apellidos, nombre, userToken? }
router.post('/patient-folder', async (req: Request, res: Response, next: NextFunction) => {
    const { numPac, apellidos, nombre, userToken } = req.body as {
        numPac: string; apellidos: string; nombre: string; userToken?: string;
    };

    if (!numPac || !apellidos || !nombre) {
        res.status(400).json({ success: false, error: { message: 'numPac, apellidos y nombre son obligatorios' } });
        return;
    }

    try {
        const folder = await createPatientFolder(numPac, apellidos.trim(), nombre.trim(), userToken);
        if (!folder) {
            res.status(500).json({ success: false, error: { message: 'No se pudo crear la carpeta en Google Drive' } });
            return;
        }
        res.json({ success: true, data: folder });
    } catch (err) {
        next(err);
    }
});

// ── POST /api/gdrive/bulk-create ──────────────────────────────────────
// Crea carpetas para TODOS los pacientes que no tienen carpeta.
// Usa paginación interna para no agotar memoria.
// Body: { userToken?, dryRun? }
// devuelve { created, skipped, errors, total }
router.post('/bulk-create', async (req: Request, res: Response, next: NextFunction) => {
    const { userToken, dryRun = false } = req.body as { userToken?: string; dryRun?: boolean };

    try {
        // Obtener todos los pacientes de GELITE (en lotes de 200)
        let page = 1;
        const limit = 200;
        let hasMore = true;
        let created = 0;
        let skipped = 0;
        let errors = 0;
        let total = 0;

        logger.info(`[GDrive Bulk] Iniciando creación masiva de carpetas (dryRun=${dryRun})`);

        while (hasMore) {
            const patients = await prisma.pacientes.findMany({
                select: { NumPac: true, Apellidos: true, Nombre: true },
                orderBy: { NumPac: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }).catch(() => []);

            if (patients.length === 0) { hasMore = false; break; }
            total += patients.length;
            page++;

            for (const p of patients) {
                if (!p.NumPac || !p.Apellidos) { skipped++; continue; }

                if (dryRun) {
                    created++;
                    continue;
                }

                const result = await createPatientFolder(
                    p.NumPac,
                    p.Apellidos ?? '',
                    p.Nombre ?? '',
                    userToken
                );

                if (result) {
                    created++;
                } else {
                    errors++;
                }

                // Pausa de 50ms entre llamadas para no superar el rate limit de Drive API (300 req/min)
                await new Promise(r => setTimeout(r, 50));
            }

            if (patients.length < limit) hasMore = false;
        }

        logger.info(`[GDrive Bulk] Completado: ${created} creadas, ${skipped} saltadas, ${errors} errores / ${total} total`);
        res.json({
            success: true,
            data: { created, skipped, errors, total, dryRun },
        });
    } catch (err) {
        next(err);
    }
});

// ── GET /api/gdrive/photos/:numPac ────────────────────────────────────
// Query: apellidos, nombre, userToken (opcional via header x-gdrive-token)
router.get('/photos/:numPac', async (req: Request, res: Response, next: NextFunction) => {
    const { numPac } = req.params;
    const { apellidos = '', nombre = '' } = req.query as { apellidos?: string; nombre?: string };
    const userToken = req.headers['x-gdrive-token'] as string | undefined;

    try {
        const photos = await getPatientPhotos(numPac, apellidos, nombre, userToken);
        res.json({ success: true, data: photos });
    } catch (err) {
        next(err);
    }
});

export default router;
