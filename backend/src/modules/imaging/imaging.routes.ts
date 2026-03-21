// ─── Imaging Routes ──────────────────────────────────────────────────────────
// Gestión de estudios radiológicos por paciente.
// Almacenamiento: JSON en memoria + volcado a disco (uploads/imaging-db.json).
// No requiere migración Prisma. Compatible con cualquier entorno.
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../../../uploads/imaging-db.json');

// ── In-memory store ───────────────────────────────────────────────────────────

interface ImagingStudy {
    id: string;
    num_pac: string;
    tipo: string;
    nombre: string;
    fecha: string;
    doctor: string;
    descripcion: string;
    posicion?: string;
    dicom_meta?: Record<string, unknown>;
    ruta_origen?: string;
    created_at: string;
    updated_at: string;
    // Planning data (measurements) stored as JSON
    measurements?: Array<{
        id: string;
        tool: string;
        points: Array<{ x: number; y: number }>;
        label?: string;
        color: string;
        completed: boolean;
    }>;
}

let _studies: ImagingStudy[] = [];

// Load from disk on startup
function loadFromDisk() {
    try {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (fs.existsSync(DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            _studies = Array.isArray(data) ? data : [];
        }
    } catch {
        _studies = [];
    }
}

function saveToDisk() {
    try {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify(_studies, null, 2));
    } catch (err) {
        console.error('[imaging] Error saving to disk:', err);
    }
}

loadFromDisk();

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();
router.use(authenticate);

// GET /api/imaging/patients/:patientId — listar estudios de un paciente
router.get('/patients/:patientId', (req: Request, res: Response) => {
    const { patientId } = req.params;
    const studies = _studies.filter(s => s.num_pac === patientId);
    res.json({ success: true, data: studies });
});

// POST /api/imaging/studies — crear estudio (metadata sin archivo)
router.post('/studies', (req: Request, res: Response) => {
    const body = req.body as Partial<ImagingStudy>;
    if (!body.num_pac || !body.tipo) {
        return res.status(400).json({ success: false, error: { message: 'num_pac y tipo son requeridos' } });
    }
    const study: ImagingStudy = {
        id: body.id ?? `study-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        num_pac: body.num_pac,
        tipo: body.tipo,
        nombre: body.nombre ?? body.tipo,
        fecha: body.fecha ?? new Date().toISOString(),
        doctor: body.doctor ?? '',
        descripcion: body.descripcion ?? '',
        posicion: body.posicion,
        dicom_meta: body.dicom_meta,
        ruta_origen: body.ruta_origen,
        measurements: body.measurements ?? [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    _studies.push(study);
    saveToDisk();
    res.status(201).json({ success: true, data: study });
});

// PUT /api/imaging/studies/:id — actualizar (incluye measurements)
router.put('/studies/:id', (req: Request, res: Response) => {
    const idx = _studies.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Estudio no encontrado' } });
    _studies[idx] = {
        ..._studies[idx],
        ...req.body,
        id: req.params.id,
        updated_at: new Date().toISOString(),
    };
    saveToDisk();
    res.json({ success: true, data: _studies[idx] });
});

// DELETE /api/imaging/studies/:id
router.delete('/studies/:id', (req: Request, res: Response) => {
    const before = _studies.length;
    _studies = _studies.filter(s => s.id !== req.params.id);
    if (_studies.length === before) {
        return res.status(404).json({ success: false, error: { message: 'Estudio no encontrado' } });
    }
    saveToDisk();
    res.json({ success: true, data: { id: req.params.id } });
});

// GET /api/imaging/studies/:id
router.get('/studies/:id', (req: Request, res: Response) => {
    const study = _studies.find(s => s.id === req.params.id);
    if (!study) return res.status(404).json({ success: false, error: { message: 'Estudio no encontrado' } });
    res.json({ success: true, data: study });
});

export default router;
