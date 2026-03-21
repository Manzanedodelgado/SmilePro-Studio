
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type Paciente } from '../../types';
import { searchPacientes, createPaciente, isDbConfigured } from '../../services/pacientes.service';
import { X, Search, ChevronRight, UserPlus, Camera, Upload, Shield, User, Phone, AlertTriangle, Pill, Users, Loader2 } from 'lucide-react';

interface PatientSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (paciente: Paciente) => void;
    initialView?: 'search' | 'create';
}

const inputCls = "w-full px-4 py-3 bg-white/50 border border-slate-200/60 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 backdrop-blur-sm shadow-sm";
const labelCls = "block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";

const SectionHeader: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex items-center gap-2.5 col-span-2 pt-6 pb-2 border-b border-slate-100/60 mb-2">
        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">{icon}</div>
        <span className="text-[12px] font-black text-slate-700 uppercase tracking-widest">{label}</span>
    </div>
);

const PatientSearchModal: React.FC<PatientSearchModalProps> = ({ isOpen, onClose, onSelect, initialView = 'search' }) => {
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'search' | 'create'>(initialView);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dbResults, setDbResults] = useState<Paciente[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);

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

    const [alergias, setAlergias] = useState('');
    const [medicacion, setMedicacion] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const resetForm = () => {
        setNombre(''); setApellidos(''); setDni(''); setTelefono(''); setEmail('');
        setFechaNacimiento(''); setIsMinor(false); setTutor('');
        setDireccion(''); setCiudad(''); setCp('');
        setAlergias(''); setMedicacion(''); setObservaciones('');
        setPhotoPreview(null);
    };

    useEffect(() => {
        if (isOpen) {
            setView(initialView); setSearch(''); setDbResults([]); setSelectedIdx(0);
            if (initialView === 'create') resetForm();
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialView]);

    const runSearch = useCallback(async (q: string) => {
        if (!isDbConfigured()) return;
        setSearching(true);
        try {
            const results = await searchPacientes(q);
            setDbResults(results);
            setSelectedIdx(0);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        if (search.trim().length < 2) { setDbResults([]); return; }
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
        if (saving) return;
        setSaveError(null);
        setSaving(true);
        try {
            const patientData = {
                numPac: '',
                nombre, apellidos, dni, telefono, fechaNacimiento,
                email: email || undefined,
                direccion: direccion || undefined,
                ciudad: ciudad || undefined,
                cp: cp || undefined,
                tutor: isMinor ? tutor : undefined,
                alergias: alergias.split(',').map(a => a.trim()).filter(Boolean),
                medicacionActual: medicacion,
                deuda: false, consentimientosFirmados: false,
            };
            if (isDbConfigured()) {
                const created = await createPaciente(patientData);
                if (created) { onSelect({ ...created, historial: [] }); onClose(); return; }
                setSaveError('No se pudo guardar el paciente. Comprueba la conexión con el servidor.');
                return;
            }
            // Modo sin BD: crear en local
            onSelect({ ...patientData, historial: [] });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    // Keyboard navigation for search results
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { onClose(); return; }
        if (view !== 'search' || dbResults.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, dbResults.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter' && dbResults[selectedIdx]) { e.preventDefault(); onSelect(dbResults[selectedIdx]); onClose(); }
    };

    if (!isOpen) return null;

    const filtered = dbResults;

    return (
        <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[12vh]" onKeyDown={handleKeyDown}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
            
            <div className="relative w-full max-w-[680px] bg-white rounded-2xl shadow-[0_25px_60px_-10px_rgba(0,0,0,0.4)] overflow-hidden border border-slate-200/50 animate-scale-in flex flex-col" style={{ maxHeight: '70vh' }}>
                
                {/* ── SEARCH VIEW ── */}
                {view === 'search' && (
                    <>
                        {/* Search Input — clean command-palette style */}
                        <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-100 flex-shrink-0">
                            <div className="relative flex-shrink-0">
                                <Search className="w-[18px] h-[18px] text-slate-400" />
                                {searching && <div className="absolute inset-0 w-[18px] h-[18px] border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />}
                            </div>
                            <input
                                ref={inputRef}
                                autoFocus
                                type="text"
                                placeholder="Buscar por nombre, apellidos, DNI o nº paciente..."
                                className="flex-1 bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:text-slate-350 caret-blue-500"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {search && (
                                <button onClick={() => { setSearch(''); inputRef.current?.focus(); }} className="p-1 hover:bg-slate-100 rounded-md transition-colors flex-shrink-0">
                                    <X className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                            )}
                        </div>

                        {/* Results area */}
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                            {search.trim().length >= 2 ? (
                                <>
                                    {/* Header count */}
                                    <div className="px-5 py-2 border-b border-slate-50 bg-slate-25">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {searching ? 'Buscando...' : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`}
                                        </span>
                                    </div>

                                    {/* Patient list */}
                                    <div className="py-1">
                                        {filtered.map((p, idx) => (
                                            <button 
                                                key={p.numPac} 
                                                onClick={() => { onSelect(p); onClose(); }}
                                                onMouseEnter={() => setSelectedIdx(idx)}
                                                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${idx === selectedIdx ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                            >
                                                {/* Avatar */}
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-black flex-shrink-0 ${idx === selectedIdx ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-slate-100 text-slate-500'}`}>
                                                    {p.nombre?.[0] ?? ''}{p.apellidos?.[0] ?? ''}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[14px] font-bold truncate ${idx === selectedIdx ? 'text-blue-900' : 'text-slate-800'}`}>
                                                            {p.nombre} {p.apellidos}
                                                        </span>
                                                        {p.alergias?.length > 0 && (
                                                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center" title={`Alergias: ${p.alergias.join(', ')}`}>
                                                                <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-[11px] font-semibold text-slate-400">#{p.numPac}</span>
                                                        {p.dni && <span className="text-[11px] text-slate-400">{p.dni}</span>}
                                                        {p.telefono && <span className="text-[11px] text-slate-400">{p.telefono}</span>}
                                                        {p.fechaNacimiento && (
                                                            <span className="text-[11px] text-slate-400">
                                                                {new Date().getFullYear() - new Date(p.fechaNacimiento).getFullYear()} años
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Arrow */}
                                                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${idx === selectedIdx ? 'text-blue-500' : 'text-slate-300'}`} />
                                            </button>
                                        ))}
                                    </div>

                                    {filtered.length === 0 && !searching && (
                                        <div className="flex flex-col items-center py-12">
                                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                                                <Search className="w-5 h-5 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-600">Sin resultados para "{search}"</p>
                                            <p className="text-[12px] text-slate-400 mt-1">No se encontró ningún paciente en GELITE.</p>
                                            <button 
                                                onClick={() => setView('create')} 
                                                className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[12px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" /> Crear nueva ficha
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center py-14 opacity-60">
                                    <Search className="w-8 h-8 text-slate-200 mb-3" />
                                    <p className="text-[13px] font-semibold text-slate-400">
                                        {search.trim().length === 0 ? 'Escribe para buscar pacientes' : 'Escribe al menos 2 caracteres'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer with keyboard hints + new patient */}
                        <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-400 shadow-sm">↑↓</kbd>
                                    <span className="text-[10px] text-slate-400">navegar</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-400 shadow-sm">↵</kbd>
                                    <span className="text-[10px] text-slate-400">seleccionar</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-400 shadow-sm">esc</kbd>
                                    <span className="text-[10px] text-slate-400">cerrar</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setView('create')} 
                                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
                            >
                                <UserPlus className="w-3.5 h-3.5" /> Nuevo Paciente
                            </button>
                        </div>
                    </>
                )}

                {/* ── CREATE VIEW ── */}
                {view === 'create' && (
                    <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 flex-shrink-0">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 tracking-tight">Nuevo Paciente</h2>
                                <p className="text-[11px] text-slate-500 mt-0.5">Completa el formulario para dar de alta.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setView('search')} disabled={saving} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50">
                                    ← Buscar
                                </button>
                                {saveError && (
                                    <span className="text-[11px] text-red-600 font-semibold max-w-[200px] leading-tight">{saveError}</span>
                                )}
                                <button onClick={() => {
                                    const form = document.getElementById('new-patient-form') as HTMLFormElement;
                                    if (form) form.requestSubmit();
                                }} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
                                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Form */}
                        <div className="flex-1 overflow-y-auto p-6 overscroll-contain">
                            <form id="new-patient-form" onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
                                
                                {/* Photo Area */}
                                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200/60 rounded-xl">
                                    <div
                                        onClick={() => fileRef.current?.click()}
                                        className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all overflow-hidden flex-shrink-0 group"
                                    >
                                        {photoPreview ? (
                                            <img src={photoPreview} className="w-full h-full object-cover" alt="Foto" />
                                        ) : (
                                            <>
                                                <Camera className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5 group-hover:text-blue-500">Foto</span>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-[13px] font-bold text-slate-700">Fotografía</h3>
                                        <button type="button" onClick={() => fileRef.current?.click()}
                                            className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors">
                                            <Upload className="w-3 h-3" /> Subir archivo
                                        </button>
                                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                    
                                    {/* Identidad */}
                                    <SectionHeader icon={<User className="w-3.5 h-3.5" />} label="Identidad" />
                                    
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
                                        <input type="text" value={dni} onChange={e => setDni(e.target.value)} className={inputCls} placeholder="12345678X" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Fecha de Nacimiento *</label>
                                        <input required type="date" value={fechaNacimiento} onChange={e => setFechaNacimiento(e.target.value)} className={inputCls} />
                                    </div>
                                    
                                    <div className="col-span-1 md:col-span-2">
                                        <div className="flex items-center gap-3 p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl">
                                            <input type="checkbox" id="minor" checked={isMinor} onChange={e => setIsMinor(e.target.checked)} className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                                            <label htmlFor="minor" className="text-[12px] font-bold text-amber-800 flex items-center gap-1.5 cursor-pointer select-none">
                                                <Users className="w-3.5 h-3.5" /> Menor / Requiere Tutor
                                            </label>
                                        </div>
                                    </div>
                                    
                                    {isMinor && (
                                        <div className="col-span-1 md:col-span-2">
                                            <label className={labelCls}>Nombre del Tutor Legal *</label>
                                            <input required type="text" value={tutor} onChange={e => setTutor(e.target.value)} className={inputCls} placeholder="Nombre completo del tutor" />
                                        </div>
                                    )}

                                    {/* Contacto */}
                                    <SectionHeader icon={<Phone className="w-3.5 h-3.5" />} label="Contacto" />
                                    
                                    <div>
                                        <label className={labelCls}>Teléfono Móvil *</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">+34</span>
                                            <input required type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className={`${inputCls} pl-12`} placeholder="600 123 456" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Email</label>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="correo@ejemplo.com" />
                                    </div>
                                    
                                    <div className="col-span-1 md:col-span-2">
                                        <label className={labelCls}>Dirección</label>
                                        <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} className={inputCls} placeholder="C/ Dental, 42, 2ºA" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Ciudad</label>
                                        <input type="text" value={ciudad} onChange={e => setCiudad(e.target.value)} className={inputCls} placeholder="Ciudad" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Código Postal</label>
                                        <input type="text" maxLength={5} value={cp} onChange={e => setCp(e.target.value)} className={inputCls} placeholder="28001" />
                                    </div>

                                    {/* Riesgos */}
                                    <SectionHeader icon={<Shield className="w-3.5 h-3.5" />} label="Información Clínica" />
                                    
                                    <div className="col-span-1 md:col-span-2">
                                        <label className={labelCls}>
                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 inline-block mr-1 -mt-0.5" />
                                            <span className="text-rose-600">Alergias</span>
                                            <span className="text-[10px] normal-case text-slate-400 ml-1.5">(separar por comas)</span>
                                        </label>
                                        <input type="text" value={alergias} onChange={e => setAlergias(e.target.value)} className={`${inputCls} border-rose-200 focus:ring-rose-500/10 focus:border-rose-400`} placeholder="Látex, Penicilina, AINEs..." />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className={labelCls}>
                                            <Pill className="w-3.5 h-3.5 text-blue-500 inline-block mr-1 -mt-0.5" />
                                            <span className="text-blue-700">Medicación Actual</span>
                                        </label>
                                        <input type="text" value={medicacion} onChange={e => setMedicacion(e.target.value)} className={`${inputCls} border-blue-200 focus:ring-blue-500/10 focus:border-blue-400`} placeholder="Sintrom, Adiro..." />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className={labelCls}>Observaciones</label>
                                        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} className={`${inputCls} h-20 resize-none`} placeholder="Patologías, operaciones previas..." />
                                    </div>
                                </div>
                                <div className="h-6" />
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientSearchModal;
