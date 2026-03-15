
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
    aceptarPresupuesto, rechazarPresupuesto,
    type Presupuesto, type LineaPresupuesto,
} from '../../services/presupuestos.service';
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
    const [resumen, setResumen] = useState({ deudaPendiente: 0, totalPresupuestado: 0, totalCobrado: 0, presupuestosCount: 0 });
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState<{ id: number; action: 'aceptar' | 'rechazar' } | null>(null);

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

    // ── Render ────────────────────────────────────────────────────

    return (
        <div className="space-y-5 pb-10 animate-in fade-in duration-500">

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
                        onClick={() => toast('Funcionalidad de financiación — contacta con tu gestor bancario')}
                        className="mt-4 bg-white text-[#051650] py-2 px-4 rounded-lg text-[12px] font-bold uppercase tracking-widest self-start hover:bg-blue-50 transition-all active:scale-95">
                        Consultar
                    </button>
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
                            onClick={() => toast('Creación de presupuestos — se realiza en GELITE y se sincroniza aquí automáticamente')}
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
                                                        {fmt(c.precioUnitario)}
                                                        {c.descuento > 0 && <span className="ml-1 text-[12px] text-[#051650] font-bold">-{c.descuento}%</span>}
                                                    </td>
                                                    <td className="py-2.5 text-right font-bold text-slate-700">{fmt(c.importeLinea)}</td>
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
                                        {p.importePagado > 0 && (
                                            <>
                                                <div className="text-right">
                                                    <p className="text-slate-400 font-bold">Pagado</p>
                                                    <p className="text-[#051650] font-bold text-base">{fmt(p.importePagado)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-slate-400 font-bold">Pendiente</p>
                                                    <p className="text-[#E03555] font-bold text-base">{fmt(p.importePendiente)}</p>
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
                                    <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200">
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
                                                onClick={() => toast('Descarga de PDF — pendiente de integración con Verifactu')}
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
