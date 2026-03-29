/**
 * RadiologiaViewer.tsx — Visor de imágenes radiológicas (no-DICOM)
 * Rx panorámica, periapical, intraoral (JPEG/PNG) con herramientas básicas.
 */

import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, FlipHorizontal, FlipVertical, Ruler, Sun } from 'lucide-react';

export type MeasureTool = 'ruler' | 'select';
export interface Measurement { id: string; x1: number; y1: number; x2: number; y2: number; label: string; }
export interface ImplantConfig { diameter: number; length: number; }
export interface CalibrationData { mmPerPixel: number; }

interface RadiologiaViewerProps {
    imageUrl:  string;
    alt?:      string;
    brightness?: number;
    contrast?:   number;
}

const RadiologiaViewer: React.FC<RadiologiaViewerProps> = ({
    imageUrl, alt = 'Imagen radiológica', brightness = 0, contrast = 0,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom,    setZoom]    = useState(1);
    const [flipH,   setFlipH]   = useState(false);
    const [flipV,   setFlipV]   = useState(false);
    const [rotate,  setRotate]  = useState(0);
    const [bright,  setBright]  = useState(brightness);
    const [contr,   setContr]   = useState(contrast);
    const [ruler,   setRuler]   = useState(false);
    const [rulers,  setRulers]  = useState<{ x1:number;y1:number;x2:number;y2:number }[]>([]);
    const [drawing, setDrawing] = useState<{x:number;y:number}|null>(null);
    const [cursor,  setCursor]  = useState<{x:number;y:number}|null>(null);
    const [invert,  setInvert]  = useState(false);

    const filterStr = [
        `brightness(${1 + bright / 100})`,
        `contrast(${1 + contr / 100})`,
        invert ? 'invert(1)' : '',
    ].filter(Boolean).join(' ');

    const transformStr = [
        `scale(${zoom})`,
        `rotate(${rotate}deg)`,
        flipH ? 'scaleX(-1)' : '',
        flipV ? 'scaleY(-1)' : '',
    ].filter(Boolean).join(' ');

    const getPos = (e: React.MouseEvent): {x:number;y:number} => {
        const rect = containerRef.current!.getBoundingClientRect();
        return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    };

    const handleMouseDown = (e: React.MouseEvent) => { if (ruler) setDrawing(getPos(e)); };
    const handleMouseMove = (e: React.MouseEvent) => { if (ruler) setCursor(getPos(e)); };
    const handleMouseUp   = (e: React.MouseEvent) => {
        if (!ruler || !drawing) return;
        const end = getPos(e);
        setRulers(r => [...r, { x1: drawing.x, y1: drawing.y, x2: end.x, y2: end.y }]);
        setDrawing(null);
    };

    const reset = () => { setZoom(1); setFlipH(false); setFlipV(false); setRotate(0); setBright(0); setContr(0); setInvert(false); setRulers([]); };

    const iconBtn = (active: boolean, onClick: () => void, children: React.ReactNode, title?: string) => (
        <button title={title} onClick={onClick} style={{
            width: 28, height: 28, border: 'none', borderRadius: 5,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: active ? '#1e40af' : 'transparent',
            color: active ? '#93c5fd' : '#475569',
        }}>{children}</button>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000' }}>
            {/* Toolbar */}
            <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', background: '#0d1018', borderBottom: '1px solid #1e2535' }}>
                {iconBtn(false, () => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2))), <ZoomIn style={{ width: 13, height: 13 }} />, 'Zoom +')}
                {iconBtn(false, () => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2))), <ZoomOut style={{ width: 13, height: 13 }} />, 'Zoom -')}
                {iconBtn(flipH, () => setFlipH(v => !v), <FlipHorizontal style={{ width: 13, height: 13 }} />, 'Voltear H')}
                {iconBtn(flipV, () => setFlipV(v => !v), <FlipVertical style={{ width: 13, height: 13 }} />, 'Voltear V')}
                {iconBtn(false, () => setRotate(r => (r + 90) % 360), <RotateCcw style={{ width: 13, height: 13 }} />, 'Rotar')}
                {iconBtn(invert, () => setInvert(v => !v), <span style={{ fontSize: 13, fontWeight: 700 }}>⊘</span>, 'Invertir')}

                <div style={{ width: 1, height: 18, background: '#1e2535', margin: '0 2px' }} />
                <Sun style={{ width: 11, height: 11, color: '#475569', flexShrink: 0 }} />
                <input type="range" min={-100} max={100} value={bright} onChange={e => setBright(+e.target.value)}
                    style={{ width: 60, accentColor: '#f59e0b' }} />
                <input type="range" min={-100} max={100} value={contr} onChange={e => setContr(+e.target.value)}
                    style={{ width: 60, accentColor: '#3b82f6' }} />

                <div style={{ width: 1, height: 18, background: '#1e2535', margin: '0 2px' }} />
                <button onClick={() => setRuler(r => !r)} style={{
                    padding: '2px 8px', border: `1px solid ${ruler ? '#fbbf24' : '#1e2535'}`,
                    borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                    background: ruler ? '#3d2c0a' : 'transparent',
                    color: ruler ? '#fbbf24' : '#475569',
                    display: 'flex', alignItems: 'center', gap: 4,
                }}>
                    <Ruler style={{ width: 11, height: 11 }} /> Regla
                </button>

                <div style={{ flex: 1 }} />
                {iconBtn(false, reset, <RotateCcw style={{ width: 12, height: 12 }} />, 'Reset')}
            </div>

            {/* Imagen */}
            <div
                ref={containerRef}
                style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#060809', position: 'relative', cursor: ruler ? 'crosshair' : 'default' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setCursor(null)}
            >
                <img
                    src={imageUrl} alt={alt}
                    style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain', filter: filterStr, transform: transformStr, transformOrigin: 'center', transition: 'filter 0.1s' }}
                />
                {(rulers.length > 0 || drawing) && (
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                        viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet">
                        {rulers.map((r, i) => (
                            <g key={i}>
                                <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="#fbbf24" strokeWidth={0.003} />
                                <circle cx={r.x1} cy={r.y1} r={0.005} fill="#fbbf24" />
                                <circle cx={r.x2} cy={r.y2} r={0.005} fill="#fbbf24" />
                            </g>
                        ))}
                        {drawing && cursor && (
                            <line x1={drawing.x} y1={drawing.y} x2={cursor.x} y2={cursor.y}
                                stroke="#fbbf24" strokeWidth={0.003} strokeDasharray="0.01 0.005" />
                        )}
                    </svg>
                )}
            </div>
        </div>
    );
};

export default RadiologiaViewer;
