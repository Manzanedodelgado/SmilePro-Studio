// ─── Clinical Routes ──────────────────────────────────────
import { Router } from 'express';
import { ClinicalController } from './clinical.controller.js';

const router = Router();

// Entradas médicas reales (TtosMed GELITE)
router.get('/patients/:patientId/entradas', ClinicalController.getEntradasMedicas);
router.get('/patients/:patientId/history', ClinicalController.getHistory);
router.post('/records', ClinicalController.createRecord);
router.delete('/records/:id', ClinicalController.deleteRecord);
router.get('/patients/:patientId/odontogram', ClinicalController.getOdontogram);
router.put('/odontogram', ClinicalController.updateOdontogram);

export default router;
