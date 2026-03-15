import prisma from '../../../db.js';
import { logger } from '../../../config/logger.js';

export class CatalogsService {
    static async getSpecialties() {
        try {
            const raw = await prisma.$queryRaw`SELECT "IdEspec", "Especialidad" FROM "TEspecOMC" ORDER BY "Especialidad"`;
            if (Array.isArray(raw) && raw.length > 0) return raw;
        } catch (e) { logger.error(e); }
        return [
            { IdEspec: 1, Especialidad: 'Odontología General' },
            { IdEspec: 2, Especialidad: 'Ortodoncia' },
            { IdEspec: 3, Especialidad: 'Implantología' }
        ];
    }
    
    static async getTaxes() {
        try {
            const raw = await prisma.tTipoIVA.findMany({ select: { IdTipoIVA: true, Descripcio: true, PjeIVA: true, PjeRecargo: true, PjeRetencion: true }});
            if (raw.length > 0) return raw.map(r => ({ ...r, label: `${r.Descripcio} (${r.PjeIVA}%)` }));
        } catch (e) { logger.error(e); }
        return [
            { IdTipoIVA: 1, label: 'Exento (0%)', PjeIVA: 0 },
            { IdTipoIVA: 2, label: 'General (21%)', PjeIVA: 21 },
            { IdTipoIVA: 3, label: 'Reducido (10%)', PjeIVA: 10 }
        ];
    }
}
