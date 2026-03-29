import React, { useState, useEffect } from 'react';
import { getTokenFirma, consumirTokenFirma, type SigningToken } from '../services/documentos.service';

interface SignPageProps {
    token: string;
}

type Step = 'loading' | 'ready' | 'signing' | 'done' | 'expired';

const SignPage: React.FC<SignPageProps> = ({ token }) => {
    const [step, setStep] = useState<Step>('loading');
    const [info, setInfo] = useState<SigningToken | null>(null);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const entry = getTokenFirma(token);
        if (!entry) {
            setStep('expired');
        } else {
            setInfo(entry);
            setStep('ready');
        }
    }, [token]);

    const handleSign = async () => {
        if (!checked) return;
        setStep('signing');
        const ok = await consumirTokenFirma(token);
        setStep(ok ? 'done' : 'expired');
    };

    // ── Expired / not found ─────────────────────────────────────────
    if (step === 'expired') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#FFF0F3] flex items-center justify-center mx-auto">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h1 className="text-xl font-bold text-[#E03555]">Enlace caducado</h1>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Este enlace de firma ya no es válido o ha caducado (48 h).
                        Solicita uno nuevo en la clínica.
                    </p>
                    <p className="text-[12px] text-slate-300 font-bold uppercase tracking-widest">Rubio García Dental</p>
                </div>
            </div>
        );
    }

    // ── Success ─────────────────────────────────────────────────────
    if (step === 'done') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#051650] to-[#0c2a80] flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto border-4 border-blue-100">
                        <span className="text-4xl">✅</span>
                    </div>
                    <h1 className="text-xl font-bold text-[#051650]">Documento firmado</h1>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Su firma ha sido registrada correctamente con sello de tiempo y registro de auditoría conforme al <strong>RGPD Art. 9</strong>.
                    </p>
                    <div className="bg-blue-50 rounded-xl p-3 text-left space-y-1">
                        <p className="text-[12px] font-bold text-[#051650] uppercase tracking-widest">Documento firmado</p>
                        <p className="text-sm font-semibold text-slate-700">{info?.titulo_documento}</p>
                        <p className="text-[12px] text-slate-400">{new Date().toLocaleString('es-ES')}</p>
                    </div>
                    <p className="text-[12px] text-slate-300 font-bold uppercase tracking-widest pt-2">
                        Rubio García Dental · SmilePro
                    </p>
                </div>
            </div>
        );
    }

    // ── Loading ─────────────────────────────────────────────────────
    if (step === 'loading') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#051650]/20 border-t-[#051650] rounded-full animate-spin" />
            </div>
        );
    }

    // ── Ready to sign ───────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-br from-[#051650] to-[#0c2a80] px-6 pt-8 pb-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">🦷</span>
                    </div>
                    <p className="text-[12px] font-bold text-white/60 uppercase tracking-[0.25em] mb-1">
                        Rubio García Dental
                    </p>
                    <h1 className="text-xl font-bold text-white">Firma de documento</h1>
                </div>

                <div className="p-6 space-y-5">

                    {/* Document info */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Documento</p>
                        <p className="text-base font-bold text-[#051650]">{info?.titulo_documento}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-bold uppercase tracking-wider bg-blue-100 text-[#051650] px-2 py-0.5 rounded-full border border-blue-200">
                                {info?.tipo_documento}
                            </span>
                            <span className="text-[12px] text-slate-400">Paciente: {info?.nombre_paciente}</span>
                        </div>
                    </div>

                    {/* Legal text */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <p className="text-[12px] text-blue-700 leading-relaxed">
                            🔒 Esta firma se almacenará de forma permanente con sello de tiempo, hash de integridad
                            y registro de auditoría conforme al <strong>RGPD Art. 9</strong>. El carácter de la firma
                            es jurídicamente vinculante.
                        </p>
                    </div>

                    {/* Expiry notice */}
                    {info && (
                        <p className="text-[12px] text-slate-400 text-center">
                            Enlace válido hasta {new Date(info.expires_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}

                    {/* Checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setChecked(e.target.checked)}
                            className="w-5 h-5 mt-0.5 rounded text-[#051650] border-slate-300 focus:ring-[#051650] cursor-pointer flex-shrink-0"
                        />
                        <span className="text-sm text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
                            He leído y comprendo el contenido del documento. Consiento voluntariamente su firma y
                            almacenamiento según la normativa RGPD.
                        </span>
                    </label>

                    {/* Sign button */}
                    <button
                        onClick={handleSign}
                        disabled={!checked || step === 'signing'}
                        className="w-full py-4 rounded-2xl text-white font-bold text-[15px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                        style={{
                            background: checked
                                ? 'linear-gradient(135deg, #051650, #0c2a80)'
                                : undefined,
                        }}
                    >
                        {step === 'signing' ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Guardando…
                            </span>
                        ) : (
                            '✍️ Firmar documento'
                        )}
                    </button>
                </div>
            </div>

            <p className="mt-6 text-[12px] text-slate-400 text-center">
                SmilePro Studio · Rubio García Dental<br />
                Firmado de forma segura · RGPD Art. 9
            </p>
        </div>
    );
};

export default SignPage;
