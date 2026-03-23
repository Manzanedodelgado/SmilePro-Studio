/**
 * CbctViewer.tsx — Visor CBCT estilo Romexis
 *
 * Layout:
 *   - Top toolbar (2 rows): acciones + info estudio / tabs de módulo
 *   - Área principal: 4 paneles (Coronal TL, Sagital TR, Axial BL, 3D BR)
 *   - Sidebar derecha: Ajustar / Tools / Anotación / Renderizado 3D / Explorador
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Activity, Trash2,
    ZoomIn, ZoomOut, Move, RotateCcw, Camera,
    Type, Square, Circle, ArrowRight,
    Minus, Plus, ChevronDown, ChevronUp, Layers,
    FolderOpen, Save, RefreshCw, Monitor, Settings,
    X, Maximize2, Ruler,
} from 'lucide-react';
import {
    type DicomVolume,
    type Preset3D,
    renderFrame,
    renderCoronal,
    renderSagittal,
    renderPanoramicaAsync,
    renderArchPanoramicaAsync,
    renderMIPAsync,
    renderCephalometryAsync,
    render3DVolumeAsync,
    renderArchTransversal,
    sampleArchSpline,
    DENTAL_PRESETS,
} from '../../services/dicom.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ViewType = 'axial' | 'coronal' | 'sagital' | 'panoramica' | 'mip' | 'cefa' | 'vol3d' | 'archCross';
type Layout   = '4x' | ViewType;
type ModuleTab = 'imagen3d' | 'explorador' | 'panoramica' | 'implantes' | 'atm' | 'superficie';

interface RulerLine   { x1:number; y1:number; x2:number; y2:number; mm:number; }
interface CrosshairPos { sliceAxial:number; sliceCoronal:number; sliceSagital:number; }
interface ImgRect     { x:number; y:number; w:number; h:number; }
interface RefLine     { frac:number; dir:'h'|'v'; color:string; }

// ── Constantes ────────────────────────────────────────────────────────────────

const VIEW_COLOR: Partial<Record<ViewType, string>> = {
    axial:     '#22d3ee',
    coronal:   '#22c55e',
    sagital:   '#ef4444',
    vol3d:     '#f59e0b',
    panoramica:'#fbbf24',
    mip:       '#f87171',
    cefa:      '#60a5fa',
    archCross: '#a78bfa',
};

const REF_COLOR = {
    sagital: '#ef4444',
    coronal: '#22c55e',
    axial:   '#3b82f6',
} as const;

const ORIENT: Partial<Record<ViewType, { top:string; bottom:string; left:string; right:string }>> = {
    axial:   { top:'A', bottom:'P', left:'R', right:'L' },
    coronal: { top:'S', bottom:'I', left:'R', right:'L' },
    sagital: { top:'S', bottom:'I', left:'A', right:'P' },
};

const IS_SLICE: Record<ViewType, boolean> = {
    axial:true, coronal:true, sagital:true, panoramica:false, mip:false, cefa:false, vol3d:false, archCross:false,
};

const PANEL_LABELS: Record<ViewType, string> = {
    axial:'Axial(Z)', coronal:'Coronal(Y)', sagital:'Sagital(X)',
    panoramica:'Panorámica', mip:'MIP 3D', cefa:'Cefalometría', vol3d:'3D', archCross:'Cortes transversales',
};

const MODULE_TABS: { id: ModuleTab; label: string }[] = [
    { id:'imagen3d',    label:'Imagen 3D'   },
    { id:'explorador',  label:'Explorador'  },
    { id:'panoramica',  label:'Panorámica'  },
    { id:'implantes',   label:'Implantes'   },
    { id:'atm',         label:'ATM'         },
    { id:'superficie',  label:'Superficie'  },
];

const PRESETS_3D: { id: Preset3D; label: string }[] = [
    { id:'tejido_duro',   label:'Tejido duro'   },
    { id:'tejido_blando', label:'Tejido blando'  },
    { id:'piel',          label:'Piel'           },
    { id:'dental',        label:'Dental'         },
    { id:'mip3d',         label:'MIP volumétrico'},
];

// ── ViewPanel ─────────────────────────────────────────────────────────────────

interface ViewPanelProps {
    volume:       DicomVolume;
    type:         ViewType;
    wc:number; ww:number;
    rulerActive:  boolean;
    archControls: Array<[number,number]>;
    archMode:     boolean;
    slabPx:       number;
    onArchAdd:    (pt:[number,number]) => void;
    onArchRemove: (idx:number) => void;
    slice:        number;
    onSliceChange:(s:number) => void;
    crosshair:         CrosshairPos;
    onCrosshairUpdate: (u:Partial<CrosshairPos>) => void;
    preset3D:     Preset3D;
    isFullscreen?: boolean;
    onDoubleClick?: () => void;
    // 3D render params
    rot3D?:         { x: number; y: number };
    onRot3DChange?: (dRotX: number, dRotY: number) => void;
    opacityMul?:    number;
    specMul?:       number;
    ambient3D?:     number;
    diffuse3D?:     number;
}

const ViewPanel: React.FC<ViewPanelProps> = ({
    volume, type, wc, ww, rulerActive,
    archControls, archMode, slabPx, onArchAdd, onArchRemove,
    slice, onSliceChange,
    crosshair, onCrosshairUpdate,
    preset3D, onDoubleClick,
    rot3D, onRot3DChange,
    opacityMul = 1.0, specMul = 1.0, ambient3D = 0.25, diffuse3D = 0.65,
}) => {
    const displayRef   = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const offscreen    = useRef<HTMLCanvasElement>(document.createElement('canvas'));
    const draggingRef  = useRef(false);
    // Drag-to-rotate 3D
    const drag3DRef  = useRef<{ x: number; y: number; accDX: number; accDY: number } | null>(null);
    const [rot3DLive, setRot3DLive] = useState<{ x: number; y: number } | null>(null);

    const maxSlice = type==='axial' ? volume.numFrames-1
                   : type==='coronal' ? volume.rows-1
                   : type==='sagital' ? volume.cols-1 : 0;

    const [zoom,   setZoom]  = useState(1);
    const [panX,   setPanX]  = useState(0);
    const [panY,   setPanY]  = useState(0);
    const panDragRef = useRef<{ sx:number; sy:number; px:number; py:number }|null>(null);

    const [progress,    setProgress]  = useState<number|null>(null);
    const [rulers,      setRulers]    = useState<RulerLine[]>([]);
    const [drawing,     setDrawing]   = useState<{x:number;y:number}|null>(null);
    const [cursorPos,   setCursorPos] = useState<{x:number;y:number}|null>(null);
    const [nativeW,     setNativeW]   = useState(0);
    const [nativeH,     setNativeH]   = useState(0);
    const [displaySize, setDisplaySize] = useState({w:0,h:0});

    const imgRect: ImgRect = useMemo(() => {
        if (!displaySize.w || !displaySize.h || !nativeW || !nativeH)
            return { x:0, y:0, w:displaySize.w||0, h:displaySize.h||0 };
        const scale = Math.min(displaySize.w/nativeW, displaySize.h/nativeH);
        const dw = Math.round(nativeW*scale), dh = Math.round(nativeH*scale);
        return { x:Math.round((displaySize.w-dw)/2), y:Math.round((displaySize.h-dh)/2), w:dw, h:dh };
    }, [displaySize, nativeW, nativeH]);

    const refLines: RefLine[] = useMemo(() => {
        const { sliceAxial, sliceCoronal, sliceSagital } = crosshair;
        const lines: RefLine[] = [];
        if (type==='axial') {
            lines.push({ frac:sliceSagital/Math.max(1,volume.cols-1),    dir:'v', color:REF_COLOR.sagital });
            lines.push({ frac:sliceCoronal/Math.max(1,volume.rows-1),    dir:'h', color:REF_COLOR.coronal });
        } else if (type==='coronal') {
            lines.push({ frac:sliceSagital/Math.max(1,volume.cols-1),    dir:'v', color:REF_COLOR.sagital });
            lines.push({ frac:sliceAxial/Math.max(1,volume.numFrames-1), dir:'h', color:REF_COLOR.axial   });
        } else if (type==='sagital') {
            lines.push({ frac:sliceCoronal/Math.max(1,volume.rows-1),    dir:'v', color:REF_COLOR.coronal });
            lines.push({ frac:sliceAxial/Math.max(1,volume.numFrames-1), dir:'h', color:REF_COLOR.axial   });
        }
        return lines;
    }, [type, crosshair, volume]);

    const rulerTicks = useMemo(() => {
        const ps = volume.pixelSpacing?.[0] ?? 0;
        if (ps <= 0 || !nativeW || !nativeH) return { x:[], y:[] };
        const xTicks: {frac:number; label:string}[] = [];
        const yTicks: {frac:number; label:string}[] = [];
        const wMm = nativeW * ps, hMm = nativeH * ps;
        for (let mm = 10; mm < wMm; mm += 10) {
            xTicks.push({ frac: mm/wMm, label: mm % 50 === 0 ? `${Math.round(mm)}` : '' });
        }
        for (let mm = 10; mm < hMm; mm += 10) {
            yTicks.push({ frac: mm/hMm, label: mm % 50 === 0 ? `${Math.round(mm)}` : '' });
        }
        return { x:xTicks, y:yTicks };
    }, [volume, nativeW, nativeH]);

    const refH = refLines.find(l => l.dir==='h');
    const refV = refLines.find(l => l.dir==='v');
    const orient = ORIENT[type];

    const blit = useCallback(() => {
        const display = displayRef.current;
        if (!display || !display.width || !display.height) return;
        const off = offscreen.current;
        if (!off.width || !off.height) return;
        const ctx = display.getContext('2d'); if (!ctx) return;
        const scale = Math.min(display.width/off.width, display.height/off.height);
        const dw = Math.round(off.width*scale), dh = Math.round(off.height*scale);
        const dx = Math.round((display.width-dw)/2), dy = Math.round((display.height-dh)/2);
        ctx.fillStyle='#000'; ctx.fillRect(0,0,display.width,display.height);
        ctx.drawImage(off, dx, dy, dw, dh);
    }, []);

    useEffect(() => {
        const container=containerRef.current, display=displayRef.current;
        if (!container||!display) return;
        const obs = new ResizeObserver(([e]) => {
            const {width,height} = e.contentRect;
            if (!width||!height) return;
            display.width=Math.round(width); display.height=Math.round(height);
            setDisplaySize({w:Math.round(width),h:Math.round(height)});
            blit();
        });
        obs.observe(container);
        return () => obs.disconnect();
    }, [blit]);

    useEffect(() => {
        const off = offscreen.current;
        let cancelled = false;
        const done = () => {
            if (cancelled) return;
            setNativeW(off.width); setNativeH(off.height);
            setProgress(null); blit();
        };
        if (type==='axial') {
            off.width=volume.cols; off.height=volume.rows;
            const ctx=off.getContext('2d');
            if (ctx) { const id=ctx.createImageData(volume.cols,volume.rows); renderFrame(volume,slice,wc,ww,id); ctx.putImageData(id,0,0); }
            done();
        } else if (type==='coronal') { renderCoronal(volume,slice,wc,ww,off); done();
        } else if (type==='sagital') { renderSagittal(volume,slice,wc,ww,off); done();
        } else if (type==='panoramica') {
            setProgress(0);
            const p = archControls.length>=2
                ? renderArchPanoramicaAsync(volume,archControls,slabPx,wc,ww,off,v=>{if(!cancelled){setProgress(v);blit();}})
                : renderPanoramicaAsync(volume,wc,ww,off,v=>{if(!cancelled){setProgress(v);blit();}});
            p.then(done);
        } else if (type==='mip') {
            setProgress(0);
            renderMIPAsync(volume,wc,ww,off,1,v=>{if(!cancelled){setProgress(v);blit();}}).then(done);
        } else if (type==='cefa') {
            setProgress(0);
            renderCephalometryAsync(volume,wc,ww,off,1,v=>{if(!cancelled){setProgress(v);blit();}}).then(done);
        } else if (type==='vol3d') {
            setProgress(0);
            const rx = rot3D?.x ?? 20, ry = rot3D?.y ?? 15;
            // Etapa 1: previsualización rápida (baja resolución ~0.5s)
            render3DVolumeAsync(volume, preset3D, off, undefined, rx, ry, opacityMul, specMul, ambient3D, diffuse3D, true)
                .then(() => {
                    if (cancelled) return;
                    setNativeW(off.width); setNativeH(off.height);
                    blit();
                    setProgress(0);
                    // Etapa 2: render completo alta resolución
                    render3DVolumeAsync(
                        volume, preset3D, off,
                        v=>{if(!cancelled){setProgress(v);blit();}},
                        rx, ry, opacityMul, specMul, ambient3D, diffuse3D, false,
                    ).then(() => {
                        if (cancelled) return;
                        setNativeW(off.width); setNativeH(off.height);
                        setProgress(null); blit();
                    });
                });
            return () => { cancelled=true; };
        }
        return () => { cancelled=true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [volume, type, slice, wc, ww, archControls, slabPx, preset3D,
        rot3D?.x, rot3D?.y, opacityMul, specMul, ambient3D, diffuse3D]);

    const getPos = useCallback((e:React.MouseEvent) => {
        const rect = containerRef.current!.getBoundingClientRect();
        const cx = rect.width/2, cy = rect.height/2;
        const dx = (e.clientX - rect.left - panX - cx) / zoom + cx;
        const dy = (e.clientY - rect.top  - panY - cy) / zoom + cy;
        return {
            x: Math.max(0,Math.min(1,(dx-imgRect.x)/(imgRect.w||1))),
            y: Math.max(0,Math.min(1,(dy-imgRect.y)/(imgRect.h||1))),
        };
    }, [imgRect, zoom, panX, panY]);

    const moveCrosshair = useCallback((fx:number,fy:number) => {
        if (type==='axial')        { onCrosshairUpdate({ sliceSagital:Math.round(fx*(volume.cols-1)),      sliceCoronal:Math.round(fy*(volume.rows-1)) }); }
        else if (type==='coronal') { onCrosshairUpdate({ sliceSagital:Math.round(fx*(volume.cols-1)),      sliceAxial:Math.round(fy*(volume.numFrames-1)) }); }
        else if (type==='sagital') { onCrosshairUpdate({ sliceCoronal:Math.round(fx*(volume.rows-1)),      sliceAxial:Math.round(fy*(volume.numFrames-1)) }); }
    }, [type, volume, onCrosshairUpdate]);

    const handleWheel = (e:React.WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey || !IS_SLICE[type]) {
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(z => Math.max(0.2, Math.min(10, z * factor)));
        } else {
            onSliceChange(Math.max(0,Math.min(maxSlice,slice+(e.deltaY>0?1:-1))));
        }
    };
    const onMouseDown = (e:React.MouseEvent) => {
        if (e.button===2 && type==='axial' && archMode && archControls.length>0) {
            e.preventDefault();
            // Right-click in arch mode → remove nearest control point
            const f = getPos(e);
            const mc = f.x * volume.cols, mr = f.y * volume.rows;
            let minD = Infinity, minI = -1;
            archControls.forEach(([c,r], i) => {
                const d = Math.sqrt((c-mc)**2 + (r-mr)**2);
                if (d < minD) { minD = d; minI = i; }
            });
            if (minI >= 0 && minD < 20) { onArchRemove(minI); return; }
            panDragRef.current = { sx:e.clientX, sy:e.clientY, px:panX, py:panY };
            return;
        }
        if (e.button===1||e.button===2) {
            e.preventDefault();
            panDragRef.current = { sx:e.clientX, sy:e.clientY, px:panX, py:panY };
            return;
        }
        if (type==='vol3d') {
            drag3DRef.current = { x: e.clientX, y: e.clientY, accDX: 0, accDY: 0 };
            return;
        }
        if (type==='axial'&&archMode) { const f=getPos(e); onArchAdd([Math.round(f.x*volume.cols),Math.round(f.y*volume.rows)]); return; }
        if (rulerActive) { setDrawing(getPos(e)); return; }
        if (IS_SLICE[type]) { draggingRef.current=true; moveCrosshair(getPos(e).x,getPos(e).y); }
    };
    const onMouseMove = (e:React.MouseEvent) => {
        if (panDragRef.current) {
            setPanX(panDragRef.current.px + (e.clientX - panDragRef.current.sx));
            setPanY(panDragRef.current.py + (e.clientY - panDragRef.current.sy));
            return;
        }
        if (type==='vol3d' && drag3DRef.current) {
            drag3DRef.current.accDX = e.clientX - drag3DRef.current.x;
            drag3DRef.current.accDY = e.clientY - drag3DRef.current.y;
            setRot3DLive({
                x: (rot3D?.x ?? 20) + drag3DRef.current.accDY * 0.45,
                y: (rot3D?.y ?? 15) + drag3DRef.current.accDX * 0.45,
            });
            return;
        }
        if (rulerActive) { setCursorPos(getPos(e)); return; }
        if (draggingRef.current&&IS_SLICE[type]) moveCrosshair(getPos(e).x,getPos(e).y);
    };
    const onMouseUp = (e:React.MouseEvent) => {
        if (panDragRef.current) { panDragRef.current=null; return; }
        if (type==='vol3d' && drag3DRef.current) {
            const dY = drag3DRef.current.accDY * 0.45;
            const dX = drag3DRef.current.accDX * 0.45;
            drag3DRef.current = null;
            setRot3DLive(null);
            if (Math.abs(dX) > 1 || Math.abs(dY) > 1) onRot3DChange?.(dY, dX);
            return;
        }
        draggingRef.current=false;
        if (!rulerActive||!drawing) return;
        const end=getPos(e), off=offscreen.current, ps=volume.pixelSpacing?.[1]??0.3;
        const dx=(end.x-drawing.x)*off.width*ps, dy=(end.y-drawing.y)*off.height*ps;
        setRulers(r=>[...r,{x1:drawing.x,y1:drawing.y,x2:end.x,y2:end.y,mm:Math.sqrt(dx*dx+dy*dy)}]);
        setDrawing(null);
    };

    // ── Arch cross-section override ──
    if (type === 'archCross') {
        return (
            <div onDoubleClick={onDoubleClick} style={{ height:'100%', display:'flex', flexDirection:'column', background:'#060809', overflow:'hidden' }}>
                <div style={{ height:22, flexShrink:0, display:'flex', alignItems:'center', padding:'0 6px', gap:4, background:'#0a0c10', borderBottom:'1px solid #a78bfa30' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'#a78bfa', flexShrink:0 }} />
                    <span style={{ color:'#a78bfa', fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', flex:1 }}>
                        Cortes transversales
                        {archControls.length < 2 && <span style={{ color:'#475569', fontWeight:400, marginLeft:6 }}>— dibuja el arco</span>}
                    </span>
                </div>
                <div style={{ flex:1, minHeight:0 }}>
                    {archControls.length >= 2
                        ? <ArchCrossGrid volume={volume} wc={wc} ww={ww} archControls={archControls} slabPx={slabPx} />
                        : <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#334155', fontSize:11 }}>
                            Dibuja el arco en la vista axial para ver los cortes
                          </div>
                    }
                </div>
            </div>
        );
    }

    // ── Sagital override: 6-slice grid ──
    if (type === 'sagital') {
        return (
            <div onDoubleClick={onDoubleClick} style={{ height:'100%', display:'flex', flexDirection:'column', background:'#060809', overflow:'hidden', position:'relative' }}>
                <div style={{ height:22, flexShrink:0, display:'flex', alignItems:'center', padding:'0 6px', gap:4, background:'#0a0c10', borderBottom:'1px solid #ef444430' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', flexShrink:0 }} />
                    <span style={{ color:'#ef4444', fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', flex:1 }}>
                        Sagital(X) — 6 cortes
                        <span style={{ color:'#475569', fontWeight:400, marginLeft:6 }}>{slice+1}/{volume.cols}</span>
                    </span>
                    <button onClick={e=>{e.stopPropagation();onSliceChange(Math.max(0,slice-1));}} style={{ background:'none',border:'none',color:'#334155',cursor:'pointer',padding:0,display:'flex' }}><ChevronLeft style={{width:10,height:10}}/></button>
                    <button onClick={e=>{e.stopPropagation();onSliceChange(Math.min(volume.cols-1,slice+1));}} style={{ background:'none',border:'none',color:'#334155',cursor:'pointer',padding:0,display:'flex' }}><ChevronRight style={{width:10,height:10}}/></button>
                </div>
                <div style={{ flex:1, minHeight:0 }}
                    onWheel={e=>{ e.preventDefault(); onSliceChange(Math.max(0,Math.min(volume.cols-1,slice+(e.deltaY>0?1:-1)))); }}>
                    <SagitalMultiSlice volume={volume} wc={wc} ww={ww} centerSlice={slice} onSliceChange={onSliceChange} />
                </div>
            </div>
        );
    }

    const TRI = 7, TICK_MAJOR = 8, TICK_MINOR = 4;
    const W = imgRect.w||1, H = imgRect.h||1;
    const color = VIEW_COLOR[type] ?? '#64748b';
    const activeCursor = panDragRef.current ? 'grabbing'
        : type==='vol3d' ? (drag3DRef.current ? 'grabbing' : 'grab')
        : (type==='axial'&&archMode)||rulerActive ? 'crosshair' : IS_SLICE[type] ? 'crosshair' : 'grab';
    const archSplineD = (() => {
        if (type!=='axial'||archControls.length<2) return null;
        return sampleArchSpline(archControls,archControls.length*20)
            .map((p,i)=>`${i===0?'M':'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    })();

    return (
        <div onDoubleClick={onDoubleClick} style={{ height:'100%', display:'flex', flexDirection:'column', background:'#060809', overflow:'hidden', position:'relative' }}>

            {/* Label bar */}
            <div style={{ height:22, flexShrink:0, display:'flex', alignItems:'center', padding:'0 6px', gap:4, background:'#0a0c10', borderBottom:`1px solid ${color}30` }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }} />
                <span style={{ color, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', flex:1 }}>
                    {PANEL_LABELS[type]}
                    {IS_SLICE[type] && (
                        <span style={{ color:'#475569', fontWeight:400, marginLeft:6 }}>
                            {slice+1}/{maxSlice+1}
                        </span>
                    )}
                </span>
                {(zoom!==1||panX!==0||panY!==0)&&(
                    <button onClick={e=>{e.stopPropagation();setZoom(1);setPanX(0);setPanY(0);}} title="Restablecer zoom/pan" style={{ background:'none',border:'none',color:'#64748b',cursor:'pointer',padding:'0 3px',fontSize:10 }}>⊙</button>
                )}
                {IS_SLICE[type]&&<>
                    <button onClick={e=>{e.stopPropagation();onSliceChange(Math.max(0,slice-1));}} style={{ background:'none',border:'none',color:'#334155',cursor:'pointer',padding:0,display:'flex' }}><ChevronLeft style={{width:10,height:10}}/></button>
                    <button onClick={e=>{e.stopPropagation();onSliceChange(Math.min(maxSlice,slice+1));}} style={{ background:'none',border:'none',color:'#334155',cursor:'pointer',padding:0,display:'flex' }}><ChevronRight style={{width:10,height:10}}/></button>
                </>}
            </div>

            {/* Canvas container */}
            <div ref={containerRef} style={{ flex:1, minHeight:0, position:'relative', background:'#000', cursor:activeCursor, overflow:'hidden' }}
                onWheel={handleWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                onContextMenu={e=>e.preventDefault()}
                onMouseLeave={()=>{
                    setCursorPos(null); draggingRef.current=false;
                    panDragRef.current=null;
                    if (drag3DRef.current) { drag3DRef.current=null; setRot3DLive(null); }
                }}>

                {/* Zoom/pan transform wrapper */}
                <div style={{ position:'absolute', inset:0, transform:`translate(${panX}px,${panY}px) scale(${zoom})`, transformOrigin:'center', pointerEvents:'none' }}>

                <canvas ref={displayRef} style={{ position:'absolute', inset:0, display:'block' }} />

                {/* Image overlays */}
                {imgRect.w>0&&imgRect.h>0&&(
                    <div style={{ position:'absolute', left:imgRect.x, top:imgRect.y, width:imgRect.w, height:imgRect.h, pointerEvents:'none', zIndex:3 }}>

                        <div style={{ position:'absolute', inset:0, border:`1px solid ${color}30` }} />

                        {/* Scale bar */}
                        {IS_SLICE[type]&&volume.pixelSpacing&&volume.pixelSpacing[0]>0&&nativeW>0&&(()=>{
                            const ps = volume.pixelSpacing![0];
                            const tenMmFrac = Math.min(0.35, 10/(ps*nativeW));
                            return (
                                <div style={{ position:'absolute',bottom:18,left:8 }}>
                                    <div style={{ color:'#e2e8f0',fontSize:9,fontWeight:600,marginBottom:2 }}>10 mm</div>
                                    <div style={{ height:2,width:`${tenMmFrac*100}%`,minWidth:16,background:'#e2e8f0' }} />
                                </div>
                            );
                        })()}

                        {/* Orientation labels */}
                        {orient&&<>
                            <span style={{ position:'absolute',top:2,left:'50%',transform:'translateX(-50%)',color:'#e2e8f0',fontSize:11,fontWeight:800,textShadow:'0 1px 2px #000' }}>{orient.top}</span>
                            <span style={{ position:'absolute',bottom:2,left:'50%',transform:'translateX(-50%)',color:'#e2e8f0',fontSize:11,fontWeight:800,textShadow:'0 1px 2px #000' }}>{orient.bottom}</span>
                            <span style={{ position:'absolute',left:2,top:'50%',transform:'translateY(-50%)',color:'#e2e8f0',fontSize:11,fontWeight:800,textShadow:'0 1px 2px #000' }}>{orient.left}</span>
                            <span style={{ position:'absolute',right:2,top:'50%',transform:'translateY(-50%)',color:'#e2e8f0',fontSize:11,fontWeight:800,textShadow:'0 1px 2px #000' }}>{orient.right}</span>
                        </>}

                        {/* SVG: ref lines + ticks + triangles */}
                        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                            style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>

                            {rulerTicks.x.map((t,i)=>(
                                <g key={`xt${i}`}>
                                    <line x1={t.frac*W} y1={0} x2={t.frac*W} y2={t.label?TICK_MAJOR:TICK_MINOR} stroke="#475569" strokeWidth={0.5} />
                                    <line x1={t.frac*W} y1={H} x2={t.frac*W} y2={H-(t.label?TICK_MAJOR:TICK_MINOR)} stroke="#475569" strokeWidth={0.5} />
                                    {t.label&&<text x={t.frac*W+2} y={TICK_MAJOR+8} fontSize={Math.max(8,H*0.025)} fill="#334155">{t.label}</text>}
                                </g>
                            ))}
                            {rulerTicks.y.map((t,i)=>(
                                <g key={`yt${i}`}>
                                    <line x1={0} y1={t.frac*H} x2={t.label?TICK_MAJOR:TICK_MINOR} y2={t.frac*H} stroke="#475569" strokeWidth={0.5} />
                                    <line x1={W} y1={t.frac*H} x2={W-(t.label?TICK_MAJOR:TICK_MINOR)} y2={t.frac*H} stroke="#475569" strokeWidth={0.5} />
                                    {t.label&&<text x={TICK_MAJOR+2} y={t.frac*H-2} fontSize={Math.max(8,W*0.025)} fill="#334155">{t.label}</text>}
                                </g>
                            ))}

                            {refLines.map((rl,i)=>{
                                if (rl.dir==='h') {
                                    const y = rl.frac*H;
                                    return <g key={i}>
                                        <line x1={0} y1={y} x2={W} y2={y} stroke={rl.color} strokeWidth={1} opacity={0.8} />
                                        <polygon points={`0,${y} ${TRI},${y-TRI*0.65} ${TRI},${y+TRI*0.65}`} fill={rl.color} opacity={0.95} />
                                        <polygon points={`${W},${y} ${W-TRI},${y-TRI*0.65} ${W-TRI},${y+TRI*0.65}`} fill={rl.color} opacity={0.95} />
                                    </g>;
                                } else {
                                    const x = rl.frac*W;
                                    return <g key={i}>
                                        <line x1={x} y1={0} x2={x} y2={H} stroke={rl.color} strokeWidth={1} opacity={0.8} />
                                        <polygon points={`${x},0 ${x-TRI*0.65},${TRI} ${x+TRI*0.65},${TRI}`} fill={rl.color} opacity={0.95} />
                                        <polygon points={`${x},${H} ${x-TRI*0.65},${H-TRI} ${x+TRI*0.65},${H-TRI}`} fill={rl.color} opacity={0.95} />
                                    </g>;
                                }
                            })}
                            {refH&&refV&&(
                                <circle cx={refV.frac*W} cy={refH.frac*H} r={5} fill="none" stroke="#fff" strokeWidth={1} opacity={0.6} />
                            )}
                        </svg>

                        {/* Arch spline */}
                        {type==='axial'&&archControls.length>0&&(
                            <svg viewBox={`0 0 ${volume.cols} ${volume.rows}`} preserveAspectRatio="none"
                                style={{ position:'absolute',inset:0,width:'100%',height:'100%' }}>
                                {archSplineD&&<path d={archSplineD} stroke="#22d3ee" strokeWidth={2} fill="none" opacity={0.9} />}
                                {archControls.map((p,i)=>(
                                    <circle key={i} cx={p[0]} cy={p[1]} r={i===0||i===archControls.length-1?5:4}
                                        fill={i===0?'#22d3ee':i===archControls.length-1?'#f59e0b':'#38bdf8'}
                                        stroke="#0c4a6e" strokeWidth={1} />
                                ))}
                            </svg>
                        )}

                        {/* Rulers */}
                        {(rulers.length>0||(drawing&&cursorPos))&&(
                            <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%' }}>
                                {rulers.map((r,i)=>{
                                    const mx=`${(r.x1+r.x2)/2*100}%`,my=`${((r.y1+r.y2)/2-0.04)*100}%`;
                                    return <g key={i}>
                                        <line x1={`${r.x1*100}%`} y1={`${r.y1*100}%`} x2={`${r.x2*100}%`} y2={`${r.y2*100}%`} stroke="#fbbf24" strokeWidth={1.5} />
                                        <circle cx={`${r.x1*100}%`} cy={`${r.y1*100}%`} r={4} fill="#fbbf24" />
                                        <circle cx={`${r.x2*100}%`} cy={`${r.y2*100}%`} r={4} fill="#fbbf24" />
                                        <text x={mx} y={my} fontSize={11} fill="#fbbf24" textAnchor="middle" fontWeight={700} fontFamily="monospace">{r.mm.toFixed(1)} mm</text>
                                    </g>;
                                })}
                                {drawing&&cursorPos&&(
                                    <line x1={`${drawing.x*100}%`} y1={`${drawing.y*100}%`}
                                        x2={`${cursorPos.x*100}%`} y2={`${cursorPos.y*100}%`}
                                        stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="6 3" />
                                )}
                            </svg>
                        )}
                    </div>
                )}

                </div>{/* end zoom/pan transform wrapper */}

                {/* Progress bar — outside transform */}
                {progress!==null&&(
                    <div style={{ position:'absolute',bottom:0,left:0,right:0,height:3,background:'#1e2535',zIndex:10 }}>
                        <div style={{ height:'100%',width:`${progress*100}%`,background:color,transition:'width 0.1s' }} />
                    </div>
                )}
                {/* Loading overlay for 3D */}
                {type==='vol3d'&&progress!==null&&!rot3DLive&&(
                    <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,pointerEvents:'none' }}>
                        <div style={{ background:'#0a0c10cc',padding:'8px 16px',borderRadius:8,color:'#f59e0b',fontSize:11,fontWeight:700 }}>
                            Renderizando 3D… {Math.round(progress*100)}%
                        </div>
                    </div>
                )}
                {/* Drag rotation indicator */}
                {type==='vol3d'&&rot3DLive&&(
                    <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:11,pointerEvents:'none' }}>
                        <div style={{ background:'#0a0c10dd',padding:'8px 14px',borderRadius:8,color:'#f59e0b',fontSize:11,fontWeight:700,letterSpacing:'0.04em' }}>
                            ↕ {rot3DLive.x.toFixed(0)}°  ↔ {rot3DLive.y.toFixed(0)}°
                        </div>
                    </div>
                )}
                {/* Zoom level badge */}
                {zoom!==1&&(
                    <div style={{ position:'absolute',top:4,right:6,zIndex:10,pointerEvents:'none',color:'#64748b',fontSize:9,fontFamily:'monospace' }}>
                        {zoom.toFixed(1)}×
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Sagital multi-slice components ─────────────────────────────────────────────

const SagitalSliceCell: React.FC<{
    volume: DicomVolume; wc: number; ww: number; slice: number;
    isCenter: boolean; onClick: ()=>void;
}> = ({ volume, wc, ww, slice, isCenter, onClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const offscreen    = useRef(document.createElement('canvas'));

    const paint = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.width || !canvas.height) return;
        const off = offscreen.current;
        if (!off.width || !off.height) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const scale = Math.min(canvas.width/off.width, canvas.height/off.height);
        const dw = Math.round(off.width*scale), dh = Math.round(off.height*scale);
        const dx = Math.round((canvas.width-dw)/2), dy = Math.round((canvas.height-dh)/2);
        ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(off, dx, dy, dw, dh);
    }, []);

    useEffect(() => {
        renderSagittal(volume, slice, wc, ww, offscreen.current);
        paint();
    }, [volume, slice, wc, ww, paint]);

    useEffect(() => {
        const container = containerRef.current, canvas = canvasRef.current;
        if (!container || !canvas) return;
        const obs = new ResizeObserver(([e]) => {
            const { width, height } = e.contentRect;
            if (!width || !height) return;
            canvas.width = Math.round(width); canvas.height = Math.round(height);
            paint();
        });
        obs.observe(container);
        return () => obs.disconnect();
    }, [paint]);

    return (
        <div ref={containerRef} onClick={onClick}
            style={{ position:'relative', background:'#000', cursor:'pointer', overflow:'hidden',
                border: isCenter ? '1.5px solid #ef4444' : '1px solid #1e2535' }}>
            <canvas ref={canvasRef} style={{ position:'absolute', inset:0, display:'block' }} />
            <div style={{ position:'absolute',top:2,left:4,color:isCenter?'#ef4444':'#475569',fontSize:9,fontWeight:700,pointerEvents:'none',textShadow:'0 1px 2px #000' }}>
                S {slice+1}
            </div>
        </div>
    );
};

const SagitalMultiSlice: React.FC<{
    volume: DicomVolume; wc: number; ww: number;
    centerSlice: number; onSliceChange: (s:number)=>void;
}> = ({ volume, wc, ww, centerSlice, onSliceChange }) => {
    const maxS = volume.cols - 1;
    // 6 slices: center-2, center-1, center, center+1, center+2, center+3
    const slices = [-2,-1,0,1,2,3].map(o => Math.max(0, Math.min(maxS, centerSlice + o)));
    return (
        <div style={{ height:'100%', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gridTemplateRows:'1fr 1fr', gap:2, background:'#060809' }}>
            {slices.map((s,i) => (
                <SagitalSliceCell key={i} volume={volume} wc={wc} ww={ww} slice={s}
                    isCenter={s===centerSlice} onClick={()=>onSliceChange(s)} />
            ))}
        </div>
    );
};

// ── Arch transversal cross-section components ──────────────────────────────────

const N_ARCH_SECTIONS = 6;

const ArchCrossCell: React.FC<{
    volume: DicomVolume; archControls: Array<[number,number]>;
    sectionIdx: number; nSections: number; slabPx: number;
    wc: number; ww: number;
}> = ({ volume, archControls, sectionIdx, nSections, slabPx, wc, ww }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const offscreen    = useRef(document.createElement('canvas'));

    const paint = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.width || !canvas.height) return;
        const off = offscreen.current;
        if (!off.width || !off.height) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const scale = Math.min(canvas.width/off.width, canvas.height/off.height);
        const dw = Math.round(off.width*scale), dh = Math.round(off.height*scale);
        const dx = Math.round((canvas.width-dw)/2), dy = Math.round((canvas.height-dh)/2);
        ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(off, dx, dy, dw, dh);
    }, []);

    useEffect(() => {
        renderArchTransversal(volume, archControls, sectionIdx, nSections, 40, Math.max(1,Math.floor(slabPx/4)), wc, ww, offscreen.current);
        paint();
    }, [volume, archControls, sectionIdx, nSections, slabPx, wc, ww, paint]);

    useEffect(() => {
        const container = containerRef.current, canvas = canvasRef.current;
        if (!container || !canvas) return;
        const obs = new ResizeObserver(([e]) => {
            const { width, height } = e.contentRect;
            if (!width || !height) return;
            canvas.width = Math.round(width); canvas.height = Math.round(height);
            paint();
        });
        obs.observe(container);
        return () => obs.disconnect();
    }, [paint]);

    const label = `T${sectionIdx + 1}`;
    return (
        <div ref={containerRef} style={{ position:'relative', background:'#000', overflow:'hidden', border:'1px solid #1e2535' }}>
            <canvas ref={canvasRef} style={{ position:'absolute', inset:0, display:'block' }} />
            <div style={{ position:'absolute',top:2,left:4,color:'#a78bfa',fontSize:9,fontWeight:700,pointerEvents:'none',textShadow:'0 1px 2px #000' }}>
                {label}
            </div>
        </div>
    );
};

const ArchCrossGrid: React.FC<{
    volume: DicomVolume; wc: number; ww: number;
    archControls: Array<[number,number]>; slabPx: number;
}> = ({ volume, wc, ww, archControls, slabPx }) => (
    <div style={{ height:'100%', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gridTemplateRows:'1fr 1fr', gap:2, background:'#060809' }}>
        {Array.from({ length: N_ARCH_SECTIONS }, (_, i) => (
            <ArchCrossCell key={i} volume={volume} archControls={archControls}
                sectionIdx={i} nSections={N_ARCH_SECTIONS} slabPx={slabPx}
                wc={wc} ww={ww} />
        ))}
    </div>
);

// ── Sidebar Section wrapper ────────────────────────────────────────────────────

const SideSection: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen=true, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ borderBottom:'1px solid #1e2535' }}>
            <button onClick={()=>setOpen(o=>!o)} style={{ width:'100%', padding:'6px 10px', background:'#0d1018', border:'none', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', color:'#94a3b8' }}>
                <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>{title}</span>
                {open ? <ChevronUp style={{width:12,height:12,color:'#475569'}} /> : <ChevronDown style={{width:12,height:12,color:'#475569'}} />}
            </button>
            {open&&<div style={{ padding:'8px 10px', background:'#0a0c10' }}>{children}</div>}
        </div>
    );
};

// ── IconBtn helper ─────────────────────────────────────────────────────────────

const IconBtn: React.FC<{ icon: React.ReactNode; title: string; active?: boolean; onClick?: () => void; color?: string }> = ({ icon, title, active, onClick, color }) => (
    <button title={title} onClick={onClick} style={{
        width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
        border:`1px solid ${active ? (color||'#3b82f6') : '#1e2535'}`,
        borderRadius:5, cursor:'pointer',
        background: active ? `${color||'#3b82f6'}22` : 'transparent',
        color: active ? (color||'#93c5fd') : '#475569',
    }}>
        {icon}
    </button>
);

// ── Pequeños helpers de UI ────────────────────────────────────────────────────

const toolBtnStyle: React.CSSProperties = {
    display:'flex', alignItems:'center', gap:4, padding:'3px 7px',
    background:'#141820', border:'1px solid #1e2535', borderRadius:5,
    cursor:'pointer', color:'#64748b', fontSize:10, flexShrink:0,
};

const tabBtnStyle: React.CSSProperties = {
    padding:'0 10px', border:'none', background:'transparent',
    cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', gap:4,
};

const sideBtnStyle: React.CSSProperties = {
    width:18, height:18, border:'1px solid #1e2535', borderRadius:3,
    background:'#141820', cursor:'pointer', color:'#475569',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
};

// Micro layout grid icon
const LayoutGrid4: React.FC = () => (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <rect x={1} y={1} width={5} height={5} rx={1} stroke="currentColor" strokeWidth={1.2} />
        <rect x={8} y={1} width={5} height={5} rx={1} stroke="currentColor" strokeWidth={1.2} />
        <rect x={1} y={8} width={5} height={5} rx={1} stroke="currentColor" strokeWidth={1.2} />
        <rect x={8} y={8} width={5} height={5} rx={1} stroke="currentColor" strokeWidth={1.2} />
    </svg>
);

const AngleIcon: React.FC = () => (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
        <path d="M2 10 L2 2 L10 10" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        <path d="M2 7 Q4 7 5 10" stroke="currentColor" strokeWidth={1} fill="none" />
    </svg>
);

// ── CbctViewer ─────────────────────────────────────────────────────────────────

interface CbctViewerProps { volume: DicomVolume; onClose?: () => void; }

const CbctViewer: React.FC<CbctViewerProps> = ({ volume, onClose }) => {
    const [layout,       setLayout]       = useState<Layout>('4x');
    const [module,       setModule]       = useState<ModuleTab>('imagen3d');
    // Para CBCT dental, preset Hueso (WC=400, WW=1500) si el DICOM no tiene buenos valores
    const [wc,           setWc]           = useState(volume.defaultWW > 500 ? volume.defaultWC : 400);
    const [ww,           setWw]           = useState(volume.defaultWW > 500 ? volume.defaultWW : 1500);
    const [brightness,   setBrightness]   = useState(0);
    const [ruler,        setRuler]        = useState(false);
    const [archMode,     setArchMode]     = useState(false);
    const [archControls, setArchControls] = useState<Array<[number,number]>>([]);
    const [slabPx,       setSlabPx]       = useState(20);
    const [sliceAxial,   setSliceAxial]   = useState(Math.floor(volume.numFrames/2));
    const [sliceCoronal, setSliceCoronal] = useState(Math.floor(volume.rows/2));
    const [sliceSagital, setSliceSagital] = useState(Math.floor(volume.cols/2));
    const [preset3D,     setPreset3D]     = useState<Preset3D>('tejido_duro');
    const [sideOpen,     setSideOpen]     = useState(true);
    const [fullPanel,    setFullPanel]    = useState<ViewType | null>(null);

    // 3D render sliders — valores por defecto optimizados para CBCT dental
    const [r3dThresh,  setR3dThresh]  = useState(14);
    const [r3dOpacity, setR3dOpacity] = useState(90);   // más opaco
    const [r3dShine,   setR3dShine]   = useState(18);   // más brillo especular
    const [r3dAmbient, setR3dAmbient] = useState(15);   // ambiente oscuro para contraste
    const [r3dDiffuse, setR3dDiffuse] = useState(75);   // difuso fuerte para relieve

    // 3D rotation (drag)
    const [rot3DX, setRot3DX] = useState(20);
    const [rot3DY, setRot3DY] = useState(15);
    const handleRot3DChange = useCallback((dX: number, dY: number) => {
        setRot3DX(x => Math.max(-90, Math.min(90, x + dX)));
        setRot3DY(y => ((y + dY) % 360 + 360) % 360);
    }, []);

    const crosshair: CrosshairPos = { sliceAxial, sliceCoronal, sliceSagital };

    const updateCrosshair = useCallback((u:Partial<CrosshairPos>) => {
        if (u.sliceAxial!==undefined)   setSliceAxial(u.sliceAxial);
        if (u.sliceCoronal!==undefined) setSliceCoronal(u.sliceCoronal);
        if (u.sliceSagital!==undefined) setSliceSagital(u.sliceSagital);
    }, []);

    const addArchPoint    = useCallback((pt:[number,number]) => setArchControls(prev=>[...prev,pt]), []);
    const removeArchPoint = useCallback((idx:number) => setArchControls(prev=>prev.filter((_,i)=>i!==idx)), []);
    const clearArch       = () => { setArchControls([]); setArchMode(false); };

    // Arco por defecto cuando se activa el módulo Panorámica
    const defaultArch = useCallback((): Array<[number,number]> => {
        const c = volume.cols, r = volume.rows;
        return [
            [Math.round(0.19*c), Math.round(0.63*r)],
            [Math.round(0.27*c), Math.round(0.43*r)],
            [Math.round(0.37*c), Math.round(0.29*r)],
            [Math.round(0.50*c), Math.round(0.23*r)],
            [Math.round(0.63*c), Math.round(0.29*r)],
            [Math.round(0.73*c), Math.round(0.43*r)],
            [Math.round(0.81*c), Math.round(0.63*r)],
        ];
    }, [volume.cols, volume.rows]);

    // Auto-apply default arch when switching to panorámica module
    const [prevModule, setPrevModule] = useState(module);
    if (module !== prevModule) {
        setPrevModule(module);
        if (module === 'panoramica' && archControls.length === 0) {
            setArchControls(defaultArch());
            setArchMode(false);
        }
    }

    // Study metadata string
    const ps   = volume.pixelSpacing?.[0] ?? 0;
    const fovMm = ps > 0 ? (ps * volume.cols / 10).toFixed(1) : '—';
    const studyInfo = [
        volume.studyDate ? `${volume.studyDate.slice(0,4)}/${volume.studyDate.slice(4,6)}/${volume.studyDate.slice(6,8)}` : null,
        ps > 0 ? `Ø${fovMm} cm` : null,
        `(${volume.cols} × ${volume.rows} × ${volume.numFrames})`,
        ps > 0 ? `${(ps * 10).toFixed(3)} mm` : null,
        volume.modality,
    ].filter(Boolean).join(' – ');

    const patientName = volume.patientId ?? 'PACIENTE';

    const effectiveWc = wc + brightness * 10;

    const common = {
        volume, wc: effectiveWc, ww: Math.max(1, ww),
        rulerActive: ruler,
        archControls, archMode: false, slabPx, onArchAdd: addArchPoint, onArchRemove: removeArchPoint,
        crosshair, onCrosshairUpdate: updateCrosshair,
        preset3D,
        rot3D: { x: rot3DX, y: rot3DY },
        onRot3DChange: handleRot3DChange,
        opacityMul:  r3dOpacity / 50,       // 0-100 → 0-2
        specMul:     r3dShine   / 50,
        ambient3D:   r3dAmbient / 100,       // 0-100 → 0-1
        diffuse3D:   r3dDiffuse / 100,
    };

    // Panel layout según módulo activo
    type PanelDef = { type: ViewType; slice: number; setSlice: (s:number)=>void; archMode?: boolean };
    type GridDef  = { cols: string; rows: string };

    const { PANELS, GRID }: { PANELS: PanelDef[]; GRID: GridDef } = useMemo(() => {
        switch (module) {
            case 'panoramica':
                return {
                    GRID: { cols:'1fr 1.6fr 1fr', rows:'1fr' },
                    PANELS: [
                        { type:'axial'     as ViewType, slice:sliceAxial, setSlice:setSliceAxial, archMode:true },
                        { type:'panoramica'as ViewType, slice:0,          setSlice:()=>{}                       },
                        { type:'archCross' as ViewType, slice:0,          setSlice:()=>{}                       },
                    ],
                };
            case 'superficie':
                return {
                    GRID: { cols:'1fr', rows:'1fr' },
                    PANELS: [
                        { type:'vol3d' as ViewType, slice:0, setSlice:()=>{} },
                    ],
                };
            case 'atm':
                return {
                    GRID: { cols:'1fr 1fr', rows:'1fr 1fr' },
                    PANELS: [
                        { type:'axial'   as ViewType, slice:sliceAxial,   setSlice:setSliceAxial   },
                        { type:'coronal' as ViewType, slice:sliceCoronal, setSlice:setSliceCoronal  },
                        { type:'sagital' as ViewType, slice:Math.floor(volume.cols * 0.33), setSlice:()=>{} },
                        { type:'sagital' as ViewType, slice:Math.floor(volume.cols * 0.67), setSlice:()=>{} },
                    ],
                };
            case 'implantes':
                return {
                    GRID: { cols:'1fr 1fr', rows:'1fr 1fr' },
                    PANELS: [
                        { type:'axial'   as ViewType, slice:sliceAxial,   setSlice:setSliceAxial   },
                        { type:'sagital' as ViewType, slice:sliceSagital, setSlice:setSliceSagital },
                        { type:'coronal' as ViewType, slice:sliceCoronal, setSlice:setSliceCoronal },
                        { type:'vol3d'   as ViewType, slice:0,            setSlice:()=>{} },
                    ],
                };
            default: // imagen3d, explorador
                return {
                    GRID: { cols:'1fr 1fr', rows:'1fr 1fr' },
                    PANELS: [
                        { type:'panoramica' as ViewType, slice:0,            setSlice:()=>{}          }, // TL
                        { type:'sagital'    as ViewType, slice:sliceSagital, setSlice:setSliceSagital }, // TR
                        { type:'axial'      as ViewType, slice:sliceAxial,   setSlice:setSliceAxial, archMode }, // BL
                        { type:'vol3d'      as ViewType, slice:0,            setSlice:()=>{}          }, // BR
                    ],
                };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [module, sliceAxial, sliceCoronal, sliceSagital, archMode, volume.cols]);

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#070910', userSelect:'none' }}>

            {/* ── Top bar row 1: actions + study info + patient ── */}
            <div style={{ height:36, flexShrink:0, display:'flex', alignItems:'center', gap:4, padding:'0 8px', background:'#0d1018', borderBottom:'1px solid #1e2535' }}>
                {/* File actions */}
                <button style={toolBtnStyle} title="Abrir DICOM">
                    <FolderOpen style={{width:12,height:12}} />
                    <span style={{fontSize:10}}>Abrir DICOM</span>
                </button>
                <button style={toolBtnStyle} title="Abrir DICOMDIR">
                    <Layers style={{width:12,height:12}} />
                    <span style={{fontSize:10}}>Abrir DICOMDIR</span>
                </button>
                <div style={{ width:1, height:20, background:'#1e2535', margin:'0 4px' }} />

                {/* Study info */}
                <span style={{ flex:1, color:'#475569', fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>
                    {studyInfo}
                </span>

                {/* Right actions */}
                <button style={toolBtnStyle} title="Guardar vista">
                    <Save style={{width:11,height:11}} />
                    <span style={{fontSize:10}}>Guardar vista</span>
                </button>
                <button style={toolBtnStyle} title="Restablecer vista" onClick={()=>{ setWc(volume.defaultWC); setWw(volume.defaultWW); setBrightness(0); }}>
                    <RefreshCw style={{width:11,height:11}} />
                    <span style={{fontSize:10}}>Rest. vista</span>
                </button>
                <button style={toolBtnStyle} title="Guardar en 2D">
                    <Camera style={{width:11,height:11}} />
                    <span style={{fontSize:10}}>Guardar en 2D</span>
                </button>
                <button style={toolBtnStyle} title="Propiedades de imagen">
                    <Settings style={{width:11,height:11}} />
                    <span style={{fontSize:10}}>Prop. Img</span>
                </button>
                <div style={{ width:1, height:20, background:'#1e2535', margin:'0 4px' }} />

                {/* Patient name */}
                <span style={{ color:'#94a3b8', fontSize:11, fontWeight:700, minWidth:80, textAlign:'right', whiteSpace:'nowrap' }}>
                    {patientName}
                </span>
                <div style={{ width:1, height:20, background:'#1e2535', margin:'0 4px' }} />
                <span style={{ color:'#f97316', fontSize:11, fontWeight:800, letterSpacing:'0.05em' }}>Romexis</span>

                {onClose&&(
                    <button onClick={onClose} style={{ marginLeft:4, width:24, height:24, border:'none', borderRadius:4, cursor:'pointer', background:'transparent', color:'#475569', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <X style={{width:13,height:13}} />
                    </button>
                )}
            </div>

            {/* ── Top bar row 2: module tabs ── */}
            <div style={{ height:32, flexShrink:0, display:'flex', alignItems:'stretch', background:'#0a0c10', borderBottom:'1px solid #1e2535', paddingLeft:4 }}>
                {MODULE_TABS.map(t => (
                    <button key={t.id} onClick={()=>{ setModule(t.id); setLayout('4x'); setFullPanel(null); }} style={{
                        padding:'0 14px', border:'none', borderBottom:`2px solid ${module===t.id?'#3b82f6':'transparent'}`,
                        background:'transparent', cursor:'pointer',
                        color: module===t.id ? '#93c5fd' : '#475569',
                        fontSize:11, fontWeight: module===t.id ? 700 : 500,
                        transition:'all 0.12s',
                    }}>
                        {t.label}
                    </button>
                ))}
                <div style={{ flex:1 }} />
                {/* Layout buttons */}
                <button onClick={()=>setLayout('4x')} style={{ ...tabBtnStyle, color:layout==='4x'?'#93c5fd':'#475569', borderBottom:layout==='4x'?'2px solid #3b82f6':'2px solid transparent' }} title="4 paneles">
                    <LayoutGrid4 />
                </button>
                {(['coronal','sagital','axial','vol3d'] as ViewType[]).map(v => (
                    <button key={v} onClick={()=>setLayout(v)} style={{ ...tabBtnStyle, color:layout===v?(VIEW_COLOR[v]??'#475569'):'#475569', borderBottom:layout===v?`2px solid ${VIEW_COLOR[v]??'#3b82f6'}`:'2px solid transparent', fontSize:10 }}>
                        {PANEL_LABELS[v].split('(')[0].trim()}
                    </button>
                ))}
                <div style={{ width:1, height:'100%', background:'#1e2535' }} />
                <button onClick={()=>setSideOpen(o=>!o)} style={tabBtnStyle} title="Panel lateral">
                    <Monitor style={{width:12,height:12,color:'#475569'}} />
                </button>
            </div>

            {/* ── Main area ── */}
            <div style={{ flex:1, minHeight:0, display:'flex' }}>

                {/* Viewports */}
                <div style={{ flex:1, minWidth:0, padding:3 }}>
                    {fullPanel ? (
                        <div style={{ height:'100%' }}>
                            {PANELS.filter(p=>p.type===fullPanel).map(p=>(
                                <ViewPanel key={p.type} {...common}
                                    type={p.type}
                                    archMode={p.archMode??false}
                                    slice={p.slice}
                                    onSliceChange={p.setSlice}
                                    onDoubleClick={()=>setFullPanel(null)}
                                />
                            ))}
                        </div>
                    ) : layout==='4x' ? (
                        <div style={{ display:'grid', gridTemplateColumns:GRID.cols, gridTemplateRows:GRID.rows, gap:3, height:'100%' }}>
                            {PANELS.map((p,i)=>(
                                <ViewPanel key={`${p.type}-${i}`} {...common}
                                    type={p.type}
                                    archMode={p.archMode??false}
                                    slice={p.slice}
                                    onSliceChange={p.setSlice}
                                    onDoubleClick={()=>setFullPanel(p.type)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div style={{ height:'100%' }}>
                            {PANELS.filter(p=>p.type===layout).slice(0,1).map((p,i)=>(
                                <ViewPanel key={`${p.type}-${i}`} {...common}
                                    type={p.type}
                                    archMode={p.archMode??false}
                                    slice={p.slice}
                                    onSliceChange={p.setSlice}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Right Sidebar ── */}
                {sideOpen&&(
                    <div style={{ width:210, flexShrink:0, borderLeft:'1px solid #1e2535', background:'#0a0c10', overflowY:'auto', display:'flex', flexDirection:'column' }}>

                        {/* Ajustar */}
                        <SideSection title="Ajustar">
                            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                {[
                                    { label:'C', value:effectiveWc, min:-1024, max:3000, set:(v:number)=>setWc(v-brightness*10), color:'#60a5fa' },
                                    { label:'W', value:ww,          min:1,    max:4000, set:setWw,          color:'#34d399' },
                                    { label:'B', value:brightness,  min:-50,  max:50,   set:setBrightness,  color:'#a78bfa' },
                                ].map(item=>(
                                    <div key={item.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                                        <span style={{ color:'#475569', fontSize:10, width:10, textAlign:'center', fontWeight:700 }}>{item.label}</span>
                                        <button onClick={()=>item.set(item.value-10)} style={sideBtnStyle}>
                                            <Minus style={{width:9,height:9}} />
                                        </button>
                                        <input type="range" min={item.min} max={item.max} value={item.value}
                                            onChange={e=>item.set(+e.target.value)}
                                            style={{ flex:1, accentColor:item.color, cursor:'pointer', height:3 }} />
                                        <button onClick={()=>item.set(item.value+10)} style={sideBtnStyle}>
                                            <Plus style={{width:9,height:9}} />
                                        </button>
                                        <span style={{ color:'#64748b', fontSize:10, minWidth:36, textAlign:'right', fontFamily:'monospace' }}>
                                            {item.value}
                                        </span>
                                    </div>
                                ))}
                                {/* Presets */}
                                <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:2 }}>
                                    {DENTAL_PRESETS.map(p=>(
                                        <button key={p.name} onClick={()=>{setWc(p.wc);setWw(p.ww);}} style={{ padding:'2px 7px', border:'1px solid #1e2535', borderRadius:4, cursor:'pointer', fontSize:9, background:'#141820', color:'#64748b' }}>
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </SideSection>

                        {/* Tools */}
                        <SideSection title="Tools">
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                                <IconBtn icon={<ZoomIn style={{width:12,height:12}}/>}    title="Zoom +" />
                                <IconBtn icon={<ZoomOut style={{width:12,height:12}}/>}   title="Zoom -" />
                                <IconBtn icon={<Move style={{width:12,height:12}}/>}      title="Pan" />
                                <IconBtn icon={<RotateCcw style={{width:12,height:12}}/>} title="Rotar" />
                                <IconBtn icon={<Camera style={{width:12,height:12}}/>}    title="Captura" />
                                <IconBtn icon={<Maximize2 style={{width:12,height:12}}/>} title="Pantalla completa" onClick={()=>setFullPanel(fullPanel ? null : 'axial')} active={!!fullPanel} />
                                <IconBtn icon={<Activity style={{width:12,height:12}}/>}  title="Arco dental (clic izquierdo = añadir, derecho = borrar punto)"
                                    active={archMode} color="#22d3ee"
                                    onClick={()=>setArchMode(m=>{if(!m)setRuler(false);return !m;})} />
                                <IconBtn icon={<Ruler style={{width:12,height:12}}/>}     title="Regla"
                                    active={ruler} color="#fbbf24"
                                    onClick={()=>setRuler(r=>{if(!r)setArchMode(false);return !r;})} />
                                {archControls.length>0&&(
                                    <IconBtn icon={<Trash2 style={{width:12,height:12}}/>} title="Borrar arco" onClick={clearArch} color="#f87171" />
                                )}
                                <IconBtn icon={<RefreshCw style={{width:12,height:12}}/>} title="Arco por defecto"
                                    onClick={()=>{ setArchControls(defaultArch()); setArchMode(false); }} />
                            </div>
                            {archControls.length>0&&(
                                <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:4 }}>
                                    <span style={{ color:'#475569', fontSize:9 }}>Slab</span>
                                    <input type="range" min={5} max={80} value={slabPx}
                                        onChange={e=>setSlabPx(+e.target.value)}
                                        style={{ flex:1, accentColor:'#22d3ee', cursor:'pointer' }} />
                                    <span style={{ color:'#64748b', fontSize:9, minWidth:20 }}>{slabPx}px</span>
                                </div>
                            )}
                        </SideSection>

                        {/* Anotación */}
                        <SideSection title="Anotación" defaultOpen={false}>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                                {([
                                    { icon:<Ruler style={{width:12,height:12}}/>,       title:'Regla',       active:ruler, onClick:()=>setRuler(r=>!r) },
                                    { icon:<AngleIcon />,                                title:'Ángulo' },
                                    { icon:<Type style={{width:12,height:12}}/>,         title:'Texto' },
                                    { icon:<Square style={{width:12,height:12}}/>,       title:'Rectángulo' },
                                    { icon:<Circle style={{width:12,height:12}}/>,       title:'Elipse' },
                                    { icon:<ArrowRight style={{width:12,height:12}}/>,   title:'Flecha' },
                                    { icon:<Minus style={{width:12,height:12}}/>,        title:'Línea' },
                                    { icon:<Trash2 style={{width:12,height:12}}/>,       title:'Borrar todo' },
                                ] as { icon:React.ReactNode; title:string; active?:boolean; onClick?:()=>void }[]).map((item,i)=>(
                                    <IconBtn key={i} icon={item.icon} title={item.title} active={item.active} onClick={item.onClick} />
                                ))}
                            </div>
                        </SideSection>

                        {/* Renderizado 3D */}
                        <SideSection title="Renderizado 3D">
                            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                {/* Preset dropdown */}
                                <select value={preset3D} onChange={e=>setPreset3D(e.target.value as Preset3D)}
                                    style={{ width:'100%', background:'#141820', border:'1px solid #1e2535', borderRadius:5, color:'#94a3b8', fontSize:11, padding:'4px 6px', cursor:'pointer' }}>
                                    {PRESETS_3D.map(p=>(
                                        <option key={p.id} value={p.id}>{p.label}</option>
                                    ))}
                                </select>

                                {/* Sliders */}
                                {[
                                    { label:'Umbral',    value:r3dThresh,  set:setR3dThresh,  max:100, color:'#ef4444' },
                                    { label:'Opacidad',  value:r3dOpacity, set:setR3dOpacity, max:100, color:'#f97316' },
                                    { label:'Brillo',    value:r3dShine,   set:setR3dShine,   max:100, color:'#eab308' },
                                    { label:'Ambiente',  value:r3dAmbient, set:setR3dAmbient, max:100, color:'#22c55e' },
                                    { label:'Difuso',    value:r3dDiffuse, set:setR3dDiffuse, max:100, color:'#3b82f6' },
                                ].map(item=>(
                                    <div key={item.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                                        <div style={{ width:12, height:12, borderRadius:2, background:item.color, flexShrink:0 }} />
                                        <input type="range" min={0} max={item.max} value={item.value}
                                            onChange={e=>item.set(+e.target.value)}
                                            style={{ flex:1, accentColor:item.color, cursor:'pointer', height:3 }} />
                                        <span style={{ color:'#64748b', fontSize:9, minWidth:26, textAlign:'right', fontFamily:'monospace' }}>
                                            {item.value}%
                                        </span>
                                    </div>
                                ))}

                                {/* Render mode icons */}
                                <div style={{ display:'flex', gap:3, marginTop:2 }}>
                                    {[
                                        { title:'Superficie', icon:'🫀' },
                                        { title:'Volumen',    icon:'🧊' },
                                        { title:'MIP',        icon:'🔆' },
                                        { title:'MinIP',      icon:'🔅' },
                                    ].map(m=>(
                                        <button key={m.title} title={m.title} style={{ flex:1, padding:'4px 0', background:'#141820', border:'1px solid #1e2535', borderRadius:4, cursor:'pointer', fontSize:12, color:'#64748b' }}>
                                            {m.icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </SideSection>

                        {/* Explorador de objetos */}
                        <SideSection title="Explorador de objetos" defaultOpen={false}>
                            <div style={{ color:'#334155', fontSize:10, textAlign:'center', padding:'8px 0' }}>
                                Sin objetos
                            </div>
                        </SideSection>

                    </div>
                )}
            </div>
        </div>
    );
};

export default CbctViewer;
