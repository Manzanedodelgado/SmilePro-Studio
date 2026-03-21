
import React, { useState, useEffect } from 'react';
import SOAPEditor from '../components/pacientes/SOAPEditor';
import PatientSearchModal from '../components/pacientes/PatientSearchModal';
import Odontograma from '../components/pacientes/Odontograma';
import { getToothImageSrc, shouldMirrorTooth, isToothPNGFlipped } from '../components/pacientes/toothPaths';
import { getOdontograma } from '../services/odontograma.service';
import { getHallazgoById } from '../components/pacientes/hallazgos';
import Periodontograma from '../components/pacientes/Periodontograma';
import Documentos from '../components/pacientes/Documentos';
import Economica from '../components/pacientes/Economica';
import EntradasMedicas from '../components/pacientes/EntradasMedicas';
import QuestionnairePanel from '../components/pacientes/QuestionnairePanel';
import RadiologyTab from '../components/pacientes/RadiologyTab';
import { type SOAPNote, type Paciente, type Area } from '../types';
import {
    Activity, Brain, Camera,
    FileText, CircleDollarSign,
    ShieldCheck, ShieldAlert, Pencil,
    Phone, Calendar, MessageSquare, ArrowLeftRight, ExternalLink, Maximize2,
    Gavel, UserPlus, X, Plus, Save, Pill, Search, ImagePlus, Stethoscope, ChevronLeft, ChevronRight, ScanLine
} from 'lucide-react';
import {
    getPatientPhotos, isGDriveConfigured, createPatientDriveFolder, type PatientPhoto
} from '../services/gdrive.service';
import {
    getMedications, getAllergies, upsertMedication, deleteMedication,
    upsertAllergy, deleteAllergy, isSupabaseConfigured,
    type PatientMedication, type PatientAllergy
} from '../services/supabase.service';
import {
    getSoapNotes, createSoapNote,
} from '../services/soap.service';
import { getPaciente } from '../services/pacientes.service';
import { getDocumentosByPaciente } from '../services/documentos.service';
import { setPacienteActivo } from '../services/paciente-activo';
import { searchVademecum, type Medicamento } from '../data/vademecum';
import { Badge } from '../components/UI';


// Constantes mini-odontograma — datos demo estáticos
const MINI_ECOL: Record<string, string> = {
    normal: '#e2e8f0', caries: '#FF4B68', obturacion: '#3b82f6',
    corona: '#FBFFA3', endodoncia: '#f97316', implante: '#8b5cf6', ausente: '#94a3b8',
};
const MINI_PP: Array<{ k: string; pts: string }> = [
    { k: 'vestibular', pts: '10,4 90,4 76,20 24,20' },
    { k: 'lingual',    pts: '10,96 90,96 76,80 24,80' },
    { k: 'mesial',     pts: '4,10 20,24 20,76 4,90' },
    { k: 'distal',     pts: '96,10 80,24 80,76 96,90' },
    { k: 'oclusal',    pts: '24,20 76,20 80,76 20,76' },
];
const MINI_DEMO: Array<{numero:string;caras:Record<string,string>}> = [
    ...Array.from({length:8},(_,i)=>({numero:`1${8-i}`,caras:{oclusal:'normal',vestibular:'normal',lingual:'normal',mesial:'normal',distal:'normal'}})),
    ...Array.from({length:8},(_,i)=>({numero:`2${i+1}`,caras:{oclusal:'normal',vestibular:'normal',lingual:'normal',mesial:'normal',distal:'normal'}})),
    ...Array.from({length:8},(_,i)=>({numero:`4${8-i}`,caras:{oclusal:'normal',vestibular:'normal',lingual:'normal',mesial:'normal',distal:'normal'}})),
    ...Array.from({length:8},(_,i)=>({numero:`3${i+1}`,caras:{oclusal:'normal',vestibular:'normal',lingual:'normal',mesial:'normal',distal:'normal'}})),
].map((d,i)=>{
    if(i===6)  return {...d,caras:{...d.caras,oclusal:'caries',mesial:'caries'}};
    if(i===10) return {...d,caras:{oclusal:'obturacion',vestibular:'obturacion',lingual:'obturacion',mesial:'obturacion',distal:'obturacion'}};
    if(i===21) return {...d,caras:{oclusal:'endodoncia',vestibular:'endodoncia',lingual:'endodoncia',mesial:'endodoncia',distal:'endodoncia'}};
    if(i===24) return {...d,caras:{oclusal:'ausente',vestibular:'ausente',lingual:'ausente',mesial:'ausente',distal:'ausente'}};
    if(i===0)  return {...d,caras:{oclusal:'corona',vestibular:'corona',lingual:'corona',mesial:'corona',distal:'corona'}};
    return d;
});

interface PacientesProps {
    activeSubArea: string;
    onSubAreaChange: (subArea: string) => void;
    showToast: (message: string) => void;
    requestedNumPac?: string | null;
    onRequestedHandled?: () => void;
    onPatientChange?: (p: Paciente | null) => void;
    onNavigate?: (area: Area, subArea?: string, citaData?: Partial<import('../types').Cita>, waData?: { phone: string; name: string }) => void;
}


const Pacientes: React.FC<PacientesProps> = ({ activeSubArea, onSubAreaChange, showToast, onNavigate, requestedNumPac, onRequestedHandled }) => {
    const [paciente, setPaciente] = useState<Paciente | null>(null);

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchInitialView, setSearchInitialView] = useState<'search' | 'create'>('search');
    const [saraTyped, setSaraTyped] = useState('');
    const saraText = `Paciente con recurrencia en dolor. Alergia al látex activa — asegurar material alternativo en G1. RX control pieza 2.5 recomendado. Considerar revisión periodoncia en próxima visita.`;
    // Cuadrantes state
    const [fotoIdx, setFotoIdx] = useState(0);
    const [fotos, setFotos] = useState<PatientPhoto[]>([]);
    const [loadingFotos, setLoadingFotos] = useState(true);
    const [carouselPaused, setCarouselPaused] = useState(false);
    const [mediaTab, setMediaTab] = useState<'fotos' | 'rx'>('fotos');

    // Resize splits
    const [rowSplit, setRowSplit] = useState(55);       // % altura de la fila superior
    const [topColSplit, setTopColSplit] = useState(50); // % anchura de Odontograma dentro de la fila superior
    const [showEvolutivoModal, setShowEvolutivoModal] = useState(false);
    const [odontogramData, setOdontogramData] = useState(MINI_DEMO);
    const layoutRef = React.useRef<HTMLDivElement>(null);
    const dragRef = React.useRef<{ type: 'row' | 'topCol'; startPos: number; startVal: number; containerSize: number } | null>(null);

    // Alertas + Medicación state
    const [medications, setMedications] = useState<PatientMedication[]>([]);
    const [allergies, setAllergies] = useState<PatientAllergy[]>([]);
    const [alertEditMode, setAlertEditMode] = useState(false);
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    // Documentos pendientes de firma
    const [documentosPendientes, setDocumentosPendientes] = useState(0);
    useEffect(() => {
        if (!paciente?.numPac) { setDocumentosPendientes(0); return; }
        getDocumentosByPaciente(paciente.numPac).then(docs => {
            setDocumentosPendientes(docs.filter(d => d.estado === 'Pendiente').length);
        });
    }, [paciente?.numPac]);

    // Load real odontogram data for mini view
    useEffect(() => {
        if (!paciente?.numPac) return;
        getOdontograma(paciente.numPac).then(datos => {
            if (datos && datos.length > 0) {
                setOdontogramData(datos as typeof MINI_DEMO);
            }
        });
    }, [paciente?.numPac]);
    const [newAllergyText, setNewAllergyText] = useState('');
    const [medQuery, setMedQuery] = useState('');
    const [medSuggestions, setMedSuggestions] = useState<Medicamento[]>([]);


    // Drag-to-resize global mouse handlers
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragRef.current) return;
            const { type, startPos, startVal, containerSize } = dragRef.current;
            const delta = ((type === 'topCol' ? e.clientX : e.clientY) - startPos) / containerSize * 100;
            const val = Math.min(80, Math.max(20, startVal + delta));
            if (type === 'row') setRowSplit(val);
            else setTopColSplit(val);
        };
        const onUp = () => {
            if (!dragRef.current) return;
            dragRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, []);

    const startDrag = (type: 'row' | 'topCol', e: React.MouseEvent) => {
        e.preventDefault();
        if (!layoutRef.current) return;
        const rect = layoutRef.current.getBoundingClientRect();
        dragRef.current = {
            type,
            startPos: type === 'topCol' ? e.clientX : e.clientY,
            startVal: type === 'topCol' ? topColSplit : rowSplit,
            containerSize: type === 'topCol' ? rect.width : rect.height,
        };
        document.body.style.cursor = type === 'topCol' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
    };

    // Carrusel automático cada 4s, se pausa al hacer hover
    useEffect(() => {
        if (fotos.length <= 1 || carouselPaused) return;
        const id = setInterval(() => setFotoIdx(i => (i + 1) % fotos.length), 4000);
        return () => clearInterval(id);
    }, [fotos.length, carouselPaused]);

    // Crear carpeta Drive automáticamente al cargar paciente (idempotente)
    useEffect(() => {
        if (!paciente?.numPac || !paciente?.apellidos) return;
        createPatientDriveFolder(
            paciente.numPac,
            paciente.apellidos,
            paciente.nombre ?? ''
        ).catch(() => {}); // silencioso — si falla no interrumpe
    }, [paciente?.numPac]);

    // Inicializar alergias y medicaciones desde el paciente + Supabase
    useEffect(() => {
        if (!paciente?.numPac) return;
        if (isSupabaseConfigured()) {
            getAllergies(paciente.numPac).then(a => { if (a.length) setAllergies(a); });
            getMedications(paciente.numPac).then(m => { if (m.length) setMedications(m); });
        }
        // Cargar SOAP notes del paciente
        getSoapNotes(paciente.numPac).then(soapNotes => {
            if (soapNotes.length > 0) {
                setPaciente(prev => prev ? { ...prev, historial: soapNotes } : prev);
            }
        });
    }, [paciente?.numPac, paciente?.alergias, paciente?.medicacionActual]);

    // Autocompletado del vademecum
    useEffect(() => {
        setMedSuggestions(searchVademecum(medQuery));
    }, [medQuery]);


    useEffect(() => {
        if (activeSubArea === 'ACTION_SEARCH') { setSearchInitialView('search'); setIsSearchOpen(true); onSubAreaChange('Historia Clínica'); }
        else if (activeSubArea === 'ACTION_NEW') { setSearchInitialView('create'); setIsSearchOpen(true); onSubAreaChange('Historia Clínica'); }
    }, [activeSubArea, onSubAreaChange]);

    // Auto-cargar paciente cuando llega desde otro módulo (ej: Agenda → Ver ficha)
    useEffect(() => {
        if (!requestedNumPac) return;
        getPaciente(requestedNumPac).then(p => {
            if (p) {
                setPaciente(p);
                setPacienteActivo({ nombre: p.nombre, apellidos: p.apellidos, dni: p.dni, telefono: p.telefono, fechaNacimiento: p.fechaNacimiento });
                onSubAreaChange('Historia Clínica');
                showToast(`Abriendo ficha de ${p.nombre} ${p.apellidos}`);
            }
            onRequestedHandled?.();
        }).catch(() => onRequestedHandled?.());
    }, [requestedNumPac]);

    // SARA IA typing effect
    useEffect(() => {
        setSaraTyped('');
        let i = 0;
        const timer = setInterval(() => {
            setSaraTyped(saraText.slice(0, i + 1));
            i++;
            if (i >= saraText.length) clearInterval(timer);
        }, 18);
        return () => clearInterval(timer);
    }, [paciente?.numPac]);

    const handleSelectPatient = (p: Paciente) => {
        setPaciente(p);
        setPacienteActivo({ nombre: p.nombre, apellidos: p.apellidos, dni: p.dni, telefono: p.telefono, fechaNacimiento: p.fechaNacimiento });
        showToast(`Cargando ficha de ${p.nombre}`);
    };

    const handleSaveNote = async (noteData: {
        subjetivo: string; objetivo: string; analisis: string; plan: string;
        eva: number; fecha?: string; especialidad?: string;
        tratamiento_id?: string | number; tratamiento_nombre?: string;
        pieza?: number; cuadrante?: number; arcada?: string;
    }) => {
        const fechaDisplay = noteData.fecha
            ? new Date(noteData.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
            : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const newNote: SOAPNote = {
            id: Date.now().toString(),
            fecha: fechaDisplay,
            doctor: 'Elena Rubio',
            especialidad: noteData.especialidad || 'General',
            subjetivo: noteData.subjetivo || '',
            objetivo: noteData.objetivo || '',
            analisis: noteData.analisis || '',
            plan: noteData.plan || '',
            firmada: true,
            eva: noteData.eva || 0,
            timestamp: new Date().toISOString().replace('T', ' ').split('.')[0],
            alertasDetectadas: [],
            tratamiento_id: noteData.tratamiento_id,
            tratamiento_nombre: noteData.tratamiento_nombre,
            pieza: noteData.pieza,
            cuadrante: noteData.cuadrante,
            arcada: noteData.arcada,
        };
        if (paciente!.numPac) {
            const savedNote = await createSoapNote(paciente!.numPac, newNote);
            const finalNote = savedNote ?? newNote;
            setPaciente(prev => prev ? { ...prev, historial: [finalNote, ...prev.historial] } : prev);
            showToast('Evolutivo registrado legalmente');
        }
    };


    // ── Handlers alergias ──────────────────────────────────────
    const handleAddAllergy = async () => {
        const nombre = newAllergyText.trim();
        if (!paciente?.numPac) return;
        const newA: PatientAllergy = {
            id: crypto.randomUUID(), paciente_id: paciente.numPac, nombre, severidad: 'moderada'
        };
        setAllergies(prev => [...prev, newA]);
        setNewAllergyText('');
        if (isSupabaseConfigured()) await upsertAllergy({ paciente_id: paciente!.numPac, nombre, severidad: 'moderada' });
        showToast(`Alergia "${nombre}" añadida`);
    };

    const handleRemoveAllergy = async (id: string) => {
        setAllergies(prev => prev.filter(a => a.id !== id));
        if (isSupabaseConfigured()) await deleteAllergy(id);
        showToast('Alergia eliminada');
    };

    // ── Handlers medicación ────────────────────────────────────
    const handleAddMedication = async (med: Medicamento) => {
        if (!paciente?.numPac) return;
        const newMed: PatientMedication = {
            id: crypto.randomUUID(), paciente_id: paciente.numPac,
            nombre: med.nombre, importante: med.importante,
            categoria: med.categoria, nota: med.nota,
        };
        setMedications(prev => [...prev, newMed]);
        setMedQuery('');
        setMedSuggestions([]);
        if (isSupabaseConfigured()) await upsertMedication(newMed);
        showToast(`${med.nombre} añadido al perfil`);
    };

    const handleRemoveMedication = async (id: string) => {
        setMedications(prev => prev.filter(m => m.id !== id));
        if (isSupabaseConfigured()) await deleteMedication(id);
        showToast('Medicación eliminada');
    };

    const handleToggleMedImportante = async (id: string) => {
        let updated: PatientMedication | undefined;
        setMedications(prev => prev.map(m => {
            if (m.id !== id) return m;
            updated = { ...m, importante: !m.importante };
            return updated;
        }));
        if (updated && isSupabaseConfigured()) await upsertMedication(updated);
    };


    const handleDocumentSigned = () => {
        setPaciente(prev => prev ? { ...prev, consentimientosFirmados: true } as Paciente : prev);
        if (paciente?.numPac) {
            getDocumentosByPaciente(paciente.numPac).then(docs => {
                setDocumentosPendientes(docs.filter(d => d.estado === 'Pendiente').length);
            });
        }
        showToast("Consentimientos OK");
    };

    // Cargar panorámicas Romexis y fotos GDrive al montar
    useEffect(() => {
        if (!paciente?.numPac) return;

        setLoadingFotos(true);
        getPatientPhotos(paciente.numPac, paciente.apellidos ?? '', paciente.nombre ?? '')
            .then(f => { setFotos(f); setFotoIdx(0); })
            .finally(() => setLoadingFotos(false));
    }, [paciente?.numPac]);

    // Edad calculada
    const edad = paciente ? new Date().getFullYear() - new Date(paciente.fechaNacimiento).getFullYear() : 0;



    const renderHistorial = () => {
        if (!paciente) return null;
        return (
            <div ref={layoutRef} className="animate-tab-enter flex-1 min-h-0 overflow-hidden"
                style={{ display: 'grid', gridTemplateColumns: '60% 40%', gridTemplateRows: '40% 5% 55%', gap: 6 }}>

                {/* ── ODONTOGRAMA — row1 col1 ─────────────────────────────────── */}
                <div className="min-h-0 min-w-0 overflow-hidden" style={{ gridRow: 1, gridColumn: 1 }}>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full min-h-0">
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 flex-shrink-0">
                                <div className="p-1.5 bg-blue-700 rounded-lg flex-shrink-0">
                                    <Stethoscope className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Odontograma</span>
                                <div className="ml-auto flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                    <span className="text-[10px] font-black text-blue-700">{odontogramData.filter(d => Object.values(d.caras).some(c => c !== 'normal')).length}</span>
                                    <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Tratadas</span>
                                </div>
                            </div>
                            <div className="flex-1 flex overflow-auto relative z-10">
                                {/* Leyenda vertical */}
                                <div className="flex flex-col gap-1.5 px-2 py-2 border-r border-slate-200 flex-shrink-0 justify-center">
                                    {Object.entries(MINI_ECOL).filter(([k]) => k !== 'normal').map(([k, c]) => (
                                        <div key={k} className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: c, boxShadow: `0 0 6px ${c}80` }} />
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{k}</span>
                                        </div>
                                    ))}
                                </div>
                                {/* Dientes */}
                                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-3">
                                    {/* Upper row */}
                                    <div className="flex gap-1.5 items-end">
                                        <div className="flex gap-px">
                                            {odontogramData.slice(0, 8).map(d => {
                                                const hallazgoColors = Object.values(d.caras).filter(c => c !== 'normal').map(c => getHallazgoById(c)?.color).filter(Boolean);
                                                const mainColor = hallazgoColors[0] as string | undefined;
                                                const isAusente = Object.values(d.caras).every(c => c === 'ausente');
                                                const pngFlipped = isToothPNGFlipped(d.numero);
                                                const mirrored = shouldMirrorTooth(d.numero);
                                                return (
                                                    <div key={d.numero} className="flex flex-col items-center gap-0.5">
                                                        <span className="text-[7px] font-bold text-slate-500 tabular-nums">{d.numero}</span>
                                                        <div className="relative">
                                                            <img src={getToothImageSrc(d.numero)} alt={d.numero}
                                                                className={`h-24 w-auto object-contain ${isAusente ? 'opacity-20 grayscale' : ''}`}
                                                                style={{
                                                                    transform: [true !== pngFlipped ? '' : 'scaleY(-1)', mirrored ? 'scaleX(-1)' : ''].filter(Boolean).join(' ') || undefined,
                                                                    filter: mainColor ? `drop-shadow(0 0 3px ${mainColor})` : undefined,
                                                                }} draggable={false} />
                                                            {mainColor && <div className="absolute inset-0 rounded-md mix-blend-multiply pointer-events-none" style={{ backgroundColor: mainColor, opacity: 0.3 }} />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="w-px h-10 bg-slate-300 flex-shrink-0" />
                                        <div className="flex gap-px">
                                            {odontogramData.slice(8, 16).map(d => {
                                                const hallazgoColors = Object.values(d.caras).filter(c => c !== 'normal').map(c => getHallazgoById(c)?.color).filter(Boolean);
                                                const mainColor = hallazgoColors[0] as string | undefined;
                                                const isAusente = Object.values(d.caras).every(c => c === 'ausente');
                                                const pngFlipped = isToothPNGFlipped(d.numero);
                                                const mirrored = shouldMirrorTooth(d.numero);
                                                return (
                                                    <div key={d.numero} className="flex flex-col items-center gap-0.5">
                                                        <span className="text-[7px] font-bold text-slate-500 tabular-nums">{d.numero}</span>
                                                        <div className="relative">
                                                            <img src={getToothImageSrc(d.numero)} alt={d.numero}
                                                                className={`h-24 w-auto object-contain ${isAusente ? 'opacity-20 grayscale' : ''}`}
                                                                style={{
                                                                    transform: [true !== pngFlipped ? '' : 'scaleY(-1)', mirrored ? 'scaleX(-1)' : ''].filter(Boolean).join(' ') || undefined,
                                                                    filter: mainColor ? `drop-shadow(0 0 3px ${mainColor})` : undefined,
                                                                }} draggable={false} />
                                                            {mainColor && <div className="absolute inset-0 rounded-md mix-blend-multiply pointer-events-none" style={{ backgroundColor: mainColor, opacity: 0.3 }} />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="w-[85%] border-t border-dashed border-slate-200" />
                                    {/* Lower row */}
                                    <div className="flex gap-1.5 items-start">
                                        <div className="flex gap-px">
                                            {odontogramData.slice(16, 24).map(d => {
                                                const hallazgoColors = Object.values(d.caras).filter(c => c !== 'normal').map(c => getHallazgoById(c)?.color).filter(Boolean);
                                                const mainColor = hallazgoColors[0] as string | undefined;
                                                const isAusente = Object.values(d.caras).every(c => c === 'ausente');
                                                const pngFlipped = isToothPNGFlipped(d.numero);
                                                const mirrored = shouldMirrorTooth(d.numero);
                                                return (
                                                    <div key={d.numero} className="flex flex-col items-center gap-0.5">
                                                        <div className="relative">
                                                            <img src={getToothImageSrc(d.numero)} alt={d.numero}
                                                                className={`h-24 w-auto object-contain ${isAusente ? 'opacity-20 grayscale' : ''}`}
                                                                style={{
                                                                    transform: [false !== pngFlipped ? '' : 'scaleY(-1)', mirrored ? 'scaleX(-1)' : ''].filter(Boolean).join(' ') || undefined,
                                                                    filter: mainColor ? `drop-shadow(0 0 3px ${mainColor})` : undefined,
                                                                }} draggable={false} />
                                                            {mainColor && <div className="absolute inset-0 rounded-md mix-blend-multiply pointer-events-none" style={{ backgroundColor: mainColor, opacity: 0.3 }} />}
                                                        </div>
                                                        <span className="text-[7px] font-bold text-slate-500 tabular-nums">{d.numero}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="w-px h-10 bg-slate-300 flex-shrink-0" />
                                        <div className="flex gap-px">
                                            {odontogramData.slice(24, 32).map(d => {
                                                const hallazgoColors = Object.values(d.caras).filter(c => c !== 'normal').map(c => getHallazgoById(c)?.color).filter(Boolean);
                                                const mainColor = hallazgoColors[0] as string | undefined;
                                                const isAusente = Object.values(d.caras).every(c => c === 'ausente');
                                                const pngFlipped = isToothPNGFlipped(d.numero);
                                                const mirrored = shouldMirrorTooth(d.numero);
                                                return (
                                                    <div key={d.numero} className="flex flex-col items-center gap-0.5">
                                                        <div className="relative">
                                                            <img src={getToothImageSrc(d.numero)} alt={d.numero}
                                                                className={`h-24 w-auto object-contain ${isAusente ? 'opacity-20 grayscale' : ''}`}
                                                                style={{
                                                                    transform: [false !== pngFlipped ? '' : 'scaleY(-1)', mirrored ? 'scaleX(-1)' : ''].filter(Boolean).join(' ') || undefined,
                                                                    filter: mainColor ? `drop-shadow(0 0 3px ${mainColor})` : undefined,
                                                                }} draggable={false} />
                                                            {mainColor && <div className="absolute inset-0 rounded-md mix-blend-multiply pointer-events-none" style={{ backgroundColor: mainColor, opacity: 0.3 }} />}
                                                        </div>
                                                        <span className="text-[7px] font-bold text-slate-500 tabular-nums">{d.numero}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>

                {/* ── RX — row1 col2 ──────────────────────────────────────────── */}
                <div className="min-h-0 min-w-0 overflow-hidden" style={{ gridRow: 1, gridColumn: 2 }}>
                        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-full min-h-0">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-700/50 flex-shrink-0">
                                <ScanLine className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Última Ortopanto</span>
                            </div>
                            <div className="flex-1 min-h-0 flex">
                                {/* Main ortopanto image */}
                                <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center cursor-zoom-in"
                                    onClick={() => setZoomImage('/rx-demo-panoramica.png')}>
                                    <img
                                        src="/rx-demo-panoramica.png"
                                        alt="Ortopantomografía"
                                        className="absolute inset-0 w-full h-full object-cover"
                                        style={{ filter: 'contrast(1.1) brightness(0.95)' }}
                                    />
                                </div>
                                {/* Thumbnails sidebar */}
                                <div className="w-16 flex-shrink-0 border-l border-slate-700/50 flex flex-col gap-1 p-1 overflow-y-auto bg-slate-900/50">
                                    {[
                                        { id: 'pano', label: 'Panorámica', src: '/rx-demo-panoramica.png' },
                                    ].map((rx, i) => (
                                        <div key={rx.id}
                                            className={`relative rounded overflow-hidden cursor-pointer border ${i === 0 ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-slate-700 hover:border-slate-500'}`}>
                                            <img src={rx.src} alt={rx.label}
                                                className="w-full aspect-[4/3] object-cover"
                                                style={{ filter: 'contrast(1.1) brightness(0.8)' }} />
                                            <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[6px] text-slate-400 font-bold text-center py-0.5 truncate">{rx.label}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-center aspect-[4/3] rounded border border-dashed border-slate-700 text-slate-600 hover:text-slate-400 hover:border-slate-500 cursor-pointer transition-colors">
                                        <span className="text-[8px] font-bold uppercase tracking-wider">+ RX</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>

                {/* ── NUEVO EVOLUTIVO — row2 col1 ───────────────────────────── */}
                <div className="flex items-stretch" style={{ gridRow: 2, gridColumn: 1 }}>
                    <button
                        onClick={() => setShowEvolutivoModal(true)}
                        className="w-full flex items-center justify-center gap-2.5 py-3 bg-gradient-to-r from-[#051650] to-blue-800 text-white text-[12px] font-black uppercase tracking-widest rounded-xl shadow-md shadow-blue-900/30 hover:from-[#051650] hover:to-blue-700 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" /> Nuevo Evolutivo
                    </button>
                </div>

                {/* ── HISTORIA MÉDICA — row3 col1 ─────────────────────────────── */}
                <div className="min-h-0 min-w-0 overflow-hidden" style={{ gridRow: 3, gridColumn: 1 }}>
                    <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden h-full min-h-0">
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-sm">
                                    <Activity className="w-3 h-3 text-white" />
                                </div>
                                <h3 className="text-[11px] font-black text-slate-800 tracking-tight">Historia Médica</h3>
                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">{paciente.historial.length} entradas</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
                            <EntradasMedicas idPac={paciente.idPac ?? (paciente.numPac ? parseInt(paciente.numPac, 10) : 0)} hideHeader />
                        </div>
                    </div>
                </div>

                {/* ── FOTOS — row2+row3 col2 (spans 60%) ──────────────────────── */}
                <div className="min-h-0 min-w-0 overflow-hidden" style={{ gridRow: '2 / 4', gridColumn: 2 }}>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full min-h-0">
                            <div className="relative flex items-center gap-1 px-3 py-1.5 border-b border-slate-100/60 flex-shrink-0 z-10">
                                <Camera className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fotos</span>
                                {fotos.length > 0 && <span className="text-[9px] font-black text-[#051650] bg-blue-50 border border-blue-100 px-1.5 rounded-full">{fotos.length}</span>}
                            </div>
                            <div className="flex-1 min-h-0 flex">
                                {/* Main photo */}
                                <div className="flex-1 min-h-0 relative overflow-hidden cursor-zoom-in group bg-slate-900"
                                    onClick={() => fotos.length > 0 && setZoomImage(fotos[fotoIdx]?.url)}
                                    onMouseEnter={() => setCarouselPaused(true)}
                                    onMouseLeave={() => setCarouselPaused(false)}>
                                    {fotos.length > 1 && (
                                        <>
                                            <button onClick={e => { e.stopPropagation(); setFotoIdx(i => (i - 1 + fotos.length) % fotos.length); }}
                                                className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ChevronLeft className="w-3 h-3" />
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); setFotoIdx(i => (i + 1) % fotos.length); }}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </>
                                    )}
                                    {loadingFotos
                                        ? <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                            <span className="relative w-6 h-6"><span className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></span></span>
                                          </div>
                                        : fotos.length === 0
                                            ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
                                                <ImagePlus className="w-6 h-6 text-slate-500 mb-1" />
                                                <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Sin fotos</span>
                                              </div>
                                            : <img key={fotoIdx} src={fotos[fotoIdx]?.url} className="absolute inset-0 w-full h-full object-contain" alt={fotos[fotoIdx]?.label} />
                                    }
                                </div>
                                {/* Thumbnails sidebar */}
                                <div className="w-16 flex-shrink-0 border-l border-slate-200 flex flex-col gap-1 p-1 overflow-y-auto bg-slate-50">
                                    {fotos.map((f, i) => (
                                        <button key={f.id} onClick={() => { setFotoIdx(i); setCarouselPaused(true); }}
                                            className={`relative flex-shrink-0 rounded overflow-hidden border transition-all ${fotoIdx === i ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-slate-200 hover:border-slate-400 opacity-60 hover:opacity-100'}`}>
                                            <img src={f.thumbnail ?? f.url} className="w-full aspect-[4/3] object-cover" alt={f.label} />
                                        </button>
                                    ))}
                                    <label className="flex-shrink-0 flex items-center justify-center aspect-[4/3] rounded border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 cursor-pointer transition-colors">
                                        <Camera className="w-3 h-3" />
                                        <input type="file" accept="image/*" className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file || !paciente?.numPac) return;
                                                showToast("Subiendo foto...");
                                                const { uploadPatientPhoto } = await import("../services/gdrive.service");
                                                const ok = await uploadPatientPhoto(paciente.numPac, file);
                                                showToast(ok ? "✨ Foto subida" : "⚠️ Error al subir");
                                                e.target.value = "";
                                            }} />
                                    </label>
                                </div>
                            </div>
                        </div>
                </div>


                {/* ── MODAL: SOAP Editor ─────────────────────────────────────────── */}
                {showEvolutivoModal && (
                    <div className="fixed inset-0 z-[9000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
                        onClick={(e) => { if (e.target === e.currentTarget) setShowEvolutivoModal(false); }}>
                        <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl">
                            <SOAPEditor
                                onSave={(noteData) => { handleSaveNote(noteData); setShowEvolutivoModal(false); }}
                                alergiasPaciente={paciente!.alergias}
                                numPac={paciente!.numPac ?? undefined}
                                onCancel={() => setShowEvolutivoModal(false)}
                                onCitar={(citaData) => {
                                    setShowEvolutivoModal(false);
                                    onNavigate?.('Agenda', undefined, {
                                        tratamiento: citaData.tratamiento,
                                        pacienteNumPac: citaData.pacienteNumPac,
                                        nombrePaciente: `${paciente!.nombre} ${paciente!.apellidos}`,
                                        duracionMinutos: citaData.duracionMinutos ?? 30,
                                    } as any);
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    };




    const renderContent = () => {
        switch (activeSubArea) {
            case 'Odontograma 3D':
            case 'Odontograma': return <Odontograma onSuggestionUpdate={() => { }} numPac={paciente?.numPac} />;
            case 'Sondaje Periodontal':
            case 'Periodoncia': return <Periodontograma numPac={paciente?.numPac} />;
            case 'Cuenta Corriente':
            case 'Económica':
            case 'Presupuestos': return <Economica
                numPac={paciente?.numPac ?? ''}
                idPac={paciente?.idPac}
                pacienteNombre={paciente ? `${paciente.nombre} ${paciente.apellidos}`.trim() : ''}
                pacienteTelefono={paciente?.telefono ?? ''}
                showToast={showToast}
            />;
            case 'Documentos y Consentimientos':
            case 'Documentos': return <Documentos numPac={paciente?.numPac ?? ''} nombrePaciente={paciente ? `${paciente.nombre} ${paciente.apellidos}` : undefined} telefono={paciente?.telefono} onDocumentSigned={handleDocumentSigned} />;
            case 'Anamnesis': return paciente ? <QuestionnairePanel paciente={paciente} onUpdated={(p) => setPaciente(p)} /> : null;
            case 'Radiología': return <RadiologyTab numPac={paciente?.numPac} />;
            case 'Historia Clínica':
            case 'Historial Clínico':
            default: return renderHistorial();
        }
    };

    // ── Empty state: no patient selected yet (PREMIUM REDESIGN) ─────────────────────────────────
    if (!paciente) {
        return (
            <>
                <div className="flex-1 flex flex-col items-center justify-center gap-8 min-h-[65vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-400 blur-3xl opacity-20 rounded-full"></div>
                        <div className="relative w-24 h-24 rounded-[32px] bg-gradient-to-br from-white to-slate-50 border border-slate-200/60 shadow-xl flex items-center justify-center transform hover:-translate-y-1 transition-transform duration-500 cursor-default">
                            <UserPlus className="w-10 h-10 text-[#051650]/60 drop-shadow-sm" />
                        </div>
                    </div>
                    <div className="text-center max-w-sm">
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Buscar Paciente</h2>
                        <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                            Encuentra a un paciente por nombre, apellidos, Nº de historia o teléfono para acceder a su ficha clínica integral.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 mt-2">
                        <button
                            onClick={() => { setSearchInitialView('search'); setIsSearchOpen(true); }}
                            className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-[#051650] to-blue-900 text-white rounded-2xl text-[13px] font-bold tracking-wide hover:shadow-lg hover:shadow-blue-900/20 hover:-translate-y-0.5 transition-all duration-300"
                        >
                            <Search className="w-4 h-4" /> Centro de Búsqueda
                        </button>
                        <button
                            onClick={() => { setSearchInitialView('create'); setIsSearchOpen(true); }}
                            className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[13px] font-bold tracking-wide hover:bg-slate-50 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                        >
                            <UserPlus className="w-4 h-4 text-slate-400" /> Nuevo Ingreso
                        </button>
                    </div>
                </div>
                <PatientSearchModal
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                    onSelect={(p) => { setPaciente(p); setIsSearchOpen(false); }}
                    initialView={searchInitialView}
                />
            </>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden min-h-0">

            {/* ── CABECERA PREMIUM ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* ── PANEL DE SEGURIDAD CLÍNICA — editable ───────────────── */}
                {(() => {
                    const medsImportantes = medications.filter(m => m.importante);
                    const hasAlerts = allergies.length > 0 || medsImportantes.length > 0;
                    return (
                        <div className="relative border-b border-slate-100">
                            {/* Franja roja premium si hay alertas */}
                            {hasAlerts && (
                                <div className={`bg-gradient-to-r from-rose-500 to-red-600 px-5 py-2.5 flex items-center gap-3 shadow-inner ${alertEditMode ? 'rounded-t-2xl' : ''}`}>
                                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                                        <ShieldAlert className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                                        {allergies.length > 0 && (
                                            <span className="text-[11px] font-black text-white tracking-widest flex items-center gap-1.5 drop-shadow-sm">
                                                <span className="w-1 h-1 rounded-full bg-white opacity-60"></span>
                                                ALERGIAS: {allergies.map(a => a.nombre).join(' · ')}
                                            </span>
                                        )}
                                        {medsImportantes.length > 0 && (
                                            <span className="text-[11px] font-black text-rose-100 tracking-widest flex items-center gap-1.5 drop-shadow-sm">
                                                <Pill className="w-3.5 h-3.5 opacity-80" />
                                                {medsImportantes.map(m => m.nombre).join(' · ')}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setAlertEditMode(v => !v)}
                                        className="flex items-center gap-1.5 text-[10px] font-black text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-all duration-300 flex-shrink-0 active:scale-95"
                                    >
                                        <Pencil className="w-3 h-3" /> {alertEditMode ? 'CERRAR' : 'EDITAR'}
                                    </button>
                                </div>
                            )}


                            {/* Panel de edición expandible */}
                            {alertEditMode && (
                                <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 space-y-3 relative">
                                    <button
                                        onClick={() => setAlertEditMode(false)}
                                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white border border-rose-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all z-10"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>

                                    {/* Sección alergias */}
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-red-700 mb-1.5 flex items-center gap-1">
                                            <ShieldAlert className="w-3 h-3" /> Alergias activas
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {allergies.map(a => (
                                                <span key={a.id} className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
                                                    {a.nombre}
                                                    <button onClick={() => handleRemoveAllergy(a.id)} className="text-red-400 hover:text-red-700 transition-colors">
                                                        <X className="w-2.5 h-2.5" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newAllergyText}
                                                onChange={e => setNewAllergyText(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddAllergy()}
                                                placeholder="Nueva alergia (Enter para añadir)"
                                                className="flex-1 text-xs px-3 py-1.5 border border-red-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
                                            />
                                            <button onClick={handleAddAllergy} className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 transition-all">
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sección medicación */}
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1.5 flex items-center gap-1">
                                            <Pill className="w-3 h-3" /> Medicación del paciente
                                        </p>

                                        {/* Lista de medicaciones existentes */}
                                        {medications.length > 0 && (
                                            <div className="mb-2 space-y-1">
                                                {medications.map(m => (
                                                    <div key={m.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${m.importante ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
                                                        }`}>
                                                        <button
                                                            onClick={() => handleToggleMedImportante(m.id)}
                                                            title={m.importante ? 'Marcar como no importante' : 'Marcar como importante (aparecerá en franja roja)'}
                                                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${m.importante ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-300'
                                                                }`}
                                                        >
                                                            {m.importante && <ShieldAlert className="w-2.5 h-2.5" />}
                                                        </button>
                                                        <span className={`flex-1 font-semibold ${m.importante ? 'text-rose-700' : 'text-slate-700'}`}>{m.nombre}</span>
                                                        {m.categoria && <span className="text-[9px] text-slate-400">{m.categoria}</span>}
                                                        {m.nota && <span className="text-[9px] text-amber-600 italic max-w-[160px] truncate">{m.nota}</span>}
                                                        <button onClick={() => handleRemoveMedication(m.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Buscador vademecum */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={medQuery}
                                                onChange={e => setMedQuery(e.target.value)}
                                                placeholder="🔍 Buscar en el vademecum..."
                                                className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                            />
                                            {medSuggestions.length > 0 && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                                                    {medSuggestions.map(med => (
                                                        <button
                                                            key={med.nombre}
                                                            onClick={() => handleAddMedication(med)}
                                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {med.importante && <ShieldAlert className="w-3 h-3 text-red-500 flex-shrink-0" />}
                                                                <span className="text-xs font-bold text-slate-800 flex-1">{med.nombre}</span>
                                                                <span className="text-[9px] text-slate-400">{med.categoria}</span>
                                                            </div>
                                                            {med.nota && <p className="text-[9px] text-amber-600 italic mt-0.5">{med.nota}</p>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-1">☑ El checkbox rojo indica que la medicación es importante y aparecerá en la franja de alertas.</p>
                                    </div>

                                    {/* Guardar / Cerrar */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setAlertEditMode(false)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all shadow-sm active:scale-95"
                                        >
                                            <Save className="w-3.5 h-3.5" /> Guardar Panel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
                <div className="px-2 py-1 flex items-center gap-3 bg-gradient-to-r from-white to-slate-50/50">
                    {/* NumPac — pulsa si hay documentos pendientes de firma */}
                    <div
                        className="relative flex-shrink-0 w-20 rounded-lg bg-gradient-to-br from-[#051650] to-blue-800 text-white flex items-center justify-center shadow-sm self-stretch"
                        title={documentosPendientes > 0 ? `${documentosPendientes} documento${documentosPendientes > 1 ? 's' : ''} pendiente${documentosPendientes > 1 ? 's' : ''} de firma` : undefined}
                    >
                        <span className={`text-[22px] font-black tracking-tight whitespace-nowrap ${documentosPendientes > 0 ? 'animate-[pulse_0.7s_ease-in-out_infinite] drop-shadow-[0_0_10px_rgba(255,255,255,1)]' : ''}`}>
                            {paciente.numPac}
                        </span>
                        {documentosPendientes > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-amber-400 text-[#051650] text-[10px] font-black rounded-full flex items-center justify-center shadow leading-none">
                                {documentosPendientes}
                            </span>
                        )}
                    </div>

                    {/* Nombre + Datos */}
                    <div className="flex items-center gap-3">
                        <span className="text-[18px] font-black text-slate-900 tracking-tight whitespace-nowrap leading-tight">
                            {paciente.nombre} {paciente.apellidos}
                        </span>
                        <div className="w-px h-4 bg-slate-200 flex-shrink-0" />
                        <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap flex items-center gap-1"><FileText className="w-3 h-3" />{paciente.dni}</span>
                        <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap flex items-center gap-1"><Phone className="w-3 h-3" />{paciente.telefono}</span>
                        <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{edad} años</span>
                    </div>

                    {paciente.deuda && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-md tracking-wider flex-shrink-0">
                            <CircleDollarSign className="w-3 h-3" /> DEUDA
                        </span>
                    )}

                    {/* Acciones — empujadas al final */}
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => onNavigate?.('Whatsapp', undefined, undefined, { phone: paciente.telefono ?? '', name: `${paciente.nombre} ${paciente.apellidos}`.trim() })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 text-[#075E54] border border-[#25D366]/30 rounded-lg text-[10px] font-extrabold uppercase tracking-widest hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-all duration-200 active:scale-95"
                        >
                            <MessageSquare className="w-3.5 h-3.5" /> Chat
                        </button>
                        <button
                            onClick={() => onNavigate?.('Agenda', undefined, { pacienteNombre: `${paciente.nombre} ${paciente.apellidos}`, pacienteTelefono: paciente.telefono ?? '', pacienteNumPac: paciente.numPac ?? '' } as any)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-extrabold uppercase tracking-widest hover:bg-slate-200 transition-all duration-200 active:scale-95"
                        >
                            <Calendar className="w-3.5 h-3.5" /> Cita
                        </button>
                        <button
                            onClick={() => { setIsSearchOpen(true); setSearchInitialView('search'); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#051650] text-white rounded-lg text-[10px] font-extrabold uppercase tracking-widest hover:bg-blue-900 transition-all duration-200 active:scale-95"
                        >
                            <ArrowLeftRight className="w-3.5 h-3.5" /> Cambiar
                        </button>
                    </div>
                </div>

                {/* ── SARA — franja pestaña dentro de la cabecera ── */}
                <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-950 via-indigo-950 to-blue-950 border-t border-blue-900/30">
                    <Brain className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
                    <p className="flex-1 text-[10px] text-blue-100/80 italic truncate">
                        "{saraTyped.slice(0, 120)}{saraTyped.length > 120 ? '…' : ''}"
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">S.A.R.A.</span>
                    </div>
                </div>
            </div>

            {/* ── CONTENIDO CON TRANSICIÓN ANIMADA ───────────────────── */}
            <div
                key={activeSubArea}
                className="animate-tab-enter flex-1 min-h-0 flex flex-col overflow-hidden"
            >
                {renderContent()}
            </div>

            {/* ── MODAL DE ZOOM MEJORADO ────────────────────────────────── */}
            {zoomImage && (
                <div
                    className="fixed inset-0 z-[9999] bg-slate-900/98 flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300 backdrop-blur-md"
                    onClick={() => setZoomImage(null)}
                >
                    {/* Botones de acción arriba */}
                    <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
                        <button
                            title="Abrir en nueva ventana"
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all group active:scale-95 flex items-center gap-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(zoomImage, '_blank', 'noopener,noreferrer');
                            }}
                        >
                            <ExternalLink className="w-5 h-5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Nueva Ventana</span>
                        </button>
                        <button
                            title="Cerrar"
                            className="p-3 bg-rose-500/80 hover:bg-rose-600 rounded-full text-white transition-all group active:scale-95"
                            onClick={(e) => { e.stopPropagation(); setZoomImage(null); }}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div
                        className="relative w-full h-full max-w-[98vw] max-h-[96vh] flex items-center justify-center animate-in zoom-in duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={zoomImage}
                            className="max-w-full max-h-full rounded-lg shadow-2xl border border-white/5 object-contain selection:bg-none"
                            alt="Zoom"
                        />
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                        <p className="text-[10px] text-white/60 font-medium tracking-widest uppercase flex items-center gap-2">
                            <Maximize2 className="w-3 h-3" /> Click fuera para cerrar o usa el botón superior
                        </p>
                    </div>
                </div>
            )}

            <PatientSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelect={handleSelectPatient}
                initialView={searchInitialView}
            />
        </div>
    );
};

export default Pacientes;
