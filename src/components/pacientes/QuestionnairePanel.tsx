// ─── QuestionnairePanel.tsx  (Anamnesis = mismo form que Nuevo Paciente) ─────
import React, { useState, useEffect, useRef } from 'react';
import { type Paciente } from '../../types';
import { updatePaciente } from '../../services/pacientes.service';
import {
    User, Phone, MapPin, Briefcase, Shield, Pill, AlertTriangle,
    Users, Camera, Upload, CheckCircle, Loader
} from 'lucide-react';

interface Props { paciente: Paciente; onUpdated?: (p: Paciente) => void; }

const inputCls  = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-[#051650] focus:ring-2 focus:ring-[#051650]/10 transition-all placeholder:text-slate-400";
const labelCls  = "block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1";

const SectionHeader: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex items-center gap-2 col-span-2 pt-3 border-t border-slate-100 mt-1">
        <div className="w-4 h-4 flex items-center justify-center">{icon}</div>
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
);

const QuestionnairePanel: React.FC<Props> = ({ paciente, onUpdated }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved]   = useState(false);
    const [error, setError]   = useState<string | null>(null);

    // Campos del formulario
    const [nombre,          setNombre]          = useState(paciente.nombre ?? '');
    const [apellidos,       setApellidos]       = useState(paciente.apellidos ?? '');
    const [dni,             setDni]             = useState(paciente.dni ?? '');
    const [fechaNacimiento, setFechaNacimiento] = useState(
        paciente.fechaNacimiento ? paciente.fechaNacimiento.slice(0, 10) : ''
    );
    const [isMinor, setIsMinor] = useState(!!paciente.tutor);
    const [tutor,   setTutor]   = useState(paciente.tutor ?? '');
    const [telefono,    setTelefono]    = useState(paciente.telefono ?? '');
    const [email,       setEmail]       = useState('');
    const [direccion,   setDireccion]   = useState('');
    const [ciudad,      setCiudad]      = useState('');
    const [cp,          setCp]          = useState('');
    const [profesion,   setProfesion]   = useState('');
    const [alergias,    setAlergias]    = useState((paciente.alergias ?? []).join(', '));
    const [medicacion,  setMedicacion]  = useState(paciente.medicacionActual ?? '');
    const [observaciones, setObservaciones] = useState('');

    // Si cambia el paciente externo, resetear
    useEffect(() => {
        setNombre(paciente.nombre ?? '');
        setApellidos(paciente.apellidos ?? '');
        setDni(paciente.dni ?? '');
        setFechaNacimiento(paciente.fechaNacimiento ? paciente.fechaNacimiento.slice(0, 10) : '');
        setIsMinor(!!paciente.tutor);
        setTutor(paciente.tutor ?? '');
        setTelefono(paciente.telefono ?? '');
        setAlergias((paciente.alergias ?? []).join(', '));
        setMedicacion(paciente.medicacionActual ?? '');
        setEmail(''); setDireccion(''); setCiudad(''); setCp(''); setProfesion(''); setObservaciones('');
        setSaved(false); setError(null);
    }, [paciente.numPac]);

    const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setError(null); setSaved(false);
        try {
            const updates: Partial<Omit<Paciente, 'historial'>> = {
                nombre, apellidos, dni, telefono,
                fechaNacimiento,
                tutor: isMinor ? tutor : undefined,
                alergias: alergias.split(',').map(a => a.trim()).filter(Boolean),
                medicacionActual: medicacion,
            };
            const result = await updatePaciente(paciente.numPac, updates);
            if (result) {
                setSaved(true);
                onUpdated?.(result);
                setTimeout(() => setSaved(false), 3000);
            } else {
                setError('No se pudo guardar. Comprueba la conexión con el servidor.');
            }
        } catch {
            setError('Error inesperado al guardar.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(100vh-260px)] overflow-y-auto">
            <div className="p-5">

                {/* Mensajes de estado */}
                {error && (
                    <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                        ⚠ {error}
                    </div>
                )}
                {saved && (
                    <div className="mb-4 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Datos guardados correctamente
                    </div>
                )}

                <div className="grid grid-cols-2 gap-x-5 gap-y-4">

                    {/* Foto */}
                    <div className="col-span-2 flex items-center gap-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#051650] hover:bg-blue-50 transition-all overflow-hidden flex-shrink-0"
                        >
                            {photoPreview
                                ? <img src={photoPreview} className="w-full h-full object-cover" alt="Foto" />
                                : <><Camera className="w-6 h-6 text-slate-400" /><span className="text-[10px] font-bold text-slate-300 mt-1">Foto</span></>
                            }
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">Fotografía del paciente</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Opcional. JPG, PNG, WebP.</p>
                            <button type="button" onClick={() => fileRef.current?.click()}
                                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-600 hover:bg-slate-50 hover:border-[#051650] transition-all">
                                <Upload className="w-3.5 h-3.5" /> Cambiar foto
                            </button>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                        </div>
                    </div>

                    {/* ── DATOS PERSONALES ── */}
                    <SectionHeader icon={<User className="w-3.5 h-3.5 text-slate-400" />} label="Datos Personales" />

                    <div>
                        <label className={labelCls}>Nombre *</label>
                        <input required type="text" value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} placeholder="Nombre" />
                    </div>
                    <div>
                        <label className={labelCls}>Apellidos *</label>
                        <input required type="text" value={apellidos} onChange={e => setApellidos(e.target.value)} className={inputCls} placeholder="Apellidos" />
                    </div>
                    <div>
                        <label className={labelCls}>DNI / NIE</label>
                        <input type="text" value={dni} onChange={e => setDni(e.target.value)} className={inputCls} placeholder="00000000X" />
                    </div>
                    <div>
                        <label className={labelCls}>Fecha de Nacimiento</label>
                        <input type="date" value={fechaNacimiento} onChange={e => setFechaNacimiento(e.target.value)} className={inputCls} />
                    </div>

                    <div className="col-span-2 flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <input type="checkbox" id="minor-anamnesis" checked={isMinor} onChange={e => setIsMinor(e.target.checked)}
                            className="w-4 h-4 rounded text-[#051650] focus:ring-[#051650]" />
                        <label htmlFor="minor-anamnesis" className="text-sm font-bold text-slate-600 flex items-center gap-1.5 cursor-pointer">
                            <Users className="w-3.5 h-3.5 text-slate-400" /> Paciente menor de edad (requiere tutor legal)
                        </label>
                    </div>
                    {isMinor && (
                        <div className="col-span-2">
                            <label className={labelCls}>Tutor Legal *</label>
                            <input required type="text" value={tutor} onChange={e => setTutor(e.target.value)} className={inputCls} placeholder="Nombre completo del tutor" />
                        </div>
                    )}

                    {/* ── CONTACTO ── */}
                    <SectionHeader icon={<Phone className="w-3.5 h-3.5 text-slate-400" />} label="Contacto" />

                    <div>
                        <label className={labelCls}>Móvil *</label>
                        <input required type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className={inputCls} placeholder="600 123 456" />
                    </div>
                    <div>
                        <label className={labelCls}>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="paciente@correo.com" />
                    </div>

                    {/* ── DIRECCIÓN ── */}
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

                    {/* ── PROFESIONAL ── */}
                    <SectionHeader icon={<Briefcase className="w-3.5 h-3.5 text-slate-400" />} label="Datos Profesionales" />

                    <div className="col-span-2">
                        <label className={labelCls}>Profesión / Empresa</label>
                        <input type="text" value={profesion} onChange={e => setProfesion(e.target.value)} className={inputCls} placeholder="Médico, Abogado, Autónomo..." />
                    </div>

                    {/* ── HISTORIAL MÉDICO ── */}
                    <SectionHeader icon={<Shield className="w-3.5 h-3.5 text-[#FF4B68]" />} label="Historial Médico" />

                    <div className="col-span-2">
                        <label className={labelCls}>
                            <AlertTriangle className="w-3 h-3 text-red-500 inline-block mr-1" />
                            Alergias conocidas
                            <span className="text-[10px] normal-case font-medium text-slate-400 ml-1">(separar por coma)</span>
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
            </div>

            {/* Footer sticky */}
            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3 mt-auto">
                <span className="text-[10px] text-slate-400 font-medium">Paciente #{paciente.numPac}</span>
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#051650] text-white rounded-xl text-[12px] font-black uppercase tracking-wider hover:bg-blue-900 active:scale-[0.98] transition-all shadow-lg shadow-[#051650]/20 disabled:opacity-60"
                >
                    {saving
                        ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                        : <>Guardar Cambios</>
                    }
                </button>
            </div>
        </form>
        </div>
    );
};

export default QuestionnairePanel;
