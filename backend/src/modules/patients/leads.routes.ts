// ─── Leads Routes — F-001 Fix ───────────────────────────────────────────────
// Contactos / leads de primera visita. Antes estaban en memoria en el frontend.
// Ahora persisten en la tabla JSON auxiliar en disco (leads.json) ya que
// la BD GELITE no tiene tabla TContacto. Alternativa limpia sin alterar schema.
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { logger } from '../../config/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '../../../../data/leads.json');

// Asegurar que el fichero existe
function ensureFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readLeads(): any[] {
    ensureFile();
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { return []; }
}

function writeLeads(leads: any[]) {
    ensureFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

const router = Router();
router.use(authenticate);

// GET /api/patients/leads — listado de leads activos
router.get('/', (_req: Request, res: Response) => {
    try {
        const leads = readLeads().filter((c: any) => c.estado !== 'convertido' && c.estado !== 'cancelado');
        res.json({ success: true, data: leads });
    } catch (err) {
        logger.error('[Leads] GET error:', err);
        res.status(500).json({ success: false, error: { message: 'Error leyendo leads' } });
    }
});

// GET /api/patients/leads/all — todos (incluyendo convertidos)
router.get('/all', (_req: Request, res: Response) => {
    res.json({ success: true, data: readLeads() });
});

// GET /api/patients/leads/:id
router.get('/:id', (req: Request, res: Response) => {
    const lead = readLeads().find((c: any) => c.id === req.params.id);
    if (!lead) { res.status(404).json({ success: false, error: { message: 'Lead no encontrado' } }); return; }
    res.json({ success: true, data: lead });
});

// POST /api/patients/leads — crear lead
router.post('/', (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;
        if (!data.nombre?.trim() || !data.telefono?.trim()) {
            res.status(400).json({ success: false, error: { message: 'nombre y telefono son obligatorios' } });
            return;
        }
        const lead = {
            id: crypto.randomUUID(),
            nombre: data.nombre,
            apellidos: data.apellidos,
            telefono: data.telefono,
            email: data.email,
            estado: data.estado ?? 'potencial',
            origen: data.origen ?? 'primera_visita',
            canal: data.canalEntrada ?? data.canal ?? 'recepcion',
            numPac: data.numPac ?? null,
            citaId: data.citaId ?? null,
            motivoConsulta: data.motivoConsulta ?? null,
            notas: data.notas ?? null,
            esMenor: data.esMenor ?? false,
            nombreTutor: data.nombreTutor ?? null,
            apellidosTutor: data.apellidosTutor ?? null,
            telefonoTutor: data.telefonoTutor ?? null,
            emailTutor: data.emailTutor ?? null,
            relacionTutor: data.relacionTutor ?? null,
            doctorAsignado: data.doctorAsignado ?? null,
            tratamientoAdicional: data.tratamientoAdicional ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: null,
        };
        const leads = readLeads();
        leads.push(lead);
        writeLeads(leads);
        res.status(201).json({ success: true, data: lead });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/patients/leads/:id/estado
router.patch('/:id/estado', (req: Request, res: Response, next: NextFunction) => {
    try {
        const leads = readLeads();
        const idx = leads.findIndex((c: any) => c.id === req.params.id);
        if (idx === -1) { res.status(404).json({ success: false, error: { message: 'Lead no encontrado' } }); return; }
        leads[idx] = { ...leads[idx], estado: req.body.estado, updatedAt: new Date().toISOString() };
        writeLeads(leads);
        res.json({ success: true, data: leads[idx] });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/patients/leads/:id/convertir
router.patch('/:id/convertir', (req: Request, res: Response, next: NextFunction) => {
    try {
        const leads = readLeads();
        const idx = leads.findIndex((c: any) => c.id === req.params.id);
        if (idx === -1) { res.status(404).json({ success: false, error: { message: 'Lead no encontrado' } }); return; }
        leads[idx] = { ...leads[idx], estado: 'convertido', numPac: req.body.numPac, updatedAt: new Date().toISOString() };
        writeLeads(leads);
        res.json({ success: true, data: leads[idx] });
    } catch (err) {
        next(err);
    }
});

export default router;
