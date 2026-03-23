/**
 * RadiologyTab.tsx — Pestaña de radiología en la ficha del paciente
 */

import React, { useState, useCallback, useRef, Suspense } from 'react';
import RadiologiaViewer from '../radiologia/RadiologiaViewer';
import PlanmecaLauncher from '../radiologia/PlanmecaLauncher';
import { loadDicomVolume, type DicomVolume } from '../../services/dicom.service';
import { checkOrthancOnline, uploadDicomToOrthanc, openInOhif } from '../../services/orthanc.service';
import {
    Upload, Search, Trash2, ChevronLeft, ChevronRight, Layers, FileImage, Info, ExternalLink, Loader,
} from 'lucide-react';
import {
    addEstudio, deleteEstudio, loadEstudiosFromBackend, getEstudios,
    type EstudioRadiologico, type ImageType,
} from '../../services/imagen.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_ICON: Record<ImageType, string> = {
    panoramica:    '🦷',
    dicom:         '🔬',
    intraoral:     '📷',
    extraoral:     '📸',
    cefalometrica: '📐',
    periapical:    '🔍',
};

const fmt = {
    date: (iso: string) => {
        try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch { return iso; }
    },
    bytes: (n?: number) => {
        if (!n) return '—';
        if (n < 1024)    return `${n} B`;
        if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / 1048576).toFixed(2)} MB`;
    },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface RadiologyTabProps { numPac?: string; }

// ── Componente principal ──────────────────────────────────────────────────────

const RadiologyTab: React.FC<RadiologyTabProps> = ({ numPac }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileMapRef   = useRef<Map<string, File>>(new Map());

    const [estudios,   setEstudios]   = useState<EstudioRadiologico[]>(() => getEstudios(numPac) ?? []);
    const [selectedId, setSelectedId] = useState<string | null>(() => (getEstudios(numPac) ?? [])[0]?.id ?? null);
    const [dicomFile,  setDicomFile]  = useState<File | null>(null);
    const [panelOpen,  setPanelOpen]  = useState(true);
    const [search,     setSearch]     = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [uploading,  setUploading]  = useState(false);

    // OHIF / Orthanc
    const [orthancOnline,  setOrthancOnline]  = useState<boolean | null>(null);
    const [ohifUrl,        setOhifUrl]        = useState<string | null>(null);
    const [ohifUploading,  setOhifUploading]  = useState(false);
    const [ohifError,      setOhifError]      = useState<string | null>(null);

    // Comprobar Orthanc al montar
    React.useEffect(() => {
        checkOrthancOnline().then(setOrthancOnline);
    }, []);

    // Cargar desde backend
    React.useEffect(() => {
        if (!numPac) return;
        loadEstudiosFromBackend(numPac)
            .then(list => {
                if (list.length > 0) {
                    setEstudios(list);
                    setSelectedId(prev => prev ?? list[0]?.id ?? null);
                }
            })
            .catch(() => {/* usa datos en memoria */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numPac]);

    const selected   = estudios.find(e => e.id === selectedId) ?? null;
    const displayUrl = selected ? (selected.colorizedUrl ?? selected.enhancedUrl ?? selected.originalUrl) : null;

    const filtered = estudios.filter(e => {
        if (!search) return true;
        const q = search.toLowerCase();
        return e.nombre.toLowerCase().includes(q)
            || e.descripcion.toLowerCase().includes(q)
            || e.tags.some(t => t.includes(q));
    });

    // ── Subida ────────────────────────────────────────────────────────────────

    // DICOMs > 30 MB se envían directo a OHIF (evita bloquear el browser con JS)
    const DICOM_BROWSER_LIMIT_MB = 30;

    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        for (const file of Array.from(files)) {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
            const tipo: ImageType = ['dcm', 'dic', 'dicom'].includes(ext) ? 'dicom'
                : ['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext) ? 'panoramica'
                : 'extraoral';
            try {
                const nuevo = await addEstudio(file, {
                    pacienteNumPac: numPac ?? 'ACTUAL',
                    tipo, doctor: 'Dra. Rubio', descripcion: 'Importado desde archivo',
                });
                fileMapRef.current.set(nuevo.id, file);
                setEstudios(prev => [nuevo, ...prev]);
                setSelectedId(nuevo.id);

                if (tipo === 'dicom') {
                    const sizeMb = file.size / 1_048_576;
                    // Archivos grandes → subir directo a Orthanc/OHIF sin parsear en el browser
                    if (sizeMb > DICOM_BROWSER_LIMIT_MB && orthancOnline) {
                        setOhifUploading(true);
                        uploadDicomToOrthanc(file)
                            .then(url => { setOhifUrl(url); openInOhif(url); })
                            .catch(e => setOhifError(e.message))
                            .finally(() => setOhifUploading(false));
                    } else {
                        setDicomFile(file);
                    }
                }
            } catch (err) { console.error('[RadiologyTab]', err); }
        }
        setUploading(false);
    }, [numPac, orthancOnline]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const selectEstudio = (est: EstudioRadiologico) => {
        setSelectedId(est.id);
        setDicomFile(fileMapRef.current.get(est.id) ?? null);
    };

    // Subir a Orthanc y obtener URL de OHIF
    const handleOpenOhif = useCallback(async (file: File) => {
        setOhifError(null);
        setOhifUploading(true);
        try {
            const url = await uploadDicomToOrthanc(file);
            setOhifUrl(url);
            openInOhif(url);
        } catch (err) {
            setOhifError(err instanceof Error ? err.message : 'Error al conectar con Orthanc');
        } finally {
            setOhifUploading(false);
        }
    }, []);

    const handleDelete = (id: string) => {
        deleteEstudio(id);
        fileMapRef.current.delete(id);
        setEstudios(prev => prev.filter(e => e.id !== id));
        if (selectedId === id) {
            const rem = estudios.filter(e => e.id !== id);
            setSelectedId(rem[0]?.id ?? null);
            setDicomFile(null);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            style={{ height: 'calc(100vh - 120px)', display: 'flex', background: '#0a0c10', borderRadius: 12, overflow: 'hidden', border: '1px solid #1e2535', position: 'relative' }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#0d47a180', border: '2px dashed #3b82f6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: '#93c5fd', fontSize: 16, fontWeight: 700 }}>Suelta el archivo aquí</p>
                </div>
            )}

            {/* ── Panel estudios ── */}
            <div style={{ width: panelOpen ? 200 : 40, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e2535', background: '#0d1018', transition: 'width 0.2s ease', overflow: 'hidden' }}>

                <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid #1e2535', gap: 6 }}>
                    <button onClick={() => setPanelOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex', padding: 2 }}>
                        {panelOpen ? <ChevronLeft style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                    </button>
                    {panelOpen && <>
                        <Layers style={{ width: 12, height: 12, color: '#475569', flexShrink: 0 }} />
                        <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, whiteSpace: 'nowrap' }}>Estudios</span>
                        <button onClick={() => fileInputRef.current?.click()} style={{ background: '#1e40af', border: 'none', borderRadius: 4, padding: '3px 6px', color: '#93c5fd', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Upload style={{ width: 10, height: 10 }} />
                        </button>
                    </>}
                    {!panelOpen && estudios.length > 0 && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', marginLeft: 'auto' }} />
                    )}
                </div>

                {panelOpen && <>
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid #1e2535' }}>
                        <div style={{ position: 'relative' }}>
                            <Search style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, color: '#334155' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
                                style={{ width: '100%', background: '#141820', border: '1px solid #1e2535', borderRadius: 5, padding: '4px 8px 4px 22px', color: '#94a3b8', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filtered.length === 0 && (
                            <div style={{ padding: 16, textAlign: 'center', color: '#334155', fontSize: 11 }}>
                                {estudios.length === 0 ? 'Arrastra un archivo para empezar.' : 'Sin resultados.'}
                            </div>
                        )}
                        {filtered.map(est => (
                            <div key={est.id} onClick={() => selectEstudio(est)} style={{ padding: '8px 10px', cursor: 'pointer', background: selectedId === est.id ? '#1e3a5f' : 'transparent', borderLeft: `3px solid ${selectedId === est.id ? '#3b82f6' : 'transparent'}`, transition: 'background 0.1s' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                                    <span style={{ fontSize: 15, lineHeight: 1 }}>{TIPO_ICON[est.tipo]}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: selectedId === est.id ? '#93c5fd' : '#94a3b8', fontSize: 11, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {est.nombre.replace(/\.[^.]+$/, '')}
                                        </p>
                                        <p style={{ color: '#334155', fontSize: 9, margin: '2px 0 0' }}>{fmt.date(est.fecha)} · {fmt.bytes(est.fileSize)}</p>
                                    </div>
                                    <button onClick={e => { e.stopPropagation(); handleDelete(est.id); }} style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: 2 }}>
                                        <Trash2 style={{ width: 10, height: 10 }} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: 8, borderTop: '1px solid #1e2535' }}>
                        <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: 6, border: '1px dashed #1e3a5f', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#334155', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <Upload style={{ width: 11, height: 11 }} />
                            {uploading ? 'Subiendo…' : 'Importar archivo'}
                        </button>
                    </div>
                </>}
            </div>

            {/* ── Visor principal ── */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {!selected ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#334155', gap: 10 }}>
                        <FileImage style={{ width: 48, height: 48, opacity: 0.3 }} />
                        <p style={{ fontSize: 13, margin: 0 }}>Selecciona un estudio o arrastra un archivo</p>
                        <button onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 20px', background: '#1e40af', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#93c5fd', fontSize: 12, fontWeight: 600 }}>
                            <Upload style={{ width: 12, height: 12, display: 'inline', marginRight: 6 }} /> Importar
                        </button>
                    </div>
                ) : dicomFile ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <Suspense fallback={<LoadingScreen text="Cargando visor DICOM…" />}>
                                <DicomLoader file={dicomFile} />
                            </Suspense>
                        </div>
                        {/* Barra inferior con acceso a OHIF */}
                        <div style={{ flexShrink: 0, borderTop: '1px solid #1e2535', background: '#0d1018', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#334155', fontSize: 10, flex: 1 }}>
                                {orthancOnline === true && '● Orthanc activo'}
                                {orthancOnline === false && '○ Orthanc inactivo — arranca Docker primero'}
                                {orthancOnline === null && '…'}
                            </span>
                            {ohifError && <span style={{ color: '#f87171', fontSize: 10 }}>{ohifError}</span>}
                            <OhifButton
                                online={orthancOnline}
                                loading={ohifUploading}
                                ohifUrl={ohifUrl}
                                onOpen={() => {
                                    if (ohifUrl) { openInOhif(ohifUrl); }
                                    else { handleOpenOhif(dicomFile); }
                                }}
                            />
                        </div>
                    </div>
                ) : displayUrl ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <RadiologiaViewer imageUrl={displayUrl} alt={selected.nombre} brightness={selected.brightness} contrast={selected.contrast} />
                        </div>
                        <div style={{ flexShrink: 0, borderTop: '1px solid #1e2535', background: '#0d1018', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Info style={{ width: 11, height: 11, color: '#334155', flexShrink: 0 }} />
                            <span style={{ color: '#334155', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {selected.nombre} · {selected.doctor} · {fmt.date(selected.fecha)}
                            </span>
                            {selected.rutaOrigen && <PlanmecaLauncher rutaOrigen={selected.rutaOrigen} compact />}
                        </div>
                    </div>
                ) : selected.tipo === 'dicom' ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', padding: 24, textAlign: 'center', gap: 12 }}>
                        <span style={{ fontSize: 48 }}>🔬</span>
                        <p style={{ fontWeight: 700, color: '#94a3b8', fontSize: 13, margin: 0 }}>Estudio DICOM en servidor</p>
                        <p style={{ fontSize: 11, lineHeight: 1.7, maxWidth: 320, margin: 0 }}>
                            Importa el archivo <strong style={{ color: '#60a5fa' }}>.dcm</strong> con el botón de arriba,<br />
                            o usa <strong style={{ color: '#22d3ee' }}>Romexis</strong> para abrirlo directamente.
                        </p>
                        {selected.rutaOrigen && <PlanmecaLauncher rutaOrigen={selected.rutaOrigen} />}
                    </div>
                ) : null}
            </div>

            <input ref={fileInputRef} type="file" accept=".dcm,.dic,.dicom,.jpg,.jpeg,.png,.bmp,.webp" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        </div>
    );
};

// ── Subcomponentes ────────────────────────────────────────────────────────────

const LoadingScreen: React.FC<{ text: string }> = ({ text }) => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#475569', fontSize: 12 }}>
        {text}
    </div>
);

// ── OhifButton ────────────────────────────────────────────────────────────────

interface OhifButtonProps {
    online: boolean | null;
    loading: boolean;
    ohifUrl: string | null;
    onOpen: () => void;
}

const OhifButton: React.FC<OhifButtonProps> = ({ online, loading, ohifUrl, onOpen }) => {
    const disabled = online === false || loading;
    const label = loading ? 'Subiendo…' : ohifUrl ? 'Abrir OHIF' : 'Visor 3D Profesional';
    return (
        <button
            onClick={onOpen}
            disabled={disabled}
            title={online === false ? 'Arranca Docker: docker compose -f docker-compose.ohif.yml up -d' : 'Abrir en OHIF Viewer'}
            style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                background: disabled ? '#1e2535' : '#1e3a5f',
                color: disabled ? '#334155' : '#93c5fd',
                fontSize: 11, fontWeight: 600,
                opacity: disabled ? 0.6 : 1,
            }}
        >
            {loading
                ? <Loader style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} />
                : <ExternalLink style={{ width: 11, height: 11 }} />
            }
            {label}
        </button>
    );
};

const CbctViewerLazy  = React.lazy(() => import('../radiologia/CbctViewer'));
const DicomViewerLazy = React.lazy(() => import('../radiologia/DicomViewer'));

/** Carga el volumen DICOM y elige CbctViewer (multi-frame) o DicomViewer (single) */
const DicomLoader: React.FC<{ file: File }> = ({ file }) => {
    const [volume, setVolume] = React.useState<DicomVolume | null>(null);
    const [error,  setError]  = React.useState<string | null>(null);

    React.useEffect(() => {
        setVolume(null); setError(null);
        loadDicomVolume(file)
            .then(setVolume)
            .catch((e: Error) => setError(e.message));
    }, [file]);

    if (error) return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 12, padding: 20, textAlign: 'center' }}>
            Error DICOM: {error}
        </div>
    );
    if (!volume) return <LoadingScreen text="Procesando archivo DICOM…" />;

    if (volume.numFrames > 1) {
        return (
            <Suspense fallback={<LoadingScreen text="Cargando visor CBCT…" />}>
                <CbctViewerLazy volume={volume} />
            </Suspense>
        );
    }
    return (
        <Suspense fallback={<LoadingScreen text="Cargando visor DICOM…" />}>
            <DicomViewerLazy file={file} />
        </Suspense>
    );
};

export default RadiologyTab;
