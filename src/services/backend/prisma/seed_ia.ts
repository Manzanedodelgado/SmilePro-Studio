import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding IA & Automatizaciones...');

    // 1. automations_config (26 rules)
    const automations = [
        { id: 'rem-24h', name: 'Recordatorio 24h antes', description: 'Enviado 24h antes de la cita', trigger_event: '24h before appointment', channel: 'whatsapp', category: 'recordatorio', active: true, timing: '24h antes', example: 'Hola {{nombre}}, recordamos tu cita para mañana...' },
        { id: 'rem-2h', name: 'Recordatorio 2h', description: 'Enviado 2h antes si no está confirmado', trigger_event: '2h before unconfirmed', channel: 'sms', category: 'recordatorio', active: true, timing: '2h antes', example: 'Recordatorio de cita en 2h' },
        { id: 'rem-created', name: 'Confirmación al crear cita', description: 'Enviado tras crear cita', trigger_event: 'appointment created', channel: 'whatsapp', category: 'recordatorio', active: true, timing: 'instantáneo', example: 'Cita confirmada el {{fecha}}' },
        { id: 'rem-ortho-2m', name: 'Revisión Ortodoncia 2 meses', description: 'Revisión cada 2m', trigger_event: '2 months after last ortho', channel: 'whatsapp', category: 'recordatorio', active: true, timing: '2 meses', example: 'Toca tu revisión de ortodoncia' },
        { id: 'rem-ortho-6m', name: 'Revisión Ortodoncia 6 meses', description: 'Revisión general', trigger_event: '6 months after last ortho', channel: 'whatsapp', category: 'recordatorio', active: true, timing: '6 meses', example: 'Toca tu revisión de ortodoncia semestral' },
        { id: 'rem-pediatric', name: 'Recordatorio pediátrico', description: 'Para tutores', trigger_event: 'pediatric appointment', channel: 'whatsapp', category: 'recordatorio', active: false, timing: '24h antes', example: 'Recordatorio cita pediátrica' },
        { id: 'post-basic', name: 'Seguimiento Post-Visita', description: '24h después de visita', trigger_event: '24h after visit', channel: 'whatsapp', category: 'seguimiento', active: true, timing: '24h después', example: '¿Qué tal te encuentras tras la visita?' },
        { id: 'post-surgery', name: 'Protocolo Post-Quirúrgico', description: 'Automático tras cirugía', trigger_event: 'surgery finished', channel: 'multi', category: 'seguimiento', active: true, timing: 'Día 0, 2 y 7', example: 'Seguimiento post-cirugía' },
        { id: 'post-implant-2m', name: 'Seguimiento implante 2-3 meses', description: 'Revisión implante', trigger_event: '2 months after implant', channel: 'whatsapp', category: 'seguimiento', active: true, timing: '2-3 meses', example: 'Toca revisar el implante' },
        { id: 'post-recs', name: 'Recomendaciones post-tratamiento', description: 'Cuidados en casa', trigger_event: 'treatment finished', channel: 'whatsapp', category: 'seguimiento', active: true, timing: 'instantáneo', example: 'Sigue estos cuidados recomendados' },
        { id: 'doctor-alert', name: 'Alerta clínica', description: 'Palabras clave graves', trigger_event: 'severe keyword detected', channel: 'interno', category: 'clinico', active: true, timing: 'instantáneo', example: 'ALERTA: Paciente reporta dolor' },
        { id: 'doctor-followup', name: 'Seguimiento manual', description: 'Por petición del doctor', trigger_event: 'doctor requested', channel: 'whatsapp', category: 'clinico', active: true, timing: 'variable', example: 'El doctor quiere saber cómo estás' },
        { id: 'recall-6m', name: 'Revisión Semestral Higiene', description: 'A los 6 meses', trigger_event: '6 months no hygiene', channel: 'whatsapp', category: 'recaptacion', active: true, timing: '6 meses', example: 'Te recordamos tu mantenimiento' },
        { id: 'recall-annual', name: 'Recaptación Paciente Inactivo', description: '+1 año sin venir', trigger_event: '1 year inactive', channel: 'whatsapp', category: 'recaptacion', active: true, timing: '1 año', example: 'Hace tiempo que no nos vemos' },
        { id: 'review-request', name: 'Solicitud de Reseña', description: 'Tras visita exitosa', trigger_event: 'successful visit', channel: 'whatsapp', category: 'recaptacion', active: true, timing: '2h después', example: '¿Nos dejas una reseña?' },
        { id: 'birthday', name: 'Felicitación de Cumpleaños', description: 'Día de nacimiento', trigger_event: 'birthday match', channel: 'whatsapp', category: 'recaptacion', active: true, timing: '9:00 AM', example: '¡Feliz cumpleaños!' },
        { id: 'consent-confirmed', name: 'Consentimiento para firma', description: 'Tras confirmar', trigger_event: 'appointment confirmed', channel: 'email', category: 'documento', active: true, timing: 'instantáneo', example: 'Por favor firma este documento' },
        { id: 'consent-received', name: 'Consentimiento firmado', description: 'Notificación interna', trigger_event: 'consent signed', channel: 'interno', category: 'documento', active: true, timing: 'instantáneo', example: 'El paciente ha firmado' },
        { id: 'first-visit-questionnaire', name: 'Cuestionario Primera Visita', description: 'Anamnesis', trigger_event: 'first visit booked', channel: 'whatsapp', category: 'documento', active: true, timing: 'instantáneo', example: 'Rellena tu ficha médica' },
        { id: 'gestor-docs', name: 'Envío mensual a gestoría', description: 'Facturas', trigger_event: '1st of month', channel: 'email', category: 'documento', active: false, timing: 'Mensual', example: 'Adjuntamos exportación' },
        { id: 'invoice-doctor', name: 'Factura paciente', description: 'Tras pago', trigger_event: 'payment done', channel: 'email', category: 'pago', active: true, timing: 'instantáneo', example: 'Aquí tienes tu factura' },
        { id: 'receipt-cash', name: 'Recibo efectivo', description: 'Ticket', trigger_event: 'cash payment', channel: 'whatsapp', category: 'pago', active: true, timing: 'instantáneo', example: 'Recibo de tu pago' },
        { id: 'payment-reminder', name: 'Recordatorio deuda', description: 'Impagos', trigger_event: 'due date passed', channel: 'email', category: 'pago', active: false, timing: 'semanal', example: 'Tienes un pago pendiente' },
        { id: 'no-show', name: 'Gestión No Presentado', description: 'Reagendar', trigger_event: 'status marked as no-show', channel: 'whatsapp', category: 'gestion', active: true, timing: '30 min después', example: 'Hemos visto que no pudiste venir' },
        { id: 'confirm-status', name: 'Actualización estado de cita', description: 'Cambiar en agenda', trigger_event: 'whatsapp confirmation', channel: 'interno', category: 'gestion', active: true, timing: 'instantáneo', example: 'Cita confirmada' },
        { id: 'urgency-auto', name: 'Respuesta Automática Urgencias', description: 'Fuera de horario', trigger_event: 'after hours message', channel: 'whatsapp', category: 'urgencia', active: true, timing: 'instantáneo', example: 'Nuestro horario es... Si es urgente llama al...' },
        { id: 'pv-booking-confirm', name: 'Confirmación Primera Visita', description: 'Cita nueva', trigger_event: 'pv created', channel: 'whatsapp', category: 'primera_visita', active: true, timing: 'instantáneo', example: 'Cita PV confirmada' },
        { id: 'pv-24h-forms', name: 'Formularios 24h', description: 'Aviso para rellenar web', trigger_event: '24h before pv', channel: 'whatsapp', category: 'primera_visita', active: true, timing: '24h antes', example: 'Recuerda rellenar datos' },
        { id: 'pv-forms-done', name: 'PV Confirmación completados', description: 'Formularios listos', trigger_event: 'forms done', channel: 'multi', category: 'primera_visita', active: true, timing: 'instantáneo', example: 'Datos recibidos con éxito' },
        { id: 'pv-tutor-route', name: 'Redirección al tutor', description: 'Paciente menor', trigger_event: 'minor pv booked', channel: 'whatsapp', category: 'primera_visita', active: true, timing: 'instantáneo', example: 'Por favor tutor rellene esto' },
    ];

    for (const auto of automations) {
        await prisma.automationsConfig.upsert({
            where: { id: auto.id },
            update: auto,
            create: auto
        });
    }

    // 2. templates_config
    const templates = [
        { id: 'wa-reminder-24', name: 'Recordatorio cita 24h', type: 'whatsapp', category: 'Recordatorios', content: 'Hola {{nombre}}, recordamos tu cita mañana a las {{hora}}', vars: ['nombre', 'hora'] },
        { id: 'wa-reminder-2h', name: 'Recordatorio cita 2h', type: 'whatsapp', category: 'Recordatorios', content: '¿Confirmas tu cita en 2h?', vars: [] },
        { id: 'wa-cita-creada', name: 'Confirmación nueva cita', type: 'whatsapp', category: 'Recordatorios', content: 'Cita reservada', vars: [] },
        { id: 'wa-first-visit-reminder', name: 'Recordatorio primera visita', type: 'whatsapp', category: 'Recordatorios', content: 'Recuerda tu primera visita', vars: [] },
        { id: 'wa-post-visit', name: 'Seguimiento post-visita', type: 'whatsapp', category: 'Seguimiento', content: '¿Qué tal te encuentras?', vars: [] },
        { id: 'wa-post-surgery-d0', name: 'Post-quirúrgico Día 0', type: 'whatsapp', category: 'Seguimiento', content: 'Reposa hoy...', vars: [] },
        { id: 'wa-post-surgery-d2', name: 'Post-quirúrgico Día 2', type: 'whatsapp', category: 'Seguimiento', content: '¿Cómo va la inflamación?', vars: [] },
        { id: 'wa-post-surgery-d7', name: 'Post-quirúrgico Día 7', type: 'whatsapp', category: 'Seguimiento', content: 'Te vemos para revisión', vars: [] },
        { id: 'wa-implant-2m', name: 'Seguimiento implante 2m', type: 'whatsapp', category: 'Seguimiento', content: 'Revisión implante', vars: [] },
        { id: 'wa-ortho-2m', name: 'Revisión ortodoncia 2m', type: 'whatsapp', category: 'Seguimiento', content: 'Acuda a ajustar aparatos', vars: [] },
        { id: 'wa-ortho-6m', name: 'Revisión ortodoncia 6m', type: 'whatsapp', category: 'Seguimiento', content: 'Revisión semestral ortodoncia', vars: [] },
        { id: 'wa-recall-6m', name: 'Revisión higiene 6m', type: 'whatsapp', category: 'Recaptación', content: 'Hace 6 meses te hiciste higiene. Toca revisión.', vars: [] },
        { id: 'wa-recall-12m', name: 'Recaptación inactivo', type: 'whatsapp', category: 'Recaptación', content: 'Hace más de 1 año que no te vemos. Ven a revisión gratuita.', vars: [] },
        { id: 'wa-review', name: 'Solicitud de reseña', type: 'whatsapp', category: 'Recaptación', content: 'Si te ha gustado, déjanos 5 estrellas', vars: [] },
        { id: 'wa-birthday', name: 'Felicitación cumpleaños', type: 'whatsapp', category: 'Recaptación', content: '¡Feliz cumple!', vars: [] },
        { id: 'wa-noshow', name: 'No presentado', type: 'whatsapp', category: 'Gestión', content: 'Vimos que no viniste', vars: [] },
        { id: 'wa-recibo-efectivo', name: 'Recibo efectivo', type: 'whatsapp', category: 'Pagos', content: 'Recibo de tu pago de hoy', vars: [] },
        { id: 'wa-urgencia', name: 'Respuesta urgencias', type: 'whatsapp', category: 'Urgencias', content: 'Para urgencias llamar al 600', vars: [] },
        { id: 'sms-2h', name: 'SMS recordatorio 2h', type: 'sms', category: 'Recordatorios', content: 'Cita en 2h. Responda SI', vars: [] },
        { id: 'sms-deuda', name: 'SMS deuda', type: 'sms', category: 'Pagos', content: 'Tiene saldo pendiente', vars: [] },
        { id: 'email-consentimiento', name: 'Email consentimiento', type: 'email', category: 'Documentos', content: 'Firme el doc', vars: [] },
        { id: 'email-factura', name: 'Email factura', type: 'email', category: 'Pagos', content: 'Adjunto factura cubierta', vars: [] },
        { id: 'email-gestoria', name: 'Email gestoría', type: 'email', category: 'Gestión interna', content: 'Facturación del mes', vars: [] },
        { id: 'email-deuda', name: 'Email deuda pendiente', type: 'email', category: 'Pagos', content: 'Saldo pendiente: {{deuda}}', vars: ['deuda'] },
        { id: 'doc-consent-implante', name: 'Consentimiento Implante', type: 'documento', category: 'Consentimientos', content: '[Plantilla PDF Implante]', vars: [] },
        { id: 'doc-consent-extraccion', name: 'Consentimiento Extracción', type: 'documento', category: 'Consentimientos', content: '[Plantilla PDF Extracción]', vars: [] },
        { id: 'doc-consent-blanqueamiento', name: 'Consentimiento Blanqueamiento', type: 'documento', category: 'Consentimientos', content: '[Plantilla PDF Blanqueamiento]', vars: [] },
        { id: 'doc-consent-ortodoncia', name: 'Consentimiento Ortodoncia', type: 'documento', category: 'Consentimientos', content: '[Plantilla PDF Ortodoncia]', vars: [] },
        { id: 'doc-instrucciones-postop', name: 'Instrucciones quirúrgicas', type: 'documento', category: 'Instrucciones', content: '[Instrucciones en PDF]', vars: [] },
        { id: 'quest-primera-visita', name: 'Anamnesis Primera Visita', type: 'cuestionario', category: 'Cuestionarios', content: '{"fields":[]}', vars: [] },
        { id: 'quest-satisfaccion', name: 'Cuestionario post-visita', type: 'cuestionario', category: 'Cuestionarios', content: '{"rating":5}', vars: [] },
    ];

    for (const template of templates) {
        await prisma.templatesConfig.upsert({
            where: { id: template.id },
            update: template,
            create: template
        });
    }

    // 3. flows_config
    const flows = [
        { id: 'confirm', name: 'Confirmación de Cita', trigger: 'Cita programada en agenda', color: '#0056b3' },
        { id: 'cancel', name: 'Cancelación', trigger: 'Pac. responde NO o CANCELAR', color: '#dc3545' },
        { id: 'noshow', name: 'No Presentado', trigger: 'Estado No Presentado', color: '#6c757d' },
        { id: 'surgery', name: 'Post-Quirúrgico Implantes', trigger: 'Cierre gabinete Cirugía', color: '#17a2b8' },
        { id: 'payment', name: 'Cobro Realizado', trigger: 'Cobro en el sistema', color: '#28a745' },
        { id: 'firstvisit', name: 'Primera Visita', trigger: 'Cita de paciente nuevo', color: '#fd7e14' },
    ];

    for (const flow of flows) {
        await prisma.flowsConfig.upsert({
            where: { id: flow.id },
            update: flow,
            create: flow
        });
    }

    // 4. ia_agent_config (only 1)
    const agent = {
        clinica_id: 'rubio-garcia-dental',
        agent_name: 'IA Dental',
        tone: 'empatica',
        language: 'es_peninsular',
        greeting_message: 'Hola, soy IA Dental, el asistente virtual de la clínica. ¿En qué puedo ayudarte?',
        knowledge_base: [
            'Servicios: Implantes, Ortodoncia, Endodoncia, Cirugía, Higiene, Blanqueamiento, Prótesis',
            'Horario: Lunes a Viernes 8:30-20:00, Sábados 9:00-14:00',
            'Dirección: C/ Ejemplo 123, Madrid. Metro: Gran Vía',
            'Teléfono urgencias fuera de horario: 612 345 678',
            'Formas de pago: Efectivo, Tarjeta, Bizum, Financiación hasta 24 meses',
            'Primera visita gratuita para nuevos pacientes'
        ],
        escalation_rules: [
            { trigger: "dolor severo / sangrado", action: "Escalar a recepción inmediatamente" },
            { trigger: "solicitud de presupuesto detallado", action: "Derivar a secretaría para cita de diagnóstico" },
            { trigger: "queja o insatisfacción", action: "Disculparse, escalar a dirección" },
            { trigger: "pregunta médica específica", action: "Responder con cautela, sugerir consulta presencial" }
        ]
    };

    await prisma.iaAgentConfig.upsert({
        where: { clinica_id: agent.clinica_id },
        update: agent,
        create: agent
    });

    // 5. ia_escalation_keywords
    const keywords = [
        { keyword: 'dolor severo', severity: 'alta', action: 'Notificar al doctor inmediatamente' },
        { keyword: 'sangrado', severity: 'alta', action: 'Notificar al doctor inmediatamente' },
        { keyword: 'sangrado abundante', severity: 'alta', action: 'Llamar al paciente directamente' },
        { keyword: 'no puedo respirar', severity: 'alta', action: 'Llamar al paciente + avisar urgencias' },
        { keyword: 'hinchazón', severity: 'alta', action: 'Notificar al doctor inmediatamente' },
        { keyword: 'fiebre', severity: 'alta', action: 'Notificar al doctor' },
        { keyword: 'alergia', severity: 'alta', action: 'Notificar al doctor' },
        { keyword: 'reacción alérgica', severity: 'alta', action: 'Llamar al paciente + avisar urgencias' },
        { keyword: 'accidente', severity: 'alta', action: 'Notificar al doctor' },
        { keyword: 'caída', severity: 'media', action: 'Notificar al doctor' },
        { keyword: 'queja', severity: 'media', action: 'Notificar a recepción' },
        { keyword: 'insatisfecho', severity: 'media', action: 'Escalar a dirección' },
        { keyword: 'devolución', severity: 'media', action: 'Notificar a administración' },
        { keyword: 'reembolso', severity: 'media', action: 'Notificar a administración' },
        { keyword: 'presupuesto detallado', severity: 'baja', action: 'Derivar a secretaría' },
        { keyword: 'precio', severity: 'baja', action: 'Derivar a secretaría' },
        { keyword: 'cuánto cuesta', severity: 'baja', action: 'Derivar a secretaría' },
    ];

    for (const kw of keywords) {
        await prisma.iaEscalationKeywords.upsert({
            where: { keyword: kw.keyword },
            update: kw,
            create: kw
        });
    }

    console.log('✅ IA Data seeded successfully!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
