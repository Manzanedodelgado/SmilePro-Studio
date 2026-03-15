// ─── Clinical Routes ──────────────────────────────────────
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { ClinicalController } from './clinical.controller.js';

const router = Router();
router.use(authenticate);

// Historia clínica completa (records + odontogram)
router.get('/patients/:patientId/history', requirePermission('clinical:read'), ClinicalController.getHistory);

// Entradas médicas (clinical records)
router.post('/records', requirePermission('clinical:write'), ClinicalController.createRecord);
router.delete('/records/:id', requirePermission('clinical:write'), ClinicalController.deleteRecord);

// Odontograma
router.get('/patients/:patientId/odontogram', requirePermission('clinical:read'), ClinicalController.getOdontogram);
router.put('/odontogram', requirePermission('clinical:write'), ClinicalController.updateOdontogram);

export default router;
