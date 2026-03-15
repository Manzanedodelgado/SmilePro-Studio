/**
 * RadiologiaViewer.tsx
 * Visor 2D para radiografías y fotografías clínicas.
 *
 * Herramientas:
 *  - Pan / Zoom (rueda)
 *  - W/L (clic derecho arrastrar)
 *  - Regla (2 puntos → distancia en px)
 *  - Ángulo (3 puntos → ángulo en °)
 *  - ROI Rectángulo / Elipse (arrastrar)
 *  - Flecha + Texto
 *  - Invertir / FlipH / FlipV / Rotar
 *
 * Mediciones en SVG overlay sobre la imagen.
 */

import React, {
    useRef, useState, useEffect, useCallback, useMemo,
} from 'react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type MeasureTool =
    | 'select' | 'pan' | 'wl'
    | 'ruler' | 'angle' | 'roiRect' | 'roiEllipse'
    | 'arrow' | 'text';

export interface MeasurePoint { x: number; y: number; } // % respecto al visor

export interface Measurement {
    id: string;
    tool: MeasureTool;
    points: MeasurePoint[];
    label?: string;
    color: string;
    completed: boolean;
}

interface Props {
    url: string | null;
    tool: MeasureTool;
    measurements: Measurement[];
    onMeasurementsChange: (m: Measurement[]) => void;
    // Ajustes de imagen
    brightness: number;   // -100..100
    contrast: number;     // -100..100
    sharpness?: number;
    colorMap?: string;
    invert?: boolean;
    flipH?: boolean;
    flipV?: boolean;
    rotation?: number;    // 0|90|180|270
    // W/L export
    onWLChange?: (wc: number, ww: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const uid = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const dist = (a: MeasurePoint, b: MeasurePoint, W: number, H: number) =>
    Math.sqrt(((b.x - a.x) * W / 100) ** 2 + ((b.y - a.y) * H / 100) ** 2);

const angleDeg = (a: MeasurePoint, v: MeasurePoint, b: MeasurePoint) => {
    const ax = a.x - v.x, ay = a.y - v.y;
    const bx = b.x - v.x, by = b.y - v.y;
    const cos = (ax * bx + ay * by) / (Math.sqrt(ax * ax + ay * ay) * Math.sqrt(bx * bx + by * by) + 1e-9);
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ── SVG Measurement Overlay ───────────────────────────────────────────────────

const MeasureSVG: React.FC<{
    measurements: Measurement[];
    current: Measurement | null;
    W: number; H: number;
    onDelete: (id: string) => void;
}> = React.memo(({ measurements, current, W, H, onDelete }) => {
    const toSvg = (p: MeasurePoint) => ({ x: (p.x * W) / 100, y: (p.y * H) / 100 });

    const renderMeasurement = (m: Measurement, ghost = false) => {
        const col = ghost ? '#FFD70088' : m.color;
        const pts = m.points.map(toSvg);
        const key = m.id;

        // Estilo compartido para los botones ✕ — pointerEvents: all sobreescribe el 'none' del SVG padre
        const delStyle: React.CSSProperties = { cursor: 'pointer', pointerEvents: 'all' };

        if (m.tool === 'ruler' && pts.length >= 2) {
            const d = dist(m.points[0], m.points[1], W, H).toFixed(1);
            const mx = (pts[0].x + pts[1].x) / 2;
            const my = (pts[0].y + pts[1].y) / 2 - 8;
            return (
                <g key={key}>
                    <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y}
                        stroke={col} strokeWidth={1.5} strokeDasharray={ghost ? '4 3' : 'none'} />
                    {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={col} />)}
                    {m.completed && <text x={mx} y={my} fill={col} fontSize={11} fontWeight="bold"
                        stroke="#000" strokeWidth={0.3} textAnchor="middle">{d} px</text>}
                    {m.completed && <text x={mx + 1} y={my - 1} fill={col} fontSize={11} fontWeight="bold"
                        textAnchor="middle">{d} px</text>}
                    {m.completed && !ghost && (
                        <text x={pts[1].x + 6} y={pts[1].y - 4} fill="#ff4444" fontSize={12}
                            style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                </g>
            );
        }

        if (m.tool === 'angle' && pts.length >= 2) {
            const v = pts[0], a = pts[1], b = pts[2];
            const ang = pts.length === 3 ? angleDeg(m.points[1], m.points[0], m.points[2]).toFixed(1) : '…';
            return (
                <g key={key}>
                    {pts.length >= 2 && <line x1={v.x} y1={v.y} x2={a.x} y2={a.y} stroke={col} strokeWidth={1.5} />}
                    {pts.length >= 3 && <line x1={v.x} y1={v.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={1.5} />}
                    {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={col} />)}
                    {m.completed && <text x={v.x + 8} y={v.y - 6} fill={col} fontSize={11} fontWeight="bold"
                        stroke="#000" strokeWidth={0.3}>{ang}°</text>}
                    {m.completed && !ghost && (
                        <text x={v.x + 8} y={v.y + 14} fill="#ff4444" fontSize={12}
                            style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                </g>
            );
        }

        if (m.tool === 'roiRect' && pts.length >= 2) {
            const x = Math.min(pts[0].x, pts[1].x), y = Math.min(pts[0].y, pts[1].y);
            const w = Math.abs(pts[1].x - pts[0].x), h = Math.abs(pts[1].y - pts[0].y);
            return (
                <g key={key}>
                    <rect x={x} y={y} width={w} height={h} stroke={col} strokeWidth={1.5}
                        fill={ghost ? 'none' : col + '22'} strokeDasharray={ghost ? '4 3' : 'none'} />
                    {m.completed && <text x={x + 2} y={y - 4} fill={col} fontSize={11} fontWeight="bold">
                        {w.toFixed(0)}×{h.toFixed(0)} px
                    </text>}
                    {m.completed && !ghost && (
                        <text x={x + w + 2} y={y - 4} fill="#ff4444" fontSize={12}
                            style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                </g>
            );
        }

        if (m.tool === 'roiEllipse' && pts.length >= 2) {
            const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
            const rx = Math.abs(pts[1].x - pts[0].x) / 2, ry = Math.abs(pts[1].y - pts[0].y) / 2;
            return (
                <g key={key}>
                    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={col} strokeWidth={1.5}
                        fill={ghost ? 'none' : col + '22'} strokeDasharray={ghost ? '4 3' : 'none'} />
                    {m.completed && <text x={cx} y={cy - ry - 4} fill={col} fontSize={11} fontWeight="bold"
                        textAnchor="middle">Ø {(rx * 2).toFixed(0)}×{(ry * 2).toFixed(0)} px</text>}
                    {m.completed && !ghost && (
                        <text x={cx + rx + 6} y={cy} fill="#ff4444" fontSize={12}
                            style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                </g>
            );
        }

        if (m.tool === 'arrow' && pts.length >= 2) {
            const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
            const angle = Math.atan2(dy, dx);
            const head = 10;
            const ax1 = pts[1].x - head * Math.cos(angle - 0.4);
            const ay1 = pts[1].y - head * Math.sin(angle - 0.4);
            const ax2 = pts[1].x - head * Math.cos(angle + 0.4);
            const ay2 = pts[1].y - head * Math.sin(angle + 0.4);
            return (
                <g key={key}>
                    <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y}
                        stroke={col} strokeWidth={1.5} />
                    <polygon points={`${pts[1].x},${pts[1].y} ${ax1},${ay1} ${ax2},${ay2}`} fill={col} />
                    {m.label && <text x={pts[0].x + 4} y={pts[0].y - 6} fill={col} fontSize={11}
                        fontWeight="bold" stroke="#000" strokeWidth={0.3}>{m.label}</text>}
                    {m.completed && !ghost && (
                        <text x={pts[0].x + 4} y={pts[0].y + 14} fill="#ff4444" fontSize={12}
                            style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                </g>
            );
        }

        if (m.tool === 'text' && pts.length >= 1) {
            return (
                <g key={key}>
                    <text x={pts[0].x} y={pts[0].y} fill={col} fontSize={13} fontWeight="bold"
                        stroke="#000" strokeWidth={0.4}>{m.label ?? 'Texto'}</text>
                    {!ghost && (
                        <text x={pts[0].x + (m.label?.length ?? 4) * 7 + 6} y={pts[0].y} fill="#ff4444"
                            fontSize={12} style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                </g>
            );
        }

        return null;
    };

    return (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
            viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
                <filter id="shadow">
                    <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#000" floodOpacity="0.6" />
                </filter>
            </defs>
            {measurements.map(m => renderMeasurement(m))}
            {current && renderMeasurement(current, true)}
        </svg>
    );
});

// ── RadiologiaViewer ──────────────────────────────────────────────────────────

// ── Mapa de color → filtro CSS (aproximación para imágenes en escala de grises) ──
const COLOR_MAP_FILTER: Record<string, string> = {
    grayscale:   'grayscale(1)',
    hot:         'grayscale(1) sepia(1) saturate(8) hue-rotate(0deg)',
    cool:        'grayscale(1) sepia(1) saturate(8) hue-rotate(180deg)',
    bone:        'grayscale(1) sepia(0.6) hue-rotate(215deg) saturate(4)',
    rainbow:     'grayscale(1) sepia(1) saturate(10) hue-rotate(60deg)',
    viridis:     'grayscale(1) sepia(1) saturate(7) hue-rotate(100deg) brightness(0.9)',
    dental_soft: 'grayscale(1) sepia(1) saturate(6) hue-rotate(195deg)',
    dental_warm: 'grayscale(1) sepia(1) saturate(6) hue-rotate(350deg)',
};

const RadiologiaViewer: React.FC<Props> = ({
    url, tool, measurements, onMeasurementsChange,
    brightness, contrast, colorMap = 'grayscale',
    invert = false, flipH = false, flipV = false, rotation = 0,
    onWLChange,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
    const [current, setCurrent] = useState<Measurement | null>(null);
    const [pendingText, setPendingText] = useState<{ pos: MeasurePoint } | null>(null);
    const [textInput, setTextInput] = useState('');

    // W/L via right-drag
    const wlRef = useRef({ dragging: false, startX: 0, startY: 0, wc: 0, ww: 500 });
    const panRef = useRef({ dragging: false, startX: 0, startY: 0, panX: 0, panY: 0 });

    // Drag state for measurements
    const drawRef = useRef<{ active: boolean; id: string }>({ active: false, id: '' });

    // ── CSS filters ───────────────────────────────────────────────────────────
    const imageStyle = useMemo((): React.CSSProperties => {
        const br = 1 + brightness / 100;
        const ct = 1 + contrast / 100;
        const cmFilter = colorMap && colorMap !== 'grayscale'
            ? COLOR_MAP_FILTER[colorMap] ?? 'grayscale(1)'
            : '';
        const filterStr = [
            cmFilter || 'grayscale(1)',
            `brightness(${br})`,
            `contrast(${ct})`,
            invert ? 'invert(1)' : '',
        ].filter(Boolean).join(' ');

        const transforms = [
            `scale(${zoom})`,
            `translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            flipH ? 'scaleX(-1)' : '',
            flipV ? 'scaleY(-1)' : '',
            rotation ? `rotate(${rotation}deg)` : '',
        ].filter(Boolean).join(' ');

        return {
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            filter: filterStr || 'none',
            transform: transforms,
            transformOrigin: 'center center',
            userSelect: 'none',
        };
    }, [brightness, contrast, colorMap, invert, zoom, pan, flipH, flipV, rotation]);

    // ── Zoom ─────────────────────────────────────────────────────────────────
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        setZoom(z => clamp(z + (e.deltaY < 0 ? 0.12 : -0.12), 0.15, 10));
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    // ── Mouse: pan + W/L + drawing ────────────────────────────────────────────
    const toPercent = useCallback((e: React.MouseEvent): MeasurePoint => {
        const r = containerRef.current?.getBoundingClientRect();
        if (!r) return { x: 0, y: 0 };
        return {
            x: clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
            y: clamp(((e.clientY - r.top) / r.height) * 100, 0, 100),
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Right click → W/L
        if (e.button === 2) {
            e.preventDefault();
            wlRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, wc: 0, ww: 500 };
            return;
        }

        if (tool === 'pan') {
            panRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
            return;
        }

        if (tool === 'wl') {
            wlRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, wc: 0, ww: 500 };
            return;
        }

        if (tool === 'text') {
            const pos = toPercent(e);
            setPendingText({ pos });
            setTextInput('');
            return;
        }

        // Measurement tools: start new or add point
        const pos = toPercent(e);

        if (!drawRef.current.active) {
            const id = uid();
            drawRef.current = { active: true, id };

            if (tool === 'angle') {
                // Angle needs 3 points: vertex first, then two arms
                setCurrent({ id, tool, points: [pos], color: '#00EEFF', completed: false });
            } else {
                setCurrent({ id, tool, points: [pos, pos], color: '#00EEFF', completed: false });
            }
        } else {
            // Second/third click for angle
            if (tool === 'angle' && current) {
                const pts = [...current.points, pos];
                if (pts.length === 3) {
                    const done = { ...current, points: pts, completed: true };
                    onMeasurementsChange([...measurements, done]);
                    setCurrent(null);
                    drawRef.current.active = false;
                } else {
                    setCurrent({ ...current, points: pts });
                }
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // W/L drag
        if (wlRef.current.dragging) {
            const dx = e.clientX - wlRef.current.startX;
            const dy = e.clientY - wlRef.current.startY;
            onWLChange?.(wlRef.current.wc + dx, Math.max(1, wlRef.current.ww + dy));
            return;
        }
        // Pan drag
        if (panRef.current.dragging) {
            setPan({
                x: panRef.current.panX + (e.clientX - panRef.current.startX),
                y: panRef.current.panY + (e.clientY - panRef.current.startY),
            });
            return;
        }
        // Update second point for rect/ellipse/ruler/arrow
        if (drawRef.current.active && current && tool !== 'angle') {
            const pos = toPercent(e);
            setCurrent(prev => prev ? { ...prev, points: [prev.points[0], pos] } : null);
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (wlRef.current.dragging) { wlRef.current.dragging = false; return; }
        if (panRef.current.dragging) { panRef.current.dragging = false; return; }

        if (drawRef.current.active && current && tool !== 'angle') {
            const pos = toPercent(e);
            const done = { ...current, points: [current.points[0], pos], completed: true };
            onMeasurementsChange([...measurements, done]);
            setCurrent(null);
            drawRef.current.active = false;
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

    const handleDelete = (id: string) => {
        onMeasurementsChange(measurements.filter(m => m.id !== id));
    };

    const confirmText = () => {
        if (!pendingText || !textInput.trim()) { setPendingText(null); return; }
        const m: Measurement = {
            id: uid(), tool: 'text',
            points: [pendingText.pos], label: textInput.trim(),
            color: '#FFD700', completed: true,
        };
        onMeasurementsChange([...measurements, m]);
        setPendingText(null);
        setTextInput('');
    };

    const W = containerRef.current?.clientWidth ?? 600;
    const H = containerRef.current?.clientHeight ?? 400;

    if (!url) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0a0a0f', color: '#555', fontSize: 13 }}>
                Ningún estudio seleccionado
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: tool === 'pan' ? 'grab' : tool === 'wl' ? 'ew-resize' : 'crosshair' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={handleContextMenu}
        >
            {/* Imagen */}
            <img
                ref={imgRef}
                src={url}
                alt="Radiografía"
                draggable={false}
                style={imageStyle}
                onLoad={() => {
                    if (imgRef.current) {
                        setImgSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
                    }
                }}
            />

            {/* SVG Mediciones */}
            <MeasureSVG
                measurements={measurements}
                current={current}
                W={W} H={H}
                onDelete={handleDelete}
            />

            {/* Input texto flotante */}
            {pendingText && (
                <div style={{
                    position: 'absolute',
                    left: `${pendingText.pos.x}%`,
                    top: `${pendingText.pos.y}%`,
                    transform: 'translate(-50%, -110%)',
                    background: '#1a1a2e', border: '1px solid #FFD700',
                    borderRadius: 6, padding: '6px 8px', display: 'flex', gap: 6, zIndex: 50,
                }}>
                    <input
                        autoFocus
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') confirmText(); if (e.key === 'Escape') setPendingText(null); }}
                        placeholder="Anotación…"
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: '#FFD700', fontSize: 12, width: 160 }}
                    />
                    <button onClick={confirmText} style={{ background: '#FFD700', color: '#000', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}>OK</button>
                </div>
            )}

            {/* Indicador zoom */}
            <div style={{ position: 'absolute', bottom: 8, right: 10, background: '#00000088', color: '#aaa', fontSize: 11, padding: '2px 7px', borderRadius: 4, pointerEvents: 'none' }}>
                {(zoom * 100).toFixed(0)}%
            </div>
        </div>
    );
};

export default RadiologiaViewer;
