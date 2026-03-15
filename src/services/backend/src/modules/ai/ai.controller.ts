// ─── AI Controller ────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { AIService } from './ai.service.js';
import { logger } from '../../config/logger.js';

export class AIController {

    // ── Copiloto clínico ──────────────────────────────────────────────────────

    /** POST /api/ai/copilot/chat */
    static async copilotChat(req: Request, res: Response, next: NextFunction) {
        try {
            const { prompt, context, patientId } = req.body as {
                prompt: string;
                context?: string;
                patientId?: string;
            };
            if (!prompt?.trim()) {
                res.status(400).json({ success: false, error: { message: 'prompt requerido' } });
                return;
            }
            const result = await AIService.copilotChat(prompt, context, patientId);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    }

    /** POST /api/ai/copilot/complete-note */
    static async completeNote(req: Request, res: Response, next: NextFunction) {
        try {
            const { patientId, partialNote } = req.body as { patientId: string; partialNote: string };
            if (!patientId || !partialNote?.trim()) {
                res.status(400).json({ success: false, error: { message: 'patientId y partialNote requeridos' } });
                return;
            }
            const completedNote = await AIService.completeNote(patientId, partialNote);
            res.json({ success: true, data: { completedNote } });
        } catch (err) { next(err); }
    }

    /** POST /api/ai/copilot/suggest-treatment */
    static async suggestTreatment(req: Request, res: Response, next: NextFunction) {
        try {
            const { patientId, symptoms } = req.body as { patientId: string; symptoms?: string };
            if (!patientId) {
                res.status(400).json({ success: false, error: { message: 'patientId requerido' } });
                return;
            }
            const suggestions = await AIService.suggestTreatment(patientId, symptoms);
            res.json({ success: true, data: { suggestions } });
        } catch (err) { next(err); }
    }

    /** POST /api/ai/copilot/analyze-image */
    static async analyzeImage(req: Request, res: Response, next: NextFunction) {
        try {
            const { imageUrl, analysisType = 'general' } = req.body as {
                imageUrl: string;
                analysisType?: 'radiograph' | 'general';
            };
            if (!imageUrl) {
                res.status(400).json({ success: false, error: { message: 'imageUrl requerida' } });
                return;
            }
            const result = await AIService.analyzeImage(imageUrl, analysisType);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    }

    // ── Configuración agente dental ───────────────────────────────────────────

    /** GET /api/ai/config */
    static async getConfig(_req: Request, res: Response, next: NextFunction) {
        try {
            const cfg = await AIService.getAIConfig();
            res.json({ success: true, data: cfg });
        } catch (err) { next(err); }
    }

    /** PUT /api/ai/config */
    static async saveConfig(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const saved = await AIService.saveAIConfig(data);
            res.json({ success: true, data: saved });
        } catch (err) { next(err); }
    }

    // ── Automatizaciones ──────────────────────────────────────────────────────

    /** GET /api/ai/automations */
    static async listAutomations(_req: Request, res: Response, next: NextFunction) {
        try {
            const data = await AIService.getAutomations();
            res.json({ success: true, data });
        } catch (err) { next(err); }
    }

    /** POST /api/ai/automations */
    static async createAutomation(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await AIService.createAutomation(req.body);
            res.status(201).json({ success: true, data });
        } catch (err) { next(err); }
    }

    /** PATCH /api/ai/automations/:id/toggle */
    static async toggleAutomation(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { enabled } = req.body as { enabled: boolean };
            const data = await AIService.toggleAutomation(id, enabled);
            res.json({ success: true, data });
        } catch (err) { next(err); }
    }

    // ── Autoevolución ─────────────────────────────────────────────────────────

    /** GET /api/ai/evolution/insights */
    static async evolutionInsights(_req: Request, res: Response, next: NextFunction) {
        try {
            const automations = await AIService.getAutomations();
            const total = automations.length;
            const active = automations.filter(a => a.enabled).length;
            const avgSuccess = total > 0
                ? Math.round(automations.reduce((s, a) => s + a.successRate, 0) / total)
                : 0;
            const topPerforming = automations.sort((a, b) => b.successRate - a.successRate).slice(0, 3);

            res.json({
                success: true,
                data: {
                    stats: { total, active, avgSuccess },
                    topPerforming,
                    insights: [
                        active < total ? `${total - active} automatizaciones desactivadas — revisar configuración` : null,
                        avgSuccess < 80 ? 'Tasa de éxito baja — revisar plantillas de mensajes' : null,
                    ].filter(Boolean),
                },
            });
        } catch (err) { next(err); }
    }

    /** GET /api/ai/conversations */
    static async listConversations(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone } = req.query as { phone?: string };
            if (phone) {
                const history = await AIService.getConversationHistory(phone);
                res.json({ success: true, data: history });
            } else {
                res.json({ success: true, data: [] });
            }
        } catch (err) { next(err); }
    }
}
