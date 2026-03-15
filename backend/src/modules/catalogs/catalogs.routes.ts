import { Router } from 'express';
import { CatalogsController } from './catalogs.controller';

const router = Router();
router.get('/specialties', CatalogsController.getSpecialties);
router.get('/taxes', CatalogsController.getTaxes);
export default router;
