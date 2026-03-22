/**
 * CbctViewer.tsx — Visor CBCT 3D estilo Romexis
 *
 * Líneas de referencia cruzadas con colores estándar de imagen médica:
 *  - Rojo  (X) = plano sagital
 *  - Verde (Y) = plano coronal
 *  - Azul  (Z) = plano axial
 *
 * Cada vista muestra:
 *  - Líneas de referencia spanning completo con triángulos en los bordes
 *  - Etiquetas de orientación (R/L/A/P/S/I) en los 4 bordes
 *  - Regla con ticks en mm a lo largo de los 4 bordes (si hay pixelSpacing)
 *  - Círculo blanco en la intersección de las dos líneas
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

interface RulerLine { x1:number; y1:number; x2:number; y2:number; mm:number; }
interface CrosshairPos { sliceAxial:number; sliceCoronal:number; sliceSagital:number; }
interface ImgRect { x:number; y:number; w:number; h:number; }
interface RefLine { frac:number; dir:'h'|'v'; color:string; label:string; }

// ── Colores (view labels) ─────────────────────────────────────────────────────
const COLOR: Record<ViewType, string> = {
    axial: '#22d3ee', coronal: '#a78bfa', sagital: '#34d399',
    panoramica: '#fbbf24', mip: '#f87171', cefa: '#60a5fa',
};

// Colores estándar de imagen médica para líneas de referencia
const REF_COLOR = {
    sagital: '#ef4444',  // Rojo  — eje X
    coronal: '#22c55e',  // Verde — eje Y
    axial:   '#3b82f6',  // Azul  — eje Z
} as const;

// Etiquetas de orientación por vista
const ORIENT: Partial<Record<ViewType, { top:string; bottom:string; left:string; right:string }>> = {
    axial:   { top:'A', bottom:'P', left:'R', right:'L' },
    coronal: { top:'S', bottom:'I', left:'R', right:'L' },
    sagital: { top:'S', bottom:'I', left:'A', right:'P' },
};

const IS_SLICE: Record<ViewType, boolean> = {
    axial:true, coronal:true, sagital:true, panoramica:false, mip:false, cefa:false,
};
const LABEL: Record<ViewType, string> = {
    axial:'Axial', coronal:'Coronal', sagital:'Sagital',
    panoramica:'Panorámica', mip:'MIP 3D', cefa:'Cefalometría',
};

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
    slice:        number;
    onSliceChange:(s:number) => void;
    crosshair:         CrosshairPos;
    onCrosshairUpdate: (u:Partial<CrosshairPos>) => void;
}

const ViewPanel: React.FC<ViewPanelProps> = ({
    volume, type, wc, ww, rulerActive,
    archControls, archMode, slabPx, onArchAdd,
    slice, onSliceChange,
    crosshair, onCrosshairUpdate,
}) => {
    const displayRef   = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const offscreen    = useRef<HTMLCanvasElement>(document.createElement('canvas'));
    const draggingRef  = useRef(false);

    const maxSlice = type==='axial' ? volume.numFrames-1
                   : type==='coronal' ? volume.rows-1
                   : type==='sagital' ? volume.cols-1 : 0;

    const [progress,    setProgress]    = useState<number|null>(null);
    const [rulers,      setRulers]      = useState<RulerLine[]>([]);
    const [drawing,     setDrawing]     = useState<{x:number;y:number}|null>(null);
    const [cursorPos,   setCursorPos]   = useState<{x:number;y:number}|null>(null);
    const [nativeW,     setNativeW]     = useState(0);
    const [nativeH,     setNativeH]     = useState(0);
    const [displaySize, setDisplaySize] = useState({w:0,h:0});

    // Rect letterbox de la imagen dentro del display canvas
    const imgRect: ImgRect = useMemo(() => {
        if (!displaySize.w || !displaySize.h || !nativeW || !nativeH)
            return { x:0, y:0, w:displaySize.w||0, h:displaySize.h||0 };
        const scale = Math.min(displaySize.w/nativeW, displaySize.h/nativeH);
        const dw = Math.round(nativeW*scale), dh = Math.round(nativeH*scale);
        return { x:Math.round((displaySize.w-dw)/2), y:Math.round((displaySize.h-dh)/2), w:dw, h:dh };
    }, [displaySize, nativeW, nativeH]);

    // Líneas de referencia con colores estándar
    const refLines: RefLine[] = useMemo(() => {
        const { sliceAxial, sliceCoronal, sliceSagital } = crosshair;
        const lines: RefLine[] = [];
        if (type==='axial') {
            lines.push({ frac:sliceSagital/Math.max(1,volume.cols-1),      dir:'v', color:REF_COLOR.sagital, label:'Sag' });
            lines.push({ frac:sliceCoronal/Math.max(1,volume.rows-1),      dir:'h', color:REF_COLOR.coronal, label:'Cor' });
        } else if (type==='coronal') {
            lines.push({ frac:sliceSagital/Math.max(1,volume.cols-1),      dir:'v', color:REF_COLOR.sagital, label:'Sag' });
            lines.push({ frac:sliceAxial/Math.max(1,volume.numFrames-1),   dir:'h', color:REF_COLOR.axial,   label:'Ax' });
        } else if (type==='sagital') {
            lines.push({ frac:sliceCoronal/Math.max(1,volume.rows-1),      dir:'v', color:REF_COLOR.coronal, label:'Cor' });
            lines.push({ frac:sliceAxial/Math.max(1,volume.numFrames-1),   dir:'h', color:REF_COLOR.axial,   label:'Ax' });
        } else if (type==='panoramica') {
            lines.push({ frac:sliceAxial/Math.max(1,volume.numFrames-1),   dir:'h', color:REF_COLOR.axial,   label:'Ax' });
        }
        return lines;
    }, [type, crosshair, volume]);

    // Ticks de regla en mm (si hay pixelSpacing)
    const rulerTicks = useMemo(() => {
        const ps = volume.pixelSpacing?.[0] ?? 0;
        if (ps <= 0 || !nativeW || !nativeH) return { x:[], y:[] };
        const tickMm = 10; // tick cada 10 mm
        const xTicks: {frac:number; label:string}[] = [];
        const yTicks: {frac:number; label:string}[] = [];
        const wMm = nativeW * ps;
        const hMm = nativeH * ps;
        for (let mm = tickMm; mm < wMm; mm += tickMm) {
            const frac = mm / wMm;
            xTicks.push({ frac, label: mm % 50 === 0 ? `${Math.round(mm)}` : '' });
        }
        for (let mm = tickMm; mm < hMm; mm += tickMm) {
            const frac = mm / hMm;
            yTicks.push({ frac, label: mm % 50 === 0 ? `${Math.round(mm)}` : '' });
        }
        return { x:xTicks, y:yTicks };
    }, [volume, nativeW, nativeH]);

    const refH = refLines.find(l => l.dir==='h');
    const refV = refLines.find(l => l.dir==='v');
    const orient = ORIENT[type];

    // blit letterbox
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

    // ResizeObserver
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

    // Render → offscreen
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
        }
        return () => { cancelled=true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [volume, type, slice, wc, ww, archControls, slabPx]);

    const getPos = useCallback((e:React.MouseEvent) => {
        const rect = displayRef.current!.getBoundingClientRect();
        return {
            x: Math.max(0,Math.min(1,((e.clientX-rect.left)-imgRect.x)/(imgRect.w||1))),
            y: Math.max(0,Math.min(1,((e.clientY-rect.top) -imgRect.y)/(imgRect.h||1))),
        };
    }, [imgRect]);

    const moveCrosshair = useCallback((fx:number,fy:number) => {
        if (type==='axial')   { onCrosshairUpdate({ sliceSagital:Math.round(fx*(volume.cols-1)),      sliceCoronal:Math.round(fy*(volume.rows-1)) }); }
        else if (type==='coronal') { onCrosshairUpdate({ sliceSagital:Math.round(fx*(volume.cols-1)), sliceAxial:Math.round(fy*(volume.numFrames-1)) }); }
        else if (type==='sagital') { onCrosshairUpdate({ sliceCoronal:Math.round(fx*(volume.rows-1)), sliceAxial:Math.round(fy*(volume.numFrames-1)) }); }
    }, [type, volume, onCrosshairUpdate]);

    const handleWheel = (e:React.WheelEvent) => {
        if (!IS_SLICE[type]) return;
        e.preventDefault();
        onSliceChange(Math.max(0,Math.min(maxSlice,slice+(e.deltaY>0?1:-1))));
    };
    const onMouseDown = (e:React.MouseEvent) => {
        if (type==='axial'&&archMode) { const f=getPos(e); onArchAdd([Math.round(f.x*volume.cols),Math.round(f.y*volume.rows)]); return; }
        if (rulerActive) { setDrawing(getPos(e)); return; }
        if (IS_SLICE[type]) { draggingRef.current=true; moveCrosshair(getPos(e).x,getPos(e).y); }
    };
    const onMouseMove = (e:React.MouseEvent) => {
        if (rulerActive) { setCursorPos(getPos(e)); return; }
        if (draggingRef.current&&IS_SLICE[type]) moveCrosshair(getPos(e).x,getPos(e).y);
    };
    const onMouseUp = (e:React.MouseEvent) => {
        draggingRef.current=false;
        if (!rulerActive||!drawing) return;
        const end=getPos(e), off=offscreen.current, ps=volume.pixelSpacing?.[1]??0.3;
        const dx=(end.x-drawing.x)*off.width*ps, dy=(end.y-drawing.y)*off.height*ps;
        setRulers(r=>[...r,{x1:drawing.x,y1:drawing.y,x2:end.x,y2:end.y,mm:Math.sqrt(dx*dx+dy*dy)}]);
        setDrawing(null);
    };

    const ps        = volume.pixelSpacing?.[1]??0;
    const scaleFrac = ps>0&&nativeW>0 ? Math.min(0.35,10/(ps*nativeW)) : 0;
    const archSplineD: string|null = (() => {
        if (type!=='axial'||archControls.length<2) return null;
        return sampleArchSpline(archControls,archControls.length*20)
            .map((p,i)=>`${i===0?'M':'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    })();

    const activeCursor = (type==='axial'&&archMode)||rulerActive ? 'crosshair'
                       : IS_SLICE[type] ? 'crosshair' : 'default';

    // Tamaño del triángulo y grosor de tick en px del imgRect
    const TRI = 7, TICK_MAJOR = 8, TICK_MINOR = 4;
    const W = imgRect.w||1, H = imgRect.h||1;

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#060809', border:'1px solid #1e2535', borderRadius:6, overflow:'hidden' }}>

            {/* Label */}
            <div style={{ height:22, flexShrink:0, display:'flex', alignItems:'center', padding:'0 8px', gap:6, background:'#0a0c10', borderBottom:'1px solid #1e2535' }}>
                <span style={{ color:COLOR[type], fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', flex:1 }}>
                    {LABEL[type]}
                    {type==='panoramica'&&archControls.length>=2&&(
                        <span style={{ color:'#22d3ee', fontSize:9, marginLeft:6, fontWeight:400, textTransform:'none' }}>
                            — arco ({archControls.length} pts)
                        </span>
                    )}
                </span>
                {IS_SLICE[type]&&<>
                    <button onClick={()=>onSliceChange(Math.max(0,slice-1))} style={{ background:'none',border:'none',color:'#475569',cursor:'pointer',padding:0,display:'flex' }}><ChevronLeft style={{width:12,height:12}}/></button>
                    <span style={{ color:'#334155',fontSize:10,minWidth:48,textAlign:'center' }}>{slice+1} / {maxSlice+1}</span>
                    <button onClick={()=>onSliceChange(Math.min(maxSlice,slice+1))} style={{ background:'none',border:'none',color:'#475569',cursor:'pointer',padding:0,display:'flex' }}><ChevronRight style={{width:12,height:12}}/></button>
                </>}
            </div>

            {/* Contenedor */}
            <div ref={containerRef} style={{ flex:1, minHeight:0, position:'relative', background:'#000', cursor:activeCursor, overflow:'hidden' }}
                onWheel={handleWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                onMouseLeave={()=>{ setCursorPos(null); draggingRef.current=false; }}>

                <canvas ref={displayRef} style={{ position:'absolute', inset:0, display:'block' }} />

                {/* Progress */}
                {progress!==null&&(
                    <div style={{ position:'absolute',bottom:0,left:0,right:0,height:3,background:'#1e2535',zIndex:2 }}>
                        <div style={{ height:'100%',width:`${progress*100}%`,background:'#3b82f6',transition:'width 0.1s' }} />
                    </div>
                )}

                {/* ── Overlays sobre el rect real de la imagen ── */}
                {imgRect.w>0&&imgRect.h>0&&(
                    <div style={{ position:'absolute', left:imgRect.x, top:imgRect.y, width:imgRect.w, height:imgRect.h, pointerEvents:'none', zIndex:3 }}>

                        {/* Borde del área de imagen */}
                        <div style={{ position:'absolute', inset:0, border:`1px solid ${COLOR[type]}40` }} />

                        {/* Scale bar */}
                        {scaleFrac>0&&progress===null&&(
                            <div style={{ position:'absolute',bottom:20,left:8 }}>
                                <div style={{ color:'#e2e8f0',fontSize:9,fontWeight:600,marginBottom:2 }}>10 mm</div>
                                <div style={{ height:2,width:`${scaleFrac*100}%`,minWidth:16,background:'#e2e8f0' }} />
                            </div>
                        )}

                        {/* Etiquetas de orientación */}
                        {orient&&(
                            <>
                                <span style={{ position:'absolute',top:2,left:'50%',transform:'translateX(-50%)',color:'#94a3b8',fontSize:11,fontWeight:800,letterSpacing:'0.1em',textShadow:'0 1px 3px #000' }}>{orient.top}</span>
                                <span style={{ position:'absolute',bottom:2,left:'50%',transform:'translateX(-50%)',color:'#94a3b8',fontSize:11,fontWeight:800,letterSpacing:'0.1em',textShadow:'0 1px 3px #000' }}>{orient.bottom}</span>
                                <span style={{ position:'absolute',left:2,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:11,fontWeight:800,letterSpacing:'0.1em',textShadow:'0 1px 3px #000' }}>{orient.left}</span>
                                <span style={{ position:'absolute',right:2,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:11,fontWeight:800,letterSpacing:'0.1em',textShadow:'0 1px 3px #000' }}>{orient.right}</span>
                            </>
                        )}

                        {/* Hint arco */}
                        {type==='axial'&&archMode&&(
                            <div style={{ position:'absolute',top:18,left:0,right:0,display:'flex',justifyContent:'center' }}>
                                <span style={{ background:'#0c4a6e99',color:'#7dd3fc',fontSize:10,padding:'2px 10px',borderRadius:4 }}>
                                    Click para añadir puntos del arco dental
                                </span>
                            </div>
                        )}

                        {/* ── SVG principal: líneas de ref + ticks + triángulos ── */}
                        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                            style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>

                            {/* Regla ticks en mm — borde superior e inferior */}
                            {rulerTicks.x.map((t,i)=>(
                                <g key={`xt${i}`}>
                                    <line x1={t.frac*W} y1={0} x2={t.frac*W} y2={t.label?TICK_MAJOR:TICK_MINOR} stroke="#475569" strokeWidth={0.5} />
                                    <line x1={t.frac*W} y1={H} x2={t.frac*W} y2={H-(t.label?TICK_MAJOR:TICK_MINOR)} stroke="#475569" strokeWidth={0.5} />
                                    {t.label&&<text x={t.frac*W+2} y={TICK_MAJOR+8} fontSize={Math.max(8,H*0.025)} fill="#334155">{t.label}</text>}
                                </g>
                            ))}
                            {/* Regla ticks — borde izquierdo y derecho */}
                            {rulerTicks.y.map((t,i)=>(
                                <g key={`yt${i}`}>
                                    <line x1={0} y1={t.frac*H} x2={t.label?TICK_MAJOR:TICK_MINOR} y2={t.frac*H} stroke="#475569" strokeWidth={0.5} />
                                    <line x1={W} y1={t.frac*H} x2={W-(t.label?TICK_MAJOR:TICK_MINOR)} y2={t.frac*H} stroke="#475569" strokeWidth={0.5} />
                                    {t.label&&<text x={TICK_MAJOR+2} y={t.frac*H-2} fontSize={Math.max(8,W*0.025)} fill="#334155">{t.label}</text>}
                                </g>
                            ))}

                            {/* Líneas de referencia + triángulos marcadores */}
                            {refLines.map((rl,i)=>{
                                if (rl.dir==='h') {
                                    const y = rl.frac*H;
                                    return (
                                        <g key={i}>
                                            <line x1={0} y1={y} x2={W} y2={y} stroke={rl.color} strokeWidth={1} opacity={0.85} />
                                            {/* triángulo izquierdo */}
                                            <polygon points={`0,${y} ${TRI},${y-TRI*0.65} ${TRI},${y+TRI*0.65}`} fill={rl.color} opacity={0.95} />
                                            {/* triángulo derecho */}
                                            <polygon points={`${W},${y} ${W-TRI},${y-TRI*0.65} ${W-TRI},${y+TRI*0.65}`} fill={rl.color} opacity={0.95} />
                                        </g>
                                    );
                                } else {
                                    const x = rl.frac*W;
                                    return (
                                        <g key={i}>
                                            <line x1={x} y1={0} x2={x} y2={H} stroke={rl.color} strokeWidth={1} opacity={0.85} />
                                            {/* triángulo superior */}
                                            <polygon points={`${x},0 ${x-TRI*0.65},${TRI} ${x+TRI*0.65},${TRI}`} fill={rl.color} opacity={0.95} />
                                            {/* triángulo inferior */}
                                            <polygon points={`${x},${H} ${x-TRI*0.65},${H-TRI} ${x+TRI*0.65},${H-TRI}`} fill={rl.color} opacity={0.95} />
                                        </g>
                                    );
                                }
                            })}

                            {/* Círculo en la intersección */}
                            {refH&&refV&&(
                                <circle cx={refV.frac*W} cy={refH.frac*H} r={5} fill="none" stroke="#fff" strokeWidth={1} opacity={0.65} />
                            )}
                        </svg>

                        {/* Arco dental — axial */}
                        {type==='axial'&&archControls.length>0&&(
                            <svg viewBox={`0 0 ${volume.cols} ${volume.rows}`} preserveAspectRatio="none"
                                style={{ position:'absolute',inset:0,width:'100%',height:'100%' }}>
                                {archSplineD&&<path d={archSplineD} stroke="#22d3ee" strokeWidth={2} fill="none" opacity={0.9} />}
                                {archControls.map((p,i)=>(
                                    <circle key={i} cx={p[0]} cy={p[1]}
                                        r={i===0||i===archControls.length-1?5:4}
                                        fill={i===0?'#22d3ee':i===archControls.length-1?'#f59e0b':'#38bdf8'}
                                        stroke="#0c4a6e" strokeWidth={1} opacity={0.95} />
                                ))}
                                {archControls.length>1&&(()=>{
                                    const last=archControls[archControls.length-1];
                                    return <text x={last[0]+6} y={last[1]+4} fontSize={16} fill="#f59e0b" fontWeight={700} opacity={0.9}>{archControls.length}</text>;
                                })()}
                            </svg>
                        )}

                        {/* Regla de medición */}
                        {(rulers.length>0||(drawing&&cursorPos))&&(
                            <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%' }}>
                                {rulers.map((r,i)=>{
                                    const x1=`${r.x1*100}%`,y1=`${r.y1*100}%`,x2=`${r.x2*100}%`,y2=`${r.y2*100}%`;
                                    const mx=`${(r.x1+r.x2)/2*100}%`,my=`${((r.y1+r.y2)/2-0.04)*100}%`;
                                    return (
                                        <g key={i}>
                                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth={1.5} />
                                            <circle cx={x1} cy={y1} r={4} fill="#fbbf24" />
                                            <circle cx={x2} cy={y2} r={4} fill="#fbbf24" />
                                            <text x={mx} y={my} fontSize={11} fill="#fbbf24" textAnchor="middle" fontWeight={700} fontFamily="monospace">{r.mm.toFixed(1)} mm</text>
                                        </g>
                                    );
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
            </div>
        </div>
    );
};

// ── CbctViewer ────────────────────────────────────────────────────────────────

interface CbctViewerProps { volume:DicomVolume; onClose?:()=>void; }

const VIEW_LIST = [
    {id:'axial'      as ViewType, label:'Axial'},
    {id:'coronal'    as ViewType, label:'Coronal'},
    {id:'sagital'    as ViewType, label:'Sagital'},
    {id:'panoramica' as ViewType, label:'Panorámica'},
    {id:'mip'        as ViewType, label:'MIP 3D'},
    {id:'cefa'       as ViewType, label:'Cef.'},
];

const CbctViewer: React.FC<CbctViewerProps> = ({ volume, onClose }) => {
    const [layout,       setLayout]       = useState<Layout>('4x');
    const [wc,setWc]                      = useState(volume.defaultWC);
    const [ww,setWw]                      = useState(volume.defaultWW);
    const [ruler,        setRuler]        = useState(false);
    const [archMode,     setArchMode]     = useState(false);
    const [archControls, setArchControls] = useState<Array<[number,number]>>([]);
    const [slabPx,       setSlabPx]       = useState(20);
    const [sliceAxial,   setSliceAxial]   = useState(Math.floor(volume.numFrames/2));
    const [sliceCoronal, setSliceCoronal] = useState(Math.floor(volume.rows/2));
    const [sliceSagital, setSliceSagital] = useState(Math.floor(volume.cols/2));

    const crosshair: CrosshairPos = { sliceAxial, sliceCoronal, sliceSagital };

    const updateCrosshair = useCallback((u:Partial<CrosshairPos>) => {
        if (u.sliceAxial!==undefined)   setSliceAxial(u.sliceAxial);
        if (u.sliceCoronal!==undefined) setSliceCoronal(u.sliceCoronal);
        if (u.sliceSagital!==undefined) setSliceSagital(u.sliceSagital);
    }, []);

    const addArchPoint = useCallback((pt:[number,number]) => setArchControls(prev=>[...prev,pt]), []);
    const clearArch    = () => { setArchControls([]); setArchMode(false); };
    const toggleArch   = () => { setArchMode(m=>{ if(!m) setRuler(false); return !m; }); };
    const toggleRuler  = () => { setRuler(r=>{ if(!r) setArchMode(false); return !r; }); };

    const common = {
        volume, wc, ww, rulerActive:ruler,
        archControls, archMode:false, slabPx, onArchAdd:addArchPoint,
        crosshair, onCrosshairUpdate:updateCrosshair,
    };

    return (
        <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#0a0c10' }}>

            {/* Toolbar */}
            <div style={{ height:44, flexShrink:0, display:'flex', alignItems:'center', gap:3, padding:'0 10px', background:'#0d1018', borderBottom:'1px solid #1e2535', overflowX:'auto' }}>

                <button title="4 paneles" onClick={()=>setLayout('4x')} style={{ width:28,height:28,border:'none',borderRadius:5,cursor:'pointer', background:layout==='4x'?'#1e40af':'transparent', color:layout==='4x'?'#93c5fd':'#475569', display:'flex',alignItems:'center',justifyContent:'center' }}>
                    <LayoutGrid style={{width:14,height:14}} />
                </button>

                <div style={{ width:1,height:20,background:'#1e2535',margin:'0 2px' }} />

                {VIEW_LIST.map(v=>(
                    <button key={v.id} onClick={()=>setLayout(v.id)} style={{ padding:'3px 8px',border:'none',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:600,transition:'background 0.12s', background:layout===v.id?'#1e3a5f':'transparent', color:layout===v.id?COLOR[v.id]:'#475569' }}>
                        {v.label}
                    </button>
                ))}

                <div style={{ width:1,height:20,background:'#1e2535',margin:'0 2px' }} />

                <span style={{ color:'#475569',fontSize:10 }}>WC</span>
                <input type="range" min={-1000} max={3000} value={wc} onChange={e=>setWc(+e.target.value)} style={{ width:64,accentColor:'#3b82f6',cursor:'pointer' }} />
                <span style={{ color:'#64748b',fontSize:10,minWidth:36 }}>{wc}</span>

                <span style={{ color:'#475569',fontSize:10 }}>WW</span>
                <input type="range" min={1} max={4000} value={ww} onChange={e=>setWw(+e.target.value)} style={{ width:64,accentColor:'#3b82f6',cursor:'pointer' }} />
                <span style={{ color:'#64748b',fontSize:10,minWidth:36 }}>{ww}</span>

                {DENTAL_PRESETS.map(p=>(
                    <button key={p.name} onClick={()=>{setWc(p.wc);setWw(p.ww);}} style={{ padding:'2px 7px',border:'1px solid #1e2535',borderRadius:4,cursor:'pointer',fontSize:10,background:'#141820',color:'#64748b' }}>
                        {p.name}
                    </button>
                ))}

                <div style={{ width:1,height:20,background:'#1e2535',margin:'0 2px' }} />

                {/* Arco */}
                <button title="Arco dental" onClick={toggleArch} style={{ padding:'3px 8px',border:`1px solid ${archMode?'#22d3ee':'#1e2535'}`,borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:600, background:archMode?'#0c4a6e':'transparent',color:archMode?'#22d3ee':'#475569',display:'flex',alignItems:'center',gap:4 }}>
                    <Activity style={{width:12,height:12}} /> Arco
                    {archControls.length>0&&<span style={{ background:'#0e7490',color:'#e0f2fe',borderRadius:8,padding:'0 5px',fontSize:9,fontWeight:700 }}>{archControls.length}</span>}
                </button>
                {archControls.length>0&&<>
                    <span style={{ color:'#475569',fontSize:10,marginLeft:2 }}>Slab</span>
                    <input type="range" min={5} max={80} value={slabPx} onChange={e=>setSlabPx(+e.target.value)} style={{ width:50,accentColor:'#22d3ee',cursor:'pointer' }} title={`${slabPx}px`} />
                    <span style={{ color:'#64748b',fontSize:10,minWidth:24 }}>{slabPx}</span>
                    <button onClick={clearArch} style={{ width:24,height:24,border:'none',borderRadius:4,cursor:'pointer',background:'transparent',color:'#475569',display:'flex',alignItems:'center',justifyContent:'center' }}>
                        <Trash2 style={{width:12,height:12}} />
                    </button>
                </>}

                <div style={{ width:1,height:20,background:'#1e2535',margin:'0 2px' }} />

                <button onClick={toggleRuler} style={{ padding:'3px 8px',border:`1px solid ${ruler?'#fbbf24':'#1e2535'}`,borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:600, background:ruler?'#3d2c0a':'transparent',color:ruler?'#fbbf24':'#475569',display:'flex',alignItems:'center',gap:4 }}>
                    <Ruler style={{width:12,height:12}} /> Regla
                </button>

                <div style={{ flex:1 }} />

                {onClose&&(
                    <button onClick={onClose} style={{ width:28,height:28,border:'none',borderRadius:5,cursor:'pointer',background:'transparent',color:'#475569',display:'flex',alignItems:'center',justifyContent:'center' }}>
                        <X style={{width:14,height:14}} />
                    </button>
                )}
            </div>

            {/* Viewports */}
            <div style={{ flex:1, minHeight:0, padding:4 }}>
                {layout==='4x' ? (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', gap:4, height:'100%' }}>
                        <ViewPanel {...common} type="axial"      slice={sliceAxial}   onSliceChange={setSliceAxial}   archMode={archMode} />
                        <ViewPanel {...common} type="coronal"    slice={sliceCoronal} onSliceChange={setSliceCoronal} />
                        <ViewPanel {...common} type="panoramica" slice={0}            onSliceChange={()=>{}} />
                        <ViewPanel {...common} type="sagital"    slice={sliceSagital} onSliceChange={setSliceSagital} />
                    </div>
                ) : (
                    <div style={{ height:'100%' }}>
                        <ViewPanel {...common}
                            type={layout as ViewType}
                            archMode={layout==='axial'?archMode:false}
                            slice={layout==='axial'?sliceAxial:layout==='coronal'?sliceCoronal:layout==='sagital'?sliceSagital:0}
                            onSliceChange={layout==='axial'?setSliceAxial:layout==='coronal'?setSliceCoronal:layout==='sagital'?setSliceSagital:()=>{}}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CbctViewer;
