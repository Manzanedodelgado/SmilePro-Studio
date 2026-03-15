// ── ConfiguracionAgenda.tsx — Configuración INDIVIDUAL por doctor ─────────────
import React, { useState, useEffect, useCallback } from 'react';
import { getConfigAgenda, saveConfigAgenda } from '../services/config-agenda.service';
import { getTratamientosAgenda, getDoctoresAgenda } from '../services/agenda-config.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Horario { dia: string; mañana: string; tarde: string; activo: boolean; }
interface Tratamiento { nombre: string; color: string; }
interface Excepcion { id: number; mes: string; dia: number; titulo: string; desc: string; color: 'red' | 'blue'; }
interface Doctor { id: number; nombre: string; especialidad: string; color: string; }
interface DoctorConfig { horarios: Horario[]; tiempos: Record<string, number>; }

// ── Constantes ────────────────────────────────────────────────────────────────
const COLORS = ['#003a70','#009fe3','#10b981','#8b5cf6','#f59e0b','#ef4444'];

const DEFAULT_HORARIOS: Horario[] = [
    { dia: 'Lunes',     mañana: '09:00 - 14:00', tarde: '16:00 - 20:00', activo: true  },
    { dia: 'Martes',    mañana: '09:00 - 14:00', tarde: '16:00 - 20:00', activo: true  },
    { dia: 'Miércoles', mañana: '09:00 - 14:00', tarde: '16:00 - 20:00', activo: true  },
    { dia: 'Jueves',    mañana: '09:00 - 14:00', tarde: '16:00 - 20:00', activo: true  },
    { dia: 'Viernes',   mañana: '09:00 - 15:00', tarde: 'Cerrado',       activo: true  },
    { dia: 'Sábado',    mañana: 'Cerrado',        tarde: 'Cerrado',       activo: false },
    { dia: 'Domingo',   mañana: 'Cerrado',        tarde: 'Cerrado',       activo: false },
];

const DEFAULT_TIEMPOS: Record<string, number> = {
    'Control': 15, 'Urgencia': 30, 'Endodoncia': 90, 'Reconstruccion': 45,
    'Protesis Fija': 60, 'Protesis Removible': 60, 'Cirugia/Injerto': 90,
    'Exodoncia': 30, 'Periodoncia': 60, 'Higiene Dental': 45,
    'Cirugia de Implante': 120, 'Primera Visita': 20, 'Ajuste Prot/tto': 30,
    'Retirar Ortodoncia': 30, 'Colocacion Ortodoncia': 60,
    'Mensualidad Ortodoncia': 20, 'Estudio Ortodoncia': 45,
    'Blanqueamiento': 60, 'Rx/escaner': 15,
};

const COLOR_MAP: Record<string, string> = {
    'Control': 'bg-blue-100 text-[#051650]', 'Urgencia': 'bg-red-100 text-red-700',
    'Endodoncia': 'bg-purple-100 text-purple-700', 'Reconstruccion': 'bg-amber-100 text-amber-700',
    'Protesis Fija': 'bg-orange-100 text-orange-700', 'Protesis Removible': 'bg-orange-100 text-orange-600',
    'Cirugia/Injerto': 'bg-rose-100 text-rose-700', 'Exodoncia': 'bg-rose-100 text-rose-600',
    'Periodoncia': 'bg-pink-100 text-pink-700', 'Higiene Dental': 'bg-emerald-100 text-emerald-700',
    'Cirugia de Implante': 'bg-cyan-100 text-cyan-700', 'Primera Visita': 'bg-blue-100 text-blue-700',
    'Ajuste Prot/tto': 'bg-slate-100 text-slate-600', 'Retirar Ortodoncia': 'bg-violet-100 text-violet-700',
    'Colocacion Ortodoncia': 'bg-violet-100 text-violet-600', 'Mensualidad Ortodoncia': 'bg-indigo-100 text-indigo-600',
    'Estudio Ortodoncia': 'bg-indigo-100 text-indigo-700', 'Blanqueamiento': 'bg-yellow-100 text-yellow-700',
    'Rx/escaner': 'bg-slate-100 text-slate-500',
};

// ─────────────────────────────────────────────────────────────────────────────
const ConfiguracionAgenda: React.FC = () => {
    const [doctores,     setDoctores]     = useState<Doctor[]>([]);
    const [doctorActivo, setDoctorActivo] = useState<string>('');
    const [editarId,     setEditarId]     = useState<number | null>(null);
    const [editForm,     setEditForm]     = useState({ nombre: '', especialidad: '' });

    // Config por doctor: horarios y tiempos son propios de cada uno
    const [configPorDoctor, setConfigPorDoctor] = useState<Record<string, DoctorConfig>>({});

    // Tratamientos globales (nombre + color)
    const [tratamientos, setTratamientos] = useState<Tratamiento[]>([]);

    // Excepciones globales de la clínica
    const [excepciones, setExcepciones] = useState<Excepcion[]>([
        { id: 1, mes: 'OCT', dia: 12, titulo: 'Festivo Nacional', desc: 'Agenda Cerrada Todo el día', color: 'red' },
        { id: 2, mes: 'OCT', dia: 14, titulo: 'Apertura Sábado',  desc: '09:00 - 14:00 (Urgencias)', color: 'blue' },
    ]);
    const [addingExc, setAddingExc] = useState(false);
    const [newExc, setNewExc] = useState({ mes: 'ENE', dia: '1', titulo: '', desc: '', color: 'red' as 'red' | 'blue' });

    const [saving,   setSaving]   = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3500); };

    // ── Config del doctor activo (o defaults si no tiene) ────────────────────
    const cfgActivo: DoctorConfig = configPorDoctor[doctorActivo] ?? {
        horarios: DEFAULT_HORARIOS.map(h => ({ ...h })),
        tiempos: { ...DEFAULT_TIEMPOS },
    };

    const setHorariosDoctor = useCallback((fn: (h: Horario[]) => Horario[]) => {
        setConfigPorDoctor(prev => {
            const old = prev[doctorActivo] ?? { horarios: DEFAULT_HORARIOS.map(h => ({ ...h })), tiempos: { ...DEFAULT_TIEMPOS } };
            return { ...prev, [doctorActivo]: { ...old, horarios: fn(old.horarios) } };
        });
    }, [doctorActivo]);

    const setTiempoDoctor = useCallback((nombre: string, valor: number) => {
        setConfigPorDoctor(prev => {
            const old = prev[doctorActivo] ?? { horarios: DEFAULT_HORARIOS.map(h => ({ ...h })), tiempos: { ...DEFAULT_TIEMPOS } };
            return { ...prev, [doctorActivo]: { ...old, tiempos: { ...old.tiempos, [nombre]: valor } } };
        });
    }, [doctorActivo]);

    const setHorarioField = useCallback((dia: string, field: 'mañana' | 'tarde', value: string) => {
        setConfigPorDoctor(prev => {
            const old = prev[doctorActivo] ?? { horarios: DEFAULT_HORARIOS.map(h => ({ ...h })), tiempos: { ...DEFAULT_TIEMPOS } };
            return { ...prev, [doctorActivo]: { ...old, horarios: old.horarios.map(h => h.dia === dia ? { ...h, [field]: value } : h) } };
        });
    }, [doctorActivo]);

    // ── Carga inicial ────────────────────────────────────────────────────────
    useEffect(() => {
        Promise.all([getDoctoresAgenda(), getTratamientosAgenda(), getConfigAgenda()]).then(([drs, ttos, cfg]) => {
            const base: Doctor[] = drs.map((d, i) => ({
                id: d.idUsu,
                nombre: d.nombreCompleto || d.nombre,
                especialidad: 'Doctor/a',
                color: COLORS[i % COLORS.length],
            }));

            // Merge con config guardada si existe
            if (cfg?.doctores?.length > 0) {
                const merged = base.map(b => {
                    const s = cfg.doctores.find((x: any) => x.id === b.id || x.nombre === b.nombre);
                    return s ? { ...b, especialidad: s.especialidad ?? b.especialidad, color: s.color ?? b.color } : b;
                });
                setDoctores(merged);
                setDoctorActivo(merged[0]?.nombre ?? '');
            } else {
                setDoctores(base);
                setDoctorActivo(base[0]?.nombre ?? '');
            }

            // Config por doctor guardada
            if (cfg?.configPorDoctor) setConfigPorDoctor(cfg.configPorDoctor);

            // Tratamientos reales
            setTratamientos(ttos.map(t => ({ nombre: t.descripcion, color: COLOR_MAP[t.descripcion] ?? 'bg-slate-100 text-slate-600' })));
        });
    }, []);

    const handleSaveConfig = async () => {
        setSaving(true);
        await saveConfigAgenda({ doctores, horarios: cfgActivo.horarios, tratamientos: tratamientos as any, configPorDoctor });
        setSaving(false);
        showToast('Configuración guardada correctamente');
    };

    const doctorObj = doctores.find(d => d.nombre === doctorActivo);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="animate-fade-in space-y-6">
            {/* Toast */}
            {toastMsg && (
                <div className="fixed bottom-6 right-6 z-[9999] bg-[#051650] text-white text-[13px] font-bold px-5 py-3 rounded-xl shadow-2xl">
                    ✓ {toastMsg}
                </div>
            )}

            {/* ── SELECTOR DE DOCTOR ─────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Selecciona un doctor para editar su configuración</p>
                <div className="flex flex-wrap items-center gap-3">
                    {doctores.map(doc => {
                        const isEditing = editarId === doc.id;
                        const isActive  = doctorActivo === doc.nombre;
                        return (
                            <div key={doc.id} className="relative group">
                                <button
                                    onClick={() => !isEditing && setDoctorActivo(doc.nombre)}
                                    className={`px-5 py-3 rounded-2xl flex items-center gap-3 transition-all border ${
                                        isActive && !isEditing
                                            ? 'text-white border-secondary shadow-lg shadow-secondary/20'
                                            : 'bg-white text-slate-500 border-slate-100 hover:border-secondary/30'
                                    }`}
                                    style={isActive && !isEditing ? { backgroundColor: doc.color, borderColor: doc.color } : {}}
                                >
                                    <div className="w-8 h-8 rounded-full bg-white/20 shadow-inner flex items-center justify-center font-black text-[13px]">
                                        {isEditing ? '✎' : doc.nombre.split(' ').map(n => n[0]).join('').substring(0, 3)}
                                    </div>
                                    <div className="text-left">
                                        {isEditing ? (
                                            <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                                                <input autoFocus
                                                    className="text-[13px] font-bold bg-slate-50 border border-slate-200 text-slate-800 px-2 py-1 rounded outline-none w-40 focus:ring-1 focus:ring-secondary"
                                                    value={editForm.nombre}
                                                    onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                                                    placeholder="Nombre completo"
                                                />
                                                <input
                                                    className="text-[12px] font-bold bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded outline-none w-40 focus:ring-1 focus:ring-secondary"
                                                    value={editForm.especialidad}
                                                    onChange={e => setEditForm({ ...editForm, especialidad: e.target.value })}
                                                    placeholder="Especialidad"
                                                />
                                                <div className="flex gap-1 mt-1 justify-end">
                                                    <button onClick={e => {
                                                        e.stopPropagation();
                                                        setDoctores(doctores.map(d => d.id === doc.id ? { ...d, nombre: editForm.nombre, especialidad: editForm.especialidad } : d));
                                                        if (doctorActivo === doc.nombre) setDoctorActivo(editForm.nombre);
                                                        setEditarId(null);
                                                    }} className="bg-[#051650] text-white text-[12px] font-bold px-3 py-1 rounded">✓ Guardar</button>
                                                    <button onClick={e => { e.stopPropagation(); setEditarId(null); }}
                                                        className="bg-slate-200 text-slate-600 text-[12px] font-bold px-3 py-1 rounded">Cancelar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-[13px] font-bold uppercase tracking-tighter leading-none">{doc.nombre}</p>
                                                <p className={`text-[12px] font-medium mt-0.5 ${isActive ? 'text-white/80' : 'text-slate-400'}`}>{doc.especialidad}</p>
                                            </>
                                        )}
                                    </div>
                                </button>

                                {/* Botón editar */}
                                {!isEditing && (
                                    <button
                                        onClick={e => { e.stopPropagation(); setEditarId(doc.id); setEditForm({ nombre: doc.nombre, especialidad: doc.especialidad }); }}
                                        className="absolute -top-2 -right-2 w-7 h-7 bg-white border border-slate-200 text-slate-400 hover:bg-secondary hover:text-white hover:border-secondary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
                                        title="Editar Doctor"
                                    >
                                        <span className="material-icons text-[14px]">edit</span>
                                    </button>
                                )}
                                {/* Botón eliminar */}
                                {!isEditing && doctores.length > 1 && (
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            if (confirm(`¿Eliminar a ${doc.nombre}?`)) {
                                                const newDocs = doctores.filter(d => d.id !== doc.id);
                                                setDoctores(newDocs);
                                                if (doctorActivo === doc.nombre) setDoctorActivo(newDocs[0].nombre);
                                            }
                                        }}
                                        className="absolute -bottom-2 -right-2 w-6 h-6 bg-[#FFE0E6] border border-white text-red-500 hover:bg-red-500 hover:text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                                        title="Eliminar Doctor"
                                    >
                                        <span className="material-icons text-[12px]">delete</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── BANNER DOCTOR ACTIVO ──────────────────────────────────── */}
            {doctorObj && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-white text-[13px] font-bold shadow-sm"
                     style={{ background: `linear-gradient(135deg, ${doctorObj.color}, ${doctorObj.color}cc)` }}>
                    <span className="material-icons text-base">person</span>
                    Editando configuración de <span className="underline underline-offset-2">{doctorObj.nombre}</span>
                    <span className="ml-auto text-white/70 text-[11px] font-medium normal-case">Los cambios afectan solo a este doctor</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* ── HORARIOS SEMANALES ─────────────────────────────────── */}
                <div className="lg:col-span-8 space-y-6">
                    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons text-secondary">schedule</span>
                                Horario Semanal
                            </h3>
                            <button
                                onClick={() => {
                                    // Replicar este horario a todos los doctores
                                    const horariosActuales = cfgActivo.horarios;
                                    setConfigPorDoctor(prev => {
                                        const newCfg = { ...prev };
                                        doctores.forEach(d => {
                                            if (d.nombre !== doctorActivo) {
                                                newCfg[d.nombre] = { ...(prev[d.nombre] ?? { tiempos: { ...DEFAULT_TIEMPOS } }), horarios: horariosActuales.map(h => ({ ...h })) };
                                            }
                                        });
                                        return newCfg;
                                    });
                                    showToast('Horario replicado a todos los doctores');
                                }}
                                className="text-[12px] font-bold text-secondary uppercase hover:underline"
                            >
                                Replicar a todos
                            </button>
                        </div>
                        <div className="space-y-3">
                            {cfgActivo.horarios.map(h => (
                                <div key={h.dia} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${h.activo ? 'bg-slate-50 border-slate-100' : 'bg-slate-50/50 border-transparent opacity-50'}`}>
                                    <div className="w-24 text-[13px] font-bold text-slate-600 uppercase tracking-tighter">{h.dia}</div>
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="material-icons text-slate-300 text-sm">wb_sunny</span>
                                            <input type="text" value={h.mañana}
                                                onChange={e => setHorarioField(h.dia, 'mañana', e.target.value)}
                                                className="bg-transparent text-[13px] font-bold w-full focus:outline-none" />
                                        </div>
                                        <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="material-icons text-slate-300 text-sm">dark_mode</span>
                                            <input type="text" value={h.tarde}
                                                onChange={e => setHorarioField(h.dia, 'tarde', e.target.value)}
                                                className="bg-transparent text-[13px] font-bold w-full focus:outline-none" />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setHorariosDoctor(hs => hs.map(x => x.dia === h.dia ? { ...x, activo: !x.activo } : x))}
                                        title={h.activo ? 'Desactivar día' : 'Activar día'}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${h.activo ? 'bg-secondary/10 text-secondary' : 'bg-slate-200 text-slate-400'}`}>
                                        <span className="material-icons text-lg">{h.activo ? 'check_circle' : 'do_not_disturb_on'}</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── BLOQUEOS Y EXCEPCIONES (globales de clínica) ────── */}
                    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons text-red-500">event_busy</span>
                                Bloqueos de Clínica
                            </h3>
                            <button onClick={() => setAddingExc(true)} className="bg-primary text-white text-[12px] font-bold px-4 py-2 rounded-xl uppercase tracking-widest shadow-lg shadow-primary/20">Añadir</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {excepciones.map(exc => (
                                <div key={exc.id} className={`border p-4 rounded-2xl flex items-center gap-4 ${exc.color === 'red' ? 'border-red-100 bg-[#FFF0F3]/30' : 'border-blue-100 bg-blue-50/30'}`}>
                                    <div className={`p-3 rounded-xl font-bold text-center leading-tight ${exc.color === 'red' ? 'bg-[#FFE0E6] text-[#E03555]' : 'bg-blue-100 text-[#051650]'}`}>
                                        <span className="block text-[13px]">{exc.mes}</span>
                                        <span className="text-xl">{exc.dia}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[13px] font-bold text-slate-800">{exc.titulo}</p>
                                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-tighter">{exc.desc}</p>
                                    </div>
                                    <button onClick={() => setExcepciones(excepciones.filter(e => e.id !== exc.id))}
                                        className="material-icons text-slate-300 hover:text-red-500 transition-colors" title="Eliminar">delete</button>
                                </div>
                            ))}
                        </div>
                        {addingExc && (
                            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                <p className="text-[13px] font-black text-slate-700 uppercase tracking-widest">Nueva Excepción</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Mes</label>
                                        <input type="text" maxLength={3} value={newExc.mes} onChange={e => setNewExc({...newExc, mes: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold uppercase text-center" />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Día</label>
                                        <input type="number" min={1} max={31} value={newExc.dia} onChange={e => setNewExc({...newExc, dia: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-center" />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Tipo</label>
                                        <select value={newExc.color} onChange={e => setNewExc({...newExc, color: e.target.value as 'red'|'blue'})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                                            <option value="red">Cierre</option>
                                            <option value="blue">Apertura</option>
                                        </select>
                                    </div>
                                </div>
                                <input type="text" placeholder="Título (ej: Festivo Nacional)" value={newExc.titulo} onChange={e => setNewExc({...newExc, titulo: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" />
                                <input type="text" placeholder="Descripción" value={newExc.desc} onChange={e => setNewExc({...newExc, desc: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" />
                                <div className="flex gap-2">
                                    <button onClick={() => {
                                        if (!newExc.titulo.trim()) return;
                                        const newId = Math.max(...excepciones.map(e => e.id), 0) + 1;
                                        setExcepciones([...excepciones, { id: newId, mes: newExc.mes, dia: parseInt(newExc.dia), titulo: newExc.titulo, desc: newExc.desc, color: newExc.color }]);
                                        setAddingExc(false);
                                        setNewExc({ mes: 'ENE', dia: '1', titulo: '', desc: '', color: 'red' });
                                    }} className="flex-1 py-2 bg-primary text-white rounded-xl text-[12px] font-bold uppercase">Añadir</button>
                                    <button onClick={() => setAddingExc(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-[12px] font-bold text-slate-500">Cancelar</button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                {/* ── TIEMPOS ESTIMADOS (por doctor) ────────────────────── */}
                <div className="lg:col-span-4 space-y-6">
                    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons text-secondary">timer</span>
                                Tiempos Estimados
                            </h3>
                        </div>
                        <p className="text-[12px] text-slate-400 font-bold uppercase tracking-tighter mb-4">
                            Minutos por tratamiento para {doctorObj?.nombre ?? 'este doctor'}
                        </p>
                        <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                            {tratamientos.map(t => (
                                <div key={t.nombre} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-secondary/30 transition-all">
                                    <div className="flex flex-col min-w-0 flex-1 mr-3">
                                        <span className="text-[13px] font-bold text-slate-700 leading-tight truncate">{t.nombre}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-tighter mt-0.5 px-1.5 py-0.5 rounded-full ${t.color} inline-block self-start`}>
                                            {t.color.includes('blue') ? 'Control' : t.color.includes('red') ? 'Urgencia' : t.color.includes('purple') ? 'Endodoncia' : t.color.includes('emerald') ? 'Higiene' : t.color.includes('cyan') ? 'Implante' : t.color.includes('violet') ? 'Ortodoncia' : 'General'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <input
                                            type="number"
                                            min={5} max={300} step={5}
                                            value={cfgActivo.tiempos[t.nombre] ?? DEFAULT_TIEMPOS[t.nombre] ?? 30}
                                            onChange={e => setTiempoDoctor(t.nombre, parseInt(e.target.value) || 30)}
                                            className="w-14 bg-white border border-slate-200 rounded-lg text-center font-bold text-[13px] py-1 focus:outline-none focus:ring-1 focus:ring-secondary"
                                        />
                                        <span className="text-[11px] font-bold text-slate-400">min</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            {/* ── GUARDAR ──────────────────────────────────────────────── */}
            <div className="sticky bottom-0 pt-4 pb-2 flex justify-end bg-gradient-to-t from-[#f8fafc] to-transparent pointer-events-none">
                <button
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="pointer-events-auto bg-secondary text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest shadow-2xl shadow-secondary/40 flex items-center gap-3 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50"
                >
                    <span className="material-icons">save</span>
                    {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
            </div>
        </div>
    );
};

export default ConfiguracionAgenda;