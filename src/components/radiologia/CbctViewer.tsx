/**
 * CbctViewer.tsx — Visor CBCT 3D
 *
 * Patrón dos canvas:
 *  - offscreen: renderiza datos DICOM en resolución nativa
 *  - display:   tamaño = contenedor (ResizeObserver), copia desde offscreen con drawImage
 *
 * El display canvas SIEMPRE tiene dimensiones reales → nunca canvas 0×0.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LayoutGrid, Ruler, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    type DicomVolume,
    renderFrame,
    renderCoronal,
    renderSagittal,
    renderPanoramicaAsync,
    renderMIPAsync,
    renderCephalometryAsync,
    DENTAL_PRESETS,
} from '../../services/dicom.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ViewType = 'axial' | 'coronal' | 'sagital' | 'panoramica' | 'mip' | 'cefa';
type Layout   = '4x' | ViewType;

interface RulerLine {
    x1: number; y1: number;   // fracción [0,1] del canvas display
    x2: number; y2: number;
    mm: number;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const LABEL: Record<ViewType, string> = {
    axial: 'Axial', coronal: 'Coronal', sagital: 'Sagital',
    panoramica: 'Panorámica', mip: 'MIP 3D', cefa: 'Cefalometría',
};
const COLOR: Record<ViewType, string> = {
    axial: '#22d3ee', coronal: '#a78bfa', sagital: '#34d399',
    panoramica: '#fbbf24', mip: '#f87171', cefa: '#60a5fa',
};
const IS_SLICE: Record<ViewType, boolean> = {
    axial: true, coronal: true, sagital: true,
    panoramica: false, mip: false, cefa: false,
};

// ── ViewPanel ─────────────────────────────────────────────────────────────────

interface ViewPanelProps {
    volume:      DicomVolume;
    type:        ViewType;
    wc:          number;
    ww:          number;
    rulerActive: boolean;
}

const ViewPanel: React.FC<ViewPanelProps> = ({ volume, type, wc, ww, rulerActive }) => {
    const displayRef   = useRef<HTMLCanvasElement>(null);   // visible, tamaño = contenedor
    const containerRef = useRef<HTMLDivElement>(null);
    const offscreen    = useRef<HTMLCanvasElement>(document.createElement('canvas'));

    const maxSlice = type === 'axial'   ? volume.numFrames - 1
                   : type === 'coronal' ? volume.rows - 1
                   : type === 'sagital' ? volume.cols - 1
                   : 0;

    const [slice,      setSlice]      = useState(Math.floor(maxSlice / 2));
    const [progress,   setProgress]   = useState<number | null>(null);
    const [rulers,     setRulers]     = useState<RulerLine[]>([]);
    const [drawing,    setDrawing]    = useState<{ x: number; y: number } | null>(null);
    const [cursor,     setCursor]     = useState<{ x: number; y: number } | null>(null);
    // Dimensiones nativas del offscreen — para scale bar (actualizado en state para forzar re-render)
    const [nativeW,    setNativeW]    = useState(0);

    // Copia offscreen → display
    const blit = useCallback(() => {
        const display = displayRef.current;
        if (!display || display.width === 0 || display.height === 0) return;
        if (offscreen.current.width === 0 || offscreen.current.height === 0) return;
        const ctx = display.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(offscreen.current, 0, 0, display.width, display.height);
    }, []);

    // ResizeObserver: ajusta display canvas al contenedor y re-copia
    useEffect(() => {
        const container = containerRef.current;
        const display   = displayRef.current;
        if (!container || !display) return;
        const obs = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (!width || !height) return;
            display.width  = Math.round(width);
            display.height = Math.round(height);
            blit();
        });
        obs.observe(container);
        return () => obs.disconnect();
    }, [blit]);

    // Render DICOM → offscreen
    // Para renders async: cleanup flag evita race condition si wc/ww cambia mientras renderiza
    useEffect(() => {
        const off = offscreen.current;
        let cancelled = false;

        if (type === 'axial') {
            off.width  = volume.cols;
            off.height = volume.rows;
            const ctx = off.getContext('2d');
            if (ctx) {
                const imgData = ctx.createImageData(volume.cols, volume.rows);
                renderFrame(volume, slice, wc, ww, imgData);
                ctx.putImageData(imgData, 0, 0);
            }
            setNativeW(off.width);
            blit();

        } else if (type === 'coronal') {
            renderCoronal(volume, slice, wc, ww, off);
            setNativeW(off.width);
            blit();

        } else if (type === 'sagital') {
            renderSagittal(volume, slice, wc, ww, off);
            setNativeW(off.width);
            blit();

        } else if (type === 'panoramica') {
            setProgress(0);
            renderPanoramicaAsync(volume, wc, ww, off, p => {
                if (cancelled) return;
                setProgress(p); blit();
            }).then(() => {
                if (cancelled) return;
                setNativeW(off.width); setProgress(null); blit();
            });

        } else if (type === 'mip') {
            setProgress(0);
            renderMIPAsync(volume, wc, ww, off, 1, p => {
                if (cancelled) return;
                setProgress(p); blit();
            }).then(() => {
                if (cancelled) return;
                setNativeW(off.width); setProgress(null); blit();
            });

        } else if (type === 'cefa') {
            setProgress(0);
            renderCephalometryAsync(volume, wc, ww, off, 1, p => {
                if (cancelled) return;
                setProgress(p); blit();
            }).then(() => {
                if (cancelled) return;
                setNativeW(off.width); setProgress(null); blit();
            });
        }

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [volume, type, slice, wc, ww]);

    // Scroll de slice
    const handleWheel = (e: React.WheelEvent) => {
        if (!IS_SLICE[type]) return;
        e.preventDefault();
        setSlice(s => Math.max(0, Math.min(maxSlice, s + (e.deltaY > 0 ? 1 : -1))));
    };

    // Herramienta regla — coordenadas relativas al display canvas
    const getPos = (e: React.MouseEvent): { x: number; y: number } => {
        const rect = displayRef.current!.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top)  / rect.height,
        };
    };

    const onMouseDown = (e: React.MouseEvent) => { if (rulerActive) setDrawing(getPos(e)); };
    const onMouseMove = (e: React.MouseEvent) => { if (rulerActive) setCursor(getPos(e)); };
    const onMouseUp   = (e: React.MouseEvent) => {
        if (!rulerActive || !drawing) return;
        const end = getPos(e);
        const off = offscreen.current;
        const ps  = volume.pixelSpacing?.[1] ?? 0.3;
        const dx  = (end.x - drawing.x) * off.width  * ps;
        const dy  = (end.y - drawing.y) * off.height * ps;
        const mm  = Math.sqrt(dx * dx + dy * dy);
        setRulers(r => [...r, { x1: drawing.x, y1: drawing.y, x2: end.x, y2: end.y, mm }]);
        setDrawing(null);
    };

    // Scale bar: 10 mm como fracción del ancho del canvas offscreen
    // nativeW es state (no ref) → se actualiza en el effect y fuerza re-render
    const ps        = volume.pixelSpacing?.[1] ?? 0;
    const scaleFrac = ps > 0 && nativeW > 0 ? Math.min(0.35, 10 / (ps * nativeW)) : 0;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#060809', border: '1px solid #1e2535', borderRadius: 6, overflow: 'hidden' }}>

            {/* Label */}
            <div style={{ height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, background: '#0a0c10', borderBottom: '1px solid #1e2535' }}>
                <span style={{ color: COLOR[type], fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
                    {LABEL[type]}
                </span>
                {IS_SLICE[type] && <>
                    <button onClick={() => setSlice(s => Math.max(0, s - 1))}
                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        <ChevronLeft style={{ width: 12, height: 12 }} />
                    </button>
                    <span style={{ color: '#334155', fontSize: 10, minWidth: 48, textAlign: 'center' }}>
                        {slice + 1} / {maxSlice + 1}
                    </span>
                    <button onClick={() => setSlice(s => Math.min(maxSlice, s + 1))}
                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        <ChevronRight style={{ width: 12, height: 12 }} />
                    </button>
                </>}
            </div>

            {/* Contenedor — ResizeObserver mide aquí */}
            <div
                ref={containerRef}
                style={{ flex: 1, minHeight: 0, position: 'relative', background: '#000', cursor: rulerActive ? 'crosshair' : 'default', overflow: 'hidden' }}
                onWheel={handleWheel}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={() => setCursor(null)}
            >
                {/* Display canvas — siempre = tamaño contenedor */}
                <canvas
                    ref={displayRef}
                    style={{ position: 'absolute', inset: 0, display: 'block' }}
                />

                {/* Progress */}
                {progress !== null && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#1e2535', zIndex: 2 }}>
                        <div style={{ height: '100%', width: `${progress * 100}%`, background: '#3b82f6', transition: 'width 0.1s' }} />
                    </div>
                )}

                {/* Scale bar */}
                {scaleFrac > 0 && progress === null && (
                    <div style={{ position: 'absolute', bottom: 8, left: 8, pointerEvents: 'none', zIndex: 2 }}>
                        <div style={{ color: '#e2e8f0', fontSize: 9, fontWeight: 600, marginBottom: 2 }}>10 mm</div>
                        <div style={{ height: 2, width: `${scaleFrac * 100}%`, minWidth: 16, background: '#e2e8f0' }} />
                    </div>
                )}

                {/* SVG regla */}
                {(rulers.length > 0 || (drawing && cursor)) && (
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}>
                        {rulers.map((r, i) => {
                            const x1 = `${r.x1 * 100}%`, y1 = `${r.y1 * 100}%`;
                            const x2 = `${r.x2 * 100}%`, y2 = `${r.y2 * 100}%`;
                            const mx = `${(r.x1 + r.x2) / 2 * 100}%`, my = `${((r.y1 + r.y2) / 2 - 0.04) * 100}%`;
                            return (
                                <g key={i}>
                                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth={1.5} />
                                    <circle cx={x1} cy={y1} r={4} fill="#fbbf24" />
                                    <circle cx={x2} cy={y2} r={4} fill="#fbbf24" />
                                    <text x={mx} y={my} fontSize={11} fill="#fbbf24" textAnchor="middle" fontWeight={700} fontFamily="monospace">
                                        {r.mm.toFixed(1)} mm
                                    </text>
                                </g>
                            );
                        })}
                        {drawing && cursor && (
                            <line
                                x1={`${drawing.x * 100}%`} y1={`${drawing.y * 100}%`}
                                x2={`${cursor.x  * 100}%`} y2={`${cursor.y  * 100}%`}
                                stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="6 3"
                            />
                        )}
                    </svg>
                )}
            </div>
        </div>
    );
};

// ── CbctViewer ────────────────────────────────────────────────────────────────

interface CbctViewerProps {
    volume:   DicomVolume;
    onClose?: () => void;
}

const VIEW_LIST: { id: ViewType; label: string }[] = [
    { id: 'axial',      label: 'Axial'      },
    { id: 'coronal',    label: 'Coronal'    },
    { id: 'sagital',    label: 'Sagital'    },
    { id: 'panoramica', label: 'Panorámica' },
    { id: 'mip',        label: 'MIP 3D'     },
    { id: 'cefa',       label: 'Cef.'       },
];

const CbctViewer: React.FC<CbctViewerProps> = ({ volume, onClose }) => {
    const [layout, setLayout] = useState<Layout>('4x');
    const [wc, setWc]         = useState(volume.defaultWC);
    const [ww, setWw]         = useState(volume.defaultWW);
    const [ruler, setRuler]   = useState(false);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0c10' }}>

            {/* Barra superior */}
            <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, padding: '0 10px', background: '#0d1018', borderBottom: '1px solid #1e2535', overflowX: 'auto' }}>

                <button title="4 paneles" onClick={() => setLayout('4x')} style={{
                    width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer',
                    background: layout === '4x' ? '#1e40af' : 'transparent',
                    color: layout === '4x' ? '#93c5fd' : '#475569',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <LayoutGrid style={{ width: 14, height: 14 }} />
                </button>

                <div style={{ width: 1, height: 20, background: '#1e2535', margin: '0 2px' }} />

                {VIEW_LIST.map(v => (
                    <button key={v.id} onClick={() => setLayout(v.id)} style={{
                        padding: '3px 8px', border: 'none', borderRadius: 5, cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, transition: 'background 0.12s',
                        background: layout === v.id ? '#1e3a5f' : 'transparent',
                        color: layout === v.id ? COLOR[v.id] : '#475569',
                    }}>
                        {v.label}
                    </button>
                ))}

                <div style={{ width: 1, height: 20, background: '#1e2535', margin: '0 2px' }} />

                <span style={{ color: '#475569', fontSize: 10 }}>WC</span>
                <input type="range" min={-1000} max={3000} value={wc} onChange={e => setWc(+e.target.value)}
                    style={{ width: 64, accentColor: '#3b82f6', cursor: 'pointer' }} />
                <span style={{ color: '#64748b', fontSize: 10, minWidth: 36 }}>{wc}</span>

                <span style={{ color: '#475569', fontSize: 10 }}>WW</span>
                <input type="range" min={1} max={4000} value={ww} onChange={e => setWw(+e.target.value)}
                    style={{ width: 64, accentColor: '#3b82f6', cursor: 'pointer' }} />
                <span style={{ color: '#64748b', fontSize: 10, minWidth: 36 }}>{ww}</span>

                {DENTAL_PRESETS.map(p => (
                    <button key={p.name} onClick={() => { setWc(p.wc); setWw(p.ww); }} style={{
                        padding: '2px 7px', border: '1px solid #1e2535', borderRadius: 4,
                        cursor: 'pointer', fontSize: 10, background: '#141820', color: '#64748b',
                    }}>
                        {p.name}
                    </button>
                ))}

                <div style={{ width: 1, height: 20, background: '#1e2535', margin: '0 2px' }} />

                <button onClick={() => setRuler(r => !r)} style={{
                    padding: '3px 8px', border: `1px solid ${ruler ? '#fbbf24' : '#1e2535'}`,
                    borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: ruler ? '#3d2c0a' : 'transparent',
                    color: ruler ? '#fbbf24' : '#475569',
                    display: 'flex', alignItems: 'center', gap: 4,
                }}>
                    <Ruler style={{ width: 12, height: 12 }} /> Regla
                </button>

                <div style={{ flex: 1 }} />

                {onClose && (
                    <button onClick={onClose} style={{ width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X style={{ width: 14, height: 14 }} />
                    </button>
                )}
            </div>

            {/* Viewports */}
            <div style={{ flex: 1, minHeight: 0, padding: 4 }}>
                {layout === '4x' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 4, height: '100%' }}>
                        <ViewPanel volume={volume} type="axial"      wc={wc} ww={ww} rulerActive={ruler} />
                        <ViewPanel volume={volume} type="coronal"    wc={wc} ww={ww} rulerActive={ruler} />
                        <ViewPanel volume={volume} type="panoramica" wc={wc} ww={ww} rulerActive={ruler} />
                        <ViewPanel volume={volume} type="mip"        wc={wc} ww={ww} rulerActive={ruler} />
                    </div>
                ) : (
                    <div style={{ height: '100%' }}>
                        <ViewPanel volume={volume} type={layout as ViewType} wc={wc} ww={ww} rulerActive={ruler} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CbctViewer;
