
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zap, RotateCcw, Save, Loader2, Search, X, BarChart3 } from 'lucide-react';
import { getOdontograma, saveOdontograma } from '../../services/odontograma.service';
import { getEntradasMedicas } from '../../services/clinical.service';
import { analyzeOdontograma, isAIConfiguredSync } from '../../services/ia-dental.service';
import Periodontograma from './Periodontograma';
import { getToothImageSrc, getOcclusalImageSrc, shouldMirrorTooth, isToothPNGFlipped, SURFACE_PATHS } from './toothPaths';
import { CATEGORIAS, HALLAZGOS, getHallazgoById, type HallazgoCategoria, type Hallazgo } from './hallazgos';

// ── Types ──
type EstadoCara = 'normal' | 'caries' | 'caries_incipiente' | 'caries_profunda' |
  'obturacion' | 'amalgama' | 'resina' | 'inlay' | 'sellante' |
  'corona' | 'implante' | 'puente' | 'veneer' |
  'orto_fijo' | 'orto_removible' |
  'bolsa_periodontal' | 'recesion' | 'movilidad' |
  'ausente' | 'endodoncia' | 'fractura';

type CaraNombre = 'oclusal' | 'vestibular' | 'lingual' | 'mesial' | 'distal';

export interface DienteData {
  numero: string;
  caras: Record<CaraNombre, EstadoCara>;
  origenes?: Record<CaraNombre, 'previo' | 'presupuesto'>;
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
    caras: { oclusal: 'normal', vestibular: 'normal', lingual: 'normal', mesial: 'normal', distal: 'normal' },
    origenes: { oclusal: 'previo', vestibular: 'previo', lingual: 'previo', mesial: 'previo', distal: 'previo' }
  }));
};

/** Map treatment description from presupuesto to odontogram hallazgo ID */
const mapTreatmentToHallazgo = (desc: string): EstadoCara | null => {
  const d = desc.toLowerCase();
  
  if (d.includes('empaste') || d.includes('composite') || d.includes('obturación') || d.includes('obturacion') || d.includes('reconstruccion') || d.includes('reconstrucción')) return 'obturacion';
  if (d.includes('amalgama')) return 'amalgama';
  if (d.includes('resina')) return 'resina';
  if (d.includes('inlay') || d.includes('onlay') || d.includes('incrustación')) return 'inlay';
  if (d.includes('sellante') || d.includes('sellado')) return 'sellante';
  
  // Implantes
  if (d.includes('implante') || d.includes('fixture')) return 'implante';

  // Coronas y puentes
  if (d.includes('corona') || d.includes('funda') || (d.includes('protesis fija') && !d.includes('puente'))) return 'corona';
  if (d.includes('puente')) return 'puente';
  if (d.includes('carilla') || d.includes('veneer')) return 'veneer';

  // Endodoncia
  if (d.includes('endodoncia') || d.includes('retratamiento endodóntico') || d.includes('tto conductos')) return 'endodoncia';
  if (d.includes('perno') || d.includes('poste')) return 'perno';

  // Extracciones
  if (d.includes('extracción') || d.includes('extraccion') || d.includes('exodoncia') || d.includes('cirugía de extracción')) return 'ausente';

  // Ortodoncia
  if (d.includes('ortodoncia fija') || d.includes('bracket')) return 'orto_fijo';
  if (d.includes('alineador') || d.includes('ortodoncia') || d.includes('contenedor') || d.includes('retirar ortodoncia')) return 'orto_removible';
  
  // Periodoncia
  if (d.includes('curetaje') || d.includes('raspado') || d.includes('periodontal') || d.includes('periodoncia')) return 'bolsa_periodontal';
  
  if (d.includes('caries')) return 'caries';
  
  return null;
};

/** Extracts target surfaces (oclusal, mesial, etc) from text comments (e.g. "(O, M)" or "Oclusal, Mesial" ) */
const extractSurfacesFromText = (desc: string): CaraNombre[] => {
  const rs = desc.toUpperCase();
  const caras: CaraNombre[] = [];
  
  if (rs.includes('OCLUSAL')) caras.push('oclusal');
  if (rs.includes('MESIAL')) caras.push('mesial');
  if (rs.includes('DISTAL')) caras.push('distal');
  if (rs.includes('VESTIBULAR')) caras.push('vestibular');
  if (rs.includes('LINGUAL') || rs.includes('PALATINO')) caras.push('lingual');

  const match = rs.match(/[([/](.*?)[\])/]/);
  if (match) {
    const inner = match[1];
    if (inner.includes('O')) caras.push('oclusal');
    if (inner.includes('M')) caras.push('mesial');
    if (inner.includes('D')) caras.push('distal');
    if (inner.includes('V')) caras.push('vestibular');
    if (inner.includes('L') || inner.includes('P')) caras.push('lingual');
  }

  // Si no hay específicos pero sí dice '1 cara' o '2 caras' y ninguna identificada, 
  // we could potentially fallback to default logic matching but we return what we found.
  return Array.from(new Set(caras));
};

const getDemoState = (): DienteData[] => {
  const base = getInitialState();
  const d16 = base.find(d => d.numero === '16'); if (d16) { d16.caras.oclusal = 'caries'; d16.caras.mesial = 'caries'; d16.origenes!.oclusal = 'previo'; d16.origenes!.mesial = 'previo'; }
  const d26 = base.find(d => d.numero === '26'); if (d26) { d26.caras.oclusal = 'obturacion'; d26.caras.distal = 'obturacion'; } // previo
  const d11 = base.find(d => d.numero === '11'); if (d11) { Object.keys(d11.caras).forEach(c => { d11.caras[c as CaraNombre] = 'corona'; d11.origenes![c as CaraNombre] = 'previo'; }); }
  const d22 = base.find(d => d.numero === '22'); if (d22) { Object.keys(d22.caras).forEach(c => { d22.caras[c as CaraNombre] = 'implante'; d22.origenes![c as CaraNombre] = 'previo'; }); }
  const d36 = base.find(d => d.numero === '36'); if (d36) { Object.keys(d36.caras).forEach(c => d36.caras[c as CaraNombre] = 'endodoncia'); d36.caras.oclusal = 'obturacion'; }
  const d46 = base.find(d => d.numero === '46'); if (d46) { Object.keys(d46.caras).forEach(c => { d46.caras[c as CaraNombre] = 'ausente'; d46.origenes![c as CaraNombre] = 'previo'; }); }
  
  // Demo Ortodoncia
  const d31 = base.find(d => d.numero === '31'); if (d31) { Object.keys(d31.caras).forEach(c => d31.caras[c as CaraNombre] = 'orto_fijo'); }
  const d32 = base.find(d => d.numero === '32'); if (d32) { Object.keys(d32.caras).forEach(c => d32.caras[c as CaraNombre] = 'orto_fijo'); }
  const d41 = base.find(d => d.numero === '41'); if (d41) { Object.keys(d41.caras).forEach(c => d41.caras[c as CaraNombre] = 'orto_fijo'); }
  const d42 = base.find(d => d.numero === '42'); if (d42) { Object.keys(d42.caras).forEach(c => d42.caras[c as CaraNombre] = 'orto_fijo'); }
  
  // Demo Fractura
  const d12 = base.find(d => d.numero === '12'); if (d12) { Object.keys(d12.caras).forEach(c => d12.caras[c as CaraNombre] = 'fractura'); }
  return base;
};

// ── Tooth Image Component ──
const DienteSilueta: React.FC<{
  data: DienteData;
  isSelected: boolean;
  onClick: () => void;
}> = ({ data, isSelected, onClick }) => {
  const imgSrc = getToothImageSrc(data.numero);
  const occlusalSrc = getOcclusalImageSrc(data.numero);
  const mirrored = shouldMirrorTooth(data.numero);
  const pngFlipped = isToothPNGFlipped(data.numero);
  const quadrant = Math.floor(parseInt(data.numero, 10) / 10);
  const isUpper = quadrant <= 2;

  const position = parseInt(data.numero, 10) % 10;
  const isMolar = position >= 6;

  const hallazgoTypes = Object.values(data.caras).filter(c => c !== 'normal');
  
  const getOrigenForHallazgo = (estadoList: string[]) => {
    const entry = (Object.entries(data.caras) as [CaraNombre, EstadoCara][]).find(([_, e]) => estadoList.includes(e));
    return entry && data.origenes ? data.origenes[entry[0]] : 'previo';
  };

  const isAusente = hallazgoTypes.includes('ausente');
  const colorAusente = getOrigenForHallazgo(['ausente']) === 'presupuesto' ? 'text-pink-500' : 'text-emerald-500';

  const isImplante = hallazgoTypes.includes('implante');
  const colorImplante = getOrigenForHallazgo(['implante']) === 'presupuesto' ? 'text-pink-500' : 'text-emerald-500';

  const isEndo = hallazgoTypes.includes('endodoncia');
  const colorEndoCSS = getOrigenForHallazgo(['endodoncia']) === 'presupuesto' ? 'bg-pink-500' : 'bg-emerald-500';

  const isCorona = hallazgoTypes.includes('corona') || hallazgoTypes.includes('puente') || hallazgoTypes.includes('veneer');
  const colorCoronaCSS = getOrigenForHallazgo(['corona', 'puente', 'veneer']) === 'presupuesto' ? 'bg-pink-500/50' : 'bg-slate-400/80';

  const isOrto = hallazgoTypes.some(c => c === 'orto_fijo' || c === 'orto_removible');
  const isFractura = hallazgoTypes.includes('fractura');
  const colorFractura = getOrigenForHallazgo(['fractura']) === 'presupuesto' ? 'text-pink-500' : 'text-emerald-500';

  // Funciones auxiliares para renderizar caras (occlusal overlay)
  const renderSurfaceOverlays = () => (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full mix-blend-multiply opacity-90 pointer-events-none">
      {(Object.entries(data.caras) as [CaraNombre, EstadoCara][]).map(([cara, estado]) => {
        if (estado === 'normal') return null;
        const hallazgo = getHallazgoById(estado);
        if (!hallazgo || !hallazgo.porSuperficie) return null;
        
        const origen = data.origenes?.[cara] || 'previo';
        const renderColor = origen === 'presupuesto' ? '#ec4899' : '#10b981';

        return (
          <path
            key={cara}
            d={SURFACE_PATHS[cara]}
            fill={renderColor}
            stroke={renderColor}
            strokeWidth="0.5"
          />
        );
      })}
    </svg>
  );

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

      {/* Occlusal - Upper teeth (Above main tooth) */}
      {isUpper && (
        <div className="relative w-10 h-10 mb-0.5">
          <img src={occlusalSrc} alt={`Oclusal ${data.numero}`}
            className={`w-full h-full object-contain ${isAusente ? 'opacity-20 grayscale' : ''}`}
            draggable={false} />
          {renderSurfaceOverlays()}
        </div>
      )}

      {/* Main 3D Tooth */}
      <div className={`relative transition-all duration-200 rounded-md
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 bg-blue-50/50' : ''}
      `}>
        <img
          src={imgSrc}
          alt={`Pieza ${data.numero}`}
          className={`h-36 w-auto object-contain transition-opacity
            ${isAusente ? 'opacity-30 grayscale' : ''}
            ${isImplante ? 'opacity-70' : ''}
          `}
          style={{
            transform: [
              isUpper !== pngFlipped ? '' : 'scaleY(-1)',
              mirrored ? 'scaleX(-1)' : '',
            ].filter(Boolean).join(' ') || undefined,
            minWidth: '40px',
            maxWidth: '90px',
          }}
          draggable={false}
        />
        
        {/* -- Overlays 3D -- */}

        {/* 1. Ausente */}
        {isAusente && !isImplante && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <X className={`w-16 h-16 stroke-[2.5] drop-shadow-md opacity-90 ${colorAusente}`} />
          </div>
        )}

        {/* 2. Implante */}
        {isImplante && (
          <div className={`absolute left-1/2 -translate-x-1/2 pointer-events-none ${isUpper ? 'top-2' : 'bottom-2'}`}>
            <svg width="20" height="34" viewBox="0 0 24 40" className={`drop-shadow-sm opacity-90 ${colorImplante}`}>
              <rect x="8" y="0" width="8" height="4" rx="1" fill="currentColor" />
              <path d="M10 4 L 14 4 L 14 36 L 12 40 L 10 36 Z" fill="currentColor" />
              <rect x="6" y="8" width="12" height="2" fill="currentColor" />
              <rect x="6" y="14" width="12" height="2" fill="currentColor" />
              <rect x="7" y="20" width="10" height="2" fill="currentColor" />
              <rect x="7" y="26" width="10" height="2" fill="currentColor" />
              <rect x="8" y="32" width="8" height="2" fill="currentColor" />
            </svg>
          </div>
        )}

        {/* 3. Endodoncia */}
        {isEndo && (
          <div className={`absolute left-1/2 -translate-x-1/2 pointer-events-none w-4 h-12 flex justify-center gap-1 ${isUpper ? 'top-4' : 'bottom-4'}`}>
            <div className={`w-[3px] h-full ${colorEndoCSS} rounded-full opacity-80`} />
            {isMolar && <div className={`w-[3px] h-[80%] ${colorEndoCSS} rounded-full mt-2 opacity-80`} />}
          </div>
        )}

        {/* 4. Corona */}
        {isCorona && (
          <div className={`absolute left-1/2 -translate-x-1/2 w-[70%] h-[35%] ${colorCoronaCSS} mix-blend-multiply rounded-[40%] blur-[1px] pointer-events-none ${isUpper ? 'bottom-2' : 'top-2'}`} />
        )}

        {/* 5. Ortodoncia */}
        {isOrto && (
          <div className={`absolute left-0 right-0 h-4 flex items-center justify-between px-1 pointer-events-none ${isUpper ? 'bottom-6' : 'top-6'}`}>
            <div className="absolute left-0 right-0 h-[2px] bg-slate-400 shadow-sm" />
            <div className="w-2.5 h-2.5 bg-slate-300 border border-slate-500 rounded-[1px] z-10" />
            <div className="w-2.5 h-2.5 bg-slate-300 border border-slate-500 rounded-[1px] z-10" />
          </div>
        )}

        {/* 6. Fractura */}
        {isFractura && (
          <svg viewBox="0 0 24 24" className={`absolute left-1/2 -translate-x-1/2 w-8 h-8 pointer-events-none drop-shadow-md ${colorFractura} ${isUpper ? 'bottom-4' : 'top-4'}`}>
            <path d="M13 2 L 3 14 L 12 14 L 11 22 L 21 10 L 12 10 Z" fill="currentColor" />
          </svg>
        )}

        {/* Multi-hallazgo indicator (if lots of complex stuff) */}
        {hallazgoTypes.length > 2 && (
          <div className="absolute top-0 right-0 w-3 h-3 bg-blue-600 rounded-full border border-white" />
        )}
      </div>

      {/* Occlusal - Lower teeth (Below main tooth) */}
      {!isUpper && (
        <div className="relative w-10 h-10 mt-0.5">
          <img src={occlusalSrc} alt={`Oclusal ${data.numero}`}
            className={`w-full h-full object-contain ${isAusente ? 'opacity-20 grayscale' : ''}`}
            draggable={false} />
          {renderSurfaceOverlays()}
        </div>
      )}

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
    setCaras(prev => {
      const isAlreadySet = prev[cara] === hallazgoActivo.id;
      return {
        ...prev,
        [cara]: isAlreadySet ? 'normal' : hallazgoActivo.id as EstadoCara,
      };
    });
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

export const buildOdontogramState = async (numPac: string): Promise<DienteData[]> => {
  // 1) Try loading saved odontogram from backend
  const datos = await getOdontograma(numPac);
  let base = (datos && datos.length > 0 ? datos : getInitialState()) as DienteData[];

  // Force explicitly loaded items to be modeled as 'previo'
  base = base.map(d => {
    const origenes = { ...d.origenes } as Record<CaraNombre, 'previo' | 'presupuesto'>;
    (Object.keys(d.caras) as CaraNombre[]).forEach(c => {
      if (d.caras[c] !== 'normal') origenes[c] = 'previo';
    });
    return { ...d, origenes };
  });

  // 1.5) Overlay HISTORIA MEDICA (Entradas Médicas) as 'previo'
  try {
    const idPac = parseInt(numPac, 10);
    if (!isNaN(idPac)) {
      const entradasReq = await getEntradasMedicas(idPac, 1, 200, 'desc');
      if (entradasReq && entradasReq.data) {
        for (const entrada of entradasReq.data) {
          const hallazgo = mapTreatmentToHallazgo(entrada.descripcion);
          if (!hallazgo) continue;
          
          if (entrada.piezas && Array.isArray(entrada.piezas)) {
            for (const p of entrada.piezas) {
              const diente = base.find(d => d.numero === String(p));
              if (!diente) continue;

              const hallazgoDef = getHallazgoById(hallazgo);
              if (!diente.origenes) diente.origenes = {} as Record<CaraNombre, 'previo' | 'presupuesto'>;
              
              if (hallazgoDef && !hallazgoDef.porSuperficie) {
                (Object.keys(diente.caras) as CaraNombre[]).forEach(c => {
                  if (diente.caras[c] === 'normal' || diente.origenes![c] === 'presupuesto') {
                     diente.caras[c] = hallazgo;
                     diente.origenes![c] = 'previo';
                  }
                });
              } else {
                const extractedFaces = extractSurfacesFromText(entrada.descripcion);
                if (extractedFaces.length > 0) {
                   extractedFaces.forEach(f => {
                      if (diente.caras[f] === 'normal' || diente.origenes![f] === 'presupuesto') {
                        diente.caras[f] = hallazgo;
                        diente.origenes![f] = 'previo';
                      }
                   });
                } else {
                   // Fallback if no specific faces defined
                   if (diente.caras.oclusal === 'normal' || diente.origenes!.oclusal === 'presupuesto') { diente.caras.oclusal = hallazgo; diente.origenes!.oclusal = 'previo'; }
                   else if (diente.caras.mesial === 'normal' || diente.origenes!.mesial === 'presupuesto') { diente.caras.mesial = hallazgo; diente.origenes!.mesial = 'previo'; }
                   else if (diente.caras.distal === 'normal' || diente.origenes!.distal === 'presupuesto') { diente.caras.distal = hallazgo; diente.origenes!.distal = 'previo'; }
                }
              }
            }
          }
        }
      }
    }
  } catch (e) { console.error(e); }

  return base;
};

// ── Main Odontograma Component ──
interface OdontogramaProps {
  onSuggestionUpdate?: (suggestion: AISuggestion | null) => void;
  numPac?: string;
  presupuestoLineas?: { descripcion: string; pieza?: string }[];
  readonlyMode?: boolean;
}

const Odontograma: React.FC<OdontogramaProps> = ({ onSuggestionUpdate, numPac, presupuestoLineas, readonlyMode }) => {
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

  // Load patient data — merge backend odontogram + clinic history treatments + live presupuestos
  useEffect(() => {
    if (!numPac) return;
    (async () => {
      const base = await buildOdontogramState(numPac);
      
      if (presupuestoLineas && presupuestoLineas.length > 0) {
        const cloned = JSON.parse(JSON.stringify(base)) as DienteData[];
        for (const l of presupuestoLineas) {
          if (!l.pieza || !l.descripcion) continue;
          const hallazgo = mapTreatmentToHallazgo(l.descripcion);
          if (!hallazgo) continue;
          
          const diente = cloned.find(d => d.numero === String(l.pieza));
          if (!diente) continue;

          const hallazgoDef = getHallazgoById(hallazgo);
          if (!diente.origenes) diente.origenes = {} as Record<CaraNombre, 'previo' | 'presupuesto'>;
          
          if (hallazgoDef && !hallazgoDef.porSuperficie) {
            (Object.keys(diente.caras) as CaraNombre[]).forEach(c => {
               if (diente.caras[c] === 'normal' || diente.origenes![c] === 'presupuesto') {
                  diente.caras[c] = hallazgo;
                  diente.origenes![c] = 'presupuesto';
               }
            });
          } else {
             const extractedFaces = extractSurfacesFromText(l.descripcion);
             if (extractedFaces.length > 0) {
                 extractedFaces.forEach(f => {
                    if (diente.caras[f] === 'normal' || diente.origenes![f] === 'presupuesto') {
                      diente.caras[f] = hallazgo;
                      diente.origenes![f] = 'presupuesto';
                    }
                 });
             } else {
                 if (diente.caras.oclusal === 'normal' || diente.origenes!.oclusal === 'presupuesto') { diente.caras.oclusal = hallazgo; diente.origenes!.oclusal = 'presupuesto'; }
                 else if (diente.caras.mesial === 'normal' || diente.origenes!.mesial === 'presupuesto') { diente.caras.mesial = hallazgo; diente.origenes!.mesial = 'presupuesto'; }
                 else if (diente.caras.distal === 'normal' || diente.origenes!.distal === 'presupuesto') { diente.caras.distal = hallazgo; diente.origenes!.distal = 'presupuesto'; }
             }
          }
        }
        setDientes(cloned);
      } else {
        setDientes(base);
      }
    })();
  }, [numPac, presupuestoLineas]);

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
    if (readonlyMode) return;
    setDienteSeleccionado(numero);
  }, [readonlyMode]);

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
    <div className={readonlyMode ? "" : "space-y-4"}>
      {/* Tab switcher */}
      {!readonlyMode && (
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
      )}

      {activeTab === 'periodontograma' && !readonlyMode && <Periodontograma numPac={numPac} />}

      {activeTab === 'odontograma' && (
        <>
          <div className="flex gap-4">
            {/* Findings Panel */}
            {!readonlyMode && (
              <PanelHallazgos
                categoriaActiva={categoriaActiva}
                setCategoriaActiva={setCategoriaActiva}
                hallazgoActivo={hallazgoActivo}
                setHallazgoActivo={setHallazgoActivo}
                busqueda={busqueda}
                setBusqueda={setBusqueda}
              />
            )}

            {/* Main odontogram area */}
            <div className={`flex-1 bg-white ${readonlyMode ? 'rounded-2xl' : 'rounded-xl border border-slate-200 shadow-sm'} overflow-hidden`}>
              {/* Header */}
              {!readonlyMode && (
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
                        <Save className="w-3.5 h-3.5 animate-spin" /> Guardando...
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Grid 3D */}
              <div className={`p-6 lg:p-8 overflow-x-auto ${readonlyMode ? 'bg-transparent' : 'bg-[#f8fafc] min-h-[600px]'} custom-scrollbar flex items-center justify-center`}>
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
              {!readonlyMode && stats.length > 0 && (
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Resumen de hallazgos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {stats.map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-[11px] font-bold text-slate-600">{s.nombre}</span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {s.count} {s.count === 1 ? 'cara' : 'caras'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar: Stats & Analysis */}
            {!readonlyMode && (
              <div className="w-80 shrink-0 space-y-4">
                {/* Stats Container */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5" /> 
                      Resumen Clínico
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                      {dientes.filter(d => Object.values(d.caras).some(c => c !== 'normal')).length} piezas tocadas
                    </span>
                  </div>
                  <div className="p-2 overflow-y-auto max-h-[320px] custom-scrollbar">
                    {stats.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {stats.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2">
                              {s.porSuperficie ? (
                                <div className="w-3 h-3 rounded-sm opacity-80" style={{ background: s.color }} />
                              ) : (
                                <div className="w-3 h-3 flex items-center justify-center">
                                  {s.id === 'ausente' && <X className="w-3 h-3 text-red-500" strokeWidth={3} />}
                                  {s.id === 'implante' && <svg width="10" height="14" viewBox="0 0 24 40" className="text-violet-500"><path d="M10 4 L 14 4 L 14 36 L 12 40 L 10 36 Z" fill="currentColor"/></svg>}
                                  {s.id === 'endodoncia' && <div className="w-1 h-full bg-orange-500 rounded-full" />}
                                  {s.id === 'perno' && <div className="w-1.5 h-full bg-slate-400" />}
                                  {s.id === 'corona' && <div className="w-full h-full rounded-full border-[3px] border-slate-300" />}
                                </div>
                              )}
                              <span className="text-[12px] font-semibold text-slate-600">{s.nombre}</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-[12px] font-medium text-slate-400">Sin hallazgos registrados</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Analysis Container */}
                <div className="bg-[#051650] rounded-xl p-5 border border-white/10 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                  
                  <div className="flex items-center gap-3 mb-3 relative">
                    <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-blue-300" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-blue-400 uppercase tracking-widest">IA Dental</p>
                      <p className="text-sm font-bold text-white leading-tight">Plan de Tratamiento</p>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4 relative z-10 min-h-[140px] max-h-[300px] overflow-y-auto custom-scrollbar-dark">
                    {aiAnalysis ? (
                      <div className="text-[13px] text-blue-100/90 font-medium leading-relaxed whitespace-pre-line">
                        {aiAnalysis}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                        <Sparkles className="w-6 h-6 text-blue-300 mb-1" />
                        <p className="text-[12px] italic text-blue-100">
                          Analiza el odontograma para obtener diagnósticos y un plan de tratamiento presupuesto sugerido por IA.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (aiAnalysis) {
                        const sug = parseSugerencias(aiAnalysis);
                        if (onSuggestionUpdate) onSuggestionUpdate(sug);
                        setAiAnalysis(null);
                      } else {
                        handleAnalyze();
                      }
                    }}
                    disabled={aiLoading}
                    className={`w-full py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 relative z-10 ${
                      aiAnalysis
                        ? 'bg-[#118DF0] text-white hover:bg-blue-500 shadow-md shadow-blue-500/20'
                        : 'bg-white text-[#051650] hover:bg-blue-50'
                    }`}
                  >
                    {aiLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
                    ) : aiAnalysis ? (
                      <><Check className="w-4 h-4" /> Aplicar Sugerencias a SOAP</>
                    ) : (
                      'Generar Diagnóstico IA'
                    )}
                  </button>
                </div>
              </div>
            )}
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
