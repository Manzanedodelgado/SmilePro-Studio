// ─── Appointments Routes ────────────────────────────────
import { Router } from 'express';
import { AppointmentsController } from './appointments.controller';

const router = Router();

// Lectura — sin auth temporalmente (tabla User no migrada aún)
router.get('/config', AppointmentsController.config);
router.get('/latest-date', AppointmentsController.latestDate);
router.get('/', AppointmentsController.list);
router.get('/:id', AppointmentsController.getById);

// Escritura — DCitas es read-only (GELITE)
router.post('/', AppointmentsController.create);
router.put('/:id', AppointmentsController.update);
router.patch('/:id/cancel', AppointmentsController.cancel);

export default router;
