/**
 * PlanmecaLauncher.tsx
 *
 * Al seleccionar un estudio DICOM, SmilePro lanza automáticamente
 * Planmeca Romexis Viewer a través del protocolo personalizado romexis://
 *
 * Cómo funciona:
 *   1. SmilePro emite  window.location.href = 'romexis:///ruta/al/archivo.dcm'
 *   2. El SO intercepta 'romexis://' y ejecuta launch_romexis.bat (Windows)
 *      o RomexisProtocolHandler.app (macOS)
 *   3. El script crea un .txt con la ruta y lanza:
 *        java -jar RomexisViewer.jar en listado.txt
 *
 * Instalación del protocolo (una vez por PC):
 *   Windows → /romexis-installer/windows/install.reg
 *   macOS   → bash /romexis-installer/macos/install.sh
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Monitor, Download, Copy, CheckCircle, AlertCircle,
    ExternalLink, Info, Layers, FolderOpen,
} from 'lucide-react';
import type { EstudioRadiologico } from '../../services/imagen.service';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Props {
    estudio: EstudioRadiologico;
    file?: File | null;
    patientName?: string;
}

type LaunchState = 'launching' | 'launched' | 'no_path' | 'downloaded' | 'copied' | 'error';

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatBytes = (n?: number) => {
    if (!n) return '—';
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(2)} MB`;
};

const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch { return iso; }
};

const formatDicomDate = (raw?: string) => {
    if (!raw || raw.length !== 8) return raw ?? '—';
    return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
};

const MODALITY_LABEL: Record<string, string> = {
    PX: 'Ortopantomografía', CT: 'CBCT / TC Dental',
    IO: 'Intraoral digital', DX: 'Radiografía digital', XA: 'Angiografía',
};

// ── Componente ─────────────────────────────────────────────────────────────────

const PlanmecaLauncher: React.FC<Props> = ({ estudio, file, patientName }) => {

    const [state, setState] = useState<LaunchState>('launching');
    const [msg, setMsg] = useState('');

    // ── Lanzar protocolo romexis:// ───────────────────────────────────────────
    // URI: romexis:///ruta/al/archivo.dcm
    // El script launch_romexis.bat/install.sh recibe esta URI, extrae la ruta,
    // crea un .txt temporal y ejecuta: java -jar RomexisViewer.jar en lista.txt
    const launchRomexis = useCallback((path: string) => {
        const uri = `romexis:///${encodeURIComponent(path)}`;
        window.location.href = uri;
    }, []);

    // ── Al seleccionar un nuevo estudio: lanzar automáticamente ──────────────
    useEffect(() => {
        if (estudio.rutaOrigen) {
            // Estudio con ruta de red conocida → lanza Romexis directamente
            launchRomexis(estudio.rutaOrigen);
            setState('launched');
            setMsg('Romexis Viewer abierto');
        } else if (file) {
            // Archivo importado en este dispositivo → descarga y el SO lo abre
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = estudio.nombre;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setState('downloaded');
            setMsg('Archivo enviado al visor predeterminado');
        } else {
            // Demo sin archivo real: mostrar instrucciones
            setState('no_path');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estudio.id]);

    // ── Acciones manuales ─────────────────────────────────────────────────────

    const handleRetry = () => {
        if (estudio.rutaOrigen) {
            launchRomexis(estudio.rutaOrigen);
            setState('launched');
            setMsg('Reintentando…');
        }
    };

    const handleDownload = () => {
        if (file) {
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url; a.download = estudio.nombre; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setState('downloaded'); setMsg('Archivo descargado');
        } else if (estudio.originalUrl?.startsWith('blob:') || estudio.originalUrl?.startsWith('data:')) {
            const a = document.createElement('a');
            a.href = estudio.originalUrl; a.download = estudio.nombre; a.click();
            setState('downloaded'); setMsg('Archivo descargado');
        } else {
            setState('error'); setMsg('Archivo no disponible en este dispositivo');
        }
    };

    const handleCopyPath = async () => {
        const path = estudio.rutaOrigen ?? estudio.nombre;
        try {
            await navigator.clipboard.writeText(path);
            setState('copied'); setMsg('Ruta copiada');
        } catch {
            window.prompt('Copia esta ruta y ábrela en Romexis:', path);
        }
    };

    const handleWeasis = () => {
        const path = estudio.rutaOrigen;
        const uri = path ? `weasis://?${encodeURIComponent(`$dicom:get -l "${path}"`)}` : 'weasis://';
        window.location.href = uri;
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const meta = estudio.dicomMeta;
    const hasLocalFile = Boolean(file)
        || estudio.originalUrl?.startsWith('blob:')
        || estudio.originalUrl?.startsWith('data:');

    const statusColor = state === 'launched' || state === 'downloaded' || state === 'copied'
        ? '#10b981' : state === 'error' ? '#ef4444' : '#3b82f6';

    const statusIcon = state === 'launched' || state === 'downloaded' || state === 'copied'
        ? <CheckCircle style={{ width: 16, height: 16 }} />
        : state === 'error'
        ? <AlertCircle style={{ width: 16, height: 16 }} />
        : <Monitor style={{ width: 16, height: 16 }} />;

    const statusText = {
        launching:  'Abriendo Planmeca Romexis Viewer…',
        launched:   msg || 'Romexis Viewer abierto',
        no_path:    'Estudio de demo — importa el archivo .dcm real',
        downloaded: msg || 'Archivo enviado al visor',
        copied:     msg || 'Ruta copiada al portapapeles',
        error:      msg || 'Error al abrir',
    }[state];

    return (
        <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#0a0c10', padding: '24px 20px', gap: 0, overflowY: 'auto',
        }}>

            {/* ── Logo / estado ─────────────────────────────────────────────── */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 56, height: 56, borderRadius: 14,
                    background: `linear-gradient(135deg, #003a70 0%, #0064b0 100%)`,
                    marginBottom: 12, boxShadow: `0 6px 24px rgba(0,100,176,0.3)`,
                }}>
                    <Monitor style={{ width: 26, height: 26, color: '#7ec8ff' }} />
                </div>
                <h2 style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700, margin: 0 }}>
                    Planmeca Romexis Viewer
                </h2>

                {/* Estado del lanzamiento */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    marginTop: 10, padding: '6px 14px',
                    background: `${statusColor}15`, border: `1px solid ${statusColor}44`,
                    borderRadius: 20,
                }}>
                    <span style={{ color: statusColor }}>{statusIcon}</span>
                    <span style={{ color: statusColor, fontSize: 12, fontWeight: 600 }}>
                        {statusText}
                    </span>
                </div>
            </div>

            {/* ── Tarjeta del estudio ────────────────────────────────────────── */}
            <div style={{
                width: '100%', maxWidth: 500,
                background: '#0d1018', border: '1px solid #1e2535', borderRadius: 10,
                padding: '14px 16px', marginBottom: 16,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Layers style={{ width: 16, height: 16, color: '#3b82f6', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                        <p style={{
                            color: '#e2e8f0', fontSize: 12, fontWeight: 600, margin: 0,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{estudio.nombre}</p>
                        <p style={{ color: '#64748b', fontSize: 11, margin: '2px 0 0' }}>
                            {patientName ?? estudio.pacienteNumPac} · {formatDate(estudio.fecha)}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                    {([
                        ['Modalidad', meta ? (MODALITY_LABEL[meta.modality] ?? meta.modality) : estudio.tipo],
                        ['Descripción', meta?.studyDescription],
                        ['Fecha DICOM', formatDicomDate(meta?.studyDate)],
                        ['Equipo', meta?.manufacturer],
                        ['kVp / mA', meta ? `${meta.kvp ?? '—'} / ${meta.tubeCurrent ?? '—'}` : undefined],
                        ['Tamaño', formatBytes(estudio.fileSize)],
                    ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                        <div key={label}>
                            <p style={{ color: '#475569', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                            <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
                        </div>
                    ))}
                </div>

                {estudio.rutaOrigen && (
                    <div style={{
                        marginTop: 10, padding: '6px 9px',
                        background: '#0a0c10', borderRadius: 5, border: '1px solid #1e2535',
                        display: 'flex', alignItems: 'center', gap: 7,
                    }}>
                        <FolderOpen style={{ width: 10, height: 10, color: '#334155', flexShrink: 0 }} />
                        <code style={{ color: '#475569', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {estudio.rutaOrigen}
                        </code>
                    </div>
                )}
            </div>

            {/* ── Acciones ───────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 500, width: '100%', marginBottom: 16 }}>

                {/* Reintentar Romexis */}
                {estudio.rutaOrigen && (
                    <button onClick={handleRetry} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '9px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                    }}>
                        <Monitor style={{ width: 13, height: 13 }} /> Abrir en Romexis
                    </button>
                )}

                {/* Descargar DCM */}
                <button onClick={handleDownload} disabled={!hasLocalFile} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 14px', borderRadius: 7, border: '1px solid #1e2535',
                    background: '#0d1018', color: hasLocalFile ? '#64748b' : '#1e2535',
                    fontSize: 11, fontWeight: 600, cursor: hasLocalFile ? 'pointer' : 'not-allowed',
                }}>
                    <Download style={{ width: 13, height: 13 }} />
                    {state === 'downloaded' ? 'Descargado' : 'Descargar .dcm'}
                </button>

                {/* Copiar ruta */}
                <button onClick={handleCopyPath} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 14px', borderRadius: 7, border: '1px solid #1e2535',
                    background: '#0d1018', color: state === 'copied' ? '#22d3ee' : '#64748b',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                    <Copy style={{ width: 13, height: 13 }} />
                    {state === 'copied' ? 'Copiado' : 'Copiar ruta'}
                </button>

                {/* Weasis alternativa */}
                <button onClick={handleWeasis} title="Weasis — visor DICOM gratuito" style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 14px', borderRadius: 7, border: '1px solid #1e2535',
                    background: '#0d1018', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                    <ExternalLink style={{ width: 13, height: 13 }} /> Weasis
                </button>
            </div>

            {/* ── Nota protocolo no instalado ────────────────────────────────── */}
            <div style={{
                maxWidth: 500, width: '100%', padding: '10px 14px',
                background: '#0d1018', border: '1px solid #1e2535', borderRadius: 8,
                display: 'flex', gap: 10,
            }}>
                <Info style={{ width: 12, height: 12, color: '#334155', flexShrink: 0, marginTop: 1 }} />
                <div>
                    <p style={{ color: '#475569', fontSize: 11, margin: '0 0 4px', fontWeight: 600 }}>
                        ¿Romexis no se abre automáticamente?
                    </p>
                    <p style={{ color: '#334155', fontSize: 10, margin: 0, lineHeight: 1.5 }}>
                        Instala el protocolo <code style={{ color: '#475569' }}>romexis://</code> en este PC.
                        Descarga el instalador desde{' '}
                        <a href="/romexis-installer/INSTALAR.txt" target="_blank"
                            style={{ color: '#3b82f6', textDecoration: 'none' }}>
                            /romexis-installer/INSTALAR.txt
                        </a>
                        {' '}(una sola vez por ordenador).
                    </p>
                </div>
            </div>

        </div>
    );
};

export default PlanmecaLauncher;
