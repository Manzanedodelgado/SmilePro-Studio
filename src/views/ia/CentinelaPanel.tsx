/**
 * views/ia/CentinelaPanel.tsx — Panel de monitorización de errores Centinela
 *
 * Muestra errores capturados por el motor Centinela en tiempo real.
 * Incluye filtros por módulo/severidad, estadísticas uptime, y simulador.
 */

import React, { useState, useEffect, useCallback } from 'react';
import centinela from '../../centinela/engine';
import { simulateBurst, simulateCritical } from '../../centinela/simulator';

import type { CentinelaError, CentinelaModule, Severity } from '../../centinela/types';

// ── Helpers UI ────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<Severity, { bg: string; border: string; text: string; dot: string }> = {
    critical: { bg: 'bg-[#FFF0F3]', border: 'border-[#FFC0CB]', text: 'text-[#C02040]', dot: '#E03555' },
    error:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',   dot: '#ef4444' },
    warning:  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: '#f97316' },
    info:     { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: '#60a5fa' },
};

const MODULE_ICONS: Record<string, string> = {
    Agenda: '📅', Pacientes: '👤', SOAPEditor: '📝', Odontograma: '🦷',
    Whatsapp: '💬', IA: '🤖', Inventario: '📦', Gestoría: '📊',
    Radiología: '🩻', Auth: '🔐', Backend: '⚙️', Unknown: '❓',
};

// ── Componentes auxiliares ─────────────────────────────────────────

const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => {
    const c = SEVERITY_COLORS[severity];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase ${c.bg} ${c.text}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
            {severity}
        </span>
    );
};

const StatCard: React.FC<{ label: string; value: number; color: string; icon: string }> = ({ label, value, color, icon }) => (
    <div className={`rounded-xl border ${color} px-4 py-3 flex items-center gap-3`}>
        <span className="text-2xl">{icon}</span>
        <div>
            <p className="text-2xl font-black leading-none">{value}</p>
            <p className="text-[11px] font-bold uppercase text-slate-500 mt-0.5">{label}</p>
        </div>
    </div>
);

// ── Panel principal ────────────────────────────────────────────────

const CentinelaPanel: React.FC = () => {
    const [errors, setErrors]       = useState<CentinelaError[]>([]);
    const [filterSev, setFilterSev] = useState<Severity | 'all'>('all');
    const [filterMod, setFilterMod] = useState<CentinelaModule | 'all'>('all');
    const [showResolved, setShowResolved] = useState(false);
    const [detailId, setDetailId]   = useState<string | null>(null);
    const [simLoading, setSimLoading] = useState(false);
    const [tick, setTick] = useState(0);

    // Polling cada 3s para refrescar errores
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setErrors(centinela.getErrors(showResolved));
    }, [tick, showResolved]);

    const refresh = useCallback(() => setTick(t => t + 1), []);

    const filtered = errors
        .filter(e => filterSev === 'all' || e.severity === filterSev)
        .filter(e => filterMod === 'all' || e.module === filterMod);

    const critCount   = errors.filter(e => e.severity === 'critical').length;
    const errorCount  = errors.filter(e => e.severity === 'error').length;
    const warnCount   = errors.filter(e => e.severity === 'warning').length;
    const totalActive = errors.filter(e => !e.resolved).length;
    const uptime      = centinela.getUptime();

    const detailErr = detailId ? errors.find(e => e.id === detailId) : null;
    void detailErr; // anotamos para futura expansión del detail panel


    const handleResolve = (id: string) => {
        centinela.resolve(id);
        setDetailId(null);
        refresh();
    };

    const handleResolveAll = () => { centinela.resolveAll(); refresh(); };
    const handleClear = () => { centinela.clear(); refresh(); };

    const handleSimulate = async () => {
        setSimLoading(true);
        await simulateBurst(5, 250);
        setSimLoading(false);
        refresh();
    };

    const modules = ['all', ...Array.from(new Set(errors.map(e => e.module)))] as (CentinelaModule | 'all')[];

    return (
        <div className="space-y-5 animate-fade-in">

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black text-[#051650] dark:text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#E03555] animate-pulse" />
                        Centinela Monitor
                    </h2>
                    <p className="text-[12px] text-slate-400 mt-0.5">Error tracking en tiempo real · {errors.length} eventos capturados</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={refresh}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex items-center gap-1">
                        <span className="material-icons text-[14px]">refresh</span> Refresh
                    </button>
                    <button onClick={handleSimulate} disabled={simLoading}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-[#051650] hover:bg-[#0c2a80] text-white transition-colors disabled:opacity-50">
                        {simLoading ? '⏳ Simulando...' : '⚡ Simular errores'}
                    </button>
                    <button onClick={() => { simulateCritical(); refresh(); }}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-[#FFF0F3] border border-[#FFC0CB] hover:bg-[#FFE0E6] text-[#C02040] transition-colors">
                        🔴 Critical
                    </button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total activos" value={totalActive} color="border-slate-200" icon="📊" />
                <StatCard label="Críticos"      value={critCount}   color="border-[#FFC0CB] bg-[#FFF0F3]" icon="🔴" />
                <StatCard label="Errores"        value={errorCount}  color="border-red-200 bg-red-50" icon="⛔" />
                <StatCard label="Warnings"       value={warnCount}   color="border-orange-200 bg-orange-50" icon="⚠️" />
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[12px] font-bold text-slate-400 uppercase">Severidad:</span>
                {(['all', 'critical', 'error', 'warning', 'info'] as const).map(s => (
                    <button key={s} onClick={() => setFilterSev(s)}
                        className={`px-3 py-1 rounded text-[12px] font-bold transition-colors ${filterSev === s ? 'bg-[#051650] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {s === 'all' ? 'Todos' : s.toUpperCase()}
                    </button>
                ))}
                <span className="ml-3 text-[12px] font-bold text-slate-400 uppercase">Módulo:</span>
                <select value={filterMod} onChange={e => setFilterMod(e.target.value as any)}
                    className="px-2 py-1 rounded text-[12px] font-bold border border-slate-200 bg-white text-slate-700">
                    {modules.map(m => (
                        <option key={m} value={m}>{m === 'all' ? 'Todos' : `${MODULE_ICONS[m] || '❓'} ${m}`}</option>
                    ))}
                </select>
                <label className="ml-2 flex items-center gap-1.5 text-[12px] font-bold text-slate-500 cursor-pointer">
                    <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} className="w-3.5 h-3.5" />
                    Mostrar resueltos
                </label>
                {totalActive > 0 && (
                    <div className="ml-auto flex gap-2">
                        <button onClick={handleResolveAll}
                            className="px-3 py-1 rounded text-[12px] font-bold bg-green-50 border border-green-200 text-green-700 hover:bg-green-100">
                            ✅ Resolver todos
                        </button>
                        <button onClick={handleClear}
                            className="px-3 py-1 rounded text-[12px] font-bold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100">
                            🗑️ Limpiar
                        </button>
                    </div>
                )}
            </div>

            {/* Lista de errores */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <span className="text-5xl">✅</span>
                    <p className="text-sm font-bold">No hay errores activos</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(err => {
                        const c = SEVERITY_COLORS[err.severity];
                        const isDetail = detailId === err.id;
                        return (
                            <div key={err.id}
                                className={`rounded-xl border p-3 transition-all cursor-pointer hover:shadow-sm ${c.bg} ${c.border} ${err.resolved ? 'opacity-40' : ''}`}
                                onClick={() => setDetailId(isDetail ? null : err.id)}>
                                <div className="flex items-start gap-3">
                                    <span className="text-xl flex-shrink-0 mt-0.5">{MODULE_ICONS[err.module] || '❓'}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <SeverityBadge severity={err.severity} />
                                            <span className="text-[12px] font-bold text-slate-600 bg-white/70 px-2 py-0.5 rounded">
                                                {err.module}
                                            </span>
                                            {err.count > 1 && (
                                                <span className="text-[12px] font-bold bg-white/70 text-slate-700 px-2 py-0.5 rounded">
                                                    ×{err.count}
                                                </span>
                                            )}
                                            {err.resolved && (
                                                <span className="text-[12px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded">✅ resuelto</span>
                                            )}
                                        </div>
                                        <p className="text-[13px] font-bold text-slate-800 truncate">{err.message}</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            Último: {new Date(err.lastSeen).toLocaleString('es-ES')}
                                            · ID: {err.fingerprint}
                                        </p>
                                    </div>
                                    {!err.resolved && (
                                        <button onClick={e => { e.stopPropagation(); handleResolve(err.id); }}
                                            className="flex-shrink-0 px-2 py-1 rounded text-[11px] font-bold bg-white/70 hover:bg-white text-slate-600 border border-white/50">
                                            ✅
                                        </button>
                                    )}
                                </div>
                                {isDetail && (
                                    <div className="mt-3 pt-3 border-t border-white/50 space-y-1.5">
                                        <p className="text-[12px] text-slate-500"><strong>Primera vez:</strong> {new Date(err.firstSeen).toLocaleString('es-ES')}</p>
                                        {err.url && <p className="text-[12px] text-slate-500 truncate"><strong>URL:</strong> {err.url}</p>}
                                        {err.stack && (
                                            <pre className="text-[11px] bg-white/50 rounded p-2 text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto">
                                                {err.stack.slice(0, 600)}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Uptime por módulo */}
            {uptime.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <h3 className="text-[12px] font-bold uppercase text-slate-400 tracking-widest mb-3">Uptime por Módulo</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {uptime.map(u => {
                            const pct = u.checks > 0 ? ((u.checks - u.failures) / u.checks * 100).toFixed(1) : '100.0';
                            const color = parseFloat(pct) >= 99 ? 'text-green-600' : parseFloat(pct) >= 95 ? 'text-orange-600' : 'text-red-600';
                            return (
                                <div key={u.module} className="text-center p-2 rounded-lg border border-slate-100">
                                    <p className="text-lg">{MODULE_ICONS[u.module] || '❓'}</p>
                                    <p className={`text-[13px] font-black ${color}`}>{pct}%</p>
                                    <p className="text-[11px] text-slate-400">{u.module}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CentinelaPanel;
