// ─── Communication Controller ────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { EvolutionService, ChatwootService, isEvolutionConfigured, isChatwootConfigured } from './communication.service';
import { AIService } from '../ai/ai.service';
import { logger } from '../../config/logger.js';
import prisma from '../../config/database.js';

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

    // ── Webhook Evolution — Agente IA ─────────────────────

    /** POST /api/communication/webhook/evolution  (sin auth — lo llama Evolution) */
    static async webhookEvolution(req: Request, res: Response) {
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
            }

        } catch (err) {
            logger.error('[Evolution webhook] Error procesando mensaje:', err);
        }
    }
}
