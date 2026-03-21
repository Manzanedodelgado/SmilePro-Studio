
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, RotateCcw, Save, Loader2, Search, X } from 'lucide-react';
import { getOdontograma, saveOdontograma } from '../../services/odontograma.service';
import { getPresupuestosByPaciente } from '../../services/presupuestos.service';
import { analyzeOdontograma, isAIConfiguredSync } from '../../services/ia-dental.service';
import Periodontograma from './Periodontograma';
import { getToothImageSrc, shouldMirrorTooth, isToothPNGFlipped, SURFACE_PATHS } from './toothPaths';
import { CATEGORIAS, HALLAZGOS, getHallazgoById, type HallazgoCategoria, type Hallazgo } from './hallazgos';

// ── Types ──
type EstadoCara = 'normal' | 'caries' | 'caries_incipiente' | 'caries_profunda' |
  'obturacion' | 'amalgama' | 'resina' | 'inlay' | 'sellante' |
  'corona' | 'implante' | 'puente' | 'veneer' |
  'orto_fijo' | 'orto_removible' |
  'bolsa_periodontal' | 'recesion' | 'movilidad' |
  'ausente' | 'endodoncia' | 'fractura';

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

// ── Helpers ──
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

/** Map treatment description from presupuesto to odontogram hallazgo ID */
const mapTreatmentToHallazgo = (desc: string): EstadoCara | null => {
  const d = desc.toLowerCase();
  if (d.includes('empaste') || d.includes('composite') || d.includes('obturación') || d.includes('obturacion')) return 'obturacion';
  if (d.includes('amalgama')) return 'amalgama';
  if (d.includes('resina')) return 'resina';
  if (d.includes('inlay') || d.includes('onlay') || d.includes('incrustación')) return 'inlay';
  if (d.includes('sellante') || d.includes('sellado')) return 'sellante';
  if (d.includes('endodoncia') || d.includes('retratamiento endodóntico')) return 'endodoncia';
  if (d.includes('corona') && !d.includes('alargamiento')) return 'corona';
  if (d.includes('puente')) return 'puente';
  if (d.includes('implante')) return 'implante';
  if (d.includes('carilla')) return 'veneer';
  if (d.includes('extracción') || d.includes('extraccion')) return 'ausente';
  if (d.includes('ortodoncia fija') || d.includes('bracket')) return 'orto_fijo';
  if (d.includes('alineador') || d.includes('ortodoncia') || d.includes('contenedor')) return 'orto_removible';
  if (d.includes('curetaje') || d.includes('raspado') || d.includes('periodontal')) return 'bolsa_periodontal';
  if (d.includes('caries')) return 'caries';
  return null;
};

const getDemoState = (): DienteData[] => {
  const base = getInitialState();
  const d16 = base.find(d => d.numero === '16'); if (d16) { d16.caras.oclusal = 'caries'; d16.caras.mesial = 'caries'; }
  const d26 = base.find(d => d.numero === '26'); if (d26) { d26.caras.oclusal = 'obturacion'; d26.caras.distal = 'obturacion'; }
  const d36 = base.find(d => d.numero === '36'); if (d36) { Object.keys(d36.caras).forEach(c => d36.caras[c as CaraNombre] = 'endodoncia'); }
  const d46 = base.find(d => d.numero === '46'); if (d46) { Object.keys(d46.caras).forEach(c => d46.caras[c as CaraNombre] = 'ausente'); }
  const d11 = base.find(d => d.numero === '11'); if (d11) { Object.keys(d11.caras).forEach(c => d11.caras[c as CaraNombre] = 'corona'); }
  return base;
};

function getColorForEstado(estado: EstadoCara): string {
  const hallazgo = getHallazgoById(estado);
  if (hallazgo) return hallazgo.color;
  if (estado === 'normal') return 'transparent';
  return '#e2e8f0';
}


// ── Tooth Image Component ──
const DienteSilueta: React.FC<{
  data: DienteData;
  isSelected: boolean;
  onClick: () => void;
}> = ({ data, isSelected, onClick }) => {
  const imgSrc = getToothImageSrc(data.numero);
  const mirrored = shouldMirrorTooth(data.numero);
  const pngFlipped = isToothPNGFlipped(data.numero);
  const quadrant = Math.floor(parseInt(data.numero, 10) / 10);
  const isUpper = quadrant <= 2;

  const hallazgoColors = Object.values(data.caras)
    .filter(c => c !== 'normal')
    .map(c => getColorForEstado(c));

  const mainColor = hallazgoColors.length > 0 ? hallazgoColors[0] : undefined;
  const isAusente = Object.values(data.caras).every(c => c === 'ausente');

  return (
    <div
      className={`flex flex-col items-center cursor-pointer transition-all duration-200 group
        ${isSelected ? 'scale-110 z-10' : 'hover:scale-105'}
      `}
      onClick={onClick}
    >
      {isUpper && (
        <span className={`text-[11px] font-bold leading-none mb-1 transition-colors
          ${isSelected ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'}
        `}>
          {data.numero}
        </span>
      )}

      <div className={`relative transition-all duration-200 rounded-md
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 bg-blue-50/50' : ''}
      `}>
        <img
          src={imgSrc}
          alt={`Pieza ${data.numero}`}
          className={`h-36 w-auto object-contain transition-opacity
            ${isAusente ? 'opacity-20 grayscale' : ''}
          `}
          style={{
            transform: [
              // XOR: flip if lower tooth XOR png is already flipped
              isUpper !== pngFlipped ? '' : 'scaleY(-1)',
              mirrored ? 'scaleX(-1)' : '',
            ].filter(Boolean).join(' ') || undefined,
            minWidth: '40px',
            maxWidth: '90px',
            filter: mainColor
              ? `drop-shadow(0 0 3px ${mainColor})`
              : undefined,
          }}
          draggable={false}
        />
        {/* Color overlay for hallazgos */}
        {mainColor && (
          <div
            className="absolute inset-0 rounded-md mix-blend-multiply pointer-events-none"
            style={{ backgroundColor: mainColor, opacity: 0.3 }}
          />
        )}
        {/* Multi-hallazgo indicator */}
        {hallazgoColors.length > 1 && (
          <div className="absolute top-0 right-0 w-3 h-3 bg-blue-600 rounded-full border border-white" />
        )}
      </div>

      {!isUpper && (
        <span className={`text-[11px] font-bold leading-none mt-1 transition-colors
          ${isSelected ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'}
        `}>
          {data.numero}
        </span>
      )}
    </div>
  );
};

// ── Surface Selection Modal ──
const SurfaceModal: React.FC<{
  diente: DienteData;
  hallazgoActivo: Hallazgo;
  onSave: (caras: Record<CaraNombre, EstadoCara>) => void;
  onClose: () => void;
}> = ({ diente, hallazgoActivo, onSave, onClose }) => {
  const [caras, setCaras] = useState<Record<CaraNombre, EstadoCara>>({ ...diente.caras });

  const toggleCara = (cara: CaraNombre) => {
    setCaras(prev => ({
      ...prev,
      [cara]: prev[cara] === hallazgoActivo.id ? 'normal' : hallazgoActivo.id as EstadoCara,
    }));
  };

  const handleSave = () => {
    onSave(caras);
    onClose();
  };

  // For whole-tooth hallazgos, mark all at once
  const applyWholeTooth = () => {
    const allCara = {} as Record<CaraNombre, EstadoCara>;
    const allAreSet = Object.values(caras).every(c => c === hallazgoActivo.id);
    (Object.keys(caras) as CaraNombre[]).forEach(c => {
      allCara[c] = allAreSet ? 'normal' : hallazgoActivo.id as EstadoCara;
    });
    setCaras(allCara);
  };

  const caraLabels: Record<CaraNombre, string> = {
    vestibular: 'V',
    lingual: 'L/P',
    mesial: 'M',
    distal: 'D',
    oclusal: 'O',
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-[scaleIn_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold" style={{ color: hallazgoActivo.color }}>
              {hallazgoActivo.label}
            </h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Pieza <span className="font-bold text-slate-700">#{diente.numero}</span>
            {hallazgoActivo.porSuperficie
              ? ' · Selecciona las superficies afectadas'
              : ' · Se aplicará a toda la pieza'}
          </p>
        </div>

        {/* Surface selector */}
        <div className="px-6 pb-4">
          {hallazgoActivo.porSuperficie ? (
            <div className="flex justify-center py-4">
              <svg viewBox="0 0 100 100" className="w-48 h-48">
                {(Object.entries(SURFACE_PATHS) as [CaraNombre, string][]).map(([cara, pathD]) => {
                  const isActive = caras[cara] === hallazgoActivo.id;
                  return (
                    <g key={cara}>
                      <path
                        d={pathD}
                        fill={isActive ? hallazgoActivo.color : '#f8fafc'}
                        stroke={isActive ? hallazgoActivo.color : '#cbd5e1'}
                        strokeWidth="1.5"
                        className="cursor-pointer transition-all duration-150 hover:opacity-80"
                        onClick={() => toggleCara(cara)}
                      />
                      <text
                        x={cara === 'mesial' ? 12 : cara === 'distal' ? 88 : 50}
                        y={cara === 'vestibular' ? 16 : cara === 'lingual' ? 88 : 52}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="pointer-events-none select-none"
                        fill={isActive ? 'white' : '#64748b'}
                        fontSize="10"
                        fontWeight="700"
                      >
                        {caraLabels[cara]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="flex justify-center py-6">
              <button
                onClick={applyWholeTooth}
                className="flex flex-col items-center gap-3 px-8 py-5 rounded-xl border-2 transition-all"
                style={{
                  borderColor: Object.values(caras).every(c => c === hallazgoActivo.id)
                    ? hallazgoActivo.color : '#e2e8f0',
                  backgroundColor: Object.values(caras).every(c => c === hallazgoActivo.id)
                    ? `${hallazgoActivo.color}15` : 'white',
                }}
              >
                <img
                    src={getToothImageSrc(diente.numero)}
                    alt={`Pieza ${diente.numero}`}
                    className="h-20 w-auto object-contain"
                    style={{
                      transform: shouldMirrorTooth(diente.numero) ? 'scaleX(-1)' : undefined,
                      filter: Object.values(caras).every(c => c === hallazgoActivo.id)
                        ? `drop-shadow(0 0 4px ${hallazgoActivo.color})`
                        : undefined,
                    }}
                  />
                <span className="text-sm font-bold" style={{ color: hallazgoActivo.color }}>
                  {Object.values(caras).every(c => c === hallazgoActivo.id) ? 'Quitar hallazgo' : 'Marcar pieza completa'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 text-sm font-bold text-white rounded-lg transition-all hover:opacity-90 active:scale-95 shadow-sm"
            style={{ backgroundColor: hallazgoActivo.color }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Findings Panel ──
const PanelHallazgos: React.FC<{
  categoriaActiva: HallazgoCategoria;
  setCategoriaActiva: (c: HallazgoCategoria) => void;
  hallazgoActivo: Hallazgo;
  setHallazgoActivo: (h: Hallazgo) => void;
  busqueda: string;
  setBusqueda: (b: string) => void;
}> = ({ categoriaActiva, setCategoriaActiva, hallazgoActivo, setHallazgoActivo, busqueda, setBusqueda }) => {

  const hallazgosFiltrados = HALLAZGOS.filter(h => {
    const matchCategoria = h.categoria === categoriaActiva;
    const matchBusqueda = !busqueda || h.label.toLowerCase().includes(busqueda.toLowerCase());
    return matchCategoria && matchBusqueda;
  });

  return (
    <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100 bg-slate-50">
        {CATEGORIAS.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoriaActiva(cat.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border
              ${categoriaActiva === cat.id
                ? 'text-white shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            style={categoriaActiva === cat.id
              ? { backgroundColor: cat.color, borderColor: cat.color }
              : {}}
          >
            {cat.shortLabel}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar hallazgo"
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
      </div>

      {/* Findings list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {hallazgosFiltrados.map(h => (
          <button
            key={h.id}
            onClick={() => setHallazgoActivo(h)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all
              ${hallazgoActivo.id === h.id
                ? 'bg-blue-50 border border-blue-200 shadow-sm'
                : 'hover:bg-slate-50 border border-transparent'
              }`}
          >
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0 border border-white/30"
              style={{ backgroundColor: h.color }}
            />
            <span className={`text-[12px] font-semibold
              ${hallazgoActivo.id === h.id ? 'text-blue-700' : 'text-slate-600'}
            `}>
              {h.label}
            </span>
          </button>
        ))}
        {hallazgosFiltrados.length === 0 && (
          <p className="text-[11px] text-slate-400 text-center py-4">No se encontró ningún hallazgo</p>
        )}
      </div>

      {/* Active tool indicator */}
      <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hallazgo activo</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: hallazgoActivo.color }} />
          <span className="text-[12px] font-bold text-slate-700">{hallazgoActivo.label}</span>
        </div>
      </div>
    </div>
  );
};

// ── Main Odontograma Component ──
interface OdontogramaProps {
  onSuggestionUpdate: (suggestion: AISuggestion | null) => void;
  numPac?: string;
}

const Odontograma: React.FC<OdontogramaProps> = ({ onSuggestionUpdate: _onSuggestionUpdate, numPac }) => {
  const [activeTab, setActiveTab] = useState<'odontograma' | 'periodontograma'>('odontograma');
  const [dientes, setDientes] = useState<DienteData[]>(getDemoState);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Hallazgos panel state
  const [categoriaActiva, setCategoriaActiva] = useState<HallazgoCategoria>('caries');
  const [hallazgoActivo, setHallazgoActivo] = useState<Hallazgo>(HALLAZGOS[0]);
  const [busqueda, setBusqueda] = useState('');

  // Modal state
  const [dienteSeleccionado, setDienteSeleccionado] = useState<string | null>(null);

  // Load patient data — merge backend odontogram + presupuestos treatments
  useEffect(() => {
    if (!numPac) return;
    (async () => {
      // 1) Try loading saved odontogram from backend
      const datos = await getOdontograma(numPac);
      let base = datos && datos.length > 0 ? datos as DienteData[] : getInitialState();

      // 2) Overlay finalized treatments from presupuestos
      try {
        const presupuestos = await getPresupuestosByPaciente(numPac);
        for (const pres of presupuestos) {
          for (const linea of pres.lineas) {
            if (!linea.pieza || linea.estado === 'Anulado') continue;
            const hallazgo = mapTreatmentToHallazgo(linea.descripcion);
            if (!hallazgo) continue;
            const diente = base.find(d => d.numero === linea.pieza);
            if (!diente) continue;

            const hallazgoDef = getHallazgoById(hallazgo);
            if (hallazgoDef && !hallazgoDef.porSuperficie) {
              // Whole-tooth hallazgo (corona, implante, ausente, endodoncia...)
              (Object.keys(diente.caras) as CaraNombre[]).forEach(c => {
                if (diente.caras[c] === 'normal') diente.caras[c] = hallazgo;
              });
            } else {
              // Surface-specific: mark oclusal by default
              if (diente.caras.oclusal === 'normal') diente.caras.oclusal = hallazgo;
              else if (diente.caras.mesial === 'normal') diente.caras.mesial = hallazgo;
              else if (diente.caras.distal === 'normal') diente.caras.distal = hallazgo;
            }
          }
        }
      } catch { /* presupuestos not available, continue with base */ }

      setDientes(base);
    })();
  }, [numPac]);

  // Auto-save debounced
  const triggerSave = useCallback((newDientes: DienteData[]) => {
    if (!numPac) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveOdontograma(numPac, newDientes);
      setSaving(false);
    }, 500);
  }, [numPac]);

  const handleDienteClick = useCallback((numero: string) => {
    setDienteSeleccionado(numero);
  }, []);

  const handleSurfaceSave = useCallback((numero: string, caras: Record<CaraNombre, EstadoCara>) => {
    setDientes(prev => {
      const next = prev.map(d =>
        d.numero === numero ? { ...d, caras } : d
      );
      triggerSave(next);
      return next;
    });
    setDienteSeleccionado(null);
  }, [triggerSave]);

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
  const stats = HALLAZGOS.map(h => ({
    ...h,
    count: dientes.reduce((acc, d) =>
      acc + Object.values(d.caras).filter(c => c === h.id).length, 0),
  })).filter(s => s.count > 0);

  const cuadrante1 = dientes.slice(0, 8);
  const cuadrante2 = dientes.slice(8, 16);
  const cuadrante4 = dientes.slice(16, 24);
  const cuadrante3 = dientes.slice(24, 32);

  const dienteModal = dienteSeleccionado ? dientes.find(d => d.numero === dienteSeleccionado) : null;

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([
          { id: 'odontograma', label: 'Odontograma' },
          { id: 'periodontograma', label: 'Periodontograma' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-[#051650] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'periodontograma' && <Periodontograma numPac={numPac} />}

      {activeTab === 'odontograma' && (
        <>
          <div className="flex gap-4">
            {/* Findings Panel */}
            <PanelHallazgos
              categoriaActiva={categoriaActiva}
              setCategoriaActiva={setCategoriaActiva}
              hallazgoActivo={hallazgoActivo}
              setHallazgoActivo={setHallazgoActivo}
              busqueda={busqueda}
              setBusqueda={setBusqueda}
            />

            {/* Main odontogram area */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Odontograma Clínico</h3>
                  <p className="text-[12px] text-slate-400 font-medium mt-0.5">
                    Sistema FDI · 32 piezas · Clic en un diente para registrar hallazgos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-[#FFF0F3] hover:text-[#E03555] hover:border-[#FFC0CB] transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reiniciar
                  </button>
                  {saving && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-blue-500">
                      <Save className="w-3 h-3 animate-spin" /> Guardando...
                    </span>
                  )}
                </div>
              </div>

              {/* Tooth grid */}
              <div className="p-6 bg-gradient-to-b from-slate-50/50 to-white">
                {/* Upper jaw labels */}
                <div className="grid grid-cols-2 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="text-right pr-6">Superior Derecho (Q1)</div>
                  <div className="pl-6">Superior Izquierdo (Q2)</div>
                </div>

                {/* Upper row */}
                <div className="flex justify-center items-end border-b-2 border-dashed border-slate-200 pb-4 mb-1">
                  <div className="flex gap-px">
                    {cuadrante1.map(d => (
                      <DienteSilueta
                        key={d.numero}
                        data={d}
                        isSelected={dienteSeleccionado === d.numero}
                        onClick={() => handleDienteClick(d.numero)}
                      />
                    ))}
                  </div>
                  <div className="flex flex-col items-center mx-2">
                    <div className="w-px h-36 bg-slate-300" />
                  </div>
                  <div className="flex gap-px">
                    {cuadrante2.map(d => (
                      <DienteSilueta
                        key={d.numero}
                        data={d}
                        isSelected={dienteSeleccionado === d.numero}
                        onClick={() => handleDienteClick(d.numero)}
                      />
                    ))}
                  </div>
                </div>

                {/* Midline */}
                <div className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em] py-1 mb-1">
                  ── N° diente ──
                </div>

                {/* Lower row */}
                <div className="flex justify-center items-start border-t-2 border-dashed border-slate-200 pt-4">
                  <div className="flex gap-px">
                    {cuadrante4.map(d => (
                      <DienteSilueta
                        key={d.numero}
                        data={d}
                        isSelected={dienteSeleccionado === d.numero}
                        onClick={() => handleDienteClick(d.numero)}
                      />
                    ))}
                  </div>
                  <div className="flex flex-col items-center mx-2">
                    <div className="w-px h-36 bg-slate-300" />
                  </div>
                  <div className="flex gap-px">
                    {cuadrante3.map(d => (
                      <DienteSilueta
                        key={d.numero}
                        data={d}
                        isSelected={dienteSeleccionado === d.numero}
                        onClick={() => handleDienteClick(d.numero)}
                      />
                    ))}
                  </div>
                </div>

                {/* Lower jaw labels */}
                <div className="grid grid-cols-2 mt-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="text-right pr-6">Inferior Derecho (Q4)</div>
                  <div className="pl-6">Inferior Izquierdo (Q3)</div>
                </div>
              </div>

              {/* Findings summary */}
              {stats.length > 0 && (
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Resumen de hallazgos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {stats.map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-[11px] font-bold text-slate-600">{s.label}</span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {s.count} {s.count === 1 ? 'cara' : 'caras'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Panel */}
          <div className="bg-[#051650] rounded-xl p-5 border border-white/10 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-300" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">IA Dental</p>
                <p className="text-sm font-bold text-white">Análisis del Odontograma</p>
              </div>
              <span className={`ml-auto flex items-center gap-1.5 text-[12px] font-bold uppercase ${isAIConfiguredSync() ? 'text-[#118DF0]' : 'text-blue-300/50'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isAIConfiguredSync() ? 'bg-[#118DF0]' : 'bg-[#FBFFA3]'}`} />
                {isAIConfiguredSync() ? 'IA Activa' : 'Sin API Key'}
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
        </>
      )}

      {/* Surface selection modal */}
      {dienteModal && (
        <SurfaceModal
          diente={dienteModal}
          hallazgoActivo={hallazgoActivo}
          onSave={(caras) => handleSurfaceSave(dienteModal.numero, caras)}
          onClose={() => setDienteSeleccionado(null)}
        />
      )}
    </div>
  );
};

export default Odontograma;
