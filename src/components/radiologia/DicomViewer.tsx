/**
 * DicomViewer.tsx — Visor DICOM web con parsing propio
 * 4 vistas: Axial · Coronal · Sagital · MIP 3D
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Maximize2, Minimize2, RotateCcw, FlipVertical,
    Sun, Grid3X3, Upload, X
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type ViewId = 'axial' | 'coronal' | 'sagittal' | 'mip';
type Layout = '2x2' | ViewId;

interface ViewMeta { id: ViewId; label: string; color: string; shortcut: string; }

const VIEWS: ViewMeta[] = [
    { id: 'axial', label: 'Axial', color: '#009fe3', shortcut: 'A' },
    { id: 'coronal', label: 'Coronal', color: '#10b981', shortcut: 'C' },
    { id: 'sagittal', label: 'Sagital', color: '#f59e0b', shortcut: 'S' },
    { id: 'mip', label: 'MIP 3D', color: '#8b5cf6', shortcut: 'M' },
];

// ── Helpers para parsear DICOM ────────────────────────────────────────────────
function readUint16LE(dv: DataView, off: number) { return dv.getUint16(off, true); }
function readUint32LE(dv: DataView, off: number) { return dv.getUint32(off, true); }

interface DicomVolume {
    data: Int16Array;
    width: number; height: number; depth: number;
    spacing: [number, number, number];
    windowCenter: number; windowWidth: number;
}

function parseDicomTag(dv: DataView, offset: number) {
    const group = readUint16LE(dv, offset);
    const element = readUint16LE(dv, offset + 2);
    const vr = String.fromCharCode(dv.getUint8(offset + 4), dv.getUint8(offset + 5));
    const longVRs = ['OB', 'OW', 'OF', 'SQ', 'UC', 'UN', 'UR', 'UT'];
    let length: number, valueOffset: number;
    if (longVRs.includes(vr)) {
        length = readUint32LE(dv, offset + 8);
        valueOffset = offset + 12;
    } else {
        length = readUint16LE(dv, offset + 6);
        valueOffset = offset + 8;
    }
    return { group, element, vr, length, valueOffset };
}

function loadDicomFile(buffer: ArrayBuffer): DicomVolume | null {
    try {
        const dv = new DataView(buffer);
        const dicm = String.fromCharCode(dv.getUint8(128), dv.getUint8(129), dv.getUint8(130), dv.getUint8(131));
        console.log('[DICOM] DICM:', dicm, 'size:', buffer.byteLength);
        if (dicm !== 'DICM') { console.error('[DICOM] No DICM prefix'); return null; }

        let offset = 132;
        let rows = 0, cols = 0, bits = 16, frames = 1;
        let wc = 400, ww = 2000;
        let pixelDataOffset = 0, pixelDataLength = 0;
        let spacingX = 1, spacingY = 1, spacingZ = 1;
        let rescaleSlope = 1, rescaleIntercept = 0;

        while (offset < dv.byteLength - 8) {
            const tag = parseDicomTag(dv, offset);
            const tagId = (tag.group << 16) | tag.element;

            if (tag.length === 0xFFFFFFFF) { offset = tag.valueOffset; continue; }

            console.log(`[DICOM] (${tag.group.toString(16).padStart(4, '0')},${tag.element.toString(16).padStart(4, '0')}) VR=${tag.vr} len=${tag.length}`);

            switch (tagId) {
                case 0x00280010: rows = readUint16LE(dv, tag.valueOffset); break;
                case 0x00280011: cols = readUint16LE(dv, tag.valueOffset); break;
                case 0x00280100: bits = readUint16LE(dv, tag.valueOffset); break;
                case 0x00280008:
                    frames = parseInt(new TextDecoder().decode(new Uint8Array(buffer, tag.valueOffset, tag.length)).trim()) || 1;
                    break;
                case 0x00281050:
                    wc = parseFloat(new TextDecoder().decode(new Uint8Array(buffer, tag.valueOffset, tag.length)).trim()) || 400;
                    break;
                case 0x00281051:
                    ww = parseFloat(new TextDecoder().decode(new Uint8Array(buffer, tag.valueOffset, tag.length)).trim()) || 2000;
                    break;
                case 0x00281052:
                    rescaleIntercept = parseFloat(new TextDecoder().decode(new Uint8Array(buffer, tag.valueOffset, tag.length)).trim()) || 0;
                    break;
                case 0x00281053:
                    rescaleSlope = parseFloat(new TextDecoder().decode(new Uint8Array(buffer, tag.valueOffset, tag.length)).trim()) || 1;
                    break;
                case 0x00280030: {
                    const ps = new TextDecoder().decode(new Uint8Array(buffer, tag.valueOffset, tag.length)).trim().split('\\');
                    if (ps.length >= 2) { spacingY = parseFloat(ps[0]) || 1; spacingX = parseFloat(ps[1]) || 1; }
                    break;
                }
                case 0x00180050:
                    spacingZ = parseFloat(new TextDecoder().decode(new Uint8Array(buffer, tag.valueOffset, tag.length)).trim()) || 1;
                    break;
                case 0x7FE00010:
                    pixelDataOffset = tag.valueOffset;
                    pixelDataLength = tag.length;
                    break;
            }

            offset = tag.valueOffset + (tag.length > 0 ? tag.length : 0);
            if (pixelDataOffset > 0 && pixelDataLength > 0) break;
        }

        console.log(`[DICOM] rows=${rows} cols=${cols} bits=${bits} frames=${frames} pxOff=${pixelDataOffset} pxLen=${pixelDataLength}`);
        if (!rows || !cols || !pixelDataOffset) { console.error('[DICOM] Missing rows/cols/pixelData'); return null; }

        const depth = frames > 1 ? frames : Math.floor(pixelDataLength / (rows * cols * (bits / 8)));
        const totalPixels = rows * cols * depth;
        console.log(`[DICOM] depth=${depth} totalPixels=${totalPixels}`);

        // Copy pixel data to aligned buffer to avoid DataView alignment issues
        const pixelBytes = new Uint8Array(buffer, pixelDataOffset, totalPixels * 2);
        const alignedBuffer = new ArrayBuffer(totalPixels * 2);
        new Uint8Array(alignedBuffer).set(pixelBytes);
        const rawData = new Int16Array(alignedBuffer);

        // Apply rescale
        const data = new Int16Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
            data[i] = Math.round(rawData[i] * rescaleSlope + rescaleIntercept);
        }

        console.log(`[DICOM] Volume ready: ${cols}x${rows}x${depth}`);
        return {
            data, width: cols, height: rows, depth,
            spacing: [spacingX, spacingY, spacingZ],
            windowCenter: wc, windowWidth: ww,
        };
    } catch (e) {
        console.error('[DICOM] Parse error:', e);
        return null;
    }
}

// ── Render de cortes ──────────────────────────────────────────────────────────
function renderSlice(
    canvas: HTMLCanvasElement, vol: DicomVolume,
    view: ViewId, sliceIdx: number, wc: number, ww: number, invert: boolean
) {
    let w: number, h: number;
    switch (view) {
        case 'axial': w = vol.width; h = vol.height; break;
        case 'coronal': w = vol.width; h = vol.depth; break;
        case 'sagittal': w = vol.height; h = vol.depth; break;
        case 'mip': w = vol.width; h = vol.height; break;
    }

    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const pixels = imgData.data;
    const lo = wc - ww / 2, hi = wc + ww / 2, range = hi - lo || 1;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let val: number;
            if (view === 'mip') {
                let maxVal = -32768;
                for (let z = 0; z < vol.depth; z++) {
                    const idx = z * vol.width * vol.height + y * vol.width + x;
                    if (vol.data[idx] > maxVal) maxVal = vol.data[idx];
                }
                val = maxVal;
            } else {
                let idx: number;
                switch (view) {
                    case 'axial': idx = sliceIdx * vol.width * vol.height + y * vol.width + x; break;
                    case 'coronal': idx = (vol.depth - 1 - y) * vol.width * vol.height + sliceIdx * vol.width + x; break;
                    case 'sagittal': idx = (vol.depth - 1 - y) * vol.width * vol.height + x * vol.width + sliceIdx; break;
                    default: idx = 0;
                }
                val = vol.data[idx] ?? 0;
            }
            let brightness = ((val - lo) / range) * 255;
            brightness = Math.max(0, Math.min(255, brightness));
            if (invert) brightness = 255 - brightness;
            const off = (y * w + x) * 4;
            pixels[off] = brightness; pixels[off + 1] = brightness; pixels[off + 2] = brightness; pixels[off + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

// ── ViewPanel ──────────────────────────────────────────────────────────────────
interface PanelProps {
    meta: ViewMeta; canvasRef: React.RefObject<HTMLCanvasElement | null>;
    slice: number; maxSlices: number; onSlice: (v: number) => void;
    onExpand?: () => void; isExpanded?: boolean;
    volume: DicomVolume | null; wc: number; ww: number; invert: boolean;
}

const ViewPanel: React.FC<PanelProps> = React.memo(({
    meta, canvasRef, slice, maxSlices, onSlice, onExpand, isExpanded, volume, wc, ww, invert
}) => {
    const { label, color } = meta;
    const isDragging = useRef(false);
    const lastY = useRef(0);

    useEffect(() => {
        if (!volume || !canvasRef.current) return;
        renderSlice(canvasRef.current, volume, meta.id, slice, wc, ww, invert);
    }, [volume, meta.id, slice, wc, ww, invert, canvasRef]);

    const onWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        if (meta.id === 'mip') return;
        onSlice(Math.max(0, Math.min(slice + (e.deltaY > 0 ? 1 : -1), maxSlices - 1)));
    }, [slice, maxSlices, onSlice, meta.id]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0 && meta.id !== 'mip') { isDragging.current = true; lastY.current = e.clientY; }
    }, [meta.id]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const dy = e.clientY - lastY.current;
        if (Math.abs(dy) > 3) {
            onSlice(Math.max(0, Math.min(slice + (dy > 0 ? 1 : -1), maxSlices - 1)));
            lastY.current = e.clientY;
        }
    }, [slice, maxSlices, onSlice]);

    return (
        <div className="relative flex flex-col overflow-hidden bg-[#0a0c10] rounded-lg border border-slate-800/60"
            style={{ boxShadow: `inset 0 0 0 1px ${color}15` }}>
            <div className="flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 border-b border-slate-800/60"
                style={{ background: `linear-gradient(135deg, ${color}12, transparent)` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[12px] font-semibold tracking-wider uppercase" style={{ color }}>{label}</span>
                {meta.id !== 'mip' && <span className="ml-auto text-[12px] text-slate-500 font-mono">{slice + 1}/{maxSlices}</span>}
                {onExpand && (
                    <button onClick={onExpand} className="p-0.5 rounded hover:bg-slate-700/40 transition-colors text-slate-400">
                        {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    </button>
                )}
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden cursor-crosshair"
                onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
                onMouseUp={() => { isDragging.current = false; }} onMouseLeave={() => { isDragging.current = false; }}>
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" style={{ imageRendering: 'pixelated' }} />
            </div>
            {meta.id !== 'mip' && maxSlices > 1 && (
                <div className="flex-shrink-0 px-2 py-1 border-t border-slate-800/40">
                    <input type="range" min={0} max={maxSlices - 1} value={slice}
                        onChange={e => onSlice(parseInt(e.target.value))}
                        className="w-full h-1 appearance-none bg-slate-700 rounded-full cursor-pointer"
                        style={{ accentColor: color }} />
                </div>
            )}
        </div>
    );
});

// ── Props ──────────────────────────────────────────────────────────────────────
interface DicomViewerProps {
    file?: File | null;
    url?: string;
    onClose?: () => void;
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function DicomViewer({ file, url, onClose }: DicomViewerProps) {
    const [volume, setVolume] = useState<DicomVolume | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [layout, setLayout] = useState<Layout>('2x2');
    const [wc, setWc] = useState(400);
    const [ww, setWw] = useState(2000);
    const [invert, setInvert] = useState(false);
    const [slices, setSlices] = useState({ axial: 0, coronal: 0, sagittal: 0, mip: 0 });

    const axialRef = useRef<HTMLCanvasElement>(null);
    const coronalRef = useRef<HTMLCanvasElement>(null);
    const sagittalRef = useRef<HTMLCanvasElement>(null);
    const mipRef = useRef<HTMLCanvasElement>(null);
    const canvasRefs: Record<ViewId, React.RefObject<HTMLCanvasElement | null>> = {
        axial: axialRef, coronal: coronalRef, sagittal: sagittalRef, mip: mipRef,
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const urlLoadedRef = useRef(false);

    // Set volume helper
    const setVol = useCallback((vol: DicomVolume) => {
        setVolume(vol);
        setWc(vol.windowCenter);
        setWw(vol.windowWidth);
        setSlices({
            axial: Math.floor(vol.depth / 2),
            coronal: Math.floor(vol.height / 2),
            sagittal: Math.floor(vol.width / 2),
            mip: 0,
        });
        setLoading(false);
        setError(null);
    }, []);

    // Load file
    const loadFile = useCallback(async (f: File) => {
        setLoading(true); setError(null);
        try {
            const buffer = await f.arrayBuffer();
            const vol = loadDicomFile(buffer);
            if (!vol) throw new Error('No se pudo parsear el archivo DICOM');
            setVol(vol);
        } catch (err: any) {
            setError(err.message); setLoading(false);
        }
    }, [setVol]);

    // Load from File prop
    useEffect(() => { if (file) loadFile(file); }, [file, loadFile]);

    // Load from URL prop (once)
    useEffect(() => {
        if (!url || file || urlLoadedRef.current) return;
        urlLoadedRef.current = true;
        setLoading(true); setError(null);
        fetch(url)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
            .then(buf => {
                const vol = loadDicomFile(buf);
                if (!vol) throw new Error('Parseo fallido');
                setVol(vol);
            })
            .catch(e => { setError(e.message); setLoading(false); });
    }, [url, file, setVol]);

    // Drag & drop
    const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }, [loadFile]);
    const onDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
    const pickFile = useCallback(() => fileInputRef.current?.click(), []);
    const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) loadFile(f); }, [loadFile]);

    // Helpers
    const maxSlices = useCallback((view: ViewId): number => {
        if (!volume) return 0;
        switch (view) { case 'axial': return volume.depth; case 'coronal': return volume.height; case 'sagittal': return volume.width; case 'mip': return 1; }
    }, [volume]);

    const setSlice = useCallback((view: ViewId, val: number) => setSlices(prev => ({ ...prev, [view]: val })), []);

    const reset = useCallback(() => {
        if (!volume) return;
        setWc(volume.windowCenter); setWw(volume.windowWidth); setInvert(false);
        setSlices({ axial: Math.floor(volume.depth / 2), coronal: Math.floor(volume.height / 2), sagittal: Math.floor(volume.width / 2), mip: 0 });
    }, [volume]);

    // Keyboard shortcuts
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if (k === 'a') setLayout(l => l === 'axial' ? '2x2' : 'axial');
            if (k === 'c') setLayout(l => l === 'coronal' ? '2x2' : 'coronal');
            if (k === 's') setLayout(l => l === 'sagittal' ? '2x2' : 'sagittal');
            if (k === 'm') setLayout(l => l === 'mip' ? '2x2' : 'mip');
            if (k === 'g') setLayout('2x2');
            if (k === 'i') setInvert(v => !v);
            if (k === 'r') reset();
            if (e.key === 'Escape' && onClose) onClose();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [reset, onClose]);

    // W/L mouse drag
    const wlDrag = useRef<{ sx: number; sy: number; swc: number; sww: number } | null>(null);

    // ── RENDER ────────────────────────────────────────────────────────────────
    const visibleViews = layout === '2x2' ? VIEWS : VIEWS.filter(v => v.id === layout);

    // Empty state
    if (!volume && !loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0f14] rounded-xl"
                onDrop={onDrop} onDragOver={onDragOver}>
                <input ref={fileInputRef} type="file" accept=".dcm,.DCM,.dicom" className="hidden" onChange={onFileChange} />
                <div className="flex flex-col items-center gap-6 p-12 rounded-2xl border-2 border-dashed border-slate-700/60
                    hover:border-sky-500/40 transition-all cursor-pointer group" onClick={pickFile}>
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20
                        flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-10 h-10 text-sky-400" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-white mb-1">Cargar archivo DICOM</h3>
                        <p className="text-sm text-slate-400">Arrastra un .dcm aquí o haz clic para seleccionar</p>
                    </div>
                    <div className="flex gap-2">
                        {['CBCT', 'Panorámica', 'Periapical', 'Cefalometría'].map(t => (
                            <span key={t} className="px-2 py-0.5 rounded-full bg-slate-800 text-[12px] text-slate-400 font-medium">{t}</span>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Loading
    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#0d0f14] rounded-xl">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-3 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
                    <span className="text-sm text-slate-400">Cargando volumen DICOM…</span>
                </div>
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#0d0f14] rounded-xl">
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                        <X className="w-6 h-6 text-red-400" />
                    </div>
                    <p className="text-sm text-red-400">{error}</p>
                    <button onClick={() => { setError(null); urlLoadedRef.current = false; }}
                        className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[13px] hover:bg-slate-700 transition">
                        Reintentar
                    </button>
                    <input ref={fileInputRef} type="file" accept=".dcm,.DCM,.dicom" className="hidden" onChange={onFileChange} />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-[#0d0f14] rounded-xl overflow-hidden"
            onContextMenu={e => e.preventDefault()}
            onMouseDown={e => { if (e.button === 2 || e.ctrlKey) { e.preventDefault(); wlDrag.current = { sx: e.clientX, sy: e.clientY, swc: wc, sww: ww }; } }}
            onMouseMove={e => { if (!wlDrag.current) return; setWw(Math.max(1, wlDrag.current.sww + (e.clientX - wlDrag.current.sx) * 4)); setWc(wlDrag.current.swc - (e.clientY - wlDrag.current.sy) * 4); }}
            onMouseUp={() => { wlDrag.current = null; }} onMouseLeave={() => { wlDrag.current = null; }}>

            {/* Toolbar */}
            <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#12141a] border-b border-slate-800/60">
                <div className="flex items-center gap-0.5 mr-3">
                    <button onClick={() => setLayout('2x2')}
                        className={`px-2 py-1 rounded text-[12px] font-semibold transition-all ${layout === '2x2' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Grid3X3 className="w-3.5 h-3.5" />
                    </button>
                    {VIEWS.map(v => (
                        <button key={v.id} onClick={() => setLayout(l => l === v.id ? '2x2' : v.id)}
                            className={`px-2 py-1 rounded text-[12px] font-semibold transition-all ${layout === v.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            style={layout === v.id ? { backgroundColor: `${v.color}25`, color: v.color } : {}}>
                            {v.shortcut}
                        </button>
                    ))}
                </div>
                <div className="w-px h-4 bg-slate-700/60 mx-1" />
                <div className="flex items-center gap-2 mr-3">
                    <Sun className="w-3 h-3 text-slate-500" />
                    <span className="text-[12px] text-slate-400 font-mono">C:{Math.round(wc)} W:{Math.round(ww)}</span>
                </div>
                <button onClick={() => setInvert(!invert)}
                    className={`p-1.5 rounded transition-all ${invert ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Invertir (I)"><FlipVertical className="w-3.5 h-3.5" /></button>
                <button onClick={reset} className="p-1.5 rounded text-slate-500 hover:text-slate-300 transition-all" title="Reset (R)">
                    <RotateCcw className="w-3.5 h-3.5" /></button>
                <div className="flex-1" />
                {volume && <span className="text-[12px] text-slate-500 font-mono mr-2">{volume.width}×{volume.height}×{volume.depth}</span>}
                <button onClick={pickFile} className="p-1.5 rounded text-slate-500 hover:text-sky-400 transition-all" title="Abrir archivo">
                    <Upload className="w-3.5 h-3.5" /></button>
                <input ref={fileInputRef} type="file" accept=".dcm,.DCM,.dicom" className="hidden" onChange={onFileChange} />
                {onClose && <button onClick={onClose} className="p-1.5 rounded text-slate-500 hover:text-red-400 transition-all" title="Cerrar (Esc)"><X className="w-3.5 h-3.5" /></button>}
            </div>

            {/* Viewport grid */}
            <div className={`flex-1 p-1.5 gap-1.5 ${layout === '2x2' ? 'grid grid-cols-2 grid-rows-2' : 'flex'}`}>
                {visibleViews.map(v => (
                    <ViewPanel key={v.id} meta={v} canvasRef={canvasRefs[v.id]}
                        slice={slices[v.id]} maxSlices={maxSlices(v.id)}
                        onSlice={val => setSlice(v.id, val)}
                        onExpand={() => setLayout(l => l === v.id ? '2x2' : v.id)}
                        isExpanded={layout === v.id} volume={volume} wc={wc} ww={ww} invert={invert} />
                ))}
            </div>

            {/* Hints */}
            <div className="flex-shrink-0 flex items-center gap-3 px-3 py-1 bg-[#12141a] border-t border-slate-800/40">
                {[{ key: 'A/C/S/M', label: 'Vista' }, { key: 'G', label: '4-up' }, { key: 'I', label: 'Invertir' },
                { key: 'R', label: 'Reset' }, { key: 'Scroll', label: 'Cortes' }, { key: 'Ctrl+Click', label: 'W/L' }]
                    .map(({ key, label }) => (
                        <span key={key} className="text-[12px] text-slate-600">
                            <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-500 font-mono text-[12px] mr-0.5">{key}</kbd>{label}
                        </span>
                    ))}
            </div>
        </div>
    );
}
