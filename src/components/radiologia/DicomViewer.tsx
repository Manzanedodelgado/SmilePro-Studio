/**
 * DicomViewer.tsx — Visor de imagen DICOM de un solo frame (Rx, Periapical, etc.)
 * Carga el archivo, aplica W/L y muestra la imagen con herramientas básicas.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Sliders, ZoomIn, ZoomOut, RotateCcw, Ruler } from 'lucide-react';
import { loadDicomVolume, renderFrame, type DicomVolume, DENTAL_PRESETS } from '../../services/dicom.service';

interface DicomViewerProps {
    file: File;
}

const DicomViewer: React.FC<DicomViewerProps> = ({ file }) => {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [volume, setVolume] = useState<DicomVolume | null>(null);
    const [wc, setWc] = useState(0);
    const [ww, setWw] = useState(2000);
    const [zoom, setZoom] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rulerActive, setRulerActive] = useState(false);
    const [rulers, setRulers] = useState<{ x1:number;y1:number;x2:number;y2:number;mm:number }[]>([]);
    const [drawing, setDrawing] = useState<{x:number;y:number}|null>(null);
    const [cursor, setCursor] = useState<{x:number;y:number}|null>(null);

    // Cargar volumen
    useEffect(() => {
        setLoading(true);
        setError(null);
        loadDicomVolume(file)
            .then(vol => {
                setVolume(vol);
                setWc(vol.defaultWC);
                setWw(vol.defaultWW);
                setLoading(false);
            })
            .catch(err => {
                setError(`Error al cargar DICOM: ${err.message}`);
                setLoading(false);
            });
    }, [file]);

    // Renderizar cuando cambian wc/ww/volumen
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !volume) return;
        canvas.width  = volume.cols;
        canvas.height = volume.rows;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const mid = Math.floor(volume.numFrames / 2);
        const imgData = ctx.createImageData(volume.cols, volume.rows);
        renderFrame(volume, mid, wc, ww, imgData);
        ctx.putImageData(imgData, 0, 0);
    }, [volume, wc, ww]);

    const getPos = (e: React.MouseEvent): {x:number;y:number} => {
        const rect = containerRef.current!.getBoundingClientRect();
        return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    };

    const handleMouseDown = (e: React.MouseEvent) => { if (rulerActive) setDrawing(getPos(e)); };
    const handleMouseMove = (e: React.MouseEvent) => { if (rulerActive) setCursor(getPos(e)); };
    const handleMouseUp   = (e: React.MouseEvent) => {
        if (!rulerActive || !drawing) return;
        const end = getPos(e);
        const canvas = canvasRef.current;
        const ps = volume?.pixelSpacing?.[1] ?? 0.3;
        let mm = 0;
        if (canvas) {
            const dx = (end.x - drawing.x) * canvas.width  * ps;
            const dy = (end.y - drawing.y) * canvas.height * ps;
            mm = Math.sqrt(dx*dx + dy*dy);
        }
        setRulers(r => [...r, { x1: drawing.x, y1: drawing.y, x2: end.x, y2: end.y, mm }]);
        setDrawing(null);
    };

    if (loading) return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#475569', fontSize: 13 }}>
            Cargando DICOM…
        </div>
    );

    if (error) return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#f87171', fontSize: 12, padding: 20, textAlign: 'center' }}>
            {error}
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000' }}>
            {/* Toolbar */}
            <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', background: '#0d1018', borderBottom: '1px solid #1e2535' }}>
                <Sliders style={{ width: 12, height: 12, color: '#475569' }} />
                <span style={{ color: '#475569', fontSize: 10 }}>WC</span>
                <input type="range" min={-1000} max={3000} value={wc} onChange={e => setWc(+e.target.value)}
                    style={{ width: 80, accentColor: '#3b82f6' }} />
                <span style={{ color: '#64748b', fontSize: 10, minWidth: 36 }}>{wc}</span>
                <span style={{ color: '#475569', fontSize: 10 }}>WW</span>
                <input type="range" min={1} max={4000} value={ww} onChange={e => setWw(+e.target.value)}
                    style={{ width: 80, accentColor: '#3b82f6' }} />
                <span style={{ color: '#64748b', fontSize: 10, minWidth: 36 }}>{ww}</span>

                <div style={{ width: 1, height: 18, background: '#1e2535' }} />

                {DENTAL_PRESETS.map(p => (
                    <button key={p.name} onClick={() => { setWc(p.wc); setWw(p.ww); }} style={{
                        padding: '2px 7px', border: '1px solid #1e2535', borderRadius: 4,
                        cursor: 'pointer', fontSize: 10, background: '#141820', color: '#64748b',
                    }}>{p.name}</button>
                ))}

                <div style={{ width: 1, height: 18, background: '#1e2535' }} />
                <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex' }}><ZoomIn style={{ width: 14, height: 14 }} /></button>
                <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex' }}><ZoomOut style={{ width: 14, height: 14 }} /></button>
                <button onClick={() => { setZoom(1); setRulers([]); }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex' }}><RotateCcw style={{ width: 13, height: 13 }} /></button>

                <div style={{ width: 1, height: 18, background: '#1e2535' }} />
                <button onClick={() => setRulerActive(r => !r)} style={{
                    padding: '2px 8px', border: `1px solid ${rulerActive ? '#fbbf24' : '#1e2535'}`,
                    borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                    background: rulerActive ? '#3d2c0a' : 'transparent',
                    color: rulerActive ? '#fbbf24' : '#475569',
                    display: 'flex', alignItems: 'center', gap: 4,
                }}>
                    <Ruler style={{ width: 11, height: 11 }} /> Regla
                </button>
            </div>

            {/* Visor */}
            <div
                ref={containerRef}
                style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#000', position: 'relative', cursor: rulerActive ? 'crosshair' : 'default' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setCursor(null)}
            >
                <canvas
                    ref={canvasRef}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', transform: `scale(${zoom})`, transformOrigin: 'center' }}
                />
                {(rulers.length > 0 || drawing) && (
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                        viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet">
                        {rulers.map((r, i) => (
                            <g key={i}>
                                <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="#fbbf24" strokeWidth={0.003} />
                                <circle cx={r.x1} cy={r.y1} r={0.006} fill="#fbbf24" />
                                <circle cx={r.x2} cy={r.y2} r={0.006} fill="#fbbf24" />
                                <text x={(r.x1+r.x2)/2} y={(r.y1+r.y2)/2 - 0.02}
                                    fontSize={0.035} fill="#fbbf24" textAnchor="middle">
                                    {r.mm.toFixed(1)} mm
                                </text>
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

export default DicomViewer;
