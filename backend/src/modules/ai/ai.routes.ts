// ─── AI Routes ────────────────────────────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AIController } from './ai.controller.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IA_CTRL_FILE = path.join(__dirname, '../../../../data/ia-control.json');
const PAUSE_MINUTES = 5;

function readCtrl(): Record<string, any> {
    if (!fs.existsSync(IA_CTRL_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(IA_CTRL_FILE, 'utf8')); }
    catch { return {}; }
}
function writeCtrl(data: Record<string, any>) {
    const dir = path.dirname(IA_CTRL_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(IA_CTRL_FILE, JSON.stringify(data, null, 2), 'utf8');
}

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

// ── F-004 FIX: IA Control persistente (antes solo en memoria del frontend) ────
// GET /api/ai/ia-control/:conversationId
router.get('/ia-control/:conversationId', (req: Request, res: Response) => {
    const key = req.params.conversationId;
    const ctrl = readCtrl();
    const s = ctrl[key];
    if (!s) {
        res.json({ success: true, data: { iaActive: true, pausedAt: null, autoResumeAt: null, minutesLeft: null } });
        return;
    }
    let { iaActive, pausedAt, autoResumeAt } = s;
    let minutesLeft: number | null = null;
    if (!iaActive && autoResumeAt) {
        const resumeTime = new Date(autoResumeAt).getTime();
        if (resumeTime <= Date.now()) {
            ctrl[key] = { iaActive: true, pausedAt: null, autoResumeAt: null };
            writeCtrl(ctrl);
            iaActive = true;
        } else {
            minutesLeft = Math.ceil((resumeTime - Date.now()) / 60000);
        }
    }
    res.json({ success: true, data: { iaActive, pausedAt: pausedAt ?? null, autoResumeAt: autoResumeAt ?? null, minutesLeft } });
});

// POST /api/ai/ia-control/:conversationId/pause
router.post('/ia-control/:conversationId/pause', (req: Request, res: Response, next: NextFunction) => {
    try {
        const key = req.params.conversationId;
        const now = new Date();
        const autoResumeAt = new Date(now.getTime() + PAUSE_MINUTES * 60 * 1000).toISOString();
        const ctrl = readCtrl();
        ctrl[key] = { iaActive: false, pausedAt: now.toISOString(), autoResumeAt };
        writeCtrl(ctrl);
        res.json({ success: true, data: ctrl[key] });
    } catch (err) { next(err); }
});

// POST /api/ai/ia-control/:conversationId/resume
router.post('/ia-control/:conversationId/resume', (_req: Request, res: Response, next: NextFunction) => {
    try {
        const key = _req.params.conversationId;
        const ctrl = readCtrl();
        ctrl[key] = { iaActive: true, pausedAt: null, autoResumeAt: null };
        writeCtrl(ctrl);
        res.json({ success: true, data: ctrl[key] });
    } catch (err) { next(err); }
});

export default router;
