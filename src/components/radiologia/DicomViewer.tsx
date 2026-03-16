/**
 * DicomViewer.tsx — Visor DICOM dental completo con Cornerstone3D
 *
 * Funcionalidades:
 *  · Carga archivos .dcm / imágenes desde File prop
 *  · Window/Level DICOM real (arrastrar botón izquierdo)
 *  · Zoom (botón derecho), Pan (botón central), Scroll entre slices (rueda)
 *  · Medición: Regla (mm), Ángulo, Cobb, ROI Rect/Elipse/Círculo
 *  · Anotación con flecha, Magnificador, Valor HU
 *  · Inversión, Rotación, Flip H/V
 *  · Reset W/L y reset completo
 *  · Borrar todas las anotaciones
 *  · Keyboard shortcuts: W/L, Z, P...
 */

import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import { RenderingEngine, Enums, type Types } from '@cornerstonejs/core';
import {
    ToolGroupManager, Enums as ToolEnums, annotation,
    WindowLevelTool, ZoomTool, PanTool,
    LengthTool, AngleTool, CobbAngleTool,
    RectangleROITool, EllipticalROITool, CircleROITool,
    ArrowAnnotateTool, MagnifyTool, StackScrollTool,
    ProbeTool,
} from '@cornerstonejs/tools';
import { initCornerstone } from '../../services/cornerstone.init';

// ── Tipos ──────────────────────────────────────────────────────────────────────

type ActiveTool =
    | 'WindowLevel' | 'Zoom' | 'Pan' | 'StackScroll'
    | 'Length' | 'Angle' | 'CobbAngle'
    | 'RectangleROI' | 'EllipticalROI' | 'CircleROI'
    | 'ArrowAnnotate' | 'Magnify' | 'Probe';

interface DicomViewerProps {
    file?: File | null;
    onClose?: () => void;
}

// ── Configuración de herramientas ──────────────────────────────────────────────

const TOOL_CONFIG: { id: ActiveTool; label: string; icon: string; group: 'view' | 'measure' }[] = [
    { id: 'WindowLevel',   label: 'W/L',        icon: '◑',  group: 'view'    },
    { id: 'Zoom',          label: 'Zoom',        icon: '🔍', group: 'view'    },
    { id: 'Pan',           label: 'Pan',         icon: '✋', group: 'view'    },
    { id: 'StackScroll',   label: 'Scroll',      icon: '⇅',  group: 'view'    },
    { id: 'Magnify',       label: 'Lupa',        icon: '⊕',  group: 'view'    },
    { id: 'Probe',         label: 'HU',          icon: '⬤',  group: 'measure' },
    { id: 'Length',        label: 'Regla',       icon: '📏', group: 'measure' },
    { id: 'Angle',         label: 'Ángulo',      icon: '∠',  group: 'measure' },
    { id: 'CobbAngle',     label: 'Cobb',        icon: '∡',  group: 'measure' },
    { id: 'RectangleROI',  label: 'ROI □',       icon: '⬜', group: 'measure' },
    { id: 'EllipticalROI', label: 'ROI ○',       icon: '⭕', group: 'measure' },
    { id: 'CircleROI',     label: 'ROI ◉',       icon: '○',  group: 'measure' },
    { id: 'ArrowAnnotate', label: 'Flecha',      icon: '➤',  group: 'measure' },
];

const TOOL_NAME: Record<ActiveTool, string> = {
    WindowLevel:   WindowLevelTool.toolName,
    Zoom:          ZoomTool.toolName,
    Pan:           PanTool.toolName,
    StackScroll:   StackScrollTool.toolName,
    Magnify:       MagnifyTool.toolName,
    Probe:         ProbeTool.toolName,
    Length:        LengthTool.toolName,
    Angle:         AngleTool.toolName,
    CobbAngle:     CobbAngleTool.toolName,
    RectangleROI:  RectangleROITool.toolName,
    EllipticalROI: EllipticalROITool.toolName,
    CircleROI:     CircleROITool.toolName,
    ArrowAnnotate: ArrowAnnotateTool.toolName,
};

// Herramientas con binding fijo (nunca se cambian al clic izquierdo)
const FIXED_TOOLS = new Set<ActiveTool>(['Pan', 'Zoom', 'StackScroll']);

// ── Componente ─────────────────────────────────────────────────────────────────

const DicomViewer: React.FC<DicomViewerProps> = ({ file, onClose }) => {
    const uid = useId().replace(/:/g, '');
    const viewportId  = `vp-${uid}`;
    const engineId    = `eng-${uid}`;
    const toolGroupId = `tg-${uid}`;

    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef    = useRef<RenderingEngine | null>(null);
    const blobRef      = useRef<string | null>(null);

    const [ready,      setReady]      = useState(false);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState<ActiveTool>('WindowLevel');
    const [sliceIdx,   setSliceIdx]   = useState(0);
    const [sliceTotal, setSliceTotal] = useState(0);
    const [invert,     setInvert]     = useState(false);
    const [rotation,   setRotation]   = useState(0);
    const [flipH,      setFlipH]      = useState(false);
    const [flipV,      setFlipV]      = useState(false);

    // ── Inicialización ────────────────────────────────────────────────────────

    useEffect(() => {
        let cancelled = false;

        async function setup() {
            if (!containerRef.current) return;
            try {
                setLoading(true);
                setError(null);

                await initCornerstone();
                if (cancelled) return;

                // RenderingEngine
                const engine = new RenderingEngine(engineId);
                engineRef.current = engine;

                engine.setViewports([{
                    viewportId,
                    type: Enums.ViewportType.STACK,
                    element: containerRef.current as HTMLDivElement,
                    defaultOptions: { background: [0, 0, 0] as Types.Point3 },
                }]);

                // Tool group
                const tg = ToolGroupManager.createToolGroup(toolGroupId)!;
                tg.addViewport(viewportId, engineId);

                Object.values(TOOL_NAME).forEach(name => {
                    try { tg.addTool(name); } catch {}
                });

                // Bindings por defecto:
                //  · Izquierdo → W/L
                //  · Central   → Pan
                //  · Derecho   → Zoom
                //  · Rueda     → Scroll
                tg.setToolActive(TOOL_NAME.WindowLevel, {
                    bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
                });
                tg.setToolActive(TOOL_NAME.Pan, {
                    bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }],
                });
                tg.setToolActive(TOOL_NAME.Zoom, {
                    bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }],
                });
                tg.setToolActive(TOOL_NAME.StackScroll, {
                    bindings: [{ mouseButton: ToolEnums.MouseBindings.Wheel }],
                });

                // Resto en pasivo
                (['Length', 'Angle', 'CobbAngle', 'RectangleROI', 'EllipticalROI',
                    'CircleROI', 'ArrowAnnotate', 'Probe', 'Magnify'] as ActiveTool[])
                    .forEach(t => { try { tg.setToolPassive(TOOL_NAME[t]); } catch {} });

                if (cancelled) return;
                setReady(true);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : String(err));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        setup();

        return () => {
            cancelled = true;
            try { ToolGroupManager.destroyToolGroup(toolGroupId); } catch {}
            try { engineRef.current?.destroy(); } catch {}
            engineRef.current = null;
            if (blobRef.current) {
                try { URL.revokeObjectURL(blobRef.current); } catch {}
                blobRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Carga de imagen cuando cambia el file ─────────────────────────────────

    useEffect(() => {
        if (!ready || !engineRef.current || !file) return;

        async function load() {
            setLoading(true);
            try {
                // Liberar blob anterior
                if (blobRef.current) {
                    URL.revokeObjectURL(blobRef.current);
                    blobRef.current = null;
                }

                const blobUrl = URL.createObjectURL(file!);
                blobRef.current = blobUrl;
                const imageId = `wadouri:${blobUrl}`;

                const vp = engineRef.current!.getViewport(viewportId) as Types.IStackViewport;
                await vp.setStack([imageId], 0);
                vp.render();

                setSliceIdx(0);
                setSliceTotal(1);
                setInvert(false);
                setRotation(0);
                setFlipH(false);
                setFlipV(false);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al cargar la imagen');
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [file, ready, viewportId]);

    // ── Cambio de herramienta ─────────────────────────────────────────────────

    const handleToolChange = useCallback((tool: ActiveTool) => {
        if (FIXED_TOOLS.has(tool)) return;
        const tg = ToolGroupManager.getToolGroup(toolGroupId);
        if (!tg) return;
        // Desactivar anterior
        if (!FIXED_TOOLS.has(activeTool)) {
            try { tg.setToolPassive(TOOL_NAME[activeTool]); } catch {}
        }
        // Activar nuevo en clic izquierdo
        tg.setToolActive(TOOL_NAME[tool], {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
        });
        setActiveTool(tool);
    }, [activeTool, toolGroupId]);

    // ── Transformaciones ──────────────────────────────────────────────────────

    const applyProps = useCallback((r: number, h: boolean, v: boolean, inv: boolean) => {
        const vp = engineRef.current?.getViewport(viewportId) as Types.IStackViewport | undefined;
        if (!vp) return;
        vp.setProperties({ rotation: r, hflip: h, vflip: v, invert: inv });
        vp.render();
    }, [viewportId]);

    const handleRotate = () => { const r = (rotation + 90) % 360; setRotation(r); applyProps(r, flipH, flipV, invert); };
    const handleFlipH  = () => { const v = !flipH;  setFlipH(v);  applyProps(rotation, v, flipV, invert); };
    const handleFlipV  = () => { const v = !flipV;  setFlipV(v);  applyProps(rotation, flipH, v, invert); };
    const handleInvert = () => { const v = !invert; setInvert(v); applyProps(rotation, flipH, flipV, v);   };

    const handleReset = () => {
        const vp = engineRef.current?.getViewport(viewportId) as Types.IStackViewport | undefined;
        if (!vp) return;
        vp.resetCamera();
        vp.resetProperties();
        vp.render();
        setRotation(0); setFlipH(false); setFlipV(false); setInvert(false);
    };

    const handleResetWL = () => {
        const vp = engineRef.current?.getViewport(viewportId) as Types.IStackViewport | undefined;
        if (!vp) return;
        vp.resetProperties();
        vp.render();
    };

    const handleClearAnnotations = () => {
        annotation.state.removeAllAnnotations();
        engineRef.current?.renderViewports([viewportId]);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#060809' }}>

            {/* Toolbar */}
            <div style={{
                flexShrink: 0, height: 44,
                display: 'flex', alignItems: 'center', gap: 2,
                padding: '0 8px', background: '#0d1018',
                borderBottom: '1px solid #1e2535', overflowX: 'auto',
            }}>
                {(['view', 'measure'] as const).map(group => (
                    <React.Fragment key={group}>
                        {group === 'measure' && (
                            <div style={{ width: 1, height: 22, background: '#1e2535', margin: '0 4px', flexShrink: 0 }} />
                        )}
                        {TOOL_CONFIG.filter(t => t.group === group).map(t => (
                            <button key={t.id} title={t.label}
                                onClick={() => handleToolChange(t.id)}
                                style={{
                                    width: 34, height: 34, border: 'none', borderRadius: 6,
                                    cursor: FIXED_TOOLS.has(t.id) ? 'default' : 'pointer',
                                    flexShrink: 0, fontSize: 14,
                                    background: activeTool === t.id ? '#1e40af' : 'transparent',
                                    color: activeTool === t.id ? '#93c5fd'
                                        : FIXED_TOOLS.has(t.id) ? '#334155' : '#64748b',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 0.12s',
                                }}>
                                {t.icon}
                            </button>
                        ))}
                    </React.Fragment>
                ))}

                <div style={{ width: 1, height: 22, background: '#1e2535', margin: '0 4px', flexShrink: 0 }} />

                {/* Transformaciones */}
                {[
                    { title: 'Rotar 90°',         icon: '↻', fn: handleRotate, active: rotation !== 0 },
                    { title: 'Voltear horizontal', icon: '⇆', fn: handleFlipH,  active: flipH           },
                    { title: 'Voltear vertical',   icon: '⇅', fn: handleFlipV,  active: flipV           },
                    { title: 'Invertir colores',   icon: '⊘', fn: handleInvert, active: invert          },
                ].map(({ title, icon, fn, active }) => (
                    <button key={title} title={title} onClick={fn} style={{
                        width: 34, height: 34, border: 'none', borderRadius: 6,
                        cursor: 'pointer', flexShrink: 0, fontSize: 14,
                        background: active ? '#1e3a5f' : 'transparent',
                        color: active ? '#38bdf8' : '#64748b',
                    }}>
                        {icon}
                    </button>
                ))}

                <div style={{ width: 1, height: 22, background: '#1e2535', margin: '0 4px', flexShrink: 0 }} />

                <button title="Restablecer Window/Level" onClick={handleResetWL}
                    style={{ height: 28, padding: '0 8px', border: '1px solid #1e2535', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#64748b', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    W/L ↺
                </button>
                <button title="Resetear vista completa" onClick={handleReset}
                    style={{ height: 28, padding: '0 8px', border: '1px solid #1e2535', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#64748b', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    Reset
                </button>
                <button title="Borrar todas las anotaciones" onClick={handleClearAnnotations}
                    style={{ height: 28, padding: '0 8px', border: '1px solid #1e2535', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#ef4444', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    Borrar medidas
                </button>

                {sliceTotal > 1 && (
                    <div style={{ marginLeft: 'auto', color: '#475569', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {sliceIdx + 1} / {sliceTotal}
                    </div>
                )}

                {onClose && (
                    <button onClick={onClose} style={{ marginLeft: 'auto', width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#64748b', fontSize: 16, flexShrink: 0 }}>
                        ✕
                    </button>
                )}
            </div>

            {/* Viewport */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>

                {/* Canvas de Cornerstone — siempre montado */}
                <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

                {/* Hint controles */}
                {ready && !loading && !error && (
                    <div style={{ position: 'absolute', bottom: 8, left: 10, color: '#334155', fontSize: 10, pointerEvents: 'none' }}>
                        Izq=W/L · Centro=Pan · Der=Zoom · Rueda=Scroll
                    </div>
                )}

                {/* Herramienta activa */}
                {ready && !loading && !error && (
                    <div style={{ position: 'absolute', top: 8, right: 10, color: '#475569', fontSize: 10, pointerEvents: 'none' }}>
                        {TOOL_CONFIG.find(t => t.id === activeTool)?.label}
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#060809dd', gap: 12 }}>
                        <div style={{ width: 36, height: 36, border: '3px solid #1e2535', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span style={{ color: '#475569', fontSize: 12 }}>Cargando imagen…</span>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {/* Error */}
                {error && !loading && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#060809', gap: 8, padding: 24, textAlign: 'center' }}>
                        <span style={{ fontSize: 32 }}>⚠️</span>
                        <p style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>Error al cargar la imagen</p>
                        <p style={{ color: '#475569', fontSize: 11 }}>{error}</p>
                    </div>
                )}

                {/* Sin archivo */}
                {!loading && !error && !file && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#334155', gap: 8 }}>
                        <span style={{ fontSize: 40 }}>🦷</span>
                        <p style={{ fontSize: 13 }}>Importa un archivo .dcm para visualizarlo</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DicomViewer;
