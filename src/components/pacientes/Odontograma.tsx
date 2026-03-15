
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, RotateCcw, Info, Save, Loader2 } from 'lucide-react';
import { getOdontograma, saveOdontograma } from '../../services/odontograma.service';
import { analyzeOdontograma, isAIConfigured } from '../../services/ia-dental.service';

type EstadoCara = 'normal' | 'caries' | 'obturacion' | 'corona' | 'implante' | 'ausente' | 'endodoncia';
type CaraNombre = 'oclusal' | 'vestibular' | 'lingual' | 'mesial' | 'distal';

interface DienteData {
    numero: string;
    caras: Record<CaraNombre, EstadoCara>;
    ausente?: boolean;
    implante?: boolean;
}

export interface AISuggestion {
    tooth: string;
    treatment: string;
    cost: string;
    reason: string;
    loading?: boolean;
}

const ESTADOS: { id: EstadoCara; label: string; color: string; fill: string; stroke: string }[] = [
    { id: 'normal', label: 'Sano', color: '#e2e8f0', fill: 'fill-white', stroke: 'stroke-slate-400' },
    { id: 'caries', label: 'Caries', color: '#ef4444', fill: 'fill-[#FF4B68]', stroke: 'stroke-red-700' },
    { id: 'obturacion', label: 'Obturación', color: '#3b82f6', fill: 'fill-blue-500', stroke: 'stroke-blue-700' },
    { id: 'corona', label: 'Corona', color: '#f59e0b', fill: 'fill-[#FBFFA3]', stroke: 'stroke-amber-600' },
    { id: 'endodoncia', label: 'Endodoncia', color: '#f97316', fill: 'fill-orange-500', stroke: 'stroke-orange-700' },
    { id: 'implante', label: 'Implante', color: '#8b5cf6', fill: 'fill-violet-500', stroke: 'stroke-violet-700' },
    { id: 'ausente', label: 'Ausente', color: '#94a3b8', fill: 'fill-slate-300', stroke: 'stroke-slate-500' },
];

const getInitialState = (): DienteData[] => {
    const numeros = [
        ...Array.from({ length: 8 }, (_, i) => `1${8 - i}`),
        ...Array.from({ length: 8 }, (_, i) => `2${i + 1}`),
        ...Array.from({ length: 8 }, (_, i) => `4${8 - i}`),
        ...Array.from({ length: 8 }, (_, i) => `3${i + 1}`),
    ];
    return numeros.map(num => ({
        numero: num,
        caras: { oclusal: 'normal', vestibular: 'normal', lingual: 'normal', mesial: 'normal', distal: 'normal' }
    }));
};

// Pre-populate for demo
const getDemoState = (): DienteData[] => {
    const base = getInitialState();
    // Caries en 16
    const d16 = base.find(d => d.numero === '16'); if (d16) { d16.caras.oclusal = 'caries'; d16.caras.mesial = 'caries'; }
    // Obturación en 26
    const d26 = base.find(d => d.numero === '26'); if (d26) { d26.caras.oclusal = 'obturacion'; d26.caras.distal = 'obturacion'; }
    // Endodoncia en 36
    const d36 = base.find(d => d.numero === '36'); if (d36) { Object.keys(d36.caras).forEach(c => d36.caras[c as CaraNombre] = 'endodoncia'); }
    // Ausente 46
    const d46 = base.find(d => d.numero === '46'); if (d46) { Object.keys(d46.caras).forEach(c => d46.caras[c as CaraNombre] = 'ausente'); }
    // Corona 11
    const d11 = base.find(d => d.numero === '11'); if (d11) { Object.keys(d11.caras).forEach(c => d11.caras[c as CaraNombre] = 'corona'); }
    return base;
};

const polygonPoints = {
    vestibular: '10,4 90,4 76,20 24,20',
    lingual: '10,96 90,96 76,80 24,80',
    mesial: '4,10 20,24 20,76 4,90',
    distal: '96,10 80,24 80,76 96,90',
    oclusal: '24,20 76,20 80,76 20,76',
};

const DienteVista: React.FC<{
    data: DienteData;
    isUpper: boolean;
    onCaraClick: (cara: CaraNombre) => void;
    activeTool: EstadoCara;
    tooltip: string | null;
    setTooltip: (t: string | null) => void;
}> = ({ data, isUpper, onCaraClick, activeTool: _activeTool, tooltip: _tooltip, setTooltip: _setTooltip }) => {

    const getClasses = (cara: CaraNombre) => {
        const e = ESTADOS.find(s => s.id === data.caras[cara])!;
        return `${e.fill} ${e.stroke} stroke-[2] cursor-pointer transition-all duration-150 hover:opacity-70 active:opacity-50`;
    };

    return (
        <div className="flex flex-col items-center gap-0.5 group">
            {isUpper && (
                <span className="text-[13px] font-bold text-slate-600 leading-none mb-0.5">{data.numero}</span>
            )}
            <svg
                viewBox="0 0 100 100"
                className="w-12 h-12 drop-shadow-sm"
            >
                {(Object.keys(polygonPoints) as CaraNombre[]).map(cara => (
                    <polygon
                        key={cara}
                        points={polygonPoints[cara]}
                        className={getClasses(cara)}
                        onClick={() => onCaraClick(cara)}
                        onMouseEnter={() => _setTooltip(`Pieza ${data.numero} — ${cara.charAt(0).toUpperCase() + cara.slice(1)}`)}
                        onMouseLeave={() => _setTooltip(null)}
                    />
                ))}
            </svg>
            {!isUpper && (
                <span className="text-[13px] font-bold text-slate-600 leading-none mt-0.5">{data.numero}</span>
            )}
        </div>
    );
};

interface OdontogramaProps {
    onSuggestionUpdate: (suggestion: AISuggestion | null) => void;
    numPac?: string;
}

const Odontograma: React.FC<OdontogramaProps> = ({ onSuggestionUpdate: _onSuggestionUpdate, numPac }) => {
    // Lazy initializer — getDemoState() solo se ejecuta UNA vez al montar, no en cada render
    const [dientes, setDientes] = useState<DienteData[]>(getDemoState);
    const [activeTool, setActiveTool] = useState<EstadoCara>('caries');
    const [tooltip, setTooltip] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // V-012: Declarado ANTES de resetAll para que setAiAnalysis esté en scope
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);

    // V-009: Cargar odontograma guardado del paciente
    useEffect(() => {
        if (!numPac) return;
        getOdontograma(numPac).then(datos => {
            if (datos && datos.length > 0) setDientes(datos);
        });
    }, [numPac]);

    // V-009: Auto-save debounced (500ms tras último cambio)
    const triggerSave = useCallback((newDientes: DienteData[]) => {
        if (!numPac) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            setSaving(true);
            await saveOdontograma(numPac, newDientes);
            setSaving(false);
        }, 500);
    }, [numPac]);

    const handleCaraClick = useCallback((numeroDiente: string, cara: CaraNombre) => {
        setDientes(prev => {
            const next = prev.map(d =>
                d.numero === numeroDiente
                    ? { ...d, caras: { ...d.caras, [cara]: activeTool } }
                    : d
            );
            triggerSave(next);
            return next;
        });
    }, [activeTool, triggerSave]);

    const resetAll = useCallback(() => {
        const initial = getInitialState();
        setDientes(initial);
        triggerSave(initial);
        setAiAnalysis(null);
    }, [triggerSave]);

    const handleAnalyze = useCallback(async () => {
        setAiLoading(true);
        try {
            const result = await analyzeOdontograma(dientes);
            setAiAnalysis(result);
        } catch {
            setAiAnalysis('Error al analizar. Inténtalo de nuevo.');
        } finally {
            setAiLoading(false);
        }
    }, [dientes]);

    // Stats
    const stats = ESTADOS.filter(e => e.id !== 'normal').map(e => ({
        ...e,
        count: dientes.reduce((acc, d) =>
            acc + Object.values(d.caras).filter(c => c === e.id).length, 0)
    })).filter(s => s.count > 0);

    const cuadrante1 = dientes.slice(0, 8);
    const cuadrante2 = dientes.slice(8, 16);
    const cuadrante4 = dientes.slice(16, 24);
    const cuadrante3 = dientes.slice(24, 32);

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Odontograma Clínico</h3>
                        <p className="text-[13px] text-slate-400 font-medium mt-0.5">Sistema FDI · {32} piezas · Haz clic en una cara para marcarla</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-[#FFF0F3] hover:text-[#E03555] hover:border-[#FFC0CB] transition-all"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reiniciar
                        </button>
                        {saving && (
                            <span className="flex items-center gap-1 text-[12px] font-bold text-blue-500">
                                <Save className="w-3 h-3 animate-spin" /> Guardando...
                            </span>
                        )}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-slate-100 bg-white">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mr-2">Herramienta:</span>
                        {ESTADOS.map(e => (
                            <button
                                key={e.id}
                                onClick={() => setActiveTool(e.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all border ${activeTool === e.id
                                    ? 'text-white shadow-sm scale-105'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                style={activeTool === e.id ? { backgroundColor: e.color, borderColor: e.color } : {}}
                            >
                                <span
                                    className="w-3 h-3 rounded-sm flex-shrink-0 border border-white/40"
                                    style={{ backgroundColor: e.color }}
                                />
                                {e.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tooltip flotante */}
                {tooltip && (
                    <div className="text-center py-1 bg-[#051650] text-white text-[13px] font-bold">
                        {tooltip}
                    </div>
                )}

                {/* Grid de dientes */}
                <div className="p-6 bg-gradient-to-b from-slate-50 to-white">
                    {/* Labels de cuadrante */}
                    <div className="grid grid-cols-2 mb-2 text-[13px] font-bold text-slate-400 uppercase tracking-widest">
                        <div className="text-right pr-6">Superior Derecho (Q1)</div>
                        <div className="pl-6">Superior Izquierdo (Q2)</div>
                    </div>

                    {/* Fila superior */}
                    <div className="flex justify-center items-end border-b-2 border-dashed border-slate-200 pb-4 mb-1">
                        <div className="flex gap-1">
                            {[...cuadrante1].reverse().map(d => (
                                <DienteVista key={d.numero} data={d} isUpper={true} activeTool={activeTool}
                                    onCaraClick={c => handleCaraClick(d.numero, c)} tooltip={tooltip} setTooltip={setTooltip} />
                            ))}
                        </div>
                        {/* Línea media */}
                        <div className="flex flex-col items-center mx-3">
                            <div className="w-px h-16 bg-slate-300" />
                        </div>
                        <div className="flex gap-1">
                            {cuadrante2.map(d => (
                                <DienteVista key={d.numero} data={d} isUpper={true} activeTool={activeTool}
                                    onCaraClick={c => handleCaraClick(d.numero, c)} tooltip={tooltip} setTooltip={setTooltip} />
                            ))}
                        </div>
                    </div>

                    {/* Separador horizontal */}
                    <div className="text-center text-[12px] font-bold text-slate-300 uppercase tracking-[0.3em] py-1 mb-1">
                        ── LÍNEA MEDIA OCLUSAL ──
                    </div>

                    {/* Fila inferior */}
                    <div className="flex justify-center items-start border-t-2 border-dashed border-slate-200 pt-4">
                        <div className="flex gap-1">
                            {[...cuadrante4].reverse().map(d => (
                                <DienteVista key={d.numero} data={d} isUpper={false} activeTool={activeTool}
                                    onCaraClick={c => handleCaraClick(d.numero, c)} tooltip={tooltip} setTooltip={setTooltip} />
                            ))}
                        </div>
                        <div className="flex flex-col items-center mx-3">
                            <div className="w-px h-16 bg-slate-300" />
                        </div>
                        <div className="flex gap-1">
                            {cuadrante3.map(d => (
                                <DienteVista key={d.numero} data={d} isUpper={false} activeTool={activeTool}
                                    onCaraClick={c => handleCaraClick(d.numero, c)} tooltip={tooltip} setTooltip={setTooltip} />
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 mt-2 text-[13px] font-bold text-slate-400 uppercase tracking-widest">
                        <div className="text-right pr-6">Inferior Derecho (Q4)</div>
                        <div className="pl-6">Inferior Izquierdo (Q3)</div>
                    </div>
                </div>

                {/* Leyenda y estadísticas */}
                {stats.length > 0 && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2 mb-3">
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Resumen de hallazgos</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {stats.map(s => (
                                <div key={s.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                                    <span className="text-[13px] font-bold text-slate-700">{s.label}</span>
                                    <span className="text-[13px] font-bold text-slate-400">
                                        {s.count} {s.count === 1 ? 'cara' : 'caras'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Panel IA Dental */}
            <div className="bg-[#051650] rounded-xl p-5 border border-white/10 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-blue-300" />
                    </div>
                    <div>
                        <p className="text-[12px] font-bold text-blue-400 uppercase tracking-widest">IA Dental</p>
                        <p className="text-sm font-bold text-white">Análisis del Odontograma</p>
                    </div>
                    <span className={`ml-auto flex items-center gap-1.5 text-[13px] font-bold uppercase ${isAIConfigured() ? 'text-[#118DF0]' : 'text-[#051650]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isAIConfigured() ? 'bg-[#118DF0]' : 'bg-[#FBFFA3]'}`} />
                        {isAIConfigured() ? 'IA Activa' : 'Sin API Key'}
                    </span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    {aiAnalysis ? (
                        <p className="text-[13px] text-blue-100/80 font-medium leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
                    ) : (
                        <p className="text-[13px] text-blue-100/40 font-medium italic">Pulsa el botón para analizar el odontograma con IA</p>
                    )}
                </div>
                <button
                    onClick={handleAnalyze}
                    disabled={aiLoading}
                    className="mt-3 w-full py-2 bg-white text-[#051650] rounded-lg text-[13px] font-bold uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {aiLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando...</> : 'Generar Plan de Tratamiento Completo'}
                </button>
            </div>
        </div>
    );
};

export default Odontograma;
