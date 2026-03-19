import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RotateCcw, Zap, Loader2, Save } from 'lucide-react';
import { analyzePerioData, isAIConfiguredSync } from '../../services/ia-dental.service';
import { getPeriodontograma, savePeriodontograma } from '../../services/periodontograma.service';

// ── Types ──────────────────────────────────────────────────────────────────
type Six = [number, number, number, number, number, number];
type SixBool = [boolean, boolean, boolean, boolean, boolean, boolean];

export interface PerioData {
    /** mm 0-12 · indices [MV, CV, DV, DL, CL, ML] — 0-2=vest, 3-5=ling */
    sondaje: Six;
    /** recession mm 0-10 */
    recesion: Six;
    bop: SixBool;
    movilidad: 0 | 1 | 2 | 3;
    furcacion: 0 | 1 | 2 | 3;
}
export type PerioRecord = Record<string, PerioData>;

// ── Tooth lists ────────────────────────────────────────────────────────────
const UPPER = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
const LOWER = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];

const POSTERIOR_SET = new Set(
    [14,15,16,17,18,24,25,26,27,28,34,35,36,37,38,44,45,46,47,48].map(String)
);

// ── Initial data ───────────────────────────────────────────────────────────
const blank = (): PerioData => ({
    sondaje:  [2,2,2,2,2,2],
    recesion: [0,0,0,0,0,0],
    bop:      [false,false,false,false,false,false],
    movilidad: 0,
    furcacion: 0,
});

const initAll = (): PerioRecord =>
    Object.fromEntries([...UPPER,...LOWER].map(t => [t, blank()]));

const buildDemo = (): PerioRecord => {
    const r = initAll();
    r['16'] = { sondaje:[5,4,6,5,3,4], recesion:[0,0,0,0,0,0], bop:[true,false,true,true,false,false], movilidad:0, furcacion:1 };
    r['26'] = { sondaje:[7,6,8,6,5,7], recesion:[1,1,2,1,0,1], bop:[true,true,true,true,true,true], movilidad:0, furcacion:2 };
    r['36'] = { sondaje:[4,3,5,3,3,4], recesion:[0,0,0,0,0,0], bop:[true,false,true,false,false,false], movilidad:1, furcacion:0 };
    r['46'] = { sondaje:[6,5,7,5,4,6], recesion:[1,0,1,0,0,0], bop:[true,true,false,true,false,true], movilidad:1, furcacion:2 };
    r['11'] = { sondaje:[3,2,3,2,2,3], recesion:[2,1,2,0,0,0], bop:[false,false,false,false,false,false], movilidad:0, furcacion:0 };
    r['21'] = { sondaje:[3,3,4,2,2,3], recesion:[1,1,2,0,0,0], bop:[false,false,true,false,false,false], movilidad:0, furcacion:0 };
    r['47'] = { sondaje:[5,4,5,4,3,5], recesion:[0,0,1,0,0,0], bop:[true,false,true,false,false,true], movilidad:0, furcacion:1 };
    r['17'] = { sondaje:[4,3,4,3,2,3], recesion:[0,0,0,0,0,0], bop:[false,false,true,false,false,false], movilidad:0, furcacion:0 };
    return r;
};

// ── Color helpers ──────────────────────────────────────────────────────────
const depthColor = (d: number): string =>
    d <= 3 ? '#16a34a' : d <= 5 ? '#d97706' : d <= 7 ? '#ea580c' : '#dc2626';

const depthBg = (d: number): string =>
    d <= 3 ? '#dcfce7' : d <= 5 ? '#fef3c7' : d <= 7 ? '#ffedd5' : '#fee2e2';

// ── Chart constants ────────────────────────────────────────────────────────
const CHART_H = 84;
const PX_MM   = 7;
const MAX_MM  = 12;
const BAR_W   = 8;
const TOOTH_W = 64; // px per tooth column
const CHART_W = 62;
const LABEL_W = 80;

// ── ToothChart ─────────────────────────────────────────────────────────────
const ToothChart: React.FC<{ sondaje: Six; invert?: boolean }> = ({ sondaje, invert = false }) => (
    <svg width={CHART_W} height={CHART_H} style={{ display: 'block', background: '#f8fafc' }}>
        {/* Horizontal grid lines at 3, 6, 9 mm */}
        {([3, 6, 9] as const).map(mm => {
            const y = invert ? CHART_H - mm * PX_MM : mm * PX_MM;
            return (
                <line
                    key={mm} x1={0} y1={y} x2={CHART_W} y2={y}
                    stroke={mm === 3 ? '#86efac' : mm === 6 ? '#fcd34d' : '#fca5a5'}
                    strokeWidth={0.8} strokeDasharray="3,2"
                />
            );
        })}
        {/* 6 bars: 0-2 vestibular, 3-5 lingual */}
        {sondaje.map((d, i) => {
            const barH = Math.min(d, MAX_MM) * PX_MM;
            const x    = i * (BAR_W + 1) + (i >= 3 ? 4 : 0) + 1;
            const y    = invert ? CHART_H - barH : 0;
            return <rect key={i} x={x} y={y} width={BAR_W} height={barH} fill={depthColor(d)} rx={1.5} opacity={0.9} />;
        })}
        {/* Separator V | L */}
        <line x1={3 * (BAR_W + 1) + 2} y1={0} x2={3 * (BAR_W + 1) + 2} y2={CHART_H} stroke="#94a3b8" strokeWidth={1.5} />
    </svg>
);

// ── NCell (depth input) ────────────────────────────────────────────────────
const NCell: React.FC<{
    value: number;
    onChange: (v: number) => void;
    min?: number; max?: number;
    recession?: boolean;
}> = ({ value, onChange, min = 0, max = 12, recession = false }) => (
    <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => {
            const v = parseInt(e.target.value);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        style={{
            width: 18, height: 22, padding: 0, textAlign: 'center',
            fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
            border: '1px solid #cbd5e1', borderRadius: 3, outline: 'none',
            backgroundColor: recession ? (value > 0 ? '#fef3c7' : '#f8fafc') : depthBg(value),
            color: recession ? (value > 0 ? '#92400e' : '#94a3b8') : depthColor(value),
        }}
    />
);

// ── BopDot ─────────────────────────────────────────────────────────────────
const BopDot: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
    <div
        onClick={() => onChange(!value)}
        title={value ? 'Sangrado — clic para quitar' : 'Sin sangrado — clic para marcar'}
        style={{
            width: 14, height: 14, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
            backgroundColor: value ? '#ef4444' : '#e2e8f0',
            border: `2px solid ${value ? '#dc2626' : '#cbd5e1'}`,
            transition: 'all 0.15s',
        }}
    />
);

// ── ArchTable ──────────────────────────────────────────────────────────────
type UpdateFn = (tooth: string, field: keyof PerioData, idx: number, val: number | boolean) => void;

const ArchTable: React.FC<{
    teeth: string[];
    data: PerioRecord;
    onUpdate: UpdateFn;
    archLabel: string;
    invertChart?: boolean;
}> = ({ teeth, data, onUpdate, archLabel, invertChart = false }) => {

    const row = (bg = '#fff'): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', minHeight: 26,
        backgroundColor: bg, borderBottom: '1px solid #f1f5f9',
    });

    const rowLabel = (text: string, bg = '#f8fafc'): JSX.Element => (
        <div style={{
            width: LABEL_W, flexShrink: 0,
            fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em',
            textAlign: 'right', paddingRight: 8, textTransform: 'uppercase',
            alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            borderRight: '2px solid #e2e8f0', background: bg,
        }}>
            {text}
        </div>
    );

    const threeInputs = (t: string, indices: [number,number,number], field: 'sondaje' | 'recesion') => (
        <div style={{ width: TOOTH_W, display: 'flex', justifyContent: 'center', gap: 1 }}>
            {indices.map(i => (
                <NCell
                    key={i}
                    value={(data[t][field] as Six)[i]}
                    recession={field === 'recesion'}
                    onChange={v => onUpdate(t, field, i, v)}
                />
            ))}
        </div>
    );

    const threeBop = (t: string, indices: [number,number,number]) => (
        <div style={{ width: TOOTH_W, display: 'flex', justifyContent: 'center', gap: 3, alignItems: 'center' }}>
            {indices.map(i => (
                <BopDot key={i} value={data[t].bop[i]} onChange={v => onUpdate(t, 'bop', i, v)} />
            ))}
        </div>
    );

    return (
        <div style={{ marginBottom: 12 }}>
            {/* Arch heading */}
            <div style={{
                fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase',
                letterSpacing: '0.1em', padding: '6px 0 4px', paddingLeft: LABEL_W + 10,
                borderBottom: '2px solid #cbd5e1', marginBottom: 0,
            }}>
                {archLabel}
            </div>

            {/* Tooth numbers */}
            <div style={row('#f1f5f9')}>
                {rowLabel('Pieza', '#f1f5f9')}
                {teeth.map(t => (
                    <div key={t} style={{ width: TOOTH_W, textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#334155' }}>
                        {t}
                    </div>
                ))}
            </div>

            {/* Mobility */}
            <div style={row('#fafafa')}>
                {rowLabel('Movilidad')}
                {teeth.map(t => {
                    const mob = data[t].movilidad;
                    return (
                        <div key={t} style={{ width: TOOTH_W, display: 'flex', justifyContent: 'center' }}>
                            <select
                                value={mob}
                                onChange={e => onUpdate(t, 'movilidad', 0, parseInt(e.target.value))}
                                style={{
                                    fontSize: 11, fontWeight: 700, width: 30, textAlign: 'center',
                                    border: '1px solid #e2e8f0', borderRadius: 3, cursor: 'pointer',
                                    backgroundColor: mob === 0 ? '#f8fafc' : mob === 1 ? '#fef3c7' : mob === 2 ? '#ffedd5' : '#fee2e2',
                                    color: mob === 0 ? '#94a3b8' : '#7c2d12',
                                }}
                            >
                                <option value={0}>0</option>
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                            </select>
                        </div>
                    );
                })}
            </div>

            {/* Furcation (posterior teeth only) */}
            <div style={row('#fafafa')}>
                {rowLabel('Furcación')}
                {teeth.map(t => {
                    const furc = data[t].furcacion;
                    return (
                        <div key={t} style={{ width: TOOTH_W, display: 'flex', justifyContent: 'center' }}>
                            {POSTERIOR_SET.has(t) ? (
                                <select
                                    value={furc}
                                    onChange={e => onUpdate(t, 'furcacion', 0, parseInt(e.target.value))}
                                    style={{
                                        fontSize: 11, fontWeight: 700, width: 32, textAlign: 'center',
                                        border: '1px solid #e2e8f0', borderRadius: 3, cursor: 'pointer',
                                        backgroundColor: furc === 0 ? '#f8fafc' : furc === 1 ? '#fef3c7' : furc === 2 ? '#ffedd5' : '#fee2e2',
                                        color: furc === 0 ? '#94a3b8' : '#7c2d12',
                                    }}
                                >
                                    <option value={0}>—</option>
                                    <option value={1}>Ⅰ</option>
                                    <option value={2}>Ⅱ</option>
                                    <option value={3}>Ⅲ</option>
                                </select>
                            ) : (
                                <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ─── VESTIBULAR ─── */}
            <div style={row('#fffbeb')}>
                {rowLabel('Recesión V', '#fffbeb')}
                {teeth.map(t => threeInputs(t, [0,1,2], 'recesion'))}
            </div>

            <div style={row('#fff5f5')}>
                {rowLabel('BOP V', '#fff5f5')}
                {teeth.map(t => threeBop(t, [0,1,2]))}
            </div>

            <div style={row('#f0fdf4')}>
                {rowLabel('Sondaje V', '#f0fdf4')}
                {teeth.map(t => threeInputs(t, [0,1,2], 'sondaje'))}
            </div>

            {/* Chart */}
            <div style={{
                display: 'flex', alignItems: 'center',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                borderBottom: '1px solid #e2e8f0',
                padding: '3px 0',
            }}>
                <div style={{
                    width: LABEL_W, flexShrink: 0,
                    fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em',
                    textAlign: 'right', paddingRight: 8, textTransform: 'uppercase',
                    borderRight: '2px solid #e2e8f0',
                }}>
                    V ← → L
                </div>
                {teeth.map(t => (
                    <div key={t} style={{ width: TOOTH_W, display: 'flex', justifyContent: 'center' }}>
                        <ToothChart sondaje={data[t].sondaje} invert={invertChart} />
                    </div>
                ))}
            </div>

            {/* ─── LINGUAL / PALATINO ─── */}
            <div style={row('#f0fdf4')}>
                {rowLabel('Sondaje L', '#f0fdf4')}
                {teeth.map(t => threeInputs(t, [3,4,5], 'sondaje'))}
            </div>

            <div style={row('#fff5f5')}>
                {rowLabel('BOP L', '#fff5f5')}
                {teeth.map(t => threeBop(t, [3,4,5]))}
            </div>

            <div style={row('#fffbeb')}>
                {rowLabel('Recesión L', '#fffbeb')}
                {teeth.map(t => threeInputs(t, [3,4,5], 'recesion'))}
            </div>
        </div>
    );
};

// ── Main component ─────────────────────────────────────────────────────────
interface PeriodontogramaProps {
    numPac?: string;
}

const Periodontograma: React.FC<PeriodontogramaProps> = ({ numPac }) => {
    const [data, setData] = useState<PerioRecord>(buildDemo);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cargar datos del paciente al montar o cambiar paciente
    useEffect(() => {
        if (!numPac) return;
        getPeriodontograma(numPac).then(saved => {
            if (saved && Object.keys(saved).length > 0) setData(saved as PerioRecord);
        });
    }, [numPac]);

    // Auto-save con debounce de 500ms tras cada cambio
    const triggerSave = useCallback((newData: PerioRecord) => {
        if (!numPac) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            setSaving(true);
            await savePeriodontograma(numPac, newData);
            setSaving(false);
        }, 500);
    }, [numPac]);

    const handleAnalyze = useCallback(async () => {
        setAiLoading(true);
        try {
            const allTeeth = [...UPPER, ...LOWER];
            const totalPts = allTeeth.length * 6;
            const bopCount = allTeeth.reduce((acc, t) => acc + data[t].bop.filter(Boolean).length, 0);
            const allDepths = allTeeth.flatMap(t => [...data[t].sondaje]);
            const meanDepth = parseFloat((allDepths.reduce((a, b) => a + b, 0) / allDepths.length).toFixed(1));
            const result = await analyzePerioData({
                bopPct: Math.round((bopCount / totalPts) * 100),
                meanDepth,
                deep4: allDepths.filter(d => d >= 4).length,
                deep6: allDepths.filter(d => d >= 6).length,
                teethWithMobility: allTeeth.filter(t => data[t].movilidad > 0),
                teethWithFurcation: allTeeth.filter(t => data[t].furcacion > 0),
            });
            setAiAnalysis(result);
        } catch {
            setAiAnalysis('Error al analizar. Inténtalo de nuevo.');
        } finally {
            setAiLoading(false);
        }
    }, [data]);

    const onUpdate: UpdateFn = useCallback((tooth, field, idx, val) => {
        setData(prev => {
            const td = { ...prev[tooth] };
            if (field === 'movilidad') {
                td.movilidad = val as 0 | 1 | 2 | 3;
            } else if (field === 'furcacion') {
                td.furcacion = val as 0 | 1 | 2 | 3;
            } else if (field === 'bop') {
                const arr = [...td.bop] as SixBool;
                arr[idx] = val as boolean;
                td.bop = arr;
            } else if (field === 'sondaje') {
                const arr = [...td.sondaje] as Six;
                arr[idx] = val as number;
                td.sondaje = arr;
            } else if (field === 'recesion') {
                const arr = [...td.recesion] as Six;
                arr[idx] = val as number;
                td.recesion = arr;
            }
            const next = { ...prev, [tooth]: td };
            triggerSave(next);
            return next;
        });
    }, [triggerSave]);

    // ── Stats ──────────────────────────────────────────────────────────
    const allTeeth    = [...UPPER, ...LOWER];
    const totalPts    = allTeeth.length * 6; // 192
    const bopCount    = allTeeth.reduce((acc, t) => acc + data[t].bop.filter(Boolean).length, 0);
    const bopPct      = Math.round((bopCount / totalPts) * 100);
    const allDepths   = allTeeth.flatMap(t => [...data[t].sondaje]);
    const meanDepth   = (allDepths.reduce((a, b) => a + b, 0) / allDepths.length).toFixed(1);
    const deep4       = allDepths.filter(d => d >= 4).length;
    const deep6       = allDepths.filter(d => d >= 6).length;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                            Periodontograma Clínico
                        </h3>
                        <p className="text-[13px] text-slate-400 font-medium mt-0.5">
                            Sistema FDI · 6 puntos/diente · MV CV DV — DL CL ML · Valores en mm
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {saving && (
                            <span className="flex items-center gap-1 text-[12px] font-bold text-blue-500">
                                <Save className="w-3 h-3 animate-spin" /> Guardando...
                            </span>
                        )}
                        <button
                            onClick={() => { const reset = initAll(); setData(reset); triggerSave(reset); setAiAnalysis(null); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reiniciar
                        </button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-200">
                    {[
                        {
                            label: 'Sangrado (BOP)',
                            value: `${bopPct}%`,
                            sub: `${bopCount} / ${totalPts} puntos`,
                            color: bopPct < 15 ? '#16a34a' : bopPct < 25 ? '#d97706' : '#dc2626',
                        },
                        { label: 'Sondaje medio', value: `${meanDepth} mm`, sub: 'Todos los puntos', color: '#2563eb' },
                        {
                            label: 'Bolsas ≥ 4 mm',
                            value: String(deep4),
                            sub: 'Periodontitis inicial/moderada',
                            color: deep4 === 0 ? '#16a34a' : deep4 < 10 ? '#d97706' : '#dc2626',
                        },
                        {
                            label: 'Bolsas ≥ 6 mm',
                            value: String(deep6),
                            sub: 'Periodontitis avanzada',
                            color: deep6 === 0 ? '#16a34a' : deep6 < 5 ? '#ea580c' : '#dc2626',
                        },
                    ].map(s => (
                        <div key={s.label} className="px-5 py-3">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                                {s.label}
                            </div>
                            <div className="text-2xl font-black leading-tight" style={{ color: s.color }}>
                                {s.value}
                            </div>
                            <div className="text-[11px] text-slate-400">{s.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-5 px-6 py-2.5 bg-white border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profundidad:</span>
                    {[
                        { label: '1–3 mm · Sano',     color: '#16a34a', bg: '#dcfce7' },
                        { label: '4–5 mm · Leve',     color: '#d97706', bg: '#fef3c7' },
                        { label: '6–7 mm · Moderado', color: '#ea580c', bg: '#ffedd5' },
                        { label: '≥ 8 mm · Severo',   color: '#dc2626', bg: '#fee2e2' },
                    ].map(l => (
                        <div key={l.label} className="flex items-center gap-1.5">
                            <div style={{ width: 11, height: 11, borderRadius: 2, background: l.bg, border: `2px solid ${l.color}` }} />
                            <span className="text-[11px] font-semibold text-slate-500">{l.label}</span>
                        </div>
                    ))}
                    <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">BOP:</span>
                    <div className="flex items-center gap-1.5">
                        <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ef4444', border: '2px solid #dc2626' }} />
                        <span className="text-[11px] font-semibold text-slate-500">Sangrado al sondaje</span>
                    </div>
                </div>

                {/* Scrollable chart */}
                <div className="overflow-x-auto px-3 py-4">
                    <div style={{ minWidth: LABEL_W + TOOTH_W * 16 + 32 }}>
                        <ArchTable
                            teeth={UPPER}
                            data={data}
                            onUpdate={onUpdate}
                            archLabel="Maxilar Superior — Arcada Superior"
                        />

                        <div className="text-center text-[11px] font-bold text-slate-300 uppercase tracking-[0.3em] py-2 my-1 border-y border-dashed border-slate-200">
                            ── PLANO OCLUSAL ──
                        </div>

                        <ArchTable
                            teeth={LOWER}
                            data={data}
                            onUpdate={onUpdate}
                            archLabel="Mandíbula — Arcada Inferior"
                            invertChart
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 italic leading-relaxed">
                    * BOP = Sangrado al sondaje · V = Vestibular · L = Lingual / Palatino ·
                    Orden de puntos por diente: MV (mesio-vestibular) · CV (centro-vestibular) · DV (disto-vestibular) /
                    DL (disto-lingual) · CL (centro-lingual) · ML (mesio-lingual) ·
                    Furcación: Ⅰ clase I · Ⅱ clase II · Ⅲ clase III ·
                    Movilidad: 0 = ninguna · 1 ≤ 1 mm · 2 = 1–2 mm · 3 ≥ 2 mm o vertical
                </div>
            </div>

            {/* ── IA Periodontal ── */}
            <div className="bg-[#051650] rounded-xl p-5 border border-white/10 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-blue-300" />
                    </div>
                    <div>
                        <p className="text-[12px] font-bold text-blue-400 uppercase tracking-widest">IA Periodontal</p>
                        <p className="text-sm font-bold text-white">Análisis y Diagnóstico Periodontal</p>
                    </div>
                    <span className={`ml-auto flex items-center gap-1.5 text-[13px] font-bold uppercase ${isAIConfiguredSync() ? 'text-[#118DF0]' : 'text-blue-300/50'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isAIConfiguredSync() ? 'bg-[#118DF0]' : 'bg-yellow-400'}`} />
                        {isAIConfiguredSync() ? 'IA Activa' : 'Sin API Key'}
                    </span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-3">
                    {aiAnalysis ? (
                        <p className="text-[13px] text-blue-100/80 font-medium leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
                    ) : (
                        <p className="text-[13px] text-blue-100/40 font-medium italic">
                            Pulsa el botón para obtener diagnóstico periodontal según clasificación AAP/EFP 2017, recomendaciones de tratamiento y nivel de urgencia.
                        </p>
                    )}
                </div>
                <button
                    onClick={handleAnalyze}
                    disabled={aiLoading}
                    className="w-full py-2 bg-white text-[#051650] rounded-lg text-[13px] font-bold uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {aiLoading
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando...</>
                        : 'Generar Diagnóstico Periodontal con IA'
                    }
                </button>
            </div>
        </div>
    );
};

export default Periodontograma;
