// ─── Clinical Routes ──────────────────────────────────
import { Router } from 'express';
import { ClinicalController } from './clinical.controller.js';

const router = Router();

// ── Entradas médicas GELITE (TtosMed) ──────────────────────────────────
router.get('/patients/:patientId/entradas', ClinicalController.getEntradasMedicas);
router.put('/patients/:patientId/entradas/:entradaId', ClinicalController.updateEntradaMedica);

// ── Historia clínica combinada (SOAP + TtosMed) ─────────────────────────
router.get('/patients/:patientId/history', ClinicalController.getHistory);

// ── Notas SOAP propias SmilePro (clinical_records) ──────────────────────
router.get('/patients/:patientId/soap', ClinicalController.getSoapNotes);
router.post('/records', ClinicalController.createRecord);
router.patch('/records/:id', ClinicalController.updateRecord);
router.delete('/records/:id', ClinicalController.deleteRecord);

// ── Odontograma (odontogram_state) ──────────────────────────────────────
router.get('/patients/:patientId/odontogram', ClinicalController.getOdontogram);
router.put('/odontogram', ClinicalController.updateOdontogram);

export default router;
