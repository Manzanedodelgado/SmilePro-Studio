
import React, { useState, useRef, useEffect } from 'react';
import {
    Stethoscope, ChevronDown, ShieldAlert, Mic, MicOff, Brain,
    CheckCircle, Loader2, Calendar, Save, X, Search
} from 'lucide-react';
import { searchTratamientos, getCategorias, type Tratamiento } from '../../services/tratamientos.service';

interface SOAPEditorProps {
    onSave: (noteData: {
        subjetivo: string; objetivo: string; analisis: string; plan: string;
        eva: number; fecha?: string; especialidad?: string;
        tratamiento_id?: number; tratamiento_nombre?: string;
        pieza?: number; cuadrante?: number; arcada?: string;
    }) => void;
    alergiasPaciente: string[];
    initialData?: {
        subjetivo: string; objetivo: string; analisis: string; plan: string;
        eva: number; fecha: string; especialidad: string;
        tratamiento_id?: number; tratamiento_nombre?: string;
        pieza?: number; cuadrante?: number; arcada?: string;
    };
    onCancel?: () => void;
}

type ListenState = 'idle' | 'listening' | 'analyzing' | 'done';

const ESPECIALIDADES = [
    'General / Libre', 'Implantología', 'Higiene', 'Ortodoncia',
    'Cirugía', 'Periodoncia', 'Urgencia', 'Odontopediatría', 'Estético',
];

const PIEZAS_ADULTO = [
    // Cuadrante 1 (sup der)
    18, 17, 16, 15, 14, 13, 12, 11,
    // Cuadrante 2 (sup izq)
    21, 22, 23, 24, 25, 26, 27, 28,
    // Cuadrante 3 (inf izq)
    38, 37, 36, 35, 34, 33, 32, 31,
    // Cuadrante 4 (inf der)
    41, 42, 43, 44, 45, 46, 47, 48,
];

const SIN_DATOS = 'Sin datos relacionados';

/** Analiza el transcript y llena los campos SOAP con IA (mock rule-based) */
function analyzeTranscript(transcript: string): {
    subjetivo: string; objetivo: string; analisis: string; plan: string; eva: number;
} {
    const t = transcript.toLowerCase();

    const evaMatch = t.match(/eva\s*(\d+)|dolor\s*(\d+)(?:\s*sobre\s*10)?|(\d+)\s*(?:sobre|de)\s*10/);
    const eva = evaMatch ? parseInt(evaMatch[1] ?? evaMatch[2] ?? evaMatch[3] ?? '0') : 0;

    const subjetivoPatterns = [
        /(?:paciente (?:refiere|dice|comenta|indica|menciona|acude|viene)[^.]*\.)/gi,
        /(?:motivo de consulta[^.]*\.)/gi,
        /(?:dolor (?:en|de)[^.]*\.)/gi,
    ];
    const subjetivoPartes: string[] = [];
    subjetivoPatterns.forEach(r => {
        const m = transcript.match(r);
        if (m) subjetivoPartes.push(...m);
    });

    const objetivoPatterns = [
        /(?:(?:a la exploración|exploración clínica|radiografía|rx|sondaje)[^.]*\.)/gi,
        /(?:(?:encía|mucosa|tejidos|implante)[^.]*\.)/gi,
    ];
    const objetivoPartes: string[] = [];
    objetivoPatterns.forEach(r => {
        const m = transcript.match(r);
        if (m) objetivoPartes.push(...m);
    });

    const analisisPatterns = [
        /(?:(?:diagnóstico|diagnosi|se trata de|compatible con|juicio clínico)[^.]*\.)/gi,
    ];
    const analisisPartes: string[] = [];
    analisisPatterns.forEach(r => {
        const m = transcript.match(r);
        if (m) analisisPartes.push(...m);
    });

    const planPatterns = [
        /(?:(?:se procede|se realiza|se aplica|tratamiento|plan|prescrib|siguiente visita|próxima cita)[^.]*\.)/gi,
    ];
    const planPartes: string[] = [];
    planPatterns.forEach(r => {
        const m = transcript.match(r);
        if (m) planPartes.push(...m);
    });

    return {
        subjetivo: subjetivoPartes.length ? subjetivoPartes.join(' ').trim() : SIN_DATOS,
        objetivo: objetivoPartes.length ? objetivoPartes.join(' ').trim() : SIN_DATOS,
        analisis: analisisPartes.length ? analisisPartes.join(' ').trim() : SIN_DATOS,
        plan: planPartes.length ? planPartes.join(' ').trim() : SIN_DATOS,
        eva,
    };
}

const SOAPEditor: React.FC<SOAPEditorProps> = ({
    onSave, alergiasPaciente, initialData, onCancel,
}) => {
    const todayISO = new Date().toISOString().split('T')[0];
    const [nota, setNota] = useState({
        subjetivo: initialData?.subjetivo ?? '',
        objetivo: initialData?.objetivo ?? '',
        analisis: initialData?.analisis ?? '',
        plan: initialData?.plan ?? '',
        eva: initialData?.eva ?? 0,
        fecha: initialData?.fecha ?? todayISO,
        especialidad: initialData?.especialidad ?? 'General / Libre',
    });

    // ── Tratamiento ──────────────────────────────────────
    const [selectedTto, setSelectedTto] = useState<Tratamiento | null>(null);
    const [ttoSearch, setTtoSearch] = useState(initialData?.tratamiento_nombre ?? '');
    const [ttoResults, setTtoResults] = useState<Tratamiento[]>([]);
    const [showTtoDropdown, setShowTtoDropdown] = useState(false);
    const [categoriaFilter, setCategoriaFilter] = useState('');
    const [categorias, setCategorias] = useState<string[]>([]);
    const [pieza, setPieza] = useState<number | undefined>(initialData?.pieza);
    const [cuadrante, setCuadrante] = useState<number | undefined>(initialData?.cuadrante);
    const [arcada, setArcada] = useState<string | undefined>(initialData?.arcada);
    const ttoRef = useRef<HTMLDivElement>(null);

    const [saving, setSaving] = useState(false);
    const [listenState, setListenState] = useState<ListenState>('idle');
    const [transcript, setTranscript] = useState('');
    const [listenSec, setListenSec] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load categorías on mount
    useEffect(() => {
        getCategorias().then(setCategorias);
    }, []);

    // Search tratamientos with debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (ttoSearch.length >= 1 || categoriaFilter) {
                const results = await searchTratamientos(ttoSearch, categoriaFilter || undefined);
                setTtoResults(results);
                setShowTtoDropdown(true);
            } else {
                setTtoResults([]);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [ttoSearch, categoriaFilter]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ttoRef.current && !ttoRef.current.contains(e.target as Node)) {
                setShowTtoDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Limpieza ────────────────────────────────────────
    useEffect(() => () => {
        recognitionRef.current?.stop();
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    // ── Escucha activa ───────────────────────────────────
    const startListening = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { alert('Tu navegador no soporta la API de reconocimiento de voz.'); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition: any = new SR();
        recognition.lang = 'es-ES';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        let accumulated = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (e: any) => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const text = e.results[i][0].transcript;
                if (e.results[i].isFinal) accumulated += text + '. ';
                else interim = text;
            }
            setTranscript(accumulated + interim);
        };
        recognition.onerror = () => stopListening(accumulated);
        recognition.onend = () => {
            if (listenState === 'listening') stopListening(accumulated);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setListenState('listening');
        setListenSec(0);

        timerRef.current = setInterval(() => setListenSec(s => s + 1), 1000);
    };

    const stopListening = (finalTranscript?: string) => {
        recognitionRef.current?.stop();
        if (timerRef.current) clearInterval(timerRef.current);
        const text = finalTranscript ?? transcript;
        if (!text.trim()) { setListenState('idle'); return; }

        setListenState('analyzing');
        setTimeout(() => {
            const filled = analyzeTranscript(text);
            setNota(prev => ({
                ...prev,
                subjetivo: filled.subjetivo !== SIN_DATOS ? filled.subjetivo : prev.subjetivo,
                objetivo: filled.objetivo !== SIN_DATOS ? filled.objetivo : prev.objetivo,
                analisis: filled.analisis !== SIN_DATOS ? filled.analisis : prev.analisis,
                plan: filled.plan !== SIN_DATOS ? filled.plan : prev.plan,
                eva: filled.eva > 0 ? filled.eva : prev.eva,
            }));
            setListenState('done');
        }, 1200);
    };

    const selectTratamiento = (tto: Tratamiento) => {
        setSelectedTto(tto);
        setTtoSearch(tto.nombre);
        setShowTtoDropdown(false);
        // Reset location fields
        setPieza(undefined);
        setCuadrante(undefined);
        setArcada(undefined);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTto && !initialData?.tratamiento_id) {
            // Flash the treatment selector
            ttoRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShowTtoDropdown(true);
            return;
        }
        setSaving(true);
        await new Promise(r => setTimeout(r, 600));
        onSave({
            ...nota,
            tratamiento_id: selectedTto?.id ?? initialData?.tratamiento_id,
            tratamiento_nombre: selectedTto?.nombre ?? initialData?.tratamiento_nombre,
            pieza,
            cuadrante,
            arcada,
        });
        setSaving(false);
        // Reset if new entry (no initialData)
        if (!initialData) {
            setNota({ subjetivo: '', objetivo: '', analisis: '', plan: '', eva: 0, fecha: todayISO, especialidad: 'General / Libre' });
            setTranscript('');
            setListenState('idle');
            setSelectedTto(null);
            setTtoSearch('');
            setPieza(undefined);
            setCuadrante(undefined);
            setArcada(undefined);
        }
    };

    const textAreaCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium outline-none focus:border-[#051650] focus:ring-2 focus:ring-[#051650]/10 resize-none transition-all placeholder:text-slate-300";

    const listenIcon = listenState === 'listening'
        ? <MicOff className="w-5 h-5 text-white" />
        : listenState === 'analyzing'
            ? <Loader2 className="w-5 h-5 text-white animate-spin" />
            : <Mic className="w-5 h-5 text-white" />;

    const listenBg = listenState === 'listening'
        ? 'bg-red-500 animate-pulse shadow-red-400/50'
        : listenState === 'analyzing'
            ? 'bg-amber-500'
            : 'bg-[#051650] hover:bg-blue-800';

    const tipoApp = selectedTto?.tipo_aplicacion ?? 'boca';

    return (
        <form onSubmit={handleSave} className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-wrap gap-2 shrink-0">
                <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#051650]" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#051650]">
                        {initialData ? 'Editar Evolutivo' : 'Nuevo Evolutivo'}
                    </h3>
                    <button
                        type="button"
                        onClick={() => listenState === 'listening' ? stopListening() : startListening()}
                        disabled={listenState === 'analyzing'}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ml-1 ${listenBg}`}
                        title="IA Dental — Escucha Activa"
                    >
                        {listenIcon}
                    </button>
                    {listenState === 'listening' && <span className="text-[10px] text-red-500 font-bold animate-pulse">Escuchando... {String(Math.floor(listenSec / 60)).padStart(2, '0')}:{String(listenSec % 60).padStart(2, '0')}</span>}
                    {listenState === 'analyzing' && <span className="text-[10px] text-amber-500 font-bold">Analizando...</span>}
                    {listenState === 'done' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="date"
                            value={nota.fecha}
                            onChange={e => setNota({ ...nota, fecha: e.target.value })}
                            className="text-xs font-bold text-slate-600 bg-transparent outline-none border-b border-dashed border-slate-300 focus:border-[#051650] transition-colors"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={nota.especialidad}
                            onChange={e => setNota({ ...nota, especialidad: e.target.value })}
                            className="appearance-none bg-white border border-slate-200 text-xs font-bold rounded-lg pl-3 pr-7 py-1 outline-none text-slate-600 uppercase cursor-pointer hover:border-[#051650] transition-all"
                        >
                            {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1.5 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="p-3 pb-2 flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto custom-scrollbar">

                {/* ── SELECTOR DE TRATAMIENTO ── */}
                <div ref={ttoRef} className={`border rounded-lg p-2.5 transition-all ${!selectedTto && !initialData?.tratamiento_id
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-slate-200 bg-white'
                    }`}>
                    <label className="text-[10px] font-black text-[#051650] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-500" /> Tratamiento
                        <span className="text-amber-500 text-[8px] font-normal normal-case ml-1">(obligatorio)</span>
                    </label>

                    <div className="flex gap-2 items-start">
                        {/* Search + Dropdown */}
                        <div className="flex-1 relative">
                            <div className="flex gap-1.5">
                                {/* Category filter */}
                                <select
                                    value={categoriaFilter}
                                    onChange={e => setCategoriaFilter(e.target.value)}
                                    className="appearance-none bg-slate-50 border border-slate-200 text-[10px] font-bold rounded-lg pl-2 pr-5 py-1.5 outline-none text-slate-600 cursor-pointer hover:border-[#051650] transition-all w-28 shrink-0"
                                >
                                    <option value="">Todas</option>
                                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>

                                {/* Search input */}
                                <div className="relative flex-1">
                                    <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                                    <input
                                        type="text"
                                        value={ttoSearch}
                                        onChange={e => { setTtoSearch(e.target.value); setSelectedTto(null); }}
                                        onFocus={() => ttoSearch && setShowTtoDropdown(true)}
                                        placeholder="Buscar tratamiento..."
                                        className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-[#051650] focus:ring-2 focus:ring-[#051650]/10 transition-all placeholder:text-slate-300"
                                    />
                                    {selectedTto && (
                                        <button type="button" onClick={() => { setSelectedTto(null); setTtoSearch(''); }}
                                            className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600">
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Results dropdown */}
                            {showTtoDropdown && ttoResults.length > 0 && (
                                <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {ttoResults.map(tto => (
                                        <button
                                            key={tto.id} type="button"
                                            onClick={() => selectTratamiento(tto)}
                                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                                        >
                                            <span className="text-xs font-semibold text-slate-700">{tto.nombre}</span>
                                            <span className="ml-2 text-[9px] font-medium text-slate-400">
                                                {tto.categoria} · {tto.tipo_aplicacion === 'pieza' ? '🦷' : tto.tipo_aplicacion === 'cuadrante' ? '◔' : tto.tipo_aplicacion === 'arcada' ? '◡' : '○'}
                                            </span>
                                            {tto.precio > 0 && (
                                                <span className="ml-2 text-[9px] font-bold text-emerald-600">{tto.precio.toFixed(2)}€</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pieza / Cuadrante / Arcada selector */}
                        {selectedTto && tipoApp === 'pieza' && (
                            <select
                                value={pieza ?? ''}
                                onChange={e => setPieza(Number(e.target.value) || undefined)}
                                className="appearance-none bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg pl-2 pr-5 py-1.5 outline-none text-slate-600 w-20 shrink-0"
                            >
                                <option value="">Pieza</option>
                                {PIEZAS_ADULTO.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        )}
                        {selectedTto && tipoApp === 'cuadrante' && (
                            <select
                                value={cuadrante ?? ''}
                                onChange={e => setCuadrante(Number(e.target.value) || undefined)}
                                className="appearance-none bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg pl-2 pr-5 py-1.5 outline-none text-slate-600 w-20 shrink-0"
                            >
                                <option value="">Cuad.</option>
                                <option value="1">Q1 ↗</option>
                                <option value="2">Q2 ↖</option>
                                <option value="3">Q3 ↙</option>
                                <option value="4">Q4 ↘</option>
                            </select>
                        )}
                        {selectedTto && tipoApp === 'arcada' && (
                            <select
                                value={arcada ?? ''}
                                onChange={e => setArcada(e.target.value || undefined)}
                                className="appearance-none bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg pl-2 pr-5 py-1.5 outline-none text-slate-600 w-24 shrink-0"
                            >
                                <option value="">Arcada</option>
                                <option value="superior">Superior</option>
                                <option value="inferior">Inferior</option>
                            </select>
                        )}
                    </div>

                    {/* Selected treatment chip */}
                    {selectedTto && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[9px] bg-violet-100 text-violet-800 font-bold px-2 py-0.5 rounded-full">
                                {selectedTto.nombre}
                            </span>
                            <span className="text-[9px] text-slate-400">{selectedTto.categoria}</span>
                            {pieza && <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">Pieza {pieza}</span>}
                            {cuadrante && <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">Q{cuadrante}</span>}
                            {arcada && <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full capitalize">{arcada}</span>}
                        </div>
                    )}
                </div>

                {/* Campos SOAP */}
                <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                    {/* S */}
                    <div className="flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500" /> S — Subjetivo
                            </label>
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                                <span className="text-[9px] font-bold text-slate-500">EVA:</span>
                                <input
                                    type="number" min={0} max={10}
                                    value={nota.eva}
                                    onChange={e => setNota({ ...nota, eva: parseInt(e.target.value) || 0 })}
                                    className="w-5 bg-transparent text-[10px] font-black text-[#051650] outline-none text-center"
                                />
                                <span className="text-[9px] text-slate-400">/10</span>
                            </div>
                        </div>
                        <textarea value={nota.subjetivo}
                            onChange={e => setNota({ ...nota, subjetivo: e.target.value })}
                            className={`${textAreaCls} flex-1 min-h-[50px] text-xs`} placeholder="Motivo de consulta, palabras del paciente..." />
                    </div>

                    {/* O */}
                    <div className="flex flex-col min-h-0">
                        <label className="text-[10px] font-black text-orange-600 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-orange-500" /> O — Objetivo
                        </label>
                        <textarea value={nota.objetivo}
                            onChange={e => setNota({ ...nota, objetivo: e.target.value })}
                            className={`${textAreaCls} flex-1 min-h-[50px] text-xs`} placeholder="Hallazgos físicos, pruebas, radiografías..." />
                    </div>

                    {/* A */}
                    <div className="flex flex-col min-h-0">
                        <label className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> A — Análisis
                        </label>
                        <textarea value={nota.analisis}
                            onChange={e => setNota({ ...nota, analisis: e.target.value })}
                            className={`${textAreaCls} flex-1 min-h-[50px] text-xs`} placeholder="Juicio clínico y pronóstico..." />
                    </div>

                    {/* P */}
                    <div className="flex flex-col min-h-0">
                        <label className="text-[10px] font-black text-[#051650] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-[#051650]" /> P — Plan
                        </label>
                        <textarea value={nota.plan}
                            onChange={e => setNota({ ...nota, plan: e.target.value })}
                            className={`${textAreaCls} flex-1 min-h-[50px] text-xs`} placeholder="Tratamiento ejecutado, medicación, instrucciones..." />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0 mt-auto">
                    <p className="text-[9px] text-slate-500 font-medium italic">
                        El registro se bloquea legalmente 24h tras la firma electrónica.
                    </p>
                    <div className="flex items-center gap-2">
                        {onCancel && (
                            <button type="button" onClick={onCancel}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-[9px] font-black uppercase text-slate-500 hover:bg-slate-50 transition-all">
                                Cancelar
                            </button>
                        )}
                        <button
                            type="submit" disabled={saving}
                            className="flex items-center gap-1.5 bg-[#051650] text-white px-4 py-1.5 rounded-lg font-black uppercase text-[10px] tracking-wider shadow-md hover:bg-blue-900 active:scale-95 transition-all disabled:opacity-60"
                        >
                            {saving
                                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Firmando...</>
                                : <><Save className="w-3 h-3" /> {initialData ? 'Guardar' : 'Firmar'}</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default SOAPEditor;
