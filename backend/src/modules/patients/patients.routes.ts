import { Router } from 'express';
import { PatientsController } from './patients.controller.js';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { logAudit } from '../../middleware/audit.js';

const router = Router();

// V-005 RESUELTO: autenticación obligatoria activada
router.use(authenticate);

/**
 * @swagger
 * /patients:
 *   get:
 *     summary: Listar pacientes (paginado, búsqueda)
 *     tags: [Patients]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre, apellidos, NIF o teléfono
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista de pacientes con paginación
 */
router.get('/', PatientsController.list);

/**
 * @swagger
 * /patients/{id}:
 *   get:
 *     summary: Obtener paciente por NumPac
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: NumPac del paciente (ej. 00001234)
 *     responses:
 *       200:
 *         description: Datos del paciente
 *       404:
 *         description: Paciente no encontrado
 */
router.get('/:id', PatientsController.getById);

/**
 * @swagger
 * /patients:
 *   post:
 *     summary: Crear nuevo paciente
 *     tags: [Patients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [Nombre, Apellidos, TelMovil]
 *             properties:
 *               Nombre:
 *                 type: string
 *               Apellidos:
 *                 type: string
 *               NIF:
 *                 type: string
 *               TelMovil:
 *                 type: string
 *               Email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Paciente creado (incluido en audit_logs)
 */
router.post('/', PatientsController.create);
router.put('/:id', PatientsController.update);

/**
 * @swagger
 * /patients/{id}:
 *   delete:
 *     summary: Eliminar paciente (hard delete con audit log GDPR)
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paciente eliminado — registro completo en audit_logs
 */
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
        const dataBefore = await prisma.patientMedication.findUnique({ where: { id: req.params.id } });
        await prisma.patientMedication.delete({ where: { id: req.params.id } });
        logAudit({ req, action: 'DELETE', entity: 'patient_medications', entityId: req.params.id, dataBefore });
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
        const dataBefore = await prisma.patientAllergy.findUnique({ where: { id: req.params.id } });
        await prisma.patientAllergy.delete({ where: { id: req.params.id } });
        logAudit({ req, action: 'DELETE', entity: 'patient_allergies', entityId: req.params.id, dataBefore });
        res.json({ success: true });
    } catch (e: any) {
        logger.error('[ALLERGIES] DELETE error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;

