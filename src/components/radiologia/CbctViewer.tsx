/**
 * CbctViewer.tsx — Visor CBCT integrado en SmilePro
 *
 * Componente puro de viewports: NO tiene panel lateral propio.
 * Los controles (Presets, W/L, Layout, Posición 3D) los gestiona
 * el módulo padre (Radiologia.tsx) y se los pasa como props.
 *
 * 6 vistas clínicas: Axial · Coronal · Sagital · Panorámica · MIP 3D · Cefalometría
 */

import React, {
    useEffect, useLayoutEffect, useRef, useState, useCallback
} from 'react';
import {
    X, Activity, Download,
    ChevronLeft, ChevronRight, Maximize2, Minimize2,
} from 'lucide-react';
import {
    loadDicomVolume,
    renderAxial,
    renderCoronal,
    renderSagittal,
    renderPanoramicaAsync,
    renderMIPAsync,
    renderCephalometryAsync,
    type DicomVolume,
} from '../../services/dicom.service';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type ViewId = 'axial' | 'coronal' | 'sagital' | 'panoramica' | 'mip' | 'cefa';

export interface ViewMeta {
    id: ViewId;
    label: string;
    abr: string;
    color: string;
    async: boolean;
    description: string;
}

export const VIEWS: ViewMeta[] = [
    { id: 'axial', label: 'Axial', abr: 'AX', color: '#009fe3', async: false, description: 'Cortes horizontales (Z)' },
    { id: 'coronal', label: 'Coronal', abr: 'COR', color: '#10b981', async: false, description: 'Vista frontal (Y)' },
    { id: 'sagital', label: 'Sagital', abr: 'SAG', color: '#f59e0b', async: false, description: 'Vista lateral (X)' },
    { id: 'panoramica', label: 'Panorámica', abr: 'PAN', color: '#8b5cf6', async: true, description: 'OPG reconstruida' },
    { id: 'mip', label: 'MIP 3D', abr: 'MIP', color: '#ec4899', async: true, description: 'Proyección máx. intensidad' },
    { id: 'cefa', label: 'Cefalometría', abr: 'CEFA', color: '#06b6d4', async: true, description: 'Teleradiografía lateral' },
];

// ── Utilidad exportar PNG clínico ─────────────────────────────────────────────

export function exportCanvas(canvas: HTMLCanvasElement | null, filename: string, patient: string, label: string): void {
    if (!canvas) return;
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height + 32;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = '#003a70'; ctx.fillRect(0, 0, out.width, 32);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(`${label}  ·  ${patient}  ·  ${new Date().toLocaleDateString('es-ES')}  ·  SmilePro`, 10, 21);
    ctx.drawImage(canvas, 0, 32);
    const a = document.createElement('a');
    a.download = filename; a.href = out.toDataURL('image/png'); a.click();
}

// ── Progreso del render async (exportado para Radiologia) ─────────────────────

export interface CbctProgress {
    pano: number;
    mip: number;
    cefa: number;
}

// ── Props del componente ───────────────────────────────────────────────────────

export interface CbctViewerProps {
    file: File;
    patientName?: string;
    onClose: () => void;
    // Controles externos (gestionados por Radiologia)
    wc: number;
    ww: number;
    layout: '4x' | ViewId;
    invert: boolean;
    onWCChange: (v: number) => void;
    onWWChange: (v: number) => void;
    onLayoutChange: (v: '4x' | ViewId) => void;
    // Callbacks de estado del volumen
    onVolumeLoaded?: (vol: DicomVolume) => void;
    onProgress?: (p: CbctProgress) => void;
    // Refs expuestos para exportar desde el sidebar
    panoRefExternal?: React.RefObject<HTMLCanvasElement>;
    mipRefExternal?: React.RefObject<HTMLCanvasElement>;
    cefaRefExternal?: React.RefObject<HTMLCanvasElement>;
}

// ── Panel de vista individual ──────────────────────────────────────────────────

interface PanelProps {
    meta: ViewMeta;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    slice: number;
    maxSlices: number;
    onSlice: (v: number) => void;
    onClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    crossX?: number;
    crossY?: number;
    onExpand?: () => void;
    isExpanded?: boolean;
    progress?: number;
}

const ViewPanel: React.FC<PanelProps> = React.memo(({
    meta, canvasRef, slice, maxSlices, onSlice, onClick,
    crossX, crossY, onExpand, isExpanded, progress
}) => {
    const { label, color, async: isAsync, description } = meta;
    const canNav = !isAsync;

    const onWheel = useCallback((e: React.WheelEvent) => {
        if (!canNav) return;
        e.preventDefault(); e.stopPropagation();
        onSlice(Math.max(0, Math.min(slice + (e.deltaY > 0 ? 1 : -1), maxSlices - 1)));
    }, [slice, maxSlices, canNav, onSlice]);

    return (
        <div className="relative flex flex-col overflow-hidden bg-[#0a0c10] rounded-lg border border-slate-800/60"
            style={{ boxShadow: `inset 0 0 0 1px ${color}15` }}>
            {/* Header del panel */}
            <div className="flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 border-b border-slate-800/60"
                style={{ background: `linear-gradient(to right, ${color}12, transparent)` }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[12px] font-bold uppercase tracking-widest flex-1" style={{ color }}>
                    {label}
                </span>
                <span className="text-[12px] text-slate-600 hidden sm:block">{description}</span>
                {canNav && (
                    <span className="text-[12px] font-mono text-slate-500 ml-1">
                        {slice + 1}/{maxSlices}
                    </span>
                )}
                {onExpand && (
                    <button onClick={onExpand}
                        className="w-4 h-4 flex items-center justify-center text-slate-700 hover:text-slate-300 transition-all ml-1">
                        {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    </button>
                )}
            </div>

            {/* Barra de progreso */}
            {progress !== undefined && progress < 1 && (
                <div className="absolute top-[30px] inset-x-0 h-0.5 z-20">
                    <div className="h-full transition-all duration-200 ease-out"
                        style={{ width: `${progress * 100}%`, backgroundColor: color }} />
                </div>
            )}

            {/* Canvas */}
            <div className="flex-1 flex items-center justify-center overflow-hidden cursor-crosshair relative"
                onWheel={onWheel}>
                <canvas ref={canvasRef} onClick={onClick}
                    style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: '100%' }} />

                {/* Crosshairs */}
                {crossX !== undefined && crossY !== undefined && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.6 }}>
                        <line x1={`${crossX * 100}%`} y1="0" x2={`${crossX * 100}%`} y2="100%"
                            stroke={color} strokeWidth="1" strokeDasharray="4 3" />
                        <line x1="0" y1={`${crossY * 100}%`} x2="100%" y2={`${crossY * 100}%`}
                            stroke={color} strokeWidth="1" strokeDasharray="4 3" />
                        <circle cx={`${crossX * 100}%`} cy={`${crossY * 100}%`} r="3"
                            fill="none" stroke={color} strokeWidth="1.2" />
                    </svg>
                )}

                {/* Mensaje calculando */}
                {progress !== undefined && progress < 0.05 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                                style={{ borderColor: `${color}40`, borderTopColor: color }} />
                            <span className="text-[12px] text-slate-500">Calculando…</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Slider navegación */}
            {canNav && (
                <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 border-t border-slate-800/50 bg-[#060810]">
                    <button onClick={() => onSlice(Math.max(0, slice - 1))}
                        className="w-4 h-4 flex items-center justify-center text-slate-700 hover:text-slate-400 transition-all">
                        <ChevronLeft className="w-3 h-3" />
                    </button>
                    <input type="range" min={0} max={maxSlices - 1} value={slice}
                        onChange={e => onSlice(Number(e.target.value))}
                        className="flex-1 h-[2px] appearance-none cursor-pointer"
                        style={{ accentColor: color }} />
                    <button onClick={() => onSlice(Math.min(maxSlices - 1, slice + 1))}
                        className="w-4 h-4 flex items-center justify-center text-slate-700 hover:text-slate-400 transition-all">
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
    );
});

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────

const CbctViewer: React.FC<CbctViewerProps> = ({
    file, patientName, onClose,
    wc, ww, layout, invert,
    onWCChange: _onWCChange, onWWChange: _onWWChange, onLayoutChange,
    onVolumeLoaded, onProgress,
    panoRefExternal, mipRefExternal, cefaRefExternal,
}) => {
    const [volume, setVolume] = useState<DicomVolume | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadMsg, setLoadMsg] = useState('Procesando DICOM…');
    const [loadPct, setLoadPct] = useState(0);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    const [axialZ, setAxialZ] = useState(0);
    const [coronalY, setCoronalY] = useState(0);
    const [sagitalX, setSagitalX] = useState(0);

    const [panoPct, setPanoPct] = useState(0);
    const [mipPct, setMipPct] = useState(0);
    const [cefaPct, setCefaPct] = useState(0);

    const axRef = useRef<HTMLCanvasElement>(null);
    const corRef = useRef<HTMLCanvasElement>(null);
    const sagRef = useRef<HTMLCanvasElement>(null);
    // Usar refs externos si están disponibles, si no usar internos
    const _panoRef = useRef<HTMLCanvasElement>(null);
    const _mipRef = useRef<HTMLCanvasElement>(null);
    const _cefaRef = useRef<HTMLCanvasElement>(null);
    const panoRef = panoRefExternal ?? _panoRef;
    const mipRef = mipRefExternal ?? _mipRef;
    const cefaRef = cefaRefExternal ?? _cefaRef;

    const axImgRef = useRef<ImageData | null>(null);
    const computed = useRef({ pano: false, mip: false, cefa: false });

    // Carga
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoadPct(20); setLoadMsg('Leyendo archivo DICOM…');
                const vol = await loadDicomVolume(file);
                if (cancelled) return;
                setLoadPct(90); setLoadMsg(`Indexando ${vol.numFrames} cortes…`);
                await new Promise(r => setTimeout(r, 30));
                if (cancelled) return;
                setAxialZ(Math.floor(vol.numFrames / 2));
                setCoronalY(Math.floor(vol.rows / 2));
                setSagitalX(Math.floor(vol.cols / 2));
                setLoadPct(100);
                setVolume(vol);
                setLoading(false);
                onVolumeLoaded?.(vol);
            } catch (e) {
                if (!cancelled) { setLoadErr((e as Error).message); setLoading(false); }
            }
        })();
        return () => { cancelled = true; };
    }, [file]);

    // Async renders
    useEffect(() => {
        if (!volume) return;
        if (!computed.current.pano && panoRef.current) {
            computed.current.pano = true;
            renderPanoramicaAsync(volume, wc, ww, panoRef.current, p => setPanoPct(p)).then(() => setPanoPct(1));
        }
        if (!computed.current.mip && mipRef.current) {
            computed.current.mip = true;
            renderMIPAsync(volume, wc, ww, mipRef.current, 1, p => setMipPct(p)).then(() => setMipPct(1));
        }
        if (!computed.current.cefa && cefaRef.current) {
            computed.current.cefa = true;
            renderCephalometryAsync(volume, wc, ww, cefaRef.current, 1, p => setCefaPct(p)).then(() => setCefaPct(1));
        }
    }, [volume]);

    // Re-render W/L
    useEffect(() => {
        if (!volume) return;
        if (panoRef.current && panoPct >= 1) renderPanoramicaAsync(volume, wc, ww, panoRef.current, p => setPanoPct(p)).then(() => setPanoPct(1));
        if (mipRef.current && mipPct >= 1) renderMIPAsync(volume, wc, ww, mipRef.current, 1, p => setMipPct(p)).then(() => setMipPct(1));
        if (cefaRef.current && cefaPct >= 1) renderCephalometryAsync(volume, wc, ww, cefaRef.current, 1, p => setCefaPct(p)).then(() => setCefaPct(1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wc, ww]);

    // Propagar progreso al padre
    useEffect(() => {
        onProgress?.({ pano: panoPct, mip: mipPct, cefa: cefaPct });
    }, [panoPct, mipPct, cefaPct]);

    // Renders síncronos
    useLayoutEffect(() => {
        if (!volume) return;
        if (axRef.current) {
            if (axRef.current.width !== volume.cols) { axRef.current.width = volume.cols; axRef.current.height = volume.rows; }
            const ctx = axRef.current.getContext('2d')!;
            if (!axImgRef.current || axImgRef.current.width !== volume.cols) axImgRef.current = ctx.createImageData(volume.cols, volume.rows);
            renderAxial(volume, axialZ, wc, ww, axImgRef.current);
            ctx.putImageData(axImgRef.current, 0, 0);
        }
    });

    useEffect(() => { if (volume && corRef.current) renderCoronal(volume, coronalY, wc, ww, corRef.current); }, [volume, coronalY, wc, ww]);
    useEffect(() => { if (volume && sagRef.current) renderSagittal(volume, sagitalX, wc, ww, sagRef.current); }, [volume, sagitalX, wc, ww]);

    // Teclado
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (!volume) return;
            if (e.key === 'ArrowUp') setAxialZ(z => Math.min(z + 1, volume.numFrames - 1));
            if (e.key === 'ArrowDown') setAxialZ(z => Math.max(z - 1, 0));
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [volume, onClose]);

    // Clicks de cruce
    const onAxClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!volume || !axRef.current) return;
        const r = axRef.current.getBoundingClientRect();
        setSagitalX(Math.round(((e.clientX - r.left) / r.width) * (volume.cols - 1)));
        setCoronalY(Math.round(((e.clientY - r.top) / r.height) * (volume.rows - 1)));
    };
    const onCorClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!volume || !corRef.current) return;
        const r = corRef.current.getBoundingClientRect();
        setSagitalX(Math.round(((e.clientX - r.left) / r.width) * (volume.cols - 1)));
        setAxialZ(Math.round(((e.clientY - r.top) / r.height) * (volume.numFrames - 1)));
    };
    const onSagClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!volume || !sagRef.current) return;
        const r = sagRef.current.getBoundingClientRect();
        setCoronalY(Math.round(((e.clientX - r.left) / r.width) * (volume.rows - 1)));
        setAxialZ(Math.round(((e.clientY - r.top) / r.height) * (volume.numFrames - 1)));
    };

    const pName = patientName ?? 'Paciente';
    const filterStr = invert ? 'invert(1)' : 'none';

    const v = volume;
    const axCX = v ? sagitalX / (v.cols - 1) : 0.5;
    const axCY = v ? coronalY / (v.rows - 1) : 0.5;
    const corCX = v ? sagitalX / (v.cols - 1) : 0.5;
    const corCY = v ? axialZ / (v.numFrames - 1) : 0.5;
    const sagCX = v ? coronalY / (v.rows - 1) : 0.5;
    const sagCY = v ? axialZ / (v.numFrames - 1) : 0.5;

    // ── RENDER ────────────────────────────────────────────────────────────

    return (
        <div className="h-full w-full flex flex-col overflow-hidden" style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#07090e' }}
            onContextMenu={e => e.preventDefault()}>

            {/* ── BARRA SUPERIOR ────────────────────────────────────────────── */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 h-11"
                style={{ background: '#0d1525', borderBottom: '1px solid #009fe320' }}>

                {/* Info paciente + archivo */}
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 flex-shrink-0" style={{ color: '#009fe3' }} />
                    <div>
                        <p className="text-[13px] font-bold text-white leading-tight">{pName}</p>
                        <p className="text-[12px] text-slate-500 leading-tight truncate max-w-[200px]">{file.name}</p>
                    </div>
                </div>

                {v && (
                    <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                        <span className="text-[12px] text-slate-400">
                            {v.modality} · {v.cols}×{v.rows} · <strong className="text-white">{v.numFrames} cortes</strong> · {(file.size / 1024 / 1024).toFixed(0)} MB
                        </span>
                    </div>
                )}

                {/* Layout tabs */}
                {!loading && !loadErr && (
                    <div className="flex items-center gap-0.5 ml-2 bg-black/20 rounded-lg p-0.5 border border-white/10">
                        <button onClick={() => onLayoutChange('4x')}
                            className={`px-2.5 py-1 rounded-md text-[12px] font-bold uppercase tracking-wider transition-all ${layout === '4x' ? 'bg-white text-[#003a70]' : 'text-white/80 hover:text-white'}`}>
                            4 Vistas
                        </button>
                        {VIEWS.map(view => (
                            <button key={view.id} onClick={() => onLayoutChange(view.id)}
                                className={`px-2.5 py-1 rounded-md text-[12px] font-bold transition-all ${layout === view.id ? 'text-white' : 'text-white/70 hover:text-white/80'}`}
                                style={{ backgroundColor: layout === view.id ? `${view.color}cc` : undefined }}>
                                {view.abr}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1" />

                {/* Acciones */}
                {!loading && !loadErr && (
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => {
                                const map: Record<string, React.RefObject<HTMLCanvasElement | null>> = {
                                    axial: axRef, coronal: corRef, sagital: sagRef,
                                    panoramica: panoRef, mip: mipRef, cefa: cefaRef
                                };
                                const k = layout === '4x' ? 'axial' : layout;
                                exportCanvas(map[k]?.current, `${k}_${pName.replace(/[^a-zA-Z0-9]/g, '_')}.png`, pName, k.toUpperCase());
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-white/70 hover:text-white border border-white/10 hover:bg-white/10 transition-all">
                            <Download className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Cerrar */}
                <button onClick={onClose}
                    className="flex items-center gap-1.5 px-3 h-7 rounded-md text-[12px] font-bold text-white transition-all"
                    style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}>
                    <X className="w-3 h-3" /> Cerrar
                </button>
            </div>

            {/* ── VIEWPORTS ─────────────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 relative p-2">

                {/* Loading */}
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20" style={{ background: '#07090e' }}>
                        <div className="w-14 h-14 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: '#009fe330', borderTopColor: '#009fe3' }} />
                        <div className="text-center">
                            <p className="text-[12px] font-bold text-white mb-1">{loadMsg}</p>
                            <p className="text-[12px] text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                            <div className="w-52 h-1.5 rounded-full mt-3 mx-auto overflow-hidden" style={{ background: '#ffffff10' }}>
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${loadPct}%`, background: 'linear-gradient(to right, #003a70, #009fe3)' }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Error */}
                {loadErr && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-900/20 border border-red-800/40">
                            <X className="w-6 h-6 text-red-400" />
                        </div>
                        <p className="font-bold text-red-300 text-[13px]">Error al leer el archivo DICOM</p>
                        <p className="text-slate-500 text-[12px] max-w-sm text-center">{loadErr}</p>
                    </div>
                )}

                {/* Viewports activos */}
                {volume && !loading && !loadErr && (() => {
                    if (layout === '4x') {
                        return (
                            <div className="grid grid-cols-2 grid-rows-2 h-full gap-2">
                                <ViewPanel meta={VIEWS[0]} canvasRef={axRef}
                                    slice={axialZ} maxSlices={volume.numFrames} onSlice={setAxialZ}
                                    onClick={onAxClick} crossX={axCX} crossY={axCY}
                                    onExpand={() => onLayoutChange('axial')} />
                                <ViewPanel meta={VIEWS[1]} canvasRef={corRef}
                                    slice={coronalY} maxSlices={volume.rows} onSlice={setCoronalY}
                                    onClick={onCorClick} crossX={corCX} crossY={corCY}
                                    onExpand={() => onLayoutChange('coronal')} />
                                <ViewPanel meta={VIEWS[2]} canvasRef={sagRef}
                                    slice={sagitalX} maxSlices={volume.cols} onSlice={setSagitalX}
                                    onClick={onSagClick} crossX={sagCX} crossY={sagCY}
                                    onExpand={() => onLayoutChange('sagital')} />
                                <ViewPanel meta={VIEWS[3]} canvasRef={panoRef}
                                    slice={0} maxSlices={1} onSlice={() => { }}
                                    progress={panoPct} onExpand={() => onLayoutChange('panoramica')} />
                            </div>
                        );
                    }

                    const meta = VIEWS.find(x => x.id === layout)!;
                    const refMap: Record<ViewId, React.RefObject<HTMLCanvasElement | null>> = {
                        axial: axRef, coronal: corRef, sagital: sagRef,
                        panoramica: panoRef, mip: mipRef, cefa: cefaRef,
                    };
                    const sliceMap: Record<ViewId, { slice: number; max: number; set: (v: number) => void }> = {
                        axial: { slice: axialZ, max: volume.numFrames, set: setAxialZ },
                        coronal: { slice: coronalY, max: volume.rows, set: setCoronalY },
                        sagital: { slice: sagitalX, max: volume.cols, set: setSagitalX },
                        panoramica: { slice: 0, max: 1, set: () => { } },
                        mip: { slice: 0, max: 1, set: () => { } },
                        cefa: { slice: 0, max: 1, set: () => { } },
                    };
                    const clickMap: Partial<Record<ViewId, (e: React.MouseEvent<HTMLCanvasElement>) => void>> = {
                        axial: onAxClick, coronal: onCorClick, sagital: onSagClick,
                    };
                    const progressMap: Partial<Record<ViewId, number>> = { panoramica: panoPct, mip: mipPct, cefa: cefaPct };
                    const si = sliceMap[layout];
                    return (
                        <div className="h-full" style={{ filter: filterStr }}>
                            <ViewPanel meta={meta} canvasRef={refMap[layout]}
                                slice={si.slice} maxSlices={si.max} onSlice={si.set}
                                onClick={clickMap[layout]} progress={progressMap[layout]}
                                onExpand={() => onLayoutChange('4x')} isExpanded />
                        </div>
                    );
                })()}

                {/* Canvas ocultos para MIP y CEFA */}
                {volume && !loading && !loadErr && layout !== 'mip' && <canvas ref={mipRef} style={{ display: 'none' }} />}
                {volume && !loading && !loadErr && layout !== 'cefa' && <canvas ref={cefaRef} style={{ display: 'none' }} />}
            </div>
        </div>
    );
};

export default CbctViewer;
