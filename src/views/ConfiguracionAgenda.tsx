import React, { useState, useEffect } from 'react';
import { getConfigAgenda, saveConfigAgenda } from '../services/config-agenda.service';

const ConfiguracionAgenda: React.FC = () => {
    const [doctorActivo, setDoctorActivo] = useState('Dr. Pablo García');
    const [editarId, setEditarId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ nombre: '', especialidad: '' });
    const [saving, setSaving] = useState(false);

    const defaults = {
        doctores: [
            { id: 1, nombre: 'Dr. Pablo García', especialidad: 'Implantología', color: '#003a70' },
            { id: 2, nombre: 'Dra. Elena Rubio', especialidad: 'Ortodoncia', color: '#009fe3' },
            { id: 3, nombre: 'Dra. Sofía Marín', especialidad: 'Estética', color: '#10b981' }
        ],
        horarios: [
            { dia: 'Lunes', mañana: '09:00 - 14:00', tarde: '16:00 - 20:00', activo: true },
            { dia: 'Martes', mañana: '09:00 - 14:00', tarde: '16:00 - 20:00', activo: true },
            { dia: 'Miércoles', mañana: '09:00 - 14:00', tarde: '16:00 - 20:00', activo: true },
            { dia: 'Jueves', mañana: '09:00 - 14:00', tarde: '16:00 - 20:00', activo: true },
            { dia: 'Viernes', mañana: '09:00 - 15:00', tarde: 'Cerrado', activo: true },
            { dia: 'Sábado', mañana: 'Cerrado', tarde: 'Cerrado', activo: false },
            { dia: 'Domingo', mañana: 'Cerrado', tarde: 'Cerrado', activo: false },
        ],
        tratamientos: [
            { nombre: 'Primera Visita', tiempo: 20, color: 'bg-blue-100 text-blue-700' },
            { nombre: 'Limpieza Dental', tiempo: 30, color: 'bg-blue-100 text-[#051650]' },
            { nombre: 'Obturación Simple', tiempo: 45, color: 'bg-purple-100 text-purple-700' },
            { nombre: 'Cirugía Compleja', tiempo: 90, color: 'bg-[#FFE0E6] text-[#C02040]' },
            { nombre: 'Revisión Ortodoncia', tiempo: 15, color: 'bg-orange-100 text-orange-700' },
        ],
    };

    const [doctores, setDoctores] = useState(defaults.doctores);
    const [horarios] = useState(defaults.horarios);
    const [tratamientos] = useState(defaults.tratamientos);

    // V-007: Cargar configuración guardada
    useEffect(() => {
        getConfigAgenda().then(cfg => {
            if (!cfg) return;
            if (cfg.doctores?.length > 0) setDoctores(cfg.doctores);
        });
    }, []);

    const handleSaveConfig = async () => {
        setSaving(true);
        await saveConfigAgenda({ doctores, horarios, tratamientos });
        setSaving(false);
    };





    return (
        <div className="animate-fade-in space-y-6">
            {/* SELECTOR DE DOCTOR */}
            <div className="flex flex-wrap items-center gap-3">
                {doctores.map(doc => {
                    const isEditing = editarId === doc.id;
                    return (
                        <div key={doc.id} className="relative group">
                            <button
                                onClick={() => !isEditing && setDoctorActivo(doc.nombre)}
                                className={`px-5 py-3 rounded-2xl flex items-center gap-3 transition-all border ${doctorActivo === doc.nombre && !isEditing
                                    ? 'bg-secondary text-white border-secondary shadow-lg shadow-secondary/20'
                                    : 'bg-white text-slate-500 border-slate-100 hover:border-secondary/30'
                                    }`}
                            >
                                <div className="w-8 h-8 rounded-full bg-slate-100/20 shadow-inner flex items-center justify-center font-bold text-[13px]">
                                    {isEditing ? '✎' : doc.nombre.split(' ').map(n => n[0]).join('').substring(0, 3)}
                                </div>
                                <div className="text-left">
                                    {isEditing ? (
                                        <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                                            <input
                                                autoFocus
                                                className="text-[13px] font-bold uppercase tracking-tighter leading-none bg-slate-50 border border-slate-200 text-slate-800 px-2 py-1 rounded outline-none w-32 focus:ring-1 focus:ring-secondary"
                                                value={editForm.nombre}
                                                onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                                            />
                                            <input
                                                className="text-[12px] font-bold mt-0.5 bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded outline-none w-32 focus:ring-1 focus:ring-secondary"
                                                value={editForm.especialidad}
                                                onChange={e => setEditForm({ ...editForm, especialidad: e.target.value })}
                                            />
                                            <div className="flex gap-1 mt-1 justify-end">
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDoctores(doctores.map(d => d.id === doc.id ? { ...d, nombre: editForm.nombre, especialidad: editForm.especialidad } : d));
                                                    if (doctorActivo === doc.nombre) setDoctorActivo(editForm.nombre);
                                                    setEditarId(null);
                                                }} className="bg-blue-500 hover:bg-[#051650] text-white text-[12px] font-bold px-3 py-1 rounded">Guardar</button>
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditarId(null);
                                                }} className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-[12px] font-bold px-3 py-1 rounded">Cancelar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-[13px] font-bold uppercase tracking-tighter leading-none">{doc.nombre}</p>
                                            <p className={`text-[12px] font-bold opacity-70 mt-0.5 ${doctorActivo === doc.nombre ? 'text-white' : 'text-slate-400'}`}>{doc.especialidad}</p>
                                        </>
                                    )}
                                </div>
                            </button>
                            {!isEditing && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditarId(doc.id); setEditForm({ nombre: doc.nombre, especialidad: doc.especialidad }); }}
                                    className="absolute -top-2 -right-2 w-7 h-7 bg-white border border-slate-200 text-slate-400 hover:bg-secondary hover:text-white hover:border-secondary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
                                    title="Editar Doctor"
                                >
                                    <span className="material-icons text-[14px]">edit</span>
                                </button>
                            )}
                            {!isEditing && doctores.length > 1 && (
                                <button
                                    onClick={(e) => {
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
                <button
                    onClick={() => {
                        const newId = Math.max(...doctores.map(d => d.id), 0) + 1;
                        const newDoc = { id: newId, nombre: 'Nuevo Doctor', especialidad: 'Especialidad', color: '#003a70' };
                        setDoctores([...doctores, newDoc]);
                        setEditarId(newId);
                        setEditForm({ nombre: newDoc.nombre, especialidad: newDoc.especialidad });
                    }}
                    className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-secondary hover:text-secondary hover:bg-secondary/5 transition-all flex items-center justify-center"
                    title="Añadir Doctor"
                >
                    <span className="material-icons">add</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* HORARIOS SEMANALES */}
                <div className="lg:col-span-8 space-y-6">
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-primary dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons text-secondary">schedule</span>
                                Horario Base Semanal
                            </h3>
                            <button className="text-[12px] font-bold text-secondary uppercase hover:underline">Replicar en Gabinetes</button>
                        </div>
                        <div className="space-y-3">
                            {horarios.map(h => (
                                <div key={h.dia} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${h.activo ? 'bg-slate-50 border-slate-100' : 'bg-slate-50/50 border-transparent opacity-50'}`}>
                                    <div className="w-24 text-[13px] font-bold text-slate-600 uppercase tracking-tighter">{h.dia}</div>
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="material-icons text-slate-300 text-sm">wb_sunny</span>
                                            <input type="text" defaultValue={h.mañana} className="bg-transparent text-[13px] font-bold w-full focus:outline-none" />
                                        </div>
                                        <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="material-icons text-slate-300 text-sm">dark_mode</span>
                                            <input type="text" defaultValue={h.tarde} className="bg-transparent text-[13px] font-bold w-full focus:outline-none" />
                                        </div>
                                    </div>
                                    <button className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${h.activo ? 'bg-secondary/10 text-secondary' : 'bg-slate-200 text-slate-400'}`}>
                                        <span className="material-icons text-lg">{h.activo ? 'check_circle' : 'do_not_disturb_on'}</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* BLOQUEOS Y EXCEPCIONES */}
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-primary dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons text-red-500">event_busy</span>
                                Bloqueos y Aperturas Especiales
                            </h3>
                            <button className="bg-primary text-white text-[12px] font-bold px-4 py-2 rounded-xl uppercase tracking-widest shadow-lg shadow-primary/20">Añadir Excepción</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-red-100 bg-[#FFF0F3]/30 p-4 rounded-2xl flex items-center gap-4">
                                <div className="p-3 bg-[#FFE0E6] text-[#E03555] rounded-xl font-bold text-center leading-tight">
                                    <span className="block text-[13px]">OCT</span>
                                    <span className="text-xl">12</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[13px] font-bold text-slate-800">Festivo Nacional</p>
                                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-tighter">Agenda Cerrada Todo el día</p>
                                </div>
                                <button className="material-icons text-slate-300 hover:text-red-500">delete</button>
                            </div>
                            <div className="border border-blue-100 bg-blue-50/30 p-4 rounded-2xl flex items-center gap-4">
                                <div className="p-3 bg-blue-100 text-[#051650] rounded-xl font-bold text-center leading-tight">
                                    <span className="block text-[13px]">OCT</span>
                                    <span className="text-xl">14</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[13px] font-bold text-slate-800">Apertura Sábado</p>
                                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-tighter">09:00 - 14:00 (Urgencias)</p>
                                </div>
                                <button className="material-icons text-slate-300 hover:text-red-500">delete</button>
                            </div>
                        </div>
                    </section>
                </div>

                {/* TRATAMIENTOS Y TIEMPOS */}
                <div className="lg:col-span-4 space-y-6">
                    <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl h-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-primary dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons text-secondary">timer</span>
                                Tiempos Estimados
                            </h3>
                        </div>
                        <p className="text-[12px] text-slate-400 font-bold uppercase tracking-tighter mb-6">Duración personalizada por doctor para optimizar la agenda.</p>
                        <div className="space-y-2">
                            {tratamientos.map((t, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-secondary/50 transition-all">
                                    <div className="flex flex-col">
                                        <span className="text-[13px] font-bold text-slate-700 leading-tight">{t.nombre}</span>
                                        <span className={`text-[12px] font-bold uppercase tracking-tighter mt-0.5 px-1.5 py-0.5 rounded-full ${t.color} inline-block self-start`}>Categoría</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" defaultValue={t.tiempo} className="w-12 bg-white border border-slate-200 rounded-lg text-center font-bold text-[13px] py-1" />
                                        <span className="text-[12px] font-bold text-slate-400 uppercase tracking-tighter">min</span>
                                    </div>
                                </div>
                            ))}
                            <button className="w-full py-4 mt-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-[12px] uppercase tracking-widest hover:border-secondary hover:text-secondary transition-all">
                                + Nuevo Tratamiento
                            </button>
                        </div>
                    </section>
                </div>

            </div>

            {/* BOTÓN GUARDAR — sticky para que sea visible al hacer scroll */}
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