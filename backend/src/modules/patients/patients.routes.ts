import { Router } from 'express';
import { PatientsController } from './patients.controller.js';
import { optionalAuth } from '../../middleware/auth.js';

const router = Router();

// V-005: se usa optionalAuth hasta que el frontend implemente login obligatorio.
// Cuando exista flujo de login completo, cambiar a: router.use(authenticate)
router.use(optionalAuth);

router.get('/', PatientsController.list);
router.get('/:id', PatientsController.getById);
router.post('/', PatientsController.create);
router.put('/:id', PatientsController.update);
router.delete('/:id', PatientsController.remove);

export default router;
