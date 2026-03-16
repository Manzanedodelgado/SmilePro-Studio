
import React, { useState, useEffect } from 'react';
import SOAPEditor from '../components/pacientes/SOAPEditor';
import PatientSearchModal from '../components/pacientes/PatientSearchModal';
import Odontograma from '../components/pacientes/Odontograma';
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
    Gavel, UserPlus, X, Plus, Save, Pill, Search
} from 'lucide-react';
import {
    getPatientPanoramicas, isRomexisConfigured, type RomexisPanoramica
} from '../services/romexis.service';
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
import { searchVademecum, type Medicamento } from '../data/vademecum';
import { Badge } from '../components/UI';

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
    const [panoramicaIdx, setPanoramicaIdx] = useState(0);
    const [fotoIdx, setFotoIdx] = useState(0);
    const [panoramicas, setPanoramicas] = useState<RomexisPanoramica[]>([]);
    const [fotos, setFotos] = useState<PatientPhoto[]>([]);
    const [loadingRX, setLoadingRX] = useState(true);
    const [loadingFotos, setLoadingFotos] = useState(true);

    // Alertas + Medicación state
    const [medications, setMedications] = useState<PatientMedication[]>([]);
    const [allergies, setAllergies] = useState<PatientAllergy[]>([]);
    const [alertEditMode, setAlertEditMode] = useState(false);
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [newAllergyText, setNewAllergyText] = useState('');
    const [medQuery, setMedQuery] = useState('');
    const [medSuggestions, setMedSuggestions] = useState<Medicamento[]>([]);

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

    const handleSelectPatient = (p: Paciente) => { setPaciente(p); showToast(`Cargando ficha de ${p.nombre}`); };

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
        showToast("Consentimientos OK");
    };

    // Cargar panorámicas Romexis y fotos GDrive al montar
    useEffect(() => {
        if (!paciente?.numPac) return;

        setLoadingRX(true);
        getPatientPanoramicas(paciente.numPac)
            .then(p => { setPanoramicas(p); setPanoramicaIdx(0); })
            .finally(() => setLoadingRX(false));

        setLoadingFotos(true);
        getPatientPhotos(paciente.numPac)
            .then(f => { setFotos(f); setFotoIdx(0); })
            .finally(() => setLoadingFotos(false));
    }, [paciente?.numPac]);

    // Edad calculada
    const edad = paciente ? new Date().getFullYear() - new Date(paciente.fechaNacimiento).getFullYear() : 0;



    const renderHistorial = () => {
        if (!paciente) return null;
        return (
        <div className="grid gap-3 animate-in fade-in duration-400 h-[calc(100vh-240px)] min-h-[500px]" style={{ gridTemplateColumns: '65fr 35fr' }}>

            {/* ── COL 1: IZQUIERDA (Top: Historial, Bottom: SOAP) ──────────────── */}
            <div className="flex flex-col gap-3 h-full min-h-0">
                {/* ── TOP-LEFT: HISTORIAL (scroll) ──────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden flex-1 min-h-0">
                    <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                        <div className="flex items-center gap-1.5 flex-1">
                            <Activity className="w-3.5 h-3.5 text-[#051650]" />
                            <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Entradas Médicas</h3>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
                        <EntradasMedicas idPac={paciente.idPac ?? (paciente.numPac ? parseInt(paciente.numPac, 10) : 0)} />
                    </div>
                    {/* IA DENTAL al pie */}
                    <div className="border-t border-slate-100 bg-[#051650] px-3 py-2 flex items-center gap-2 flex-shrink-0">
                        <Brain className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
                        <p className="text-[9px] text-blue-200 font-medium leading-tight flex-1 truncate italic">
                            {saraTyped.slice(0, 70)}{saraTyped.length > 70 ? '…' : ''}
                        </p>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    </div>
                </div>

                {/* ── BOTTOM-LEFT: EDITOR SOAP (50%, sin scroll) ──────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                    <SOAPEditor onSave={handleSaveNote} alergiasPaciente={paciente!.alergias} />
                </div>
            </div>

            {/* ── COL 2: DERECHA (Top: RX = Bottom: Fotos, 50/50) ──────────────── */}
            <div className="flex flex-col gap-3 h-full min-h-0">
                {/* ── TOP-RIGHT: RX (50%) ──────────────── */}
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg flex flex-col flex-1 min-h-0">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700/50 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                            <Camera className="w-3 h-3 text-slate-400" />
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">RX</span>
                            {!isRomexisConfigured() && (
                                <span className="text-[8px] font-bold text-amber-400 bg-amber-400/10 border border-amber-500/30 px-1 py-0.5 rounded">DEMO</span>
                            )}
                        </div>
                        <span className="text-[9px] text-slate-500 font-semibold">{panoramicas[panoramicaIdx]?.dateLabel ?? ''}</span>
                    </div>
                    {/* Imagen principal */}
                    <div
                        className="flex-1 relative overflow-hidden cursor-zoom-in group"
                        onClick={() => panoramicas.length > 0 && setZoomImage(panoramicas[panoramicaIdx]?.url)}
                    >
                        {loadingRX
                            ? <div className="w-full h-full flex items-center justify-center"><span className="w-5 h-5 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" /></div>
                            : panoramicas.length === 0
                                ? <>
                                    <img
                                        src="/rx-demo-panoramica.png"
                                        className="w-full h-full object-cover opacity-80"
                                        alt="Panorámica demo"
                                        style={{ filter: 'contrast(1.2) brightness(0.85)' }}
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-900 to-transparent" />
                                    <div className="absolute top-2 right-2 bg-amber-400/90 text-slate-900 text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider">Demo</div>
                                </>
                                : <>
                                    <img
                                        src={panoramicas[panoramicaIdx]?.url}
                                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                        alt="Panorámica"
                                        style={{ filter: 'contrast(1.15) brightness(0.9)' }}
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-900 to-transparent" />
                                </>
                        }
                    </div>
                    {/* Carrete filmstrip compacto */}
                    <div className="flex gap-1.5 px-2 py-1.5 bg-slate-900/90 border-t border-slate-800 flex-shrink-0 overflow-x-auto">
                        {panoramicas.map((p, i) => (
                            <button
                                key={p.id}
                                onClick={() => setPanoramicaIdx(i)}
                                className={`relative flex-shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all ${panoramicaIdx === i ? 'border-blue-400 opacity-100' : 'border-slate-700 opacity-50 hover:opacity-80'}`}
                            >
                                <img src={p.thumbnail ?? p.url} className="w-full h-full object-cover" style={{ filter: 'contrast(1.1)' }} alt={p.dateLabel} />
                                <div className="absolute bottom-0 left-0 right-0 bg-slate-900/70 text-[7px] text-slate-300 font-bold text-center py-px">{p.dateLabel}</div>
                            </button>
                        ))}
                        <label className="flex-shrink-0 w-10 h-10 rounded border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-all">
                            <Camera className="w-3 h-3 text-slate-600" />
                            <input type="file" accept="image/*" className="hidden" />
                        </label>
                    </div>
                </div>

                {/* ── BOTTOM-RIGHT: FOTOS INTRAORALES ──────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                            <Camera className="w-3 h-3 text-slate-500" />
                            <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Fotos</span>
                            {!isGDriveConfigured() && (
                                <span className="text-[8px] font-bold text-amber-500 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">DEMO</span>
                            )}
                        </div>
                        <span className="text-[9px] text-slate-400 font-semibold truncate max-w-[80px]">{fotos[fotoIdx]?.label}</span>
                    </div>
                    {/* Imagen principal */}
                    <div
                        className="flex-1 relative overflow-hidden cursor-zoom-in group bg-slate-100"
                        onClick={() => fotos.length > 0 && setZoomImage(fotos[fotoIdx]?.url)}
                    >
                        {loadingFotos
                            ? <div className="w-full h-full flex items-center justify-center"><span className="w-5 h-5 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" /></div>
                            : fotos.length === 0
                                ? <>
                                    <img
                                        src="/foto-demo-intraoral.png"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        alt="Foto intraoral demo"
                                    />
                                    <div className="absolute top-2 right-2 bg-amber-400/90 text-slate-900 text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider">Demo</div>
                                </>
                                : <>
                                    <img
                                        src={fotos[fotoIdx]?.url}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        alt={fotos[fotoIdx]?.label}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                                        <span className="text-white text-[9px] font-black uppercase bg-black/50 px-2 py-0.5 rounded-full">Ampliar</span>
                                    </div>
                                </>
                        }
                    </div>
                    {/* Carrete compacto */}
                    <div className="flex gap-1.5 px-2 py-1.5 bg-white border-t border-slate-100 flex-shrink-0 overflow-x-auto">
                        {fotos.map((f, i) => (
                            <button
                                key={f.id}
                                onClick={() => setFotoIdx(i)}
                                className={`relative flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${fotoIdx === i ? 'border-[#051650] opacity-100 shadow-md' : 'border-slate-200 opacity-60 hover:opacity-90'}`}
                            >
                                <img src={f.thumbnail ?? f.url} className="w-full h-full object-cover" alt={f.label} />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[7px] text-white font-bold text-center py-px">{f.label}</div>
                            </button>
                        ))}
                        <label className="flex-shrink-0 w-10 h-10 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#051650] transition-all">
                            <Camera className="w-3 h-3 text-slate-300" />
                            <input type="file" accept="image/*" className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !paciente?.numPac) return;
                                    showToast("Subiendo foto...");
                                    const { uploadPatientPhoto } = await import("../services/gdrive.service");
                                    const ok = await uploadPatientPhoto(paciente.numPac, file);
                                    showToast(ok ? "Foto subida a Google Drive" : "Google Drive OAuth requerido — configura la integracion");
                                    e.target.value = "";
                                }} />
                        </label>
                    </div>
                </div>
            </div>
        </div>
        );
    };




    const renderContent = () => {
        switch (activeSubArea) {
            case 'Odontograma 3D':
            case 'Odontograma': return <Odontograma onSuggestionUpdate={() => { }} numPac={paciente?.numPac} />;
            case 'Sondaje Periodontal':
            case 'Periodoncia': return <Periodontograma />;
            case 'Cuenta Corriente':
            case 'Económica':
            case 'Presupuestos': return <Economica
                numPac={paciente?.numPac ?? ''}
                idPac={paciente?.idPac}
                pacienteNombre={paciente ? `${paciente.nombre} ${paciente.apellidos}`.trim() : ''}
                pacienteTelefono={paciente?.telefono ?? ''}
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

    // ── Empty state: no patient selected yet ─────────────────────────────────
    if (!paciente) {
        return (
            <>
                <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[60vh]">
                    <div className="w-20 h-20 rounded-2xl bg-[#051650]/5 flex items-center justify-center">
                        <UserPlus className="w-10 h-10 text-[#051650]/40" />
                    </div>
                    <div className="text-center max-w-xs">
                        <h2 className="text-[15px] font-black text-slate-700 uppercase tracking-wider">Ningún paciente seleccionado</h2>
                        <p className="text-[12px] text-slate-400 mt-1">Busca por nombre, apellidos, Nº paciente o teléfono para abrir su ficha clínica.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setSearchInitialView('search'); setIsSearchOpen(true); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#051650] text-white rounded-xl text-[12px] font-black uppercase tracking-wider hover:bg-[#051650]/90 transition-all shadow-lg shadow-[#051650]/20"
                        >
                            <Search className="w-4 h-4" /> Buscar Paciente
                        </button>
                        <button
                            onClick={() => { setSearchInitialView('create'); setIsSearchOpen(true); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[12px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <UserPlus className="w-4 h-4" /> Nuevo Paciente
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
        <div className="flex flex-col gap-4">

            {/* ── CABECERA PREMIUM ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* ── PANEL DE SEGURIDAD CLÍNICA — editable ───────────────── */}
                {(() => {
                    const medsImportantes = medications.filter(m => m.importante);
                    const hasAlerts = allergies.length > 0 || medsImportantes.length > 0;
                    return (
                        <div>
                            {/* Franja roja siempre visible si hay alertas */}
                            {hasAlerts && (
                                <div className={`bg-rose-500 px-4 py-1.5 flex items-center gap-2 ${alertEditMode ? 'rounded-t-none' : ''}`}>
                                    <ShieldAlert className="w-3.5 h-3.5 text-white flex-shrink-0" />
                                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                        {allergies.length > 0 && (
                                            <span className="text-[10px] font-black text-white uppercase tracking-wider">
                                                ⚠ Alergias: {allergies.map(a => a.nombre).join(' · ')}
                                            </span>
                                        )}
                                        {medsImportantes.length > 0 && (
                                            <span className="text-[10px] font-black text-red-200 uppercase tracking-wider flex items-center gap-1">
                                                <Pill className="w-3 h-3" />
                                                {medsImportantes.map(m => m.nombre).join(' · ')}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setAlertEditMode(v => !v)}
                                        className="flex items-center gap-1 text-[9px] font-black text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition-all flex-shrink-0"
                                    >
                                        <Pencil className="w-2.5 h-2.5" />{alertEditMode ? 'Cerrar' : 'Editar'}
                                    </button>
                                </div>
                            )}

                            {/* Si no hay alertas, botón flotante discreto para añadir */}
                            {!hasAlerts && !alertEditMode && (
                                <div className="bg-slate-50 border-b border-slate-100 px-4 py-1.5 flex items-center gap-2">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-[10px] font-bold text-emerald-600 flex-1">Sin alertas de seguridad</span>
                                    <button
                                        onClick={() => setAlertEditMode(true)}
                                        className="text-[9px] font-black text-slate-400 hover:text-[#051650] flex items-center gap-1 transition-all"
                                    >
                                        <Plus className="w-3 h-3" /> Añadir
                                    </button>
                                </div>
                            )}

                            {/* Panel de edición expandible */}
                            {alertEditMode && (
                                <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 space-y-3">

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
                                            className="flex items-center gap-1.5 px-4 py-2 bg-[#051650] text-white text-xs font-black rounded-lg hover:bg-blue-900 transition-all"
                                        >
                                            <Save className="w-3.5 h-3.5" /> Guardar y cerrar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
                <div className="px-6 py-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    {/* Avatar + datos */}
                    <div className="flex items-center gap-4">
                        <div className="h-14 px-3 rounded-xl bg-gradient-to-br from-[#051650] to-blue-700 text-white flex items-center justify-center shadow-md flex-shrink-0 min-w-[56px]">
                            <span className="text-[13px] font-black leading-tight tracking-tight whitespace-nowrap">{paciente.numPac}</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                    {paciente.nombre} {paciente.apellidos}
                                </h2>
                                <Badge variant="blue" className="rounded-sm text-[9px] px-1.5 py-0">Premium</Badge>
                                {paciente.deuda && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                        <CircleDollarSign className="w-3 h-3" /> Deuda
                                    </span>
                                )}
                                {!paciente.consentimientosFirmados && (
                                    <span
                                        onClick={() => onSubAreaChange('Documentos')}
                                        className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded cursor-pointer hover:bg-amber-100 transition-all"
                                    >
                                        <Gavel className="w-3 h-3" /> Firma pendiente
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-slate-400 text-[10px] font-semibold">
                                <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{paciente.dni}</span>
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{paciente.telefono}</span>
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{edad} años</span>
                            </div>
                        </div>
                    </div>

                    {/* Acciones rápidas */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => onNavigate?.('Whatsapp', undefined, undefined, {
                                phone: paciente.telefono ?? '',
                                name: `${paciente.nombre} ${paciente.apellidos}`.trim(),
                            })}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-sm active:scale-95"
                        >
                            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                        <button
                            onClick={() => onNavigate?.('Agenda', undefined, {
                                pacienteNombre: `${paciente.nombre} ${paciente.apellidos}`,
                                pacienteTelefono: paciente.telefono ?? '',
                                pacienteNumPac: paciente.numPac ?? '',
                            } as any)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-95"
                        >
                            <Calendar className="w-3.5 h-3.5" /> Nueva Cita
                        </button>
                        <button
                            onClick={() => { setIsSearchOpen(true); setSearchInitialView('search'); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#051650] text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-900 transition-all shadow-sm active:scale-95"
                        >
                            <ArrowLeftRight className="w-3.5 h-3.5" /> Cambiar
                        </button>
                    </div>
                </div>

            </div>

            {/* ── CONTENIDO ───────────────────────────────────────────── */}
            <div>{renderContent()}</div>

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
