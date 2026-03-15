// ─── Questionnaires Routes — F-002 Fix ──────────────────────────────────────
// Tokens y respuestas de cuestionarios pre-primera-visita.
// Persisten en disco (questionnaires.json) al igual que leads.
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { logger } from '../../config/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../../../../data/questionnaires.json');

function ensureFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}
function readAll(): any[] {
    ensureFile();
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { return []; }
}
function writeAll(data: any[]) {
    ensureFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const router = Router();

// ── Rutas públicas (sin auth) — necesarias para el formulario público ────────
// GET /api/clinical/questionnaires/token/:token — validar token
router.get('/token/:token', (req: Request, res: Response) => {
    const record = readAll().find((r: any) => r.token === req.params.token);
    if (!record) { res.status(404).json({ success: false, error: { message: 'Token no válido o expirado' } }); return; }
    if (new Date(record.expires_at) < new Date()) {
        res.status(410).json({ success: false, error: { message: 'Token expirado' } }); return;
    }
    res.json({ success: true, data: record });
});

// POST /api/clinical/questionnaires/token/:token/submit — guardar respuestas
router.post('/token/:token/submit', (req: Request, res: Response, next: NextFunction) => {
    try {
        const records = readAll();
        const idx = records.findIndex((r: any) => r.token === req.params.token);
        if (idx === -1) { res.status(404).json({ success: false, error: { message: 'Token no válido' } }); return; }
        if (new Date(records[idx].expires_at) < new Date()) {
            res.status(410).json({ success: false, error: { message: 'Token expirado' } }); return;
        }
        records[idx] = { ...records[idx], estado: 'completado', completado_at: new Date().toISOString(), data: req.body };
        writeAll(records);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// ── Rutas privadas (requieren auth) ─────────────────────────────────────────
router.use(authenticate);

// POST /api/clinical/questionnaires — crear token
router.post('/', (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entityId, entityType = 'paciente', fechaCita } = req.body;
        if (!entityId || !fechaCita) {
            res.status(400).json({ success: false, error: { message: 'entityId y fechaCita son obligatorios' } });
            return;
        }
        const token = crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(new Date(fechaCita).getTime() + 60 * 60 * 1000).toISOString();
        const record = {
            id: crypto.randomUUID(),
            token,
            [entityType === 'contacto' ? 'contacto_id' : 'num_pac']: entityId,
            estado: 'pendiente',
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
        };
        const records = readAll();
        records.push(record);
        writeAll(records);
        const base = process.env.APP_URL ?? 'https://gestion.rubiogarciadental.com';
        res.status(201).json({ success: true, data: { ...record, url: `${base}/cuestionario?token=${token}` } });
    } catch (err) { next(err); }
});

// GET /api/clinical/questionnaires/paciente/:numPac — cuestionario completado del paciente
router.get('/paciente/:numPac', (req: Request, res: Response) => {
    const record = readAll().find((r: any) => r.num_pac === req.params.numPac && r.estado === 'completado');
    if (!record) { res.status(404).json({ success: false, error: { message: 'No hay cuestionario completado para este paciente' } }); return; }
    res.json({ success: true, data: record });
});

export default router;
