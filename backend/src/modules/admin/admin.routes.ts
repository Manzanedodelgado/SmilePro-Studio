// ─── Admin Routes ───────────────────────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(__dirname, '../../../../data/settings.json');

function readSettings(): any {
    if (!fs.existsSync(SETTINGS_FILE)) return { clinicName: 'Rubio García Dental', theme: 'default' };
    try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); }
    catch { return { clinicName: 'Rubio García Dental', theme: 'default' }; }
}
function writeSettings(s: any) {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
}

const router = Router();
router.use(authenticate);

// Gestión de usuarios
router.get('/users', requirePermission('admin:read'), (_req, res) => {
    res.json({ success: true, data: [], message: 'TODO: Listar usuarios' });
});
router.post('/users', requirePermission('admin:write'), (_req, res) => {
    res.status(201).json({ success: true, message: 'TODO: Crear usuario' });
});
router.put('/users/:id', requirePermission('admin:write'), (req, res) => {
    res.json({ success: true, message: `TODO: Actualizar usuario ${req.params.id}` });
});

// Gestión de gabinetes
router.get('/operatories', requirePermission('admin:read'), (_req, res) => {
    res.json({ success: true, data: [], message: 'TODO: Listar gabinetes' });
});
router.post('/operatories', requirePermission('admin:write'), (_req, res) => {
    res.status(201).json({ success: true, message: 'TODO: Crear gabinete' });
});

// F-003 FIX: Configuración de agenda — persiste en data/settings.json
router.get('/settings', requirePermission('admin:read'), (_req: Request, res: Response) => {
    res.json({ success: true, data: readSettings() });
});

router.put('/settings', requirePermission('admin:write'), (req: Request, res: Response, next: NextFunction) => {
    try {
        const current = readSettings();
        const updated = { ...current, ...req.body, updatedAt: new Date().toISOString() };
        writeSettings(updated);
        res.json({ success: true, data: updated });
    } catch (err) { next(err); }
});

// Audit logs
router.get('/audit', requirePermission('admin:read'), (_req, res) => {
    res.json({ success: true, data: [], message: 'TODO: Listar audit logs' });
});

export default router;
