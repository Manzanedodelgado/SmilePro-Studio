// ─── EntradasMedicas.tsx ─────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { analyzeClinicalHistory } from '../../services/ia-dental.service';
import { getEntradasMedicas, updateEntradaMedica } from '../../services/clinical.service';
import type { EntradaMedica } from '../../services/clinical.service';

const LS_KEY = 'smilepro:entradas';

const ESTADO: Record<number, { label: string; color: string }> = {
    1: { label: 'Presupuestado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    2: { label: 'Aceptado',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
    3: { label: 'En curso',      color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    4: { label: 'Facturado',     color: 'bg-teal-100 text-teal-700 border-teal-200' },
    5: { label: 'Realizado',     color: 'bg-teal-100 text-teal-700 border-teal-200' },
    6: { label: 'Anulado',       color: 'bg-red-100 text-red-400 border-red-200' },
};

// EntradaMedica importada desde clinical.service

function extraerPiezasRef(ref: string): number[] {
    return [...ref.matchAll(/#(\d{1,2})/g)]
        .map(m => parseInt(m[1], 10))
        .filter(n => n >= 11 && n <= 48);
}

// ─── Demo data for offline fallback ──────────────────────────────
const DEMO_ENTRADAS: EntradaMedica[] = [
    { id: 1, fecha: '2026-01-15', codigoTto: 'REV01', descripcion: 'Revisión y exploración bucal. Exploración completa con sondaje básico.', referencia: '', comentario: '', piezas: [], estado: 5, importe: 40, pendiente: 0 },
    { id: 2, fecha: '2026-01-15', codigoTto: 'RAD01', descripcion: 'Radiografía panorámica. Sin patología ósea evidente.', referencia: '', comentario: '', piezas: [], estado: 5, importe: 65, pendiente: 0 },
    { id: 3, fecha: '2026-01-16', codigoTto: 'EMP02', descripcion: 'Empaste (composite) 2 caras. Pieza #16 — caries clase II distal.', referencia: '#16', comentario: 'Composite A2, pulido y ajuste oclusal.', piezas: [16], estado: 5, importe: 120, pendiente: 0 },
    { id: 4, fecha: '2026-02-10', codigoTto: 'LIM01', descripcion: 'Limpieza dental (tartrectomía). Cálculo moderado generalizado.', referencia: '', comentario: '', piezas: [], estado: 3, importe: 80, pendiente: 80 },
    { id: 5, fecha: '2026-03-05', codigoTto: 'IMP01', descripcion: 'Implante dental (titanio). Planificación para pieza #46 ausente.', referencia: '#46', comentario: 'Pendiente de cirugía. TAC solicitado.', piezas: [46], estado: 2, importe: 1200, pendiente: 1200 },
];

function loadOfflineEntradas(idPac: number): EntradaMedica[] {
    try {
        const raw = localStorage.getItem(`${LS_KEY}:${idPac}`);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    const demo = DEMO_ENTRADAS.map(e => ({ ...e }));
    try { localStorage.setItem(`${LS_KEY}:${idPac}`, JSON.stringify(demo)); } catch { /* ignore */ }
    return demo;
}

interface Props { idPac: number; hideHeader?: boolean; }

// ─── Modal de detalle / edición ────────────────────────────────────
const EntradaModal: React.FC<{
    entrada: EntradaMedica;
    idPac: number;
    onClose: () => void;
    onSaved: (updated: EntradaMedica) => void;
}> = ({ entrada, idPac, onClose, onSaved }) => {
    const [editing, setEditing]   = useState(false);
    const [saving,  setSaving]    = useState(false);
    const [error,   setError]     = useState<string | null>(null);

    // Estado local del formulario
    const [form, setForm] = useState({
        fecha:       entrada.fecha ? entrada.fecha.slice(0, 10) : '',
        descripcion: entrada.descripcion,
        comentario:  entrada.comentario ?? '',
        estado:      entrada.estado,
        importe:     entrada.importe != null ? String(entrada.importe) : '',
        pendiente:   entrada.pendiente != null ? String(entrada.pendiente) : '',
    });

    const handleChange = (field: string, value: string | number) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const body: Partial<EntradaMedica> = {
                fecha:       form.fecha || null,
                descripcion: form.descripcion,
                comentario:  form.comentario,
                estado:      Number(form.estado),
                importe:     form.importe !== '' ? parseFloat(form.importe) : null,
                pendiente:   form.pendiente !== '' ? parseFloat(form.pendiente) : null,
            };
            const result = await updateEntradaMedica(idPac, entrada.id, body);
            if (!result) throw new Error('Error al guardar');
            const updated: EntradaMedica = { ...entrada, ...body, fecha: form.fecha || null };
            onSaved(updated);
            setEditing(false);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const fmtEuros = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    const abonado  = entrada.importe != null && entrada.pendiente != null && entrada.pendiente <= 0;
    const est      = ESTADO[editing ? Number(form.estado) : entrada.estado] ?? { label: `${entrada.estado}`, color: 'bg-slate-100 text-slate-500 border-slate-200' };
    const piezasTexto = extraerPiezasRef(entrada.referencia);
    const piezas   = piezasTexto.length > 0 ? piezasTexto : [...new Set(entrada.piezas ?? [])];
    const dotIdx   = (editing ? form.descripcion : entrada.descripcion).indexOf('.');
    const tto      = dotIdx !== -1
        ? (editing ? form.descripcion : entrada.descripcion).slice(0, dotIdx).trim()
        : (editing ? form.descripcion : entrada.descripcion).trim();
    const fechaFmt = (editing ? form.fecha : entrada.fecha)
        ? new Date((editing ? form.fecha : entrada.fecha)!).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Cabecera */}
                <div className="flex items-start justify-between px-6 py-4 bg-[#051650] text-white">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Entrada clínica</span>
                        <h2 className="text-[15px] font-black leading-tight">{tto}</h2>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        {!editing && (
                            <button
                                onClick={() => setEditing(true)}
                                className="flex items-center gap-1 text-[11px] font-bold text-blue-200 hover:text-white border border-blue-400/40 hover:border-white px-2.5 py-1 rounded-lg transition-all"
                            >
                                ✏️ Editar
                            </button>
                        )}
                        <button onClick={onClose} className="flex-shrink-0 text-blue-300 hover:text-white transition-colors text-xl leading-none">✕</button>
                    </div>
                </div>

                {/* Cuerpo */}
                <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

                    {error && (
                        <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                            ⚠ {error}
                        </div>
                    )}

                    {/* Fecha */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</span>
                        {editing ? (
                            <input
                                type="date"
                                value={form.fecha}
                                onChange={e => handleChange('fecha', e.target.value)}
                                className="text-[12px] border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#051650]/30"
                            />
                        ) : (
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 w-fit">
                                📅 {fechaFmt}
                            </span>
                        )}
                    </div>

                    {/* Estado */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
                        {editing ? (
                            <select
                                value={form.estado}
                                onChange={e => handleChange('estado', parseInt(e.target.value))}
                                className="text-[12px] border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#051650]/30"
                            >
                                {Object.entries(ESTADO).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        ) : (
                            <span className={`text-[11px] border rounded-full px-3 py-1 font-semibold w-fit ${est.color}`}>{est.label}</span>
                        )}
                    </div>

                    {/* Descripción / Tratamiento */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción</span>
                        {editing ? (
                            <textarea
                                value={form.descripcion}
                                onChange={e => handleChange('descripcion', e.target.value)}
                                rows={3}
                                className="text-[12px] border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#051650]/30"
                            />
                        ) : (
                            <p className="text-[12px] text-slate-600 leading-relaxed">{entrada.descripcion}</p>
                        )}
                    </div>

                    {/* Comentario clínico */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Comentario clínico</span>
                        {editing ? (
                            <textarea
                                value={form.comentario}
                                onChange={e => handleChange('comentario', e.target.value)}
                                rows={3}
                                placeholder="Sin comentario..."
                                className="text-[12px] border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#051650]/30"
                            />
                        ) : (
                            entrada.comentario
                                ? <p className="text-[12px] text-slate-700 leading-relaxed bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">{entrada.comentario}</p>
                                : <p className="text-[11px] text-slate-300 italic">Sin comentario</p>
                        )}
                    </div>

                    {/* Importe / Pendiente */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Importe (€)</span>
                            {editing ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={form.importe}
                                    onChange={e => handleChange('importe', e.target.value)}
                                    className="text-[12px] border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#051650]/30"
                                />
                            ) : (
                                <span className="text-[12px] font-bold text-teal-700">
                                    {entrada.importe != null && entrada.importe > 0 ? fmtEuros(entrada.importe) : '—'}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendiente (€)</span>
                            {editing ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={form.pendiente}
                                    onChange={e => handleChange('pendiente', e.target.value)}
                                    className="text-[12px] border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#051650]/30"
                                />
                            ) : (
                                <span className={`text-[12px] font-bold ${abonado ? 'text-teal-600' : 'text-red-500'}`}>
                                    {entrada.importe != null && entrada.importe > 0
                                        ? (abonado ? '✓ Abonado' : entrada.pendiente != null ? fmtEuros(entrada.pendiente) : '—')
                                        : '—'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Piezas dentales (solo lectura) */}
                    {piezas.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Piezas</span>
                            <div className="flex flex-wrap gap-1.5">
                                {piezas.map(p => (
                                    <span key={p} className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1">
                                        🦷 {p}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Código tratamiento (solo lectura) */}
                    {entrada.codigoTto && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Código</span>
                            <span className="text-[12px] font-mono text-slate-600">{entrada.codigoTto}</span>
                        </div>
                    )}

                    {/* Referencia interna (solo lectura) */}
                    {entrada.referencia && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Referencia interna</span>
                            <span className="text-[10px] font-mono text-slate-400 break-all">{entrada.referencia}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                    {editing ? (
                        <>
                            <button
                                onClick={() => { setEditing(false); setError(null); }}
                                disabled={saving}
                                className="text-[12px] font-semibold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="text-[12px] font-bold text-white bg-[#051650] hover:bg-blue-900 px-5 py-2 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                {saving ? 'Guardando...' : '✓ Guardar cambios'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className="text-[11px] font-semibold text-slate-500 hover:text-[#051650] transition-colors"
                        >
                            Cerrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Componente principal ─────────────────────────────────────────
const EntradasMedicas: React.FC<Props> = ({ idPac, hideHeader }) => {
    const [rows, setRows]           = useState<EntradaMedica[]>([]);
    const [loading, setLoading]     = useState(false);
    const [order, setOrder]         = useState<'desc' | 'asc'>('asc');
    const [page, setPage]           = useState(1);
    const [total, setTotal]         = useState(0);
    const [selected, setSelected]   = useState<EntradaMedica | null>(null);
    const [isOffline, setIsOffline] = useState(false);

    // AI summary state
    const [aiSummary, setAiSummary]     = useState<string | null>(null);
    const [aiLoading, setAiLoading]     = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    const PAGE = 50;
    const bottomRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async (pg: number, ord: 'desc' | 'asc') => {
        if (!idPac) return;
        setLoading(true);
        try {
            const result = await getEntradasMedicas(idPac, pg, PAGE, ord);
            if (result) {
                setRows(result.data ?? []);
                setTotal(result.pagination?.total ?? 0);
                setIsOffline(false);
                setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'instant' }); }, 50);
            } else {
                throw new Error('sin respuesta');
            }
        } catch {
            // Backend no disponible — fallback a localStorage
            const offline = loadOfflineEntradas(idPac);
            const sorted = [...offline].sort((a, b) => {
                const da = a.fecha ?? '', db = b.fecha ?? '';
                return ord === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
            });
            const start = (pg - 1) * PAGE;
            setRows(sorted.slice(start, start + PAGE));
            setTotal(offline.length);
            setIsOffline(true);
        } finally { setLoading(false); }
    }, [idPac]);

    useEffect(() => { setPage(1); load(1, order); }, [idPac, order, load]);

    const handleSaved = (updated: EntradaMedica) => {
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelected(updated);
    };

    const handleAISummary = async () => {
        if (rows.length === 0) return;
        setAiLoading(true);
        setShowSummary(true);
        setAiSummary(null);
        const summary = await analyzeClinicalHistory(rows.map(e => ({
            fecha: e.fecha, descripcion: e.descripcion, estado: e.estado, importe: e.importe,
        })));
        setAiSummary(summary);
        setAiLoading(false);
    };

    const pages = Math.ceil(total / PAGE);

    return (
        <>
            {/* Modal detalle / edición */}
            {selected && (
                <EntradaModal
                    entrada={selected}
                    idPac={idPac}
                    onClose={() => setSelected(null)}
                    onSaved={handleSaved}
                />
            )}

            {/* IA — Panel de resumen clínico */}
            {showSummary && (
                <div className="mb-3 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/60 rounded-xl p-3.5 relative">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">IA Dental — Resumen Clínico</span>
                        </div>
                        <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-600 text-sm leading-none flex-shrink-0">✕</button>
                    </div>
                    {aiLoading ? (
                        <div className="flex items-center gap-2 text-[11px] text-indigo-500 font-medium">
                            <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                            Analizando historial...
                        </div>
                    ) : (
                        <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line">{aiSummary}</p>
                    )}
                </div>
            )}

            <div className="flex flex-col w-full overflow-x-hidden">
                {!hideHeader && <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2.5">
                        {total > 0 && <span className="text-[10px] bg-gradient-to-r from-[#051650] to-blue-700 text-white rounded-full px-2.5 py-0.5 font-black shadow-sm">{total}</span>}
                        {isOffline && <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-bold">offline</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        {rows.length > 0 && (
                            <button
                                onClick={handleAISummary}
                                disabled={aiLoading}
                                className="flex items-center gap-1.5 text-[10px] text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200/60 disabled:opacity-50 font-bold"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                Resumen IA
                            </button>
                        )}
                        <button onClick={() => setOrder(o => o === 'desc' ? 'asc' : 'desc')}
                            className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-[#051650] transition-colors bg-slate-50 hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                            <svg className={`w-3 h-3 transition-transform ${order === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                            {order === 'desc' ? 'Más reciente' : 'Más antigua'}
                        </button>
                    </div>
                </div>}

                {/* Lista */}
                {loading ? (
                    <div className="flex flex-col gap-2">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 py-2 px-2" style={{ animationDelay: `${i * 80}ms` }}>
                                <div className="w-16 h-5 rounded-full animate-skeleton" />
                                <div className="w-32 h-4 rounded-lg animate-skeleton" />
                                <div className="flex-1 h-3 rounded-lg animate-skeleton" />
                                <div className="w-16 h-5 rounded-full animate-skeleton" />
                            </div>
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 border border-slate-200/60">
                            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <p className="text-[12px] font-bold text-slate-400">Sin entradas registradas</p>
                        <p className="text-[10px] text-slate-300 mt-1">Las entradas clínicas aparecerán aquí</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-0.5">
                        {rows.map((e, idx) => {
                            const est    = ESTADO[e.estado] ?? { label: `${e.estado}`, color: 'bg-slate-100 text-slate-500 border-slate-200' };
                            const piezasTexto = extraerPiezasRef(e.referencia);
                            const piezas = piezasTexto.length > 0 ? piezasTexto : [...new Set(e.piezas ?? [])];
                            const dotIdx = e.descripcion.indexOf('.');
                            const tto    = dotIdx !== -1 ? e.descripcion.slice(0, dotIdx).trim() : e.descripcion.trim();
                            const nota   = dotIdx !== -1 ? e.descripcion.slice(dotIdx + 1).trim() : (e.comentario ?? '');

                            // Estado-based left border (4 categories)
                            const borderColor = e.estado === 5 ? 'border-l-teal-400'
                                : e.estado === 6 ? 'border-l-red-300'
                                : e.estado >= 3 ? 'border-l-blue-400'
                                : 'border-l-amber-300';

                            return (
                                <div
                                    key={e.id}
                                    className={`flex items-center gap-2.5 py-2 px-2.5 min-w-0 cursor-pointer hover:bg-blue-50/40 rounded-xl transition-all duration-200 group border-l-[3px] ${borderColor}`}
                                    onClick={() => setSelected(e)}
                                    style={{ animationDelay: `${idx * 30}ms` }}
                                >
                                    {/* Fecha — pill */}
                                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100/80 border border-slate-200/60 rounded-lg px-2 py-1 flex-shrink-0 whitespace-nowrap tabular-nums">
                                        {e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                    </span>

                                    {/* Tratamiento */}
                                    <span className="text-[13px] font-bold text-[#051650] flex-shrink-0 group-hover:text-blue-700 transition-colors">{tto}</span>

                                    {/* Notas */}
                                    {nota && (
                                        <span className="text-[12px] text-slate-400 flex-shrink truncate min-w-0 max-w-[550px] lowercase">{nota}</span>
                                    )}
                                    <span className="flex-1" />

                                    {/* Editar hint */}
                                    <span className="text-[9px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold mr-1">✏️</span>

                                    {/* Pieza + Estado */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {piezas.length > 0 && (
                                            <span className="text-[11px] text-blue-600 font-medium">
                                                🦷{piezas.slice(0, 2).join(',')}
                                            </span>
                                        )}
                                        <span className={`text-[10px] border rounded-lg px-2 py-0.5 font-bold ${est.color}`}>
                                            {est.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={bottomRef} />
                    </div>
                )}

                {/* Paginación */}
                {pages > 1 && (
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100/60">
                        <button disabled={page <= 1} onClick={() => { const n = page - 1; setPage(n); load(n, order); }}
                            className="text-[11px] font-bold text-slate-500 hover:text-[#051650] disabled:opacity-30 transition-colors flex items-center gap-1">
                            ← Anterior
                        </button>
                        <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-3 py-1 rounded-lg border border-slate-200/60">{page} / {pages}</span>
                        <button disabled={page >= pages} onClick={() => { const n = page + 1; setPage(n); load(n, order); }}
                            className="text-[11px] font-bold text-slate-500 hover:text-[#051650] disabled:opacity-30 transition-colors flex items-center gap-1">
                            Siguiente →
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default EntradasMedicas;
