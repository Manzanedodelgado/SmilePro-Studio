/**
 * RadiologyTab.tsx — Visor de radiología integrado en la ficha del paciente
 *
 * Muestra los estudios del paciente activo y permite importar archivos DICOM
 * o imágenes estándar. Usa DicomViewer (Cornerstone3D) para archivos .dcm.
 */

import React, { useState, useCallback, useRef } from 'react';
const DicomViewer = React.lazy(() => import('../radiologia/DicomViewer'));

import {
    Upload, Download, RotateCcw, FlipHorizontal, FlipVertical,
    RefreshCw, Trash2, Info, Image,
} from 'lucide-react';
import { type ColorMap, addEstudio, deleteEstudio, type EstudioRadiologico, type ImageType } from '../../services/imagen.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatBytes = (n?: number) => {
    if (!n) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(2)} MB`;
};

const formatDate = (iso: string) => {
    try {
        return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return iso; }
};

const TIPO_ICON: Record<ImageType, string> = {
    panoramica: '🦷', dicom: '🔬', intraoral: '📷', extraoral: '📸',
    cefalometrica: '📐', periapical: '🔍',
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface RadiologyTabProps {
    numPac?: string;
}

// ── Componente ─────────────────────────────────────────────────────────────────

const RadiologyTab: React.FC<RadiologyTabProps> = ({ numPac }) => {
    const [estudios, setEstudios] = useState<EstudioRadiologico[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [dicomFile, setDicomFile] = useState<File | null>(null);
    const [invertImg, setInvertImg] = useState(false);
    const [flipH, setFlipH] = useState(false);
    const [flipV, setFlipV] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [brightness, setBrightness] = useState(0);
    const [contrast, setContrast] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileMapRef = useRef<Map<string, File>>(new Map());

    const selected = estudios.find(e => e.id === selectedId) ?? null;
    const displayUrl = selected ? (selected.colorizedUrl ?? selected.enhancedUrl ?? selected.originalUrl) : null;
    const isStandardImg = selected && selected.tipo !== 'dicom';

    // CSS transform para imagen estándar
    const imgFilter = isStandardImg
        ? `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) invert(${invertImg ? 1 : 0})`
        : undefined;
    const imgTransform = isStandardImg
        ? `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`
        : undefined;

    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0 || !numPac) return;
        for (const file of Array.from(files)) {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
            const isDcm = ['dcm', 'dic', 'dicom'].includes(ext);
            const tipo: ImageType = isDcm ? 'dicom'
                : ['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext) ? 'panoramica'
                : 'extraoral';
            try {
                const nuevo = await addEstudio(file, { pacienteNumPac: numPac, tipo, doctor: 'Dra. Rubio', descripcion: file.name });
                fileMapRef.current.set(nuevo.id, file);
                setEstudios(prev => [nuevo, ...prev]);
                setSelectedId(nuevo.id);
                if (isDcm) setDicomFile(file);
                else setDicomFile(null);
            } catch (err) { console.error('[RadiologyTab]', err); }
        }
    }, [numPac]);

    const handleSelectStudy = (est: EstudioRadiologico) => {
        setSelectedId(est.id);
        const file = fileMapRef.current.get(est.id) ?? null;
        setDicomFile(est.tipo === 'dicom' ? file : null);
        setBrightness(est.brightness ?? 0);
        setContrast(est.contrast ?? 0);
        setInvertImg(false); setFlipH(false); setFlipV(false); setRotation(0);
    };

    const handleDelete = (id: string) => {
        deleteEstudio(id);
        setEstudios(prev => prev.filter(e => e.id !== id));
        if (selectedId === id) { setSelectedId(null); setDicomFile(null); }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files);
    };

    const handleDownload = () => {
        if (!displayUrl || !selected) return;
        const a = document.createElement('a');
        a.href = displayUrl;
        a.download = selected.nombre;
        a.click();
    };

    const iconSz = { width: 14, height: 14 };

    // ── Sin paciente ───────────────────────────────────────────────────────────
    if (!numPac) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                Selecciona un paciente para ver sus estudios radiológicos.
            </div>
        );
    }

    return (
        <div
            style={{ display: 'flex', height: 'calc(100vh - 200px)', minHeight: 520, background: '#0a0c10', borderRadius: 12, overflow: 'hidden', border: '1px solid #1e2535', position: 'relative' }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragging && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: '#0d47a188', border: '2px dashed #2979ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: '#90caf9', fontSize: 16, fontWeight: 700 }}>Suelta el archivo DICOM o imagen aquí</p>
                </div>
            )}

            {/* ── PANEL IZQUIERDO — Lista de estudios ───────────────────── */}
            <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e2535', background: '#0d1018' }}>
                <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #1e2535', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>Estudios</span>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{ background: '#1e40af', border: 'none', borderRadius: 5, padding: '4px 8px', color: '#93c5fd', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        <Upload style={{ width: 11, height: 11 }} /> Importar
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                    {estudios.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: '#334155' }}>
                            <Image style={{ width: 28, height: 28, margin: '0 auto 8px', opacity: 0.3 }} />
                            <p style={{ fontSize: 11 }}>Sin estudios importados</p>
                            <p style={{ fontSize: 10, marginTop: 4, color: '#1e2535' }}>Arrastra un .dcm o imagen</p>
                        </div>
                    ) : (
                        estudios.map(est => (
                            <div
                                key={est.id}
                                onClick={() => handleSelectStudy(est)}
                                style={{ padding: '7px 12px', cursor: 'pointer', background: selectedId === est.id ? '#1e3a5f' : 'transparent', borderLeft: selectedId === est.id ? '3px solid #3b82f6' : '3px solid transparent', transition: 'background 0.15s' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 14 }}>{TIPO_ICON[est.tipo]}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: selectedId === est.id ? '#93c5fd' : '#94a3b8', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                                            {est.nombre.replace(/\.[^.]+$/, '')}
                                        </p>
                                        <p style={{ color: '#475569', fontSize: 10, margin: 0 }}>{formatDate(est.fecha)} · {formatBytes(est.fileSize)}</p>
                                    </div>
                                    <button
                                        onClick={ev => { ev.stopPropagation(); handleDelete(est.id); }}
                                        style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: 2 }}
                                    >
                                        <Trash2 style={{ width: 11, height: 11 }} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dcm,.dic,.dicom,.jpg,.jpeg,.png,.bmp,.webp"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => handleFiles(e.target.files)}
                />
            </div>

            {/* ── CENTRO — Visor ────────────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* Toolbar */}
                <div style={{ height: 42, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', background: '#0d1018', borderBottom: '1px solid #1e2535' }}>
                    <button title="Invertir" onClick={() => setInvertImg(v => !v)}
                        style={{ width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: invertImg ? '#1e40af' : 'transparent', color: invertImg ? '#93c5fd' : '#475569', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⊘</button>
                    <button title="Voltear horizontal" onClick={() => setFlipH(v => !v)}
                        style={{ width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: flipH ? '#1e40af' : 'transparent', color: flipH ? '#93c5fd' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FlipHorizontal style={iconSz} />
                    </button>
                    <button title="Voltear vertical" onClick={() => setFlipV(v => !v)}
                        style={{ width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: flipV ? '#1e40af' : 'transparent', color: flipV ? '#93c5fd' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FlipVertical style={iconSz} />
                    </button>
                    <button title="Rotar 90°" onClick={() => setRotation(r => (r + 90) % 360)}
                        style={{ width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RefreshCw style={iconSz} />
                    </button>
                    <div style={{ width: 1, height: 20, background: '#1e2535', margin: '0 2px' }} />
                    <button title="Reiniciar" onClick={() => { setInvertImg(false); setFlipH(false); setFlipV(false); setRotation(0); setBrightness(0); setContrast(0); }}
                        style={{ width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RotateCcw style={iconSz} />
                    </button>
                    <button title="Descargar" onClick={handleDownload}
                        style={{ width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Download style={iconSz} />
                    </button>
                    {selected && (
                        <span style={{ marginLeft: 'auto', color: '#334155', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                            {selected.nombre}
                        </span>
                    )}
                </div>

                {/* Visor */}
                <div style={{ flex: 1, minHeight: 0 }}>
                    {!selected ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#334155', gap: 8 }}>
                            <span style={{ fontSize: 40 }}>🦷</span>
                            <p style={{ fontSize: 12 }}>Importa un estudio radiológico para visualizarlo</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{ marginTop: 8, padding: '8px 20px', background: '#1e40af', border: 'none', borderRadius: 8, color: '#93c5fd', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Upload style={{ width: 14, height: 14 }} /> Importar archivo
                            </button>
                        </div>
                    ) : dicomFile ? (
                        <React.Suspense fallback={
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>
                                Cargando visor DICOM…
                            </div>
                        }>
                            <DicomViewer file={dicomFile} />
                        </React.Suspense>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060809', overflow: 'hidden' }}>
                            {displayUrl && (
                                <img
                                    src={displayUrl}
                                    alt={selected.nombre}
                                    style={{
                                        maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                                        filter: imgFilter, transform: imgTransform,
                                        transition: 'filter 0.2s, transform 0.2s',
                                    }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── PANEL DERECHO — Metadata ──────────────────────────────── */}
            {selected && !dicomFile && (
                <div style={{ width: 200, flexShrink: 0, borderLeft: '1px solid #1e2535', background: '#0d1018', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid #1e2535', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Info style={{ width: 12, height: 12, color: '#475569' }} />
                        <span style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Imagen</span>
                    </div>

                    {/* Sliders brillo/contraste para imagen estándar */}
                    <div style={{ padding: '10px 12px' }}>
                        <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Ajustes</p>
                        {[
                            { label: 'Brillo', value: brightness, set: setBrightness },
                            { label: 'Contraste', value: contrast, set: setContrast },
                        ].map(({ label, value, set }) => (
                            <div key={label} style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span style={{ color: '#64748b', fontSize: 10 }}>{label}</span>
                                    <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600 }}>{value > 0 ? `+${value}` : value}</span>
                                </div>
                                <input type="range" min={-100} max={100} value={value}
                                    onChange={e => set(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }} />
                            </div>
                        ))}
                    </div>

                    {/* Metadata */}
                    <div style={{ padding: '0 12px 10px', borderTop: '1px solid #1e2535', paddingTop: 10 }}>
                        <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Información</p>
                        {[
                            ['Archivo', selected.nombre],
                            ['Tipo', selected.tipo],
                            ['Fecha', formatDate(selected.fecha)],
                            ['Tamaño', formatBytes(selected.fileSize)],
                            ['Doctor', selected.doctor],
                        ].map(([k, v]) => (
                            <div key={k} style={{ marginBottom: 6 }}>
                                <span style={{ color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>{k}</span>
                                <span style={{ color: '#64748b', fontSize: 11, wordBreak: 'break-word' }}>{v}</span>
                            </div>
                        ))}
                        {selected.descripcion && (
                            <div style={{ marginTop: 8, padding: '6px 8px', background: '#141820', borderRadius: 6, fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                                {selected.descripcion}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RadiologyTab;
