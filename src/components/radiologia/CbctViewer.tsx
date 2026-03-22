/**
 * CbctViewer.tsx — Visor CBCT 3D
 *
 * Patrón dos canvas:
 *  - offscreen: renderiza datos DICOM en resolución nativa
 *  - display:   tamaño = contenedor (ResizeObserver), blit con letterbox (aspect ratio correcto)
 *
 * Todos los overlays (arco, regla, scale bar) se posicionan sobre el rect real de la imagen,
 * no sobre el contenedor completo.
 *
 * Panorámica con arco personalizado:
 *  - Activa "Arco", haz click en Axial para colocar puntos de control (spline Catmull-Rom)
 *  - La vista Panorámica re-renderiza siguiendo el arco con MIP perpendicular
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { LayoutGrid, Ruler, X, ChevronLeft, ChevronRight, Activity, Trash2 } from 'lucide-react';
import {
    type DicomVolume,
    renderFrame,
    renderCoronal,
    renderSagittal,
    renderPanoramicaAsync,
    renderArchPanoramicaAsync,
    renderMIPAsync,
    renderCephalometryAsync,
    sampleArchSpline,
    DENTAL_PRESETS,
} from '../../services/dicom.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ViewType = 'axial' | 'coronal' | 'sagital' | 'panoramica' | 'mip' | 'cefa';
type Layout   = '4x' | ViewType;

interface RulerLine {
    x1: number; y1: number;   // fracción [0,1] relativa al área de imagen
    x2: number; y2: number;
    mm: number;
}

interface ImgRect { x: number; y: number; w: number; h: number; }

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
    volume:       DicomVolume;
    type:         ViewType;
    wc:           number;
    ww:           number;
    rulerActive:  boolean;
    archControls: Array<[number, number]>;
    archMode:     boolean;
    slabPx:       number;
    onArchAdd:    (pt: [number, number]) => void;
}

const ViewPanel: React.FC<ViewPanelProps> = ({
    volume, type, wc, ww, rulerActive,
    archControls, archMode, slabPx, onArchAdd,
}) => {
    const displayRef   = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const offscreen    = useRef<HTMLCanvasElement>(document.createElement('canvas'));

    const maxSlice = type === 'axial'   ? volume.numFrames - 1
                   : type === 'coronal' ? volume.rows - 1
                   : type === 'sagital' ? volume.cols - 1
                   : 0;

    const [slice,       setSlice]       = useState(Math.floor(maxSlice / 2));
    const [progress,    setProgress]    = useState<number | null>(null);
    const [rulers,      setRulers]      = useState<RulerLine[]>([]);
    const [drawing,     setDrawing]     = useState<{ x: number; y: number } | null>(null);
    const [cursor,      setCursor]      = useState<{ x: number; y: number } | null>(null);
    const [nativeW,     setNativeW]     = useState(0);
    const [nativeH,     setNativeH]     = useState(0);
    const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

    // Rect donde la imagen se muestra dentro del display canvas (letterbox)
    const imgRect: ImgRect = useMemo(() => {
        if (!displaySize.w || !displaySize.h || !nativeW || !nativeH)
            return { x: 0, y: 0, w: displaySize.w || 0, h: displaySize.h || 0 };
        const scale = Math.min(displaySize.w / nativeW, displaySize.h / nativeH);
        const dw = Math.round(nativeW * scale);
        const dh = Math.round(nativeH * scale);
        return {
            x: Math.round((displaySize.w - dw) / 2),
            y: Math.round((displaySize.h - dh) / 2),
            w: dw, h: dh,
        };
    }, [displaySize, nativeW, nativeH]);

    // Copia offscreen → display con letterbox (mantiene aspect ratio)
    const blit = useCallback(() => {
        const display = displayRef.current;
        if (!display || display.width === 0 || display.height === 0) return;
        const off = offscreen.current;
        if (off.width === 0 || off.height === 0) return;
        const ctx = display.getContext('2d');
        if (!ctx) return;
        const scale = Math.min(display.width / off.width, display.height / off.height);
        const dw = Math.round(off.width  * scale);
        const dh = Math.round(off.height * scale);
        const dx = Math.round((display.width  - dw) / 2);
        const dy = Math.round((display.height - dh) / 2);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, display.width, display.height);
        ctx.drawImage(off, dx, dy, dw, dh);
    }, []);

    // ResizeObserver
    useEffect(() => {
        const container = containerRef.current;
        const display   = displayRef.current;
        if (!container || !display) return;
        const obs = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (!width || !height) return;
            display.width  = Math.round(width);
            display.height = Math.round(height);
            setDisplaySize({ w: Math.round(width), h: Math.round(height) });
            blit();
        });
        obs.observe(container);
        return () => obs.disconnect();
    }, [blit]);

    // Render DICOM → offscreen
    useEffect(() => {
        const off = offscreen.current;
        let cancelled = false;

        const done = () => {
            if (cancelled) return;
            setNativeW(off.width);
            setNativeH(off.height);
            setProgress(null);
            blit();
        };

        if (type === 'axial') {
            off.width  = volume.cols;
            off.height = volume.rows;
            const ctx = off.getContext('2d');
            if (ctx) {
                const imgData = ctx.createImageData(volume.cols, volume.rows);
                renderFrame(volume, slice, wc, ww, imgData);
                ctx.putImageData(imgData, 0, 0);
            }
            done();

        } else if (type === 'coronal') {
            renderCoronal(volume, slice, wc, ww, off);
            done();

        } else if (type === 'sagital') {
            renderSagittal(volume, slice, wc, ww, off);
            done();

        } else if (type === 'panoramica') {
            setProgress(0);
            const promise = archControls.length >= 2
                ? renderArchPanoramicaAsync(volume, archControls, slabPx, wc, ww, off, p => {
                      if (cancelled) return; setProgress(p); blit();
                  })
                : renderPanoramicaAsync(volume, wc, ww, off, p => {
                      if (cancelled) return; setProgress(p); blit();
                  });
            promise.then(done);

        } else if (type === 'mip') {
            setProgress(0);
            renderMIPAsync(volume, wc, ww, off, 1, p => {
                if (cancelled) return; setProgress(p); blit();
            }).then(done);

        } else if (type === 'cefa') {
            setProgress(0);
            renderCephalometryAsync(volume, wc, ww, off, 1, p => {
                if (cancelled) return; setProgress(p); blit();
            }).then(done);
        }

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [volume, type, slice, wc, ww, archControls, slabPx]);

    // Scroll de slice
    const handleWheel = (e: React.WheelEvent) => {
        if (!IS_SLICE[type]) return;
        e.preventDefault();
        setSlice(s => Math.max(0, Math.min(maxSlice, s + (e.deltaY > 0 ? 1 : -1))));
    };

    // Coordenadas relativas al ÁREA DE IMAGEN (fracciones [0,1])
    // Tiene en cuenta el letterbox — coordenadas fuera de la imagen se clampean al borde
    const getPos = (e: React.MouseEvent): { x: number; y: number } => {
        const rect = displayRef.current!.getBoundingClientRect();
        const px = (e.clientX - rect.left) - imgRect.x;
        const py = (e.clientY - rect.top)  - imgRect.y;
        return {
            x: Math.max(0, Math.min(1, px / (imgRect.w || 1))),
            y: Math.max(0, Math.min(1, py / (imgRect.h || 1))),
        };
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (type === 'axial' && archMode) {
            const frac = getPos(e);
            onArchAdd([
                Math.round(frac.x * volume.cols),
                Math.round(frac.y * volume.rows),
            ]);
            return;
        }
        if (rulerActive) setDrawing(getPos(e));
    };
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

    // Scale bar: 10 mm como fracción del ancho nativo
    const ps        = volume.pixelSpacing?.[1] ?? 0;
    const scaleFrac = ps > 0 && nativeW > 0 ? Math.min(0.35, 10 / (ps * nativeW)) : 0;

    // Spline del arco (coords en espacio del volumen para el viewBox)
    const archSplineD: string | null = (() => {
        if (type !== 'axial' || archControls.length < 2) return null;
        const pts = sampleArchSpline(archControls, archControls.length * 20);
        return pts.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`
        ).join(' ');
    })();

    const activeCursor = (type === 'axial' && archMode) ? 'crosshair'
                       : rulerActive ? 'crosshair'
                       : 'default';

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#060809', border: '1px solid #1e2535', borderRadius: 6, overflow: 'hidden' }}>

            {/* Label */}
            <div style={{ height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, background: '#0a0c10', borderBottom: '1px solid #1e2535' }}>
                <span style={{ color: COLOR[type], fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
                    {LABEL[type]}
                    {type === 'panoramica' && archControls.length >= 2 && (
                        <span style={{ color: '#22d3ee', fontSize: 9, marginLeft: 6, fontWeight: 400, textTransform: 'none' }}>
                            — arco ({archControls.length} pts)
                        </span>
                    )}
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
                style={{ flex: 1, minHeight: 0, position: 'relative', background: '#000', cursor: activeCursor, overflow: 'hidden' }}
                onWheel={handleWheel}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={() => setCursor(null)}
            >
                {/* Display canvas */}
                <canvas ref={displayRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />

                {/* Progress bar */}
                {progress !== null && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#1e2535', zIndex: 2 }}>
                        <div style={{ height: '100%', width: `${progress * 100}%`, background: '#3b82f6', transition: 'width 0.1s' }} />
                    </div>
                )}

                {/* ── Overlays posicionados sobre el área real de la imagen (letterbox) ── */}
                {imgRect.w > 0 && imgRect.h > 0 && (
                    <div style={{
                        position: 'absolute',
                        left: imgRect.x, top: imgRect.y,
                        width: imgRect.w, height: imgRect.h,
                        pointerEvents: 'none', zIndex: 3,
                    }}>
                        {/* Scale bar */}
                        {scaleFrac > 0 && progress === null && (
                            <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
                                <div style={{ color: '#e2e8f0', fontSize: 9, fontWeight: 600, marginBottom: 2 }}>10 mm</div>
                                <div style={{ height: 2, width: `${scaleFrac * 100}%`, minWidth: 16, background: '#e2e8f0' }} />
                            </div>
                        )}

                        {/* Hint modo arco */}
                        {type === 'axial' && archMode && (
                            <div style={{ position: 'absolute', top: 6, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                                <span style={{ background: '#0c4a6e99', color: '#7dd3fc', fontSize: 10, padding: '2px 10px', borderRadius: 4 }}>
                                    Click para añadir puntos del arco dental
                                </span>
                            </div>
                        )}

                        {/* Arco dental sobre vista axial — SVG con viewBox = espacio del volumen */}
                        {type === 'axial' && archControls.length > 0 && (
                            <svg
                                viewBox={`0 0 ${volume.cols} ${volume.rows}`}
                                preserveAspectRatio="none"
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                            >
                                {archSplineD && (
                                    <path d={archSplineD} stroke="#22d3ee" strokeWidth={2} fill="none" opacity={0.9} />
                                )}
                                {archControls.map((p, i) => (
                                    <circle
                                        key={i}
                                        cx={p[0]} cy={p[1]}
                                        r={i === 0 || i === archControls.length - 1 ? 5 : 4}
                                        fill={i === 0 ? '#22d3ee' : i === archControls.length - 1 ? '#f59e0b' : '#38bdf8'}
                                        stroke="#0c4a6e" strokeWidth={1} opacity={0.95}
                                    />
                                ))}
                                {archControls.length > 1 && (() => {
                                    const last = archControls[archControls.length - 1];
                                    return (
                                        <text x={last[0] + 6} y={last[1] + 4} fontSize={16} fill="#f59e0b" fontWeight={700} opacity={0.9}>
                                            {archControls.length}
                                        </text>
                                    );
                                })()}
                            </svg>
                        )}

                        {/* Regla */}
                        {(rulers.length > 0 || (drawing && cursor)) && (
                            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                                {rulers.map((r, i) => {
                                    const x1 = `${r.x1 * 100}%`, y1 = `${r.y1 * 100}%`;
                                    const x2 = `${r.x2 * 100}%`, y2 = `${r.y2 * 100}%`;
                                    const mx = `${(r.x1 + r.x2) / 2 * 100}%`;
                                    const my = `${((r.y1 + r.y2) / 2 - 0.04) * 100}%`;
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
    const [layout,       setLayout]       = useState<Layout>('4x');
    const [wc, setWc]                     = useState(volume.defaultWC);
    const [ww, setWw]                     = useState(volume.defaultWW);
    const [ruler,        setRuler]        = useState(false);
    const [archMode,     setArchMode]     = useState(false);
    const [archControls, setArchControls] = useState<Array<[number, number]>>([]);
    const [slabPx,       setSlabPx]       = useState(20);

    const addArchPoint = useCallback((pt: [number, number]) => {
        setArchControls(prev => [...prev, pt]);
    }, []);

    const clearArch = () => {
        setArchControls([]);
        setArchMode(false);
    };

    const toggleArchMode = () => {
        setArchMode(m => { if (!m) setRuler(false); return !m; });
    };
    const toggleRuler = () => {
        setRuler(r => { if (!r) setArchMode(false); return !r; });
    };

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

                {/* Herramienta arco dental */}
                <button
                    title="Definir arco dental en vista Axial para panorámica personalizada"
                    onClick={toggleArchMode}
                    style={{
                        padding: '3px 8px', border: `1px solid ${archMode ? '#22d3ee' : '#1e2535'}`,
                        borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        background: archMode ? '#0c4a6e' : 'transparent',
                        color: archMode ? '#22d3ee' : '#475569',
                        display: 'flex', alignItems: 'center', gap: 4,
                    }}
                >
                    <Activity style={{ width: 12, height: 12 }} />
                    Arco
                    {archControls.length > 0 && (
                        <span style={{
                            background: '#0e7490', color: '#e0f2fe',
                            borderRadius: 8, padding: '0 5px', fontSize: 9, fontWeight: 700,
                        }}>
                            {archControls.length}
                        </span>
                    )}
                </button>

                {archControls.length > 0 && (
                    <>
                        <span style={{ color: '#475569', fontSize: 10, marginLeft: 2 }}>Slab</span>
                        <input
                            type="range" min={5} max={80} value={slabPx}
                            onChange={e => setSlabPx(+e.target.value)}
                            style={{ width: 50, accentColor: '#22d3ee', cursor: 'pointer' }}
                            title={`Grosor del slab: ${slabPx} px`}
                        />
                        <span style={{ color: '#64748b', fontSize: 10, minWidth: 24 }}>{slabPx}</span>
                        <button
                            title="Borrar arco"
                            onClick={clearArch}
                            style={{
                                width: 24, height: 24, border: 'none', borderRadius: 4,
                                cursor: 'pointer', background: 'transparent',
                                color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                    </>
                )}

                <div style={{ width: 1, height: 20, background: '#1e2535', margin: '0 2px' }} />

                <button onClick={toggleRuler} style={{
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
                    <button onClick={onClose} style={{
                        width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer',
                        background: 'transparent', color: '#475569',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <X style={{ width: 14, height: 14 }} />
                    </button>
                )}
            </div>

            {/* Viewports */}
            <div style={{ flex: 1, minHeight: 0, padding: 4 }}>
                {layout === '4x' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 4, height: '100%' }}>
                        <ViewPanel volume={volume} type="axial"      wc={wc} ww={ww} rulerActive={ruler}
                            archControls={archControls} archMode={archMode} slabPx={slabPx} onArchAdd={addArchPoint} />
                        <ViewPanel volume={volume} type="coronal"    wc={wc} ww={ww} rulerActive={ruler}
                            archControls={archControls} archMode={false}    slabPx={slabPx} onArchAdd={addArchPoint} />
                        <ViewPanel volume={volume} type="panoramica" wc={wc} ww={ww} rulerActive={ruler}
                            archControls={archControls} archMode={false}    slabPx={slabPx} onArchAdd={addArchPoint} />
                        <ViewPanel volume={volume} type="mip"        wc={wc} ww={ww} rulerActive={ruler}
                            archControls={archControls} archMode={false}    slabPx={slabPx} onArchAdd={addArchPoint} />
                    </div>
                ) : (
                    <div style={{ height: '100%' }}>
                        <ViewPanel
                            volume={volume} type={layout as ViewType} wc={wc} ww={ww} rulerActive={ruler}
                            archControls={archControls}
                            archMode={layout === 'axial' ? archMode : false}
                            slabPx={slabPx}
                            onArchAdd={addArchPoint}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CbctViewer;
