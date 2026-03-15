/**
 * Radiologia.tsx — Módulo completo de radiología SmilePro
 *
 * Layout 3 columnas:
 *  · Izquierda (240px): galería de estudios agrupada por paciente
 *  · Centro: toolbar + visor (RadiologiaViewer ó CbctViewer)
 *  · Derecha (268px): controles W/L, presets DICOM, mapas de color, metadatos, mediciones
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

type MeasureTool = 'select' | 'pan' | 'wl' | 'ruler' | 'angle' | 'roiRect' | 'roiEllipse' | 'arrow' | 'text';
interface Measurement { id: string; tipo: string; points: { x: number; y: number }[]; value?: number; unit?: string; }
import {
    Upload, Download, RotateCcw, Search, FolderOpen,
    Move, Ruler, Type, Sliders, Info,
    FlipHorizontal, FlipVertical, RefreshCw, Palette,
    Trash2,
    MousePointer2, CornerDownRight, RectangleHorizontal,
    Circle, Minus,
} from 'lucide-react';
import {
    type EstudioRadiologico, type ImageType, type ColorMap,
    addEstudio, deleteEstudio,
    COLOR_MAPS,
} from '../services/imagen.service';

// ── Props ──────────────────────────────────────────────────────────────────────

interface RadiologiaProps {
    activeSubArea: string;
    brightness?: number;
    contrast?: number;
    sharpness?: number;
    colorMap?: ColorMap;
    onBrightnessChange?: (v: number) => void;
    onContrastChange?: (v: number) => void;
    onSharpnessChange?: (v: number) => void;
    onColorMapChange?: (v: ColorMap) => void;
    onStudySelect?: (study: EstudioRadiologico | null) => void;
}

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

const tipoIcon: Record<ImageType, string> = {
    panoramica: '🦷', dicom: '🔬', intraoral: '📷', extraoral: '📸',
    cefalometrica: '📐', periapical: '🔍',
};

// ── Demo data ──────────────────────────────────────────────────────────────────

const DEMO_PATIENTS = [
    { id: 'P001', nombre: 'García López, María' },
    { id: 'P002', nombre: 'Martínez Sánchez, Carlos' },
    { id: 'P003', nombre: 'Rodríguez Pérez, Ana' },
    { id: 'P004', nombre: 'López Fernández, José' },
    { id: 'P005', nombre: 'Sánchez Ruiz, Laura' },
];

const DEMO_STUDIES: EstudioRadiologico[] = [
    {
        id: 'demo-p001-1', pacienteNumPac: 'P001', tipo: 'panoramica',
        nombre: 'PAN_GarciaLopez_20250115.dcm', fecha: '2025-01-15T09:30:00Z',
        doctor: 'Dra. Rubio', descripcion: 'Control anual. Caries incipiente en 36.',
        originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Panoramic_dental_X-ray.jpg/1280px-Panoramic_dental_X-ray.jpg',
        isProcessing: false, colorMap: 'grayscale', brightness: 0, contrast: 10, sharpness: 20,
        anotaciones: [], tags: ['control', 'caries', 'planmeca'], fileSize: 2621440,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P001_GarciaLopez\\20250115\\PAN_GarciaLopez_20250115.dcm',
        dicomMeta: { patientId: 'P001', studyDate: '20250115', modality: 'PX', kvp: 64, tubeCurrent: 4, exposureTime: 14200, studyDescription: 'Ortopantomografía', manufacturer: 'Planmeca ProMax', institutionName: 'Clínica Rubio García' },
    },
    {
        id: 'demo-p001-2', pacienteNumPac: 'P001', tipo: 'periapical',
        nombre: 'PERI_GarciaLopez_36_20250115.dcm', fecha: '2025-01-15T10:10:00Z',
        doctor: 'Dra. Rubio', descripcion: 'Periapical pieza 36 post-tratamiento.',
        originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Periapical_radiograph.jpg/640px-Periapical_radiograph.jpg',
        isProcessing: false, colorMap: 'grayscale', brightness: 5, contrast: 20, sharpness: 30,
        anotaciones: [], tags: ['endodoncia', 'pieza36'], fileSize: 524288,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P001_GarciaLopez\\20250115\\PERI_36_20250115.dcm',
        dicomMeta: { patientId: 'P001', studyDate: '20250115', modality: 'IO', kvp: 60, tubeCurrent: 7, exposureTime: 380, studyDescription: 'Rx Periapical 36', manufacturer: 'Planmeca ProSensor', institutionName: 'Clínica Rubio García' },
    },
    {
        id: 'demo-p001-3', pacienteNumPac: 'P001', tipo: 'intraoral',
        nombre: 'FOTO_intraoral_P001_anterior.jpg', fecha: '2025-01-15T10:30:00Z',
        doctor: 'Dra. Rubio', descripcion: 'Foto intraoral sector anterior. Pre-blanqueamiento.',
        originalUrl: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e19?w=800&q=80',
        isProcessing: false, colorMap: 'grayscale', brightness: 0, contrast: 0, sharpness: 0,
        anotaciones: [], tags: ['blanqueamiento', 'estetica'], fileSize: 1887436,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P001_GarciaLopez\\20250115\\FOTO_intraoral_anterior.jpg',
    },
    {
        id: 'demo-p002-1', pacienteNumPac: 'P002', tipo: 'dicom',
        nombre: 'CBCT_MartinezSanchez_20241220.dcm', fecha: '2024-12-20T11:00:00Z',
        doctor: 'Dr. García', descripcion: 'CBCT implantología. Valoración hueso zona 1.6.',
        originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Animated_gif_of_MRI_brain_scan.gif/220px-Animated_gif_of_MRI_brain_scan.gif',
        isProcessing: false, colorMap: 'bone', brightness: 0, contrast: 30, sharpness: 0,
        anotaciones: [], tags: ['implante', 'cbct', 'romexis'], fileSize: 127920426,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P002_MartinezSanchez\\20241220\\CBCT_Implante_16.dcm',
        dicomMeta: { patientId: 'P002', studyDate: '20241220', modality: 'CT', kvp: 84, tubeCurrent: 4, exposureTime: 14000, studyDescription: 'CBCT Implantología 1.6', manufacturer: 'Planmeca ProMax 3D', institutionName: 'Clínica Rubio García' },
    },
    {
        id: 'demo-p002-2', pacienteNumPac: 'P002', tipo: 'panoramica',
        nombre: 'PAN_MartinezSanchez_20241220.dcm', fecha: '2024-12-20T10:15:00Z',
        doctor: 'Dr. García', descripcion: 'Panorámica preoperatoria implante.',
        originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Panoramic_dental_X-ray.jpg/1280px-Panoramic_dental_X-ray.jpg',
        isProcessing: false, colorMap: 'grayscale', brightness: 0, contrast: 15, sharpness: 25,
        anotaciones: [], tags: ['implante', 'preop'], fileSize: 2621440,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P002_MartinezSanchez\\20241220\\PAN_preop.dcm',
        dicomMeta: { patientId: 'P002', studyDate: '20241220', modality: 'PX', kvp: 64, tubeCurrent: 4, exposureTime: 14200, studyDescription: 'Ortopantomografía preop', manufacturer: 'Planmeca ProMax', institutionName: 'Clínica Rubio García' },
    },
    {
        id: 'demo-p003-1', pacienteNumPac: 'P003', tipo: 'cefalometrica',
        nombre: 'CEFA_RodriguezPerez_20250210.dcm', fecha: '2025-02-10T08:30:00Z',
        doctor: 'Dra. Rubio', descripcion: 'Teleradiografía lateral. Inicio ortodoncia.',
        originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Lateral_cephalometric_radiograph.jpg/640px-Lateral_cephalometric_radiograph.jpg',
        isProcessing: false, colorMap: 'grayscale', brightness: 0, contrast: 20, sharpness: 15,
        anotaciones: [], tags: ['ortodoncia', 'cefalometria'], fileSize: 2097152,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P003_RodriguezPerez\\20250210\\CEFA_lateral.dcm',
        dicomMeta: { patientId: 'P003', studyDate: '20250210', modality: 'PX', kvp: 73, tubeCurrent: 12, exposureTime: 12000, studyDescription: 'Teleradiografía Lateral', manufacturer: 'Planmeca ProMax', institutionName: 'Clínica Rubio García' },
    },
    {
        id: 'demo-p003-2', pacienteNumPac: 'P003', tipo: 'panoramica',
        nombre: 'PAN_RodriguezPerez_20250210.dcm', fecha: '2025-02-10T08:00:00Z',
        doctor: 'Dra. Rubio', descripcion: 'Ortodoncia — fase inicial. Apiñamiento moderado.',
        originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Panoramic_dental_X-ray.jpg/1280px-Panoramic_dental_X-ray.jpg',
        isProcessing: false, colorMap: 'grayscale', brightness: 0, contrast: 10, sharpness: 20,
        anotaciones: [], tags: ['ortodoncia', 'inicio'], fileSize: 2621440,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P003_RodriguezPerez\\20250210\\PAN_ortodoncia.dcm',
        dicomMeta: { patientId: 'P003', studyDate: '20250210', modality: 'PX', kvp: 64, tubeCurrent: 4, exposureTime: 14200, studyDescription: 'Ortopantomografía ortodoncia', manufacturer: 'Planmeca ProMax', institutionName: 'Clínica Rubio García' },
    },
    {
        id: 'demo-p004-1', pacienteNumPac: 'P004', tipo: 'dicom',
        nombre: 'CBCT_LopezFernandez_20250118.dcm', fecha: '2025-01-18T14:00:00Z',
        doctor: 'Dr. García', descripcion: 'CBCT endodoncia. Evaluación ápices 1.1-1.3.',
        originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Animated_gif_of_MRI_brain_scan.gif/220px-Animated_gif_of_MRI_brain_scan.gif',
        isProcessing: false, colorMap: 'bone', brightness: 0, contrast: 30, sharpness: 0,
        anotaciones: [], tags: ['endodoncia', 'cbct'], fileSize: 89400000,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P004_LopezFernandez\\20250118\\CBCT_Endodoncia_anterior.dcm',
        dicomMeta: { patientId: 'P004', studyDate: '20250118', modality: 'CT', kvp: 84, tubeCurrent: 4, exposureTime: 14000, studyDescription: 'CBCT Endodoncia Sector Anterior', manufacturer: 'Planmeca ProMax 3D', institutionName: 'Clínica Rubio García' },
    },
    {
        id: 'demo-p004-2', pacienteNumPac: 'P004', tipo: 'periapical',
        nombre: 'PERI_LopezFernandez_11_20250118.dcm', fecha: '2025-01-18T13:30:00Z',
        doctor: 'Dr. García', descripcion: 'Periapical pieza 1.1. Lesión apical 3mm.',
        originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Periapical_radiograph.jpg/640px-Periapical_radiograph.jpg',
        isProcessing: false, colorMap: 'grayscale', brightness: 10, contrast: 25, sharpness: 35,
        anotaciones: [], tags: ['endodoncia', 'lesion'], fileSize: 524288,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P004_LopezFernandez\\20250118\\PERI_11.dcm',
        dicomMeta: { patientId: 'P004', studyDate: '20250118', modality: 'IO', kvp: 59, tubeCurrent: 7, exposureTime: 360, studyDescription: 'Rx Periapical 1.1', manufacturer: 'Planmeca ProSensor', institutionName: 'Clínica Rubio García' },
    },
    {
        id: 'demo-p005-1', pacienteNumPac: 'P005', tipo: 'panoramica',
        nombre: 'PAN_SanchezRuiz_20250228.dcm', fecha: '2025-02-28T16:00:00Z',
        doctor: 'Dra. Rubio', descripcion: 'Revisión cordales. Impactación 48.',
        originalUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Panoramic_dental_X-ray.jpg/1280px-Panoramic_dental_X-ray.jpg',
        isProcessing: false, colorMap: 'grayscale', brightness: 0, contrast: 10, sharpness: 20,
        anotaciones: [], tags: ['cordales', 'cirugia'], fileSize: 2621440,
        rutaOrigen: '\\\\SERVIDOR-CLINICA\\Romexis\\Pacientes\\P005_SanchezRuiz\\20250228\\PAN_cordales.dcm',
        dicomMeta: { patientId: 'P005', studyDate: '20250228', modality: 'PX', kvp: 64, tubeCurrent: 4, exposureTime: 14200, studyDescription: 'Ortopantomografía cordales', manufacturer: 'Planmeca ProMax', institutionName: 'Clínica Rubio García' },
    },
];

// ── Toolbar config ─────────────────────────────────────────────────────────────

const TOOL_BUTTONS: { id: MeasureTool; title: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: 'select', title: 'Seleccionar', Icon: ({ className }) => <MousePointer2 className={className} /> },
    { id: 'pan',    title: 'Mover (Pan)', Icon: ({ className }) => <Move className={className} /> },
    { id: 'wl',     title: 'Brillo/Contraste (W/L)', Icon: ({ className }) => <Sliders className={className} /> },
    { id: 'ruler',  title: 'Regla', Icon: ({ className }) => <Ruler className={className} /> },
    { id: 'angle',  title: 'Ángulo', Icon: ({ className }) => <CornerDownRight className={className} /> },
    { id: 'roiRect', title: 'ROI Rectángulo', Icon: ({ className }) => <RectangleHorizontal className={className} /> },
    { id: 'roiEllipse', title: 'ROI Elipse', Icon: ({ className }) => <Circle className={className} /> },
    { id: 'arrow',  title: 'Flecha', Icon: ({ className }) => <Minus className={className} /> },
    { id: 'text',   title: 'Texto', Icon: ({ className }) => <Type className={className} /> },
];

// ── Componente principal ───────────────────────────────────────────────────────

const Radiologia: React.FC<RadiologiaProps> = ({ activeSubArea, onStudySelect }) => {

    // ── Galería ───────────────────────────────────────────────────────────────
    const [estudios, setEstudios] = useState<EstudioRadiologico[]>(DEMO_STUDIES);
    const [selectedId, setSelectedId] = useState<string | null>(DEMO_STUDIES[0].id);
    const [filterType, setFilterType] = useState<'all' | ImageType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatient, _setSelectedPatient] = useState<string>('all');
    const [_isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileMapRef = useRef<Map<string, File>>(new Map());
    const [dicomFile, setDicomFile] = useState<File | null>(null);

    // ── Herramienta activa ────────────────────────────────────────────────────
    const [activeTool, setActiveTool] = useState<MeasureTool>('select');
    const [romexisMsg, setRomexisMsg] = useState<string | null>(null);
    const [measurements, setMeasurements] = useState<Measurement[]>([]);

    // ── Ajustes imagen (RadiologiaViewer) ─────────────────────────────────────
    const [brightness, setBrightness] = useState(0);
    const [contrast, setContrast] = useState(0);
    const [invertImg, setInvertImg] = useState(false);
    const [flipH, setFlipH] = useState(false);
    const [flipV, setFlipV] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [colorMap, setColorMap] = useState<ColorMap>('grayscale');


    // ── Notificar padre ───────────────────────────────────────────────────────
    useEffect(() => {
        const s = estudios.find(e => e.id === selectedId) ?? null;
        onStudySelect?.(s);
    }, [selectedId, estudios]);

    // ── Derivados ─────────────────────────────────────────────────────────────
    const selected = estudios.find(e => e.id === selectedId) ?? null;
    const isDicom = selected?.tipo === 'dicom';
    const displayUrl = selected
        ? (selected.colorizedUrl ?? selected.enhancedUrl ?? selected.originalUrl)
        : null;

    // Sincronizar ajustes al seleccionar imagen
    useEffect(() => {
        if (!selected) return;
        setBrightness(selected.brightness);
        setContrast(selected.contrast);
        setColorMap(selected.colorMap);
        setInvertImg(false);
        setFlipH(false);
        setFlipV(false);
        setRotation(0);
        setMeasurements([]);
    }, [selectedId]);

    // ── Filtrado galería ──────────────────────────────────────────────────────
    const filtered = estudios.filter(e => {
        const matchType = filterType === 'all' || e.tipo === filterType;
        const matchPat = selectedPatient === 'all' || e.pacienteNumPac === selectedPatient;
        const q = searchQuery.toLowerCase();
        const matchQ = !q || e.nombre.toLowerCase().includes(q) || e.descripcion.toLowerCase().includes(q)
            || e.tags.some(t => t.includes(q));
        return matchType && matchPat && matchQ;
    });

    const grouped = DEMO_PATIENTS
        .map(p => ({ patient: p, studies: filtered.filter(e => e.pacienteNumPac === p.id) }))
        .filter(g => g.studies.length > 0);

    // ── Upload ────────────────────────────────────────────────────────────────
    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);
        for (const file of Array.from(files)) {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
            const isDcm = ['dcm', 'dic', 'dicom'].includes(ext);
            const tipo: ImageType = isDcm ? 'dicom'
                : ['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext) ? 'panoramica' : 'extraoral';
            try {
                const nuevo = await addEstudio(file, {
                    pacienteNumPac: 'ACTUAL', tipo, doctor: 'Dra. Rubio',
                    descripcion: 'Importado desde archivo',
                });
                fileMapRef.current.set(nuevo.id, file);
                setEstudios(prev => [nuevo, ...prev]);
                setSelectedId(nuevo.id);
                if (nuevo.tipo === 'dicom') setDicomFile(file);
            } catch (err) {
                console.error('[Radiologia] Upload error:', err);
            }
        }
        setIsUploading(false);
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    // ── Acciones toolbar ──────────────────────────────────────────────────────
    const handleRotateCW = () => setRotation(r => (r + 90) % 360);
    const handleReset = () => {
        setBrightness(0); setContrast(0); setInvertImg(false);
        setFlipH(false); setFlipV(false); setRotation(0);
        setMeasurements([]);
    };

    const handleDownload = () => {
        if (!displayUrl || !selected) return;
        const filename = `${selected.nombre.replace(/\.[^.]+$/, '')}_SmilePro.png`;
        if (displayUrl.startsWith('blob:') || displayUrl.startsWith('data:')) {
            // Archivo local — descarga directa
            const a = document.createElement('a');
            a.href = displayUrl;
            a.download = filename;
            a.click();
        } else {
            // URL remota — CORS impide descarga directa, abre en nueva pestaña
            window.open(displayUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const openInRomexis = async () => {
        const filePath = selected?.rutaOrigen;
        if (!filePath) {
            setRomexisMsg('Este estudio no tiene ruta de origen registrada.');
            setTimeout(() => setRomexisMsg(null), 3000);
            return;
        }
        try {
            await navigator.clipboard.writeText(filePath);
            setRomexisMsg('Ruta copiada al portapapeles');
        } catch {
            // Fallback: prompt para copiar manualmente
            window.prompt('Copia esta ruta y ábrela en Planmeca Romexis:', filePath);
            return;
        }
        setTimeout(() => setRomexisMsg(null), 3000);
    };

    const openInWeasis = () => {
        const filePath = selected?.rutaOrigen;
        const uri = filePath
            ? `weasis://?${encodeURIComponent(`$dicom:get -l "${filePath}"`)}`
            : 'weasis://';
        window.location.href = uri;
    };

    const handleColorMap = (map: ColorMap) => {
        // Aplica directamente en estado — RadiologiaViewer usa CSS filters,
        // no necesita processEstudio (que falla con CORS en URLs remotas)
        setColorMap(map);
        setEstudios(prev => prev.map((e: EstudioRadiologico) => e.id === selectedId ? { ...e, colorMap: map } : e));
    };

    const handleDelete = (id: string) => {
        if (DEMO_STUDIES.some(d => d.id === id)) return;
        deleteEstudio(id);
        setEstudios(prev => prev.filter(e => e.id !== id));
        if (selectedId === id) setSelectedId(estudios[0]?.id ?? null);
    };

    // ── Gestión de Archivos (subárea alternativa) ─────────────────────────────
    if (activeSubArea === 'Gestión de Archivos') {
        return (
            <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-300">
                <div className="text-center space-y-3">
                    <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Gestor de Archivos DICOM</h3>
                    <p className="text-xs text-slate-400">Módulo en construcción.</p>
                </div>
            </div>
        );
    }

    // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────

    return (
        <div
            style={{ display: 'flex', height: 'calc(100vh - 112px)', minHeight: 0, background: '#0a0c10', borderRadius: 16, overflow: 'hidden', border: '1px solid #1e2535' }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: '#0d47a188', border: '2px dashed #2979ff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: '#90caf9', fontSize: 18, fontWeight: 700 }}>Suelta aquí el archivo DICOM / imagen</p>
                </div>
            )}

            {/* ── PANEL IZQUIERDO: galería ─────────────────────────────────── */}
            <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e2535', background: '#0d1018' }}>
                {/* Cabecera */}
                <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #1e2535' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>Estudios</span>
                        <button
                            title="Importar archivo"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ background: '#1e40af', border: 'none', borderRadius: 5, padding: '4px 8px', color: '#93c5fd', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            <Upload style={{ width: 11, height: 11 }} /> Importar
                        </button>
                    </div>
                    {/* Búsqueda */}
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                        <Search style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#475569' }} />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar estudio…"
                            style={{ width: '100%', background: '#141820', border: '1px solid #1e2535', borderRadius: 6, padding: '5px 8px 5px 24px', color: '#94a3b8', fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    {/* Filtro tipo */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(['all', 'panoramica', 'periapical', 'dicom', 'cefalometrica', 'intraoral', 'extraoral'] as const).map(t => (
                            <button key={t}
                                onClick={() => setFilterType(t)}
                                style={{
                                    background: filterType === t ? '#1e40af' : '#141820',
                                    border: `1px solid ${filterType === t ? '#3b82f6' : '#1e2535'}`,
                                    borderRadius: 4, padding: '2px 6px', color: filterType === t ? '#93c5fd' : '#475569',
                                    cursor: 'pointer', fontSize: 10, fontWeight: 600,
                                }}
                            >
                                {t === 'all' ? 'Todo' : t === 'dicom' ? 'CBCT' : t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista agrupada */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                    {grouped.map(({ patient, studies }) => (
                        <div key={patient.id}>
                            <div style={{ padding: '6px 12px 3px', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {patient.nombre.split(',')[0]}
                            </div>
                            {studies.map(est => (
                                <div
                                    key={est.id}
                                    onClick={() => {
                                        setSelectedId(est.id);
                                        setDicomFile(fileMapRef.current.get(est.id) ?? null);
                                    }}
                                    style={{
                                        padding: '7px 12px',
                                        cursor: 'pointer',
                                        background: selectedId === est.id ? '#1e3a5f' : 'transparent',
                                        borderLeft: selectedId === est.id ? '3px solid #3b82f6' : '3px solid transparent',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <span style={{ fontSize: 14 }}>{tipoIcon[est.tipo]}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ color: selectedId === est.id ? '#93c5fd' : '#94a3b8', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                                                {est.nombre.replace(/\.[^.]+$/, '')}
                                            </p>
                                            <p style={{ color: '#475569', fontSize: 10, margin: 0 }}>
                                                {formatDate(est.fecha)} · {formatBytes(est.fileSize)}
                                            </p>
                                        </div>
                                        {!DEMO_STUDIES.some(d => d.id === est.id) && (
                                            <button onClick={ev => { ev.stopPropagation(); handleDelete(est.id); }}
                                                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}>
                                                <Trash2 style={{ width: 11, height: 11 }} />
                                            </button>
                                        )}
                                    </div>
                                    {est.tags.length > 0 && (
                                        <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
                                            {est.tags.slice(0, 3).map(tag => (
                                                <span key={tag} style={{ background: '#1e2535', color: '#475569', fontSize: 9, padding: '1px 5px', borderRadius: 3 }}>{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 12 }}>
                            Sin resultados
                        </div>
                    )}
                </div>

                <input ref={fileInputRef} type="file" accept=".dcm,.dic,.dicom,.jpg,.jpeg,.png,.bmp,.webp"
                    multiple style={{ display: 'none' }}
                    onChange={e => handleFiles(e.target.files)} />
            </div>

            {/* ── CENTRO: toolbar + visor ──────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* Toolbar */}
                <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, padding: '0 10px', background: '#0d1018', borderBottom: '1px solid #1e2535', overflowX: 'auto' }}>

                    {/* Herramientas de medición */}
                    {TOOL_BUTTONS.map(({ id, title, Icon }) => (
                        <button key={id} title={title} onClick={() => setActiveTool(id)}
                            style={{
                                width: 30, height: 30, border: 'none', borderRadius: 5, cursor: 'pointer',
                                background: activeTool === id ? '#1e40af' : 'transparent',
                                color: activeTool === id ? '#93c5fd' : '#475569',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'background 0.12s',
                            }}>
                            <Icon className="w-3.5 h-3.5" />
                        </button>
                    ))}

                    <div style={{ width: 1, height: 22, background: '#1e2535', margin: '0 4px' }} />

                    {/* Transformaciones (solo RadiologiaViewer) */}
                    {!isDicom && <>
                        <button title="Invertir colores" onClick={() => setInvertImg(v => !v)}
                            style={{ width: 30, height: 30, border: 'none', borderRadius: 5, cursor: 'pointer', background: invertImg ? '#1e40af' : 'transparent', color: invertImg ? '#93c5fd' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 14 }}>⊘</span>
                        </button>
                        <button title="Voltear horizontal" onClick={() => setFlipH(v => !v)}
                            style={{ width: 30, height: 30, border: 'none', borderRadius: 5, cursor: 'pointer', background: flipH ? '#1e40af' : 'transparent', color: flipH ? '#93c5fd' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FlipHorizontal style={{ width: 14, height: 14 }} />
                        </button>
                        <button title="Voltear vertical" onClick={() => setFlipV(v => !v)}
                            style={{ width: 30, height: 30, border: 'none', borderRadius: 5, cursor: 'pointer', background: flipV ? '#1e40af' : 'transparent', color: flipV ? '#93c5fd' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FlipVertical style={{ width: 14, height: 14 }} />
                        </button>
                        <button title="Rotar 90° CW" onClick={handleRotateCW}
                            style={{ width: 30, height: 30, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <RefreshCw style={{ width: 14, height: 14 }} />
                        </button>
                    </>}

                    <div style={{ width: 1, height: 22, background: '#1e2535', margin: '0 4px' }} />

                    <button title="Reiniciar vista" onClick={handleReset}
                        style={{ width: 30, height: 30, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RotateCcw style={{ width: 14, height: 14 }} />
                    </button>
                    <button title="Descargar imagen" onClick={handleDownload}
                        style={{ width: 30, height: 30, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Download style={{ width: 14, height: 14 }} />
                    </button>

                    <div style={{ width: 1, height: 22, background: '#1e2535', margin: '0 4px' }} />

                    {/* Abrir en apps externas */}
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <button title="Copiar ruta de Romexis al portapapeles" onClick={openInRomexis}
                            style={{ padding: '3px 8px', border: `1px solid ${romexisMsg ? '#22d3ee' : '#1e2535'}`, borderRadius: 5, cursor: 'pointer', background: romexisMsg ? '#0e4d5c' : 'transparent', color: romexisMsg ? '#22d3ee' : '#475569', fontSize: 10, fontWeight: 600, transition: 'all 0.2s' }}>
                            {romexisMsg ?? 'Romexis'}
                        </button>
                    </div>
                    <button title="Abrir en Weasis (DICOM viewer gratuito)" onClick={openInWeasis}
                        style={{ padding: '3px 8px', border: '1px solid #1e2535', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#475569', fontSize: 10, fontWeight: 600 }}>
                        Weasis
                    </button>

                    {/* Nombre estudio */}
                    {selected && (
                        <div style={{ marginLeft: 'auto', color: '#334155', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                            {selected.nombre}
                        </div>
                    )}
                </div>

                {/* Visor */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', background: '#060809' }}>
                    {!selected || !displayUrl ? (
                        <div style={{ textAlign: 'center', color: '#334155' }}>
                            <p style={{ fontSize: 13, marginBottom: 6 }}>Selecciona un estudio</p>
                            <p style={{ fontSize: 11 }}>o arrastra un archivo DICOM / imagen</p>
                        </div>
                    ) : isDicom && !dicomFile ? (
                        /* DICOM de red sin archivo local → panel informativo */
                        <div style={{ textAlign: 'center', color: '#475569', padding: 32 }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>Estudio DICOM</p>
                            <p style={{ fontSize: 11, marginBottom: 16, lineHeight: 1.6 }}>
                                Este estudio está almacenado en el servidor de imágenes.<br />
                                Usa el botón <strong style={{ color: '#22d3ee' }}>Romexis</strong> o <strong style={{ color: '#94a3b8' }}>Weasis</strong> para abrirlo.
                            </p>
                            {selected.rutaOrigen && (
                                <code style={{ display: 'block', background: '#0d1018', border: '1px solid #1e2535', borderRadius: 6, padding: '6px 10px', fontSize: 10, color: '#64748b', wordBreak: 'break-all' }}>
                                    {selected.rutaOrigen}
                                </code>
                            )}
                        </div>
                    ) : (
                        /* Imagen (estándar o DICOM importado) con filtros CSS */
                        <img
                            src={displayUrl}
                            alt={selected.nombre}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                filter: [
                                    `brightness(${1 + brightness / 100})`,
                                    `contrast(${1 + contrast / 100})`,
                                    invertImg ? 'invert(1)' : '',
                                ].filter(Boolean).join(' '),
                                transform: [
                                    `rotate(${rotation}deg)`,
                                    flipH ? 'scaleX(-1)' : '',
                                    flipV ? 'scaleY(-1)' : '',
                                ].filter(Boolean).join(' '),
                                transition: 'filter 0.15s, transform 0.15s',
                            }}
                        />
                    )}
                </div>
            </div>

            {/* ── PANEL DERECHO: controles ─────────────────────────────────── */}
            <div style={{ width: 268, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1e2535', background: '#0d1018', overflowY: 'auto' }}>

                {/* Ajuste de imagen */}
                {(!isDicom || dicomFile || !selected?.rutaOrigen) && (
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2535' }}>
                        <p style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                            Ajuste de imagen
                        </p>
                        <SliderRow label="Brillo" value={brightness} min={-100} max={100} onChange={setBrightness} />
                        <SliderRow label="Contraste" value={contrast} min={-100} max={100} onChange={setContrast} />
                    </div>
                )}

                {/* Info DICOM — controles en Romexis (solo si es estudio de red, no local) */}
                {isDicom && !dicomFile && (
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2535' }}>
                        <p style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                            Imagen DICOM
                        </p>
                        <p style={{ color: '#334155', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
                            Los controles W/L, presets y layout 3D están disponibles dentro de Planmeca Romexis.
                        </p>
                    </div>
                )}

                {/* Mapa de color */}
                {(!isDicom || dicomFile || !selected?.rutaOrigen) && (
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2535' }}>
                        <p style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                            <Palette style={{ display: 'inline', width: 10, height: 10, marginRight: 4 }} />
                            Mapa de color
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {COLOR_MAPS.map(cm => (
                                <button key={cm.value} title={cm.label} onClick={() => handleColorMap(cm.value as ColorMap)}
                                    style={{
                                        padding: '3px 8px', border: `1px solid ${colorMap === cm.value ? '#3b82f6' : '#1e2535'}`,
                                        borderRadius: 4, cursor: 'pointer', fontSize: 10,
                                        background: colorMap === cm.value ? '#1e40af' : '#141820',
                                        color: colorMap === cm.value ? '#93c5fd' : '#64748b',
                                    }}>
                                    {cm.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Metadatos DICOM */}
                {selected?.dicomMeta && (
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2535' }}>
                        <p style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                            <Info style={{ display: 'inline', width: 10, height: 10, marginRight: 4 }} />
                            Metadatos DICOM
                        </p>
                        {[
                            ['Descripción', selected.dicomMeta.studyDescription],
                            ['Modalidad', selected.dicomMeta.modality],
                            ['Fecha estudio', selected.dicomMeta.studyDate?.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')],
                            ['kVp', selected.dicomMeta.kvp?.toString()],
                            ['mA', selected.dicomMeta.tubeCurrent?.toString()],
                            ['Exposición', selected.dicomMeta.exposureTime ? `${selected.dicomMeta.exposureTime} ms` : undefined],
                            ['Fabricante', selected.dicomMeta.manufacturer],
                            ['Institución', selected.dicomMeta.institutionName],
                            ['Tamaño', formatBytes(selected.fileSize)],
                        ].filter(([, v]) => v).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ color: '#475569', fontSize: 10 }}>{k}</span>
                                <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600, maxWidth: 130, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                            </div>
                        ))}
                    </div>
                )}


                {/* Mediciones */}
                <div style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <p style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                            Mediciones ({measurements.length})
                        </p>
                        {measurements.length > 0 && (
                            <button onClick={() => setMeasurements([])}
                                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 10 }}>
                                Limpiar
                            </button>
                        )}
                    </div>
                    {measurements.length === 0 && (
                        <p style={{ color: '#334155', fontSize: 11, textAlign: 'center', padding: '8px 0' }}>
                            Selecciona una herramienta y haz clic en la imagen para añadir mediciones.
                        </p>
                    )}
                    {measurements.map((m) => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#141820', borderRadius: 5, marginBottom: 3, border: `1px solid ${m.color}33` }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                            <span style={{ color: '#94a3b8', fontSize: 10, flex: 1 }}>
                                {m.tool.replace('roi', 'ROI ').replace('ruler', 'Regla').replace('angle', 'Ángulo').replace('arrow', 'Flecha').replace('text', 'Texto').replace('roiRect', 'ROI Rect').replace('roiEllipse', 'ROI Elipse')}
                                {m.label ? ` — ${m.label}` : ''}
                            </span>
                            <button onClick={() => setMeasurements(prev => prev.filter(x => x.id !== m.id))}
                                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>
                                ✕
                            </button>
                        </div>
                    ))}
                </div>

                {/* Descripción estudio */}
                {selected?.descripcion && (
                    <div style={{ padding: '10px 14px', borderTop: '1px solid #1e2535' }}>
                        <p style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Descripción</p>
                        <p style={{ color: '#475569', fontSize: 11, lineHeight: 1.5, margin: 0 }}>{selected.descripcion}</p>
                        <p style={{ color: '#334155', fontSize: 10, marginTop: 4 }}>{selected.doctor} · {formatDate(selected.fecha)}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── SliderRow helper ───────────────────────────────────────────────────────────

const SliderRow: React.FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void }> = ({ label, value, min, max, onChange }) => (
    <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>{label}</span>
            <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>{value}</span>
        </div>
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }} />
    </div>
);

export default Radiologia;
