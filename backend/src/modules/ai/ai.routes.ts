// ─── AI Routes ────────────────────────────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AIController } from './ai.controller.js';
import { prisma } from '../../db.js';

const PAUSE_MINUTES = 5;

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

// Streaming SSE
router.post('/chat/stream', requirePermission('ai:use'), AIController.chatStream);

// Historial simulador
router.post('/conversations/save',              requirePermission('ai:use'), AIController.saveConversationMessage);
router.get('/conversations/history/:sessionId', requirePermission('ai:use'), AIController.getSimulatorHistory);

// Métricas de uso
router.get('/metrics', requirePermission('ai:use'), AIController.getMetrics);

// Insights y conversaciones
router.get('/evolution/insights', requirePermission('admin:read'), AIController.evolutionInsights);
router.get('/conversations',      requirePermission('ai:use'),    AIController.listConversations);

// ── IA Control persistente en PostgreSQL ──────────────────────────────────────
// GET /api/ai/ia-control/:conversationId
router.get('/ia-control/:conversationId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const key = req.params.conversationId;
        const rows = await prisma.$queryRaw<any[]>`
            SELECT is_paused, paused_until FROM ia_control WHERE conversation_id = ${key}
        `;
        if (!rows.length) {
            res.json({ success: true, data: { iaActive: true, pausedAt: null, autoResumeAt: null, minutesLeft: null } });
            return;
        }
        const { is_paused, paused_until } = rows[0];
        let iaActive = !is_paused;
        let minutesLeft: number | null = null;
        if (!iaActive && paused_until) {
            const resumeTime = new Date(paused_until).getTime();
            if (resumeTime <= Date.now()) {
                await prisma.$executeRaw`
                    UPDATE ia_control SET is_paused = false, paused_until = NULL, updated_at = now()
                    WHERE conversation_id = ${key}
                `;
                iaActive = true;
            } else {
                minutesLeft = Math.ceil((resumeTime - Date.now()) / 60000);
            }
        }
        res.json({ success: true, data: { iaActive, pausedAt: is_paused ? paused_until : null, autoResumeAt: paused_until ?? null, minutesLeft } });
    } catch (err) { next(err); }
});

// POST /api/ai/ia-control/:conversationId/pause
router.post('/ia-control/:conversationId/pause', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const key = req.params.conversationId;
        const pausedAt = new Date();
        const autoResumeAt = new Date(pausedAt.getTime() + PAUSE_MINUTES * 60 * 1000);
        await prisma.$executeRaw`
            INSERT INTO ia_control (conversation_id, is_paused, paused_until, updated_at)
            VALUES (${key}, true, ${autoResumeAt}, now())
            ON CONFLICT (conversation_id) DO UPDATE
            SET is_paused = true, paused_until = ${autoResumeAt}, updated_at = now()
        `;
        res.json({ success: true, data: { iaActive: false, pausedAt: pausedAt.toISOString(), autoResumeAt: autoResumeAt.toISOString() } });
    } catch (err) { next(err); }
});

// POST /api/ai/ia-control/:conversationId/resume
router.post('/ia-control/:conversationId/resume', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const key = _req.params.conversationId;
        await prisma.$executeRaw`
            INSERT INTO ia_control (conversation_id, is_paused, paused_until, updated_at)
            VALUES (${key}, false, NULL, now())
            ON CONFLICT (conversation_id) DO UPDATE
            SET is_paused = false, paused_until = NULL, updated_at = now()
        `;
        res.json({ success: true, data: { iaActive: true, pausedAt: null, autoResumeAt: null } });
    } catch (err) { next(err); }
});

export default router;
