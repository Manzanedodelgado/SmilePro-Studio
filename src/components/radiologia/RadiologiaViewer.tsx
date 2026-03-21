/**
 * RadiologiaViewer.tsx
 * Visor 2D para radiografías y fotografías clínicas.
 *
 * Herramientas:
 *  - Pan / Zoom (rueda)
 *  - W/L (clic derecho arrastrar o botón WL)
 *  - Regla, Ángulo, ROI Rect, ROI Elipse, Flecha, Texto
 *  - Implante dental: clic coloca implante, configurable diámetro/longitud
 *  - Canal nervioso: polyline multi-clic, doble-clic cierra (nervio dentario inf.)
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
    | 'arrow' | 'text'
    | 'implant' | 'nerve'
    | 'calibrate';

export interface MeasurePoint { x: number; y: number; } // % respecto al visor

export interface Measurement {
    id: string;
    tool: MeasureTool;
    points: MeasurePoint[];
    label?: string;
    color: string;
    completed: boolean;
}

export interface ImplantConfig {
    diameter: number;   // mm: 3.0 | 3.3 | 3.5 | 4.0 | 4.5 | 5.0
    length: number;     // mm: 6 | 8 | 10 | 11.5 | 13 | 16
    brand?: string;
}

/** Calibración: relación px/mm real medida sobre la imagen */
export interface CalibrationData {
    pxPerMm: number;   // píxeles de contenedor por milímetro real
    refLabel: string;  // e.g. "Incisivo central — 22 mm"
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
    // Implant config
    implantConfig?: ImplantConfig;
    // Calibración (px/mm)
    calibration?: CalibrationData | null;
    onCalibrate?: (data: CalibrationData) => void;
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
    calibration?: CalibrationData | null;
}> = React.memo(({ measurements, current, W, H, onDelete, calibration }) => {
    const toSvg = (p: MeasurePoint) => ({ x: (p.x * W) / 100, y: (p.y * H) / 100 });

    // Formatea una distancia en px como mm (si hay calibración) o px
    const fmtDist = (pxDist: number) => {
        if (calibration && calibration.pxPerMm > 0) {
            return `${(pxDist / calibration.pxPerMm).toFixed(1)} mm`;
        }
        return `${pxDist.toFixed(1)} px`;
    };

    const renderMeasurement = (m: Measurement, ghost = false) => {
        const col = ghost ? '#FFD70088' : m.color;
        const pts = m.points.map(toSvg);
        const key = m.id;

        const delStyle: React.CSSProperties = { cursor: 'pointer', pointerEvents: 'all' };

        // ── Regla ─────────────────────────────────────────────────────────────
        if (m.tool === 'ruler' && pts.length >= 2) {
            const pxDist = dist(m.points[0], m.points[1], W, H);
            const label = fmtDist(pxDist);
            const mx = (pts[0].x + pts[1].x) / 2;
            const my = (pts[0].y + pts[1].y) / 2 - 8;
            return (
                <g key={key}>
                    <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y}
                        stroke={col} strokeWidth={1.5} strokeDasharray={ghost ? '4 3' : 'none'} />
                    {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={col} />)}
                    {m.completed && <text x={mx} y={my} fill={col} fontSize={11} fontWeight="bold"
                        stroke="#000" strokeWidth={0.3} textAnchor="middle">{label}</text>}
                    {m.completed && <text x={mx + 1} y={my - 1} fill={col} fontSize={11} fontWeight="bold"
                        textAnchor="middle">{label}</text>}
                    {m.completed && !ghost && (
                        <text x={pts[1].x + 6} y={pts[1].y - 4} fill="#ff4444" fontSize={12}
                            style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                </g>
            );
        }

        // ── Línea de calibración ───────────────────────────────────────────────
        if (m.tool === 'calibrate' && pts.length >= 2) {
            const mx = (pts[0].x + pts[1].x) / 2;
            const my = (pts[0].y + pts[1].y) / 2 - 10;
            return (
                <g key={key}>
                    {/* Línea con ticks en extremos */}
                    <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y}
                        stroke={col} strokeWidth={2} />
                    <line x1={pts[0].x} y1={pts[0].y - 6} x2={pts[0].x} y2={pts[0].y + 6}
                        stroke={col} strokeWidth={2} />
                    <line x1={pts[1].x} y1={pts[1].y - 6} x2={pts[1].x} y2={pts[1].y + 6}
                        stroke={col} strokeWidth={2} />
                    {m.completed && (
                        <text x={mx} y={my} fill={col} fontSize={11} fontWeight="bold"
                            stroke="#000" strokeWidth={0.3} textAnchor="middle">
                            {m.label ?? '— mm'}
                        </text>
                    )}
                    {m.completed && !ghost && (
                        <text x={pts[1].x + 8} y={pts[1].y + 4} fill="#ff4444" fontSize={12}
                            style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                </g>
            );
        }

        // ── Ángulo ────────────────────────────────────────────────────────────
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

        // ── ROI Rectángulo ────────────────────────────────────────────────────
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

        // ── ROI Elipse ────────────────────────────────────────────────────────
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

        // ── Flecha ────────────────────────────────────────────────────────────
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

        // ── Texto ─────────────────────────────────────────────────────────────
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

        // ── Implante dental ───────────────────────────────────────────────────
        // Renderiza un implante como un cilindro (rectángulo redondeado) con
        // corona en la parte superior y ápex en la inferior.
        if (m.tool === 'implant' && pts.length >= 1) {
            const cx = pts[0].x, cy = pts[0].y;
            // Parsear dimensiones desde label "Ø4.0×10mm"
            const match = m.label?.match(/Ø([\d.]+)×([\d.]+)mm/);
            const d_mm = match ? parseFloat(match[1]) : 4.0;
            const l_mm = match ? parseFloat(match[2]) : 10;
            // Escala: usa calibración real si está disponible.
            // Sin calibración: estimación basada en arco mandibular típico (~130 mm).
            const mmToPx = calibration && calibration.pxPerMm > 0
                ? calibration.pxPerMm
                : W / 130;
            const d_px = d_mm * mmToPx;
            const l_px = l_mm * mmToPx;
            const x = cx - d_px / 2, y = cy - l_px / 2;

            return (
                <g key={key}>
                    {/* Sombra */}
                    <rect x={x + 1} y={y + 1} width={d_px} height={l_px}
                        rx={d_px / 2} fill="#00000044" />
                    {/* Cuerpo implante */}
                    <rect x={x} y={y} width={d_px} height={l_px}
                        rx={d_px / 2} stroke={col} strokeWidth={1.5}
                        fill={ghost ? 'none' : col + '44'} />
                    {/* Estrías del implante (líneas horizontales) */}
                    {!ghost && Array.from({ length: Math.floor(l_mm / 2) }).map((_, i) => {
                        const lineY = y + ((i + 1) * l_px) / (Math.floor(l_mm / 2) + 1);
                        return <line key={i} x1={x + 2} y1={lineY} x2={x + d_px - 2} y2={lineY}
                            stroke={col} strokeWidth={0.5} opacity={0.5} />;
                    })}
                    {/* Corona (plataforma superior) */}
                    <rect x={x - 2} y={y} width={d_px + 4} height={3}
                        rx={1} fill={col} opacity={0.8} />
                    {/* Ápex */}
                    <polygon points={`${cx},${y + l_px + 5} ${x + 3},${y + l_px} ${x + d_px - 3},${y + l_px}`}
                        fill={col} opacity={0.8} />
                    {/* Cruz en el centro */}
                    <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke={col} strokeWidth={1} />
                    <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke={col} strokeWidth={1} />
                    {/* Etiqueta */}
                    {m.label && (
                        <text x={cx + d_px / 2 + 6} y={cy - 2} fill={col} fontSize={10} fontWeight="bold"
                            stroke="#000" strokeWidth={0.3}>{m.label}</text>
                    )}
                    {/* Eliminar */}
                    {!ghost && (
                        <text x={cx + d_px / 2 + 6} y={cy + 12} fill="#ff4444" fontSize={12}
                            style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                </g>
            );
        }

        // ── Canal nervioso (Nervio dentario inferior) ─────────────────────────
        // Polyline multi-punto con trazo discontinuo ámbar.
        if (m.tool === 'nerve' && pts.length >= 1) {
            const pathData = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const lastPt = pts[pts.length - 1];
            return (
                <g key={key}>
                    {/* Aura exterior suave */}
                    <path d={pathData} stroke={col} strokeWidth={6}
                        strokeDasharray="8 4" fill="none"
                        strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
                    {/* Línea principal */}
                    <path d={pathData} stroke={col} strokeWidth={2}
                        strokeDasharray="8 4" fill="none"
                        strokeLinecap="round" strokeLinejoin="round" />
                    {/* Puntos de control */}
                    {pts.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={i === 0 || i === pts.length - 1 ? 3.5 : 2.5}
                            fill={col} stroke="#000" strokeWidth={0.5} />
                    ))}
                    {/* Etiqueta en el inicio */}
                    {m.completed && (
                        <text x={pts[0].x + 6} y={pts[0].y - 7} fill={col} fontSize={10} fontWeight="bold"
                            stroke="#000" strokeWidth={0.4}>{m.label ?? 'Nervio dentario'}</text>
                    )}
                    {/* Eliminar al final del trazado */}
                    {m.completed && !ghost && (
                        <text x={lastPt.x + 6} y={lastPt.y - 4} fill="#ff4444" fontSize={12}
                            style={delStyle} onClick={() => onDelete(m.id)}>✕</text>
                    )}
                    {/* Indicador "doble-clic para terminar" mientras se traza */}
                    {!m.completed && pts.length >= 2 && (
                        <text x={lastPt.x + 6} y={lastPt.y + 14} fill={col} fontSize={9}
                            opacity={0.7}>doble-clic para terminar</text>
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

// ── Mapa de color → filtro CSS ─────────────────────────────────────────────────
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
    onWLChange, implantConfig, calibration, onCalibrate,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [current, setCurrent] = useState<Measurement | null>(null);
    const [pendingText, setPendingText] = useState<{ pos: MeasurePoint } | null>(null);
    const [textInput, setTextInput] = useState('');
    const lastClickRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

    // Calibration dialog
    const [calibPending, setCalibPending] = useState<{ p0: MeasurePoint; p1: MeasurePoint } | null>(null);
    const [calibInput, setCalibInput] = useState('');

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

        // ── Implante: un solo clic coloca el implante ─────────────────────────
        if (tool === 'implant') {
            const pos = toPercent(e);
            const d = implantConfig?.diameter ?? 4.0;
            const l = implantConfig?.length ?? 10;
            const brand = implantConfig?.brand;
            const label = brand
                ? `Ø${d}×${l}mm (${brand})`
                : `Ø${d}×${l}mm`;
            const m: Measurement = {
                id: uid(), tool: 'implant',
                points: [pos], label,
                color: '#00B4AB', completed: true,
            };
            onMeasurementsChange([...measurements, m]);
            return;
        }

        // ── Canal nervioso: multi-clic, doble-clic finaliza ───────────────────
        if (tool === 'nerve') {
            const pos = toPercent(e);
            const now = Date.now();
            const last = lastClickRef.current;
            const isDouble = now - last.time < 350 && Math.abs(pos.x - last.x) < 3 && Math.abs(pos.y - last.y) < 3;
            lastClickRef.current = { time: now, x: pos.x, y: pos.y };

            if (isDouble && drawRef.current.active && current && current.points.length >= 2) {
                // Doble-clic: finalizar trazado
                const done = { ...current, completed: true, label: 'Nervio dentario inf.' };
                onMeasurementsChange([...measurements, done]);
                setCurrent(null);
                drawRef.current.active = false;
            } else if (!drawRef.current.active) {
                const id = uid();
                drawRef.current = { active: true, id };
                setCurrent({ id, tool, points: [pos], color: '#FFA500', completed: false });
            } else if (current) {
                setCurrent({ ...current, points: [...current.points, pos] });
            }
            return;
        }

        // Measurement tools: start new or add point
        const pos = toPercent(e);

        if (!drawRef.current.active) {
            const id = uid();
            drawRef.current = { active: true, id };

            if (tool === 'angle') {
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
        if (drawRef.current.active && current && tool !== 'angle' && tool !== 'nerve') {
            const pos = toPercent(e);
            setCurrent(prev => prev ? { ...prev, points: [prev.points[0], pos] } : null);
        }
        // For nerve, update last point as cursor moves (preview)
        if (drawRef.current.active && current && tool === 'nerve' && current.points.length >= 1) {
            const pos = toPercent(e);
            const pts = [...current.points.slice(0, -1), pos];
            setCurrent(prev => prev ? { ...prev, points: pts } : null);
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (wlRef.current.dragging) { wlRef.current.dragging = false; return; }
        if (panRef.current.dragging) { panRef.current.dragging = false; return; }

        if (drawRef.current.active && current && tool !== 'angle' && tool !== 'nerve') {
            const pos = toPercent(e);
            const finalPts: [MeasurePoint, MeasurePoint] = [current.points[0], pos];
            if (tool === 'calibrate') {
                // Show calibration dialog instead of saving measurement
                setCalibPending({ p0: finalPts[0], p1: finalPts[1] });
                setCalibInput('');
                setCurrent(null);
                drawRef.current.active = false;
            } else {
                const done = { ...current, points: finalPts, completed: true };
                onMeasurementsChange([...measurements, done]);
                setCurrent(null);
                drawRef.current.active = false;
            }
        }
    };

    const confirmCalibration = () => {
        if (!calibPending) return;
        const mm = parseFloat(calibInput);
        if (isNaN(mm) || mm <= 0) { setCalibPending(null); return; }
        const cW = containerRef.current?.clientWidth ?? 600;
        const cH = containerRef.current?.clientHeight ?? 400;
        const pxDist = dist(calibPending.p0, calibPending.p1, cW, cH);
        const pxPerMm = pxDist / mm;
        // Save calibration line as a measurement for visual reference
        const m: Measurement = {
            id: uid(), tool: 'calibrate',
            points: [calibPending.p0, calibPending.p1],
            label: `${mm} mm (cal.)`,
            color: '#22d3ee', completed: true,
        };
        onMeasurementsChange([...measurements, m]);
        onCalibrate?.({ pxPerMm, refLabel: `${mm} mm` });
        setCalibPending(null);
        setCalibInput('');
    };

    const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

    const handleDelete = (id: string) => {
        onMeasurementsChange(measurements.filter(m => m.id !== id));
    };

    // Escape: cancel active nerve/angle drawing
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && drawRef.current.active) {
                setCurrent(null);
                drawRef.current.active = false;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

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

    const toolCursor = tool === 'pan' ? 'grab'
        : tool === 'wl' ? 'ew-resize'
        : tool === 'implant' ? 'cell'
        : tool === 'nerve' ? 'crosshair'
        : 'crosshair';

    return (
        <div
            ref={containerRef}
            style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: toolCursor }}
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
            />

            {/* SVG Mediciones */}
            <MeasureSVG
                measurements={measurements}
                current={current}
                W={W} H={H}
                onDelete={handleDelete}
                calibration={calibration}
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

            {/* Diálogo de calibración */}
            {calibPending && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#0d1018', border: '1px solid #22d3ee',
                    borderRadius: 10, padding: '16px 20px', zIndex: 100,
                    minWidth: 280, boxShadow: '0 12px 40px #00000099',
                }}>
                    <p style={{ color: '#22d3ee', fontSize: 12, fontWeight: 700, margin: '0 0 6px' }}>
                        Calibración — Distancia real
                    </p>
                    <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 12px', lineHeight: 1.5 }}>
                        ¿Cuántos mm mide la línea que acabas de trazar?<br />
                        (usa una referencia conocida: diente, implante, regla)
                    </p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            autoFocus
                            type="number" min="0.1" step="0.5"
                            value={calibInput}
                            onChange={e => setCalibInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') confirmCalibration(); if (e.key === 'Escape') setCalibPending(null); }}
                            placeholder="ej: 22"
                            style={{ flex: 1, background: '#0a0c10', border: '1px solid #1e2535', borderRadius: 6, color: '#e2e8f0', fontSize: 13, padding: '6px 10px', outline: 'none' }}
                        />
                        <span style={{ color: '#475569', fontSize: 12 }}>mm</span>
                        <button onClick={confirmCalibration}
                            style={{ background: '#22d3ee', color: '#000', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                            OK
                        </button>
                        <button onClick={() => setCalibPending(null)}
                            style={{ background: 'none', border: '1px solid #1e2535', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: '#475569', fontSize: 12 }}>
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Indicador zoom */}
            <div style={{ position: 'absolute', bottom: 8, right: 10, background: '#00000088', color: '#aaa', fontSize: 11, padding: '2px 7px', borderRadius: 4, pointerEvents: 'none' }}>
                {(zoom * 100).toFixed(0)}%
            </div>

            {/* Badge calibración activa */}
            {calibration && (
                <div style={{ position: 'absolute', top: 8, right: 10, background: '#22d3ee22', border: '1px solid #22d3ee55', color: '#22d3ee', fontSize: 10, padding: '2px 8px', borderRadius: 4, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>⚖</span>
                    <span>{calibration.pxPerMm.toFixed(2)} px/mm — {calibration.refLabel}</span>
                </div>
            )}

            {/* Indicador herramienta implante */}
            {tool === 'implant' && (
                <div style={{ position: 'absolute', bottom: 8, left: 10, background: '#00B4AB22', border: '1px solid #00B4AB55', color: '#00B4AB', fontSize: 10, padding: '2px 8px', borderRadius: 4, pointerEvents: 'none' }}>
                    Clic para colocar implante
                </div>
            )}

            {/* Indicador herramienta nervio */}
            {tool === 'nerve' && (
                <div style={{ position: 'absolute', bottom: 8, left: 10, background: '#FFA50022', border: '1px solid #FFA50055', color: '#FFA500', fontSize: 10, padding: '2px 8px', borderRadius: 4, pointerEvents: 'none' }}>
                    {drawRef.current.active ? 'Clic para añadir punto · Doble-clic para terminar · Esc para cancelar' : 'Clic para iniciar trazado del nervio'}
                </div>
            )}
        </div>
    );
};

export default RadiologiaViewer;
