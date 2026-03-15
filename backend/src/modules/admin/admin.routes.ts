// ─── Admin Routes (Scaffold) ────────────────────────────
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

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

// Configuración de la clínica
router.get('/settings', requirePermission('admin:read'), (_req, res) => {
    // TODO: Leer de tabla clinic_settings
    res.json({ success: true, data: { clinicName: 'Rubio García Dental', theme: 'default' } });
});

router.put('/settings', requirePermission('admin:write'), (_req, res) => {
    res.json({ success: true, message: 'TODO: Actualizar configuración' });
});

// Audit logs
router.get('/audit', requirePermission('admin:read'), (_req, res) => {
    res.json({ success: true, data: [], message: 'TODO: Listar audit logs' });
});

export default router;
