
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Paciente } from '../../types';
import { searchPacientes, createPaciente, isDbConfigured } from '../../services/pacientes.service';
import { X, Search, ChevronRight, UserPlus, Camera, Upload, Shield, User, Phone, MapPin, Briefcase, AlertTriangle, Pill, Users } from 'lucide-react';

interface PatientSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (paciente: Paciente) => void;
    initialView?: 'search' | 'create';
}


const inputCls = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-[#051650] focus:ring-2 focus:ring-[#051650]/10 transition-all placeholder:text-slate-500";
const labelCls = "block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-1";

const SectionHeader: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex items-center gap-2 col-span-2 pt-2 border-t border-slate-100 mt-1">
        <div className="w-5 h-5 flex items-center justify-center">{icon}</div>
        <span className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
);

const PatientSearchModal: React.FC<PatientSearchModalProps> = ({ isOpen, onClose, onSelect, initialView = 'search' }) => {
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'search' | 'create'>(initialView);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [dbResults, setDbResults] = useState<Paciente[]>([]);
    const [searching, setSearching] = useState(false);

    // Form fields
    const [nombre, setNombre] = useState('');
    const [apellidos, setApellidos] = useState('');
    const [dni, setDni] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [fechaNacimiento, setFechaNacimiento] = useState('');
    const [isMinor, setIsMinor] = useState(false);
    const [tutor, setTutor] = useState('');
    const [direccion, setDireccion] = useState('');
    const [ciudad, setCiudad] = useState('');
    const [cp, setCp] = useState('');
    const [profesion, setProfesion] = useState('');
    const [alergias, setAlergias] = useState('');
    const [medicacion, setMedicacion] = useState('');
    const [observaciones, setObservaciones] = useState('');

    const resetForm = () => {
        setNombre(''); setApellidos(''); setDni(''); setTelefono(''); setEmail('');
        setFechaNacimiento(''); setIsMinor(false); setTutor('');
        setDireccion(''); setCiudad(''); setCp(''); setProfesion('');
        setAlergias(''); setMedicacion(''); setObservaciones('');
        setPhotoPreview(null);
    };

    useEffect(() => {
        if (isOpen) { setView(initialView); setSearch(''); setDbResults([]); if (initialView === 'create') resetForm(); }
    }, [isOpen, initialView]);

    // Búsqueda en BD con debounce
    const runSearch = useCallback(async (q: string) => {
        if (!isDbConfigured()) return;
        setSearching(true);
        try {
            const results = await searchPacientes(q);
            setDbResults(results);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        if (search.trim().length < 4) { setDbResults([]); return; }
        const timer = setTimeout(() => runSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search, runSearch]);

    const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // NumPac generado por GELITE al insertar en Pacientes (aquí usamos timestamp como provisional)
        const generatedNumPac = `WEB-${Date.now()}`;
        const patientData = {
            numPac: generatedNumPac,
            nombre, apellidos, dni, telefono, fechaNacimiento,
            tutor: isMinor ? tutor : undefined,
            alergias: alergias.split(',').map(a => a.trim()).filter(Boolean),
            medicacionActual: medicacion,
            deuda: false, consentimientosFirmados: false,
        };
        if (isDbConfigured()) {
            const created = await createPaciente(patientData);
            if (created) { onSelect({ ...created, historial: [] }); onClose(); return; }
        }
        // Fallback local si BD no está configurada
        const newPatient: Paciente = { ...patientData, historial: [] };
        onSelect(newPatient);
        onClose();
    };

    if (!isOpen) return null;

    // Siempre usa resultados reales de GELITE (dbResults)
    // Si no hay query, muestra los primeros resultados cargados
    const filtered = dbResults;

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#051650]/30 backdrop-blur-md p-4" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">

                {/* HEADER */}
                <div className="bg-[#051650] px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {view === 'search'
                            ? <Search className="w-5 h-5 text-blue-300" />
                            : <UserPlus className="w-5 h-5 text-blue-300" />}
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                {view === 'search' ? 'Buscar Paciente' : 'Nuevo Registro de Paciente'}
                            </h2>
                            <p className="text-[13px] text-blue-300 font-medium">
                                {view === 'search' ? 'Por nombre, apellidos, Nº paciente o teléfono' : 'Rellena los datos del nuevo paciente'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-all">
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 bg-slate-50 flex-shrink-0">
                    {(['search', 'create'] as const).map(tab => (
                        <button key={tab} onClick={() => setView(tab)}
                            className={`flex-1 py-2.5 text-[13px] font-bold uppercase tracking-wider transition-all border-b-2 ${view === tab ? 'border-[#051650] text-[#051650] bg-white' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                            {tab === 'search' ? '🔍 Buscar' : '+ Nuevo Paciente'}
                        </button>
                    ))}
                </div>

                <div className="overflow-y-auto flex-1">
                    {/* ── BUSCADOR ────────────────────────────────── */}
                    {view === 'search' && (
                        <div className="p-6 space-y-4">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Mínimo 4 caracteres: nombre, apellidos, Nº paciente o teléfono..."
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#051650]/20 focus:border-[#051650] outline-none transition-all placeholder:text-slate-500"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
                                {searching && (
                                    <div className="text-center py-4">
                                        <span className="w-5 h-5 border-2 border-slate-200 border-t-[#051650] rounded-full animate-spin inline-block" />
                                    </div>
                                )}
                                {filtered.map(p => (
                                    <button key={p.numPac} onClick={() => { onSelect(p); onClose(); }}
                                        className="w-full p-3.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between group transition-all shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#051650]/10 text-[#051650] rounded-xl flex items-center justify-center font-bold text-sm">
                                                {p.nombre[0]}{p.apellidos[0]}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-slate-800">{p.nombre} {p.apellidos}</p>
                                                <p className="text-[13px] text-slate-400 font-medium">#{p.numPac} · DNI: {p.dni} · {p.telefono}</p>
                                                {p.alergias.length > 0 && (
                                                    <p className="text-[12px] font-bold text-red-500 mt-0.5">⚠ {p.alergias.join(', ')}</p>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#051650] group-hover:translate-x-0.5 transition-all" />
                                    </button>
                                ))}
                                {filtered.length === 0 && search && (
                                    <div className="text-center py-8">
                                        <p className="text-slate-400 font-medium text-sm">Sin coincidencias para "{search}"</p>
                                        <button onClick={() => setView('create')} className="mt-2 text-[#051650] font-bold text-[13px] uppercase tracking-widest hover:underline">
                                            → Crear nueva ficha
                                        </button>
                                    </div>
                                )}
                                {filtered.length === 0 && !search && (
                                    <p className="text-center text-[13px] text-slate-300 font-medium py-4">Escribe al menos 4 caracteres para buscar...</p>
                                )}
                                {filtered.length === 0 && search.trim().length > 0 && search.trim().length < 4 && (
                                    <div className="text-center py-6">
                                        <p className="text-slate-400 font-medium text-sm">Escribe <span className="font-bold text-[#051650]">{4 - search.trim().length}</span> {4 - search.trim().length === 1 ? 'carácter más' : 'caracteres más'} para iniciar la búsqueda</p>
                                        <div className="flex gap-1 justify-center mt-2">
                                            {[0, 1, 2, 3].map(i => (
                                                <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < search.trim().length ? 'bg-[#051650]' : 'bg-slate-200'}`} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── NUEVO PACIENTE ──────────────────────────── */}
                    {view === 'create' && (
                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="grid grid-cols-2 gap-x-5 gap-y-4">

                                {/* Foto */}
                                <div className="col-span-2 flex items-center gap-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <div
                                        onClick={() => fileRef.current?.click()}
                                        className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#051650] hover:bg-blue-50 transition-all overflow-hidden flex-shrink-0"
                                    >
                                        {photoPreview
                                            ? <img src={photoPreview} className="w-full h-full object-cover" alt="Foto" />
                                            : <><Camera className="w-6 h-6 text-slate-500" /><span className="text-[12px] font-bold text-slate-300 mt-1">Foto</span></>
                                        }
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">Fotografía del paciente</p>
                                        <p className="text-[13px] text-slate-400 font-medium mt-0.5">Opcional. JPG, PNG, WebP. Máx 5MB.</p>
                                        <button type="button" onClick={() => fileRef.current?.click()}
                                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:border-[#051650] transition-all">
                                            <Upload className="w-3.5 h-3.5" /> Seleccionar archivo
                                        </button>
                                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                                    </div>
                                </div>

                                {/* Datos personales */}
                                <SectionHeader icon={<User className="w-3.5 h-3.5 text-slate-400" />} label="Datos Personales" />

                                <div>
                                    <label className={labelCls}>Nombre *</label>
                                    <input required type="text" value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} placeholder="Bárbara" />
                                </div>
                                <div>
                                    <label className={labelCls}>Apellidos *</label>
                                    <input required type="text" value={apellidos} onChange={e => setApellidos(e.target.value)} className={inputCls} placeholder="Ruiz Fernandez" />
                                </div>
                                <div>
                                    <label className={labelCls}>DNI / NIE</label>
                                    <input type="text" value={dni} onChange={e => setDni(e.target.value)} className={inputCls} placeholder="00000000X" />
                                </div>
                                <div>
                                    <label className={labelCls}>Fecha de Nacimiento *</label>
                                    <input required type="date" value={fechaNacimiento} onChange={e => setFechaNacimiento(e.target.value)} className={inputCls} />
                                </div>
                                <div className="col-span-2 flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <input type="checkbox" id="minor" checked={isMinor} onChange={e => setIsMinor(e.target.checked)} className="w-4 h-4 rounded text-[#051650] focus:ring-[#051650]" />
                                    <label htmlFor="minor" className="text-sm font-bold text-slate-600 flex items-center gap-1.5 cursor-pointer">
                                        <Users className="w-3.5 h-3.5 text-slate-400" /> Paciente menor de edad (requiere tutor legal)
                                    </label>
                                </div>
                                {isMinor && (
                                    <div className="col-span-2">
                                        <label className={labelCls}>Tutor Legal *</label>
                                        <input required type="text" value={tutor} onChange={e => setTutor(e.target.value)} className={inputCls} placeholder="Nombre completo del tutor" />
                                    </div>
                                )}

                                {/* Contacto */}
                                <SectionHeader icon={<Phone className="w-3.5 h-3.5 text-slate-400" />} label="Contacto" />

                                <div>
                                    <label className={labelCls}>Móvil *</label>
                                    <input required type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className={inputCls} placeholder="600 123 456" />
                                </div>
                                <div>
                                    <label className={labelCls}>Email</label>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="paciente@correo.com" />
                                </div>

                                {/* Dirección */}
                                <SectionHeader icon={<MapPin className="w-3.5 h-3.5 text-slate-400" />} label="Dirección" />

                                <div className="col-span-2">
                                    <label className={labelCls}>Dirección</label>
                                    <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} className={inputCls} placeholder="C/ Mayor, 42, 2ºA" />
                                </div>
                                <div>
                                    <label className={labelCls}>Ciudad</label>
                                    <input type="text" value={ciudad} onChange={e => setCiudad(e.target.value)} className={inputCls} placeholder="Madrid" />
                                </div>
                                <div>
                                    <label className={labelCls}>Código Postal</label>
                                    <input type="text" maxLength={5} value={cp} onChange={e => setCp(e.target.value)} className={inputCls} placeholder="28001" />
                                </div>

                                {/* Profesional */}
                                <SectionHeader icon={<Briefcase className="w-3.5 h-3.5 text-slate-400" />} label="Datos Profesionales" />

                                <div className="col-span-2">
                                    <label className={labelCls}>Profesión / Empresa</label>
                                    <input type="text" value={profesion} onChange={e => setProfesion(e.target.value)} className={inputCls} placeholder="Médico, Abogado, Autónomo..." />
                                </div>

                                {/* Historial médico */}
                                <SectionHeader icon={<Shield className="w-3.5 h-3.5 text-[#FF4B68]" />} label="Historial Médico" />

                                <div className="col-span-2">
                                    <label className={labelCls}>
                                        <AlertTriangle className="w-3 h-3 text-red-500 inline-block mr-1" />
                                        Alergias conocidas
                                        <span className="text-[12px] normal-case font-medium text-slate-400 ml-1">(separar por coma)</span>
                                    </label>
                                    <input type="text" value={alergias} onChange={e => setAlergias(e.target.value)} className={inputCls}
                                        placeholder="Látex, Penicilina, AINEs..." />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelCls}>
                                        <Pill className="w-3 h-3 text-blue-500 inline-block mr-1" />
                                        Medicación actual
                                    </label>
                                    <input type="text" value={medicacion} onChange={e => setMedicacion(e.target.value)} className={inputCls}
                                        placeholder="Paracetamol, Omeprazol..." />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelCls}>Observaciones clínicas</label>
                                    <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                                        className={`${inputCls} h-20 resize-none`}
                                        placeholder="Antecedentes, patologías, condición de salud relevante..." />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setView('search')}
                                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-[13px] font-bold uppercase text-slate-500 hover:bg-slate-50 transition-all">
                                    Volver
                                </button>
                                <button type="submit"
                                    className="flex-1 py-2.5 bg-[#051650] text-white rounded-xl text-[13px] font-bold uppercase tracking-wider shadow-lg hover:bg-blue-900 active:scale-[0.98] transition-all">
                                    Registrar Paciente
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PatientSearchModal;
