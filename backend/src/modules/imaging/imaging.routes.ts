// ─── Imaging Routes (Scaffold) ──────────────────────────
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);

// Listado de imágenes de un paciente
router.get('/patients/:patientId', requirePermission('imaging:read'), (_req, res) => {
    res.json({ success: true, data: [], message: 'TODO: Listar imágenes del paciente' });
});

// Subir imagen (DICOM, foto intraoral, panorámica)
router.post('/upload', requirePermission('imaging:write'), (_req, res) => {
    // TODO: Multer + subida a Cloudflare R2
    res.status(201).json({ success: true, data: null, message: 'TODO: Upload a Cloudflare R2' });
});

// Obtener imagen por ID
router.get('/:id', requirePermission('imaging:read'), (req, res) => {
    res.json({ success: true, data: null, message: `TODO: Obtener imagen ${req.params.id}` });
});

// Eliminar imagen
router.delete('/:id', requirePermission('imaging:write'), (req, res) => {
    res.json({ success: true, data: null, message: `TODO: Eliminar imagen ${req.params.id}` });
});

export default router;
