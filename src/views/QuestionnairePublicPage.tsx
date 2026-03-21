
import React, { useState, useEffect } from 'react';
import {
    getQuestionnaireByToken,
    guardarRespuestasQuestionnaire,
    type QuestionnaireData,
} from '../services/questionnaire.service';

// ── Props ──────────────────────────────────────────────────────────

interface Props { token: string; }

// ── Helpers UI ─────────────────────────────────────────────────────

const SectionTitle: React.FC<{ emoji: string; title: string; subtitle?: string }> = ({ emoji, title, subtitle }) => (
    <div className="mb-5 pt-6 border-t border-slate-100 first:border-0 first:pt-0">
        <h2 className="text-base font-bold text-[#051650] flex items-center gap-2">
            <span className="text-xl">{emoji}</span> {title}
        </h2>
        {subtitle && <p className="text-[13px] text-slate-400 mt-0.5 ml-7">{subtitle}</p>}
    </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string }> = ({ label, required, children, hint }) => (
    <div className="mb-4">
        <label className="block text-[13px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
            {label} {required && <span className="text-[#FF4B68]">*</span>}
        </label>
        {children}
        {hint && <p className="text-[12px] text-slate-400 mt-1">{hint}</p>}
    </div>
);

const inputCls = "w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-[#0056b3]/10 transition-all";
const selectCls = `${inputCls} cursor-pointer`;

const Toggle: React.FC<{
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    critical?: boolean;
}> = ({ label, value, onChange, critical }) => (
    <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left text-sm font-medium
            ${value
                ? critical ? 'border-[#FF6E87] bg-[#FFF0F3] text-[#C02040]' : 'border-[#0056b3] bg-blue-50 text-[#0056b3]'
                : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
            }`}
    >
        <span className="flex items-center gap-2">
            {critical && value && <span className="text-red-500">⚠️</span>}
            {label}
        </span>
        <span className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${value ? critical ? 'bg-[#FF6E87]' : 'bg-[#0056b3]' : 'bg-slate-200'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'right-0.5' : 'left-0.5'}`} />
        </span>
    </button>
);

// ── Pantallas ──────────────────────────────────────────────────────

const LoadingScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-[#051650] to-[#0056b3] flex items-center justify-center p-6">
        <div className="text-center text-white">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span className="text-3xl">🦷</span>
            </div>
            <p className="font-bold text-lg">Cargando cuestionario...</p>
        </div>
    </div>
);

const ErrorScreen: React.FC<{ title: string; message: string }> = ({ title, message }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">{title}</h1>
            <p className="text-sm text-slate-500">{message}</p>
            <p className="mt-4 text-[13px] text-slate-400">Si crees que es un error, llama a la clínica.</p>
        </div>
    </div>
);

const SuccessScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 to-[#051650] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="text-6xl mb-4 animate-bounce">✅</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">¡Muchas gracias!</h1>
            <p className="text-sm text-slate-600 mb-4">
                Hemos recibido tu cuestionario de salud. Nuestro equipo lo revisará antes de tu visita.
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-left">
                <p className="text-[13px] font-bold text-[#051650] uppercase tracking-widest mb-1">¿Qué pasa ahora?</p>
                <p className="text-[13px] text-[#051650]">
                    Recibirás un mensaje de confirmación. Si tienes dudas, no dudes en contactarnos. ¡Hasta pronto! 😊
                </p>
            </div>
        </div>
    </div>
);

// ── Componente principal ───────────────────────────────────────────

const QuestionnairePublicPage: React.FC<Props> = ({ token }) => {
    const [status, setStatus] = useState<'loading' | 'ready' | 'expired' | 'notfound' | 'error' | 'success'>('loading');
    const [submitting, setSubmitting] = useState(false);
    const [currentSection, setCurrentSection] = useState(0);
    const [tratamientoAdicional, setTratamientoAdicional] = useState<string | null>(null);
    const TOTAL_SECTIONS = 9;

    // ── Estado del formulario ──────────────────────────────────────
    const [data, setData] = useState<Partial<QuestionnaireData>>({
        diabetes: 'No',
        fumador: 'No',
        alcohol: 'No',
        protesis: 'No',
        ultimaVisitaDentista: '< 6 meses',
        higieneOral: '2 veces/día',
        aceptaLopd: false,
        aceptaPoliticaPrivacidad: false,
        aceptaTratamientoDatos: false,
    });

    const set = <K extends keyof QuestionnaireData>(key: K, val: QuestionnaireData[K]) =>
        setData(prev => ({ ...prev, [key]: val }));

    useEffect(() => {
        getQuestionnaireByToken(token).then(record => {
            if (!record) { setStatus('notfound'); return; }
            if (new Date(record.expires_at) < new Date()) { setStatus('expired'); return; }
            // Cargar tratamiento adicional si lo tiene el registro
            if ((record as any).tratamiento_adicional) setTratamientoAdicional((record as any).tratamiento_adicional);
            setStatus('ready');
        }).catch(() => setStatus('error'));
    }, [token]);

    const handleSubmit = async () => {
        if (!data.aceptaPoliticaPrivacidad || !data.aceptaTratamientoDatos || !data.aceptaLopd) return;
        setSubmitting(true);
        const ok = await guardarRespuestasQuestionnaire(token, data as QuestionnaireData);
        setSubmitting(false);
        setStatus(ok ? 'success' : 'error');
    };

    if (status === 'loading') return <LoadingScreen />;
    if (status === 'expired') return <ErrorScreen title="Enlace caducado" message="Este cuestionario ha expirado. Por favor, llama a la clínica para que te envíen un nuevo enlace." />;
    if (status === 'notfound') return <ErrorScreen title="Enlace no válido" message="No hemos podido encontrar este cuestionario. Puede que ya haya sido completado o el enlace sea incorrecto." />;
    if (status === 'error') return <ErrorScreen title="Error al guardar" message="Ha ocurrido un error al guardar tus respuestas. Por favor, inténtalo de nuevo o llama a la clínica." />;
    if (status === 'success') return <SuccessScreen />;

    // ── Render del formulario ──────────────────────────────────────

    const sections = [
        // Sección 0: Bienvenida / datos generales
        <div key="s0">
            <SectionTitle emoji="👋" title="Datos Generales" />
            <Field label="Fecha de nacimiento" required>
                <input type="date" className={inputCls} value={data.fechaNacimiento ?? ''}
                    onChange={e => set('fechaNacimiento', e.target.value)} />
            </Field>
            <Field label="Sexo">
                <select className={selectCls} value={data.sexo ?? ''} onChange={e => set('sexo', e.target.value as any)}>
                    <option value="">Selecciona...</option>
                    {['Masculino', 'Femenino', 'Otro', 'Prefiero no indicar'].map(o => <option key={o}>{o}</option>)}
                </select>
            </Field>
            <Field label="Profesión">
                <input className={inputCls} placeholder="Ej: Enfermera, Autónomo..." value={data.profesion ?? ''}
                    onChange={e => set('profesion', e.target.value)} />
            </Field>
        </div>,

        // Sección 1: Motivo de consulta
        <div key="s1">
            <SectionTitle emoji="🦷" title="Motivo de Consulta" />
            <Field label="¿Por qué nos visitas hoy?" required>
                <textarea className={`${inputCls} min-h-[100px] resize-none`}
                    placeholder="Ej: Revisión general, dolor en muela, estética..."
                    value={data.motivoConsulta ?? ''}
                    onChange={e => set('motivoConsulta', e.target.value)} />
            </Field>
            <Field label="¿Cuándo fue tu última visita al dentista?">
                <select className={selectCls} value={data.ultimaVisitaDentista ?? ''} onChange={e => set('ultimaVisitaDentista', e.target.value as any)}>
                    {['< 6 meses', '6-12 meses', '1-2 años', '> 2 años', 'Nunca'].map(o => <option key={o}>{o}</option>)}
                </select>
            </Field>
        </div>,

        // Sección 2: Salud general
        <div key="s2">
            <SectionTitle emoji="❤️" title="Estado de Salud General" subtitle="Marca todo lo que aplique" />
            <div className="grid grid-cols-1 gap-2.5">
                {([
                    ['enfermedadCardiaca', 'Enfermedad cardíaca / soplo', false],
                    ['hipertension', 'Hipertensión (tensión alta)', false],
                    ['asmaCopd', 'Asma / EPOC / problemas respiratorios', false],
                    ['cancer', 'Cáncer o tratamiento oncológico activo', true],
                    ['embarazo', 'Embarazo', true],
                ] as [keyof QuestionnaireData, string, boolean][]).map(([key, label, crit]) => (
                    <Toggle key={key} label={label} critical={crit}
                        value={!!(data as any)[key]}
                        onChange={v => set(key, v as any)} />
                ))}
            </div>
            {data.embarazo && (
                <Field label="Semanas de embarazo" hint="Importante para evitar radiografías en el primer trimestre">
                    <input type="number" min={1} max={42} className={inputCls} value={data.semanasEmbarazo ?? ''}
                        onChange={e => set('semanasEmbarazo', Number(e.target.value))} />
                </Field>
            )}
            <Field label="Diabetes">
                <select className={selectCls} value={data.diabetes ?? 'No'} onChange={e => set('diabetes', e.target.value as any)}>
                    {['No', 'Tipo 1', 'Tipo 2', 'Prediabetes'].map(o => <option key={o}>{o}</option>)}
                </select>
            </Field>
            <Field label="Otras enfermedades o condiciones">
                <input className={inputCls} placeholder="Ej: Lupus, hipotiroidismo..." value={data.otrasEnfermedades ?? ''}
                    onChange={e => set('otrasEnfermedades', e.target.value)} />
            </Field>
        </div>,

        // Sección 3: Medicación
        <div key="s3">
            <SectionTitle emoji="💊" title="Medicación Actual" />
            <Toggle label="Tomo medicación de forma habitual" value={!!data.tomaMedicacion} onChange={v => set('tomaMedicacion', v)} />
            {data.tomaMedicacion && (
                <Field label="Lista de medicamentos" hint="Nombre comercial o principio activo">
                    <textarea className={`${inputCls} min-h-[80px] resize-none mt-2`}
                        placeholder="Ej: Adiro 100mg, Metformina 850mg..."
                        value={data.listaMedicacion ?? ''}
                        onChange={e => set('listaMedicacion', e.target.value)} />
                </Field>
            )}
            <div className="mt-3 space-y-2.5">
                <p className="text-[13px] font-bold text-[#E03555] uppercase tracking-wide">⚠️ Medicación de aviso especial</p>
                <Toggle label="Anticoagulantes / Antiagregantes (Sintrom, Adiro, Pradaxa...)" critical value={!!data.anticoagulantes} onChange={v => set('anticoagulantes', v)} />
                <Toggle label="Bisfosfonatos (Alendronato, Risedronato, Zoledrónico...)" critical value={!!data.bisfosfonatos} onChange={v => set('bisfosfonatos', v)} />
                <Toggle label="Antibióticos en este momento" value={!!data.antibioticosActuales} onChange={v => set('antibioticosActuales', v)} />
            </div>
        </div>,

        // Sección 4: Alergias
        <div key="s4">
            <SectionTitle emoji="🚨" title="Alergias" subtitle="Marca todo lo que aplique" />
            <div className="grid grid-cols-1 gap-2.5">
                {([
                    ['alergiaPenicilina', 'Penicilina / Amoxicilina', true],
                    ['alergiaAnestesia', 'Anestesia local (lidocaína, ultracaína...)', true],
                    ['alergiaAspirina', 'Aspirina / AAS', false],
                    ['alergiaIbuprofeno', 'Ibuprofeno / Antiinflamatorios', false],
                    ['alergiaLatex', 'Látex / Goma', false],
                    ['alergiaMetal', 'Metales (níquel, cromo...)', false],
                ] as [keyof QuestionnaireData, string, boolean][]).map(([key, label, crit]) => (
                    <Toggle key={key} label={label} critical={crit}
                        value={!!(data as any)[key]}
                        onChange={v => set(key, v as any)} />
                ))}
            </div>
            <Field label="Otras alergias">
                <input className={inputCls} placeholder="Describe cualquier otra alergia..."
                    value={data.otrasAlergias ?? ''} onChange={e => set('otrasAlergias', e.target.value)} />
            </Field>
        </div>,

        // Sección 5: Hábitos
        <div key="s5">
            <SectionTitle emoji="🏃" title="Hábitos de Salud" />
            <Field label="Tabaco">
                <select className={selectCls} value={data.fumador ?? 'No'} onChange={e => set('fumador', e.target.value as any)}>
                    {['No', 'Ocasional', 'Diario', 'Ex-fumador'].map(o => <option key={o}>{o}</option>)}
                </select>
            </Field>
            <Field label="Alcohol">
                <select className={selectCls} value={data.alcohol ?? 'No'} onChange={e => set('alcohol', e.target.value as any)}>
                    {['No', 'Ocasional', 'Frecuente'].map(o => <option key={o}>{o}</option>)}
                </select>
            </Field>
            <Field label="Higiene oral diaria">
                <select className={selectCls} value={data.higieneOral ?? '2 veces/día'} onChange={e => set('higieneOral', e.target.value as any)}>
                    {['1 vez/día', '2 veces/día', '3 veces/día'].map(o => <option key={o}>{o}</option>)}
                </select>
            </Field>
            <div className="grid grid-cols-2 gap-2.5 mt-2">
                <Toggle label="Hilo dental" value={!!data.usaHiloDental} onChange={v => set('usaHiloDental', v)} />
                <Toggle label="Enjuague bucal" value={!!data.usaEnjuague} onChange={v => set('usaEnjuague', v)} />
                <Toggle label="Bruxismo (rechinar)" value={!!data.bruxismo} onChange={v => set('bruxismo', v)} />
            </div>
        </div>,

        // Sección 6: Historial dental
        <div key="s6">
            <SectionTitle emoji="📋" title="Historial Dental" />
            <div className="grid grid-cols-2 gap-2.5">
                {([
                    ['extracciones', 'Extracciones previas'],
                    ['endodoncias', 'Endodoncias / Empastes'],
                    ['implantes', 'Implantes dentales'],
                    ['ortodoncia', 'Ortodoncia previa'],
                ] as [keyof QuestionnaireData, string][]).map(([key, label]) => (
                    <Toggle key={key} label={label} value={!!(data as any)[key]} onChange={v => set(key, v as any)} />
                ))}
            </div>
            <Field label="Prótesis" hint="Si llevas prótesis, indícalo">
                <select className={selectCls} value={data.protesis ?? 'No'} onChange={e => set('protesis', e.target.value as any)}>
                    {['No', 'Parcial removible', 'Total removible', 'Fija'].map(o => <option key={o}>{o}</option>)}
                </select>
            </Field>
            <Field label="¿Tienes algún miedo o ansiedad al dentista?">
                <textarea className={`${inputCls} min-h-[70px] resize-none`}
                    placeholder="Cuéntanos para que podamos adaptarnos..."
                    value={data.miedosDentista ?? ''}
                    onChange={e => set('miedosDentista', e.target.value)} />
            </Field>
        </div>,

        // Sección 7: LOPD — Política de privacidad y consentimiento
        <div key="s7">
            <SectionTitle emoji="🔒" title="Privacidad y Consentimiento" />
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[13px] text-slate-600 leading-relaxed mb-4">
                <p className="font-bold text-slate-700 mb-2">Información sobre protección de datos (LOPD/RGPD)</p>
                <p>
                    <strong>Responsable:</strong> Rubio García Dental.<br />
                    <strong>Finalidad:</strong> Gestión de tu historia clínica y prestación de servicios sanitarios.<br />
                    <strong>Legitimación:</strong> Consentimiento del interesado y obligación legal sanitaria (RGPD Art. 9.2.h).<br />
                    <strong>Conservación:</strong> Mínimo 5 años conforme a la normativa sanitaria autonómica.<br />
                    <strong>Derechos:</strong> Acceso, rectificación, supresión, limitación y portabilidad en la clínica.<br />
                    <strong>Base legal:</strong> LOPD-GDD (Ley Orgánica 3/2018) y RGPD (UE) 2016/679.
                </p>
            </div>
            <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!data.aceptaLopd}
                        onChange={e => set('aceptaLopd' as any, e.target.checked)}
                        className="w-5 h-5 text-[#0056b3] rounded focus:ring-[#0056b3] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">
                        <strong>He leído y acepto</strong> la política de privacidad y el tratamiento de mis datos de salud con arreglo a lo indicado (LOPD/RGPD). <span className="text-[#FF4B68]">*</span>
                    </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!data.aceptaPoliticaPrivacidad}
                        onChange={e => set('aceptaPoliticaPrivacidad', e.target.checked)}
                        className="w-5 h-5 text-[#0056b3] rounded focus:ring-[#0056b3] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">
                        <strong>Acepto</strong> la política de privacidad y el tratamiento de mis datos de salud para la gestión de mi historia clínica. <span className="text-[#FF4B68]">*</span>
                    </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!data.aceptaTratamientoDatos}
                        onChange={e => set('aceptaTratamientoDatos', e.target.checked)}
                        className="w-5 h-5 text-[#0056b3] rounded focus:ring-[#0056b3] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-600">
                        <strong>Confirmo</strong> que la información proporcionada es verídica y consiento su uso para la correcta atención sanitaria. <span className="text-[#FF4B68]">*</span>
                    </span>
                </label>
            </div>
            {(!data.aceptaLopd || !data.aceptaPoliticaPrivacidad || !data.aceptaTratamientoDatos) && (
                <p className="text-[13px] text-red-500 mt-3 text-center">
                    Debes aceptar los tres puntos para continuar.
                </p>
            )}
        </div>,

        // Sección 8: Consentimiento tratamiento adicional (si aplica)
        <div key="s8">
            {tratamientoAdicional ? (
                <>
                    <SectionTitle emoji="🦾" title={`Consentimiento: ${tratamientoAdicional}`}
                        subtitle="Antes de comenzar, necesitas firmar el consentimiento informado para este tratamiento." />
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-[13px] text-indigo-800 leading-relaxed mb-4">
                        <p className="font-bold mb-2">📄 Consentimiento informado para: <span className="text-indigo-600">{tratamientoAdicional}</span></p>
                        <p>Has sido informado/a del tratamiento dental propuesto, sus objetivos, riesgos, beneficios y alternativas.
                            Al firmar aceptas libre y voluntariamente someterte al mismo, pudiendo revocar este consentimiento en cualquier momento antes del tratamiento.</p>
                        <p className="mt-2 text-indigo-600 font-semibold">Conforme al art. 8 de la Ley 41/2002 de Autonomía del Paciente.</p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={!!(data as any).aceptaConsentimientoTratamiento}
                            onChange={e => set('aceptaConsentimientoTratamiento' as any, e.target.checked)}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">
                            <strong>He leído y acepto</strong> el consentimiento informado para el tratamiento de <strong>{tratamientoAdicional}</strong>. <span className="text-[#FF4B68]">*</span>
                        </span>
                    </label>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-5xl mb-4">✅</span>
                    <h2 className="text-xl font-bold text-slate-800">Todo listo</h2>
                    <p className="text-sm text-slate-500 mt-2">Has completado todas las secciones. Pulsa Enviar cuestionario para finalizar.</p>
                </div>
            )}
        </div>,
    ];

    const isLastSection = currentSection === TOTAL_SECTIONS - 1;
    const canSubmit = !!data.aceptaLopd && !!data.aceptaPoliticaPrivacidad && !!data.aceptaTratamientoDatos
        && (!tratamientoAdicional || !!(data as any).aceptaConsentimientoTratamiento);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f8faff] to-[#eef2ff]">
            {/* Header fijo */}
            <div className="bg-[#051650] text-white sticky top-0 z-10 shadow-xl">
                <div className="max-w-lg mx-auto px-5 py-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🦷</span>
                        <div>
                            <p className="font-bold text-sm leading-tight">Rubio García Dental</p>
                            <p className="text-[12px] text-blue-200 uppercase tracking-widest">Cuestionario de Primera Visita</p>
                        </div>
                    </div>
                    {/* Barra de progreso */}
                    <div className="mt-3 bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-[#f5a623] rounded-full transition-all duration-500"
                            style={{ width: `${((currentSection + 1) / TOTAL_SECTIONS) * 100}%` }} />
                    </div>
                    <p className="text-[12px] text-blue-200 mt-1 text-right">
                        Sección {currentSection + 1} de {TOTAL_SECTIONS}
                    </p>
                </div>
            </div>

            {/* Contenido */}
            <div className="max-w-lg mx-auto px-5 py-6 pb-32">
                {sections[currentSection]}
            </div>

            {/* Footer fijo con botones */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-xl z-10">
                <div className="max-w-lg mx-auto px-5 py-4 flex gap-3">
                    {currentSection > 0 && (
                        <button onClick={() => setCurrentSection(p => p - 1)}
                            className="flex-shrink-0 px-5 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:border-slate-300 transition-all">
                            ← Atrás
                        </button>
                    )}
                    {!isLastSection ? (
                        <button onClick={() => setCurrentSection(p => p + 1)}
                            className="flex-1 py-3 bg-[#051650] text-white rounded-xl text-sm font-bold uppercase tracking-wide shadow-lg hover:bg-[#0056b3] active:scale-95 transition-all">
                            Siguiente →
                        </button>
                    ) : (
                        <button onClick={handleSubmit} disabled={!canSubmit || submitting}
                            className="flex-1 py-3 bg-[#051650] text-white rounded-xl text-sm font-bold uppercase tracking-wide shadow-lg hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {submitting ? (
                                <><span className="animate-spin">⏳</span> Enviando...</>
                            ) : (
                                <>✅ Enviar cuestionario</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuestionnairePublicPage;
