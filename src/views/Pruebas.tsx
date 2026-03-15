import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Calendar, Clock, RefreshCw, Plus, ChevronLeft, ChevronRight,
    CheckCircle2, Zap, Activity, X, Edit2, Trash2, Users, TrendingUp
} from 'lucide-react';
import { getCitasByFecha, updateCita, createCita, deleteCita } from '../services/citas.service';
import { Cita } from '../types';

// ─── Time helpers ──────────────────────────────────────────────────────────────
const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fmtDate = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const isoDate = (d: Date) => d.toISOString().split('T')[0];

// ─── Timeline geometry ─────────────────────────────────────────────────────────
const SEGMENTS: [number, number][] = [[8, 15], [15.5, 21]]; // [start_h, end_h]
const PX_H = 80; // pixels per hour

function horaToY(hora: string): number {
    const h = toMin(hora) / 60;
    let y = 0;
    for (const [s, e] of SEGMENTS) {
        if (h <= s) break;
        y += (Math.min(h, e) - s) * PX_H;
        if (h <= e) break;
    }
    return y;
}
function totalH() { return SEGMENTS.reduce((a, [s, e]) => a + (e - s), 0) * PX_H; }
function nowY(): number {
    const now = new Date();
    return horaToY(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
}
function isInWorkingHours(): boolean {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    return SEGMENTS.some(([s, e]) => h >= s && h <= e);
}

// ─── Treatment palette ─────────────────────────────────────────────────────────
const PALETTE: Record<string, { bg: string; border: string; text: string; pill: string }> = {
    'Primera Visita': { bg: 'linear-gradient(135deg,#FF4B68CC,#FF8099CC)', border: '#FF4B68', text: '#fff', pill: '#FF4B68' },
    'Revisión': { bg: 'linear-gradient(135deg,#118DF0CC,#5BB4F5CC)', border: '#118DF0', text: '#fff', pill: '#118DF0' },
    'Limpieza': { bg: 'linear-gradient(135deg,#1D4ED8CC,#2563EBCC)', border: '#1D4ED8', text: '#fff', pill: '#1D4ED8' },
    'Higiene Dental': { bg: 'linear-gradient(135deg,#1D4ED8CC,#2563EBCC)', border: '#1D4ED8', text: '#fff', pill: '#1D4ED8' },
    'Empaste': { bg: 'linear-gradient(135deg,#3B82F6CC,#60A5FACC)', border: '#3B82F6', text: '#fff', pill: '#3B82F6' },
    'Endodoncia': { bg: 'linear-gradient(135deg,#004182CC,#118DF0CC)', border: '#004182', text: '#fff', pill: '#004182' },
    'Extracción': { bg: 'linear-gradient(135deg,#60A5FACC,#93C5FDCC)', border: '#60A5FA', text: '#fff', pill: '#60A5FA' },
    'Ortodoncia': { bg: 'linear-gradient(135deg,#FF4B68CC,#FF8099CC)', border: '#FF4B68', text: '#fff', pill: '#FF4B68' },
    'Implante': { bg: 'linear-gradient(135deg,#051650CC,#004182CC)', border: '#051650', text: '#fff', pill: '#051650' },
    'Blanqueamiento': { bg: 'linear-gradient(135deg,#FBFFA3CC,#FEFDE8CC)', border: '#FBFFA3', text: '#051650', pill: '#FBFFA3' },
    'Prótesis': { bg: 'linear-gradient(135deg,#118DF0CC,#5BB4F5CC)', border: '#118DF0', text: '#fff', pill: '#118DF0' },
    'Prótesis Fija': { bg: 'linear-gradient(135deg,#118DF0CC,#5BB4F5CC)', border: '#118DF0', text: '#fff', pill: '#118DF0' },
    'Periodoncia': { bg: 'linear-gradient(135deg,#3B82F6CC,#60A5FACC)', border: '#3B82F6', text: '#fff', pill: '#3B82F6' },
    'Control': { bg: 'linear-gradient(135deg,#93C5FDCC,#BFDBFECC)', border: '#93C5FD', text: '#051650', pill: '#93C5FD' },
    'Urgencia': { bg: 'linear-gradient(135deg,#FF4B68CC,#FF8099CC)', border: '#FF4B68', text: '#fff', pill: '#FF4B68' },
};
const getPalette = (tto: string) => PALETTE[tto] ?? { bg: 'linear-gradient(135deg,#00418299,#0056b3AA)', border: '#004182', text: '#fff', pill: '#004182' };

// ─── Estado config ─────────────────────────────────────────────────────────────
const EC: Record<string, { label: string; dot: string; cls: string }> = {
    confirmada: { label: 'Confirmada', dot: '#118DF0', cls: 'bg-blue-50 text-[#004182] border-blue-200' },
    espera: { label: 'En espera', dot: '#FBFFA3', cls: 'bg-[#FEFDE8] text-[#051650] border-[#FBFFA3]' },
    gabinete: { label: 'En gabinete', dot: '#004182', cls: 'bg-blue-100 text-[#051650] border-blue-300' },
    finalizada: { label: 'Finalizada', dot: '#93C5FD', cls: 'bg-[#F0F8FF] text-[#004182] border-[#BFDBFE]' },
    anulada: { label: 'Anulada', dot: '#FF4B68', cls: 'bg-[#FFF0F3] text-[#FF4B68] border-[#FFC0CB]' },
    planificada: { label: 'Planif.', dot: '#3B82F6', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};
const ec = (e: string) => EC[e] ?? { label: e, dot: '#93C5FD', cls: 'bg-[#F0F8FF] text-[#004182] border-[#BFDBFE]' };

// ─── Modal ─────────────────────────────────────────────────────────────────────
const ESTADOS = ['planificada', 'confirmada', 'espera', 'gabinete', 'finalizada', 'anulada'];
const TTOS = ['Primera Visita', 'Revisión', 'Limpieza', 'Higiene Dental', 'Empaste', 'Endodoncia', 'Extracción', 'Ortodoncia', 'Implante', 'Blanqueamiento', 'Prótesis', 'Prótesis Fija', 'Periodoncia', 'Control', 'Urgencia'];

const CitaModal: React.FC<{ cita: Partial<Cita> | null; onClose: () => void; onSave: (c: Partial<Cita>) => void; onDelete?: (id: string) => void }> = ({ cita, onClose, onSave, onDelete }) => {
    const [form, setForm] = useState<Partial<Cita>>(cita ?? {});
    useEffect(() => { setForm(cita ?? {}); }, [cita]);
    if (!cita) return null;
    const isNew = !cita.id;
    const pal = getPalette(form.tratamiento ?? '');
    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" />
            <div className="relative bg-white rounded-3xl shadow-2xl w-[520px] max-h-[90vh] overflow-hidden flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
                {/* Colored top bar */}
                <div className="h-2 w-full" style={{ background: pal.border }} />
                {/* Header */}
                <div className="px-7 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between">
                    <div>
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em]">{isNew ? '✦ Nueva cita' : '✦ Editar cita'}</p>
                        <h2 className="text-[20px] font-bold text-[#051650] mt-0.5">{form.nombrePaciente || 'Sin paciente'}</h2>
                        {form.tratamiento && <p className="text-[13px] font-bold mt-0.5" style={{ color: pal.border }}>{form.tratamiento}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl mt-0.5 transition-all"><X className="w-4 h-4 text-slate-400" /></button>
                </div>
                {/* Form */}
                <div className="px-7 py-5 space-y-4 overflow-y-auto flex-1">
                    <Field label="Nombre del paciente">
                        <input className={INPUT} value={form.nombrePaciente ?? ''} onChange={e => setForm(p => ({ ...p, nombrePaciente: e.target.value }))} placeholder="Apellidos, Nombre" />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Hora inicio">
                            <input type="time" className={INPUT} value={form.horaInicio ?? '09:00'} onChange={e => setForm(p => ({ ...p, horaInicio: e.target.value }))} />
                        </Field>
                        <Field label="Duración (min)">
                            <input type="number" min={15} step={15} className={INPUT} value={form.duracionMinutos ?? 30} onChange={e => setForm(p => ({ ...p, duracionMinutos: +e.target.value }))} />
                        </Field>
                    </div>
                    <Field label="Tratamiento">
                        <select className={INPUT} value={form.tratamiento ?? ''} onChange={e => setForm(p => ({ ...p, tratamiento: e.target.value }))}>
                            <option value="">— Seleccionar —</option>
                            {TTOS.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Gabinete">
                            <select className={INPUT} value={form.gabinete ?? 'G1'} onChange={e => setForm(p => ({ ...p, gabinete: e.target.value as 'G1' | 'G2' }))}>
                                <option value="G1">Gabinete 1</option>
                                <option value="G2">Gabinete 2</option>
                            </select>
                        </Field>
                        <Field label="Estado">
                            <select className={INPUT} value={form.estado ?? 'planificada'} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>
                                {ESTADOS.map(e => <option key={e}>{e}</option>)}
                            </select>
                        </Field>
                    </div>
                    <Field label="Notas">
                        <textarea className={`${INPUT} resize-none`} rows={2} value={form.observaciones ?? ''} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} placeholder="Observaciones..." />
                    </Field>
                </div>
                {/* Footer */}
                <div className="px-7 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                    {!isNew && onDelete
                        ? <button onClick={() => { onDelete(cita.id!); onClose(); }} className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-[#FFF0F3] rounded-xl text-[13px] font-bold transition-all border border-transparent hover:border-[#FFC0CB]">
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                        : <div />}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-[13px] font-bold hover:bg-slate-100 transition-all">Cancelar</button>
                        <button onClick={() => { onSave(form); onClose(); }}
                            className="px-5 py-2 text-white rounded-xl text-[13px] font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                            style={{ background: `linear-gradient(135deg, ${pal.border}, ${pal.pill})` }}>
                            {isNew ? '+ Crear cita' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004182]/20 focus:border-[#004182]/40 transition-all bg-white';
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.18em] block mb-1.5">{label}</label>
        {children}
    </div>
);

// ─── Timeline column ───────────────────────────────────────────────────────────
const TimelineCol: React.FC<{
    citas: Cita[];
    gabinete: 'G1' | 'G2';
    nowPx: number;
    showNow: boolean;
    onCitaClick: (c: Cita) => void;
    onDrop: (id: string, hora: string, gab: 'G1' | 'G2') => void;
}> = ({ citas, gabinete, nowPx, showNow, onCitaClick, onDrop }) => {
    const colRef = useRef<HTMLDivElement>(null);
    const total = totalH();

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (!id || !colRef.current) return;
        const rect = colRef.current.getBoundingClientRect();
        const y = Math.max(0, e.clientY - rect.top);
        const fraction = Math.min(y / total, 1);
        const totalWork = SEGMENTS.reduce((a, [s, e]) => a + e - s, 0);
        let offset = fraction * totalWork;
        let newH = SEGMENTS[0][0];
        for (const [s, e] of SEGMENTS) {
            const seg = e - s;
            if (offset <= seg) { newH = s + offset; break; }
            offset -= seg;
        }
        const hr = Math.floor(newH);
        const mn = Math.round((newH - hr) * 60 / 15) * 15;
        onDrop(id, toHHMM(hr * 60 + mn), gabinete);
    };

    // Build grid lines
    const lines: React.ReactNode[] = [];
    for (const [s, e] of SEGMENTS) {
        for (let h = s; h <= e; h += 0.5) {
            const y = horaToY(toHHMM(h * 60));
            const isHour = h % 1 === 0;
            lines.push(
                <div key={`l-${h}`} className={`absolute left-0 right-0 pointer-events-none ${isHour ? 'border-t border-slate-200' : 'border-t border-dashed border-slate-100'}`} style={{ top: y }}>
                    {isHour && <span className="absolute -top-3 left-2 text-[12px] font-bold text-slate-300 select-none">{toHHMM(h * 60)}</span>}
                </div>
            );
        }
    }

    return (
        <div ref={colRef} className="relative select-none" style={{ height: total }} onDragOver={handleDragOver} onDrop={handleDrop}>
            {/* Subtle bg */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50/60 to-white/30" />
            {lines}

            {/* Franja de descanso entre tramos */}
            {SEGMENTS.length > 1 && (() => {
                const breakTop = SEGMENTS[0][1] * PX_H - SEGMENTS[0][0] * PX_H;
                const rawBreak = (SEGMENTS[1][0] - SEGMENTS[0][1]);
                const _ = rawBreak; // gap visual indicado con pattern
                return (
                    <div className="absolute left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
                        style={{ top: horaToY(toHHMM(SEGMENTS[0][1] * 60)), height: 20 }}>
                        <div className="w-full h-px bg-dashed border-t-2 border-dashed border-slate-300 opacity-60" />
                        <span className="absolute text-[12px] font-bold text-slate-300 bg-white px-2 tracking-widest uppercase">descanso</span>
                    </div>
                );
            })()}

            {/* NOW line */}
            {showNow && (
                <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: nowPx }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-300 flex-shrink-0 -ml-1.5 ring-2 ring-white" />
                    <div className="flex-1 h-0.5 bg-gradient-to-r from-red-500 to-red-300 shadow-sm" />
                </div>
            )}

            {/* Citas */}
            {citas.map(cita => {
                const top = horaToY(cita.horaInicio);
                const height = Math.max(32, (cita.duracionMinutos ?? 30) * (PX_H / 60));
                const isBio = cita.estado === 'bloqueo_bio';
                const pal = isBio ? { bg: 'repeating-linear-gradient(45deg,#f8fafc,#f8fafc 4px,#e2e8f0 4px,#e2e8f0 8px)', border: '#cbd5e1', text: '#94a3b8', pill: '#cbd5e1' } : getPalette(cita.tratamiento);
                const statusCfg = ec(cita.estado);
                const compact = height < 50;
                return (
                    <div
                        key={cita.id}
                        draggable={!isBio}
                        onDragStart={e => { e.dataTransfer.setData('text/plain', cita.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onClick={() => !isBio && onCitaClick(cita)}
                        className="absolute mx-1.5 rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:z-50 cursor-pointer group"
                        style={{
                            top,
                            height,
                            left: 0,
                            right: 0,
                            background: isBio ? pal.bg : pal.bg,
                            borderLeft: `5px solid ${pal.border}`,
                            boxShadow: `0 2px 12px ${pal.border}33`,
                            backdropFilter: 'blur(6px)',
                        }}
                    >
                        {isBio ? (
                            <div className="flex items-center h-full px-3">
                                <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: pal.text }}>🧪 Bioseguridad</span>
                            </div>
                        ) : (
                            <div className="flex flex-col justify-center h-full px-3 py-1.5 overflow-hidden">
                                {/* Top row: hora + estado */}
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[12px] font-bold opacity-90 flex-shrink-0" style={{ color: pal.text }}>{cita.horaInicio}</span>
                                    {!compact && (
                                        <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                            style={{ background: 'rgba(255,255,255,0.25)', color: pal.text }}>
                                            {cita.duracionMinutos}'
                                        </span>
                                    )}
                                </div>
                                {/* Nombre */}
                                <p className="text-[13px] font-bold leading-tight truncate" style={{ color: pal.text }}>{cita.nombrePaciente || 'Sin datos'}</p>
                                {/* Tratamiento */}
                                {!compact && (
                                    <p className="text-[12px] font-semibold truncate mt-0.5" style={{ color: pal.text, opacity: 0.8 }}>{cita.tratamiento}</p>
                                )}
                                {/* Estado badge invisible hasta hover */}
                                {!compact && (
                                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusCfg.dot }} />
                                        <span className="text-[12px] font-bold" style={{ color: pal.text, opacity: 0.85 }}>{statusCfg.label}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Animated counter ──────────────────────────────────────────────────────────
const CountUp: React.FC<{ value: number; duration?: number }> = ({ value, duration = 600 }) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let start = 0;
        const step = value / (duration / 16);
        const t = setInterval(() => {
            start = Math.min(start + step, value);
            setDisplay(Math.floor(start));
            if (start >= value) clearInterval(t);
        }, 16);
        return () => clearInterval(t);
    }, [value, duration]);
    return <>{display}</>;
};

// ─── Live clock ────────────────────────────────────────────────────────────────
const LiveClock: React.FC = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
    return (
        <div className="text-right">
            <p className="text-[22px] font-bold text-[#051650] tabular-nums leading-none">
                {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">{time.toLocaleTimeString('es-ES', { second: '2-digit' })}s</p>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const Pruebas: React.FC = () => {
    const [date, setDate] = useState(new Date());
    const [citas, setCitas] = useState<Cita[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Partial<Cita> | null>(null);
    const [filterGab, setFilterGab] = useState<'all' | 'G1' | 'G2'>('all');
    const [nowPx, setNowPx] = useState(nowY());
    const [showNow, setShowNow] = useState(isInWorkingHours());

    // Live NOW line
    useEffect(() => {
        const t = setInterval(() => { setNowPx(nowY()); setShowNow(isInWorkingHours()); }, 60_000);
        return () => clearInterval(t);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try { setCitas((await getCitasByFecha(date)).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))); }
        catch { setCitas([]); }
        finally { setLoading(false); }
    }, [date]);

    useEffect(() => { load(); }, [load]);

    const navDay = (d: number) => { const nd = new Date(date); nd.setDate(nd.getDate() + d); setDate(nd); };
    const isToday = isoDate(date) === isoDate(new Date());

    const real = citas.filter(c => c.estado !== 'bloqueo_bio');
    const total = real.length;
    const confirmadas = real.filter(c => c.estado === 'confirmada').length;
    const enCurso = real.filter(c => { const [h, m] = c.horaInicio.split(':').map(Number); const now = new Date().getHours() * 60 + new Date().getMinutes(); const s = h * 60 + m; return now >= s && now < s + (c.duracionMinutos ?? 30); }).length;
    const pendientes = real.filter(c => ['planificada', 'espera'].includes(c.estado)).length;
    const finalizadas = real.filter(c => c.estado === 'finalizada').length;

    const g1 = citas.filter(c => c.gabinete === 'G1');
    const g2 = citas.filter(c => c.gabinete === 'G2');
    const showG1 = filterGab === 'all' || filterGab === 'G1';
    const showG2 = filterGab === 'all' || filterGab === 'G2';

    const handleSave = async (form: Partial<Cita>) => {
        if (form.id) await updateCita(form.id, form, date);
        else await createCita({ ...form, fecha: isoDate(date) } as Omit<Cita, 'id'>, date);
        load();
    };
    const handleDelete = async (id: string) => { await deleteCita(id); load(); };
    const handleDrop = async (id: string, hora: string, gab: 'G1' | 'G2') => {
        setCitas(prev => prev.map(c => c.id === id ? { ...c, horaInicio: hora, gabinete: gab } : c));
        await updateCita(id, { horaInicio: hora, gabinete: gab }, date);
    };

    const KPIS = [
        { label: 'Total', value: total, icon: Calendar, from: '#051650', to: '#004182' },
        { label: 'Confirmadas', value: confirmadas, icon: CheckCircle2, from: '#1D4ED8', to: '#2563EB' },
        { label: 'En gabinete', value: enCurso, icon: Activity, from: '#3B82F6', to: '#4F8DF5', pulse: true },
        { label: 'Pendientes', value: pendientes, icon: Users, from: '#70A7F9', to: '#86B3FB' },
        { label: 'Finalizadas', value: finalizadas, icon: Zap, from: '#A2D0FC', to: '#CBEAFB' },
    ];

    return (
        <div className="space-y-5 animate-fade-in pb-8">

            {/* ── HEADER ─────────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-1">Vista Pruebas · Agenda Premium</p>
                    <h1 className="text-[26px] font-bold text-[#051650] capitalize leading-tight">{fmtDate(date)}</h1>
                    {isToday && <span className="inline-flex items-center gap-1 mt-1 text-[12px] font-bold bg-blue-100 text-[#051650] px-2 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />En directo</span>}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <LiveClock />

                    {/* Day nav */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <button onClick={() => navDay(-1)} className="px-3 py-2.5 hover:bg-slate-50 transition-all border-r border-slate-100"><ChevronLeft className="w-4 h-4 text-slate-400" /></button>
                        <button onClick={() => setDate(new Date())} className="px-4 py-2 text-[13px] font-bold text-[#051650] uppercase tracking-wider hover:bg-slate-50 transition-all">Hoy</button>
                        <button onClick={() => navDay(1)} className="px-3 py-2.5 hover:bg-slate-50 transition-all border-l border-slate-100"><ChevronRight className="w-4 h-4 text-slate-400" /></button>
                    </div>

                    {/* Gab filter */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        {(['all', 'G1', 'G2'] as const).map(g => (
                            <button key={g} onClick={() => setFilterGab(g)}
                                className={`px-3 py-2 text-[12px] font-bold uppercase tracking-wider transition-all ${filterGab === g ? 'text-white shadow-inner' : 'text-slate-500 hover:bg-slate-50'}`}
                                style={filterGab === g ? { background: 'linear-gradient(135deg,#1d4ed8,#2563eb)' } : {}}>
                                {g === 'all' ? 'Todos' : g}
                            </button>
                        ))}
                    </div>

                    <button onClick={load} className={`p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm transition-all hover:border-[#004182]/40 ${loading ? 'animate-spin text-[#004182]' : 'text-slate-400 hover:text-[#004182]'}`}>
                        <RefreshCw className="w-4 h-4" />
                    </button>

                    <button onClick={() => setEditing({ horaInicio: '09:00', duracionMinutos: 30, gabinete: 'G1', estado: 'planificada' })}
                        className="flex items-center gap-2 px-4 py-2.5 text-white rounded-2xl text-[13px] font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transition-all active:scale-95"
                        style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)' }}>
                        <Plus className="w-4 h-4" /> Nueva cita
                    </button>
                </div>
            </div>

            {/* ── KPI CARDS ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-5 gap-3">
                {KPIS.map(({ label, value, icon: Icon, from, to, pulse }) => (
                    <div key={label} className="relative rounded-3xl p-5 shadow-lg overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-default"
                        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
                        {/* Decorative blobs */}
                        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 bg-white" />
                        <div className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full opacity-10 bg-black" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/70">{label}</p>
                                <div className={`p-1.5 rounded-xl ${pulse ? 'animate-pulse' : ''}`} style={{ background: 'rgba(255,255,255,0.2)' }}>
                                    <Icon className="w-3.5 h-3.5 text-white" />
                                </div>
                            </div>
                            <p className="text-[40px] font-bold text-white leading-none tracking-tight">
                                <CountUp value={value} />
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── AGENDA TIMELINE ────────────────────────────────────────────── */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden">

                {/* Column headers */}
                <div className={`grid ${showG1 && showG2 ? 'grid-cols-2' : 'grid-cols-1'} border-b border-slate-100`}>
                    {showG1 && (
                        <div className="flex items-center gap-3 px-6 py-4 border-r border-slate-100">
                            <div className="w-3 h-3 rounded-full bg-[#051650] shadow-sm shadow-blue-300" />
                            <div>
                                <p className="text-[12px] font-bold text-[#051650] uppercase tracking-wider">Gabinete 1</p>
                                <p className="text-[12px] text-slate-400 font-bold">{g1.filter(c => c.estado !== 'bloqueo_bio').length} citas · {g1.reduce((a, c) => a + (c.duracionMinutos ?? 0), 0)} min</p>
                            </div>
                        </div>
                    )}
                    {showG2 && (
                        <div className="flex items-center gap-3 px-6 py-4">
                            <div className="w-3 h-3 rounded-full bg-[#004182] shadow-sm shadow-blue-300" />
                            <div>
                                <p className="text-[12px] font-bold text-[#051650] uppercase tracking-wider">Gabinete 2</p>
                                <p className="text-[12px] text-slate-400 font-bold">{g2.filter(c => c.estado !== 'bloqueo_bio').length} citas · {g2.reduce((a, c) => a + (c.duracionMinutos ?? 0), 0)} min</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Grid */}
                <div className={`grid ${showG1 && showG2 ? 'grid-cols-2' : 'grid-cols-1'} divide-x divide-slate-100`} style={{ minHeight: totalH() + 40 }}>
                    {showG1 && (
                        <div className="p-3">
                            <TimelineCol citas={g1} gabinete="G1" nowPx={nowPx} showNow={showNow && isToday} onCitaClick={setEditing} onDrop={handleDrop} />
                        </div>
                    )}
                    {showG2 && (
                        <div className="p-3">
                            <TimelineCol citas={g2} gabinete="G2" nowPx={nowPx} showNow={showNow && isToday} onCitaClick={setEditing} onDrop={handleDrop} />
                        </div>
                    )}
                </div>

                {!loading && citas.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mb-4">
                            <Calendar className="w-8 h-8 text-slate-500" />
                        </div>
                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">Sin citas para este día</p>
                        <p className="text-[13px] text-slate-300 mt-1">Pulsa "+ Nueva cita" para empezar</p>
                    </div>
                )}
            </div>

            {/* ── LISTADO DEL DÍA ─────────────────────────────────────────────── */}
            {real.length > 0 && (
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-4 h-4 text-[#004182]" />
                            <span className="text-[12px] font-bold text-[#051650] uppercase tracking-wider">Listado del día</span>
                        </div>
                        <span className="text-[12px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{total} citas</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {real.map(cita => {
                            const pal = getPalette(cita.tratamiento);
                            const cfg = ec(cita.estado);
                            return (
                                <div key={cita.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/80 transition-all cursor-pointer group" onClick={() => setEditing(cita)}>
                                    {/* Color bar */}
                                    <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: pal.border }} />
                                    {/* Time */}
                                    <div className="w-14 flex-shrink-0 text-center">
                                        <p className="text-[13px] font-bold text-[#051650]">{cita.horaInicio}</p>
                                        <p className="text-[12px] text-slate-400 font-bold">{cita.duracionMinutos}'</p>
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-bold text-[#051650] truncate">{cita.nombrePaciente || 'Sin datos'}</p>
                                        <p className="text-[12px] text-slate-400 font-medium truncate">{cita.tratamiento}</p>
                                    </div>
                                    {/* Gabinete */}
                                    <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold text-white" style={{ background: cita.gabinete === 'G1' ? 'linear-gradient(135deg,#051650,#004182)' : 'linear-gradient(135deg,#004182,#118DF0)' }}>{cita.gabinete}</div>
                                    {/* Estado */}
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-bold flex-shrink-0 ${cfg.cls}`}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                                        {cfg.label}
                                    </div>
                                    <Edit2 className="w-3.5 h-3.5 text-slate-200 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal */}
            <CitaModal cita={editing} onClose={() => setEditing(null)} onSave={handleSave} onDelete={handleDelete} />
        </div>
    );
};

export default Pruebas;
