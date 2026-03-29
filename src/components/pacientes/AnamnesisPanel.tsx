/**
 * AnamnesisPanel.tsx — Panel de anamnesis desde primera_visita_questionnaire
 *
 * Migrado desde smilestudio_source_pure/components/pacientes/QuestionnairePanel.tsx
 * Muestra el cuestionario completado de primera visita con 14 alertas clínicas automáticas,
 * RiskBadge por nivel de severidad, y DocumentosFirmadosSection con revocación RGPD.
 *
 * Se diferencia de QuestionnairePanel.tsx que edita datos básicos del paciente.
 */

import React, { useState, useEffect } from 'react';
import {
    getQuestionnaireDatosPorPaciente,
    type QuestionnaireData,
    type QuestionnaireRecord,
} from '../../services/questionnaire.service';
import {
    getDocumentosPorPaciente, revocarDocumento, tipoDocLabel,
    type DocumentoFirmadoEvento,
} from '../../services/documentos-firmados.service';

// ── Tipos ──────────────────────────────────────────────────────────

type QuestionnaireWithData = QuestionnaireRecord & { datos?: QuestionnaireData };

interface Props { numPac: string; }

// ── Risk badge ─────────────────────────────────────────────────────

type RiskLevel = 'critical' | 'warning' | 'info';

const RiskBadge: React.FC<{ label: string; level: RiskLevel; icon?: string }> = ({ label, level, icon = '⚠️' }) => {
    const styles: Record<RiskLevel, string> = {
        critical: 'bg-[#FFE0E6] border-[#FF9BAD] text-[#C02040] ring-2 ring-[#FFC0CB]',
        warning: 'bg-orange-100 border-orange-300 text-orange-800',
        info: 'bg-blue-50 border-blue-200 text-blue-700',
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[13px] font-bold uppercase tracking-wide ${styles[level]}`}>
            <span>{icon}</span>
            {label}
        </span>
    );
};

// ── Section card ──────────────────────────────────────────────────

const SCard: React.FC<{ emoji: string; title: string; children: React.ReactNode }> = ({ emoji, title, children }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="text-lg">{emoji}</span> {title}
        </h3>
        {children}
    </div>
);

const Row: React.FC<{ label: string; value?: string | boolean | number | null; yesNo?: boolean }> = ({ label, value, yesNo }) => {
    if (value === undefined || value === null || value === '') return null;
    let display: React.ReactNode = String(value);
    if (yesNo && typeof value === 'boolean') {
        display = value
            ? <span className="text-[#E03555] font-bold">Sí</span>
            : <span className="text-[#051650] font-medium">No</span>;
    }
    return (
        <div className="flex justify-between items-start py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
            <span className="text-[13px] text-slate-500 flex-shrink-0 mr-4">{label}</span>
            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 text-right">{display}</span>
        </div>
    );
};

// ── Componente principal ──────────────────────────────────────────

const AnamnesisPanel: React.FC<Props> = ({ numPac }) => {
    const [record, setRecord] = useState<QuestionnaireWithData | null>(null);
    const [loading, setLoading] = useState(true);
    const [noData, setNoData] = useState(false);

    useEffect(() => {
        if (!numPac) return;
        setLoading(true);
        setNoData(false);
        setRecord(null);
        getQuestionnaireDatosPorPaciente(numPac).then(r => {
            if (r && r.estado === 'completado') setRecord(r);
            else setNoData(true);
        }).catch(() => setNoData(true))
            .finally(() => setLoading(false));
    }, [numPac]);

    const q = record?.datos;

    // ── Calcular alertas de riesgo clínico ─────────────────────────

    interface RiskAlert { label: string; level: RiskLevel; icon: string }
    const risks: RiskAlert[] = [];

    if (q) {
        if (q.anticoagulantes)          risks.push({ label: 'Anticoagulantes',          level: 'critical', icon: '🩸' });
        if (q.bisfosfonatos)            risks.push({ label: 'Bisfosfonatos — ⚠️ ONM',   level: 'critical', icon: '💊' });
        if (q.embarazo)                 risks.push({ label: `Embarazo${q.semanasEmbarazo ? ` (${q.semanasEmbarazo} sem)` : ''}`, level: 'critical', icon: '🤰' });
        if (q.alergiaPenicilina)        risks.push({ label: 'Alergia Penicilina',        level: 'critical', icon: '🚫' });
        if (q.alergiaAnestesia)         risks.push({ label: 'Alergia Anestesia Local',   level: 'critical', icon: '🚫' });
        if (q.cancer)                   risks.push({ label: 'Tratamiento Oncológico',    level: 'critical', icon: '🔴' });
        if (q.alergiaIbuprofeno)        risks.push({ label: 'Alergia Ibuprofeno',        level: 'warning',  icon: '⚠️' });
        if (q.alergiaAspirina)          risks.push({ label: 'Alergia Aspirina',          level: 'warning',  icon: '⚠️' });
        if (q.alergiaLatex)             risks.push({ label: 'Alergia Látex',             level: 'warning',  icon: '⚠️' });
        if (q.hipertension)             risks.push({ label: 'Hipertensión',              level: 'warning',  icon: '❤️' });
        if (q.enfermedadCardiaca)       risks.push({ label: 'Enfermedad Cardíaca',       level: 'warning',  icon: '❤️' });
        if (q.diabetes && q.diabetes !== 'No') risks.push({ label: `Diabetes ${q.diabetes}`, level: 'warning', icon: '🩺' });
        if (q.fumador === 'Diario')     risks.push({ label: 'Fumador diario',            level: 'info',     icon: '🚬' });
        if (q.bruxismo)                 risks.push({ label: 'Bruxismo',                  level: 'info',     icon: '😬' });
    }

    // ── Pantallas de estado ────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <span className="material-icons animate-spin">refresh</span>
                <span className="text-sm font-bold uppercase">Cargando anamnesis...</span>
            </div>
        );
    }

    if (noData || !record || !q) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500">
                <span className="material-icons text-5xl">assignment</span>
                <div className="text-center">
                    <p className="font-bold text-sm uppercase">Cuestionario pendiente</p>
                    <p className="text-[13px] mt-1 text-slate-400">
                        El paciente no ha completado el cuestionario de primera visita todavía.<br />
                        Genera un enlace desde la sección de Automatizaciones → Cuestionario Primera Visita.
                    </p>
                </div>
            </div>
        );
    }

    const dateStr = record.completado_at ? new Date(record.completado_at).toLocaleString('es-ES') : '—';

    return (
        <div className="space-y-5 animate-fade-in">

            {/* Header — fecha y RGPD confirmado */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <div>
                    <h2 className="text-lg font-bold text-[#051650] dark:text-white">Anamnesis — Primera Visita</h2>
                    <p className="text-[13px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <span className="material-icons text-[13px]">schedule</span>
                        Completado: {dateStr}
                        {q.aceptaPoliticaPrivacidad && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-[#051650] border border-blue-100 text-[12px] font-bold uppercase">
                                <span className="material-icons text-[12px]">verified</span> RGPD firmado
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* ── ALERTAS CLÍNICAS ─────────────────────────────────── */}
            {risks.length > 0 && (
                <div className={`rounded-2xl p-4 border-2 ${risks.some(r => r.level === 'critical') ? 'bg-[#FFF0F3] border-[#FFC0CB] dark:bg-red-900/20 dark:border-red-800' : 'bg-orange-50 border-orange-200'}`}>
                    <p className="text-[13px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2 text-[#C02040]">
                        <span className="material-icons text-base">warning</span>
                        Alertas clínicas activas
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {risks.map((r, i) => (
                            <RiskBadge key={i} label={r.label} level={r.level} icon={r.icon} />
                        ))}
                    </div>
                </div>
            )}

            {risks.length === 0 && (
                <div className="rounded-2xl p-4 border border-blue-100 bg-blue-50 dark:bg-[#051650]/10 flex items-center gap-3">
                    <span className="material-icons text-[#004182]">check_circle</span>
                    <p className="text-sm text-[#051650] font-bold">Sin alertas clínicas relevantes detectadas</p>
                </div>
            )}

            {/* Grid de contenido */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <SCard emoji="👤" title="Datos Generales">
                    <Row label="Fecha nacimiento" value={q.fechaNacimiento ? new Date(q.fechaNacimiento).toLocaleDateString('es-ES') : null} />
                    <Row label="Sexo" value={q.sexo} />
                    <Row label="Profesión" value={q.profesion} />
                    <Row label="Última visita dentista" value={q.ultimaVisitaDentista} />
                    <Row label="Motivo de consulta" value={q.motivoConsulta} />
                </SCard>

                <SCard emoji="❤️" title="Estado de Salud General">
                    <Row label="Enfermedad cardíaca" value={q.enfermedadCardiaca} yesNo />
                    <Row label="Hipertensión" value={q.hipertension} yesNo />
                    <Row label="Diabetes" value={q.diabetes !== 'No' ? q.diabetes : null} />
                    <Row label="Asma / EPOC" value={q.asmaCopd} yesNo />
                    <Row label="Cáncer / Oncología" value={q.cancer} yesNo />
                    <Row label="Embarazo" value={q.embarazo} yesNo />
                    {q.semanasEmbarazo && <Row label="Semanas" value={String(q.semanasEmbarazo)} />}
                    <Row label="Otras enfermedades" value={q.otrasEnfermedades} />
                </SCard>

                <SCard emoji="💊" title="Medicación Actual">
                    <Row label="Toma medicación" value={q.tomaMedicacion} yesNo />
                    <Row label="Lista de medicamentos" value={q.listaMedicacion} />
                    <Row label="Anticoagulantes" value={q.anticoagulantes} yesNo />
                    <Row label="Bisfosfonatos" value={q.bisfosfonatos} yesNo />
                    <Row label="Antibióticos actuales" value={q.antibioticosActuales} yesNo />
                </SCard>

                <SCard emoji="🚨" title="Alergias">
                    <Row label="Penicilina / Amoxicilina" value={q.alergiaPenicilina} yesNo />
                    <Row label="Anestesia local" value={q.alergiaAnestesia} yesNo />
                    <Row label="Aspirina / AAS" value={q.alergiaAspirina} yesNo />
                    <Row label="Ibuprofeno / NSAIDs" value={q.alergiaIbuprofeno} yesNo />
                    <Row label="Látex" value={q.alergiaLatex} yesNo />
                    <Row label="Metales (níquel...)" value={q.alergiaMetal} yesNo />
                    <Row label="Otras alergias" value={q.otrasAlergias} />
                </SCard>

                <SCard emoji="🏃" title="Hábitos de Salud">
                    <Row label="Tabaco" value={q.fumador !== 'No' ? q.fumador : null} />
                    <Row label="Alcohol" value={q.alcohol !== 'No' ? q.alcohol : null} />
                    <Row label="Higiene oral" value={q.higieneOral} />
                    <Row label="Hilo dental" value={q.usaHiloDental} yesNo />
                    <Row label="Enjuague bucal" value={q.usaEnjuague} yesNo />
                    <Row label="Bruxismo conocido" value={q.bruxismo} yesNo />
                </SCard>

                <SCard emoji="📋" title="Historial Dental">
                    <Row label="Extracciones previas" value={q.extracciones} yesNo />
                    <Row label="Endodoncias previas" value={q.endodoncias} yesNo />
                    <Row label="Implantes previos" value={q.implantes} yesNo />
                    <Row label="Ortodoncia previa" value={q.ortodoncia} yesNo />
                    <Row label="Prótesis" value={q.protesis !== 'No' ? q.protesis : null} />
                    <Row label="Miedos al dentista" value={q.miedosDentista} />
                </SCard>

            </div>

            {/* Documentos firmados */}
            <DocumentosFirmadosSection numPac={numPac} />

            {/* Nota RGPD */}
            <p className="text-[12px] text-slate-400 text-center py-2">
                🔒 Datos recopilados con consentimiento del paciente · RGPD Art. 9.2.h · Uso exclusivo para gestión clínica · Rubio García Dental
            </p>
        </div>
    );
};

// ── Sección documentos firmados ─────────────────────────────────────

const DocumentosFirmadosSection: React.FC<{ numPac: string }> = ({ numPac }) => {
    const [docs, setDocs] = useState<DocumentoFirmadoEvento[]>([]);
    const [loading, setLoading] = useState(true);
    const [revoking, setRevoking] = useState<string | null>(null);
    const [motivo, setMotivo] = useState('');
    const [revocandoApi, setRevocandoApi] = useState(false);
    const [revokeError, setRevokeError] = useState<string | null>(null);

    useEffect(() => {
        if (!numPac) return;
        getDocumentosPorPaciente(numPac, true).then(d => setDocs(d)).finally(() => setLoading(false));
    }, [numPac]);

    const handleRevocar = async () => {
        if (!revoking || !motivo.trim()) { setRevokeError('El motivo es obligatorio'); return; }
        setRevocandoApi(true); setRevokeError(null);
        const ok = await revocarDocumento(revoking, motivo, 'recepcion');
        if (ok) {
            setDocs(prev => prev.map(d => d.id === revoking
                ? { ...d, revocado: true, revocadoAt: new Date().toISOString(), revocadoMotivo: motivo }
                : d));
            setRevoking(null); setMotivo('');
        } else {
            setRevokeError('Error al revocar. Inténtalo de nuevo.');
        }
        setRevocandoApi(false);
    };

    if (loading) return null;
    if (!docs.length) return (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
            <span className="material-icons text-slate-500">folder_open</span>
            <p className="text-[13px] text-slate-400">Sin documentos firmados registrados para este paciente.</p>
        </div>
    );

    return (
        <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <span className="material-icons text-indigo-500 text-lg">task_alt</span>
                    <h3 className="text-[13px] font-bold text-slate-600 uppercase tracking-widest">Documentos Firmados</h3>
                    <span className="ml-auto text-[12px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        {docs.filter(d => !d.revocado).length} vigentes
                    </span>
                </div>
                <div className="divide-y divide-slate-50">
                    {docs.map(doc => {
                        const meta = tipoDocLabel[doc.tipoDoc];
                        const fecha = doc.firmadoAt ? new Date(doc.firmadoAt).toLocaleString('es-ES') : '—';
                        return (
                            <div key={doc.id} className={`px-5 py-3 flex items-center gap-3 ${doc.revocado ? 'opacity-50 bg-slate-50' : ''}`}>
                                <span className="text-xl flex-shrink-0">{meta?.icon ?? '📄'}</span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[13px] font-bold text-slate-800">{meta?.label ?? doc.tipoDoc}</span>
                                        {doc.tratamiento && (
                                            <span className="text-[12px] bg-blue-50 text-[#051650] px-1.5 py-0.5 rounded font-bold">{doc.tratamiento}</span>
                                        )}
                                        {doc.esTutorFirmante && (
                                            <span className="text-[12px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">👨‍👦 Tutor</span>
                                        )}
                                        {doc.revocado && (
                                            <span className="text-[12px] bg-[#FFE0E6] text-[#E03555] px-1.5 py-0.5 rounded font-bold">🚫 Revocado</span>
                                        )}
                                    </div>
                                    <p className="text-[12px] text-slate-400 mt-0.5">
                                        {fecha}{doc.firmadoPor ? ` · ${doc.firmadoPor}` : ''}
                                        {doc.revocado && doc.revocadoMotivo && (
                                            <span className="ml-2 text-[#FF4B68]">· {doc.revocadoMotivo}</span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {doc.urlDocumento && (
                                        <a href={doc.urlDocumento} target="_blank" rel="noreferrer"
                                            className="px-2 py-1 rounded-lg text-[12px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                                            VER
                                        </a>
                                    )}
                                    {!doc.revocado && (
                                        <button
                                            onClick={() => { setRevoking(doc.id); setMotivo(''); setRevokeError(null); }}
                                            className="px-2 py-1 rounded-lg text-[12px] font-bold text-red-500 bg-[#FFF0F3] hover:bg-[#FFE0E6] transition-colors">
                                            REVOCAR
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal de revocación */}
            {revoking && (
                <div className="fixed inset-0 z-[400] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-sm font-bold text-slate-800 mb-1">🚫 Revocar documento</h3>
                        <p className="text-[13px] text-slate-500 mb-4">
                            Esta acción es irreversible. Debes indicar el motivo de revocación.
                        </p>
                        <textarea
                            className="w-full border border-slate-200 rounded-xl p-3 text-[13px] text-slate-700 resize-none focus:ring-2 focus:ring-red-300 focus:outline-none"
                            rows={3} placeholder="Motivo de revocación (obligatorio)..."
                            value={motivo} onChange={e => setMotivo(e.target.value)}
                        />
                        {revokeError && <p className="text-[13px] text-red-500 mt-1">⚠️ {revokeError}</p>}
                        <div className="flex gap-2 mt-4 justify-end">
                            <button onClick={() => setRevoking(null)}
                                className="px-4 py-2 rounded-lg text-[13px] font-bold text-slate-500 hover:bg-slate-100">
                                Cancelar
                            </button>
                            <button onClick={handleRevocar} disabled={revocandoApi || !motivo.trim()}
                                className="px-5 py-2 rounded-lg text-[13px] font-bold text-white bg-red-500 hover:bg-[#E03555] disabled:opacity-50">
                                {revocandoApi ? 'Revocando...' : 'Confirmar revocación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AnamnesisPanel;
