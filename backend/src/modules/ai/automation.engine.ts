// ─── Automation Engine ────────────────────────────────────────────────────────
//  Motor de automatizaciones clínicas.
//  Se ejecuta cada minuto via node-cron y procesa triggers:
//    - recordatorio_24h  → citas mañana
//    - recordatorio_1h   → citas en ~60 min
//    - cita_confirmada   → citas confirmadas hoy aún no recordadas
//    - post_visita       → citas que terminaron hace ~2h
//    - bienvenida        → pacientes creados en la última hora
// ─────────────────────────────────────────────────────────────────────────────
import cron from 'node-cron';
import prisma from '../../config/database.js';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import type { AutomationStep } from './ai.service.js';
import { recordEvent } from '../communication/reminder-patterns.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AutomationContext {
    patientName: string;
    patientPhone: string;
    appointmentDate?: string;
    appointmentTime?: string;
    doctorName?: string;
    clinicName: string;
}

// ─── Helpers de fecha DCitas ──────────────────────────────────────────────────
// DCitas almacena Fecha como Int YYYYMMDD y Hora como Int HHMM (ej: 900=09:00, 1430=14:30)

const toDateInt = (d: Date): number =>
    d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

const toTimeInt = (d: Date): number =>
    d.getHours() * 100 + d.getMinutes();

const horaIntToStr = (h: number): string =>
    `${String(Math.floor(h / 100)).padStart(2, '0')}:${String(h % 100).padStart(2, '0')}`;

// ─── Render de plantilla de mensaje ──────────────────────────────────────────

function renderTemplate(template: string, ctx: AutomationContext): string {
    return template
        .replace(/\{\{nombre\}\}/gi, ctx.patientName)
        .replace(/\{\{fecha\}\}/gi, ctx.appointmentDate ?? '')
        .replace(/\{\{hora\}\}/gi, ctx.appointmentTime ?? '')
        .replace(/\{\{doctor\}\}/gi, ctx.doctorName ?? 'nuestro equipo')
        .replace(/\{\{clinica\}\}/gi, ctx.clinicName);
}

// ─── Envío de WhatsApp via Evolution API ─────────────────────────────────────

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
    const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE } = config;
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
        logger.warn('[AutoEngine] WhatsApp no configurado — simulando envío a', phone);
        return true; // simulated OK in dev
    }

    try {
        const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                number: phone.replace(/\D/g, ''),
                text: message,
            }),
            signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) recordEvent(phone, 'reminder_sent');
        return res.ok;
    } catch (err) {
        logger.error('[AutoEngine] WhatsApp send error:', err);
        return false;
    }
}

// ─── Ejecutar steps de una automatización ─────────────────────────────────────

async function executeSteps(
    automationId: string,
    steps: AutomationStep[],
    ctx: AutomationContext,
): Promise<void> {
    let success = false;

    for (const step of steps) {
        if (step.action === 'send_whatsapp' && step.template && ctx.patientPhone) {
            const message = renderTemplate(step.template, ctx);
            success = await sendWhatsApp(ctx.patientPhone, message);
            logger.info(`[AutoEngine] WhatsApp → ${ctx.patientPhone} | ok=${success} | "${message.slice(0, 60)}..."`);
        } else if (step.action === 'notify_staff') {
            logger.info(`[AutoEngine] Staff notificado: ${step.params?.message ?? 'Sin mensaje'}`);
            success = true;
        } else if (step.action === 'update_status') {
            // DCitas no tiene un campo de estado simple actualizable desde aquí — silenciar
            logger.debug('[AutoEngine] update_status ignorado (DCitas requiere IdUsu+IdOrden)');
            success = true;
        }
    }

    // Actualizar contadores
    await prisma.automation.update({
        where: { id: automationId },
        data: {
            executions: { increment: 1 },
            successRate: success ? { increment: 1 } : undefined,
        },
    }).catch(() => { /* silenciar si la automatización fue eliminada */ });
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

async function processTrigger(
    trigger: string,
    automationId: string,
    steps: AutomationStep[],
): Promise<void> {
    const clinicName = 'Rubio García Dental';
    const now = new Date();

    try {
        switch (trigger) {

            case 'recordatorio_24h': {
                // Citas mañana con Recordada=0 (aún no recordadas) y Movil presente
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowInt = toDateInt(tomorrow);

                const appointments = await prisma.dCitas.findMany({
                    where: {
                        Fecha: tomorrowInt,
                        Recordada: 0,
                        Movil: { not: null },
                    },
                });

                for (const appt of appointments) {
                    const ctx: AutomationContext = {
                        patientName: appt.Contacto ?? '',
                        patientPhone: appt.Movil ?? '',
                        appointmentDate: tomorrow.toLocaleDateString('es-ES'),
                        appointmentTime: appt.Hora ? horaIntToStr(appt.Hora) : '',
                        clinicName,
                    };
                    if (ctx.patientPhone) {
                        await executeSteps(automationId, steps, ctx);
                        await prisma.dCitas.update({
                            where: { IdUsu_IdOrden: { IdUsu: appt.IdUsu, IdOrden: appt.IdOrden } },
                            data: { Recordada: 1 },
                        }).catch(() => { });
                    }
                }
                break;
            }

            case 'recordatorio_1h': {
                // Citas en los próximos 55-65 minutos (usando comparación de enteros HHMM)
                const todayInt = toDateInt(now);
                const fromHora = toTimeInt(new Date(now.getTime() + 55 * 60_000));
                const toHora = toTimeInt(new Date(now.getTime() + 65 * 60_000));

                const appointments = await prisma.dCitas.findMany({
                    where: {
                        Fecha: todayInt,
                        Hora: { gte: fromHora, lte: toHora },
                        Movil: { not: null },
                    },
                });

                for (const appt of appointments) {
                    const ctx: AutomationContext = {
                        patientName: appt.Contacto ?? '',
                        patientPhone: appt.Movil ?? '',
                        appointmentDate: now.toLocaleDateString('es-ES'),
                        appointmentTime: appt.Hora ? horaIntToStr(appt.Hora) : '',
                        clinicName,
                    };
                    if (ctx.patientPhone) await executeSteps(automationId, steps, ctx);
                }
                break;
            }

            case 'cita_confirmada': {
                // Citas de hoy confirmadas (Confirmada=1) que aún no tienen recordatorio enviado
                const todayInt = toDateInt(now);
                const appointments = await prisma.dCitas.findMany({
                    where: {
                        Fecha: todayInt,
                        Confirmada: 1,
                        Recordada: 0,
                        Movil: { not: null },
                    },
                });

                for (const appt of appointments) {
                    const ctx: AutomationContext = {
                        patientName: appt.Contacto ?? '',
                        patientPhone: appt.Movil ?? '',
                        appointmentDate: now.toLocaleDateString('es-ES'),
                        appointmentTime: appt.Hora ? horaIntToStr(appt.Hora) : '',
                        clinicName,
                    };
                    if (ctx.patientPhone) {
                        await executeSteps(automationId, steps, ctx);
                        await prisma.dCitas.update({
                            where: { IdUsu_IdOrden: { IdUsu: appt.IdUsu, IdOrden: appt.IdOrden } },
                            data: { Recordada: 1 },
                        }).catch(() => { });
                    }
                }
                break;
            }

            case 'post_visita': {
                // Citas de hoy cuya hora de fin estimada cae en la ventana now-125min a now-115min
                const todayInt = toDateInt(now);
                const fromHora = toTimeInt(new Date(now.getTime() - 125 * 60_000));
                const toHora = toTimeInt(new Date(now.getTime() - 115 * 60_000));

                const appointments = await prisma.dCitas.findMany({
                    where: {
                        Fecha: todayInt,
                        Movil: { not: null },
                    },
                });

                for (const appt of appointments) {
                    if (!appt.Hora) continue;
                    const durMinutes = appt.Duracion ?? 60;
                    const startH = Math.floor(appt.Hora / 100);
                    const startM = appt.Hora % 100;
                    const endTotalMin = startH * 60 + startM + durMinutes;
                    const endHora = Math.floor(endTotalMin / 60) * 100 + (endTotalMin % 60);
                    if (endHora >= fromHora && endHora <= toHora) {
                        const ctx: AutomationContext = {
                            patientName: appt.Contacto ?? '',
                            patientPhone: appt.Movil ?? '',
                            clinicName,
                        };
                        if (ctx.patientPhone) await executeSteps(automationId, steps, ctx);
                    }
                }
                break;
            }

            case 'bienvenida': {
                // Pacientes (nativos) creados en la última hora para evitar duplicados
                const oneHourAgo = new Date(now.getTime() - 60 * 60_000);
                const patients = await prisma.patient.findMany({
                    where: { createdAt: { gte: oneHourAgo } },
                });

                for (const patient of patients) {
                    const ctx: AutomationContext = {
                        patientName: `${patient.firstName} ${patient.lastName}`.trim(),
                        patientPhone: patient.phone,
                        clinicName,
                    };
                    if (ctx.patientPhone) await executeSteps(automationId, steps, ctx);
                }
                break;
            }

            default:
                logger.debug(`[AutoEngine] Trigger desconocido: "${trigger}"`);
        }
    } catch (err) {
        logger.error(`[AutoEngine] Error procesando trigger "${trigger}":`, err);
    }
}

// ─── Runner principal ─────────────────────────────────────────────────────────

async function runAutomationEngine(): Promise<void> {
    try {
        const automations = await prisma.automation.findMany({
            where: { enabled: true },
        });

        if (automations.length === 0) return;

        logger.debug(`[AutoEngine] Procesando ${automations.length} automatizaciones activas`);

        for (const automation of automations) {
            await processTrigger(
                automation.trigger,
                automation.id,
                automation.steps as unknown as AutomationStep[],
            );
        }
    } catch (err) {
        logger.error('[AutoEngine] Error en ciclo principal:', err);
    }
}

// ─── Arranque del motor ───────────────────────────────────────────────────────

export function startAutomationEngine(): void {
    // Cada minuto en horario de clínica (L-S 8:00-21:00)
    cron.schedule('* 8-21 * * 1-6', () => {
        runAutomationEngine().catch(err => logger.error('[AutoEngine] Uncaught:', err));
    }, { timezone: 'Europe/Madrid' });

    logger.info('[AutoEngine] Motor de automatizaciones iniciado — cron activo (L-S 08-21h)');
}
