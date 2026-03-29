// ─── Treatments Routes (Scaffold) ───────────────────────
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { TreatmentsController } from './treatments.controller';
import { createTreatmentSchema, updateTreatmentSchema } from './treatments.schemas';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('treatments:read'), TreatmentsController.list);
router.get('/:id', requirePermission('treatments:read'), TreatmentsController.getById);
router.post('/', requirePermission('treatments:write'), validate(createTreatmentSchema), TreatmentsController.create);
router.put('/:id', requirePermission('treatments:write'), validate(updateTreatmentSchema), TreatmentsController.update);
router.delete('/:id', requirePermission('treatments:write'), TreatmentsController.remove);

export default router;
