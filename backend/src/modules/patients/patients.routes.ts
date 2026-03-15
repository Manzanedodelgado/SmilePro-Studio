import { Router } from 'express';
import { PatientsController } from './patients.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// FIX V-005: Auth aplicada en todas las rutas de pacientes.
// GET (lectura) → optionalAuth no aplica aquí — se exige token completo.
// Cualquier rol autenticado puede leer pacientes.
// Solo roles con permisos de escritura pueden crear/editar/borrar.
router.get('/', authenticate, PatientsController.list);
router.get('/:id', authenticate, PatientsController.getById);
router.post('/', authenticate, PatientsController.create);
router.put('/:id', authenticate, PatientsController.update);
router.delete('/:id', authenticate, PatientsController.remove);

export default router;
