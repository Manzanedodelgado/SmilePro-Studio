import React, { useState, useEffect } from 'react';
import {
    Bot, Zap, GitBranch, FileText, MessageSquare, Sparkles,
    CheckCircle2, AlertCircle, Activity, TrendingUp, Clock, Shield,
    BarChart2, Gauge
} from 'lucide-react';
import { isAIConfigured } from '../../services/ia-dental.service';
import { getAutomations } from '../../services/automations.service';
import type { Automation } from './AutomationRules';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

interface AIMetrics {
    totalMessages24h: number;
    totalTokens24h: number;
    avgLatencyMs: number;
    successRate: number;
    fallbackRate: number;
    activeAutomations: number;
    automationExecutions24h: number;
}

interface QuickCard {
    label: string;
    sub: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    area: string;
}

const QUICK: QuickCard[] = [
    { label: 'IA Dental ✶', sub: 'Configurar agente y simulador', icon: Bot, color: 'text-[#0056b3]', bg: 'bg-blue-50 border-blue-200', area: 'IA Dental ✶' },
    { label: 'Automatizaciones', sub: 'Gestionar reglas activas', icon: Zap, color: 'text-[#051650]', bg: 'bg-[#FEFDE8] border-[#FBFFA3]', area: 'Automatizaciones' },
    { label: 'Flujos', sub: 'Secuencias conversacionales', icon: GitBranch, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', area: 'Flujos Conversacionales' },
    { label: 'Plantillas', sub: 'WhatsApp, Email, SMS', icon: MessageSquare, color: 'text-[#051650]', bg: 'bg-blue-50 border-teal-200', area: 'Plantillas' },
    { label: 'Documentos', sub: 'Consentimientos, cuestionarios', icon: FileText, color: 'text-[#E03555]', bg: 'bg-[#FFF0F3] border-[#FFC0CB]', area: 'Documentos Clínicos' },
];

interface IADashboardProps {
    onNavigate: (area: string) => void;
}

export const IADashboard: React.FC<IADashboardProps> = ({ onNavigate }) => {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiActive, setAiActive] = useState<boolean | null>(null);
    const [metrics, setMetrics] = useState<AIMetrics | null>(null);

    useEffect(() => {
        isAIConfigured().then(ok => {
            setAiActive(ok);
            if (ok) {
                fetch(`${API_BASE}/api/ai/metrics`)
                    .then(r => r.ok ? r.json() : null)
                    .then(json => json?.data && setMetrics(json.data))
                    .catch(() => { });
            }
        });
        getAutomations().then(data => {
            setAutomations(data);
            setLoading(false);
        });
    }, []);

    const activeCount = automations.filter(a => a.active).length;
    const totalCount = automations.length;
    const topAutomation = automations
        .filter(a => a.active && a.executions > 0)
        .sort((a, b) => b.executions - a.executions)[0];

    const kpis = [
        {
            label: 'Motor IA',
            value: aiActive === null ? 'Verificando...' : aiActive ? 'Groq LLaMA 3.3' : 'Fallback',
            sub: aiActive === null ? '—' : aiActive ? 'Conectado · streaming SSE' : 'Sin conexión al backend',
            icon: Bot,
            ok: aiActive === true,
            color: aiActive === true ? 'text-[#051650]' : 'text-amber-600',
            bg: aiActive === true ? 'bg-blue-50 border-blue-200' : 'bg-[#FEFDE8] border-[#FBFFA3]',
        },
        {
            label: 'Automatizaciones',
            value: loading ? '—' : `${activeCount}/${totalCount}`,
            sub: loading ? 'Cargando...' : `${totalCount - activeCount} pausadas`,
            icon: Zap,
            ok: activeCount > 0,
            color: 'text-[#0056b3]',
            bg: 'bg-blue-50 border-blue-200',
        },
        {
            label: 'Tasa de éxito',
            value: metrics ? `${metrics.successRate}%` : loading || !topAutomation ? '—' : `${topAutomation.successRate}%`,
            sub: metrics ? `Fallback: ${metrics.fallbackRate}% · 24h` : topAutomation ? `Mejor: ${topAutomation.name.slice(0, 20)}…` : 'Sin datos aún',
            icon: TrendingUp,
            ok: true,
            color: 'text-[#051650]',
            bg: 'bg-blue-50 border-blue-200',
        },
        {
            label: 'Privacidad',
            value: 'RGPD ✓',
            sub: 'Datos encriptados en tránsito',
            icon: Shield,
            ok: true,
            color: 'text-slate-600',
            bg: 'bg-slate-50 border-slate-200',
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Header bienvenida */}
            <div className="bg-gradient-to-br from-[#051650] to-[#0056b3] rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 60%)'
                }} />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-[16px] font-bold uppercase tracking-wide">Cerebro Digital · IA Dental</h2>
                        <p className="text-[13px] text-white/80 mt-0.5">
                            Motor de automatización clínica · LLaMA 3.3 70B vía Groq · Streaming SSE
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${aiActive === true ? 'bg-[#118DF0] animate-pulse' : aiActive === false ? 'bg-[#FBFFA3]' : 'bg-white/30'}`} />
                        <span className="text-[12px] font-bold text-white/70 uppercase tracking-wider">
                            {aiActive === true ? 'IA Activa' : aiActive === false ? 'Fallback' : '...'}
                        </span>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {kpis.map(k => {
                    const Icon = k.icon;
                    return (
                        <div key={k.label} className={`bg-white rounded-2xl border ${k.bg} p-4 space-y-2`}>
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">{k.label}</span>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${k.bg}`}>
                                    <Icon className={`w-3.5 h-3.5 ${k.color}`} />
                                </div>
                            </div>
                            <p className={`text-[20px] font-bold leading-none ${k.color}`}>{k.value}</p>
                            <p className="text-[12px] text-slate-400">{k.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* Métricas de uso en tiempo real */}
            {(metrics || aiActive === true) && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <BarChart2 className="w-3.5 h-3.5" />Métricas · Últimas 24h
                    </p>
                    {metrics ? (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {[
                                    { label: 'Mensajes', value: metrics.totalMessages24h.toString(), icon: MessageSquare, color: 'text-[#0056b3]' },
                                    { label: 'Tokens', value: metrics.totalTokens24h > 999 ? `${(metrics.totalTokens24h / 1000).toFixed(1)}k` : metrics.totalTokens24h.toString(), icon: Zap, color: 'text-purple-600' },
                                    { label: 'Latencia media', value: metrics.avgLatencyMs > 0 ? `${metrics.avgLatencyMs}ms` : '—', icon: Gauge, color: metrics.avgLatencyMs < 800 ? 'text-emerald-600' : 'text-amber-600' },
                                    { label: 'Ejecuciones auto.', value: metrics.automationExecutions24h.toString(), icon: Activity, color: 'text-[#051650]' },
                                ].map(m => {
                                    const Icon = m.icon;
                                    return (
                                        <div key={m.label} className="text-center">
                                            <div className="flex justify-center mb-1">
                                                <Icon className={`w-4 h-4 ${m.color}`} />
                                            </div>
                                            <p className={`text-[22px] font-bold leading-none ${m.color}`}>{m.value}</p>
                                            <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wide">{m.label}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Barra de éxito/fallback */}
                            <div className="mt-4">
                                <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase mb-1">
                                    <span>Groq directo {metrics.successRate}%</span>
                                    <span>Fallback {metrics.fallbackRate}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#0056b3] rounded-full transition-all duration-700"
                                        style={{ width: `${metrics.successRate}%` }}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {['Mensajes', 'Tokens', 'Latencia media', 'Ejecuciones auto.'].map(label => (
                                <div key={label} className="text-center space-y-2">
                                    <div className="h-4 w-4 bg-slate-100 rounded-full mx-auto animate-pulse" />
                                    <div className="h-6 w-12 bg-slate-100 rounded mx-auto animate-pulse" />
                                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Accesos rápidos */}
            <div>
                <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-3">Accesos rápidos</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {QUICK.map(q => {
                        const Icon = q.icon;
                        return (
                            <button
                                key={q.area}
                                onClick={() => onNavigate(q.area)}
                                className={`flex items-center gap-3 p-4 bg-white rounded-2xl border ${q.bg} hover:shadow-md transition-all cursor-pointer text-left group`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${q.bg} shrink-0 group-hover:scale-105 transition-transform`}>
                                    <Icon className={`w-5 h-5 ${q.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-bold text-[#051650] truncate">{q.label}</p>
                                    <p className="text-[12px] text-slate-400 truncate">{q.sub}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Estado del motor */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />Estado del motor
                </p>
                <div className="space-y-2">
                    {[
                        { label: 'API Groq (LLaMA 3.3)', status: aiActive === true, detail: 'api.groq.com → /api/ai/chat/stream · SSE' },
                        { label: 'Modelo LLaMA 3.3 70B', status: aiActive === true, detail: 'llama-3.3-70b-versatile · max 300 tokens · streaming' },
                        { label: 'Motor de automatizaciones', status: !loading && activeCount > 0, detail: `${activeCount} reglas activas · cron L-S 08-21h Europe/Madrid` },
                        { label: 'Historial de chat', status: true, detail: 'PostgreSQL · ConversationHistory · TTL 24h' },
                        { label: 'Rate limiting', status: true, detail: 'Cliente: 20 msgs/min · Servidor: 100 req/15min' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                            {item.status
                                ? <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                                : <AlertCircle className="w-4 h-4 text-[#051650] shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-[#051650]">{item.label}</p>
                                <p className="text-[12px] text-slate-400 truncate">{item.detail}</p>
                            </div>
                            <span className={`text-[12px] font-bold uppercase px-2 py-0.5 rounded-full border ${item.status ? 'text-[#051650] bg-blue-50 border-blue-200' : 'text-[#051650] bg-[#FEFDE8] border-[#FBFFA3]'}`}>
                                {item.status ? 'OK' : 'Pendiente'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top automatizaciones */}
            {!loading && automations.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />Top automatizaciones
                        </p>
                        <button onClick={() => onNavigate('Automatizaciones')} className="text-[12px] text-[#0056b3] font-bold hover:underline">
                            Ver todas →
                        </button>
                    </div>
                    <div className="space-y-2">
                        {automations
                            .filter(a => a.executions > 0)
                            .sort((a, b) => b.executions - a.executions)
                            .slice(0, 4)
                            .map(a => (
                                <div key={a.id} className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${a.active ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                    <span className="text-[13px] font-bold text-[#051650] flex-1 truncate">{a.name}</span>
                                    <span className="text-[12px] text-slate-400">{a.executions} envíos</span>
                                    <span className="text-[12px] font-bold text-[#0056b3]">{a.successRate}%</span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}
        </div>
    );
};

export default IADashboard;
