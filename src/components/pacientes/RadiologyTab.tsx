/**
 * RadiologyTab.tsx — Visor de radiología clínico completo
 *
 * Herramientas:
 *  - Pan / Zoom (rueda)
 *  - W/L (clic derecho arrastrar o botón WL)
 *  - Regla, Ángulo, ROI Rect, ROI Elipse, Flecha, Texto
 *  - Implante dental: panel configurador + clic para colocar
 *  - Canal nervioso (Nervio dentario inferior): polyline multi-clic
 *  - Mapas de pseudo-color (bone, hot, dental_soft…)
 *  - Invertir, FlipH, FlipV, Rotar 90°
 *  - Brillo / Contraste en tiempo real
 *  - Mejora IA (CLAHE + unsharp mask)
 *  - Visor DICOM real (Cornerstone3D) para archivos .dcm
 *  - Visor CBCT 3D (axial, coronal, sagital, panorámica, MIP, cefalometría)
 *  - Planmeca Romexis Viewer para estudios DICOM con ruta de red
 */

import React, { useState, useCallback, useRef, Suspense, useEffect } from 'react';
const DicomViewer = React.lazy(() => import('../radiologia/DicomViewer'));
const CbctViewer = React.lazy(() => import('../radiologia/CbctViewer'));
import RadiologiaViewer, { type MeasureTool, type Measurement, type ImplantConfig, type CalibrationData } from '../radiologia/RadiologiaViewer';
import PlanmecaLauncher from '../radiologia/PlanmecaLauncher';

import {
    Upload, Download, RotateCcw, FlipHorizontal, FlipVertical,
    RefreshCw, Trash2, Info, Image, Zap, Ruler, Minus,
    Triangle, Square, Circle, ArrowUpRight, Type, Hand,
    SlidersHorizontal, Palette, ChevronDown, Activity,
    Layers, Plus, X, Settings, Check, Crosshair,
} from 'lucide-react';
import {
    addEstudio, deleteEstudio, processEstudio, loadEstudiosFromBackend, saveMeasurements,
    type EstudioRadiologico, type ImageType, type ColorMap,
    COLOR_MAPS, IMAGE_TYPES,
} from '../../services/imagen.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatBytes = (n?: number) => {
    if (!n) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(2)} MB`;
};

const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return iso; }
};

const TIPO_ICON: Record<ImageType, string> = {
    panoramica: '🦷', dicom: '🔬', intraoral: '📷', extraoral: '📸',
    cefalometrica: '📐', periapical: '🔍',
};

const TIPO_LABEL: Record<ImageType, string> = {
    panoramica: 'Ortopantomografía', dicom: 'CBCT / DICOM', intraoral: 'Intraoral',
    extraoral: 'Extraoral', cefalometrica: 'Cefalometría', periapical: 'Periapical',
};

const TIPO_COLOR: Record<ImageType, string> = {
    panoramica: '#8b5cf6', dicom: '#3b82f6', intraoral: '#f59e0b',
    extraoral: '#64748b', cefalometrica: '#06b6d4', periapical: '#00B4AB',
};

// ── Toolbar button ─────────────────────────────────────────────────────────────

const TB: React.FC<{ title: string; active?: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean; accent?: string }> =
    ({ title, active, onClick, children, danger, accent }) => (
        <button
            title={title}
            onClick={onClick}
            style={{
                width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer',
                background: active
                    ? (danger ? '#7f1d1d' : accent ? accent + '33' : '#1e40af')
                    : 'transparent',
                color: active
                    ? (danger ? '#fca5a5' : accent ?? '#93c5fd')
                    : '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                outline: active && accent ? `1px solid ${accent}55` : 'none',
            }}
        >
            {children}
        </button>
    );

const DIV = () => (
    <div style={{ width: 1, height: 20, background: '#1e2535', margin: '0 2px', flexShrink: 0 }} />
);

const SZ = { width: 13, height: 13 };

// ── Implant icon (custom SVG) ──────────────────────────────────────────────────

const ImplantIcon = () => (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
        <rect x="4" y="0" width="5" height="1.5" rx="0.5" />
        <rect x="4.5" y="1.5" width="4" height="8" rx="2" opacity="0.9" />
        <path d="M 4.5 9.5 L 6.5 12 L 8.5 9.5 Z" />
    </svg>
);

// ── Tool definitions ───────────────────────────────────────────────────────────

type AnyTool = MeasureTool | 'cbct' | 'romexis';

const TOOLS: { id: MeasureTool; label: string; icon: React.ReactNode; accent?: string }[] = [
    { id: 'select', label: 'Seleccionar', icon: <Minus style={SZ} /> },
    { id: 'pan', label: 'Mover imagen', icon: <Hand style={SZ} /> },
    { id: 'wl', label: 'Window / Level', icon: <SlidersHorizontal style={SZ} /> },
    { id: 'calibrate', label: 'Calibrar escala (mm reales)', icon: <Crosshair style={SZ} />, accent: '#22d3ee' },
    { id: 'ruler', label: 'Regla', icon: <Ruler style={SZ} /> },
    { id: 'angle', label: 'Ángulo', icon: <Triangle style={SZ} /> },
    { id: 'roiRect', label: 'ROI Rectángulo', icon: <Square style={SZ} /> },
    { id: 'roiEllipse', label: 'ROI Elipse', icon: <Circle style={SZ} /> },
    { id: 'arrow', label: 'Flecha', icon: <ArrowUpRight style={SZ} /> },
    { id: 'text', label: 'Texto', icon: <Type style={SZ} /> },
    { id: 'nerve', label: 'Nervio dentario inferior', icon: <Activity style={SZ} />, accent: '#FFA500' },
    { id: 'implant', label: 'Colocar implante', icon: <ImplantIcon />, accent: '#00B4AB' },
];

// ── Implant sizes ──────────────────────────────────────────────────────────────

const IMPLANT_DIAMETERS = [3.0, 3.3, 3.5, 4.0, 4.5, 5.0];
const IMPLANT_LENGTHS = [6, 8, 10, 11.5, 13, 16];
const IMPLANT_BRANDS = [
    'Generic', 'Nobel Biocare', 'Straumann', 'Zimmer Biomet',
    'Dentsply Sirona', 'BioHorizons', 'Osstem', 'Neoss',
];

// ── Study registration modal ───────────────────────────────────────────────────

interface StudyForm {
    tipo: ImageType;
    doctor: string;
    fecha: string;
    descripcion: string;
    posicion?: string;
}

const STUDY_TYPE_OPTIONS: { value: ImageType; label: string; icon: string; desc: string }[] = [
    { value: 'panoramica', label: 'Ortopantomografía', icon: '🦷', desc: 'Radiografía panorámica completa' },
    { value: 'periapical', label: 'Periapical', icon: '🔍', desc: 'Radiografía dental periapical' },
    { value: 'dicom', label: 'CBCT / DICOM', icon: '🔬', desc: 'Tomografía cone beam 3D' },
    { value: 'cefalometrica', label: 'Cefalometría', icon: '📐', desc: 'Teleradiografía lateral de cráneo' },
    { value: 'intraoral', label: 'Intraoral', icon: '📷', desc: 'Fotografía intraoral' },
    { value: 'extraoral', label: 'Extraoral', icon: '📸', desc: 'Fotografía extraoral / perfil' },
];

const TOOTH_POSITIONS = [
    '', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8',
    '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8',
    '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8',
    '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8',
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props { numPac?: string; patientName?: string; }

// ── Component ──────────────────────────────────────────────────────────────────

const RadiologyTab: React.FC<Props> = ({ numPac, patientName }) => {
    const DEMO: EstudioRadiologico = {
        id: 'demo-panoramica', nombre: 'Panorámica Demo.png', tipo: 'panoramica',
        fecha: new Date().toISOString(), originalUrl: '/rx-demo-panoramica.png',
        pacienteNumPac: numPac ?? 'demo', doctor: 'Demo',
        descripcion: 'Imagen de demostración — arrastra aquí tus archivos .dcm o imágenes',
        isProcessing: false, colorMap: 'grayscale',
        brightness: 0, contrast: 0, sharpness: 0, anotaciones: [], tags: [],
    };

    const [estudios, setEstudios] = useState<EstudioRadiologico[]>([DEMO]);
    const [selectedId, setSelectedId] = useState<string | null>('demo-panoramica');
    const [dicomFile, setDicomFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Image controls
    const [invertImg, setInvertImg] = useState(false);
    const [flipH, setFlipH] = useState(false);
    const [flipV, setFlipV] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [brightness, setBrightness] = useState(0);
    const [contrast, setContrast] = useState(0);
    const [colorMap, setColorMap] = useState<ColorMap>('grayscale');
    const [showColorMenu, setShowColorMenu] = useState(false);
    const [showAdjPanel, setShowAdjPanel] = useState(false);

    // Measurements
    const [tool, setTool] = useState<MeasureTool>('select');
    const [measurements, setMeasurements] = useState<Record<string, Measurement[]>>({});

    // Enhancement
    const [enhancing, setEnhancing] = useState(false);

    // View mode: 'viewer' | 'cbct' | 'romexis'
    const [viewMode, setViewMode] = useState<'viewer' | 'cbct' | 'romexis'>('viewer');

    // Calibration per study (studyId → CalibrationData)
    const [calibrations, setCalibrations] = useState<Record<string, CalibrationData>>({});
    const currentCalibration = selectedId ? (calibrations[selectedId] ?? null) : null;
    const handleCalibrate = (data: CalibrationData) => {
        if (!selectedId) return;
        setCalibrations(prev => ({ ...prev, [selectedId]: data }));
    };

    // Implant planning
    const [implantConfig, setImplantConfig] = useState<ImplantConfig>({ diameter: 4.0, length: 10, brand: 'Generic' });
    const [showImplantPanel, setShowImplantPanel] = useState(false);

    // Study registration modal
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [studyForm, setStudyForm] = useState<StudyForm>({
        tipo: 'panoramica', doctor: 'Dra. Rubio',
        fecha: new Date().toISOString().slice(0, 10),
        descripcion: '', posicion: '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileMapRef = useRef<Map<string, File>>(new Map());

    // ── Load studies from backend when patient changes ────────────────────────
    useEffect(() => {
        if (!numPac) return;
        loadEstudiosFromBackend(numPac).then(loaded => {
            if (loaded.length > 0) {
                setEstudios(prev => {
                    const localBlobs = prev.filter(e => e.originalUrl.startsWith('blob:') || e.id === 'demo-panoramica');
                    const serverIds = new Set(loaded.map(s => s.id));
                    return [...localBlobs.filter(e => !serverIds.has(e.id)), ...loaded];
                });
                const firstReal = loaded[0];
                if (firstReal) setSelectedId(firstReal.id);
            }
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numPac]);

    // ── Auto-save measurements to backend on change ───────────────────────────
    useEffect(() => {
        if (!selectedId) return;
        const ms = measurements[selectedId];
        if (!ms || ms.length === 0) return;
        const timeout = setTimeout(() => {
            saveMeasurements(selectedId, ms).catch(() => {});
        }, 1500);
        return () => clearTimeout(timeout);
    }, [measurements, selectedId]);

    const selected = estudios.find(e => e.id === selectedId) ?? null;
    const displayUrl = selected
        ? (selected.colorizedUrl ?? selected.enhancedUrl ?? selected.originalUrl)
        : null;
    const isDicom = selected?.tipo === 'dicom';
    const currentMeasurements = selectedId ? (measurements[selectedId] ?? []) : [];

    const setCurrentMeasurements = (ms: Measurement[]) => {
        if (!selectedId) return;
        setMeasurements(prev => ({ ...prev, [selectedId]: ms }));
    };

    // When switching to implant tool, show panel
    const handleSetTool = (t: MeasureTool) => {
        setTool(t);
        if (t === 'implant') setShowImplantPanel(true);
        else setShowImplantPanel(false);
    };

    // ── File handling ─────────────────────────────────────────────────────────
    const handleFiles = useCallback(async (files: FileList | null, fromModal = false) => {
        if (!files || files.length === 0 || !numPac) return;
        const arr = Array.from(files);
        if (!fromModal) {
            // Detect type and open registration modal
            const defaultTipo: ImageType = arr.some(f => ['dcm', 'dic', 'dicom'].includes(f.name.split('.').pop()?.toLowerCase() ?? ''))
                ? 'dicom' : 'panoramica';
            setPendingFiles(arr);
            setStudyForm(prev => ({
                ...prev,
                tipo: defaultTipo,
                fecha: new Date().toISOString().slice(0, 10),
                descripcion: arr[0]?.name ?? '',
            }));
            setShowRegisterModal(true);
            return;
        }
        // Actually add studies
        for (const file of arr) {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
            const isDcm = ['dcm', 'dic', 'dicom'].includes(ext);
            try {
                const nuevo = await addEstudio(file, {
                    pacienteNumPac: numPac,
                    tipo: studyForm.tipo,
                    doctor: studyForm.doctor,
                    descripcion: studyForm.descripcion || file.name,
                });
                fileMapRef.current.set(nuevo.id, file);
                setEstudios(prev => [nuevo, ...prev.filter(e => e.id !== 'demo-panoramica')]);
                setSelectedId(nuevo.id);
                if (isDcm) {
                    setDicomFile(file);
                    setViewMode(studyForm.tipo === 'dicom' ? 'cbct' : 'romexis');
                } else {
                    setDicomFile(null);
                    setViewMode('viewer');
                }
                resetViewControls();
            } catch (err) { console.error('[RadiologyTab]', err); }
        }
    }, [numPac, studyForm]);

    const handleRegisterConfirm = async () => {
        setShowRegisterModal(false);
        if (pendingFiles.length > 0) {
            await handleFiles(toFileList(pendingFiles), true);
            setPendingFiles([]);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const toFileList = (files: File[]): FileList => {
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        return dt.files;
    };

    const resetViewControls = () => {
        setInvertImg(false); setFlipH(false); setFlipV(false); setRotation(0);
        setBrightness(0); setContrast(0); setColorMap('grayscale');
    };

    const handleSelectStudy = (est: EstudioRadiologico) => {
        setSelectedId(est.id);
        const file = fileMapRef.current.get(est.id) ?? null;
        setDicomFile(est.tipo === 'dicom' ? file : null);
        setBrightness(est.brightness ?? 0);
        setContrast(est.contrast ?? 0);
        setColorMap(est.colorMap ?? 'grayscale');
        setInvertImg(false); setFlipH(false); setFlipV(false); setRotation(0);
        setTool('select');
        setShowImplantPanel(false);
        // Auto-select view mode
        if (est.tipo === 'dicom' && file) {
            setViewMode('cbct');
        } else if (est.tipo === 'dicom' && est.rutaOrigen) {
            setViewMode('romexis');
        } else {
            setViewMode('viewer');
        }
    };

    const handleDelete = (id: string) => {
        deleteEstudio(id);
        setEstudios(prev => {
            const next = prev.filter(e => e.id !== id);
            return next.length === 0 ? [DEMO] : next;
        });
        setMeasurements(prev => { const n = { ...prev }; delete n[id]; return n; });
        if (selectedId === id) {
            setSelectedId(null); setDicomFile(null); setViewMode('viewer');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files);
    };

    const handleDownload = () => {
        if (!displayUrl || !selected) return;
        const a = document.createElement('a');
        a.href = displayUrl; a.download = selected.nombre; a.click();
    };

    const handleEnhance = async () => {
        if (!selected || isDicom) return;
        setEnhancing(true);
        try {
            const updated = await processEstudio(selected.id, {
                enhance: true, brightness, contrast, sharpness: 50, colorMap,
            });
            setEstudios(prev => prev.map(e => e.id === updated.id ? updated : e));
        } catch (err) { console.error('[RadiologyTab] enhance', err); }
        finally { setEnhancing(false); }
    };

    const clearMeasurements = () => setCurrentMeasurements([]);

    // Count implants and nerves placed for this study
    const implantCount = currentMeasurements.filter(m => m.tool === 'implant').length;
    const nerveCount = currentMeasurements.filter(m => m.tool === 'nerve').length;

    // ── No patient ────────────────────────────────────────────────────────────
    if (!numPac) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: '#64748b', fontSize: 13 }}>
            Selecciona un paciente para ver sus estudios radiológicos.
        </div>
    );

    const colorMapLabel = COLOR_MAPS.find(c => c.value === colorMap)?.label ?? 'Escala de grises';

    return (
        <div
            style={{ display: 'flex', height: 'calc(100vh - 200px)', minHeight: 540, background: '#080a10', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a2030', position: 'relative' }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragging && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: '#0d47a188', border: '2px dashed #2979ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <p style={{ color: '#90caf9', fontSize: 16, fontWeight: 700 }}>Suelta el archivo DICOM o imagen aquí</p>
                </div>
            )}

            {/* ── LEFT — Study registry ──────────────────────────────────────── */}
            <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1a2030', background: '#0c0e16' }}>

                {/* Header */}
                <div style={{ padding: '9px 10px 7px', borderBottom: '1px solid #1a2030', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>
                        Estudios <span style={{ color: '#334155' }}>({estudios.filter(e => e.id !== 'demo-panoramica').length})</span>
                    </span>
                    <button onClick={() => fileInputRef.current?.click()}
                        style={{ background: '#1e3a8a', border: 'none', borderRadius: 5, padding: '3px 8px', color: '#93c5fd', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Plus style={{ width: 10, height: 10 }} /> Nuevo
                    </button>
                </div>

                {/* Filter chips by type */}
                <div style={{ padding: '6px 8px', borderBottom: '1px solid #0f1520', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {['panoramica', 'periapical', 'dicom'].map(t => {
                        const count = estudios.filter(e => e.tipo === t && e.id !== 'demo-panoramica').length;
                        if (count === 0) return null;
                        return (
                            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', background: TIPO_COLOR[t as ImageType] + '22', border: `1px solid ${TIPO_COLOR[t as ImageType]}44`, borderRadius: 10 }}>
                                <span style={{ fontSize: 9 }}>{TIPO_ICON[t as ImageType]}</span>
                                <span style={{ color: TIPO_COLOR[t as ImageType], fontSize: 9, fontWeight: 700 }}>{count}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Study list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '3px 0' }}>
                    {estudios.filter(e => e.id !== 'demo-panoramica').length === 0 ? (
                        <div style={{ padding: '28px 14px', textAlign: 'center' }}>
                            <Image style={{ width: 24, height: 24, margin: '0 auto 8px', opacity: 0.2, color: '#475569' }} />
                            <p style={{ fontSize: 11, color: '#334155', margin: '0 0 4px' }}>Sin estudios registrados</p>
                            <p style={{ fontSize: 10, color: '#1e2535', margin: 0 }}>Arrastra .dcm o imágenes,<br />o usa el botón Nuevo</p>
                        </div>
                    ) : estudios.map(est => {
                        if (est.id === 'demo-panoramica') return null;
                        const isSelected = selectedId === est.id;
                        const typColor = TIPO_COLOR[est.tipo] ?? '#64748b';
                        return (
                            <div key={est.id} onClick={() => handleSelectStudy(est)}
                                style={{ padding: '7px 10px', cursor: 'pointer', borderLeft: isSelected ? `2px solid ${typColor}` : '2px solid transparent', background: isSelected ? typColor + '11' : 'transparent', transition: 'background 0.12s' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                    {/* Type badge */}
                                    <div style={{ width: 26, height: 26, borderRadius: 6, background: typColor + '22', border: `1px solid ${typColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>
                                        {TIPO_ICON[est.tipo]}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: isSelected ? '#e2e8f0' : '#94a3b8', fontSize: 11, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {TIPO_LABEL[est.tipo]}
                                        </p>
                                        <p style={{ color: '#475569', fontSize: 9, margin: '1px 0 0' }}>
                                            {formatDate(est.fecha)}
                                        </p>
                                        {est.doctor && (
                                            <p style={{ color: '#334155', fontSize: 9, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {est.doctor}
                                            </p>
                                        )}
                                    </div>
                                    <button onClick={ev => { ev.stopPropagation(); handleDelete(est.id); }}
                                        style={{ background: 'none', border: 'none', color: '#1e2535', cursor: 'pointer', padding: 1, marginTop: 1, flexShrink: 0 }}>
                                        <Trash2 style={{ width: 10, height: 10 }} />
                                    </button>
                                </div>
                                {est.descripcion && est.descripcion !== est.nombre && (
                                    <p style={{ color: '#1e3a5f', fontSize: 9, margin: '3px 0 0 32px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {est.descripcion}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Planning summary for selected study */}
                {selected && (implantCount > 0 || nerveCount > 0) && (
                    <div style={{ padding: '8px 10px', borderTop: '1px solid #1a2030', display: 'flex', gap: 8 }}>
                        {implantCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: '#00B4AB22', border: '1px solid #00B4AB44', borderRadius: 10 }}>
                                <ImplantIcon />
                                <span style={{ color: '#00B4AB', fontSize: 9, fontWeight: 700 }}>{implantCount} implante{implantCount > 1 ? 's' : ''}</span>
                            </div>
                        )}
                        {nerveCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: '#FFA50022', border: '1px solid #FFA50044', borderRadius: 10 }}>
                                <Activity style={{ width: 9, height: 9, color: '#FFA500' }} />
                                <span style={{ color: '#FFA500', fontSize: 9, fontWeight: 700 }}>Nervio trazado</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Thumbnail of selected */}
                {selected && displayUrl && selected.tipo !== 'dicom' && (
                    <div style={{ padding: 8, borderTop: '1px solid #1a2030' }}>
                        <img src={displayUrl} alt="preview"
                            style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 6, filter: 'brightness(0.85) contrast(1.1)', display: 'block' }} />
                    </div>
                )}

                <input ref={fileInputRef} type="file"
                    accept=".dcm,.dic,.dicom,.jpg,.jpeg,.png,.bmp,.webp"
                    multiple style={{ display: 'none' }}
                    onChange={e => handleFiles(e.target.files)} />
            </div>

            {/* ── CENTER ─────────────────────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* View mode switcher + toolbar */}
                <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, padding: '0 6px', background: '#0c0e16', borderBottom: '1px solid #1a2030', overflowX: 'auto' }}>

                    {/* View mode buttons (only shown when DICOM selected) */}
                    {selected?.tipo === 'dicom' && (
                        <>
                            <button
                                title="Visor 2D"
                                onClick={() => setViewMode('viewer')}
                                style={{ height: 28, padding: '0 8px', border: 'none', borderRadius: 5, cursor: 'pointer', background: viewMode === 'viewer' ? '#1e3a8a' : 'transparent', color: viewMode === 'viewer' ? '#93c5fd' : '#475569', fontSize: 10, whiteSpace: 'nowrap' }}>
                                2D
                            </button>
                            <button
                                title="Visor CBCT 3D — axial, coronal, sagital, panorámica, MIP"
                                onClick={() => setViewMode('cbct')}
                                style={{ height: 28, padding: '0 8px', border: 'none', borderRadius: 5, cursor: 'pointer', background: viewMode === 'cbct' ? '#0f2040' : 'transparent', color: viewMode === 'cbct' ? '#38bdf8' : '#475569', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', outline: viewMode === 'cbct' ? '1px solid #38bdf833' : 'none' }}>
                                <Layers style={{ width: 11, height: 11 }} /> CBCT 3D
                            </button>
                            <button
                                title="Abrir en Planmeca Romexis Viewer"
                                onClick={() => setViewMode('romexis')}
                                style={{ height: 28, padding: '0 8px', border: 'none', borderRadius: 5, cursor: 'pointer', background: viewMode === 'romexis' ? '#0f2040' : 'transparent', color: viewMode === 'romexis' ? '#60a5fa' : '#475569', fontSize: 10, whiteSpace: 'nowrap' }}>
                                Romexis
                            </button>
                            <DIV />
                        </>
                    )}

                    {/* Tool group — only in viewer mode */}
                    {viewMode === 'viewer' && TOOLS.map(t => (
                        <TB key={t.id} title={t.label} active={tool === t.id}
                            accent={t.accent}
                            onClick={() => handleSetTool(t.id as MeasureTool)}>
                            {t.icon}
                        </TB>
                    ))}

                    {viewMode === 'viewer' && <DIV />}

                    {/* Image transforms — viewer only */}
                    {viewMode === 'viewer' && (
                        <>
                            <TB title="Invertir" active={invertImg} onClick={() => setInvertImg(v => !v)}>
                                <span style={{ fontSize: 13, lineHeight: 1 }}>⊘</span>
                            </TB>
                            <TB title="Voltear horizontal" active={flipH} onClick={() => setFlipH(v => !v)}>
                                <FlipHorizontal style={SZ} />
                            </TB>
                            <TB title="Voltear vertical" active={flipV} onClick={() => setFlipV(v => !v)}>
                                <FlipVertical style={SZ} />
                            </TB>
                            <TB title="Rotar 90° a la derecha" onClick={() => setRotation(r => (r + 90) % 360)}>
                                <RefreshCw style={SZ} />
                            </TB>
                            <DIV />
                        </>
                    )}

                    {/* Color map — viewer only */}
                    {viewMode === 'viewer' && (
                        <>
                            <div style={{ position: 'relative' }}>
                                <button
                                    title="Mapa de color"
                                    onClick={() => { setShowColorMenu(v => !v); setShowAdjPanel(false); }}
                                    style={{ height: 28, padding: '0 7px', border: 'none', borderRadius: 5, cursor: 'pointer', background: showColorMenu ? '#1e40af' : 'transparent', color: showColorMenu ? '#93c5fd' : '#475569', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, whiteSpace: 'nowrap' }}>
                                    <Palette style={SZ} />
                                    <span>{colorMapLabel}</span>
                                    <ChevronDown style={{ width: 10, height: 10 }} />
                                </button>
                                {showColorMenu && (
                                    <div style={{ position: 'absolute', top: 30, left: 0, zIndex: 200, background: '#0d1018', border: '1px solid #1e2535', borderRadius: 8, padding: 6, minWidth: 200, boxShadow: '0 8px 24px #00000088' }}>
                                        {COLOR_MAPS.map(cm => (
                                            <button key={cm.value}
                                                onClick={() => { setColorMap(cm.value); setShowColorMenu(false); }}
                                                style={{ width: '100%', padding: '5px 8px', background: colorMap === cm.value ? '#1e3a8a' : 'transparent', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                                                <div style={{ display: 'flex', gap: 2 }}>
                                                    {cm.preview.map((c, i) => (
                                                        <div key={i} style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
                                                    ))}
                                                </div>
                                                <div>
                                                    <p style={{ color: colorMap === cm.value ? '#93c5fd' : '#94a3b8', fontSize: 11, fontWeight: 600, margin: 0 }}>{cm.label}</p>
                                                    <p style={{ color: '#475569', fontSize: 9, margin: 0 }}>{cm.description}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <DIV />

                            {/* Adjustments toggle */}
                            <button
                                title="Brillo / Contraste"
                                onClick={() => { setShowAdjPanel(v => !v); setShowColorMenu(false); }}
                                style={{ height: 28, padding: '0 7px', border: 'none', borderRadius: 5, cursor: 'pointer', background: showAdjPanel ? '#1e40af' : 'transparent', color: showAdjPanel ? '#93c5fd' : '#475569', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                                <SlidersHorizontal style={SZ} />
                                <span>Ajustes</span>
                            </button>

                            <DIV />

                            {/* IA Enhance */}
                            {!isDicom && (
                                <button title="Mejora IA (CLAHE + nitidez)" onClick={handleEnhance} disabled={enhancing || !selected}
                                    style={{ height: 28, padding: '0 8px', border: 'none', borderRadius: 5, cursor: 'pointer', background: '#0f2040', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, opacity: !selected ? 0.4 : 1 }}>
                                    {enhancing ? <RefreshCw style={{ ...SZ, animation: 'spin 1s linear infinite' }} /> : <Zap style={SZ} />}
                                    <span>IA</span>
                                </button>
                            )}
                        </>
                    )}

                    {/* Measurements clear — viewer only */}
                    {viewMode === 'viewer' && currentMeasurements.length > 0 && (
                        <>
                            <DIV />
                            <button title="Borrar mediciones" onClick={clearMeasurements}
                                style={{ height: 28, padding: '0 7px', border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                                <Trash2 style={SZ} />
                                <span style={{ color: '#ef4444' }}>{currentMeasurements.length}</span>
                            </button>
                        </>
                    )}

                    {/* Reset + Download */}
                    {viewMode === 'viewer' && (
                        <>
                            <TB title="Reiniciar vista" onClick={() => { resetViewControls(); clearMeasurements(); }}>
                                <RotateCcw style={SZ} />
                            </TB>
                            <TB title="Descargar" onClick={handleDownload}>
                                <Download style={SZ} />
                            </TB>
                        </>
                    )}

                    {/* File name */}
                    {selected && (
                        <span style={{ marginLeft: 'auto', color: '#334155', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220, paddingRight: 6 }}>
                            {selected.nombre}
                        </span>
                    )}
                </div>

                {/* Adjustment panel */}
                {viewMode === 'viewer' && showAdjPanel && (
                    <div style={{ flexShrink: 0, background: '#0c0e16', borderBottom: '1px solid #1a2030', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        {[
                            { label: 'Brillo', value: brightness, set: setBrightness },
                            { label: 'Contraste', value: contrast, set: setContrast },
                        ].map(({ label, value, set }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: '#475569', fontSize: 10, width: 54, flexShrink: 0 }}>{label}</span>
                                <input type="range" min={-100} max={100} value={value}
                                    onChange={e => set(Number(e.target.value))}
                                    style={{ width: 120, accentColor: '#3b82f6', cursor: 'pointer' }} />
                                <span style={{ color: '#94a3b8', fontSize: 10, width: 30, textAlign: 'right' }}>
                                    {value > 0 ? `+${value}` : value}
                                </span>
                                <button onClick={() => set(0)}
                                    style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 10, padding: '1px 4px' }}>✕</button>
                            </div>
                        ))}
                        {rotation !== 0 && (
                            <span style={{ color: '#475569', fontSize: 10, marginLeft: 8 }}>↻ {rotation}°</span>
                        )}
                    </div>
                )}

                {/* ── Viewer area ──────────────────────────────────────────── */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}
                    onClick={() => { setShowColorMenu(false); setShowAdjPanel(false); }}>

                    {/* ── CBCT 3D viewer ───────────────────────────────────── */}
                    {viewMode === 'cbct' && dicomFile && (
                        <Suspense fallback={
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12, gap: 8 }}>
                                <RefreshCw style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                                Cargando visor CBCT 3D…
                            </div>
                        }>
                            <CbctViewer
                                file={dicomFile}
                                patientName={patientName}
                                onClose={() => setViewMode('viewer')}
                            />
                        </Suspense>
                    )}

                    {viewMode === 'cbct' && !dicomFile && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                            <Layers style={{ width: 32, height: 32, color: '#1e3a8a' }} />
                            <p style={{ color: '#334155', fontSize: 13, fontWeight: 600 }}>Visor CBCT 3D</p>
                            <p style={{ color: '#1e2535', fontSize: 12, textAlign: 'center', maxWidth: 300 }}>
                                Importa un archivo DICOM (.dcm) de CBCT para ver los cortes axial, coronal, sagital y la panorámica reconstruida.
                            </p>
                            <button onClick={() => fileInputRef.current?.click()}
                                style={{ padding: '8px 20px', background: '#1e3a8a', border: 'none', borderRadius: 8, color: '#93c5fd', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Upload style={{ width: 13, height: 13 }} /> Importar CBCT .dcm
                            </button>
                        </div>
                    )}

                    {/* ── Romexis launcher ─────────────────────────────────── */}
                    {viewMode === 'romexis' && selected && (
                        <PlanmecaLauncher
                            estudio={selected}
                            file={dicomFile}
                            patientName={patientName}
                        />
                    )}

                    {/* ── 2D viewer ────────────────────────────────────────── */}
                    {viewMode === 'viewer' && (
                        !selected ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1e2535', gap: 10 }}>
                                <img src="/rx-demo-panoramica.png" alt="Demo"
                                    style={{ maxWidth: '85%', maxHeight: '75%', objectFit: 'contain', filter: 'contrast(1.1) brightness(0.7)', opacity: 0.5 }} />
                                <p style={{ fontSize: 12, color: '#334155' }}>Selecciona un estudio o arrastra un archivo aquí</p>
                            </div>
                        ) : isDicom && dicomFile ? (
                            <Suspense fallback={
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12, gap: 8 }}>
                                    <RefreshCw style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                                    Cargando visor DICOM…
                                </div>
                            }>
                                <DicomViewer file={dicomFile} />
                            </Suspense>
                        ) : (
                            <RadiologiaViewer
                                url={displayUrl}
                                tool={tool}
                                measurements={currentMeasurements}
                                onMeasurementsChange={setCurrentMeasurements}
                                brightness={brightness}
                                contrast={contrast}
                                colorMap={colorMap}
                                invert={invertImg}
                                flipH={flipH}
                                flipV={flipV}
                                rotation={rotation}
                                implantConfig={implantConfig}
                                calibration={currentCalibration}
                                onCalibrate={handleCalibrate}
                            />
                        )
                    )}
                </div>
            </div>

            {/* ── RIGHT — Metadata + implant panel + measurements ──────── */}
            {selected && viewMode === 'viewer' && (
                <div style={{ width: showImplantPanel ? 210 : 188, flexShrink: 0, borderLeft: '1px solid #1a2030', background: '#0c0e16', display: 'flex', flexDirection: 'column', overflowY: 'auto', transition: 'width 0.2s' }}>

                    {/* ── IMPLANT PLANNING PANEL ───────────────────────────── */}
                    {tool === 'implant' && showImplantPanel && (
                        <div style={{ padding: '10px', borderBottom: '1px solid #1a2030' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                <div style={{ width: 20, height: 20, background: '#00B4AB22', border: '1px solid #00B4AB44', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ImplantIcon />
                                </div>
                                <p style={{ color: '#00B4AB', fontSize: 10, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
                                    Planificación
                                </p>
                                <button onClick={() => { setShowImplantPanel(false); handleSetTool('select'); }}
                                    style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: 2 }}>
                                    <X style={{ width: 10, height: 10 }} />
                                </button>
                            </div>

                            {/* Diameter */}
                            <div style={{ marginBottom: 8 }}>
                                <p style={{ color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>Diámetro</p>
                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {IMPLANT_DIAMETERS.map(d => (
                                        <button key={d} onClick={() => setImplantConfig(c => ({ ...c, diameter: d }))}
                                            style={{ padding: '3px 6px', fontSize: 10, border: '1px solid', borderRadius: 4, cursor: 'pointer', background: implantConfig.diameter === d ? '#00B4AB33' : 'transparent', borderColor: implantConfig.diameter === d ? '#00B4AB' : '#1e2535', color: implantConfig.diameter === d ? '#00B4AB' : '#475569', fontWeight: implantConfig.diameter === d ? 700 : 400 }}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                                <p style={{ color: '#334155', fontSize: 9, margin: '3px 0 0' }}>{implantConfig.diameter} mm</p>
                            </div>

                            {/* Length */}
                            <div style={{ marginBottom: 8 }}>
                                <p style={{ color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>Longitud</p>
                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    {IMPLANT_LENGTHS.map(l => (
                                        <button key={l} onClick={() => setImplantConfig(c => ({ ...c, length: l }))}
                                            style={{ padding: '3px 6px', fontSize: 10, border: '1px solid', borderRadius: 4, cursor: 'pointer', background: implantConfig.length === l ? '#00B4AB33' : 'transparent', borderColor: implantConfig.length === l ? '#00B4AB' : '#1e2535', color: implantConfig.length === l ? '#00B4AB' : '#475569', fontWeight: implantConfig.length === l ? 700 : 400 }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                                <p style={{ color: '#334155', fontSize: 9, margin: '3px 0 0' }}>{implantConfig.length} mm</p>
                            </div>

                            {/* Brand */}
                            <div style={{ marginBottom: 8 }}>
                                <p style={{ color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>Marca</p>
                                <select value={implantConfig.brand ?? 'Generic'}
                                    onChange={e => setImplantConfig(c => ({ ...c, brand: e.target.value }))}
                                    style={{ width: '100%', background: '#0d1018', border: '1px solid #1e2535', borderRadius: 5, color: '#94a3b8', fontSize: 10, padding: '4px 6px' }}>
                                    {IMPLANT_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>

                            {/* Preview */}
                            <div style={{ padding: '6px 8px', background: '#00B4AB11', border: '1px solid #00B4AB33', borderRadius: 6, textAlign: 'center' }}>
                                <p style={{ color: '#00B4AB', fontSize: 11, fontWeight: 700, margin: 0 }}>
                                    Ø{implantConfig.diameter}×{implantConfig.length}mm
                                </p>
                                <p style={{ color: '#334155', fontSize: 9, margin: '2px 0 0' }}>
                                    {implantConfig.brand ?? 'Generic'}
                                </p>
                            </div>

                            <p style={{ color: '#1e3a5f', fontSize: 9, margin: '8px 0 0', textAlign: 'center', lineHeight: 1.4 }}>
                                Clic en la imagen para colocar el implante planificado
                            </p>

                            {/* Placed implants list */}
                            {implantCount > 0 && (
                                <div style={{ marginTop: 10 }}>
                                    <p style={{ color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>
                                        Colocados ({implantCount})
                                    </p>
                                    {currentMeasurements.filter(m => m.tool === 'implant').map((m, i) => (
                                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', background: '#00B4AB11', borderRadius: 4, marginBottom: 3 }}>
                                            <span style={{ color: '#00B4AB', fontSize: 9, flex: 1 }}>{i + 1}. {m.label}</span>
                                            <button onClick={() => setCurrentMeasurements(currentMeasurements.filter(x => x.id !== m.id))}
                                                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 1 }}>
                                                <X style={{ width: 9, height: 9 }} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── NERVE CANAL HINT (when nerve tool active) ─────────── */}
                    {tool === 'nerve' && (
                        <div style={{ padding: '10px', borderBottom: '1px solid #1a2030' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Activity style={{ width: 14, height: 14, color: '#FFA500' }} />
                                <p style={{ color: '#FFA500', fontSize: 10, fontWeight: 700, margin: 0 }}>Nervio dentario</p>
                            </div>
                            <p style={{ color: '#475569', fontSize: 10, margin: 0, lineHeight: 1.5 }}>
                                Traza el recorrido del nervio dentario inferior haciendo clic en la imagen.
                            </p>
                            <div style={{ marginTop: 8, padding: '5px 8px', background: '#FFA50011', borderRadius: 5, border: '1px solid #FFA50033' }}>
                                <p style={{ color: '#FFA500', fontSize: 9, margin: 0, lineHeight: 1.5 }}>
                                    • Clic para añadir puntos<br />
                                    • Doble-clic para finalizar<br />
                                    • Esc para cancelar
                                </p>
                            </div>
                            {nerveCount > 0 && (
                                <div style={{ marginTop: 8, padding: '4px 7px', background: '#FFA50011', borderRadius: 5, border: '1px solid #FFA50033' }}>
                                    <p style={{ color: '#FFA500', fontSize: 10, fontWeight: 600, margin: 0 }}>
                                        ✓ {nerveCount} trazado{nerveCount > 1 ? 's' : ''} registrado{nerveCount > 1 ? 's' : ''}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── CALIBRATION HINT (when calibrate tool active) ──────── */}
                    {tool === 'calibrate' && (
                        <div style={{ padding: '10px', borderBottom: '1px solid #1a2030' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Crosshair style={{ width: 14, height: 14, color: '#22d3ee' }} />
                                <p style={{ color: '#22d3ee', fontSize: 10, fontWeight: 700, margin: 0 }}>Calibrar escala</p>
                            </div>
                            <p style={{ color: '#475569', fontSize: 10, margin: '0 0 8px', lineHeight: 1.5 }}>
                                Traza una línea sobre una referencia de tamaño conocido e introduce la distancia real.
                            </p>
                            <div style={{ padding: '6px 8px', background: '#22d3ee11', borderRadius: 5, border: '1px solid #22d3ee33' }}>
                                <p style={{ color: '#22d3ee', fontSize: 9, margin: 0, lineHeight: 1.6 }}>
                                    Ejemplos:<br />
                                    • Incisivo central superior ≈ 22-24 mm<br />
                                    • Molar inferior ≈ 18-21 mm<br />
                                    • Implante visible en rx: longitud conocida
                                </p>
                            </div>
                            {currentCalibration && (
                                <div style={{ marginTop: 8, padding: '5px 8px', background: '#22d3ee22', borderRadius: 5, border: '1px solid #22d3ee55' }}>
                                    <p style={{ color: '#22d3ee', fontSize: 10, fontWeight: 600, margin: 0 }}>
                                        ✓ Calibrado: {currentCalibration.pxPerMm.toFixed(2)} px/mm
                                    </p>
                                    <p style={{ color: '#475569', fontSize: 9, margin: '2px 0 0' }}>
                                        Ref: {currentCalibration.refLabel}
                                    </p>
                                    <button onClick={() => { if (selectedId) setCalibrations(prev => { const n = {...prev}; delete n[selectedId]; return n; }); }}
                                        style={{ marginTop: 4, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 9, padding: 0, textDecoration: 'underline' }}>
                                        Restablecer calibración
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* DICOM metadata */}
                    {selected.dicomMeta && (
                        <div style={{ padding: '9px 10px 8px', borderBottom: '1px solid #1a2030' }}>
                            <p style={{ color: '#475569', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>DICOM</p>
                            {[
                                ['Modalidad', selected.dicomMeta.modality],
                                ['Fecha', selected.dicomMeta.studyDate],
                                ['kVp', selected.dicomMeta.kvp ? `${selected.dicomMeta.kvp} kVp` : '—'],
                                ['mA', selected.dicomMeta.tubeCurrent ? `${selected.dicomMeta.tubeCurrent} mA` : '—'],
                                ['Inst.', selected.dicomMeta.institutionName ?? '—'],
                            ].map(([k, v]) => (
                                <div key={k} style={{ marginBottom: 5 }}>
                                    <span style={{ color: '#1e3a5f', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>{k}</span>
                                    <span style={{ color: '#475569', fontSize: 11 }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Image info */}
                    <div style={{ padding: '9px 10px', borderBottom: '1px solid #1a2030' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 7 }}>
                            <Info style={{ width: 10, height: 10, color: '#334155' }} />
                            <span style={{ color: '#334155', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Estudio</span>
                        </div>
                        {[
                            ['Tipo', TIPO_LABEL[selected.tipo]],
                            ['Fecha', formatDate(selected.fecha)],
                            ['Doctor', selected.doctor],
                            ['Tamaño', formatBytes(selected.fileSize)],
                        ].map(([k, v]) => (
                            <div key={k} style={{ marginBottom: 5 }}>
                                <span style={{ color: '#1e3a5f', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>{k}</span>
                                <span style={{ color: '#475569', fontSize: 11, wordBreak: 'break-word' }}>{v}</span>
                            </div>
                        ))}
                        {selected.descripcion && selected.descripcion !== selected.nombre && (
                            <div style={{ marginTop: 6, padding: '5px 7px', background: '#141820', borderRadius: 5, fontSize: 10, color: '#475569', lineHeight: 1.5 }}>
                                {selected.descripcion}
                            </div>
                        )}
                    </div>

                    {/* Measurements list */}
                    {currentMeasurements.filter(m => m.tool !== 'implant' && m.tool !== 'nerve').length > 0 && (
                        <div style={{ padding: '9px 10px' }}>
                            <p style={{ color: '#334155', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                                Mediciones ({currentMeasurements.filter(m => m.tool !== 'implant' && m.tool !== 'nerve').length})
                            </p>
                            {currentMeasurements.filter(m => m.tool !== 'implant' && m.tool !== 'nerve').map((m, i) => (
                                <div key={m.id} style={{ marginBottom: 5, padding: '4px 6px', background: '#0d1018', borderRadius: 5, borderLeft: `2px solid ${m.color}` }}>
                                    <span style={{ color: '#64748b', fontSize: 10 }}>
                                        {i + 1}. {TOOLS.find(t => t.id === m.tool)?.label ?? m.tool}
                                    </span>
                                    {m.label && <p style={{ color: '#94a3b8', fontSize: 10, margin: '2px 0 0' }}>{m.label}</p>}
                                </div>
                            ))}
                            <button onClick={clearMeasurements}
                                style={{ marginTop: 6, width: '100%', padding: '4px 0', background: 'none', border: '1px solid #1e2535', borderRadius: 5, color: '#475569', cursor: 'pointer', fontSize: 10 }}>
                                Borrar todas
                            </button>
                        </div>
                    )}

                    {/* Active tool hint */}
                    <div style={{ marginTop: 'auto', padding: '8px 10px', borderTop: '1px solid #1a2030' }}>
                        <p style={{ color: '#1e2535', fontSize: 9, textAlign: 'center' }}>
                            Herramienta:<br />
                            <span style={{ color: '#334155', fontWeight: 700 }}>
                                {TOOLS.find(t => t.id === tool)?.label ?? tool}
                            </span>
                        </p>
                    </div>
                </div>
            )}

            {/* ── Study Registration Modal ──────────────────────────────────── */}
            {showRegisterModal && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: '#00000088', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <div style={{ background: '#0d1018', border: '1px solid #1e2535', borderRadius: 12, padding: '20px 24px', width: '100%', maxWidth: 480, maxHeight: '90%', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                            <Plus style={{ width: 16, height: 16, color: '#3b82f6' }} />
                            <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, margin: 0, flex: 1 }}>
                                Registrar estudio radiológico
                            </h3>
                            <button onClick={() => { setShowRegisterModal(false); setPendingFiles([]); }}
                                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
                                <X style={{ width: 14, height: 14 }} />
                            </button>
                        </div>

                        {/* Files preview */}
                        {pendingFiles.length > 0 && (
                            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#0a0c10', borderRadius: 8, border: '1px solid #1e2535' }}>
                                {pendingFiles.map(f => (
                                    <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 13 }}>📄</span>
                                        <span style={{ color: '#64748b', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                        <span style={{ color: '#334155', fontSize: 10 }}>{formatBytes(f.size)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Study type */}
                        <div style={{ marginBottom: 14 }}>
                            <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                Tipo de estudio
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {STUDY_TYPE_OPTIONS.map(opt => (
                                    <button key={opt.value}
                                        onClick={() => setStudyForm(f => ({ ...f, tipo: opt.value }))}
                                        style={{
                                            padding: '8px 10px', border: '1px solid', borderRadius: 7, cursor: 'pointer',
                                            textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                                            background: studyForm.tipo === opt.value ? TIPO_COLOR[opt.value] + '22' : '#0a0c10',
                                            borderColor: studyForm.tipo === opt.value ? TIPO_COLOR[opt.value] : '#1e2535',
                                        }}>
                                        <span style={{ fontSize: 16 }}>{opt.icon}</span>
                                        <div>
                                            <p style={{ color: studyForm.tipo === opt.value ? '#e2e8f0' : '#94a3b8', fontSize: 11, fontWeight: 600, margin: 0 }}>{opt.label}</p>
                                            <p style={{ color: '#475569', fontSize: 9, margin: '1px 0 0' }}>{opt.desc}</p>
                                        </div>
                                        {studyForm.tipo === opt.value && (
                                            <Check style={{ width: 12, height: 12, color: TIPO_COLOR[opt.value], marginLeft: 'auto' }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date + Doctor */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                            <div>
                                <p style={{ color: '#475569', fontSize: 10, fontWeight: 600, margin: '0 0 5px' }}>Fecha</p>
                                <input type="date" value={studyForm.fecha}
                                    onChange={e => setStudyForm(f => ({ ...f, fecha: e.target.value }))}
                                    style={{ width: '100%', background: '#0a0c10', border: '1px solid #1e2535', borderRadius: 6, color: '#94a3b8', fontSize: 12, padding: '6px 8px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <p style={{ color: '#475569', fontSize: 10, fontWeight: 600, margin: '0 0 5px' }}>Doctor/a</p>
                                <input type="text" value={studyForm.doctor}
                                    onChange={e => setStudyForm(f => ({ ...f, doctor: e.target.value }))}
                                    placeholder="Dra. Rubio"
                                    style={{ width: '100%', background: '#0a0c10', border: '1px solid #1e2535', borderRadius: 6, color: '#94a3b8', fontSize: 12, padding: '6px 8px', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        {/* Position (for periapical) */}
                        {studyForm.tipo === 'periapical' && (
                            <div style={{ marginBottom: 14 }}>
                                <p style={{ color: '#475569', fontSize: 10, fontWeight: 600, margin: '0 0 5px' }}>Posición dental</p>
                                <select value={studyForm.posicion}
                                    onChange={e => setStudyForm(f => ({ ...f, posicion: e.target.value }))}
                                    style={{ width: '100%', background: '#0a0c10', border: '1px solid #1e2535', borderRadius: 6, color: '#94a3b8', fontSize: 12, padding: '6px 8px' }}>
                                    <option value="">Sin especificar</option>
                                    {TOOTH_POSITIONS.filter(Boolean).map(p => (
                                        <option key={p} value={p}>Diente {p}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Notes */}
                        <div style={{ marginBottom: 18 }}>
                            <p style={{ color: '#475569', fontSize: 10, fontWeight: 600, margin: '0 0 5px' }}>Descripción / notas clínicas</p>
                            <textarea value={studyForm.descripcion}
                                onChange={e => setStudyForm(f => ({ ...f, descripcion: e.target.value }))}
                                rows={2}
                                placeholder="Hallazgos, indicación, zona de interés…"
                                style={{ width: '100%', background: '#0a0c10', border: '1px solid #1e2535', borderRadius: 6, color: '#94a3b8', fontSize: 12, padding: '6px 8px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => { setShowRegisterModal(false); setPendingFiles([]); }}
                                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #1e2535', borderRadius: 7, color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
                                Cancelar
                            </button>
                            <button onClick={handleRegisterConfirm}
                                style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Check style={{ width: 13, height: 13 }} /> Registrar estudio
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RadiologyTab;
