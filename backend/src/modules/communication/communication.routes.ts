// ─── Communication Routes — Evolution API + Chatwoot ─────
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { CommunicationController } from './communication.controller';

const router = Router();

// ── Webhook (NO requiere auth — lo llama Evolution API) ──
router.post('/webhook/evolution', CommunicationController.webhookEvolution);

// ── Rutas autenticadas ────────────────────────────────────
router.use(authenticate);

// WhatsApp — estado e instancia
router.get('/whatsapp/status',        requirePermission('communication:read'),  CommunicationController.getStatus);
router.get('/whatsapp/qr',            requirePermission('communication:read'),  CommunicationController.getQR);

// WhatsApp — envío
router.post('/whatsapp/send',         requirePermission('communication:write'), CommunicationController.sendMessage);
router.post('/whatsapp/send-template',requirePermission('communication:write'), CommunicationController.sendTemplate);
router.post('/whatsapp/send-media',   requirePermission('communication:write'), CommunicationController.sendMedia);

// Recordatorios de cita
router.post('/reminders/send',        requirePermission('communication:write'), CommunicationController.sendReminder);

// Ficha paciente por teléfono
router.get('/patient-context/:phone',   requirePermission('communication:read'),  CommunicationController.getPatientContext);

// Presupuesto por WhatsApp
router.post('/whatsapp/send-budget',    requirePermission('communication:write'), CommunicationController.sendBudget);

// Métricas clínicas
router.get('/metrics',                  requirePermission('communication:read'),  CommunicationController.getClinicMetrics);

// Patrones de recordatorio (recordatorios inteligentes)
router.get('/patient-pattern/:phone',          requirePermission('communication:read'),  CommunicationController.getPatientPattern);
router.post('/patient-pattern/:phone/event',   requirePermission('communication:write'), CommunicationController.recordPatientEvent);

// Chatwoot — conversaciones
router.get('/conversations',                    requirePermission('communication:read'),  CommunicationController.getConversations);
router.get('/conversations/:id/messages',       requirePermission('communication:read'),  CommunicationController.getMessages);
router.post('/conversations/:id/messages',      requirePermission('communication:write'), CommunicationController.replyMessage);
router.patch('/conversations/:id/status',       requirePermission('communication:write'), CommunicationController.setConversationStatus);
router.post('/conversations/:id/labels',        requirePermission('communication:write'), CommunicationController.addLabels);
router.post('/conversations/:id/read',          requirePermission('communication:write'), CommunicationController.markRead);
router.delete('/conversations/:id',             requirePermission('communication:write'), CommunicationController.deleteConversation);

export default router;
