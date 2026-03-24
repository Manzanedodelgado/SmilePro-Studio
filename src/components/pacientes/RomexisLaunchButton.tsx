/**
 * RomexisLaunchButton — Abre Romexis para el paciente actual vía DxStart.
 *
 * Flujo principal:
 *   Botón click → POST http://localhost:7893/dxstart (agente local en el PC con Romexis)
 *               → agente ejecuta DxStart.exe → Romexis abre el paciente
 *
 * Fallback (si el agente no responde):
 *   Abre http://HOSTNAME/romexis/romexis en nueva pestaña
 */

import React, { useState, useRef, useEffect } from 'react';
import { MonitorPlay, Settings2, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import {
    getRomexisConfig, saveRomexisConfig, getRomexisWebUrl,
    type RomexisHost,
} from '../../services/romexis-config.service';

// Puerto del agente local Romexis (corre en el PC con DxStart instalado)
const AGENT_URL = 'http://127.0.0.1:7893';

interface Props {
    /** ID del paciente (numPac) */
    numPac?:          string;
    /** Apellidos */
    apellidos?:       string;
    /** Nombre */
    nombre?:          string;
    /** Fecha de nacimiento ISO (YYYY-MM-DD) */
    fechaNacimiento?: string;
    /** DNI — se usa como PatientID si no hay numPac */
    dni?:             string;
}

const RomexisLaunchButton: React.FC<Props> = ({
    numPac, apellidos, nombre, fechaNacimiento, dni,
}) => {
    const [showCfg, setShowCfg] = useState(false);
    const [draft, setDraft]     = useState<RomexisHost>(() => getRomexisConfig() ?? { hostname: '' });
    const [saved, setSaved]     = useState(false);
    const [status, setStatus]   = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [errMsg, setErrMsg]   = useState('');
    const ref = useRef<HTMLDivElement>(null);

    // Cierra el popover al clicar fuera
    useEffect(() => {
        if (!showCfg) return;
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setShowCfg(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [showCfg]);

    const handleLaunch = async () => {
        setStatus('loading');
        setErrMsg('');

        const patientId  = numPac ?? dni ?? 'UNKNOWN';
        const familyName = apellidos ?? '';
        const firstName  = nombre ?? '';
        // Romexis espera DD.MM.YYYY
        const birthDate  = fechaNacimiento
            ? fechaNacimiento.split('-').reverse().join('.')
            : '';

        // 1) Intenta vía agente local (localhost:7893 → DxStart)
        try {
            const res = await fetch(`${AGENT_URL}/dxstart`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId, familyName, firstName, birthDate }),
                signal: AbortSignal.timeout(4000),
            });
            if (res.ok) {
                setStatus('ok');
                setTimeout(() => setStatus('idle'), 2500);
                return;
            }
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error ?? `HTTP ${res.status}`);
        } catch (e) {
            // Agente no disponible en este PC → fallback web
            setErrMsg((e as Error).message);
        }

        // 2) Fallback: abre la web de Romexis en nueva pestaña
        const webUrl = getRomexisWebUrl();
        if (webUrl) {
            window.open(webUrl, 'romexis_viewer', 'noopener,noreferrer');
            setStatus('ok');
            setTimeout(() => setStatus('idle'), 2500);
        } else {
            // Sin configuración → abrir popover de config
            setStatus('error');
            setErrMsg('Configura el hostname de Romexis');
            setShowCfg(true);
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const handleSave = () => {
        saveRomexisConfig(draft);
        setSaved(true);
        setTimeout(() => { setSaved(false); setShowCfg(false); }, 1200);
    };

    const previewUrl = draft.hostname
        ? `http://${draft.hostname}/romexis/romexis`
        : '—';

    const isLoading = status === 'loading';
    const isOk      = status === 'ok';
    const isError   = status === 'error';
    const hasHost   = Boolean(getRomexisConfig()?.hostname);

    return (
        <div className="relative flex-shrink-0" ref={ref}>
            {/* ── Botón principal ── */}
            <div className="flex items-center">
                <button
                    onClick={handleLaunch}
                    disabled={isLoading}
                    title="Abrir paciente en Romexis"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-[10px] font-extrabold uppercase tracking-widest transition-all duration-200 active:scale-95 disabled:opacity-70
                        ${isOk    ? 'bg-emerald-600 text-white border border-emerald-600'
                        : isError ? 'bg-rose-600 text-white border border-rose-600'
                        : hasHost ? 'bg-[#002147] text-white hover:bg-[#003580] border border-[#002147]'
                                  : 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100'
                        }`}
                >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : isOk     ? <Check className="w-3.5 h-3.5" />
                               : <MonitorPlay className="w-3.5 h-3.5" />}
                    {isLoading ? 'Abriendo…'
                    : isOk     ? 'Romexis abierto'
                    : isError  ? 'Error'
                               : 'Romexis'}
                    {!hasHost && !isLoading && <AlertCircle className="w-3 h-3 text-amber-500" />}
                </button>
                <button
                    onClick={() => { setDraft(getRomexisConfig() ?? { hostname: '' }); setShowCfg(v => !v); }}
                    title="Configurar Romexis"
                    className={`flex items-center justify-center px-2 py-1.5 rounded-r-lg border-l transition-all duration-200 active:scale-95
                        ${hasHost
                            ? 'bg-[#002147] text-blue-300 hover:text-white border-[#001030] hover:bg-[#003580]'
                            : 'bg-amber-50 text-amber-400 border-amber-300 hover:bg-amber-100'
                        }`}
                >
                    <Settings2 className="w-3 h-3" />
                </button>
            </div>

            {/* Error tooltip */}
            {isError && errMsg && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-rose-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                    {errMsg}
                </div>
            )}

            {/* ── Popover configuración ── */}
            {showCfg && (
                <div className="absolute right-0 top-full mt-2 z-[9999] w-96 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-[#002147] text-white">
                        <MonitorPlay className="w-4 h-4 flex-shrink-0" />
                        <div className="flex-1">
                            <span className="text-[11px] font-black uppercase tracking-widest block">Conexión Romexis</span>
                            <span className="text-[9px] text-blue-300 font-mono">vía DxStart bridge</span>
                        </div>
                        <button onClick={() => setShowCfg(false)} className="text-white/60 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Info DxStart */}
                    <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-[10px] text-blue-700 leading-relaxed">
                        <strong className="font-black">Bridge DxStart:</strong> el agente local{' '}
                        <code className="font-mono bg-blue-100 px-1 rounded">romexis-agent.exe</code> debe estar corriendo
                        en la máquina Windows con Romexis (puerto 7893).
                        El hostname No-IP es el fallback si el agente no responde.
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Hostname fallback */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                Hostname No-IP (fallback web)
                            </label>
                            <input
                                type="text"
                                value={draft.hostname}
                                onChange={e => setDraft(d => ({ ...d, hostname: e.target.value.trim() }))}
                                placeholder="clinica.bbddsql.servemp3.com"
                                className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-mono"
                                autoFocus
                            />
                        </div>

                        {/* Preview URL fallback */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">URL Romexis (fallback)</p>
                            <p className="text-[11px] font-mono text-slate-600 break-all">{previewUrl}</p>
                        </div>

                        {/* Info agente local */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-[10px] text-amber-700 leading-relaxed">
                            <strong className="font-black">En el PC con Romexis:</strong> instala y ejecuta<br />
                            <code className="font-mono bg-amber-100 px-1 rounded mt-1 block">
                                romexis-agent.exe  →  instalar-windows.bat
                            </code>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 pb-4">
                        <button
                            onClick={handleSave}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300
                                ${saved
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-[#002147] text-white hover:bg-[#003580] active:scale-[0.98]'
                                }`}
                        >
                            {saved ? <><Check className="w-3.5 h-3.5" /> Guardado</> : 'Guardar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RomexisLaunchButton;
