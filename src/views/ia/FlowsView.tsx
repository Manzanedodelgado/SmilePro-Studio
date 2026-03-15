import React from 'react';
import { GitBranch, Bell, HeartPulse, RefreshCcw, FileText, CreditCard, AlertTriangle, CheckCircle2, XCircle, UserPlus, ArrowDown, Send, MessageSquare, Calendar, Star, Receipt, Building2, Clipboard, Stethoscope } from 'lucide-react';

interface Flow { id: string; name: string; trigger: string; color: string; steps: { icon: React.ElementType; label: string; sub: string }[] }

const FLOWS: Flow[] = [
    {
        id: 'confirm', name: 'Flujo: Confirmación de Cita', trigger: 'Cita programada en agenda', color: '#0056b3', steps: [
            { icon: Bell, label: 'Recordatorio 24h', sub: 'WhatsApp con datos de cita + botones SÍ/NO' },
            { icon: CheckCircle2, label: 'SÍ → Estado: Confirmada', sub: 'Agenda actualizada automáticamente' },
            { icon: FileText, label: 'Consentimiento digital', sub: 'Email con firma electrónica según tratamiento' },
            { icon: CheckCircle2, label: 'Consentimiento firmado', sub: 'Guardado en ficha, doctor notificado' },
        ]
    },
    {
        id: 'cancel', name: 'Flujo: Cancelación', trigger: 'Paciente responde NO o CANCELAR', color: '#dc2626', steps: [
            { icon: XCircle, label: 'NO / CANCELAR recibido', sub: 'Estado → Cancelada, hueco liberado en agenda' },
            { icon: MessageSquare, label: 'Mensaje de reagendado', sub: '¿Quieres que busquemos otra fecha?' },
            { icon: Calendar, label: '3 huecos disponibles', sub: 'Propuesta automática al paciente' },
            { icon: Bell, label: 'Nueva cita creada', sub: 'Inicio de nuevo flujo de confirmación' },
        ]
    },
    {
        id: 'noshow', name: 'Flujo: No Presentado', trigger: 'Cita marcada como No Presentado', color: '#d97706', steps: [
            { icon: AlertTriangle, label: 'No presentado detectado', sub: 'Notificación interna a recepción' },
            { icon: MessageSquare, label: 'Mensaje conciliador', sub: 'Oferta para reagendar sin penalización' },
            { icon: RefreshCcw, label: 'Sin respuesta en 7 días', sub: 'Recall automático en 30 días' },
        ]
    },
    {
        id: 'surgery', name: 'Flujo: Post-Quirúrgico Implantes', trigger: 'Cierre gabinete categoría Cirugía/Implante', color: '#7c3aed', steps: [
            { icon: Send, label: 'Día 0 — Instrucciones', sub: 'Cuidados post-op inmediatos por WhatsApp' },
            { icon: HeartPulse, label: 'Día 2 — Control dolor', sub: '¿Cómo evoluciona? Alarma si respuesta preocupante' },
            { icon: Stethoscope, label: 'Día 7 — Cita revisión', sub: 'Propuesta automática de cita de revisión' },
            { icon: Calendar, label: '75 días — Osteointegración', sub: 'Seguimiento intermedio y programación' },
            { icon: CheckCircle2, label: '6 meses — Revisión carga', sub: 'Recordatorio para fase protésica final' },
        ]
    },
    {
        id: 'payment', name: 'Flujo: Cobro Realizado', trigger: 'Pago registrado en sistema', color: '#059669', steps: [
            { icon: CreditCard, label: 'Pago registrado', sub: 'Efectivo / TPV / Transferencia / Bizum' },
            { icon: Receipt, label: 'Recibo WhatsApp', sub: 'Recibo inmediato al paciente' },
            { icon: FileText, label: 'Factura PDF al doctor', sub: 'Email automático a la dirección configurada' },
            { icon: Building2, label: 'Exportación gestoría', sub: 'Acumulado mensual en carpeta compartida' },
        ]
    },
    {
        id: 'firstvisit', name: 'Flujo: Primera Visita', trigger: 'Primera cita de paciente nuevo', color: '#0891b2', steps: [
            { icon: UserPlus, label: 'Nuevo paciente detectado', sub: 'Primera cita creada en agenda' },
            { icon: Clipboard, label: 'Cuestionario anamnesis', sub: '72h antes: formulario de salud por WhatsApp' },
            { icon: FileText, label: 'Consentimiento general', sub: 'Email con documentación de bienvenida' },
            { icon: Bell, label: 'Recordatorio 24h', sub: 'Con indicaciones de cómo llegar' },
            { icon: Star, label: '24h post-visita', sub: 'Solicitud de reseña si visita positiva' },
        ]
    },
];

const FlowCard: React.FC<{ flow: Flow }> = ({ flow }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: `3px solid ${flow.color}` }}>
            <GitBranch className="w-4 h-4 shrink-0" style={{ color: flow.color }} />
            <div>
                <p className="text-[12px] font-bold text-[#051650]">{flow.name}</p>
                <p className="text-[12px] text-slate-400">▶ {flow.trigger}</p>
            </div>
        </div>
        <div className="p-4 space-y-1.5">
            {flow.steps.map((s, i) => {
                const Icon = s.icon;
                return (
                    <div key={i} className="flex flex-col items-start">
                        <div className="flex items-start gap-2.5 w-full">
                            <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${flow.color}15`, border: `1px solid ${flow.color}30` }}>
                                <Icon className="w-3.5 h-3.5" style={{ color: flow.color }} />
                            </div>
                            <div className="flex-1 pt-0.5">
                                <p className="text-[13px] font-bold text-[#051650] leading-tight">{s.label}</p>
                                <p className="text-[12px] text-slate-400">{s.sub}</p>
                            </div>
                        </div>
                        {i < flow.steps.length - 1 && (
                            <div className="ml-3.5 mt-1 mb-0.5"><ArrowDown className="w-3.5 h-3.5" style={{ color: `${flow.color}60` }} /></div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
);

export const FlowsView: React.FC = () => (
    <div className="space-y-4">
        <p className="text-[13px] text-slate-400 leading-relaxed">
            Los flujos definen secuencias completas de acciones automáticas según el estado o la respuesta del paciente.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {FLOWS.map(f => <FlowCard key={f.id} flow={f} />)}
        </div>
    </div>
);

export default FlowsView;
