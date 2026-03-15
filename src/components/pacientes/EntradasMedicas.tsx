// ─── EntradasMedicas.tsx ─────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = 'http://localhost:3000/api/clinical';

const ESTADO: Record<number, { label: string; color: string }> = {
    1: { label: 'Presupuestado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    2: { label: 'Aceptado',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
    3: { label: 'En curso',      color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    4: { label: 'Facturado',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    5: { label: 'Realizado',     color: 'bg-green-100 text-green-700 border-green-200' },
    6: { label: 'Anulado',       color: 'bg-red-100 text-red-400 border-red-200' },
};

interface EntradaMedica {
    id: number;
    fecha: string | null;
    codigoTto: string | null;
    descripcion: string;
    referencia: string;
    comentario: string;
    piezas: number[];
    estado: number;
    importe: number | null;
    pendiente: number | null;
}

function extraerPiezasRef(ref: string): number[] {
    return [...ref.matchAll(/#(\d{1,2})/g)]
        .map(m => parseInt(m[1], 10))
        .filter(n => n >= 11 && n <= 48);
}

interface Props { idPac: number; }

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
            const r = await fetch(`${API}/patients/${idPac}/entradas/${entrada.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!r.ok) throw new Error(`Error ${r.status}`);
            const updated: EntradaMedica = { ...entrada, ...body, fecha: form.fecha || null };
            onSaved(updated);
            setEditing(false);
        } catch (e: any) {
            setError(e?.message ?? 'Error al guardar');
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
                                <span className="text-[12px] font-bold text-emerald-700">
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
                                <span className={`text-[12px] font-bold ${abonado ? 'text-green-600' : 'text-red-500'}`}>
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
const EntradasMedicas: React.FC<Props> = ({ idPac }) => {
    const [rows, setRows]           = useState<EntradaMedica[]>([]);
    const [loading, setLoading]     = useState(false);
    const [order, setOrder]         = useState<'desc' | 'asc'>('asc');
    const [page, setPage]           = useState(1);
    const [total, setTotal]         = useState(0);
    const [selected, setSelected]   = useState<EntradaMedica | null>(null);
    const PAGE = 50;
    const bottomRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async (pg: number, ord: 'desc' | 'asc') => {
        if (!idPac) return;
        setLoading(true);
        try {
            const r = await fetch(`${API}/patients/${idPac}/entradas?page=${pg}&pageSize=${PAGE}&order=${ord}`);
            if (r.ok) {
                const j = await r.json();
                setRows(j.data ?? []);
                setTotal(j.pagination?.total ?? 0);
                setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'instant' }); }, 50);
            }
        } finally { setLoading(false); }
    }, [idPac]);

    useEffect(() => { setPage(1); load(1, order); }, [idPac, order, load]);

    const handleSaved = (updated: EntradaMedica) => {
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelected(updated);
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

            <div className="flex flex-col w-full overflow-x-hidden">
                {/* Cabecera */}
                <div className="flex items-center justify-between mb-1 px-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Historial clínico</span>
                        {total > 0 && <span className="text-[10px] bg-[#051650] text-white rounded-full px-2 py-0.5">{total}</span>}
                    </div>
                    <button onClick={() => setOrder(o => o === 'desc' ? 'asc' : 'desc')}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#051650] transition-colors">
                        <svg className={`w-3 h-3 transition-transform ${order === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                        {order === 'desc' ? 'Más reciente' : 'Más antigua'}
                    </button>
                </div>

                {/* Lista */}
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-5 h-5 border-2 border-[#051650] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">Sin entradas registradas</p>
                ) : (
                    <div className="flex flex-col divide-y divide-slate-100">
                        {rows.map(e => {
                            const est    = ESTADO[e.estado] ?? { label: `${e.estado}`, color: 'bg-slate-100 text-slate-500 border-slate-200' };
                            const piezasTexto = extraerPiezasRef(e.referencia);
                            const piezas = piezasTexto.length > 0 ? piezasTexto : [...new Set(e.piezas ?? [])];
                            const dotIdx = e.descripcion.indexOf('.');
                            const tto    = dotIdx !== -1 ? e.descripcion.slice(0, dotIdx).trim() : e.descripcion.trim();
                            const nota   = dotIdx !== -1 ? e.descripcion.slice(dotIdx + 1).trim() : (e.comentario ?? '');

                            return (
                                <div
                                    key={e.id}
                                    className="flex items-center gap-2 py-1.5 px-1 min-w-0 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors group"
                                    onClick={() => setSelected(e)}
                                >
                                    {/* Fecha — pill */}
                                    <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 flex-shrink-0 whitespace-nowrap">
                                        {e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                    </span>

                                    {/* Tratamiento */}
                                    <span className="text-[11px] font-semibold text-[#051650] flex-shrink-0">{tto}</span>

                                    {/* Notas */}
                                    {nota && (
                                        <span className="text-[10px] text-slate-400 flex-shrink truncate min-w-0 max-w-[550px] lowercase">{nota}</span>
                                    )}
                                    <span className="flex-1" />

                                    {/* Editar hint */}
                                    <span className="text-[9px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold mr-1">✏️</span>

                                    {/* Pieza + Estado */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {piezas.length > 0 && (
                                            <span className="text-[10px] text-blue-600">
                                                🦷{piezas.slice(0, 2).join(',')}
                                            </span>
                                        )}
                                        <span className={`text-[9px] border rounded-full px-1.5 py-0.5 ${est.color}`}>
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
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button disabled={page <= 1} onClick={() => { const n = page - 1; setPage(n); load(n, order); }}
                            className="text-[11px] text-slate-500 hover:text-[#051650] disabled:opacity-30 transition-colors">
                            ← Anterior
                        </button>
                        <span className="text-[10px] text-slate-400">{page} / {pages}</span>
                        <button disabled={page >= pages} onClick={() => { const n = page + 1; setPage(n); load(n, order); }}
                            className="text-[11px] text-slate-500 hover:text-[#051650] disabled:opacity-30 transition-colors">
                            Siguiente →
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default EntradasMedicas;
