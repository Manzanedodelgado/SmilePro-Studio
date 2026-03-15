import React, { useState, useEffect } from 'react';
import {
    Calendar, Euro, Ban, CheckCircle2, Clock, Users,
    MessageSquare, ChevronRight, Activity, AlertTriangle,
    TrendingUp, FileText, Phone, Zap, RefreshCw, Stethoscope
} from 'lucide-react';
import { getCitasByFecha } from '../services/citas.service';
import { getGestoriaStats } from '../services/facturacion.service';
import { Cita } from '../types';

interface DashboardProps {
    activeSubArea: string;
    onNavigate: (area: string, subArea?: string, numPac?: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const now = new Date();
const HOY = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const HORA_ACTUAL = now.getHours() * 60 + now.getMinutes();

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    confirmada: { label: 'Confirmada', color: 'text-[#051650]', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
    espera: { label: 'En espera', color: 'text-[#051650]', bg: 'bg-[#FEFDE8] border-[#FBFFA3]', dot: 'bg-[#FBFFA3]' },
    gabinete: { label: 'En gabinete', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500 animate-pulse' },
    finalizada: { label: 'Finalizada', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-300' },
    anulada: { label: 'Anulada', color: 'text-[#E03555]', bg: 'bg-[#FFF0F3] border-[#FFC0CB]', dot: 'bg-[#FF6E87]' },
    cancelada: { label: 'Cancelada', color: 'text-[#E03555]', bg: 'bg-[#FFF0F3] border-[#FFC0CB]', dot: 'bg-[#FF6E87]' },
    planificada: { label: 'Planificada', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400' },
};

const estadoConf = (estado: string) =>
    ESTADO_CONFIG[estado] ?? { label: estado, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-300' };

const citaEnCurso = (c: Cita) => {
    const [h, m] = c.horaInicio.split(':').map(Number);
    const inicio = h * 60 + m;
    const fin = inicio + (c.duracionMinutos ?? 30);
    return HORA_ACTUAL >= inicio && HORA_ACTUAL < fin;
};


// ══════════════════════════════════════════════════════════════════════════════
// VISTA: HOY EN CLÍNICA
// ══════════════════════════════════════════════════════════════════════════════
const HoyEnClinica: React.FC<{ onNavigate: DashboardProps['onNavigate'] }> = ({ onNavigate }) => {
    const [citas, setCitas] = useState<Cita[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const data = await getCitasByFecha(hoy);
            setCitas([...data].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
            setLastRefresh(new Date());
        } catch (e) {
            setError('Error al cargar citas. Comprueba la conexión.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const total = citas.length;
    const finalizadas = citas.filter(c => c.estado === 'finalizada').length;
    const enCurso = citas.filter(c => citaEnCurso(c)).length;
    const pendientes = citas.filter(c => ['confirmada', 'espera', 'planificada'].includes(c.estado)).length;
    const canceladas = citas.filter(c => ['anulada', 'cancelada'].includes(c.estado)).length;

    const proxima = citas.find(c => {
        const [h, m] = c.horaInicio.split(':').map(Number);
        return h * 60 + m > HORA_ACTUAL && !['finalizada', 'anulada', 'cancelada'].includes(c.estado);
    });

    return (
        <div className="space-y-5">

            {/* ── Cabecera ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em]">Cuadro de mando operativo</p>
                    <h1 className="text-[18px] font-bold text-[#051650] capitalize">{HOY}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-400 font-medium">
                        Actualizado {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                        onClick={load}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-[#051650] hover:text-white text-slate-500 transition-all"
                        title="Actualizar"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* ── KPIs del día ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Total citas', value: loading ? '…' : String(total), icon: Calendar, color: 'bg-[#051650]', sub: 'programadas hoy' },
                    { label: 'En curso', value: loading ? '…' : String(enCurso), icon: Activity, color: 'bg-blue-500', sub: 'en gabinete ahora' },
                    { label: 'Finalizadas', value: loading ? '…' : String(finalizadas), icon: CheckCircle2, color: 'bg-blue-500', sub: `de ${total}` },
                    { label: 'Canceladas', value: loading ? '…' : String(canceladas), icon: Ban, color: canceladas > 0 ? 'bg-red-500' : 'bg-slate-300', sub: 'anuladas hoy' },
                ].map(kpi => (
                    <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
                        <div className={`w-10 h-10 rounded-xl ${kpi.color} flex items-center justify-center flex-shrink-0`}>
                            <kpi.icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[22px] font-bold text-[#051650] leading-none">{kpi.value}</p>
                            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide truncate">{kpi.label}</p>
                            <p className="text-[12px] text-slate-400 truncate">{kpi.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Próxima cita + Accesos rápidos ───────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Próxima cita — clic en la tarjeta abre la ficha del paciente */}
                <div
                    className="lg:col-span-2 bg-gradient-to-br from-[#051650] to-[#0c2a80] rounded-2xl p-5 text-white shadow-lg cursor-pointer hover:brightness-110 transition-all"
                    onClick={async () => {
                        if (!proxima) return;
                        let numPac = proxima.pacienteNumPac;
                        // Si pacienteNumPac llega vacío del FDW, buscar por nombre
                        if (!numPac) {
                            try {
                                const { searchPacientes } = await import('../services/pacientes.service');
                                const encontrados = await searchPacientes(proxima.nombrePaciente);
                                numPac = encontrados[0]?.numPac ?? '';
                            } catch { numPac = ''; }
                        }
                        onNavigate('Pacientes', 'Historia Clínica', numPac || undefined);
                    }}
                    title={proxima ? `Ver ficha de ${proxima.nombrePaciente}` : ''}
                >
                    <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/70 mb-3">⏰ Próxima · clic para ver ficha</p>
                    {loading ? (
                        <p className="text-white/70 text-sm">Cargando...</p>
                    ) : proxima ? (
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-[13px] font-bold text-white text-center leading-tight">
                                    {proxima.horaInicio}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[16px] font-bold text-white truncate">{proxima.nombrePaciente}</p>
                                <p className="text-[13px] text-white/80 font-medium truncate">{proxima.tratamiento}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[12px] font-bold text-white/70 uppercase">{proxima.doctor}</span>
                                    {proxima.gabinete && (
                                        <>
                                            <span className="text-white/70">·</span>
                                            <span className="text-[12px] font-bold text-white/70 uppercase">Gab. {proxima.gabinete}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
                        </div>
                    ) : (
                        <p className="text-white/70 text-sm font-medium">Sin más citas pendientes hoy.</p>
                    )}
                </div>

                {/* Accesos rápidos */}
                <div className="flex flex-col gap-2">
                    {[
                        { label: 'Abrir Agenda', icon: Calendar, area: 'Agenda', sub: 'Agenda' },
                        { label: 'WhatsApp', icon: MessageSquare, area: 'Whatsapp', sub: 'Conversaciones' },
                        { label: 'Nuevo Paciente', icon: Users, area: 'Pacientes', sub: 'ACTION_NEW' },
                    ].map(acc => (
                        <button
                            key={acc.label}
                            onClick={() => onNavigate(acc.area, acc.sub)}
                            className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 hover:border-[#051650] hover:bg-[#051650]/5 transition-all group shadow-sm text-left"
                        >
                            <acc.icon className="w-4 h-4 text-[#051650] flex-shrink-0" />
                            <span className="text-[12px] font-bold text-[#051650] uppercase tracking-wide">{acc.label}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#051650] ml-auto transition-colors" />
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Lista de citas del día ────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-[#051650]" />
                        <span className="text-[13px] font-bold text-[#051650] uppercase tracking-widest">Agenda del día</span>
                    </div>
                    <button
                        onClick={() => onNavigate('Agenda', 'Agenda')}
                        className="text-[12px] font-bold text-[#051650] hover:underline flex items-center gap-1"
                    >
                        Ver Agenda completa <ChevronRight className="w-3 h-3" />
                    </button>
                </div>

                {loading ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">Cargando citas...</div>
                ) : error ? (
                    <div className="px-5 py-8 text-center">
                        <AlertTriangle className="w-5 h-5 text-[#051650] mx-auto mb-2" />
                        <p className="text-[12px] text-slate-500">{error}</p>
                    </div>
                ) : citas.length === 0 ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">Sin citas registradas hoy.</div>
                ) : (
                    <div className="divide-y divide-slate-50 max-h-[380px] overflow-y-auto">
                        {citas.map(c => {
                            const conf = estadoConf(c.estado);
                            const actual = citaEnCurso(c);
                            return (
                                <div
                                    key={c.id}
                                    className={`flex items-center gap-4 px-5 py-3 transition-all ${actual ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                                >
                                    {/* Hora */}
                                    <span className="text-[13px] font-bold text-[#051650] w-12 shrink-0 tabular-nums">
                                        {c.horaInicio}
                                    </span>
                                    {/* Indicador estado */}
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${conf.dot}`} />
                                    {/* Paciente */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[12px] font-bold truncate ${actual ? 'text-blue-700' : 'text-slate-800'}`}>
                                            {c.nombrePaciente}
                                            {actual && <span className="ml-2 text-[12px] font-bold text-blue-500 uppercase tracking-wider">● En curso</span>}
                                        </p>
                                        <p className="text-[12px] text-slate-400 truncate font-medium">{c.tratamiento}</p>
                                    </div>
                                    {/* Doctor */}
                                    <span className="text-[12px] text-slate-400 font-medium truncate hidden md:block w-32">{c.doctor}</span>
                                    {/* Estado chip */}
                                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${conf.color} ${conf.bg}`}>
                                        {conf.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

        </div>
    );
};


// ══════════════════════════════════════════════════════════════════════════════
// VISTA: RENDIMIENTO
// ══════════════════════════════════════════════════════════════════════════════
const Rendimiento: React.FC<{ onNavigate: DashboardProps['onNavigate'] }> = ({ onNavigate }) => {
    const [stats, setStats] = useState<{
        ingresosBrutos: string; facturasConteo: number; ticketMedio: string;
    } | null>(null);
    const [citasSemana, setCitasSemana] = useState<number[]>([]);
    const [cancelSemana, setCancelSemana] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const s = await getGestoriaStats();
                setStats(s);

                // Citas de los últimos 7 días
                const counts: number[] = [];
                const cancels: number[] = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    d.setHours(0, 0, 0, 0);
                    try {
                        const dayCitas = await getCitasByFecha(d);
                        counts.push(dayCitas.length);
                        cancels.push(dayCitas.filter(c => ['anulada', 'cancelada'].includes(c.estado)).length);
                    } catch { counts.push(0); cancels.push(0); }
                }
                setCitasSemana(counts);
                setCancelSemana(cancels);
            } catch (e) {
                console.error('[Rendimiento] Error:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const totalCitasSemana = citasSemana.reduce((a, b) => a + b, 0);
    const totalCancelSemana = cancelSemana.reduce((a, b) => a + b, 0);
    const tasaCancelacion = totalCitasSemana > 0
        ? Math.round((totalCancelSemana / totalCitasSemana) * 100)
        : 0;
    const maxCitas = Math.max(...citasSemana, 1);
    const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    return (
        <div className="space-y-5">

            <div>
                <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em]">Métricas · Últimos 7 días</p>
                <h1 className="text-[18px] font-bold text-[#051650]">Rendimiento de la Clínica</h1>
            </div>

            {/* KPIs Financieros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    {
                        label: 'Facturación Total',
                        value: loading ? '…' : stats?.ingresosBrutos ?? '—',
                        sub: loading ? '' : `${stats?.facturasConteo ?? 0} facturas`,
                        icon: Euro, color: 'bg-blue-500', action: () => onNavigate('Gestoría', 'Facturación')
                    },
                    {
                        label: 'Citas esta semana',
                        value: loading ? '…' : String(totalCitasSemana),
                        sub: `${totalCancels()} canceladas`,
                        icon: Calendar, color: 'bg-[#051650]', action: () => onNavigate('Agenda', 'Agenda')
                    },
                    {
                        label: 'Tasa cancelación',
                        value: loading ? '…' : `${tasaCancelacion}%`,
                        sub: tasaCancelacion > 15 ? '⚠️ Por encima del umbral' : '✓ En rango normal',
                        icon: TrendingUp, color: tasaCancelacion > 15 ? 'bg-red-500' : 'bg-[#FBFFA3]', action: undefined
                    },
                ].map(kpi => (
                    <div
                        key={kpi.label}
                        onClick={kpi.action}
                        className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4 ${kpi.action ? 'cursor-pointer hover:border-[#051650]/30 hover:shadow-md transition-all' : ''}`}
                    >
                        <div className={`w-12 h-12 rounded-xl ${kpi.color} flex items-center justify-center flex-shrink-0`}>
                            <kpi.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[24px] font-bold text-[#051650] leading-none">{kpi.value}</p>
                            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{kpi.label}</p>
                            <p className="text-[12px] text-slate-400 mt-0.5">{kpi.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Gráfico barras — citas por día */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#051650]" />
                        <span className="text-[13px] font-bold text-[#051650] uppercase tracking-widest">Citas últimos 7 días</span>
                    </div>
                    {!loading && (
                        <span className="text-[12px] text-slate-400 font-medium">Media: {(totalCitasSemana / 7).toFixed(1)}/día</span>
                    )}
                </div>
                {loading ? (
                    <div className="h-32 flex items-center justify-center text-slate-400 text-sm">Cargando datos...</div>
                ) : (
                    <div className="flex items-end gap-2 h-32">
                        {citasSemana.map((cnt, i) => {
                            const hoy = i === 6;
                            const pct = Math.round((cnt / maxCitas) * 100);
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[12px] font-bold text-slate-400 tabular-nums">{cnt}</span>
                                    <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                                        <div
                                            className={`w-full rounded-t-lg transition-all ${hoy ? 'bg-[#051650]' : 'bg-[#051650]/20'}`}
                                            style={{ height: `${Math.max(pct, 4)}%` }}
                                        />
                                    </div>
                                    <span className={`text-[12px] font-bold uppercase ${hoy ? 'text-[#051650]' : 'text-slate-400'}`}>
                                        {dias[(new Date().getDay() - 6 + i + 7) % 7]}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Accesos rápidos a informes */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Ver Facturación', icon: FileText, area: 'Gestoría', sub: 'Facturación' },
                    { label: 'Banco y Conciliación', icon: TrendingUp, area: 'Gestoría', sub: 'Banco y Conciliación' },
                    { label: 'Pacientes en WhatsApp', icon: MessageSquare, area: 'Whatsapp', sub: 'Conversaciones' },
                    { label: 'IA & Automatización', icon: Zap, area: 'IA & Automatización', sub: 'Panel IA' },
                ].map(acc => (
                    <button
                        key={acc.label}
                        onClick={() => onNavigate(acc.area, acc.sub)}
                        className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 hover:border-[#051650] hover:bg-[#051650]/5 transition-all group shadow-sm text-left"
                    >
                        <acc.icon className="w-4 h-4 text-[#051650] flex-shrink-0" />
                        <span className="text-[13px] font-bold text-[#051650] uppercase tracking-wide">{acc.label}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#051650] ml-auto" />
                    </button>
                ))}
            </div>
        </div>
    );

    function totalCancels() { return cancelSemana.reduce((a, b) => a + b, 0); }
};


// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
import Pruebas from './Pruebas';

const Dashboard: React.FC<DashboardProps> = ({ activeSubArea, onNavigate }) => {
    if (activeSubArea === 'Pruebas') return <Pruebas />;
    if (activeSubArea === 'Rendimiento') return <Rendimiento onNavigate={onNavigate} />;
    return <HoyEnClinica onNavigate={onNavigate} />;
};

export default Dashboard;
