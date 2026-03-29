// ─────────────────────────────────────────────────────────────────
//  services/pre-cita-workflow.service.ts
//  Flujo completo pre-cita: recordatorios, confirmación,
//  envío de consentimientos para firma remota.
//
//  Orquestra:
//    • evolution.service.ts  → WhatsApp (envío de mensajes)
//    • documentos.service.ts → Consentimientos & firmas
//    • citas.service.ts      → Estado de la cita
//    • notificaciones.service.ts → Alertas internas
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import { sendTextMessage, isEvolutionConfigured, normalizePhone } from './evolution.service';
import { crearDocumento, crearTokenFirma, getDocumentosByPaciente, type PatientDocument } from './documentos.service';
import { updateEstadoCita } from './citas.service';
import type { Cita, EstadoCita } from '../types';

// ═══════════════════════════════════════════════════════════════════
//  1. PLANTILLAS DE MENSAJES PRE-CITA
// ═══════════════════════════════════════════════════════════════════

interface PreCitaTemplate {
    id: string;
    nombre: string;
    timing: string;           // Descripción del momento de envío
    horasAntes: number;        // Horas antes de la cita
    mensaje: (vars: TemplateVars) => string;
}

interface TemplateVars {
    nombrePaciente: string;
    fecha: string;
    hora: string;
    tratamiento: string;
    doctor: string;
    clinica: string;
    direccion?: string;
    linkConfirmacion?: string;
    linkConsentimiento?: string;
}

const PRE_CITA_TEMPLATES: PreCitaTemplate[] = [
    // ── 24h antes: Recordatorio + pedir confirmación ──
    {
        id: 'reminder_24h',
        nombre: 'Recordatorio 24h + Confirmación',
        timing: '24 horas antes de la cita',
        horasAntes: 24,
        mensaje: (v) =>
            `Hola ${v.nombrePaciente.split(' ')[0]} 👋\n\n` +
            `Te recordamos que tienes una cita *mañana* en ${v.clinica}:\n\n` +
            `📅 Fecha: ${v.fecha}\n` +
            `🕐 Hora: ${v.hora}\n` +
            `🦷 Tratamiento: ${v.tratamiento}\n` +
            `👨‍⚕️ Doctor/a: ${v.doctor}\n` +
            (v.direccion ? `📍 ${v.direccion}\n` : '') +
            `\n*¿Podrás asistir?* Responde:\n` +
            `✅ *SÍ* para confirmar\n` +
            `❌ *NO* para cancelar\n\n` +
            `📋 Si tienes documentos pendientes de firma, los recibirás tras confirmar.\n\n` +
            `— ${v.clinica}`,
    },

    // ── 20h antes (4h tras el primero): Reenvío si no respondió ──
    {
        id: 'reminder_20h_reenvio',
        nombre: 'Reenvío confirmación 20h',
        timing: '20 horas antes (4h tras el primer recordatorio)',
        horasAntes: 20,
        mensaje: (v) =>
            `Hola ${v.nombrePaciente.split(' ')[0]} 👋\n\n` +
            `Aún no hemos recibido tu confirmación para la cita de mañana:\n\n` +
            `📅 ${v.fecha} a las ${v.hora}\n` +
            `🦷 ${v.tratamiento}\n` +
            `👨‍⚕️ ${v.doctor}\n\n` +
            `Por favor, confirma respondiendo *SÍ* o *NO*.\n\n` +
            `— ${v.clinica}`,
    },

    // ── 4h antes: Ultimátum (1h para responder) ──
    {
        id: 'reminder_4h_ultimatum',
        nombre: 'Ultimátum 4h antes',
        timing: '4 horas antes de la cita',
        horasAntes: 4,
        mensaje: (v) =>
            `⚠️ ${v.nombrePaciente.split(' ')[0]}, tu cita es en *4 horas* y aún no la has confirmado:\n\n` +
            `🕐 ${v.hora} — ${v.tratamiento}\n` +
            (v.direccion ? `📍 ${v.direccion}\n` : '') +
            `\n*Si en 1 hora no recibimos tu confirmación*, entenderemos que no puedes acudir y procederemos a reubicar tu cita.\n\n` +
            `Responde *SÍ* para confirmar ahora.\n\n` +
            `— ${v.clinica}`,
    },

    // ── 3h antes: Reubicación + oferta nueva cita ──
    {
        id: 'reminder_3h_reubicacion',
        nombre: 'Reubicación por no confirmación',
        timing: '3 horas antes de la cita (sin confirmación)',
        horasAntes: 3,
        mensaje: (v) =>
            `${v.nombrePaciente.split(' ')[0]}, como no hemos recibido tu confirmación, tu cita ha sido reubicada:\n\n` +
            `📅 ${v.fecha} a las ${v.hora} — ${v.tratamiento}\n\n` +
            `Sentimos las molestias. ¿Deseas que te demos una *nueva cita*?\n` +
            `Responde *SÍ* y te contactaremos para buscar un nuevo horario.\n\n` +
            `— ${v.clinica}`,
    },

    // ── Post-confirmación: Consentimientos informados ──
    {
        id: 'consent_send',
        nombre: 'Envío de Consentimientos',
        timing: 'Tras confirmar la cita',
        horasAntes: 0,
        mensaje: (v) =>
            `${v.nombrePaciente.split(' ')[0]}, gracias por confirmar tu cita ✅\n\n` +
            `Para agilizar tu visita, necesitamos tu firma en el siguiente consentimiento informado:\n\n` +
            (v.linkConsentimiento
                ? `📋 Pulsa aquí para firmar: ${v.linkConsentimiento}\n\n`
                : `📋 Te enviaremos el consentimiento al llegar a la clínica.\n\n`) +
            `⚠️ Es obligatorio firmarlo antes del tratamiento.\n\n` +
            `Si tienes alguna duda, no dudes en escribirnos. ¡Te esperamos! 😊\n` +
            `— ${v.clinica}`,
    },
];

// ═══════════════════════════════════════════════════════════════════
//  2. CONSENTIMIENTOS POR TIPO DE TRATAMIENTO
// ═══════════════════════════════════════════════════════════════════

interface ConsentMapping {
    treatmentKeywords: string[];
    documentoTitulo: string;
    templateId: string;
}

const CONSENT_MAPPINGS: ConsentMapping[] = [
    {
        treatmentKeywords: ['implante', 'cirugía implante', 'colocación implante'],
        documentoTitulo: 'Consentimiento Informado — Implantología',
        templateId: 'CI-IMPLANTE',
    },
    {
        treatmentKeywords: ['extracción', 'exodoncia', 'extracción cordal', 'cordal', 'muela juicio'],
        documentoTitulo: 'Consentimiento Informado — Extracción dental',
        templateId: 'CI-EXODONCIA',
    },
    {
        treatmentKeywords: ['endodoncia', 'endo', 'tratamiento de conductos'],
        documentoTitulo: 'Consentimiento Informado — Endodoncia',
        templateId: 'CI-ENDODONCIA',
    },
    {
        treatmentKeywords: ['cirugía', 'colgajo', 'injerto', 'quistectomía', 'frenectomía', 'biopsia'],
        documentoTitulo: 'Consentimiento Informado — Cirugía oral',
        templateId: 'CI-CIRUGIA',
    },
    {
        treatmentKeywords: ['ortodoncia', 'brackets', 'invisalign', 'alineadores'],
        documentoTitulo: 'Consentimiento Informado — Ortodoncia',
        templateId: 'CI-ORTODONCIA',
    },
    {
        treatmentKeywords: ['blanqueamiento'],
        documentoTitulo: 'Consentimiento Informado — Blanqueamiento',
        templateId: 'CI-BLANQUEAMIENTO',
    },
    {
        treatmentKeywords: ['prótesis', 'corona', 'puente', 'carilla'],
        documentoTitulo: 'Consentimiento Informado — Prótesis fija/removible',
        templateId: 'CI-PROTESIS',
    },
    {
        treatmentKeywords: ['sedación', 'sedación consciente'],
        documentoTitulo: 'Consentimiento Informado — Sedación',
        templateId: 'CI-SEDACION',
    },
    {
        treatmentKeywords: ['raspado', 'curetaje', 'cirugía periodontal'],
        documentoTitulo: 'Consentimiento Informado — Periodoncia',
        templateId: 'CI-PERIODONCIA',
    },
    {
        treatmentKeywords: ['radiografía', 'tac', 'cbct', 'panorámica', 'rx'],
        documentoTitulo: 'Consentimiento Informado — Radiodiagnóstico',
        templateId: 'CI-RADIOLOGIA',
    },
    {
        treatmentKeywords: ['reconstrucción', 'reco', 'restauración', 'restauradora', 'composite', 'empaste'],
        documentoTitulo: 'Consentimiento Informado — Restauradora',
        templateId: 'CI-RESTAURADORA',
    },
];

// RGPD — primera visita: texto completo. Resto: nota + URL.
const RGPD_CONSENT: ConsentMapping = {
    treatmentKeywords: [],
    documentoTitulo: 'Consentimiento RGPD — Protección de datos',
    templateId: 'RGPD',
};

const RGPD_URL = 'https://smileprostudio.es/politica-privacidad';
const RGPD_SHORT_NOTE = `Con su firma acepta la LOPD que puede consultar en ${RGPD_URL}`;

// ═══════════════════════════════════════════════════════════════════
//  3. FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════

export interface PreCitaAction {
    tipo: 'recordatorio' | 'confirmacion' | 'consentimiento' | 'ultimo_recordatorio';
    template: PreCitaTemplate;
    mensaje: string;
    horasAntes: number;
    enviado?: boolean;
}

export interface PreCitaPlan {
    cita: Cita;
    acciones: PreCitaAction[];
    consentimientosNecesarios: string[];
}

/**
 * Genera el plan completo de comunicaciones pre-cita.
 * Se usa al crear la cita para programar los envíos.
 */
export function buildPreCitaPlan(
    cita: Cita,
    clinicaNombre: string = 'SmilePro Studio',
    clinicaDireccion?: string,
): PreCitaPlan {
    const tratLower = (cita.tratamiento || '').toLowerCase();

    const vars: TemplateVars = {
        nombrePaciente: cita.nombrePaciente,
        fecha: cita.fecha || 'Pendiente',
        hora: cita.horaInicio,
        tratamiento: cita.tratamiento || 'Revisión',
        doctor: cita.doctor || 'Su doctor habitual',
        clinica: clinicaNombre,
        direccion: clinicaDireccion,
    };

    // Generar acciones para todos los templates
    const acciones: PreCitaAction[] = PRE_CITA_TEMPLATES
        .filter(t => t.id !== 'consent_send') // consent_send se añade aparte si hay CI
        .map(template => ({
            tipo: template.horasAntes >= 24 ? 'recordatorio' as const
                : template.horasAntes >= 12 ? 'confirmacion' as const
                : 'ultimo_recordatorio' as const,
            template,
            mensaje: template.mensaje(vars),
            horasAntes: template.horasAntes,
        }));

    // Detectar consentimientos necesarios
    const consentimientos: string[] = [];
    for (const cm of CONSENT_MAPPINGS) {
        if (cm.treatmentKeywords.some(kw => tratLower.includes(kw))) {
            consentimientos.push(cm.documentoTitulo);
        }
    }
    // RGPD: primera visita → texto completo, resto → nota corta
    // Se detecta si el paciente ya ha firmado el RGPD en el pasado
    // (asumir primera visita si no tenemos info — se marca externamente)
    consentimientos.push(RGPD_CONSENT.documentoTitulo);

    // Añadir acción de envío de consentimiento
    if (consentimientos.length > 0) {
        const consentTemplate = PRE_CITA_TEMPLATES.find(t => t.id === 'consent_send')!;
        acciones.push({
            tipo: 'consentimiento',
            template: consentTemplate,
            mensaje: consentTemplate.mensaje(vars),
            horasAntes: 0,
        });
    }

    // Ordenar por horasAntes (desc → primero se envía el que más lejos está)
    acciones.sort((a, b) => b.horasAntes - a.horasAntes);

    return { cita, acciones, consentimientosNecesarios: consentimientos };
}

/**
 * Envía un recordatorio específico al paciente vía WhatsApp.
 */
export async function sendPreCitaReminder(
    phone: string,
    action: PreCitaAction,
): Promise<boolean> {
    if (!isEvolutionConfigured()) {
        logger.warn('[PRE-CITA] WhatsApp no configurado');
        return false;
    }

    const normalizedPhone = normalizePhone(phone);
    const sent = await sendTextMessage(normalizedPhone, action.mensaje);

    if (sent) {
        logger.info(`[PRE-CITA] ${action.template.nombre} enviado al ${normalizedPhone}`);
    } else {
        logger.error(`[PRE-CITA] Error enviando ${action.template.nombre} al ${normalizedPhone}`);
    }

    return sent;
}

/**
 * Crea los documentos de consentimiento necesarios y envía links de firma.
 */
export async function sendConsentDocuments(
    numPac: string,
    phone: string,
    nombrePaciente: string,
    tratamiento: string,
    clinicaNombre: string = 'SmilePro Studio',
): Promise<{ created: PatientDocument[]; tokensSent: number }> {
    const tratLower = tratamiento.toLowerCase();
    const created: PatientDocument[] = [];
    let tokensSent = 0;

    // Detectar qué consentimientos hacen falta
    const needed: ConsentMapping[] = [];
    for (const cm of CONSENT_MAPPINGS) {
        if (cm.treatmentKeywords.some(kw => tratLower.includes(kw))) {
            needed.push(cm);
        }
    }
    // RGPD siempre
    needed.push(RGPD_CONSENT);

    // Comprobar cuáles ya tiene firmados
    const existingDocs = await getDocumentosByPaciente(numPac);
    const signed = new Set(
        existingDocs
            .filter((d: PatientDocument) => d.estado === 'Firmado')
            .map((d: PatientDocument) => d.template_id)
    );

    for (const cm of needed) {
        if (signed.has(cm.templateId)) continue; // Ya firmado

        // Crear documento
        const doc = await crearDocumento({
            numPac,
            titulo: cm.documentoTitulo,
            tipo: cm.templateId === 'RGPD' ? 'RGPD' : 'Consentimiento',
            templateId: cm.templateId,
            createdBy: 'workflow-engine',
        });

        if (doc) {
            created.push(doc);

            // Crear token de firma remota
            const tokenResult = crearTokenFirma({
                documentId: doc.id,
                numPac,
                nombrePaciente,
                tituloDocumento: doc.titulo,
                tipoDocumento: doc.tipo,
            });

            if (tokenResult && isEvolutionConfigured()) {
                const message = `📋 *${cm.documentoTitulo}*\n\n` +
                    `Firma aquí: ${tokenResult.url}\n\n` +
                    `⚠️ El enlace caduca en 48h.\n` +
                    `— ${clinicaNombre}`;

                const sent = await sendTextMessage(normalizePhone(phone), message);
                if (sent) tokensSent++;
            }
        }
    }

    logger.info(`[PRE-CITA] ${created.length} consentimientos creados, ${tokensSent} tokens enviados para ${numPac}`);
    return { created, tokensSent };
}

/**
 * Procesa confirmación de cita desde respuesta WhatsApp.
 * Llamado cuando el bot detecta "SÍ" como respuesta.
 */
export async function processConfirmation(
    citaId: string,
    numPac: string,
    phone: string,
    nombrePaciente: string,
    tratamiento: string,
    clinicaNombre?: string,
): Promise<{ confirmed: boolean; consent: { created: number; sent: number } }> {
    // 1. Actualizar estado de la cita
    const updated = await updateEstadoCita(citaId, 'confirmada' as EstadoCita);

    if (!updated) {
        logger.error(`[PRE-CITA] Error confirmando cita ${citaId}`);
        return { confirmed: false, consent: { created: 0, sent: 0 } };
    }

    logger.info(`[PRE-CITA] Cita ${citaId} confirmada por ${numPac}`);

    // 2. Enviar consentimientos
    const result = await sendConsentDocuments(numPac, phone, nombrePaciente, tratamiento, clinicaNombre);

    // 3. Enviar mensaje de confirmación
    if (isEvolutionConfigured()) {
        const msg = `✅ ¡Cita confirmada!\n\n` +
            `Te esperamos. Recuerda llegar 10 minutos antes.\n` +
            (result.tokensSent > 0
                ? `\nTe hemos enviado ${result.tokensSent} documento${result.tokensSent > 1 ? 's' : ''} para firmar. Por favor, fírmalos antes de tu cita.\n`
                : '') +
            `\n— ${clinicaNombre ?? 'SmilePro Studio'}`;

        await sendTextMessage(normalizePhone(phone), msg);
    }

    return {
        confirmed: true,
        consent: { created: result.created.length, sent: result.tokensSent },
    };
}

/**
 * Calcula qué recordatorio se debe enviar según el tiempo restante.
 * Útil para un cron/scheduler que evalúe citas pendientes.
 */
export function getNextReminderAction(
    citaDate: Date,
    citaHora: string,
    now: Date = new Date(),
): PreCitaTemplate | null {
    const [h, m] = citaHora.split(':').map(Number);
    const target = new Date(citaDate);
    target.setHours(h, m, 0, 0);

    const hoursUntil = (target.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Buscar el template más cercano que aún no se haya pasado
    const candidates = PRE_CITA_TEMPLATES
        .filter(t => t.id !== 'consent_send')
        .sort((a, b) => b.horasAntes - a.horasAntes);

    for (const t of candidates) {
        // Enviar si estamos dentro de una ventana de ±1h
        if (Math.abs(hoursUntil - t.horasAntes) <= 1) {
            return t;
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════
//  4. EXPORTAR TEMPLATES PARA UI
// ═══════════════════════════════════════════════════════════════════

export const getPreCitaTemplates = () => [...PRE_CITA_TEMPLATES];
export const getConsentMappings = () => [...CONSENT_MAPPINGS];
