// ─── Envío de datos a Gestoría ────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
    Send, Settings2, Clock, CheckCircle2, XCircle,
    RefreshCw, AlertCircle, Mail, Building2, Hash,
    User, Server, Lock, FileText, Banknote,
    Receipt, Scale, ChevronDown, ChevronUp,
} from 'lucide-react';
import { authFetch } from '../../services/db';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GestoriaConfig {
    nombre: string;
    email: string;
    contacto: string;
    nif: string;
    smtp: { host: string; port: number; user: string; pass: string; secure: boolean };
    incluir: {
        facturasEmitidas: boolean;
        facturasRecibidas: boolean;
        movimientosBanco: boolean;
        modelosFiscales: boolean;
    };
    periodoDefecto: 'mes_actual' | 'trimestre_actual' | 'ano_actual';
    asuntoPlantilla: string;
    cuerpoPlantilla: string;
}

interface EnvioRecord {
    id: string;
    fecha: string;
    periodo: string;
    destinatario: string;
    contenido: string[];
    estado: 'ok' | 'error';
    error?: string;
    nFacturas?: number;
    nMovimientos?: number;
}

const PERIOD_LABELS: Record<string, string> = {
    mes_actual: 'Mes actual',
    trimestre_actual: 'Trimestre actual',
    ano_actual: 'Año actual',
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

const Field: React.FC<{
    label: string; icon: React.ReactNode;
    children: React.ReactNode; hint?: string;
}> = ({ label, icon, children, hint }) => (
    <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            {icon}{label}
        </label>
        {children}
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        {...props}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-800 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
    />
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; icon: React.ReactNode }> = ({ checked, onChange, label, icon }) => (
    <label className="flex items-center gap-3 cursor-pointer select-none group">
        <div
            onClick={() => onChange(!checked)}
            className={`relative w-10 h-5.5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
        >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700 group-hover:text-slate-900">
            {icon}{label}
        </span>
    </label>
);

// ── Main component ────────────────────────────────────────────────────────────

export const EnvioGestoria: React.FC = () => {
    const [cfg, setCfg] = useState<GestoriaConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [history, setHistory] = useState<EnvioRecord[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [showSmtp, setShowSmtp] = useState(false);
    const [sendPeriod, setSendPeriod] = useState<string>('mes_actual');

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [cfgRes, histRes] = await Promise.all([
                authFetch(`${API_BASE}/api/accounting/gestoria-config`),
                authFetch(`${API_BASE}/api/accounting/gestoria-history`),
            ]);
            if (cfgRes.ok) {
                const j = await cfgRes.json();
                setCfg(j.data);
                setSendPeriod(j.data.periodoDefecto ?? 'mes_actual');
            }
            if (histRes.ok) {
                const j = await histRes.json();
                setHistory(j.data ?? []);
            }
        } catch {
            setError('Error cargando configuración');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleSaveConfig = async () => {
        if (!cfg) return;
        setSaving(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await authFetch(`${API_BASE}/api/accounting/gestoria-config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cfg),
            });
            if (!res.ok) throw new Error('Error guardando');
            setSuccessMsg('Configuración guardada correctamente');
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error guardando');
        } finally {
            setSaving(false);
        }
    };

    const handleSend = async () => {
        setSending(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await authFetch(`${API_BASE}/api/accounting/gestoria-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ periodo: sendPeriod }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.message ?? 'Error en el envío');
            setSuccessMsg(`✓ Email enviado a ${j.data.destinatario} — ${j.data.periodo}`);
            setHistory(prev => [j.data, ...prev]);
            setTimeout(() => setSuccessMsg(null), 5000);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error en el envío');
        } finally {
            setSending(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-[13px] font-bold">Cargando...</span>
        </div>
    );

    if (!cfg) return null;

    const patch = (partial: Partial<GestoriaConfig>) => setCfg(prev => prev ? { ...prev, ...partial } : prev);
    const patchSmtp = (partial: Partial<GestoriaConfig['smtp']>) =>
        setCfg(prev => prev ? { ...prev, smtp: { ...prev.smtp, ...partial } } : prev);
    const patchIncluir = (partial: Partial<GestoriaConfig['incluir']>) =>
        setCfg(prev => prev ? { ...prev, incluir: { ...prev.incluir, ...partial } } : prev);

    return (
        <div className="space-y-6 pb-10 animate-in fade-in duration-300">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[16px] font-black text-[#051650]">Envío a Gestoría</h2>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                        Configura y envía automáticamente los datos contables a tu gestoría
                    </p>
                </div>
                <button onClick={load} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Feedback */}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
            )}
            {successMsg && (
                <div className="flex items-center gap-2 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl text-[13px] text-teal-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />{successMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── Left: Config ─────────────────────────────────────────── */}
                <div className="space-y-5">

                    {/* Gestoría data */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#0056b3]" />
                            <p className="text-[13px] font-black text-[#051650] uppercase tracking-wider">Datos de la Gestoría</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Nombre" icon={<Building2 className="w-3 h-3" />}>
                                <Input
                                    value={cfg.nombre}
                                    onChange={e => patch({ nombre: e.target.value })}
                                    placeholder="Ej. Gestoría García & Asociados"
                                />
                            </Field>
                            <Field label="NIF / CIF" icon={<Hash className="w-3 h-3" />}>
                                <Input
                                    value={cfg.nif}
                                    onChange={e => patch({ nif: e.target.value })}
                                    placeholder="B12345678"
                                />
                            </Field>
                            <Field label="Email de destino" icon={<Mail className="w-3 h-3" />}
                                hint="Aquí recibirán los informes">
                                <Input
                                    type="email"
                                    value={cfg.email}
                                    onChange={e => patch({ email: e.target.value })}
                                    placeholder="contabilidad@gestoria.es"
                                />
                            </Field>
                            <Field label="Persona de contacto" icon={<User className="w-3 h-3" />}>
                                <Input
                                    value={cfg.contacto}
                                    onChange={e => patch({ contacto: e.target.value })}
                                    placeholder="María López"
                                />
                            </Field>
                        </div>
                    </div>

                    {/* What to include */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#0056b3]" />
                            <p className="text-[13px] font-black text-[#051650] uppercase tracking-wider">Datos a incluir</p>
                        </div>
                        <div className="space-y-3">
                            <Toggle
                                checked={cfg.incluir.facturasEmitidas}
                                onChange={v => patchIncluir({ facturasEmitidas: v })}
                                label="Facturas emitidas"
                                icon={<Receipt className="w-3.5 h-3.5 text-blue-500" />}
                            />
                            <Toggle
                                checked={cfg.incluir.facturasRecibidas}
                                onChange={v => patchIncluir({ facturasRecibidas: v })}
                                label="Facturas recibidas (email)"
                                icon={<Mail className="w-3.5 h-3.5 text-violet-500" />}
                            />
                            <Toggle
                                checked={cfg.incluir.movimientosBanco}
                                onChange={v => patchIncluir({ movimientosBanco: v })}
                                label="Movimientos bancarios"
                                icon={<Banknote className="w-3.5 h-3.5 text-emerald-500" />}
                            />
                            <Toggle
                                checked={cfg.incluir.modelosFiscales}
                                onChange={v => patchIncluir({ modelosFiscales: v })}
                                label="Modelos fiscales"
                                icon={<Scale className="w-3.5 h-3.5 text-amber-500" />}
                            />
                        </div>
                    </div>

                    {/* SMTP collapsible */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <button
                            onClick={() => setShowSmtp(v => !v)}
                            className="w-full flex items-center justify-between px-5 py-4 text-left"
                        >
                            <div className="flex items-center gap-2">
                                <Server className="w-4 h-4 text-slate-400" />
                                <p className="text-[13px] font-black text-[#051650] uppercase tracking-wider">Configuración SMTP</p>
                            </div>
                            {showSmtp ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>
                        {showSmtp && (
                            <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
                                <p className="text-[11px] text-slate-400 pt-3">
                                    Para Gmail usa smtp.gmail.com:587 con una contraseña de aplicación.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Host SMTP" icon={<Server className="w-3 h-3" />}>
                                        <Input
                                            value={cfg.smtp.host}
                                            onChange={e => patchSmtp({ host: e.target.value })}
                                            placeholder="smtp.gmail.com"
                                        />
                                    </Field>
                                    <Field label="Puerto" icon={<Hash className="w-3 h-3" />}>
                                        <Input
                                            type="number"
                                            value={cfg.smtp.port}
                                            onChange={e => patchSmtp({ port: parseInt(e.target.value) || 587 })}
                                        />
                                    </Field>
                                    <Field label="Usuario" icon={<User className="w-3 h-3" />}>
                                        <Input
                                            value={cfg.smtp.user}
                                            onChange={e => patchSmtp({ user: e.target.value })}
                                            placeholder="clinica@gmail.com"
                                        />
                                    </Field>
                                    <Field label="Contraseña" icon={<Lock className="w-3 h-3" />}>
                                        <Input
                                            type="password"
                                            value={cfg.smtp.pass === '••••••••' ? '' : cfg.smtp.pass}
                                            onChange={e => patchSmtp({ pass: e.target.value })}
                                            placeholder="App password"
                                        />
                                    </Field>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSaveConfig}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#051650] text-white rounded-xl text-[13px] font-bold hover:bg-[#0a2070] transition-all disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                        Guardar configuración
                    </button>
                </div>

                {/* ── Right: Send + History ─────────────────────────────────── */}
                <div className="space-y-5">

                    {/* Send now */}
                    <div className="bg-gradient-to-br from-[#051650] to-[#0a2580] rounded-2xl p-6 shadow-lg space-y-5">
                        <div className="flex items-center gap-2">
                            <Send className="w-5 h-5 text-white" />
                            <p className="text-[14px] font-black text-white uppercase tracking-wider">Enviar ahora</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-white/60 uppercase tracking-widest">Período</label>
                            <select
                                value={sendPeriod}
                                onChange={e => setSendPeriod(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-[13px] font-bold focus:outline-none focus:bg-white/20"
                            >
                                <option value="mes_actual" className="text-slate-900">Mes actual</option>
                                <option value="trimestre_actual" className="text-slate-900">Trimestre actual</option>
                                <option value="ano_actual" className="text-slate-900">Año actual</option>
                            </select>
                        </div>

                        {/* Summary of what will be sent */}
                        <div className="space-y-1.5">
                            {cfg.incluir.facturasEmitidas && (
                                <div className="flex items-center gap-2 text-[12px] text-white/70">
                                    <Receipt className="w-3.5 h-3.5" /> Facturas emitidas (CSV)
                                </div>
                            )}
                            {cfg.incluir.facturasRecibidas && (
                                <div className="flex items-center gap-2 text-[12px] text-white/70">
                                    <Mail className="w-3.5 h-3.5" /> Facturas recibidas (CSV)
                                </div>
                            )}
                            {cfg.incluir.movimientosBanco && (
                                <div className="flex items-center gap-2 text-[12px] text-white/70">
                                    <Banknote className="w-3.5 h-3.5" /> Movimientos bancarios (CSV)
                                </div>
                            )}
                            {cfg.incluir.modelosFiscales && (
                                <div className="flex items-center gap-2 text-[12px] text-white/70">
                                    <Scale className="w-3.5 h-3.5" /> Modelos fiscales (CSV)
                                </div>
                            )}
                            {!cfg.email && (
                                <p className="text-[12px] text-amber-300 font-bold">
                                    ⚠ Configura el email de la gestoría antes de enviar
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleSend}
                            disabled={sending || !cfg.email}
                            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-white text-[#051650] rounded-xl text-[13px] font-black hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? (
                                <><RefreshCw className="w-4 h-4 animate-spin" /> Enviando...</>
                            ) : (
                                <><Send className="w-4 h-4" /> Enviar datos a gestoría</>
                            )}
                        </button>
                    </div>

                    {/* History */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#0056b3]" />
                            <p className="text-[13px] font-black text-[#051650] uppercase tracking-wider">Historial de envíos</p>
                        </div>

                        {history.length === 0 ? (
                            <p className="text-[12px] text-slate-400 text-center py-4">
                                Aún no se han realizado envíos
                            </p>
                        ) : (
                            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                                {history.map(rec => (
                                    <div key={rec.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                        {rec.estado === 'ok'
                                            ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                            : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                        }
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[12px] font-bold text-slate-700 truncate">
                                                    {rec.periodo}
                                                </span>
                                                <span className="text-[11px] text-slate-400 shrink-0">
                                                    {new Date(rec.fecha).toLocaleDateString('es-ES', {
                                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 truncate">→ {rec.destinatario}</p>
                                            {rec.estado === 'error' && rec.error && (
                                                <p className="text-[11px] text-red-500 mt-0.5">{rec.error}</p>
                                            )}
                                            {rec.contenido?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {rec.contenido.map((c, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded">
                                                            {c.replace('• ', '')}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnvioGestoria;
