import React, { useState } from 'react';
import { Bot, Brain, Star, BookOpen, Shield, MessageSquare, Send, ArrowRight, Save, Plus, X, Sliders } from 'lucide-react';

const TONES = ['Cálida y empática', 'Profesional y formal', 'Cercana y amigable', 'Eficiente y directa'];
const LANG = ['Español neutro', 'Español peninsular', 'Bilingüe ES/EN'];
const KNOWLEDGE_DEFAULT = [
    'Servicios: Implantes, Ortodoncia, Endodoncia, Cirugía, Higiene, Blanqueamiento, Prótesis',
    'Horario: Lunes a Viernes 8:30-20:00, Sábados 9:00-14:00',
    'Dirección: C/ Ejemplo 123, Madrid. Metro: Gran Vía',
    'Teléfono urgencias fuera de horario: 612 345 678',
    'Formas de pago: Efectivo, Tarjeta, Bizum, Financiación hasta 24 meses',
    'Primera visita gratuita para nuevos pacientes',
];
const RULES_DEFAULT = [
    { trigger: 'dolor severo / sangrado', action: 'Escalar a recepción inmediatamente' },
    { trigger: 'solicitud de presupuesto detallado', action: 'Derivar a secretaría para cita de diagnóstico' },
    { trigger: 'queja o insatisfacción', action: 'Disculparse, escalar a dirección' },
    { trigger: 'pregunta médica específica', action: 'Responder con cautela, sugerir consulta presencial' },
];

export const SaraConfig: React.FC = () => {
    const [tone, setTone] = useState(0);
    const [lang, setLang] = useState(0);
    const [name, setName] = useState('Sara');
    const [greeting, setGreeting] = useState('Hola, soy Sara, la asistente virtual de Rubio García Dental. ¿En qué puedo ayudarte?');
    const [knowledge, setKnowledge] = useState(KNOWLEDGE_DEFAULT);
    const [rules] = useState(RULES_DEFAULT);
    const [newKnowledge, setNewKnowledge] = useState('');
    const [chatMsg, setChatMsg] = useState('');
    const [chatLog, setChatLog] = useState([
        { role: 'sara', text: 'Hola, soy Sara, la asistente de Rubio García Dental. ¿En qué puedo ayudarte?' }
    ]);
    const [saved, setSaved] = useState(false);

    const addKnowledge = () => {
        if (newKnowledge.trim()) { setKnowledge(p => [...p, newKnowledge.trim()]); setNewKnowledge(''); }
    };
    const handleSend = () => {
        if (!chatMsg.trim()) return;
        const userMsg = chatMsg.trim();
        setChatLog(p => [...p, { role: 'user', text: userMsg }]);
        setChatMsg('');
        setTimeout(() => {
            const lower = userMsg.toLowerCase();
            let reply = 'Gracias por tu mensaje. En breve te atendemos. ¿Hay algo más en lo que pueda ayudarte?';
            if (lower.includes('cita') || lower.includes('reservar')) reply = 'Por supuesto, puedo ayudarte a reservar una cita. ¿Qué día y hora te viene mejor?';
            else if (lower.includes('precio') || lower.includes('cuánto')) reply = 'Cada caso es único. Te recomendamos una primera visita gratuita con nuestros especialistas para darte un presupuesto personalizado. ¿Te parece bien?';
            else if (lower.includes('dolor') || lower.includes('urgencia')) reply = '🚨 Entiendo que es urgente. Llama al 612 345 678 ahora. Si el dolor es muy severo, no esperes.';
            else if (lower.includes('horario')) reply = 'Estamos de Lunes a Viernes de 8:30 a 20:00h y Sábados de 9:00 a 14:00h. ¿Quieres reservar una cita?';
            setChatLog(p => [...p, { role: 'sara', text: reply }]);
        }, 700);
    };

    const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* LEFT: Personality */}
            <div className="xl:col-span-2 space-y-4">

                {/* Identity */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-[#0056b3] flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
                        <span className="text-[12px] font-black text-[#051650] uppercase tracking-widest">Identidad del Agente</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Nombre del agente</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Idioma</label>
                            <select value={lang} onChange={e => setLang(+e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-[#051650] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20">
                                {LANG.map((l, i) => <option key={i} value={i}>{l}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Mensaje de bienvenida</label>
                        <textarea value={greeting} onChange={e => setGreeting(e.target.value)} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20 resize-none" />
                    </div>
                </div>

                {/* Tone & attitude */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Star className="w-4 h-4 text-amber-400" />
                        <span className="text-[12px] font-black text-[#051650] uppercase tracking-widest">Tono y Actitud</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {TONES.map((t, i) => (
                            <button key={i} onClick={() => setTone(i)} className={`text-left px-4 py-3 rounded-xl border text-[12px] font-bold transition-all ${tone === i ? 'bg-[#0056b3] text-white border-[#0056b3] shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#0056b3]/30'}`}>
                                {t}
                            </button>
                        ))}
                    </div>
                    <div className="mt-4 space-y-3">
                        {[
                            { label: 'Empatía', val: 90 },
                            { label: 'Proactividad', val: 75 },
                            { label: 'Formalidad', val: tone === 1 ? 85 : 45 },
                        ].map(({ label, val }) => (
                            <div key={label} className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase w-24 shrink-0">{label}</span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#0056b3] rounded-full transition-all duration-500" style={{ width: `${val}%` }} />
                                </div>
                                <span className="text-[10px] font-black text-[#0056b3] w-8 text-right">{val}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Knowledge base */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="w-4 h-4 text-[#0056b3]" />
                        <span className="text-[12px] font-black text-[#051650] uppercase tracking-widest">Base de Conocimiento</span>
                    </div>
                    <div className="space-y-2 mb-3">
                        {knowledge.map((k, i) => (
                            <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl px-3 py-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0056b3] mt-1.5 shrink-0" />
                                <span className="text-[11px] text-slate-600 flex-1">{k}</span>
                                <button onClick={() => setKnowledge(p => p.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-400 transition-colors"><X className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input value={newKnowledge} onChange={e => setNewKnowledge(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKnowledge()} placeholder="Añadir conocimiento..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20" />
                        <button onClick={addKnowledge} className="px-3 py-2 bg-[#0056b3] text-white rounded-xl hover:bg-[#004494] transition-all"><Plus className="w-4 h-4" /></button>
                    </div>
                </div>

                {/* Escalation rules */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-4 h-4 text-rose-500" />
                        <span className="text-[12px] font-black text-[#051650] uppercase tracking-widest">Reglas de Escalado</span>
                    </div>
                    <div className="space-y-2">
                        {rules.map((r, i) => (
                            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                                <span className="text-[10px] font-black text-rose-400 bg-rose-50 px-2 py-0.5 rounded-lg shrink-0 border border-rose-100">SI: {r.trigger}</span>
                                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                                <span className="text-[11px] text-slate-600">{r.action}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button onClick={handleSave} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-[#0056b3] text-white hover:bg-[#004494]'}`}>
                    <Save className="w-4 h-4" />
                    {saved ? '¡Guardado!' : 'Guardar configuración de Sara'}
                </button>
            </div>

            {/* RIGHT: Live simulator — sticky, viewport height */}
            <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-4" style={{ height: 'calc(100vh - 140px)', maxHeight: 560 }}>
                <div className="px-3 py-2.5 flex items-center gap-2.5 shrink-0" style={{ background: '#0056b3' }}>
                    <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-white" /></div>
                    <div>
                        <p className="text-[10px] font-black text-white">{name} — Simulador en vivo</p>
                        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-[9px] text-white/60">Online</span></div>
                    </div>
                </div>
                <div className="flex-1 p-3 space-y-2.5 bg-slate-50/40 overflow-y-auto">
                    {chatLog.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[88%] text-[11px] rounded-2xl px-3 py-2 ${m.role === 'user' ? 'bg-[#0056b3] text-white rounded-tr-sm font-medium' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'}`}>
                                {m.role === 'sara' && <p className="text-[8px] font-black text-[#0056b3] uppercase mb-0.5">{name} AI</p>}
                                <span className="leading-snug">{m.text}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-2.5 border-t border-slate-100 bg-white shrink-0">
                    <div className="flex gap-1.5">
                        <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Simula un mensaje..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20" />
                        <button onClick={handleSend} className="w-8 h-8 bg-[#0056b3] rounded-xl flex items-center justify-center hover:bg-[#004494] transition-all"><Send className="w-3 h-3 text-white" /></button>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default SaraConfig;
