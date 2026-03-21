// ─── Métricas de Comunicación — Dashboard clínico ────────────────────────────
import React, { useState, useEffect } from 'react';
import {
    MessageSquare, CheckCircle2, XCircle, TrendingUp,
    Users, Zap, RefreshCw, AlertCircle, BarChart2,
    Clock, ThumbsUp,
} from 'lucide-react';
import { authFetch } from '../../services/db';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

interface ClinicMetrics {
    automations: {
        total: number;
        active: number;
        executions: number;
        avgSuccessRate: number;
    };
    reminders: {
        sent: number;
        confirmed: number;
        confirmationRate: number;
    };
    patientReliability: {
        excellent: number;
        good: number;
        average: number;
        low: number;
        unknown: number;
        total: number;
    };
    conversations: {
        total: number;
        resolved: number;
        open: number;
    };
}

async function fetchMetrics(): Promise<ClinicMetrics> {
    const r = await authFetch(`${API_BASE}/api/communication/metrics`);
    if (!r.ok) throw new Error('Error cargando métricas');
    return r.json();
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    color?: string;
    bg?: string;
}

const KpiCard: React.FC<KpiProps> = ({ icon, label, value, sub, color = 'text-[#051650]', bg = 'bg-white' }) => (
    <div className={`${bg} rounded-2xl border border-slate-100 p-4 flex items-start gap-3 shadow-sm`}>
        <div className={`p-2.5 rounded-xl bg-slate-50 ${color}`}>{icon}</div>
        <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate">{label}</p>
            <p className={`text-[24px] font-black leading-none mt-0.5 ${color}`}>{value}</p>
            {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// ─── Bar ──────────────────────────────────────────────────────────────────────

const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
);

// ─── Reliability Row ──────────────────────────────────────────────────────────

const ReliabilityRow: React.FC<{ label: string; count: number; total: number; color: string; bar: string }> = ({ label, count, total, color, bar }) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
                <span className={`font-bold ${color}`}>{label}</span>
                <span className="text-slate-500">{count} pac. <span className="text-slate-300">({pct}%)</span></span>
            </div>
            <Bar pct={pct} color={bar} />
        </div>
    );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const MetricasComunicacion: React.FC = () => {
    const [metrics, setMetrics] = useState<ClinicMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            setMetrics(await fetchMetrics());
            setLastRefresh(new Date());
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-[13px] font-bold">Cargando métricas...</span>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center h-48 gap-3 text-[#E03555]">
            <AlertCircle className="w-5 h-5" />
            <span className="text-[13px] font-bold">{error}</span>
        </div>
    );

    if (!metrics) return null;

    const { automations, reminders, patientReliability, conversations } = metrics;
    const confirmPct = reminders.confirmationRate ?? 0;
    const successPct = automations.avgSuccessRate ?? 0;

    return (
        <div className="space-y-6 pb-8 animate-in fade-in duration-300">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[16px] font-black text-[#051650]">Métricas de Comunicación</h2>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                        Actualizado {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <button onClick={load}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-bold text-slate-600 hover:bg-slate-100 transition-all">
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                </button>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard
                    icon={<Zap className="w-4 h-4" />}
                    label="Automatizaciones"
                    value={automations.active}
                    sub={`${automations.total} total`}
                    color="text-[#051650]"
                />
                <KpiCard
                    icon={<BarChart2 className="w-4 h-4" />}
                    label="Ejecuciones"
                    value={automations.executions}
                    sub="acumuladas"
                    color="text-blue-600"
                />
                <KpiCard
                    icon={<MessageSquare className="w-4 h-4" />}
                    label="Recordatorios"
                    value={reminders.sent}
                    sub="enviados"
                    color="text-violet-600"
                />
                <KpiCard
                    icon={<ThumbsUp className="w-4 h-4" />}
                    label="Confirmaciones"
                    value={`${confirmPct}%`}
                    sub={`${reminders.confirmed} pac. confirmaron`}
                    color={confirmPct >= 70 ? 'text-teal-600' : confirmPct >= 40 ? 'text-amber-600' : 'text-[#E03555]'}
                />
            </div>

            {/* Tasa de éxito recordatorios + automatizaciones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Recordatorios */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-violet-500" />
                        <p className="text-[13px] font-black text-[#051650] uppercase tracking-wider">Recordatorios</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[12px]">
                            <span className="text-slate-500">Tasa de confirmación</span>
                            <span className="font-bold text-[#051650]">{confirmPct}%</span>
                        </div>
                        <Bar pct={confirmPct}
                            color={confirmPct >= 70 ? 'bg-teal-400' : confirmPct >= 40 ? 'bg-amber-400' : 'bg-[#E03555]'} />
                        <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-teal-500" /> {reminders.confirmed} confirmados</span>
                            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-slate-300" /> {reminders.sent - reminders.confirmed} sin respuesta</span>
                        </div>
                    </div>
                </div>

                {/* Automatizaciones */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <p className="text-[13px] font-black text-[#051650] uppercase tracking-wider">Automatizaciones</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[12px]">
                            <span className="text-slate-500">Tasa de éxito media</span>
                            <span className="font-bold text-[#051650]">{successPct}%</span>
                        </div>
                        <Bar pct={successPct}
                            color={successPct >= 70 ? 'bg-blue-400' : successPct >= 40 ? 'bg-amber-400' : 'bg-[#E03555]'} />
                        <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                            <span>{automations.active} activas de {automations.total}</span>
                            <span>{automations.executions} ejecuciones</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Conversaciones */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-4 h-4 text-[#0056b3]" />
                    <p className="text-[13px] font-black text-[#051650] uppercase tracking-wider">Conversaciones WhatsApp</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-50 rounded-xl py-3">
                        <p className="text-[22px] font-black text-[#051650]">{conversations.total}</p>
                        <p className="text-[11px] text-slate-400 font-bold uppercase">Total</p>
                    </div>
                    <div className="bg-teal-50 rounded-xl py-3">
                        <p className="text-[22px] font-black text-teal-600">{conversations.resolved}</p>
                        <p className="text-[11px] text-slate-400 font-bold uppercase">Resueltas</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl py-3">
                        <p className="text-[22px] font-black text-amber-600">{conversations.open}</p>
                        <p className="text-[11px] text-slate-400 font-bold uppercase">Abiertas</p>
                    </div>
                </div>
            </div>

            {/* Fiabilidad de pacientes */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#0056b3]" />
                        <p className="text-[13px] font-black text-[#051650] uppercase tracking-wider">Fiabilidad de Pacientes</p>
                    </div>
                    <span className="text-[11px] text-slate-400">{patientReliability.total} perfiles</span>
                </div>
                <div className="space-y-3">
                    <ReliabilityRow label="Excelente" count={patientReliability.excellent} total={patientReliability.total} color="text-teal-600" bar="bg-teal-400" />
                    <ReliabilityRow label="Buena" count={patientReliability.good} total={patientReliability.total} color="text-blue-600" bar="bg-blue-400" />
                    <ReliabilityRow label="Media" count={patientReliability.average} total={patientReliability.total} color="text-amber-600" bar="bg-amber-400" />
                    <ReliabilityRow label="Baja" count={patientReliability.low} total={patientReliability.total} color="text-[#E03555]" bar="bg-[#E03555]" />
                    <ReliabilityRow label="Sin datos" count={patientReliability.unknown} total={patientReliability.total} color="text-slate-400" bar="bg-slate-200" />
                </div>
                {patientReliability.total === 0 && (
                    <p className="text-[12px] text-slate-400 text-center py-2">
                        Los patrones se generan a medida que se envíen recordatorios.
                    </p>
                )}
            </div>

        </div>
    );
};

export default MetricasComunicacion;
