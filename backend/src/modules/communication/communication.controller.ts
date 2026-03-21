// ─── Communication Controller ────────────────────────────────────────────────
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { EvolutionService, ChatwootService, isEvolutionConfigured, isChatwootConfigured } from './communication.service';
import { AIService } from '../ai/ai.service';
import { logger } from '../../config/logger.js';
import { config } from '../../config/index.js';
import { emitWA } from '../../config/socket.js';
import prisma from '../../config/database.js';
import { getPattern, recordEvent, getAllPatterns } from './reminder-patterns.js';

// ── Urgency keywords (ES) ──────────────────────────────────────────────────────
const URGENCY_KEYWORDS = [
    'urgencia', 'urgente', 'dolor', 'emergencia', 'infección', 'hinchazón',
    'sangrado', 'accidente', 'fractura', 'roto', 'perdido el diente',
    'absceso', 'fiebre', 'cita urgente', 'ayuda', 'diente roto',
];

// ── HMAC signature helper ─────────────────────────────────────────────────────
const verifyEvolutionSignature = (rawBody: string, header: string | undefined, secret: string): boolean => {
    if (!header) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
    } catch {
        return false;
    }
};

export class CommunicationController {

    // ── WhatsApp / Evolution ──────────────────────────────

    /** GET /api/communication/whatsapp/status */
    static async getStatus(_req: Request, res: Response, next: NextFunction) {
        try {
            const status = await EvolutionService.getInstanceStatus();
            res.json({
                success: true,
                data: {
                    evolution: isEvolutionConfigured(),
                    chatwoot: isChatwootConfigured(),
                    instance: status,
                },
            });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/communication/whatsapp/qr */
    static async getQR(_req: Request, res: Response, next: NextFunction) {
        try {
            if (!isEvolutionConfigured()) {
                res.status(503).json({ success: false, error: { message: 'Evolution API no configurada' } });
                return;
            }
            const qr = await EvolutionService.getQRCode();
            if (!qr) {
                res.status(404).json({ success: false, error: { message: 'QR no disponible (instancia ya conectada o error)' } });
                return;
            }
            res.json({ success: true, data: { qrcode: qr } });
        } catch (err) {
            next(err);
        }
    }

    /** POST /api/communication/whatsapp/send */
    static async sendMessage(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, text } = req.body as { phone: string; text: string };
            const ok = await EvolutionService.sendText(phone, text);
            if (!ok) {
                res.status(502).json({ success: false, error: { message: 'Error enviando mensaje vía Evolution API' } });
                return;
            }
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    /** POST /api/communication/whatsapp/send-template */
    static async sendTemplate(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, templateName, variables = [] } = req.body as {
                phone: string;
                templateName: string;
                variables?: string[];
            };
            const ok = await EvolutionService.sendTemplate(phone, templateName, variables);
            if (!ok) {
                res.status(502).json({ success: false, error: { message: 'Error enviando plantilla' } });
                return;
            }
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    /** POST /api/communication/whatsapp/send-media */
    static async sendMedia(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, mediaUrl, caption, type = 'document' } = req.body as {
                phone: string;
                mediaUrl: string;
                caption?: string;
                type?: 'image' | 'document';
            };
            const ok = await EvolutionService.sendMedia(phone, mediaUrl, caption, type);
            if (!ok) {
                res.status(502).json({ success: false, error: { message: 'Error enviando media' } });
                return;
            }
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    // ── Recordatorios de cita ─────────────────────────────

    /** POST /api/communication/reminders/send */
    static async sendReminder(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, patientName, date, time, doctor } = req.body as {
                phone: string;
                patientName: string;
                date: string;
                time: string;
                doctor?: string;
            };

            const text = [
                `Hola ${patientName}, le recordamos su cita el día *${date}* a las *${time}*`,
                doctor ? `con ${doctor}` : '',
                'en Rubio García Dental. Si necesita cancelar o cambiar la cita, contáctenos. ¡Hasta pronto! 😊',
            ].filter(Boolean).join(' ');

            const ok = await EvolutionService.sendText(phone, text);
            if (!ok) {
                res.status(502).json({ success: false, error: { message: 'Error enviando recordatorio' } });
                return;
            }
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    // ── Chatwoot ──────────────────────────────────────────

    /** GET /api/communication/conversations */
    static async getConversations(req: Request, res: Response, next: NextFunction) {
        try {
            const page = parseInt((req.query.page as string) || '1');
            const data = await ChatwootService.getConversations(page);
            res.json({ success: true, data });
        } catch (err) {
            next(err);
        }
    }

    /** GET /api/communication/conversations/:id/messages */
    static async getMessages(req: Request, res: Response, next: NextFunction) {
        try {
            const conversationId = parseInt(req.params.id);
            if (isNaN(conversationId)) {
                res.status(400).json({ success: false, error: { message: 'ID de conversación inválido' } });
                return;
            }
            const data = await ChatwootService.getMessages(conversationId);
            res.json({ success: true, data });
        } catch (err) {
            next(err);
        }
    }

    /** POST /api/communication/conversations/:id/messages */
    static async replyMessage(req: Request, res: Response, next: NextFunction) {
        try {
            const conversationId = parseInt(req.params.id);
            const { content } = req.body as { content: string };
            if (isNaN(conversationId)) {
                res.status(400).json({ success: false, error: { message: 'ID inválido' } });
                return;
            }
            const ok = await ChatwootService.sendMessage(conversationId, content);
            if (!ok) {
                res.status(502).json({ success: false, error: { message: 'Error enviando mensaje en Chatwoot' } });
                return;
            }
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    /** PATCH /api/communication/conversations/:id/status */
    static async setConversationStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const conversationId = parseInt(req.params.id);
            const { status } = req.body as { status: 'open' | 'resolved' | 'pending' };
            const ok = await ChatwootService.setStatus(conversationId, status);
            if (!ok) {
                res.status(502).json({ success: false, error: { message: 'Error actualizando estado' } });
                return;
            }
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    /** POST /api/communication/conversations/:id/labels */
    static async addLabels(req: Request, res: Response, next: NextFunction) {
        try {
            const conversationId = parseInt(req.params.id);
            const { labels } = req.body as { labels: string[] };
            const ok = await ChatwootService.addLabels(conversationId, labels);
            res.json({ success: ok });
        } catch (err) {
            next(err);
        }
    }

    /** POST /api/communication/conversations/:id/read */
    static async markRead(req: Request, res: Response, next: NextFunction) {
        try {
            const conversationId = parseInt(req.params.id);
            const ok = await ChatwootService.markRead(conversationId);
            res.json({ success: ok });
        } catch (err) {
            next(err);
        }
    }

    /** DELETE /api/communication/conversations/:id */
    static async deleteConversation(req: Request, res: Response, next: NextFunction) {
        try {
            const conversationId = parseInt(req.params.id);
            const ok = await ChatwootService.deleteConversation(conversationId);
            if (!ok) {
                res.status(502).json({ success: false, error: { message: 'Error eliminando conversación' } });
                return;
            }
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }

    // ── Ficha paciente por teléfono ───────────────────────

    /** GET /api/communication/patient-context/:phone */
    static async getPatientContext(req: Request, res: Response, next: NextFunction) {
        try {
            const raw = req.params.phone.replace(/\D/g, '').slice(-9);
            const patient = await prisma.patient.findFirst({
                where: { phone: { contains: raw, mode: 'insensitive' } },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    email: true,
                    dateOfBirth: true,
                    medicalNotes: true,
                    allergies: true,
                    medications: true,
                    bloodType: true,
                },
            });
            if (!patient) {
                res.json({ success: true, data: null });
                return;
            }
            // Age calculation
            let age: number | null = null;
            if (patient.dateOfBirth) {
                const today = new Date();
                const dob = new Date(patient.dateOfBirth);
                age = today.getFullYear() - dob.getFullYear();
                if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
                    age--;
                }
            }
            res.json({ success: true, data: { ...patient, age } });
        } catch (err) { next(err); }
    }

    /** POST /api/communication/whatsapp/send-budget */
    static async sendBudget(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, patientName, items, totalAmount, doctorName } = req.body as {
                phone: string;
                patientName: string;
                items: { description: string; price: number }[];
                totalAmount: number;
                doctorName?: string;
            };
            if (!phone || !patientName || !items?.length) {
                res.status(400).json({ success: false, error: { message: 'phone, patientName e items son requeridos' } });
                return;
            }
            const lines = [
                `*PRESUPUESTO — Rubio García Dental*`,
                `Paciente: ${patientName}`,
                doctorName ? `Dr/Dra: ${doctorName}` : '',
                `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
                ``,
                `*Tratamientos:*`,
                ...items.map(i => `• ${i.description}: ${i.price.toFixed(2)}€`),
                ``,
                `*TOTAL: ${totalAmount.toFixed(2)}€*`,
                ``,
                `Este presupuesto es válido durante 30 días. Para cualquier duda o para confirmar su cita, responda a este mensaje o llámenos. ¡Gracias! 🦷`,
            ].filter(l => l !== null && l !== undefined).join('\n');
            const ok = await EvolutionService.sendText(phone, lines);
            if (!ok) {
                res.status(502).json({ success: false, error: { message: 'Error enviando presupuesto' } });
                return;
            }
            res.json({ success: true });
        } catch (err) { next(err); }
    }

    // ── Patrones de recordatorio (recordatorios inteligentes) ─────────────────

    /** GET /api/communication/patient-pattern/:phone */
    static async getPatientPattern(req: Request, res: Response, next: NextFunction) {
        try {
            const pattern = getPattern(req.params.phone);
            res.json({ success: true, data: pattern });
        } catch (err) { next(err); }
    }

    /** POST /api/communication/patient-pattern/:phone/event  body: { event: 'confirmed'|'no_show'|'reminder_sent' } */
    static async recordPatientEvent(req: Request, res: Response, next: NextFunction) {
        try {
            const { event } = req.body as { event: 'confirmed' | 'no_show' | 'reminder_sent' };
            if (!['confirmed', 'no_show', 'reminder_sent'].includes(event)) {
                res.status(400).json({ success: false, error: { message: 'event inválido' } });
                return;
            }
            recordEvent(req.params.phone, event);
            res.json({ success: true, data: getPattern(req.params.phone) });
        } catch (err) { next(err); }
    }

    /** GET /api/communication/metrics */
    static async getClinicMetrics(_req: Request, res: Response, next: NextFunction) {
        try {
            const automations = await prisma.automation.findMany({
                select: { name: true, trigger: true, successRate: true, executions: true, enabled: true },
            });

            // Conversation counts come from file-based storage (no DB model yet)
            const msgs7 = 0;
            const msgs30 = 0;

            // Patient reliability patterns
            const allPatterns = getAllPatterns();
            const patsWithData = allPatterns.filter(p => p.totalReminders >= 3);
            const avgConfirmationRate = patsWithData.length
                ? Math.round(patsWithData.reduce((s, p) => s + (p.confirmationRate ?? 0), 0) / patsWithData.length)
                : null;
            const patientsByLabel = {
                excellent: allPatterns.filter(p => p.reliabilityLabel === 'excellent').length,
                good: allPatterns.filter(p => p.reliabilityLabel === 'good').length,
                average: allPatterns.filter(p => p.reliabilityLabel === 'average').length,
                low: allPatterns.filter(p => p.reliabilityLabel === 'low').length,
            };

            const reminderAutos = automations.filter(a => a.trigger.includes('recordatorio'));
            const avgReminderSuccess = reminderAutos.length
                ? Math.round(reminderAutos.reduce((s, a) => s + a.successRate, 0) / reminderAutos.length)
                : 0;

            res.json({
                success: true,
                data: {
                    automations: {
                        total: automations.length,
                        active: automations.filter(a => a.enabled).length,
                        totalExecutions: automations.reduce((s, a) => s + a.executions, 0),
                        avgSuccessRate: automations.length
                            ? Math.round(automations.reduce((s, a) => s + a.successRate, 0) / automations.length)
                            : 0,
                    },
                    reminders: {
                        avgSuccessRate: avgReminderSuccess,
                        total: reminderAutos.reduce((s, a) => s + a.executions, 0),
                    },
                    conversations: { last7Days: msgs7, last30Days: msgs30 },
                    patients: {
                        tracked: allPatterns.length,
                        avgConfirmationRate,
                        byReliability: patientsByLabel,
                    },
                },
            });
        } catch (err) { next(err); }
    }

    // ── Webhook Evolution — Agente IA ─────────────────────

    /** POST /api/communication/webhook/evolution  (sin auth — lo llama Evolution) */
    static async webhookEvolution(req: Request, res: Response) {
        // ── HMAC signature verification ──────────────────────────────────────
        if (config.EVOLUTION_WEBHOOK_SECRET) {
            const sig = req.headers['x-evolution-signature'] as string | undefined;
            const rawBody = (req as any).rawBody as string ?? JSON.stringify(req.body);
            if (!verifyEvolutionSignature(rawBody, sig, config.EVOLUTION_WEBHOOK_SECRET)) {
                logger.warn('[Evolution webhook] Signature verification FAILED — rejecting request');
                res.status(401).json({ success: false, error: 'Invalid signature' });
                return;
            }
        }

        // Siempre responder 200 para que Evolution no reintente
        res.json({ success: true });

        try {
            const event = req.body?.event as string | undefined;
            const data  = req.body?.data;

            logger.info(`[Evolution webhook] event=${event}`);

            // Solo procesar mensajes entrantes de usuarios (no nuestros propios)
            if (event !== 'messages.upsert' || data?.key?.fromMe !== false) return;

            const phone = (data?.key?.remoteJid as string)?.replace('@s.whatsapp.net', '') ?? '';
            const text  = (data?.message?.conversation as string)
                ?? (data?.message?.extendedTextMessage?.text as string)
                ?? '';

            if (!phone || !text.trim()) return;

            logger.info(`[WhatsApp:IN] ${phone}: ${text.slice(0, 100)}`);

            // ── Emitir evento en tiempo real al frontend ──────────────────────
            const now = new Date();
            emitWA('whatsapp:message', {
                phone,
                text,
                fromMe: false,
                time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                id: data?.key?.id ?? String(Date.now()),
            });
            emitWA('whatsapp:conversation_updated', { phone });

            // ── Patrón de confirmación ────────────────────────────────────────
            const CONFIRMATION_KEYWORDS = ['sí', 'si', 'confirmo', 'confirmado', 'de acuerdo', 'ok', 'ahí estaré', 'allí estaré', 'estaré', 'perfecto', 'claro'];
            const lowerText = text.toLowerCase();
            if (CONFIRMATION_KEYWORDS.some(kw => lowerText.includes(kw))) {
                recordEvent(phone, 'confirmed');
            }

            // ── Detección de urgencias ────────────────────────────────────────
            const isUrgent = URGENCY_KEYWORDS.some(kw => lowerText.includes(kw));
            if (isUrgent) {
                logger.warn(`[WhatsApp:URGENCY] ${phone}: "${text.slice(0, 80)}"`);
                emitWA('whatsapp:urgency', {
                    phone,
                    text,
                    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                });
            }

            // Buscar paciente por teléfono para contextualizar
            const patient = await prisma.patient.findFirst({
                where: { phone: { contains: phone.replace(/^34/, ''), mode: 'insensitive' } },
                select: { id: true, firstName: true, lastName: true },
            }).catch(() => null);

            if (patient) {
                logger.info(`[WhatsApp] Paciente identificado: ${patient.firstName} ${patient.lastName}`);
            }

            // Recuperar historial de conversación para contexto
            const history = await AIService.getConversationHistory(phone);

            // Llamar al agente IA
            const agentReply = await AIService.whatsappAgent(phone, text, history);

            // Enviar respuesta por WhatsApp
            if (agentReply) {
                const sent = await EvolutionService.sendText(phone, agentReply);
                logger.info(`[WhatsApp:OUT] ${phone}: ${sent ? 'OK' : 'FAILED'} — "${agentReply.slice(0, 80)}"`);
                if (sent) {
                    emitWA('whatsapp:message', {
                        phone,
                        text: agentReply,
                        fromMe: true,
                        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                        id: String(Date.now()),
                    });
                }
            }

        } catch (err) {
            logger.error('[Evolution webhook] Error procesando mensaje:', err);
        }
    }
}
