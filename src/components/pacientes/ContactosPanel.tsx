
import React, { useState, useEffect, useCallback } from 'react';
import {
    getContactosActivos,
    buscarContactos,
    actualizarEstadoContacto,
    convertirContactoEnPaciente,
    generarMensajeBienvenidaContacto,
    type Contacto,
    type ContactoEstado,
} from '../../services/contactos.service';
import { crearQuestionnaireToken } from '../../services/questionnaire.service';

// ── Helpers ────────────────────────────────────────────────────────

const estadoLabel: Record<ContactoEstado, { label: string; cls: string }> = {
    potencial: { label: '⏳ Potencial', cls: 'bg-[#FEFDE8] text-[#051650] border-[#FBFFA3]' },
    confirmado: { label: '✅ Confirmado', cls: 'bg-blue-50 text-[#051650] border-green-200' },
    convertido: { label: '🎉 Paciente', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    cancelado: { label: '❌ Cancelado', cls: 'bg-[#FFF0F3] text-[#E03555] border-[#FFC0CB]' },
    no_acudio: { label: '👻 No acudió', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const fmt = (d?: string) => d
    ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

// ── Subcomponente: Modal Convertir ─────────────────────────────────

interface ConvertModalProps {
    contacto: Contacto;
    onClose: () => void;
    onConverted: (numPac: string) => void;
}

const ConvertModal: React.FC<ConvertModalProps> = ({ contacto, onClose, onConverted }) => {
    const [numPac, setNumPac] = useState('');
    const [idPac, setIdPac] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handle = async () => {
        if (!numPac.trim()) { setErr('El NumPac es obligatorio'); return; }
        setSaving(true);
        const ok = await convertirContactoEnPaciente(contacto.id, numPac.trim());
        setSaving(false);
        if (ok) onConverted(numPac.trim());
        else setErr('Error al convertir. Comprueba que el NumPac es correcto.');
    };

    return (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-[#051650] to-[#0056b3] px-6 py-4">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                        🎉 Convertir en Paciente
                    </h3>
                    <p className="text-blue-200 text-[13px] mt-1">
                        Introduce el NumPac asignado en GELITE tras crear el expediente
                    </p>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-wide mb-1">Contacto</p>
                        <p className="font-bold text-slate-800">{contacto.nombre} {contacto.apellidos}</p>
                        <p className="text-[13px] text-slate-500">📞 {contacto.telefono}</p>
                    </div>
                    <div>
                        <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            NumPac (GELITE) <span className="text-[#FF4B68]">*</span>
                        </label>
                        <input
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-[#051650] focus:ring-0 focus:border-[#0056b3] outline-none transition-colors"
                            placeholder="Ej: 1234"
                            value={numPac}
                            onChange={e => setNumPac(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            IdPac (opcional)
                        </label>
                        <input
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#051650] focus:ring-0 focus:border-[#0056b3] outline-none transition-colors"
                            placeholder="ID cliente GELITE"
                            value={idPac}
                            onChange={e => setIdPac(e.target.value)}
                        />
                    </div>
                    {err && <p className="text-[13px] text-red-500">⚠️ {err}</p>}
                </div>
                <div className="px-5 pb-5 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all">
                        Cancelar
                    </button>
                    <button onClick={handle} disabled={saving}
                        className="flex-1 py-2.5 bg-[#051650] text-white rounded-xl text-sm font-bold hover:bg-[#0056b3] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                        {saving ? <><span className="animate-spin material-icons text-sm">refresh</span> Guardando...</> : '✅ Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Subcomponente: Modal WhatsApp ──────────────────────────────────

interface WaModalProps { contacto: Contacto; onClose: () => void; }

const WaModal: React.FC<WaModalProps> = ({ contacto, onClose }) => {
    const [link, setLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Generar nuevo token (72h antes de la cita o ahora + 7 días)
        const fechaCita = contacto.fechaCitaPrevista
            ? new Date(contacto.fechaCitaPrevista)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        crearQuestionnaireToken(contacto.id, fechaCita, 'contacto')
            .then(url => setLink(url))
            .finally(() => setLoading(false));
    }, [contacto]);

    const mensaje = link
        ? generarMensajeBienvenidaContacto(contacto, contacto.fechaCitaPrevista
            ? new Date(contacto.fechaCitaPrevista).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
            : 'próximamente', link)
        : '';

    const copy = () => {
        navigator.clipboard.writeText(mensaje).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    };

    const openWa = () => {
        const tel = contacto.telefono.replace(/\D/g, '');
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="bg-[#25D366] px-6 py-4">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                        💬 Enviar por WhatsApp
                    </h3>
                    <p className="text-green-100 text-[13px] mt-1">
                        {contacto.nombre} {contacto.apellidos} · 📞 {contacto.telefono}
                    </p>
                </div>
                <div className="p-5">
                    {loading ? (
                        <div className="flex items-center gap-3 py-8 justify-center text-slate-400">
                            <span className="material-icons animate-spin">refresh</span>
                            <span className="text-sm">Generando enlace de cuestionario...</span>
                        </div>
                    ) : (
                        <>
                            <div className="bg-[#ECE5DD] rounded-xl p-4 mb-4 text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto">
                                {mensaje}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={copy} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${copied ? 'bg-blue-100 text-[#051650] border border-teal-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                    {copied ? '✅ Copiado' : '📋 Copiar mensaje'}
                                </button>
                                <button onClick={openWa} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1da851] shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2">
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M11.5 2C6.262 2 2 6.262 2 11.5c0 1.773.481 3.434 1.316 4.864L2 22l5.766-1.292A9.464 9.464 0 0011.5 21c5.238 0 9.5-4.262 9.5-9.5S16.738 2 11.5 2zm0 17.25c-1.648 0-3.177-.472-4.466-1.283l-.32-.19-3.32.744.789-3.249-.208-.335A7.712 7.712 0 013.75 11.5C3.75 7.224 7.224 3.75 11.5 3.75s7.75 3.474 7.75 7.75-3.474 7.75-7.75 7.75z" /></svg>
                                    Abrir WhatsApp
                                </button>
                            </div>
                        </>
                    )}
                </div>
                <div className="px-5 pb-4">
                    <button onClick={onClose} className="w-full py-2 text-[13px] text-slate-400 hover:text-slate-600 transition-colors">Cerrar</button>
                </div>
            </div>
        </div>
    );
};

// ── Componente principal ──────────────────────────────────────────

const ContactosPanel: React.FC = () => {
    const [contactos, setContactos] = useState<Contacto[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [converting, setConverting] = useState<Contacto | null>(null);
    const [waTarget, setWaTarget] = useState<Contacto | null>(null);
    const [filterEstado, setFilterEstado] = useState<ContactoEstado | 'todos'>('todos');
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

    const reload = useCallback(async () => {
        setLoading(true);
        const data = await getContactosActivos();
        setContactos(data);
        setLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const handleSearch = async (q: string) => {
        setSearch(q);
        if (q.trim().length >= 2) {
            const r = await buscarContactos(q.trim());
            setContactos(r);
        } else if (!q.trim()) {
            reload();
        }
    };

    const handleEstado = async (c: Contacto, estado: ContactoEstado) => {
        await actualizarEstadoContacto(c.id, estado);
        setContactos(prev => prev.map(x => x.id === c.id ? { ...x, estado } : x));
    };

    const handleConverted = (contacto: Contacto, numPac: string) => {
        setContactos(prev => prev.map(x => x.id === contacto.id ? { ...x, estado: 'convertido', numPac } : x));
        setConverting(null);
        showToast(`✅ ${contacto.nombre} convertido/a en paciente (NumPac: ${numPac})`);
    };

    const visible = contactos.filter(c =>
        filterEstado === 'todos' || c.estado === filterEstado
    );

    const counts: Record<string, number> = {};
    contactos.forEach(c => { counts[c.estado] = (counts[c.estado] ?? 0) + 1; });

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-slate-950 overflow-hidden">

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-[600] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold animate-fade-in">
                    {toast}
                </div>
            )}

            {/* Modals */}
            {converting && (
                <ConvertModal
                    contacto={converting}
                    onClose={() => setConverting(null)}
                    onConverted={numPac => handleConverted(converting, numPac)}
                />
            )}
            {waTarget && (
                <WaModal
                    contacto={waTarget}
                    onClose={() => setWaTarget(null)}
                />
            )}

            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex-shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base font-bold text-[#051650] dark:text-white flex items-center gap-2">
                            <span className="material-icons text-lg text-orange-500">person_add</span>
                            Contactos — Primera Visita
                        </h2>
                        <p className="text-[13px] text-slate-400 mt-0.5">
                            Personas con cita pendiente sin expediente en GELITE todavía
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Buscar por nombre o teléfono..."
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                            className="px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0056b3] w-64 text-slate-700 placeholder:text-slate-500"
                        />
                        <button onClick={reload} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                            <span className="material-icons text-base">refresh</span>
                        </button>
                    </div>
                </div>

                {/* Filtros de estado */}
                <div className="flex gap-2 mt-3 flex-wrap">
                    {(['todos', 'potencial', 'confirmado', 'no_acudio', 'cancelado', 'convertido'] as const).map(e => (
                        <button key={e} onClick={() => setFilterEstado(e)}
                            className={`text-[13px] font-bold px-3 py-1 rounded-full border transition-all ${filterEstado === e ? 'bg-[#051650] text-white border-[#051650]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                            {e === 'todos' ? `Todos (${contactos.length})` : `${estadoLabel[e as ContactoEstado].label} (${counts[e] ?? 0})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
                        <span className="material-icons animate-spin">refresh</span>
                        <span className="text-sm font-bold">Cargando contactos...</span>
                    </div>
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500">
                        <span className="material-icons text-5xl">person_search</span>
                        <p className="text-sm font-bold uppercase tracking-wide">Sin contactos{filterEstado !== 'todos' ? ` (${filterEstado})` : ''}</p>
                        <p className="text-[13px] text-slate-400 text-center max-w-xs">
                            Los contactos se crean automáticamente al añadir una cita de tipo "Primera Visita" en la agenda.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {visible.map(c => (
                            <div key={c.id} className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm p-5 flex flex-col gap-3 transition-all hover:shadow-md ${c.estado === 'convertido' ? 'border-blue-100 opacity-70' : 'border-slate-100 dark:border-slate-800'}`}>
                                {/* Top row */}
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-sm leading-tight">
                                            {c.nombre} {c.apellidos}
                                        </p>
                                        <p className="text-[13px] text-slate-400 mt-0.5">📞 {c.telefono}</p>
                                        {c.email && <p className="text-[13px] text-slate-400">✉️ {c.email}</p>}
                                    </div>
                                    <span className={`text-[12px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${estadoLabel[c.estado].cls}`}>
                                        {estadoLabel[c.estado].label}
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="text-[13px] text-slate-500 space-y-0.5">
                                    {c.fechaCitaPrevista && <p>📅 Cita: <strong className="text-slate-700">{fmt(c.fechaCitaPrevista)}</strong></p>}
                                    {c.doctorAsignado && <p>👨‍⚕️ Dr: <strong className="text-slate-700">{c.doctorAsignado}</strong></p>}
                                    {c.numPac && <p>🆔 NumPac: <strong className="text-[#051650]">{c.numPac}</strong></p>}
                                    <p>Creado: {fmt(c.createdAt)}</p>
                                </div>

                                {/* Acciones */}
                                {c.estado !== 'convertido' && (
                                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-50 dark:border-slate-800">
                                        <button
                                            onClick={() => setWaTarget(c)}
                                            className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366] text-white text-[13px] font-bold hover:bg-[#1da851] transition-all shadow-sm shadow-green-500/20">
                                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M11.5 2C6.262 2 2 6.262 2 11.5c0 1.773.481 3.434 1.316 4.864L2 22l5.766-1.292A9.464 9.464 0 0011.5 21c5.238 0 9.5-4.262 9.5-9.5S16.738 2 11.5 2zm0 17.25c-1.648 0-3.177-.472-4.466-1.283l-.32-.19-3.32.744.789-3.249-.208-.335A7.712 7.712 0 013.75 11.5C3.75 7.224 7.224 3.75 11.5 3.75s7.75 3.474 7.75 7.75-3.474 7.75-7.75 7.75z" /></svg>
                                            WhatsApp
                                        </button>
                                        <button
                                            onClick={() => setConverting(c)}
                                            className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#051650] text-white text-[13px] font-bold hover:bg-[#0056b3] transition-all">
                                            🎉 → Paciente
                                        </button>
                                    </div>
                                )}

                                {/* Estado selector (para confirmado / no acudió) */}
                                {(c.estado === 'potencial' || c.estado === 'confirmado') && (
                                    <div className="flex gap-1.5">
                                        {c.estado === 'potencial' && (
                                            <button onClick={() => handleEstado(c, 'confirmado')} className="text-[12px] text-[#051650] font-bold border border-blue-100 rounded-full px-2 py-0.5 hover:bg-blue-50 transition-all">
                                                Confirmar
                                            </button>
                                        )}
                                        <button onClick={() => handleEstado(c, 'no_acudio')} className="text-[12px] text-slate-400 font-bold border border-slate-100 rounded-full px-2 py-0.5 hover:bg-slate-50 transition-all">
                                            No acudió
                                        </button>
                                        <button onClick={() => handleEstado(c, 'cancelado')} className="text-[12px] text-[#FF4B68] font-bold border border-red-100 rounded-full px-2 py-0.5 hover:bg-[#FFF0F3] transition-all">
                                            Cancelar
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContactosPanel;
