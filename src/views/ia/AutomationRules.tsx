import React, { useState, useEffect } from 'react';
import {
    ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
    Settings2, Play, Clock, MessageSquare, Phone, Mail,
    Zap, Activity, X, Save, CheckCircle2, Loader2
} from 'lucide-react';
import { getAutomations, toggleAutomation, saveAutomation } from '../../services/automations.service';

export type AutoCategory = 'recordatorio' | 'seguimiento' | 'recaptacion' | 'pago' | 'documento' | 'urgencia' | 'clinico' | 'gestion' | 'primera_visita';

export interface Automation {
    id: string; name: string; description: string; trigger: string;
    channel: 'whatsapp' | 'sms' | 'email' | 'multi' | 'interno';
    category: AutoCategory; active: boolean; executions: number; successRate: number;
    timing: string; example: string;
    config: { delayValue: number; delayUnit: string; message: string; channel: string; schedule: string; conditions: string };
}

const CH: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'text-[#051650]' },
    sms: { label: 'SMS', icon: Phone, color: 'text-blue-600' },
    email: { label: 'Email', icon: Mail, color: 'text-indigo-600' },
    multi: { label: 'Multi', icon: Zap, color: 'text-purple-600' },
    interno: { label: 'Interno', icon: Activity, color: 'text-slate-500' },
};

const GROUPS: { key: AutoCategory; label: string; border: string; bg: string; ids: string[] }[] = [
    { key: 'recordatorio', label: '🔔 Recordatorios', border: 'border-blue-200', bg: 'bg-blue-50/40', ids: ['rem-24h', 'rem-2h', 'rem-created', 'rem-ortho-2m', 'rem-ortho-6m', 'rem-pediatric'] },
    { key: 'seguimiento', label: '💙 Seguimiento Clínico', border: 'border-[#FFC0CB]', bg: 'bg-[#FFF0F3]/40', ids: ['post-basic', 'post-surgery', 'post-implant-2m', 'post-recs', 'doctor-alert', 'doctor-followup'] },
    { key: 'recaptacion', label: '✨ Recaptación y Fidelización', border: 'border-blue-200', bg: 'bg-blue-50/40', ids: ['recall-6m', 'recall-annual', 'review-request', 'birthday'] },
    { key: 'documento', label: '📄 Documentos y Legal', border: 'border-indigo-200', bg: 'bg-indigo-50/40', ids: ['consent-confirmed', 'consent-received', 'first-visit-questionnaire', 'gestor-docs'] },
    { key: 'primera_visita', label: '🏥 Primera Visita', border: 'border-pink-200', bg: 'bg-pink-50/40', ids: ['pv-booking-confirm', 'pv-24h-forms', 'pv-forms-done', 'pv-tutor-route'] },
    { key: 'pago', label: '💳 Cobros y Facturación', border: 'border-orange-200', bg: 'bg-orange-50/40', ids: ['invoice-doctor', 'receipt-cash', 'payment-reminder'] },
    { key: 'gestion', label: '⚙️ Gestión de Agenda', border: 'border-slate-200', bg: 'bg-slate-50/40', ids: ['no-show', 'confirm-status'] },
    { key: 'urgencia', label: '🚨 Urgencias', border: 'border-[#FFC0CB]', bg: 'bg-[#FFF0F3]/40', ids: ['urgency-auto'] },
];

const mk = (id: string, name: string, desc: string, trigger: string, ch: Automation['channel'], cat: AutoCategory, active: boolean, runs: number, rate: number, timing: string, example: string): Automation => ({
    id, name, description: desc, trigger, channel: ch, category: cat, active, executions: runs, successRate: rate, timing, example,
    config: { delayValue: 24, delayUnit: 'horas', message: example, channel: ch, schedule: 'Cualquier hora', conditions: '' }
});

export const INITIAL_AUTOMATIONS: Automation[] = [
    mk('rem-24h', 'Recordatorio 24h antes', 'WhatsApp 24h antes con datos de la cita. Respuesta SÍ/NO actualiza agenda.', 'Cita programada — 24h antes', 'whatsapp', 'recordatorio', true, 1248, 94, '24h antes', '👋 Hola {{nombre}}, recordamos tu cita mañana {{fecha}} a las {{hora}}h con {{doctor}}. Responde SÍ para confirmar o NO para cancelar.'),
    mk('rem-2h', 'Recordatorio 2h (no confirmados)', 'SMS 2h antes si el paciente no confirmó.', 'Cita no confirmada — 2h antes', 'sms', 'recordatorio', true, 387, 81, '2h antes', '⏰ Tu cita es HOY a las {{hora}}h — Rubio García Dental. Llámanos si necesitas cancelar.'),
    mk('rem-created', 'Confirmación al crear/modificar cita', 'Mensaje automático al crear o editar una cita.', 'Creación o edición de cita', 'whatsapp', 'recordatorio', true, 892, 99, 'Inmediato', '✅ Cita confirmada: {{fecha}} a las {{hora}}h — {{doctor}}. ¿Necesitas cambiarla? Escríbenos.'),
    mk('rem-ortho-2m', 'Revisión Ortodoncia — 2 meses', 'Seguimiento retención 2 meses post-ortodoncia.', 'Cierre Ortodoncia — 60 días', 'whatsapp', 'recordatorio', true, 78, 86, '2m post-ortodoncia', '😊 Hola {{nombre}}, ¿cómo llevas la retención? Te preparamos una revisión rápida y gratuita.'),
    mk('rem-ortho-6m', 'Revisión Ortodoncia — 6 meses', 'Revisión semestral de retención.', 'Cierre Ortodoncia — 180 días', 'whatsapp', 'recordatorio', true, 41, 83, '6m post-ortodoncia', '🦷 Hola {{nombre}}, han pasado 6 meses. ¡Revisemos que tu sonrisa sigue perfecta!'),
    mk('rem-pediatric', 'Recordatorio pediátrico al tutor', 'Para menores de 14 años, aviso al tutor.', 'Cita paciente <14 años — 48h', 'whatsapp', 'recordatorio', false, 94, 89, '48h antes', '👶 Cita para {{nombre_menor}} mañana a las {{hora}}h. Explícale que es solo una revisión para que venga tranquila.'),
    mk('post-basic', 'Seguimiento Post-Visita', '48h después pregunta cómo está. Respuestas preocupantes escalan al doctor.', 'Cierre sesión gabinete — 48h', 'whatsapp', 'seguimiento', true, 892, 88, '48h después', '💙 Hola {{nombre}}, ¿cómo te encuentras tras tu visita del {{fecha}}? Si tienes molestias, escríbenos.'),
    mk('post-surgery', 'Protocolo Post-Quirúrgico', 'Secuencia 3 mensajes: instrucciones (día 0), dolor (día 2), revisión (día 7).', 'Cierre Cirugía/Implante', 'multi', 'seguimiento', true, 214, 97, 'Día 0/2/7', '🦷 Post-op {{nombre}}: morder gasa 30min, Ibuprofeno 600mg si hay malestar. Llámanos si lo necesitas.'),
    mk('post-implant-2m', 'Seguimiento implante 2-3 meses', 'Seguimiento osteointegración 75 días post-cirugía.', 'Cirugía implante — 75 días', 'whatsapp', 'seguimiento', true, 87, 94, '75 días', '🦷 Hola {{nombre}}, ¿cómo notas el implante? En breve programamos tu revisión de osteointegración.'),
    mk('post-recs', 'Recomendaciones post-tratamiento', 'Cuidados específicos según el tipo de tratamiento.', 'Cierre gabinete — según categoría', 'whatsapp', 'seguimiento', true, 463, 92, 'Inmediato', '📋 Tras tu {{tratamiento}}, {{nombre}}: {{recomendaciones_especificas}}. ¡Tu nueva sonrisa te lo agradecerá!'),
    mk('doctor-alert', 'Alerta por mensaje preocupante', 'Palabras clave de alarma → alerta interna al doctor.', 'Palabras clave alarma en WhatsApp', 'interno', 'clinico', true, 29, 100, 'Tiempo real', '🚨 [INTERNO] {{nombre_paciente}} ha enviado un mensaje de alarma: "{{mensaje}}". Revisar urgente.'),
    mk('doctor-followup', 'Seguimiento por petición del doctor', 'Doctor activa flujo personalizado desde ficha del paciente.', 'Activación manual desde ficha', 'whatsapp', 'clinico', true, 56, 91, 'Manual', '👨‍⚕️ Hola {{nombre}}, el {{doctor}} quiere saber cómo estás. ¿Tienes alguna duda o molestia?'),
    mk('recall-6m', 'Revisión Semestral Higiene', '6 meses tras última higiene, invitación nueva revisión.', 'Última higiene — 6 meses', 'whatsapp', 'recaptacion', true, 563, 62, '6 meses', '✨ Hola {{nombre}}, han pasado 6 meses desde tu higiene. Tus dientes te lo agradecerán 😊 ¿Buscamos un hueco?'),
    mk('recall-annual', 'Recaptación Paciente Inactivo', '+12 meses sin cita → mensaje para reactivar.', 'Sin cita — +12 meses', 'whatsapp', 'recaptacion', true, 328, 41, '12 meses inactivo', '👋 Hola {{nombre}}, hace tiempo que no sabemos nada de ti. ¿Aprovechamos para tu revisión anual?'),
    mk('review-request', 'Solicitud de Reseña', 'Tras cita satisfactoria, solicita reseña con enlace directo.', 'Cita finalizada sin incidencias — 24h', 'whatsapp', 'recaptacion', true, 412, 34, '24h post-cita', '⭐ Hola {{nombre}}, ¿quedaste satisfecho/a? Nos ayudarías mucho con una reseña en Google: {{enlace_reseña}}. ¡Gracias!'),
    mk('birthday', 'Felicitación de Cumpleaños', 'Mensaje personalizado el día del cumpleaños.', 'Fecha nacimiento — día exacto', 'whatsapp', 'recaptacion', true, 412, 78, 'Día cumpleaños', '🎂 ¡Feliz cumpleaños, {{nombre}}! Todo el equipo te desea un día especial. Te regalamos una revisión gratuita.'),
    mk('consent-confirmed', 'Consentimiento tras confirmar cita', 'Al confirmar, envío de consentimiento digital para firma.', 'Cita → estado Confirmada', 'email', 'documento', true, 156, 91, 'Al confirmar', '📄 Hola {{nombre}}, has confirmado tu cita del {{fecha}}. Necesitamos tu consentimiento firmado antes de la visita: {{enlace_consentimiento}}'),
    mk('consent-received', 'Notificación consentimiento firmado', 'Al recibir firma, actualiza ficha y notifica al doctor.', 'Firma digital recibida', 'interno', 'documento', true, 143, 100, 'Al firmar', '✅ [INTERNO] {{nombre}} ha firmado el consentimiento de {{tratamiento}}. Guardado en ficha. Cita: consentimiento ✓'),
    mk('first-visit-questionnaire', 'Cuestionario Primera Visita', 'Para nuevos pacientes: anamnesis digital en 8 secciones. Envío automático 72h antes con enlace de token único. Recordatorio 24h antes si no completado. Al completar: alertas clínicas automáticas (anticoagulantes, bisfosfonatos, alergias) y volcado en ficha del paciente.', 'Primera cita para paciente nuevo', 'whatsapp', 'documento', true, 201, 87, '72h antes primera visita', '📋 ¡Bienvenido/a a Rubio García Dental, {{nombre}}! Antes de tu primera visita el {{fecha_cita}}, completa este cuestionario de salud en 3-5 minutos 👉 {{enlace_cuestionario}}  ⏰ El enlace expira 1h tras tu cita. ¿Dudas? 📞 {{telefono_clinica}}'),
    mk('gestor-docs', 'Envío mensual a gestoría', 'Exportación automática de facturas a la gestoría.', 'Fin de mes / fecha configurable', 'email', 'documento', false, 12, 100, 'Fin de mes', '📁 [Gestoría] Documentación {{mes}} {{año}} — Rubio García Dental. Adjunta: {{n_facturas}} facturas.'),
    mk('invoice-doctor', 'Factura tras pago realizado', 'Al registrar cobro, genera y envía factura PDF.', 'Pago registrado en sistema', 'email', 'pago', true, 678, 100, 'Inmediato', '📧 Factura {{num_factura}} — {{nombre}} — {{tratamiento}} — {{importe}}€ — Pagado el {{fecha}}.'),
    mk('receipt-cash', 'Recibo WhatsApp pago efectivo', 'Al marcar cobro efectivo, recibo WhatsApp inmediato.', 'Pago efectivo en caja', 'whatsapp', 'pago', true, 234, 100, 'Inmediato', '🧾 RECIBO — Rubio García Dental\nConcepto: {{tratamiento}}\nImporte: {{importe}}€ (efectivo)\nFecha: {{fecha}}\n¡Gracias, {{nombre}}!'),
    mk('payment-reminder', 'Recordatorio deuda pendiente', 'Si deuda >30 días, aviso amable con opciones de pago.', 'Deuda activa — >30 días', 'email', 'pago', false, 89, 58, '30 días deuda', '📋 Hola {{nombre}}, tienes un saldo pendiente de {{importe}}€. Puedes pagarlo por Bizum al {{bizum}} o en tu próxima visita.'),
    mk('no-show', 'Gestión No Presentado', 'Cita no presentada → mensaje conciliador reagendando.', 'Cita marcada No Presentado', 'whatsapp', 'gestion', true, 203, 54, 'Al marcar', '😊 Hola {{nombre}}, vemos que no pudiste venir hoy. ¡No pasa nada! ¿Buscamos otro hueco?'),
    mk('confirm-status', 'Actualización estado según respuesta', 'Respuesta SÍ → Confirmada. NO → Cancelada, hueco liberado.', 'Respuesta paciente: SÍ / NO', 'interno', 'gestion', true, 834, 98, 'Tiempo real', '[INTERNO] {{nombre}} respondió {{respuesta}} → Cita {{fecha}} actualizada automáticamente.'),
    mk('urgency-auto', 'Respuesta Automática Urgencias', 'Fuera de horario + palabras clave → instrucciones + teléfono.', 'WhatsApp fuera horario + palabras clave', 'whatsapp', 'urgencia', true, 67, 100, 'Fuera horario', '🚨 Estamos fuera de horario. Para urgencias llama al {{telefono_urgencias}}. Ibuprofeno 600mg y frío exterior mientras tanto.'),
    // ── PRIMERA VISITA ─────────────────────────────────────────────────────────────────
    mk('pv-booking-confirm', 'Confirmación de reserva Primera Visita', 'WhatsApp inmediato al crear una cita de Primera Visita. Confirma la reserva y avisa de próximos pasos.', 'Primera Visita — creación de cita', 'whatsapp', 'primera_visita', true, 0, 100, 'Inmediato', '🏥 Hola {{nombre}}, tu primera visita ha sido reservada para el {{fecha}} a las {{hora}}h con {{doctor}}.\n\nEn breve te enviaremos los formularios necesarios para prepararla.\n\nSi necesitas cambiarla, llámenos al 📞 {{telefono_clinica}}.'),
    mk('pv-24h-forms', 'Envio formularios 24h/2h antes — PV', 'Envía cuestionario Primera Visita + LOPD 24h antes (o 2h si la cita es en menos de 24h). Si hay tratamiento adicional, incluye también el consentimiento.', 'Primera Visita — 24h antes (o 2h si <24h)', 'whatsapp', 'primera_visita', true, 0, 100, '24h antes ó 2h si urgente', '👋 Hola {{nombre}}, mañana tienes tu primera cita con nosotros a las {{hora}}h.\n\nPara prepararla necesitamos que completes estos documentos (3 min):\n📋 Cuestionario de salud: {{link_cuestionario}}\n🔒 Incluye la firma de privacidad (LOPD)\n{{si_tratamiento: 🦷 Consentimiento {{tratamiento}}: incluido en el formulario}}\n\n⏰ Los enlaces expiran 1h después de tu cita.'),
    mk('pv-forms-done', 'Confirmación formularios completados', 'Al completar el cuestionario de primera visita, confirma al paciente y notifica internamente a recepción. Desencadena asignación de NumPac SP-NNNN.', 'Formulario Primera Visita completado', 'multi', 'primera_visita', true, 0, 100, 'Al completar', '✅ ¡Gracias {{nombre}}! Hemos recibido tu documentación correctamente.\n\nTe esperamos el {{fecha}} a las {{hora}}h.\n\nRecuerda traer tu DNI. 😊'),
    mk('pv-tutor-route', 'Redirección al tutor — Menor', 'Para menores de edad, todos los mensajes de Primera Visita se envían al teléfono del tutor legal en lugar del menor.', 'Primera Visita — paciente menor de edad', 'whatsapp', 'primera_visita', true, 0, 100, 'Todos los envíos PV', '👶 Hola {{nombre_tutor}}, información sobre la primera cita de {{nombre_menor}} el {{fecha}} a las {{hora}}h.\n\nComo tutor/a legal, tu firma será necesaria en los documentos: {{link_cuestionario}}'),
];

// ─── Inline Config Panel ─────────────────────────────────────────────────────
const ConfigPanel: React.FC<{ a: Automation; onSave: (cfg: Automation['config']) => void; onClose: () => void }> = ({ a, onSave, onClose }) => {
    const [cfg, setCfg] = useState({ ...a.config });
    const [saved, setSaved] = useState(false);
    const UNITS = ['minutos', 'horas', 'días', 'semanas'];
    const SCHEDULES = ['Cualquier hora', 'Solo horario laboral (8:30-20:00)', 'Solo mañanas (8:30-14:00)', 'Solo tardes (14:00-20:00)', 'Fuera de horario'];
    const VARS = ['{{nombre}}', '{{fecha}}', '{{hora}}', '{{doctor}}', '{{tratamiento}}', '{{importe}}', '{{enlace}}'];

    const save = () => { onSave(cfg); setSaved(true); setTimeout(() => { setSaved(false); onClose(); }, 1200); };

    return (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-bold text-[#051650] uppercase tracking-widest flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5 text-[#0056b3]" />Configuración</span>
                <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            {/* Delay */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">Demora tras trigger</label>
                    <div className="flex gap-1.5">
                        <input type="number" min={0} value={cfg.delayValue} onChange={e => setCfg(p => ({ ...p, delayValue: +e.target.value }))}
                            className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20" />
                        <select value={cfg.delayUnit} onChange={e => setCfg(p => ({ ...p, delayUnit: e.target.value }))}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20">
                            {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">Horario de envío</label>
                    <select value={cfg.schedule} onChange={e => setCfg(p => ({ ...p, schedule: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20">
                        {SCHEDULES.map(s => <option key={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Channel */}
            <div>
                <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">Canal</label>
                <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(CH).map(([key, v]) => (
                        <button key={key} onClick={() => setCfg(p => ({ ...p, channel: key }))}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-bold transition-all ${cfg.channel === key ? 'bg-[#0056b3] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0056b3]/30'}`}>
                            <v.icon className="w-3 h-3" />{v.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Conditions */}
            <div>
                <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">Condición adicional (opcional)</label>
                <input value={cfg.conditions} onChange={e => setCfg(p => ({ ...p, conditions: e.target.value }))}
                    placeholder="Ej: Solo si el estado es 'Confirmada', Solo a mayores de 18 años..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20" />
            </div>

            {/* Message template */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Plantilla del mensaje</label>
                    <div className="flex gap-1 flex-wrap justify-end">
                        {VARS.map(v => (
                            <button key={v} onClick={() => setCfg(p => ({ ...p, message: p.message + ' ' + v }))}
                                className="text-[12px] font-bold px-1.5 py-0.5 bg-[#0056b3]/10 text-[#0056b3] rounded border border-[#0056b3]/20 hover:bg-[#0056b3]/20 transition-all font-mono">
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
                <textarea value={cfg.message} onChange={e => setCfg(p => ({ ...p, message: e.target.value }))} rows={4}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20 resize-none" />
                <p className="text-[12px] text-slate-400 mt-1">Usa las variables de arriba. Serán reemplazadas con los datos reales del paciente al enviar.</p>
            </div>

            <button onClick={save} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all ${saved ? 'bg-blue-500 text-white' : 'bg-[#0056b3] text-white hover:bg-[#004494]'}`}>
                <Save className="w-3.5 h-3.5" />{saved ? '¡Guardado!' : 'Guardar cambios'}
            </button>
        </div>
    );
};

// ─── Card ────────────────────────────────────────────────────────────────────
const Card: React.FC<{ a: Automation; expanded: boolean; configOpen: boolean; onToggle: () => void; onExpand: () => void; onConfig: () => void; onSaveConfig: (cfg: Automation['config']) => void }> =
    ({ a, expanded, configOpen, onToggle, onExpand, onConfig, onSaveConfig }) => {
        const ch = CH[a.channel]; const ChIcon = ch.icon;
        const [testing, setTesting] = useState(false);
        const [testOk, setTestOk] = useState<boolean | null>(null);

        const handleTest = async (e: React.MouseEvent) => {
            e.stopPropagation();
            setTesting(true); setTestOk(null);
            await new Promise(r => setTimeout(r, 900)); // simula disparo
            setTesting(false); setTestOk(true);
            setTimeout(() => setTestOk(null), 2500);
        };
        return (
            <div className={`bg-white rounded-xl border transition-all ${a.active ? 'border-slate-200' : 'border-slate-100 opacity-60'} ${expanded || configOpen ? 'shadow-md ring-1 ring-[#0056b3]/10' : 'hover:shadow-sm'}`}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onExpand}>
                    <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-bold text-[#051650] block truncate">{a.name}</span>
                        <div className="flex items-center gap-3 text-[12px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{a.config.delayValue > 0 ? `${a.config.delayValue} ${a.config.delayUnit}` : a.timing}</span>
                            <span className={`flex items-center gap-0.5 ${ch.color}`}><ChIcon className="w-2.5 h-2.5" />{CH[a.config.channel]?.label ?? ch.label}</span>
                            <span className="text-[#0056b3] font-bold">{a.executions > 0 ? `${a.successRate}% éxito` : '— sin datos'}</span>
                        </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); onToggle(); }}>
                        {a.active ? <ToggleRight className="w-7 h-7 text-[#0056b3]" /> : <ToggleLeft className="w-7 h-7 text-slate-500" />}
                    </button>
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>

                {expanded && !configOpen && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3 animate-in fade-in duration-150">
                        <p className="text-[13px] text-slate-500 leading-relaxed">{a.description}</p>
                        <div className="bg-[#ffe4e6] border border-[#fecdd3] rounded-xl p-3">
                            <p className="text-[12px] font-bold text-[#C02040] uppercase tracking-wider mb-1.5">Plantilla actual</p>
                            <p className="text-[13px] text-[#C02040] font-mono leading-relaxed">{a.config.message}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[12px]">
                            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                                <p className="text-slate-400 font-bold uppercase text-[12px]">Demora</p>
                                <p className="font-bold text-[#051650]">{a.config.delayValue} {a.config.delayUnit}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                                <p className="text-slate-400 font-bold uppercase text-[12px]">Horario</p>
                                <p className="font-bold text-[#051650] truncate">{a.config.schedule}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                                <p className="text-slate-400 font-bold uppercase text-[12px]">Envíos</p>
                                <p className="font-bold text-[#051650]">{a.executions}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={e => { e.stopPropagation(); onConfig(); }} className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-bold uppercase bg-[#0056b3] text-white rounded-lg hover:bg-[#004494] transition-all">
                                <Settings2 className="w-3 h-3" />Configurar
                            </button>
                            <button onClick={handleTest} disabled={testing} className={`flex items-center gap-1 px-3 py-1.5 text-[12px] font-bold uppercase border rounded-lg transition-all ${testOk === true ? 'border-teal-400 text-teal-600 bg-teal-50' : 'border-[#0056b3]/20 text-[#0056b3] hover:bg-[#0056b3]/5'}`}>
                                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : testOk ? <CheckCircle2 className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                {testing ? 'Disparando…' : testOk ? '¡Disparada!' : 'Probar'}
                            </button>
                        </div>
                    </div>
                )}

                {configOpen && (
                    <ConfigPanel a={a} onSave={onSaveConfig} onClose={onConfig} />
                )}
            </div>
        );
    };

// ─── Main ─────────────────────────────────────────────────────────────────────
export const AutomationRules: React.FC = () => {
    const [automations, setAutomations] = useState<Automation[]>(INITIAL_AUTOMATIONS);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [configId, setConfigId] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    // Cargar desde BD al montar — fallback automático a INITIAL_AUTOMATIONS si falla
    useEffect(() => {
        let cancelled = false;
        getAutomations().then(data => {
            if (!cancelled) { setAutomations(data); setLoading(false); }
        });
        return () => { cancelled = true; };
    }, []);

    const toggle = async (id: string) => {
        const item = automations.find(a => a.id === id);
        if (!item) return;
        const newActive = !item.active;
        // Actualiza UI de forma optimista
        setAutomations(p => p.map(a => a.id === id ? { ...a, active: newActive } : a));
        const ok = await toggleAutomation(id, newActive);
        if (!ok) {
            // Revierte si el servidor rechaza
            setAutomations(p => p.map(a => a.id === id ? { ...a, active: item.active } : a));
        }
    };

    const toggleExpand = (id: string) => { setExpandedId(p => p === id ? null : id); setConfigId(null); };
    const toggleConfig = (id: string) => setConfigId(p => p === id ? null : id);

    const saveConfig = (id: string, cfg: Automation['config']) => {
        const existing = automations.find(a => a.id === id);
        if (!existing) return;
        const updated = { ...existing, config: cfg };
        setAutomations(p => p.map(a => a.id === id ? updated : a));
        saveAutomation(updated); // persiste en BD
    };

    const toggleGroup = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }));
    const activeCount = automations.filter(a => a.active).length;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <span className="text-[12px] font-bold text-slate-400 uppercase">Motor automatización</span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[12px] font-bold text-[#051650]">{activeCount}/{automations.length} activas</span>
                {loading && <span className="text-[12px] text-slate-300 italic">Sincronizando...</span>}
            </div>

            {GROUPS.map(g => {
                const items = automations.filter(a => g.ids.includes(a.id));
                const activeInGroup = items.filter(a => a.active).length;
                const isCollapsed = collapsed[g.key];
                return (
                    <div key={g.key} className={`rounded-2xl border ${g.border} ${g.bg} overflow-hidden`}>
                        <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer" onClick={() => toggleGroup(g.key)}>
                            <div className="flex items-center gap-3">
                                <span className="text-[12px] font-bold text-[#051650]">{g.label}</span>
                                <span className="text-[12px] font-bold text-slate-400">{activeInGroup}/{items.length}</span>
                            </div>
                            {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                        </div>
                        {!isCollapsed && (
                            <div className="px-3 pb-3 space-y-2">
                                {items.map(a => (
                                    <Card key={a.id} a={a}
                                        expanded={expandedId === a.id}
                                        configOpen={configId === a.id}
                                        onToggle={() => toggle(a.id)}
                                        onExpand={() => toggleExpand(a.id)}
                                        onConfig={() => toggleConfig(a.id)}
                                        onSaveConfig={cfg => saveConfig(a.id, cfg)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default AutomationRules;
