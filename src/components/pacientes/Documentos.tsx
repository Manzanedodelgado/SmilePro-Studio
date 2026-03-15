
import React, { useState, useEffect, useCallback } from 'react';
import {
    getDocumentosByPaciente, crearDocumento, firmarDocumento, crearTokenFirma,
    type PatientDocument, type DocumentoTipo,
} from '../../services/documentos.service';
import { sendTextMessage, isEvolutionConfigured, normalizePhone } from '../../services/evolution.service';
import { useAuth } from '../../context/AuthContext';
import { logAudit } from '../../services/audit.service';

// ── Plantillas de documentos disponibles ──────────────────────────

const TEMPLATES: { id: string; titulo: string; tipo: DocumentoTipo }[] = [
    { id: 'tpl_rgpd', titulo: 'Protección de Datos (RGPD)', tipo: 'RGPD' },
    { id: 'tpl_cirugia', titulo: 'Consentimiento Informado - Cirugía Oral', tipo: 'Consentimiento' },
    { id: 'tpl_implantes', titulo: 'Consentimiento Informado - Implantología', tipo: 'Consentimiento' },
    { id: 'tpl_postop', titulo: 'Instrucciones Post-Operatorias', tipo: 'Instrucciones' },
];

// ── Props ──────────────────────────────────────────────────────────

interface DocumentosProps {
    numPac: string;
    nombrePaciente?: string;
    telefono?: string;
    onDocumentSigned?: () => void;
}

// ── Componente principal ───────────────────────────────────────────

const Documentos: React.FC<DocumentosProps> = ({ numPac, nombrePaciente, telefono, onDocumentSigned }) => {
    const { user } = useAuth() as any;
    const [docs, setDocs] = useState<PatientDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pendientes' | 'historial' | 'generar'>('pendientes');
    const [signingDoc, setSigningDoc] = useState<PatientDocument | null>(null);
    const [consentChecked, setConsentChecked] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

    // ── Carga inicial desde BD ──────────────────────────────────────
    const loadDocumentos = useCallback(async () => {
        if (!numPac) return;
        setLoading(true);
        try {
            const rows = await getDocumentosByPaciente(numPac);
            setDocs(rows);
        } finally {
            setLoading(false);
        }
    }, [numPac]);

    useEffect(() => {
        loadDocumentos();
    }, [loadDocumentos]);

    // ── Mostrar feedback temporal ───────────────────────────────────
    const showFeedback = (tipo: 'success' | 'error', mensaje: string) => {
        setFeedback({ tipo, mensaje });
        setTimeout(() => setFeedback(null), 4000);
    };

    // ── Generar nuevo documento (persiste en BD) ────────────────────
    const handleGenerate = async (template: typeof TEMPLATES[0]) => {
        if (!numPac || !user?.email) return;
        setIsGenerating(true);
        try {
            const doc = await crearDocumento({
                numPac,
                titulo: template.titulo,
                tipo: template.tipo,
                templateId: template.id,
                createdBy: user.email,
            });

            if (doc) {
                setDocs(prev => [doc, ...prev]);
                setActiveTab('pendientes');
                logAudit({
                    action: 'GENERATE_DOCUMENT', entity_type: 'patient_document', entity_id: doc.id,
                    details: { titulo: template.titulo, numPac }
                });
                showFeedback('success', `Documento "${template.titulo}" creado correctamente`);
            } else {
                showFeedback('error', 'Error al crear el documento. Comprueba la conexión.');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    // ── Firmar documento (persiste firma real en BD) ─────────────────
    const handleSign = async () => {
        if (!signingDoc || !consentChecked) return;
        setIsSigning(true);

        try {
            const firma = await firmarDocumento({
                documentId: signingDoc.id,
                numPac,
                firmanteNombre: nombrePaciente ?? 'Paciente',
                firmanteTipo: 'paciente',
                metodoFirma: 'checkbox_aceptacion',
                consentimientoLeido: true,
                profesionalEmail: user?.email,
            });

            if (firma) {
                // Actualizar estado local del documento
                setDocs(prev => prev.map(d =>
                    d.id === signingDoc.id
                        ? { ...d, estado: 'Firmado' as const, updated_at: new Date().toISOString() }
                        : d
                ));
                setSigningDoc(null);
                setConsentChecked(false);
                showFeedback('success', '✅ Documento firmado y guardado legalmente en base de datos');
                onDocumentSigned?.();
            } else {
                // Si BD no disponible, al menos informar que la firma NO se persiste
                showFeedback('error', '⚠️ BD no disponible — la firma no se ha guardado. Contacta con soporte.');
            }
        } finally {
            setIsSigning(false);
        }
    };

    // ── Enviar enlace de firma remota por WhatsApp ──────────────────
    const handleSendToMobile = async (doc: PatientDocument) => {
        const { token, url } = crearTokenFirma({
            documentId: doc.id,
            numPac,
            nombrePaciente: nombrePaciente ?? 'Paciente',
            tituloDocumento: doc.titulo,
            tipoDocumento: doc.tipo,
        });

        const mensaje =
            `Hola${nombrePaciente ? ` ${nombrePaciente}` : ''},\n\n` +
            `Le enviamos el siguiente documento para firmar de forma digital desde su dispositivo:\n\n` +
            `📄 *${doc.titulo}*\n\n` +
            `Pulse el enlace para leer y firmar (válido 48 h):\n${url}\n\n` +
            `Rubio García Dental`;

        const phone = telefono?.trim();
        if (phone && isEvolutionConfigured()) {
            const ok = await sendTextMessage(normalizePhone(phone), mensaje);
            if (ok) {
                showFeedback('success', '✅ Enlace de firma enviado por WhatsApp');
            } else {
                await navigator.clipboard.writeText(url).catch(() => {});
                showFeedback('error', 'No se pudo enviar por WhatsApp — enlace copiado al portapapeles');
            }
        } else {
            await navigator.clipboard.writeText(url).catch(() => {});
            showFeedback('success', `📋 Enlace copiado (token: ${token.slice(0, 8)}…)`);
        }
    };

    const pendientes = docs.filter(d => d.estado === 'Pendiente');
    const historial = docs.filter(d => d.estado !== 'Pendiente');

    return (
        <div className="space-y-6 animate-fade-in relative">

            {/* Feedback toast */}
            {feedback && (
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-2 animate-fade-in text-white text-sm font-bold uppercase ${feedback.tipo === 'success' ? 'bg-blue-500' : 'bg-red-500'}`}>
                    <span className="material-icons">{feedback.tipo === 'success' ? 'verified' : 'error_outline'}</span>
                    <span>{feedback.mensaje}</span>
                </div>
            )}

            {/* Header / tabs */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    {(['pendientes', 'historial', 'generar'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-widest transition-all flex items-center gap-2
                                ${activeTab === tab ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            {tab === 'generar' ? '+ Nuevo' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {tab === 'pendientes' && pendientes.length > 0 && (
                                <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[12px]">{pendientes.length}</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="hidden md:flex items-center gap-2 text-[12px] text-slate-400 font-medium">
                    <span className="material-icons text-base">security</span>
                    Registro legal en BD · RGPD Art. 9
                </div>
            </div>

            {/* VISTA: PENDIENTES */}
            {activeTab === 'pendientes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                        <div className="col-span-full py-12 flex items-center justify-center gap-3 text-slate-400">
                            <span className="material-icons animate-spin text-2xl">refresh</span>
                            <span className="text-[13px] font-bold uppercase">Cargando documentos...</span>
                        </div>
                    ) : pendientes.length === 0 ? (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl">
                            <span className="material-icons text-4xl mb-2">assignment_turned_in</span>
                            <p className="text-[13px] font-bold uppercase">Todo en orden · Sin pendientes</p>
                        </div>
                    ) : (
                        pendientes.map(doc => (
                            <div key={doc.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                <div className="absolute top-0 left-0 w-1 h-full bg-orange-400" />
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                                        <span className="material-icons">description</span>
                                    </div>
                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[12px] font-bold uppercase rounded border border-orange-200">Pendiente</span>
                                </div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{doc.titulo}</h3>
                                <p className="text-[12px] text-slate-400 font-mono mb-1">Tipo: {doc.tipo}</p>
                                <p className="text-[12px] text-slate-400 font-mono mb-4">
                                    Creado: {new Date(doc.created_at).toLocaleDateString('es-ES')}
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={() => { setSigningDoc(doc); setConsentChecked(false); }}
                                        className="flex-1 py-2 bg-secondary text-white rounded-lg text-[12px] font-bold uppercase shadow-lg shadow-secondary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">
                                        <span className="material-icons text-sm">draw</span> Firmar Ahora
                                    </button>
                                    <button
                                        aria-label="Enviar enlace de firma por WhatsApp"
                                        title="Enviar enlace de firma por WhatsApp"
                                        onClick={() => handleSendToMobile(doc)}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-slate-400 hover:text-[#25D366] hover:border-[#25D366] transition-all">
                                        <span className="material-icons text-sm">send_to_mobile</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* VISTA: HISTORIAL */}
            {activeTab === 'historial' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="py-12 flex items-center justify-center gap-3 text-slate-400">
                            <span className="material-icons animate-spin">refresh</span>
                            <span className="text-[13px] font-bold uppercase">Cargando historial...</span>
                        </div>
                    ) : historial.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                            <span className="material-icons text-4xl mb-2">folder_open</span>
                            <p className="text-[13px] font-bold uppercase">Sin documentos firmados</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px] text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-[12px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
                                    <tr>
                                        <th className="p-4">Documento</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Fecha</th>
                                        <th className="p-4 text-center">Estado</th>
                                        <th className="p-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-[13px]">
                                    {historial.map(doc => (
                                        <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{doc.titulo}</td>
                                            <td className="p-4 text-slate-500">{doc.tipo}</td>
                                            <td className="p-4 font-mono text-slate-500 text-[12px]">
                                                {new Date(doc.updated_at).toLocaleDateString('es-ES')}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-bold uppercase border
                                                    ${doc.estado === 'Firmado' ? 'bg-blue-50 text-[#051650] border-blue-100' :
                                                        doc.estado === 'Caducado' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                            'bg-[#FFF0F3] text-[#E03555] border-red-100'}`}>
                                                    <span className="material-icons text-[12px]">
                                                        {doc.estado === 'Firmado' ? 'verified' : doc.estado === 'Caducado' ? 'schedule' : 'block'}
                                                    </span>
                                                    {doc.estado}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => {
                                                        logAudit({ action: 'VIEW_DOCUMENT', entity_type: 'patient_document', entity_id: doc.id, details: { numPac } });
                                                        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${doc.titulo}</title><style>
                                                            body{font-family:Arial,sans-serif;padding:40px;color:#1a1a2e;max-width:700px;margin:0 auto}
                                                            h1{font-size:20px;border-bottom:2px solid #051650;padding-bottom:10px;color:#051650}
                                                            .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:20px 0;font-size:13px}
                                                            .lbl{font-weight:bold;color:#666}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}
                                                            @media print{button{display:none}}
                                                        </style></head><body>
                                                        <h1>📄 ${doc.titulo}</h1>
                                                        <div class="grid">
                                                            <span class="lbl">Paciente</span><span>${nombrePaciente ?? numPac}</span>
                                                            <span class="lbl">Nº Paciente</span><span>${numPac}</span>
                                                            <span class="lbl">Tipo</span><span>${doc.tipo}</span>
                                                            <span class="lbl">Estado</span><span>${doc.estado}</span>
                                                            <span class="lbl">Creado</span><span>${new Date(doc.created_at).toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</span>
                                                            <span class="lbl">Actualizado</span><span>${new Date(doc.updated_at).toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</span>
                                                        </div>
                                                        <p style="font-size:12px;color:#555;border:1px solid #ddd;padding:12px;border-radius:6px">
                                                            ${doc.estado === 'Firmado' ? '✅ Firmado digitalmente y registrado conforme al RGPD Art. 9.' : '⏳ Pendiente de firma.'}<br/>
                                                            <small>Hash: ${doc.contenido_hash ?? 'N/D'}</small>
                                                        </p>
                                                        <div class="footer">Rubio García Dental · ${new Date().toLocaleString('es-ES')}</div>
                                                        <br/><button onclick="window.print()" style="padding:10px 24px;background:#051650;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🖨 Imprimir</button>
                                                        </body></html>`;
                                                        const win = window.open('', '_blank', 'width=800,height=600');
                                                        if (win) { win.document.write(html); win.document.close(); }
                                                    }}
                                                    className="text-secondary hover:text-secondary-dark font-bold text-[12px] uppercase hover:underline"
                                                >
                                                    Ver PDF
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* VISTA: GENERAR */}
            {activeTab === 'generar' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {TEMPLATES.map(tpl => (
                        <button key={tpl.id} onClick={() => handleGenerate(tpl)} disabled={isGenerating}
                            className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-secondary hover:shadow-md transition-all text-left bg-white dark:bg-slate-900 group disabled:opacity-50 disabled:cursor-not-allowed">
                            <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-secondary group-hover:text-white flex items-center justify-center mb-3 transition-colors">
                                <span className="material-icons text-2xl">{isGenerating ? 'hourglass_empty' : 'post_add'}</span>
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">{tpl.titulo}</h4>
                            <p className="text-[12px] text-slate-400 mt-1 uppercase tracking-widest">{tpl.tipo}</p>
                        </button>
                    ))}
                </div>
            )}

            {/* MODAL DE FIRMA — persistencia real */}
            {signingDoc && (
                <div className="fixed inset-0 z-[6000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase">
                                Firmando: {signingDoc.titulo}
                            </h3>
                            <button onClick={() => { setSigningDoc(null); setConsentChecked(false); }}
                                className="p-1 hover:bg-slate-200 rounded-full" aria-label="Cerrar modal de firma">
                                <span className="material-icons text-sm">close</span>
                            </button>
                        </div>
                        <div className="p-6">
                            {/* Área de firma visual */}
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl h-40 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                <span className="material-icons text-5xl text-slate-200">draw</span>
                                <p className="text-slate-400 text-[13px] font-bold uppercase tracking-widest">
                                    Área de firma biométrica
                                </p>
                                <p className="text-slate-300 text-[12px]">
                                    (Confirma con el botón inferior)
                                </p>
                            </div>

                            {/* Aviso legal */}
                            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
                                <p className="text-[12px] text-blue-600 dark:text-blue-400">
                                    🔒 Esta firma se almacenará de forma permanente en la base de datos con timestamp, hash de integridad y registro de auditoría conforme al RGPD Art. 9.
                                </p>
                            </div>

                            {/* Checkbox de consentimiento */}
                            <div className="mt-4 flex items-start gap-2">
                                <input
                                    type="checkbox"
                                    id="consent-check"
                                    checked={consentChecked}
                                    onChange={e => setConsentChecked(e.target.checked)}
                                    className="w-4 h-4 text-secondary rounded focus:ring-secondary mt-0.5 cursor-pointer"
                                />
                                <label htmlFor="consent-check" className="text-[13px] text-slate-500 cursor-pointer leading-relaxed">
                                    He leído y comprendo los términos del documento. Consiento voluntariamente su firma y almacenamiento según la normativa RGPD.
                                </label>
                            </div>

                            {/* Botones */}
                            <div className="mt-6 flex gap-3">
                                <button onClick={() => { setSigningDoc(null); setConsentChecked(false); }}
                                    className="flex-1 py-3 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-500 hover:bg-slate-50">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSign}
                                    disabled={!consentChecked || isSigning}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl text-[13px] font-bold uppercase shadow-lg hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {isSigning ? (
                                        <><span className="material-icons text-sm animate-spin">refresh</span> Guardando...</>
                                    ) : (
                                        <><span className="material-icons text-sm">verified</span> Confirmar Firma Legal</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Documentos;
