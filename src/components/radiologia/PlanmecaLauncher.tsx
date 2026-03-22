/**
 * PlanmecaLauncher.tsx — Botones para abrir estudios en Planmeca Romexis / Weasis
 */

import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

interface PlanmecaLauncherProps {
    rutaOrigen?: string;
    compact?:    boolean;
}

const PlanmecaLauncher: React.FC<PlanmecaLauncherProps> = ({ rutaOrigen, compact = false }) => {
    const [copied, setCopied] = useState(false);

    const copyPath = async () => {
        if (!rutaOrigen) return;
        try {
            await navigator.clipboard.writeText(rutaOrigen);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            window.prompt('Copia la ruta en Romexis:', rutaOrigen);
        }
    };

    const openWeasis = () => {
        const href = rutaOrigen
            ? `weasis://?${encodeURIComponent(`$dicom:get -l "${rutaOrigen}"`)}`
            : 'weasis://';
        window.location.href = href;
    };

    if (compact) return (
        <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={copyPath} title="Abrir en Romexis" style={{
                padding: '3px 8px', border: '1px solid #1e2535', borderRadius: 4,
                cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: copied ? '#0e4d5c' : '#141820',
                color: copied ? '#22d3ee' : '#64748b',
                display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s',
            }}>
                {copied ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
                Romexis
            </button>
            <button onClick={openWeasis} title="Abrir en Weasis" style={{
                padding: '3px 8px', border: '1px solid #1e2535', borderRadius: 4,
                cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: '#141820', color: '#64748b',
                display: 'flex', alignItems: 'center', gap: 3,
            }}>
                <ExternalLink style={{ width: 10, height: 10 }} /> Weasis
            </button>
        </div>
    );

    return (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>Abrir estudio en visor externo:</p>
            {rutaOrigen && (
                <code style={{
                    background: '#0d1018', border: '1px solid #1e2535', borderRadius: 6,
                    padding: '6px 10px', fontSize: 10, color: '#475569',
                    wordBreak: 'break-all',
                }}>{rutaOrigen}</code>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copyPath} style={{
                    padding: '6px 14px', border: `1px solid ${copied ? '#22d3ee' : '#1e2535'}`,
                    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: copied ? '#0e4d5c' : '#141820',
                    color: copied ? '#22d3ee' : '#94a3b8',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                }}>
                    {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                    {copied ? 'Ruta copiada' : 'Copiar ruta → Romexis'}
                </button>
                <button onClick={openWeasis} style={{
                    padding: '6px 14px', border: '1px solid #1e2535',
                    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: '#141820', color: '#94a3b8',
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    <ExternalLink style={{ width: 13, height: 13 }} /> Abrir en Weasis
                </button>
            </div>
        </div>
    );
};

export default PlanmecaLauncher;
