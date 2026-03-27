import { Router } from 'express';
import { PatientsController } from './patients.controller.js';
import { optionalAuth } from '../../middleware/auth.js';
import prisma from '../../config/database.js';
import { logger } from '../../config/logger.js';

const router = Router();

// V-005: se usa optionalAuth hasta que el frontend implemente login obligatorio.
router.use(optionalAuth);

router.get('/', PatientsController.list);
router.get('/:id', PatientsController.getById);
router.post('/', PatientsController.create);
router.put('/:id', PatientsController.update);
router.delete('/:id', PatientsController.remove);

// ── MEDICACIONES ─────────────────────────────────────────────────────────────
router.get('/:numPac/medications', async (req, res) => {
    try {
        const meds = await prisma.patientMedication.findMany({
            where: { numPac: req.params.numPac },
            orderBy: [{ importante: 'desc' }, { nombre: 'asc' }],
        });
        res.json({ success: true, data: meds });
    } catch (e: any) {
        logger.error('[MEDICATIONS] GET error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/:numPac/medications', async (req, res) => {
    try {
        const med = await prisma.patientMedication.create({
            data: { numPac: req.params.numPac, ...req.body },
        });
        res.status(201).json({ success: true, data: med });
    } catch (e: any) {
        logger.error('[MEDICATIONS] POST error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.patch('/:numPac/medications/:id', async (req, res) => {
    try {
        const med = await prisma.patientMedication.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json({ success: true, data: med });
    } catch (e: any) {
        logger.error('[MEDICATIONS] PATCH error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:numPac/medications/:id', async (req, res) => {
    try {
        await prisma.patientMedication.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        logger.error('[MEDICATIONS] DELETE error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── ALERGIAS ──────────────────────────────────────────────────────────────────
router.get('/:numPac/allergies', async (req, res) => {
    try {
        const allergies = await prisma.patientAllergy.findMany({
            where: { numPac: req.params.numPac },
            orderBy: { severidad: 'asc' },
        });
        res.json({ success: true, data: allergies });
    } catch (e: any) {
        logger.error('[ALLERGIES] GET error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/:numPac/allergies', async (req, res) => {
    try {
        const allergy = await prisma.patientAllergy.create({
            data: { numPac: req.params.numPac, ...req.body },
        });
        res.status(201).json({ success: true, data: allergy });
    } catch (e: any) {
        logger.error('[ALLERGIES] POST error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:numPac/allergies/:id', async (req, res) => {
    try {
        await prisma.patientAllergy.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e: any) {
        logger.error('[ALLERGIES] DELETE error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;

