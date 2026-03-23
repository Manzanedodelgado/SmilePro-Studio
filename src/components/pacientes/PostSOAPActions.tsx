// ─────────────────────────────────────────────────────────────────
//  components/pacientes/PostSOAPActions.tsx
//  Panel de acciones sugeridas tras firmar un evolutivo SOAP.
//  - Receta y presupuesto: se generan inmediatamente.
//  - Instrucciones para próxima cita: se guardan en cita.notas para recepción.
//  - Mensajes post-tratamiento: se difieren al momento en que recepción
//    marque la cita como "finalizada".
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
    analyzePostSOAP,
    createPresupuestoFromDetection,
    sendPresupuestoWhatsApp,
    type PostSOAPResult,
    type DetectedTreatment,
    type DetectedMedication,
    type DetectedMessage,
} from '../../services/workflow-engine.service';
import { createReceta, printReceta, sendRecetaWhatsApp, type Receta } from '../../services/recetas.service';
import { getCitasByFecha, updateCita } from '../../services/citas.service';

interface PostSOAPActionsProps {
    soapData: { subjetivo: string; objetivo: string; analisis: string; plan: string };
    numPac: string;
    pacienteNombre: string;
    doctorNombre?: string;
    doctorColegiado?: string;
    clinicaNombre?: string;
    clinicaDireccion?: string;
    pacienteTelefono?: string;  // Needed for WhatsApp delivery options
    onClose: () => void;
    onCitar?: () => void;
}

const PostSOAPActions: React.FC<PostSOAPActionsProps> = ({
    soapData,
    numPac,
    pacienteNombre,
    doctorNombre = 'Dr. Mario Rubio García',
    doctorColegiado = '28007352',
    clinicaNombre = 'Dental Rubio García',
    clinicaDireccion = 'C/ Mayor 19, 28921 Alcorcón, Madrid',
    pacienteTelefono,
    onClose,
}) => {
    const [result, setResult] = useState<PostSOAPResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);

    // Checkboxes
    const [selectedTreatments, setSelectedTreatments] = useState<Set<number>>(new Set());
    const [selectedMeds, setSelectedMeds] = useState<Set<number>>(new Set());
    const [selectedMsgs, setSelectedMsgs] = useState<Set<number>>(new Set());

    // Instrucciones próxima cita para recepción
    const [wantCita, setWantCita] = useState(false);
    const [instruccionTratamiento, setInstruccionTratamiento] = useState('');
    const [instruccionDuracion, setInstruccionDuracion] = useState(45);

    // Delivery options
    const [presupuestoEnvio, setPresupuestoEnvio] = useState<'impreso' | 'whatsapp' | 'ambos'>('impreso');
    const [recetaWhatsApp, setRecetaWhatsApp] = useState(false);

    // Status
    const [presupuestoCreated, setPresupuestoCreated] = useState(false);
    const [recetaCreated, setRecetaCreated] = useState(false);
    const [citaGuardada, setCitaGuardada] = useState(false);
    const [msgsGuardados, setMsgsGuardados] = useState(false);
    const [allDone, setAllDone] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const r = await analyzePostSOAP(soapData, numPac);
                setResult(r);
                setSelectedTreatments(new Set(r.treatments.map((_, i) => i)));
                setSelectedMeds(new Set(r.medications.map((_, i) => i)));
                setSelectedMsgs(new Set(r.messages.map((_, i) => i)));
                setWantCita(r.suggestNewCita);
                // Pre-rellenar instrucción con el primer tratamiento detectado
                if (r.treatments.length > 0) {
                    const tto = r.treatments[0];
                    setInstruccionTratamiento(tto.catalogMatch?.nombre ?? tto.mapping.catalogSearch);
                    setInstruccionDuracion(tto.mapping.defaultDuration || 45);
                }
            } catch (err) {
                console.error('[PostSOAP] Error analyzing:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [soapData, numPac]);

    const hasActions = result && (
        result.treatments.length > 0 ||
        result.medications.length > 0 ||
        result.messages.length > 0 ||
        result.suggestNewCita
    );

    const toggleTreatment = (i: number) => setSelectedTreatments(prev => {
        const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next;
    });
    const toggleMed = (i: number) => setSelectedMeds(prev => {
        const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next;
    });
    const toggleMsg = (i: number) => setSelectedMsgs(prev => {
        const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next;
    });

    const executeActions = async () => {
        if (!result) return;
        setExecuting(true);

        try {
            // 1. Presupuesto (siempre borrador para que recepción lo revise)
            if (selectedTreatments.size > 0) {
                const treatments = result.treatments.filter((_, i) => selectedTreatments.has(i));
                await createPresupuestoFromDetection(numPac, treatments, pacienteNombre);
                // Enviar por WhatsApp si se seleccionó
                if ((presupuestoEnvio === 'whatsapp' || presupuestoEnvio === 'ambos') && pacienteTelefono) {
                    await sendPresupuestoWhatsApp(pacienteTelefono, treatments, pacienteNombre, clinicaNombre);
                }
                setPresupuestoCreated(true);
            }

            // 2. Receta (siempre se imprime + opción WhatsApp)
            if (selectedMeds.size > 0) {
                const meds = result.medications.filter((_, i) => selectedMeds.has(i));
                const receta: Omit<Receta, 'id'> = {
                    numPac,
                    pacienteNombre,
                    fecha: new Date().toLocaleDateString('es-ES'),
                    doctorNombre,
                    doctorColegiado,
                    clinicaNombre,
                    clinicaDireccion,
                    diagnostico: soapData.analisis || soapData.subjetivo || 'Ver historia clínica',
                    medicamentos: meds.map(m => m.medicamento),
                    firmada: false,
                };
                const created = await createReceta(receta);
                setRecetaCreated(true);
                printReceta(created);
                // Enviar por WhatsApp si se activó el toggle
                if (recetaWhatsApp && pacienteTelefono) {
                    await sendRecetaWhatsApp(created, pacienteTelefono, clinicaNombre);
                }
            }

            // 3. Guardar instrucciones para recepción + mensajes diferidos en cita.notas
            const mensajesSeleccionados = result.messages.filter((_, i) => selectedMsgs.has(i));
            const tieneInstrucciones = (wantCita && instruccionTratamiento.trim()) || mensajesSeleccionados.length > 0;

            if (tieneInstrucciones) {
                try {
                    const citasHoy = await getCitasByFecha(new Date());
                    const citaActiva = citasHoy.find(c =>
                        c.pacienteNumPac === numPac &&
                        ['consulta', 'espera', 'confirmada'].includes(c.estado)
                    );

                    if (citaActiva) {
                        let notasObj: Record<string, unknown> = {};
                        try { notasObj = JSON.parse(citaActiva.notas ?? ''); } catch { /* notas no son JSON */ }

                        notasObj.soapPostData = {
                            ...(wantCita && instruccionTratamiento.trim() ? {
                                instruccionesProxCita: {
                                    tratamiento: instruccionTratamiento.trim(),
                                    duracionMin: instruccionDuracion,
                                },
                            } : {}),
                            mensajesPostTto: mensajesSeleccionados,
                        };

                        await updateCita(citaActiva.id, { notas: JSON.stringify(notasObj) });
                        if (wantCita && instruccionTratamiento.trim()) setCitaGuardada(true);
                        if (mensajesSeleccionados.length > 0) setMsgsGuardados(true);
                    }
                } catch (e) {
                    console.error('[PostSOAP] Error guardando en cita.notas:', e);
                }
            }

            setAllDone(true);
        } catch (err) {
            console.error('[PostSOAP] Error executing actions:', err);
        } finally {
            setExecuting(false);
        }
    };

    // ── Render ─────────────────────────────────────────────

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                <div className="bg-white rounded-2xl p-8 max-w-md text-center">
                    <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-600 text-sm">Analizando plan de tratamiento...</p>
                </div>
            </div>
        );
    }

    if (!hasActions) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">

                {/* ── Header ─────────────────────────────── */}
                <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚡</span>
                        <div>
                            <h2 className="font-bold text-lg">Acciones post-consulta</h2>
                            <p className="text-blue-200 text-xs">Detectadas automáticamente desde el plan de tratamiento</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
                </div>

                {/* ── Body (scrollable) ───────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Presupuesto */}
                    {result!.treatments.length > 0 && (
                        <Section
                            icon="💰"
                            title="Presupuesto"
                            subtitle={`${result!.treatments.length} tratamiento${result!.treatments.length > 1 ? 's' : ''} — Borrador para recepción`}
                            done={presupuestoCreated}
                        >
                            {result!.treatments.map((t, i) => (
                                <TreatmentRow
                                    key={i}
                                    treatment={t}
                                    selected={selectedTreatments.has(i)}
                                    onToggle={() => toggleTreatment(i)}
                                />
                            ))}
                            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Envío:</span>
                                    {(['impreso', 'whatsapp', 'ambos'] as const).map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => setPresupuestoEnvio(opt)}
                                            className={`text-[11px] px-2.5 py-1 rounded-full border transition font-medium ${
                                                presupuestoEnvio === opt
                                                    ? 'bg-blue-700 text-white border-blue-700'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                            }`}
                                        >
                                            {opt === 'impreso' ? '🖨 Impreso' : opt === 'whatsapp' ? '📱 WhatsApp' : '🖨📱 Ambos'}
                                        </button>
                                    ))}
                                </div>
                                <div className="text-right">
                                    <span className="text-sm text-gray-500">Total estimado: </span>
                                    <span className="font-bold text-lg text-blue-700">
                                        {result!.treatments
                                            .filter((_, i) => selectedTreatments.has(i))
                                            .reduce((sum, t) => {
                                                const price = t.catalogMatch?.precio ?? t.mapping.defaultPrice;
                                                const mult = t.mapping.tipoAplicacion === 'pieza' && t.piezas.length > 0 ? t.piezas.length : 1;
                                                return sum + price * mult;
                                            }, 0)
                                            .toLocaleString('es-ES')} €
                                    </span>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1 px-1">📌 Se crea como borrador — recepción lo revisará antes de entregar.</p>
                        </Section>
                    )}

                    {/* Receta */}
                    {result!.medications.length > 0 && (
                        <Section
                            icon="💊"
                            title="Receta"
                            subtitle={`${result!.medications.length} medicamento${result!.medications.length > 1 ? 's' : ''} — siempre se imprime`}
                            done={recetaCreated}
                        >
                            {result!.medications.map((m, i) => (
                                <MedicationRow
                                    key={i}
                                    medication={m}
                                    selected={selectedMeds.has(i)}
                                    onToggle={() => toggleMed(i)}
                                />
                            ))}
                            <div className="pt-2 border-t border-gray-200 px-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={recetaWhatsApp}
                                        onChange={() => setRecetaWhatsApp(v => !v)}
                                        className="w-4 h-4 rounded accent-blue-600"
                                    />
                                    <span className="text-xs text-gray-600">📱 También enviar por WhatsApp</span>
                                </label>
                                <p className="text-[11px] text-gray-400 mt-1 ml-6">La receta impresa es obligatoria por ley. El WhatsApp es informativo.</p>
                            </div>
                        </Section>
                    )}

                    {/* Instrucciones próxima cita para recepción */}
                    {result!.suggestNewCita && (
                        <Section
                            icon="📅"
                            title="Instrucciones para próxima cita"
                            subtitle="Recepción creará la cita según estas indicaciones"
                            done={citaGuardada}
                            doneLabel="✓ Guardado para recepción"
                        >
                            <div className="space-y-3 p-1">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={wantCita}
                                        onChange={() => setWantCita(v => !v)}
                                        className="w-4 h-4 rounded accent-blue-600"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Dejar instrucciones para recepción</span>
                                </label>

                                {wantCita && (
                                    <div className="space-y-3 ml-7">
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 block mb-1">¿Qué vamos a hacer en la próxima cita?</label>
                                            <textarea
                                                value={instruccionTratamiento}
                                                onChange={e => setInstruccionTratamiento(e.target.value)}
                                                placeholder="Ej: Endodoncia pieza 16, colocación corona..."
                                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-400"
                                                rows={2}
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 block mb-1">Duración estimada</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min={15}
                                                        max={240}
                                                        step={15}
                                                        value={instruccionDuracion}
                                                        onChange={e => setInstruccionDuracion(Number(e.target.value))}
                                                        className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 text-center"
                                                    />
                                                    <span className="text-sm text-gray-500">min</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Mensajes post-tratamiento (diferidos a finalización) */}
                    {result!.messages.length > 0 && (
                        <Section
                            icon="📱"
                            title="Consejos post-tratamiento"
                            subtitle="Se enviará al paciente vía WhatsApp al finalizar la cita"
                            done={msgsGuardados}
                            doneLabel="✓ Guardado para envío"
                        >
                            {result!.messages.map((m, i) => (
                                <MessageRow
                                    key={i}
                                    message={m}
                                    selected={selectedMsgs.has(i)}
                                    onToggle={() => toggleMsg(i)}
                                />
                            ))}
                            <p className="text-[11px] text-gray-400 mt-2 px-2">
                                📌 Recepción enviará estos consejos al marcar la cita como finalizada.
                            </p>
                        </Section>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────── */}
                <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                    >
                        Omitir
                    </button>
                    <div className="flex items-center gap-3">
                        {allDone && (
                            <span className="text-green-600 text-sm font-medium">✓ Acciones ejecutadas</span>
                        )}
                        <button
                            onClick={allDone ? onClose : executeActions}
                            disabled={executing}
                            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg ${
                                allDone
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-blue-700 hover:bg-blue-800 text-white'
                            } disabled:opacity-50`}
                        >
                            {executing ? 'Ejecutando...' :
                             allDone ? 'Cerrar' :
                             '✓ Ejecutar seleccionadas'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostSOAPActions;

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

const Section: React.FC<{
    icon: string;
    title: string;
    subtitle: string;
    done?: boolean;
    doneLabel?: string;
    children: React.ReactNode;
}> = ({ icon, title, subtitle, done, doneLabel = '✓ Creado', children }) => (
    <div className={`border rounded-xl overflow-hidden transition ${done ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-xl">{icon}</span>
            <div className="flex-1">
                <span className="font-semibold text-sm text-gray-800">{title}</span>
                <span className="text-xs text-gray-500 ml-2">{subtitle}</span>
            </div>
            {done && <span className="text-green-600 text-xs font-medium bg-green-100 px-2 py-0.5 rounded-full">{doneLabel}</span>}
        </div>
        <div className="p-3 space-y-1">{children}</div>
    </div>
);

const TreatmentRow: React.FC<{
    treatment: DetectedTreatment;
    selected: boolean;
    onToggle: () => void;
}> = ({ treatment, selected, onToggle }) => {
    const price = treatment.catalogMatch?.precio ?? treatment.mapping.defaultPrice;
    const piezaStr = treatment.piezas.length > 0 ? ` (pieza${treatment.piezas.length > 1 ? 's' : ''} ${treatment.piezas.join(', ')})` : '';
    const mult = treatment.mapping.tipoAplicacion === 'pieza' && treatment.piezas.length > 0 ? treatment.piezas.length : 1;

    return (
        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-50 rounded-lg transition">
            <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 rounded accent-blue-600" />
            <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">
                    {treatment.catalogMatch?.nombre ?? treatment.mapping.catalogSearch}
                </span>
                {piezaStr && <span className="text-xs text-blue-600">{piezaStr}</span>}
            </div>
            <div className="text-right">
                <span className="text-sm font-semibold text-gray-700">{(price * mult).toLocaleString('es-ES')} €</span>
                {mult > 1 && <span className="text-[10px] text-gray-400 block">{mult} × {price}€</span>}
            </div>
        </label>
    );
};

const MedicationRow: React.FC<{
    medication: DetectedMedication;
    selected: boolean;
    onToggle: () => void;
}> = ({ medication, selected, onToggle }) => (
    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-50 rounded-lg transition">
        <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 rounded accent-blue-600" />
        <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-800">{medication.medicamento.nombre}</span>
            <span className="text-xs text-gray-500 ml-1">{medication.medicamento.presentacion}</span>
            <p className="text-[11px] text-gray-400 mt-0.5">
                {medication.medicamento.posologia} — {medication.medicamento.duracion}
            </p>
        </div>
    </label>
);

const MessageRow: React.FC<{
    message: DetectedMessage;
    selected: boolean;
    onToggle: () => void;
}> = ({ message, selected, onToggle }) => (
    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-50 rounded-lg transition">
        <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 rounded accent-blue-600" />
        <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-800">{message.asunto}</span>
            <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{message.mensaje.split('\n').slice(1, 3).join(', ')}</p>
        </div>
    </label>
);
