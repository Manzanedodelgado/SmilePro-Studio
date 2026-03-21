
import React, { useState, useEffect, useCallback } from 'react';
import {
    FolderOpen, Folder, Printer, MessageSquare, Check, X,
    Receipt, CreditCard, Plus, ChevronDown, ChevronUp,
    AlertCircle, TrendingUp, Banknote, Loader2, RefreshCw,
    Circle, CheckCircle2, Clock
} from 'lucide-react';
import { sendTextMessage, isEvolutionConfigured } from '../../services/evolution.service';
import {
    getPresupuestosByPaciente, getResumenEconomico,
    aceptarPresupuesto, rechazarPresupuesto, registrarCobro,
    type Presupuesto, type LineaPresupuesto,
} from '../../services/presupuestos.service';
import PresupuestoModal from './PresupuestoModal';
import { getFacturasByPaciente } from '../../services/facturacion.service';
import type { FacturaUI } from '../../services/facturacion.service';
import { useAuth } from '../../context/AuthContext';
import { isDbConfigured } from '../../services/db';

// ── Helpers de formato ────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const estadoConfig: Record<string, string> = {
    'Aceptado': 'bg-blue-50 text-[#051650] border-blue-200',
    'En curso': 'bg-blue-50 text-blue-700 border-blue-200',
    'Finalizado': 'bg-slate-50 text-slate-600 border-slate-200',
    'Pendiente': 'bg-[#FEFDE8] text-[#051650] border-[#FBFFA3]',
    'Rechazado': 'bg-[#FFF0F3] text-[#E03555] border-[#FFC0CB]',
    'Caducado': 'bg-slate-50 text-slate-400 border-slate-200',
    'Borrador': 'bg-slate-50 text-slate-400 border-slate-200',
};

const estadoLineaIcon = (e: LineaPresupuesto['estado']) => {
    if (e === 'Finalizado') return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    if (e === 'En tratamiento') return <Clock className="w-4 h-4 text-blue-500" />;
    return <Circle className="w-3 h-3 text-slate-500" />;
};

// ── Props ─────────────────────────────────────────────────────────

interface EconomicaProps {
    numPac?: string;
    idPac?: number;          // IdPac GELITE — necesario para filtrar facturas y presupuestos
    pacienteNombre?: string;
    pacienteTelefono?: string;
    showToast?: (msg: string) => void;
}

// ── Componente ────────────────────────────────────────────────────

const Economica: React.FC<EconomicaProps> = ({
    numPac = '',
    idPac,
    pacienteNombre = '',
    pacienteTelefono = '',
    showToast,
}) => {
    const { user } = useAuth();
    const toast = (msg: string) => showToast ? showToast(msg) : alert(msg);
    const dbOk = isDbConfigured();

    const [activeTab, setActiveTab] = useState<'presupuestos' | 'pagos'>('presupuestos');
    const [expanded, setExpanded] = useState<number | null>(null);
    const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
    const [movimientos, setMovimientos] = useState<FacturaUI[]>([]);
    const [resumen, setResumen] = useState({ deudaPendiente: 0, totalPresupuestado: 0, totalCobrado: 0, presupuestosCount: 0, totalFacturado: 0, totalPagado: 0, totalPendiente: 0 });
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState<{ id: number; action: 'aceptar' | 'rechazar' } | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingPres, setEditingPres] = useState<Presupuesto | null>(null);
    const [registrandoCobro, setRegistrandoCobro] = useState<{ id: number; importe: string } | null>(null);
    const [showFinancing, setShowFinancing] = useState(false);
    const [finCapital, setFinCapital] = useState('');
    const [finPlazo, setFinPlazo] = useState('12');
    const [finTin, setFinTin] = useState('6');

    // ── Carga de datos ────────────────────────────────────────────

    const loadData = useCallback(async () => {
        if (!numPac) return;
        setLoading(true);
        try {
            const [pres, facturas, res] = await Promise.all([
                getPresupuestosByPaciente(numPac, idPac ? String(idPac) : undefined),
                // Facturas filtradas por IdPac (GELITE no tiene NumPac en NV_CabFactura)
                idPac ? getFacturasByPaciente(idPac) : Promise.resolve([] as FacturaUI[]),
                getResumenEconomico(numPac, idPac ? String(idPac) : undefined),
            ]);
            setPresupuestos(pres);
            setMovimientos(facturas);
            setResumen(res);
            if (pres.length > 0) setExpanded(pres[0].id);
        } finally {
            setLoading(false);
        }
    }, [numPac, idPac]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Acciones ──────────────────────────────────────────────────

    const handleImprimir = (p: Presupuesto) => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<html><head><title>Presupuesto ${p.id}</title></head><body style="font-family:Arial,sans-serif;padding:24px">`);
        w.document.write(`<h2 style="color:#051650">Presupuesto #${p.id} — ${pacienteNombre}</h2>`);
        w.document.write(`<p>Fecha: ${p.fechaInicio ?? '—'} · Estado: ${p.estado} · Total: ${fmt(p.importeTotal)}</p>`);
        w.document.write('<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><tr style="background:#f8f9fa"><th>Concepto</th><th>Pieza</th><th>Cant.</th><th>Precio</th><th>Desc.</th><th>Total</th><th>Estado</th></tr>');
        p.lineas.forEach(c => {
            w.document.write(`<tr><td>${c.descripcion}</td><td>${c.pieza ?? '—'}</td><td>1</td><td>${fmt(c.precioPresupuesto)}</td><td>—</td><td>${fmt(c.precioPresupuesto)}</td><td>${c.estado}</td></tr>`);
        });
        w.document.write(`</table><br><p style="text-align:right;font-size:1.2em"><strong>Total: ${fmt(p.importeTotal)}</strong></p>`);
        w.document.write('</body></html>');
        w.document.close();
        w.print();
    };

    const handleWhatsApp = async (p: Presupuesto) => {
        const texto = `Hola ${pacienteNombre}, tu presupuesto #${p.id} es de ${fmt(p.importeTotal)} e incluye ${p.lineas.length} tratamiento(s). Estamos a tu disposición para cualquier consulta 😊`;
        if (isEvolutionConfigured() && pacienteTelefono) {
            const ok = await sendTextMessage(pacienteTelefono, texto);
            toast(ok ? 'Presupuesto enviado por WhatsApp' : 'Error al enviar WhatsApp');
        } else {
            window.open(`https://wa.me/${pacienteTelefono?.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
        }
    };

    const handleAceptar = async (p: Presupuesto) => {
        setConfirming(null);
        const ok = await aceptarPresupuesto(p.id, numPac, user?.email ?? 'unknown');
        if (ok) {
            setPresupuestos(prev => prev.map(x => x.id === p.id ? { ...x, estado: 'Aceptado' } : x));
            toast('✅ Presupuesto aceptado y registrado');
            // Enviar confirmación por WhatsApp si hay teléfono
            if (pacienteTelefono) {
                const txt = `✅ Hola ${pacienteNombre}, confirmamos que has aceptado el presupuesto #${p.id} por ${fmt(p.importeTotal)}. Nos pondremos en contacto para planificar las citas. ¡Gracias por confiar en Rubio García Dental! 🦷`;
                if (isEvolutionConfigured()) sendTextMessage(pacienteTelefono, txt);
                else window.open(`https://wa.me/${pacienteTelefono.replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`, '_blank');
            }
        } else {
            // Sin BD: solo actualizar UI
            setPresupuestos(prev => prev.map(x => x.id === p.id ? { ...x, estado: 'Aceptado' } : x));
            toast('⚠️ Presupuesto marcado como aceptado (sin BD configurada — no persiste)');
        }
    };

    const handleRechazar = async (p: Presupuesto) => {
        setConfirming(null);
        const ok = await rechazarPresupuesto(p.id, numPac, user?.email ?? 'unknown');
        if (ok) {
            setPresupuestos(prev => prev.map(x => x.id === p.id ? { ...x, estado: 'Rechazado' } : x));
            toast('Presupuesto marcado como rechazado');
        } else {
            setPresupuestos(prev => prev.map(x => x.id === p.id ? { ...x, estado: 'Rechazado' } : x));
            toast('⚠️ Rechazado solo en UI (sin BD configurada)');
        }
    };

    const handleCobroConfirm = async () => {
        if (!registrandoCobro) return;
        const importe = parseFloat(registrandoCobro.importe.replace(',', '.'));
        if (isNaN(importe) || importe <= 0) { toast('Importe inválido'); return; }
        const updated = await registrarCobro(registrandoCobro.id, importe);
        if (updated) {
            setPresupuestos(prev => prev.map(x => x.id === registrandoCobro.id ? updated : x));
            toast(`✅ Cobro de ${importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} registrado`);
        }
        setRegistrandoCobro(null);
        loadData();
    };

    // ── Render ────────────────────────────────────────────────────

    return (
        <div className="space-y-5 pb-10 animate-in fade-in duration-500">

            {/* ── Presupuesto modal ── */}
            {showModal && (
                <PresupuestoModal
                    numPac={numPac}
                    pacienteNombre={pacienteNombre}
                    pacienteTelefono={pacienteTelefono}
                    presupuesto={editingPres}
                    onClose={() => { setShowModal(false); setEditingPres(null); }}
                    onSaved={saved => {
                        setShowModal(false);
                        setEditingPres(null);
                        setPresupuestos(prev => {
                            const idx = prev.findIndex(x => x.id === saved.id);
                            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
                            return [saved, ...prev];
                        });
                        setExpanded(saved.id);
                        loadData();
                    }}
                    showToast={showToast}
                />
            )}

            {/* ── Registrar cobro inline ── */}
            {registrandoCobro && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 8000,
                    background: 'rgba(5,22,80,0.45)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{
                        background: '#fff', borderRadius: 16, padding: 28,
                        width: 380, boxShadow: '0 20px 60px rgba(5,22,80,0.2)',
                    }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#051650' }}>Registrar cobro</h3>
                        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94a3b8' }}>
                            Presupuesto #{registrandoCobro.id}
                        </p>
                        <label style={{ display: 'block', marginBottom: 14 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                                Importe cobrado (€)
                            </span>
                            <input
                                type="number" min={0} step={0.01}
                                value={registrandoCobro.importe}
                                onChange={e => setRegistrandoCobro(v => v ? { ...v, importe: e.target.value } : v)}
                                autoFocus
                                style={{ width: '100%', padding: '10px 14px', fontSize: 15, fontWeight: 700, border: '2px solid #051650', borderRadius: 8, boxSizing: 'border-box', fontFamily: 'monospace' }}
                            />
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setRegistrandoCobro(null)} style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', cursor: 'pointer' }}>
                                Cancelar
                            </button>
                            <button onClick={handleCobroConfirm} style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 800, border: 'none', borderRadius: 8, background: '#051650', color: '#fff', cursor: 'pointer' }}>
                                Registrar cobro
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Banner sin BD */}
            {!dbOk && (
                <div className="bg-[#FEFDE8] border border-[#FBFFA3] rounded-xl px-4 py-3 text-[13px] text-[#051650] font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>BD no configurada — los datos económicos requieren conexión con el backend local (localhost:3000).</span>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Deuda */}
                <div className="bg-white rounded-xl border border-rose-100 shadow-sm p-5 relative overflow-hidden">
                    <div className="flex items-start justify-between mb-2">
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Deuda Pendiente</p>
                        <AlertCircle className="w-4 h-4 text-[#FF4B68]" />
                    </div>
                    {loading
                        ? <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
                        : <p className="text-3xl font-bold text-[#E03555]">{resumen.deudaPendiente > 0 ? fmt(resumen.deudaPendiente) : '—'}</p>
                    }
                    <p className="text-[12px] font-bold text-[#FF4B68] mt-1">
                        {resumen.deudaPendiente > 0 ? 'Pendiente de cobro' : 'Sin deuda registrada'}
                    </p>
                    <div className="absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-rose-50 to-transparent" />
                </div>

                {/* Total facturado */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-start justify-between mb-2">
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Total Presupuestado</p>
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                    </div>
                    {loading
                        ? <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
                        : <p className="text-3xl font-bold text-slate-800">{resumen.totalFacturado > 0 ? fmt(resumen.totalFacturado) : '—'}</p>
                    }
                    {resumen.totalFacturado > 0 && (
                        <>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div
                                    className="bg-blue-500 h-full rounded-full transition-all duration-700"
                                    style={{ width: `${Math.min((resumen.totalPagado / resumen.totalFacturado) * 100, 100)}%` }}
                                />
                            </div>
                            <p className="text-[12px] font-bold text-slate-400 text-right mt-1">
                                {Math.round((resumen.totalPagado / resumen.totalFacturado) * 100)}% cobrado
                            </p>
                        </>
                    )}
                </div>

                {/* Financiación */}
                <div className="bg-[#051650] rounded-xl shadow-lg p-5 flex flex-col justify-between relative overflow-hidden group cursor-pointer hover:brightness-110 transition-all">
                    <div>
                        <div className="flex items-start justify-between mb-2">
                            <p className="text-[12px] font-bold text-white/80 uppercase tracking-widest">Financiación</p>
                            <CreditCard className="w-4 h-4 text-white/80" />
                        </div>
                        <p className="text-xl font-bold text-white mt-1">Disponible</p>
                        <p className="text-[12px] text-white/70 font-medium mt-1">Consulta financiación a medida con tu gestor bancario.</p>
                    </div>
                    <button
                        onClick={() => setShowFinancing(v => !v)}
                        className="mt-4 bg-white text-[#051650] py-2 px-4 rounded-lg text-[12px] font-bold uppercase tracking-widest self-start hover:bg-blue-50 transition-all active:scale-95">
                        Calcular cuota
                    </button>
                    {showFinancing && (
                        <div className="mt-3 bg-white/15 rounded-xl p-3 space-y-2 text-white">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1">Capital (€)</p>
                                    <input type="number" value={finCapital} onChange={e => setFinCapital(e.target.value)} placeholder={resumen.totalPendiente > 0 ? String(Math.round(resumen.totalPendiente)) : '1000'} className="w-full bg-white/20 rounded-lg px-2 py-1.5 text-[13px] font-bold text-white placeholder-white/50 outline-none focus:ring-1 focus:ring-white/60" />
                                </div>
                                <div className="w-16">
                                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1">Meses</p>
                                    <input type="number" value={finPlazo} onChange={e => setFinPlazo(e.target.value)} min="1" max="84" className="w-full bg-white/20 rounded-lg px-2 py-1.5 text-[13px] font-bold text-white outline-none focus:ring-1 focus:ring-white/60" />
                                </div>
                                <div className="w-16">
                                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1">TIN %</p>
                                    <input type="number" value={finTin} onChange={e => setFinTin(e.target.value)} min="0" step="0.1" className="w-full bg-white/20 rounded-lg px-2 py-1.5 text-[13px] font-bold text-white outline-none focus:ring-1 focus:ring-white/60" />
                                </div>
                            </div>
                            {(() => {
                                const C = parseFloat(finCapital || (resumen.totalPendiente > 0 ? String(resumen.totalPendiente) : '1000'));
                                const n = Math.max(1, parseInt(finPlazo) || 12);
                                const r = (parseFloat(finTin) || 0) / 100 / 12;
                                const cuota = r === 0 ? C / n : C * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
                                const total = cuota * n;
                                return (
                                    <div className="flex justify-between items-end pt-1">
                                        <div>
                                            <p className="text-[10px] opacity-70 uppercase font-bold">Cuota mensual</p>
                                            <p className="text-[22px] font-bold leading-none">{isFinite(cuota) ? cuota.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] opacity-70 uppercase font-bold">Total a pagar</p>
                                            <p className="text-[14px] font-bold opacity-90">{isFinite(total) ? total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—'}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                    {(['presupuestos', 'pagos'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-md text-[12px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-[#051650] text-white shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                        >
                            {tab === 'presupuestos' ? 'Presupuestos' : 'Pagos y Facturas'}
                        </button>
                    ))}
                </div>
                <button
                    onClick={loadData}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all text-slate-400 hover:text-[#051650]"
                    title="Recargar">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* ── Presupuestos ── */}
            {activeTab === 'presupuestos' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="flex justify-end">
                        <button
                            onClick={() => { setEditingPres(null); setShowModal(true); }}
                            className="flex items-center gap-1.5 bg-[#051650] text-white px-4 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-widest shadow-md hover:bg-blue-900 transition-all active:scale-95">
                            <Plus className="w-4 h-4" /> Nuevo Presupuesto
                        </button>
                    </div>

                    {loading && (
                        <div className="space-y-2">
                            {[1, 2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
                        </div>
                    )}

                    {!loading && presupuestos.length === 0 && (
                        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
                            <FolderOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">Sin presupuestos</p>
                            <p className="text-[12px] text-slate-300 mt-1">
                                {dbOk ? 'Este paciente no tiene presupuestos en GELITE' : 'Requiere conexión a BD'}
                            </p>
                        </div>
                    )}

                    {!loading && presupuestos.map(p => (
                        <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* Cabecera del presupuesto */}
                            <div
                                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${expanded === p.id ? 'bg-[#051650] text-white border-[#051650]' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                        {expanded === p.id ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-slate-800">Presupuesto #{p.id}</h4>
                                            <span className={`px-2 py-0.5 rounded text-[12px] font-bold uppercase border ${estadoConfig[p.estado] ?? ''}`}>
                                                {p.estado}
                                            </span>
                                        </div>
                                        <p className="text-[12px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                            {p.fecha} · {p.lineas.length} tratamiento(s)
                                            {p.fechaAceptacion ? ` · Aceptado ${p.fechaAceptacion}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                                        <p className="text-lg font-bold text-[#051650]">{fmt(p.importeTotal)}</p>
                                    </div>
                                    {expanded === p.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                </div>
                            </div>

                            {/* Detalle expandido */}
                            {expanded === p.id && (
                                <div className="border-t border-slate-100 bg-slate-50/50 p-4 animate-in fade-in duration-200">

                                    {/* Tabla de líneas */}
                                    <table className="w-full text-left mb-4">
                                        <thead>
                                            <tr className="text-[12px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                                <th className="pb-2 pl-2">Tratamiento</th>
                                                <th className="pb-2 text-center">Pieza</th>
                                                <th className="pb-2 text-center">Cant.</th>
                                                <th className="pb-2 text-right">Precio</th>
                                                <th className="pb-2 text-right">Total</th>
                                                <th className="pb-2 text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {p.lineas.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="py-4 text-center text-[12px] text-slate-400">
                                                        Sin líneas de tratamiento
                                                    </td>
                                                </tr>
                                            )}
                                            {p.lineas.map(c => (
                                                <tr key={c.id} className="text-[13px] border-b border-slate-100 last:border-0">
                                                    <td className="py-2.5 pl-2 font-medium text-slate-700">{c.descripcion}</td>
                                                    <td className="py-2.5 text-center font-mono text-slate-500 text-[12px]">
                                                        {c.pieza ?? c.arcada ?? '—'}
                                                    </td>
                                                    <td className="py-2.5 text-center text-slate-500">{c.cantidad}</td>
                                                    <td className="py-2.5 text-right text-slate-600">
                                                        {fmt(c.precioUnitario ?? 0)}
                                                        {(c.descuento ?? 0) > 0 && <span className="ml-1 text-[12px] text-[#051650] font-bold">-{c.descuento}%</span>}
                                                    </td>
                                                    <td className="py-2.5 text-right font-bold text-slate-700">{fmt(c.importeLinea ?? 0)}</td>
                                                    <td className="py-2.5 text-center">{estadoLineaIcon(c.estado)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Totales */}
                                    <div className="flex justify-end gap-6 text-[12px] mb-4 pr-2">
                                        <div className="text-right">
                                            <p className="text-slate-400 font-bold">Total presupuesto</p>
                                            <p className="text-[#051650] font-bold text-base">{fmt(p.importeTotal)}</p>
                                        </div>
                                        {(p.importePagado ?? 0) > 0 && (
                                            <>
                                                <div className="text-right">
                                                    <p className="text-slate-400 font-bold">Pagado</p>
                                                    <p className="text-[#051650] font-bold text-base">{fmt(p.importePagado ?? 0)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-slate-400 font-bold">Pendiente</p>
                                                    <p className="text-[#E03555] font-bold text-base">{fmt(p.importePendiente ?? 0)}</p>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Modal de confirmación */}
                                    {confirming?.id === p.id && (
                                        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-lg animate-in fade-in duration-150">
                                            <p className="text-sm font-bold text-slate-700 mb-1">
                                                {confirming.action === 'aceptar' ? '¿Confirmar aceptación del presupuesto?' : '¿Marcar este presupuesto como rechazado?'}
                                            </p>
                                            <p className="text-[12px] text-slate-400 mb-3">
                                                {confirming.action === 'aceptar'
                                                    ? 'Se registrará la aceptación con fecha y usuario actual. Se enviará confirmación al paciente por WhatsApp si está configurado.'
                                                    : 'El presupuesto quedará marcado como rechazado en el sistema.'}
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => confirming.action === 'aceptar' ? handleAceptar(p) : handleRechazar(p)}
                                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold uppercase text-white shadow-sm transition-all active:scale-95 ${confirming.action === 'aceptar' ? 'bg-blue-500 hover:bg-[#051650]' : 'bg-red-500 hover:bg-[#E03555]'}`}>
                                                    <Check className="w-3.5 h-3.5" />
                                                    {confirming.action === 'aceptar' ? 'Sí, aceptar' : 'Sí, rechazar'}
                                                </button>
                                                <button
                                                    onClick={() => setConfirming(null)}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-[12px] font-bold uppercase hover:bg-slate-200 transition-all">
                                                    <X className="w-3.5 h-3.5" /> Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Acciones */}
                                    <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-slate-200">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => handleImprimir(p)}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold uppercase text-slate-500 hover:bg-slate-50 hover:text-[#051650] transition-colors">
                                                <Printer className="w-3.5 h-3.5" /> Imprimir
                                            </button>
                                            <button
                                                onClick={() => handleWhatsApp(p)}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold uppercase text-slate-500 hover:bg-slate-50 hover:text-[#051650] transition-colors">
                                                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                                            </button>
                                            <button
                                                onClick={() => { setEditingPres(p); setShowModal(true); }}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold uppercase text-slate-500 hover:bg-slate-50 hover:text-[#051650] transition-colors">
                                                <Receipt className="w-3.5 h-3.5" /> Editar
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {p.importePendiente > 0 && p.estado !== 'Rechazado' && p.estado !== 'Borrador' && (
                                                <button
                                                    onClick={() => setRegistrandoCobro({ id: p.id, importe: String(p.importePendiente) })}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-[#FEFDE8] border border-[#FBFFA3] text-[#051650] rounded-lg text-[12px] font-bold uppercase hover:bg-amber-100 transition-colors">
                                                    <Banknote className="w-3.5 h-3.5" /> Registrar cobro
                                                </button>
                                            )}
                                            {p.estado === 'Pendiente' && (
                                                <>
                                                    <button
                                                        onClick={() => setConfirming({ id: p.id, action: 'aceptar' })}
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg text-[12px] font-bold uppercase hover:bg-[#051650] transition-colors shadow-sm active:scale-95">
                                                        <Check className="w-3.5 h-3.5" /> Aceptar
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirming({ id: p.id, action: 'rechazar' })}
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#FFC0CB] text-red-500 rounded-lg text-[12px] font-bold uppercase hover:bg-[#FFF0F3] transition-colors">
                                                        <X className="w-3.5 h-3.5" /> Rechazar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Pagos y Facturas ── */}
            {activeTab === 'pagos' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Historial de Facturas</h3>
                        <button
                            onClick={() => {
                                if (movimientos.length === 0) { toast('Sin facturas para exportar'); return; }
                                const rows = [['No. Factura', 'Fecha', 'Total', 'Estado'], ...movimientos.map(m => [m.id, m.date, m.total, m.status])];
                                const csv = rows.map(r => r.join(';')).join('\n');
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                                a.download = `facturas_${numPac || 'paciente'}.csv`;
                                a.click();
                                toast('Facturas exportadas');
                            }}
                            className="flex items-center gap-1.5 text-[12px] font-bold text-[#051650] uppercase hover:underline">
                            <Banknote className="w-3.5 h-3.5" /> Exportar CSV
                        </button>
                    </div>

                    {loading && (
                        <div className="p-8 text-center">
                            <Loader2 className="w-6 h-6 text-slate-300 animate-spin mx-auto" />
                        </div>
                    )}

                    {!loading && movimientos.length === 0 && (
                        <div className="p-10 text-center">
                            <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">Sin facturas</p>
                            <p className="text-[12px] text-slate-300 mt-1">
                                {dbOk ? 'No hay facturas en GELITE para este paciente' : 'Requiere conexión a BD'}
                            </p>
                        </div>
                    )}

                    {!loading && movimientos.length > 0 && (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                                    <th className="p-4">Nº Factura</th>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Base</th>
                                    <th className="p-4 text-right">Total</th>
                                    <th className="p-4 text-center">Estado</th>
                                    <th className="p-4 text-center">PDF</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px] font-medium text-slate-600">
                                {movimientos.map(m => (
                                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-mono text-[12px] text-slate-500">{m.id}</td>
                                        <td className="p-4 font-bold text-slate-700">{m.date}</td>
                                        <td className="p-4 text-slate-500">{m.base}</td>
                                        <td className="p-4 text-right font-bold text-[#051650]">{m.total}</td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full border ${m.status === 'Liquidado' ? 'text-[#051650] bg-blue-50 border-blue-100' : m.status === 'Impagado' ? 'text-[#E03555] bg-[#FFF0F3] border-red-100' : 'text-[#051650] bg-[#FEFDE8] border-amber-100'}`}>
                                                {m.status === 'Liquidado' && <Check className="w-3 h-3" />}
                                                {m.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => {
                                                    const w = window.open('', '_blank', 'width=800,height=600');
                                                    if (!w) return;
                                                    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Factura ${m.id}</title><style>body{font-family:sans-serif;padding:40px;color:#1e293b}h1{font-size:20px;border-bottom:2px solid #051650;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:24px}th{text-align:left;padding:8px;background:#f8fafc;font-size:12px;text-transform:uppercase;color:#64748b}td{padding:10px 8px;border-top:1px solid #f1f5f9;font-size:14px}.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${m.status === 'Liquidado' ? '#eff6ff' : m.status === 'Impagado' ? '#fff0f3' : '#fefde8'};color:${m.status === 'Liquidado' ? '#051650' : m.status === 'Impagado' ? '#e03555' : '#051650'}}.footer{margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:12px}@media print{button{display:none}}</style></head><body><h1>Factura · ${m.id}</h1><p style="color:#64748b;font-size:13px">Rubio García Dental &nbsp;·&nbsp; ${new Date().toLocaleDateString('es-ES')}</p><table><thead><tr><th>Paciente</th><th>Fecha</th><th>Base imponible</th><th>Total</th><th>Estado</th></tr></thead><tbody><tr><td><strong>${pacienteNombre || m.name}</strong></td><td>${m.date}</td><td>${m.base}</td><td><strong>${m.total}</strong></td><td><span class="badge">${m.status}</span></td></tr></tbody></table><div class="footer">Documento generado por SmilePro Studio · Verifactu: ${m.tbai}</div><br><button onclick="window.print()" style="padding:8px 20px;background:#051650;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir / Guardar PDF</button></body></html>`);
                                                    w.document.close();
                                                }}
                                                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 hover:text-[#051650] transition-all mx-auto">
                                                <Receipt className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default Economica;
