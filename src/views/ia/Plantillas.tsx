import React, { useState } from 'react';
import { MessageSquare, Mail, FileText, Clipboard, Edit3, Save, X, Plus, Copy, Check } from 'lucide-react';

type TemplateType = 'whatsapp' | 'sms' | 'email' | 'documento' | 'cuestionario';
interface Template { id: string; name: string; type: TemplateType; category: string; content: string; vars: string[] }

const TEMPLATES: Template[] = [
    // ── WhatsApp ──
    {
        id: 'wa-reminder-24', name: 'Recordatorio cita 24h', type: 'whatsapp', category: 'Recordatorios',
        content: '👋 Hola {{nombre}}, te recordamos tu cita mañana {{fecha}} a las {{hora}}h con {{doctor}} en Rubio García Dental.\n\n¿Confirmas tu asistencia? Responde:\n✅ SÍ — para confirmar\n❌ NO — para cancelar\n\nTe esperamos en C/ Ejemplo 123. ¡Hasta mañana!',
        vars: ['{{nombre}}', '{{fecha}}', '{{hora}}', '{{doctor}}']
    },
    {
        id: 'wa-reminder-2h', name: 'Recordatorio cita 2h (no confirmado)', type: 'whatsapp', category: 'Recordatorios',
        content: '⏰ Hola {{nombre}}, tu cita en Rubio García Dental es HOY a las {{hora}}h.\n\nSi necesitas cancelar llámanos al 912 345 678. ¡Te esperamos!',
        vars: ['{{nombre}}', '{{hora}}']
    },
    {
        id: 'wa-cita-creada', name: 'Confirmación nueva cita', type: 'whatsapp', category: 'Recordatorios',
        content: '✅ Cita confirmada en Rubio García Dental\n\n📅 {{fecha}}\n⏰ {{hora}}h\n👨‍⚕️ {{doctor}}\n🦷 {{tratamiento}}\n\n¿Necesitas cambiarla? Escríbenos o llama al 912 345 678.',
        vars: ['{{fecha}}', '{{hora}}', '{{doctor}}', '{{tratamiento}}']
    },
    {
        id: 'wa-post-visit', name: 'Seguimiento post-visita', type: 'whatsapp', category: 'Seguimiento',
        content: '💙 Hola {{nombre}}, ¿cómo te encuentras tras tu visita del {{fecha}}?\n\nSi tienes alguna molestia, duda o pregunta, estamos aquí para ayudarte. Solo escríbenos y te atendemos en breve.\n\n¡Esperamos que te hayas recuperado estupendamente! 😊',
        vars: ['{{nombre}}', '{{fecha}}']
    },
    {
        id: 'wa-post-surgery-d0', name: 'Post-quirúrgico Día 0', type: 'whatsapp', category: 'Seguimiento',
        content: '🦷 Post-operatorio — Rubio García Dental\n\nHola {{nombre}}, aquí tienes las instrucciones para las próximas horas:\n\n• Morder la gasa 30 minutos\n• NO enjuagarte ni escupir las primeras 24h\n• Aplica frío externo 20min ON / 20min OFF\n• Toma {{medicacion}} si hay malestar\n• Alimentación blanda y fría las primeras 24h\n• NO fumar ni alcohol\n\n🚨 Si hay sangrado abundante o fiebre, llámanos al 912 345 678.\n\n¡Recupérate pronto! 💙',
        vars: ['{{nombre}}', '{{medicacion}}']
    },
    {
        id: 'wa-post-surgery-d2', name: 'Post-quirúrgico Día 2', type: 'whatsapp', category: 'Seguimiento',
        content: '👋 Hola {{nombre}}, han pasado un par de días desde tu intervención.\n\n¿Cómo lo estás llevando? ¿Tienes dolor o alguna molestia?\n\nResponde tranquilamente y te ayudamos. Si es urgente, llama al 912 345 678.',
        vars: ['{{nombre}}']
    },
    {
        id: 'wa-post-surgery-d7', name: 'Post-quirúrgico Día 7 — Cita revisión', type: 'whatsapp', category: 'Seguimiento',
        content: '🦷 Hola {{nombre}}, mañana se cumplen 7 días desde tu intervención. Es el momento de la revisión.\n\n¿Quieres que te busquemos un hueco esta semana? Solo dinos qué día y hora te viene mejor. ¡Queremos ver cómo evoluciona todo!',
        vars: ['{{nombre}}']
    },
    {
        id: 'wa-implant-2m', name: 'Seguimiento implante 2-3 meses', type: 'whatsapp', category: 'Seguimiento',
        content: '🦷 Hola {{nombre}}, han pasado aproximadamente {{meses}} meses desde tu cirugía de implante.\n\n¿Cómo lo notas? ¿Alguna molestia o pregunta?\n\nEn breve nos pondremos en contacto para programar tu revisión de osteointegración. ¡Todo va estupendamente!',
        vars: ['{{nombre}}', '{{meses}}']
    },
    {
        id: 'wa-ortho-2m', name: 'Revisión ortodoncia 2 meses', type: 'whatsapp', category: 'Seguimiento',
        content: '😊 Hola {{nombre}}, han pasado 2 meses desde que finalizaste tu ortodoncia. ¡Qué rápido!\n\n¿Llevas bien la retención? ¿El retenedor cómodo?\n\nTe recomendamos una revisión rápida y gratuita. ¿Cuándo te viene bien?',
        vars: ['{{nombre}}']
    },
    {
        id: 'wa-ortho-6m', name: 'Revisión ortodoncia 6 meses', type: 'whatsapp', category: 'Seguimiento',
        content: '🦷 Hola {{nombre}}, ya han pasado 6 meses desde que terminaste tu ortodoncia. ¡El tiempo vuela!\n\nEs el momento de comprobar que tus dientes mantienen su posición perfecta. Te citamos para una revisión rápida y sin coste. ¿Te parece bien?',
        vars: ['{{nombre}}']
    },
    {
        id: 'wa-recall-6m', name: 'Revisión higiene semestral', type: 'whatsapp', category: 'Recaptación',
        content: '✨ Hola {{nombre}}, han pasado 6 meses desde tu última revisión de higiene dental.\n\n¡Tus dientes te lo agradecerán! 😊 ¿Buscamos un hueco para tu próxima limpieza?\n\nEscríbenos o llama al 912 345 678.',
        vars: ['{{nombre}}']
    },
    {
        id: 'wa-recall-12m', name: 'Recaptación paciente inactivo +1 año', type: 'whatsapp', category: 'Recaptación',
        content: '👋 Hola {{nombre}}, hace tiempo que no sabemos nada de ti. ¿Todo bien?\n\nTe echamos de menos en la clínica. ¿Aprovechamos para hacer tu revisión anual? Tu salud bucodental es importante.\n\n¡Escríbenos cuando quieras!',
        vars: ['{{nombre}}']
    },
    {
        id: 'wa-review', name: 'Solicitud de reseña', type: 'whatsapp', category: 'Recaptación',
        content: '⭐ Hola {{nombre}}, esperamos que tu experiencia en Rubio García Dental haya sido excelente.\n\nSi pudieras dejarnos una breve reseña en Google, nos ayudarías muchísimo:\n👉 {{enlace_resena}}\n\n¡Solo 30 segundos y significa mucho para nosotros! Gracias 🙏',
        vars: ['{{nombre}}', '{{enlace_resena}}']
    },
    {
        id: 'wa-birthday', name: 'Felicitación cumpleaños', type: 'whatsapp', category: 'Recaptación',
        content: '🎂 ¡Feliz cumpleaños, {{nombre}}!\n\nTodo el equipo de Rubio García Dental te desea un día maravilloso lleno de sonrisas 😊\n\nComo regalo de parte de la clínica, hoy tienes una REVISIÓN GRATUITA esperándote. ¡Escríbenos para reservar tu regalo!',
        vars: ['{{nombre}}']
    },
    {
        id: 'wa-noshow', name: 'No presentado — reagendar', type: 'whatsapp', category: 'Gestión',
        content: '😊 Hola {{nombre}}, vemos que hoy no has podido venir a tu cita de las {{hora}}h. ¡No pasa nada!\n\nCuando quieras escríbenos o llama al 912 345 678 y te buscamos otro hueco rápidamente.\n\nEsperamos que todo esté bien. 💙',
        vars: ['{{nombre}}', '{{hora}}']
    },
    {
        id: 'wa-recibo-efectivo', name: 'Recibo pago en efectivo', type: 'whatsapp', category: 'Pagos',
        content: '🧾 RECIBO DE PAGO\nRubio García Dental\n\n👤 {{nombre}}\n📋 Concepto: {{tratamiento}}\n💰 Importe: {{importe}}€ (efectivo)\n📅 Fecha: {{fecha}}\n🧾 Ref: {{num_recibo}}\n\n¡Gracias por tu visita! 😊',
        vars: ['{{nombre}}', '{{tratamiento}}', '{{importe}}', '{{fecha}}', '{{num_recibo}}']
    },
    {
        id: 'wa-urgencia', name: 'Respuesta automática urgencias', type: 'whatsapp', category: 'Urgencias',
        content: '🚨 Hola, estamos fuera de horario y hemos recibido tu mensaje.\n\nPara URGENCIAS llama ahora al: 📞 {{telefono_urgencias}}\n\nMientras esperas:\n• No toques ni manipules la zona\n• Toma Ibuprofeno 600mg si tienes dolor\n• Aplica frío exterior (nunca directo)\n• Si hay sangrado: presiona con gasa limpia\n\nEn horario laboral te atenderemos inmediatamente. ¡Cuídate! 💙',
        vars: ['{{telefono_urgencias}}']
    },
    {
        id: 'wa-first-visit-reminder', name: 'Recordatorio primera visita', type: 'whatsapp', category: 'Recordatorios',
        content: '👋 Hola {{nombre}}, te esperamos mañana {{fecha}} a las {{hora}}h para tu primera visita en Rubio García Dental.\n\n📍 Cómo llegar: C/ Ejemplo 123, Madrid (Metro Gran Vía, salida 2)\n🅿️ Parking gratuito en la calle\n\nTrae: tu DNI y, si tienes, informes de tratamientos anteriores.\n\n¡Estamos deseando conocerte! 😊',
        vars: ['{{nombre}}', '{{fecha}}', '{{hora}}']
    },
    // ── SMS ──
    {
        id: 'sms-2h', name: 'SMS recordatorio 2h', type: 'sms', category: 'Recordatorios',
        content: 'Rubio García Dental: Tu cita es HOY a las {{hora}}h. Llámanos al 912345678 si necesitas cancelar.',
        vars: ['{{hora}}']
    },
    {
        id: 'sms-deuda', name: 'SMS recordatorio deuda', type: 'sms', category: 'Pagos',
        content: 'Rubio García Dental: Tienes un pago pendiente de {{importe}}€. Llámanos al 912345678 o visítanos para regularizarlo.',
        vars: ['{{importe}}']
    },
    // ── Email ──
    {
        id: 'email-consentimiento', name: 'Email consentimiento para firma', type: 'email', category: 'Documentos',
        content: 'Asunto: Consentimiento informado — Su cita del {{fecha}}\n\nEstimado/a {{nombre}},\n\nGracias por confirmar su cita del {{fecha}} a las {{hora}}h para {{tratamiento}}.\n\nAntes de su visita, necesitamos su firma en el documento de consentimiento informado. Puede firmarlo digitalmente en el siguiente enlace en menos de 2 minutos:\n\n👉 {{enlace_consentimiento}}\n\nSi tiene alguna duda sobre el procedimiento, no dude en contactarnos.\n\nAtentamente,\nEquipo Rubio García Dental\nTel: 912 345 678',
        vars: ['{{nombre}}', '{{fecha}}', '{{hora}}', '{{tratamiento}}', '{{enlace_consentimiento}}']
    },
    {
        id: 'email-factura', name: 'Email factura paciente/doctor', type: 'email', category: 'Pagos',
        content: 'Asunto: Factura {{num_factura}} — Rubio García Dental\n\nEstimado/a {{nombre}},\n\nAdjunto encontrará la factura correspondiente a:\n\n• Fecha: {{fecha}}\n• Concepto: {{tratamiento}}\n• Importe: {{importe}}€\n• Método de pago: {{metodo_pago}}\n• Nº Factura: {{num_factura}}\n\nConserve este documento para su declaración fiscal.\n\nGracias por confiar en Rubio García Dental.\n\nAtentamente,\nAdministración — Rubio García Dental',
        vars: ['{{nombre}}', '{{fecha}}', '{{tratamiento}}', '{{importe}}', '{{metodo_pago}}', '{{num_factura}}']
    },
    {
        id: 'email-gestoria', name: 'Email mensual a gestoría', type: 'email', category: 'Gestión interna',
        content: 'Asunto: Documentación fiscal {{mes}} {{año}} — Rubio García Dental\n\nEstimada gestoría,\n\nAdjuntamos la documentación correspondiente al mes de {{mes}} {{año}}:\n\n• {{n_facturas}} facturas emitidas\n• Total facturado: {{total_facturado}}€\n• IVA repercutido: {{iva}}€\n• Libro de caja: adjunto\n\nEl archivo está protegido con la contraseña habitual.\n\nQuedamos a su disposición.\n\nRubio García Dental\nCIF: {{cif}}',
        vars: ['{{mes}}', '{{año}}', '{{n_facturas}}', '{{total_facturado}}', '{{iva}}', '{{cif}}']
    },
    {
        id: 'email-deuda', name: 'Email recordatorio deuda', type: 'email', category: 'Pagos',
        content: 'Asunto: Saldo pendiente — Rubio García Dental\n\nEstimado/a {{nombre}},\n\nLe informamos de que existe un saldo pendiente de {{importe}}€ correspondiente a {{tratamiento}} del {{fecha_tratamiento}}.\n\nPuede liquidarlo cómodamente mediante:\n• Bizum: {{bizum}}\n• Transferencia: ES00 0000 0000 0000 0000 0000\n• En su próxima visita\n\nSi ya ha realizado el pago, disculpe las molestias.\n\nGracias,\nAdministración — Rubio García Dental',
        vars: ['{{nombre}}', '{{importe}}', '{{tratamiento}}', '{{fecha_tratamiento}}', '{{bizum}}']
    },
    // ── Documentos ──
    {
        id: 'doc-consent-implante', name: 'Consentimiento Implante Dental', type: 'documento', category: 'Consentimientos',
        content: 'CONSENTIMIENTO INFORMADO — IMPLANTE DENTAL\n\nPaciente: {{nombre}} | DNI: {{dni}} | Fecha: {{fecha}}\n\nDr./Dra.: {{doctor}}\n\nSe le va a realizar un implante dental en la posición {{posicion}}.\n\nBENEFICIOS: Restauración funcional y estética de la pieza perdida con una solución fija y duradera.\n\nRIESGOS POSIBLES: Infección, rechazo del implante, lesión de estructuras adyacentes, parestesias transitorias, sinusitis (implantes superiores), fracaso de la osteointegración.\n\nALTERNATIVAS: Prótesis removible, puente fijo sobre dientes naturales.\n\nACTUACIÓN EN URGENCIAS: {{telefono_urgencias}}\n\nDOY MI CONSENTIMIENTO para la realización del procedimiento descrito, habiendo sido informado de los riesgos y alternativas.\n\nFirma del paciente: ___________________\nFecha: {{fecha}}',
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}', '{{doctor}}', '{{posicion}}', '{{telefono_urgencias}}']
    },
    {
        id: 'doc-consent-extraccion', name: 'Consentimiento Extracción Dental', type: 'documento', category: 'Consentimientos',
        content: 'CONSENTIMIENTO INFORMADO — EXTRACCIÓN DENTAL\n\nPaciente: {{nombre}} | DNI: {{dni}} | Fecha: {{fecha}}\n\nSe le extraerá la pieza dental {{pieza}}.\n\nBENEFICIOS: Eliminación del foco infeccioso o causa de dolor, mejora de la salud bucodental.\n\nRIESGOS: Sangrado postoperatorio, infección, alveolitis seca, parestesia temporal, comunicación sinusal.\n\nCUIDADOS POST-EXTRACCIÓN: Morder la gasa indicada, no enjuagarse 24h, alimentación blanda y fría.\n\nDOY MI CONSENTIMIENTO para la extracción descrita.\n\nFirma: ___________________ Fecha: {{fecha}}',
        vars: ['{{nombre}}', '{{dni}}', '{{fecha}}', '{{pieza}}']
    },
    {
        id: 'doc-consent-blanqueamiento', name: 'Consentimiento Blanqueamiento', type: 'documento', category: 'Consentimientos',
        content: 'CONSENTIMIENTO INFORMADO — BLANQUEAMIENTO DENTAL\n\nPaciente: {{nombre}} | Fecha: {{fecha}}\n\nSe realizará blanqueamiento dental con peróxido de hidrógeno al {{concentracion}}%.\n\nBENEFICIOS: Aclaramiento de varios tonos del color dental.\n\nRIESGOS: Sensibilidad dental temporal, irritación gingival transitoria. Las fundas, carillas y coronas NO cambian de color.\n\nCONTRAINDICACIONES: Embarazo, lactancia, hipersensibilidad conocida.\n\nFirma: ___________________ Fecha: {{fecha}}',
        vars: ['{{nombre}}', '{{fecha}}', '{{concentracion}}']
    },
    {
        id: 'doc-consent-ortodoncia', name: 'Consentimiento Ortodoncia', type: 'documento', category: 'Consentimientos',
        content: 'CONSENTIMIENTO INFORMADO — TRATAMIENTO ORTODÓNCICO\n\nPaciente (o tutor): {{nombre}} | Fecha: {{fecha}}\n\nTratamiento planificado: {{tipo_ortodoncia}} — Duración estimada: {{duracion}}\n\nRIESGOS: Descalcificaciones si higiene deficiente, reabsorción radicular leve, molestias durante ajustes, recidiva si no se usa retenedor.\n\nCOMPROMISO DEL PACIENTE: Visitas cada {{semanas_revision}} semanas, higiene exhaustiva, uso del retenedor indefinido tras el tratamiento.\n\nFirma: ___________________ Fecha: {{fecha}}',
        vars: ['{{nombre}}', '{{fecha}}', '{{tipo_ortodoncia}}', '{{duracion}}', '{{semanas_revision}}']
    },
    {
        id: 'doc-instrucciones-postop', name: 'Instrucciones post-operatorias', type: 'documento', category: 'Instrucciones',
        content: 'INSTRUCCIONES POSTOPERATORIAS\n\nPaciente: {{nombre}} — Fecha intervención: {{fecha}}\nProcedimiento: {{tratamiento}}\n\n✅ LO QUE DEBE HACER:\n• Morder la gasa 30 minutos\n• Aplicar frío externo 20min ON / 20min OFF las primeras 6h\n• Dieta blanda y fría 24-48h\n• Tomar la medicación prescrita: {{medicacion}}\n• Reposar el día de la intervención\n\n❌ LO QUE DEBE EVITAR:\n• Enjuagarse las primeras 24h\n• Fumar o consumir alcohol\n• Actividad física intensa 48h\n• Alimentos duros o calientes\n\n🚨 LLAME AL {{telefono}} SI:\n• Sangrado que no cede\n• Fiebre superior a 38°C\n• Dolor muy intenso que no mejora con analgésicos\n• Hinchazón que aumenta después del 3er día',
        vars: ['{{nombre}}', '{{fecha}}', '{{tratamiento}}', '{{medicacion}}', '{{telefono}}']
    },
    // ── Cuestionarios ──
    {
        id: 'quest-primera-visita', name: 'Cuestionario Primera Visita (Anamnesis)', type: 'cuestionario', category: 'Cuestionarios',
        content: 'CUESTIONARIO DE SALUD — PRIMERA VISITA\nRubio García Dental\n\nNombre completo: ___________________\nFecha nacimiento: ___________________\nTeléfono: ___________________ Email: ___________________\n\n¿ESTÁ ACTUALMENTE BAJO TRATAMIENTO MÉDICO?\n□ No  □ Sí — Especifique: ___________________\n\n¿TOMA ALGÚN MEDICAMENTO HABITUALMENTE?\n□ No  □ Sí — ¿Cuál/es?: ___________________\n\n¿ES ALÉRGICO A ALGÚN MEDICAMENTO O MATERIAL DENTAL?\n□ No  □ Sí — ¿A qué?: ___________________\n\n¿PADECE ALGUNA DE ESTAS ENFERMEDADES?\n□ Diabetes  □ Hipertensión  □ Cardiopatía  □ Anticoagulantes\n□ Osteoporosis  □ Hepatitis/VIH  □ Cáncer  □ Embarazo (semana: ___)\n□ Otra: ___________________\n\n¿HA TENIDO ALGÚN PROBLEMA CON ANESTESIA LOCAL?\n□ No  □ Sí — Describa: ___________________\n\n¿CUÁNDO FUE SU ÚLTIMA VISITA AL DENTISTA?\n___________________\n\n¿MOTIVO DE CONSULTA HOY?\n___________________\n\nFirma: ___________________ Fecha: ___________________',
        vars: []
    },
    {
        id: 'quest-satisfaccion', name: 'Cuestionario satisfacción post-visita', type: 'cuestionario', category: 'Cuestionarios',
        content: 'ENCUESTA DE SATISFACCIÓN — RUBIO GARCÍA DENTAL\n\nPaciente: {{nombre}} | Fecha visita: {{fecha}}\n\n1. ¿Cómo valorarías tu experiencia general? (1-5 ⭐)\n   □ 1  □ 2  □ 3  □ 4  □ 5\n\n2. ¿El tiempo de espera fue razonable?\n   □ Muy corto  □ Correcto  □ Algo largo  □ Demasiado largo\n\n3. ¿Cómo fue la atención del personal?\n   □ Excelente  □ Buena  □ Mejorable  □ Mala\n\n4. ¿Quedaste satisfecho del resultado clínico?\n   □ Muy satisfecho  □ Satisfecho  □ Poco satisfecho  □ No satisfecho\n\n5. ¿Recomendarías Rubio García Dental?\n   □ Definitivamente sí  □ Probablemente sí  □ No lo sé  □ No\n\n6. Comentarios y sugerencias:\n___________________\n\nGracias por tu tiempo. Tu opinión nos ayuda a mejorar.',
        vars: ['{{nombre}}', '{{fecha}}']
    },
];

const TYPE_CONFIG: Record<TemplateType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'text-[#051650]', bg: 'bg-blue-50 border-green-200' },
    sms: { label: 'SMS', icon: MessageSquare, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    email: { label: 'Email', icon: Mail, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
    documento: { label: 'Documento', icon: FileText, color: 'text-[#051650]', bg: 'bg-[#FEFDE8] border-[#FBFFA3]' },
    cuestionario: { label: 'Cuestionario', icon: Clipboard, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
};

export const Plantillas: React.FC = () => {
    const [templates, setTemplates] = useState<Template[]>(TEMPLATES);
    const [filterType, setFilterType] = useState<TemplateType | 'all'>('all');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<Template | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const filtered = templates
        .filter(t => filterType === 'all' || t.type === filterType)
        .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));

    const handleSave = (t: Template) => {
        setTemplates(p => p.map(x => x.id === t.id ? t : x));
        setEditing(null);
    };

    const copyTemplate = (t: Template) => {
        navigator.clipboard.writeText(t.content).catch(() => { });
        setCopied(t.id);
        setTimeout(() => setCopied(null), 1500);
    };

    const categories = [...new Set(filtered.map(t => t.category))];

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar plantilla..." className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20 w-56" />
                <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setFilterType('all')} className={`px-2.5 py-1 rounded-xl text-[12px] font-bold uppercase transition-all ${filterType === 'all' ? 'bg-[#0056b3] text-white' : 'bg-white border border-slate-200 text-slate-400 hover:border-[#0056b3]/30'}`}>Todas</button>
                    {(Object.keys(TYPE_CONFIG) as TemplateType[]).map(type => {
                        const tc = TYPE_CONFIG[type]; const Icon = tc.icon;
                        return (
                            <button key={type} onClick={() => setFilterType(type)} className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[12px] font-bold uppercase transition-all ${filterType === type ? 'bg-[#0056b3] text-white' : 'bg-white border border-slate-200 text-slate-400 hover:border-[#0056b3]/30'}`}>
                                <Icon className="w-3 h-3" />{tc.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Groups by category */}
            {editing ? (
                /* ── Editor ── */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-[#051650] uppercase tracking-widest flex items-center gap-2"><Edit3 className="w-4 h-4 text-[#0056b3]" />Editando: {editing.name}</span>
                        <button onClick={() => setEditing(null)} className="text-slate-300 hover:text-slate-500"><X className="w-4 h-4" /></button>
                    </div>
                    <div>
                        <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                        <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Contenido</label>
                            <div className="flex gap-1 flex-wrap justify-end">
                                {['{{nombre}}', '{{fecha}}', '{{hora}}', '{{doctor}}', '{{tratamiento}}', '{{importe}}', '{{enlace}}'].map(v => (
                                    <button key={v} onClick={() => setEditing({ ...editing, content: editing.content + ' ' + v })}
                                        className="text-[12px] font-bold px-1.5 py-0.5 bg-[#0056b3]/10 text-[#0056b3] rounded border border-[#0056b3]/20 hover:bg-[#0056b3]/20 font-mono">{v}</button>
                                ))}
                            </div>
                        </div>
                        <textarea value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })} rows={12}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20 resize-none" />
                    </div>
                    <button onClick={() => handleSave(editing)} className="flex items-center gap-2 px-4 py-2 bg-[#0056b3] text-white rounded-xl text-[12px] font-bold uppercase hover:bg-[#004494] transition-all">
                        <Save className="w-3.5 h-3.5" />Guardar plantilla
                    </button>
                </div>
            ) : (
                categories.map(cat => {
                    const items = filtered.filter(t => t.category === cat);
                    return (
                        <div key={cat} className="space-y-2">
                            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest px-1">{cat}</p>
                            {items.map(t => {
                                const tc = TYPE_CONFIG[t.type]; const Icon = tc.icon;
                                return (
                                    <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3 px-4 py-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${tc.bg}`}>
                                                <Icon className={`w-4 h-4 ${tc.color}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-bold text-[#051650] truncate">{t.name}</p>
                                                <p className="text-[12px] text-slate-400 truncate">{t.content.split('\n')[0].slice(0, 60)}…</p>
                                            </div>
                                            <div className="flex gap-1.5 shrink-0">
                                                <button onClick={() => copyTemplate(t)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-bold transition-all ${copied === t.id ? 'bg-blue-500 text-white' : 'border border-slate-200 text-slate-500 hover:border-[#0056b3]/30 hover:text-[#0056b3]'}`}>
                                                    {copied === t.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                    {copied === t.id ? '¡Copiado!' : 'Copiar'}
                                                </button>
                                                <button onClick={() => setEditing(t)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-500 hover:border-[#0056b3]/30 hover:text-[#0056b3] transition-all">
                                                    <Edit3 className="w-3 h-3" />Editar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default Plantillas;
