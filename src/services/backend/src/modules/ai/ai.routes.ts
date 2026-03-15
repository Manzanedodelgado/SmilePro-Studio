// ─── AI Routes ────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AIController } from './ai.controller.js';

const router = Router();
router.use(authenticate);

// Copiloto clínico
router.post('/copilot/chat',             requirePermission('ai:use'), AIController.copilotChat);
router.post('/copilot/complete-note',    requirePermission('ai:use'), AIController.completeNote);
router.post('/copilot/suggest-treatment',requirePermission('ai:use'), AIController.suggestTreatment);
router.post('/copilot/analyze-image',    requirePermission('ai:use'), AIController.analyzeImage);

// Configuración agente dental
router.get('/config',  requirePermission('ai:use'),    AIController.getConfig);
router.put('/config',  requirePermission('admin:read'), AIController.saveConfig);

// Automatizaciones
router.get('/automations',              requirePermission('ai:use'),    AIController.listAutomations);
router.post('/automations',             requirePermission('admin:read'), AIController.createAutomation);
router.patch('/automations/:id/toggle', requirePermission('admin:read'), AIController.toggleAutomation);

// Insights y conversaciones
router.get('/evolution/insights', requirePermission('admin:read'), AIController.evolutionInsights);
router.get('/conversations',      requirePermission('ai:use'),    AIController.listConversations);

export default router;
