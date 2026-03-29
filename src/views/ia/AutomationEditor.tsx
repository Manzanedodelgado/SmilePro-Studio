import React, { useState } from 'react';
import { Save, Plus, Trash2, ArrowDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { saveAutomation, invalidateAutomationsCache } from '../../services/automations.service';
import type { Automation } from './AutomationRules';

type StepType = { type: 'wait' | 'send' | 'condition' | 'internal'; label: string; value: string };

const CHANNELS = ['WhatsApp', 'SMS', 'Email', 'Interno'];
const TRIGGERS = [
    'Cita creada', 'Cita confirmada', 'Cita cancelada', 'Cita no presentado',
    'Pago registrado', 'Cierre gabinete', 'Primera visita', 'Fecha nacimiento',
    'Sin cita X meses', 'Respuesta paciente: SÍ', 'Respuesta paciente: NO',
    'Palabras clave WhatsApp',
];
const STEP_TYPES = [
    { key: 'wait', label: '⏱ Esperar', placeholder: 'Ej: 24h, 2 días, 1 semana' },
    { key: 'send', label: '📨 Enviar mensaje', placeholder: 'Texto del mensaje...' },
    { key: 'condition', label: '🔀 Condición', placeholder: 'Ej: Si responde SÍ...' },
    { key: 'internal', label: '⚙️ Acción interna', placeholder: 'Ej: Actualizar estado a Confirmada' },
];

export const AutomationEditor: React.FC = () => {
    const [name, setName] = useState('');
    const [trigger, setTrigger] = useState('');
    const [channel, setChannel] = useState('WhatsApp');
    const [steps, setSteps] = useState<StepType[]>([{ type: 'send', label: '📨 Enviar mensaje', value: '' }]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(false);

    const addStep = (type: StepType['type']) => {
        const def = STEP_TYPES.find(s => s.key === type)!;
        setSteps(p => [...p, { type, label: def.label, value: '' }]);
    };
    const updateStep = (i: number, val: string) => setSteps(p => p.map((s, j) => j === i ? { ...s, value: val } : s));
    const removeStep = (i: number) => setSteps(p => p.filter((_, j) => j !== i));

    const handleSave = async () => {
        if (!name.trim() || !trigger) return;
        setSaving(true); setError(false);

        const channelMap: Record<string, Automation['channel']> = {
            'WhatsApp': 'whatsapp', 'SMS': 'sms', 'Email': 'email', 'Interno': 'interno'
        };

        // El ID lo asigna el servidor; si falla (fallback local) generamos uno único con crypto
        const tempId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const newAutomation: Automation = {
            id: tempId,
            name: name.trim(),
            description: steps.map(s => `${s.label}: ${s.value}`).join(' → '),
            trigger,
            channel: channelMap[channel] ?? 'whatsapp',
            category: 'gestion',
            active: true,
            executions: 0,
            successRate: 0,
            timing: 'Al activar',
            example: steps.find(s => s.type === 'send')?.value ?? '',
            config: {
                delayValue: 0, delayUnit: 'horas',
                message: steps.find(s => s.type === 'send')?.value ?? '',
                channel: channelMap[channel] ?? 'whatsapp',
                schedule: 'Cualquier hora', conditions: '',
            },
        };

        const ok = await saveAutomation(newAutomation);
        if (ok) invalidateAutomationsCache();
        setSaving(false);
        if (ok) {
            setSaved(true);
            setTimeout(() => {
                setSaved(false);
                setName(''); setTrigger(''); setChannel('WhatsApp');
                setSteps([{ type: 'send', label: '📨 Enviar mensaje', value: '' }]);
            }, 2000);
        } else {
            setError(true);
            setTimeout(() => setError(false), 3000);
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* Config panel */}
            <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <p className="text-[12px] font-bold text-[#051650] uppercase tracking-widest">Nueva Automatización / Flujo</p>
                    <div>
                        <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Seguimiento post-implante 90 días" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Trigger (detonador)</label>
                        <select value={trigger} onChange={e => setTrigger(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20">
                            <option value="">Selecciona un detonador...</option>
                            {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Canal principal</label>
                        <div className="flex gap-2">
                            {CHANNELS.map(c => (
                                <button key={c} onClick={() => setChannel(c)} className={`px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all ${channel === c ? 'bg-[#0056b3] text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{c}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Step builder */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                    <p className="text-[12px] font-bold text-[#051650] uppercase tracking-widest">Pasos del flujo</p>
                    {steps.map((step, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-slate-400 uppercase bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">{step.label}</span>
                                <button onClick={() => removeStep(i)} className="ml-auto text-slate-300 hover:text-[#FF4B68] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                            <textarea rows={step.type === 'send' ? 2 : 1} value={step.value} onChange={e => updateStep(i, e.target.value)}
                                placeholder={STEP_TYPES.find(s => s.key === step.type)?.placeholder}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20 resize-none" />
                            {i < steps.length - 1 && <div className="flex justify-center"><ArrowDown className="w-3.5 h-3.5 text-slate-500" /></div>}
                        </div>
                    ))}

                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Añadir paso</p>
                        <div className="flex flex-wrap gap-2">
                            {STEP_TYPES.map(s => (
                                <button key={s.key} onClick={() => addStep(s.key as StepType['type'])} className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold bg-slate-50 border border-slate-200 rounded-lg hover:border-[#0056b3]/30 hover:text-[#0056b3] transition-all">
                                    <Plus className="w-3 h-3" />{s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving || !name.trim() || !trigger}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[12px] uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${saved ? 'bg-blue-500 text-white' :
                            error ? 'bg-red-500 text-white' :
                                saving ? 'bg-slate-400 text-white' :
                                    'bg-[#0056b3] text-white hover:bg-[#004494]'
                        }`}
                >
                    {saved ? <CheckCircle2 className="w-4 h-4" /> : error ? <AlertCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saved ? '¡Guardado en BD!' : error ? 'Error al guardar' : saving ? 'Guardando...' : 'Guardar automatización'}
                </button>
            </div>

            {/* Visual preview */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <p className="text-[12px] font-bold text-[#051650] uppercase tracking-widest mb-4">Vista previa del flujo</p>
                {!name && !trigger ? (
                    <div className="h-64 flex items-center justify-center text-center">
                        <div>
                            <div className="text-4xl mb-3">⚡</div>
                            <p className="text-[12px] font-bold text-slate-400">Configura el nombre y el trigger para ver la vista previa</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="bg-[#0056b3] text-white rounded-xl px-4 py-3 text-center">
                            <p className="text-[12px] font-bold uppercase tracking-widest text-white/70 mb-0.5">TRIGGER</p>
                            <p className="text-[13px] font-bold">{trigger || '—'}</p>
                        </div>
                        {steps.map((s, i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                                <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
                                <div className={`w-full rounded-xl px-4 py-2.5 border text-[13px] font-bold ${s.type === 'send' ? 'bg-[#ffe4e6] border-[#fecdd3] text-[#C02040]' :
                                    s.type === 'wait' ? 'bg-[#FEFDE8] border-[#FBFFA3] text-[#051650]' :
                                        s.type === 'condition' ? 'bg-purple-50 border-purple-200 text-purple-800' :
                                            'bg-slate-50 border-slate-200 text-slate-600'
                                    }`}>
                                    <span className="text-[12px] font-bold uppercase block mb-0.5 opacity-60">{s.label}</span>
                                    {s.value || <span className="opacity-40 italic">Sin contenido aún...</span>}
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-center"><ArrowDown className="w-3.5 h-3.5 text-slate-500" /></div>
                        <div className="rounded-xl px-4 py-2.5 border border-blue-200 bg-blue-50 text-center">
                            <p className="text-[12px] font-bold text-[#051650] uppercase">✓ Fin del flujo</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutomationEditor;
