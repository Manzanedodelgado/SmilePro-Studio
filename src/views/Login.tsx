import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { signIn, enableDemoMode } from '../services/auth.service';
import { LogIn, Mail, Lock, AlertCircle, Volume2, VolumeX } from 'lucide-react';

// Fases de la animación:
//  0 → vídeo grande y centrado en pantalla (intro)
//  1 → vídeo sube y encoge a su posición final (transición)
//  2 → formulario y branding aparecen

const Login: React.FC = () => {
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState<string | null>(null);
    const [loading, setLoading]   = useState(false);
    const [backendUnavailable, setBackendUnavailable] = useState(false);
    const [muted, setMuted]       = useState(true);
    const [phase, setPhase]       = useState<0 | 1 | 2>(0);
    const [showLogo, setShowLogo]       = useState(false);
    const [showLogoImg, setShowLogoImg] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const { login } = useAuth();

    useEffect(() => {
        const tLogo    = setTimeout(() => setShowLogo(true),     100);
        const tLogoImg = setTimeout(() => setShowLogoImg(true),  300);
        const t1    = setTimeout(() => setPhase(1), 3500);
        const t2    = setTimeout(() => setPhase(2), 5500);
        return () => { clearTimeout(tLogo); clearTimeout(tLogoImg); clearTimeout(t1); clearTimeout(t2); };
    }, []);

    useEffect(() => {
        if (videoRef.current) videoRef.current.muted = muted;
        if (audioRef.current) audioRef.current.muted = muted;
    }, [muted]);

    useEffect(() => {
        if (phase !== 2) return;
        const timer = setTimeout(() => {
            const vid = videoRef.current;
            const aud = audioRef.current;
            if (!vid || !aud) return;
            const t = vid.currentTime;
            vid.pause();
            aud.currentTime = t;
            aud.muted = muted;
            aud.play().catch(() => { });
        }, 1000);
        return () => clearTimeout(timer);
    }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBackendUnavailable(false);
        setLoading(true);
        try {
            const session = await signIn(email, password);
            if (session) {
                login(session.access_token, session.user, session.refresh_token);
            } else {
                // Backend no responde o credenciales inválidas
                setBackendUnavailable(true);
                setError('⚠️ Backend no responde. Verifica que el servidor está activo. Si estás en desarrollo, usa "Modo Demo" abajo.');
            }
        } catch (err: any) {
            setError(err.message || 'Error desconocido al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const handleDemoMode = () => {
        const demoSession = enableDemoMode(true);
        if (demoSession) {
            login(demoSession.access_token, demoSession.user, demoSession.refresh_token);
        }
    };

    // El logo vive en su posición final (sobre el formulario).
    // Durante la fase 0 lo proyectamos al centro de la pantalla con transform.
    // translateY positivo porque el logo está arriba y baja al centro en la animación.
    const videoTransform = phase === 0
        ? 'translateY(22vh) scale(7)'
        : 'translateY(-16px) scale(1)';

    const videoTransition = 'transform 3s cubic-bezier(0.33, 0, 0, 1), box-shadow 3s ease, margin 3s cubic-bezier(0.33, 0, 0, 1)';

    return (
        <div className="min-h-screen flex items-center justify-center overflow-hidden bg-[#020e2a] relative">

            {/* Resplandor de fondo */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(17,141,240,0.07) 0%, transparent 65%)' }} />

            {/* ── Bloque principal centrado ─────────────────────────────────── */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-8">

                {/* Icono animado — Animación inicial y posición final SOBRE el formulario */}
                <div
                    style={{
                        transform: videoTransform,
                        transition: videoTransition,
                        boxShadow: 'none',
                        borderRadius: '0px',
                        overflow: 'visible',
                        width: '100%',
                        height: '80px',
                        flexShrink: 0,
                        position: 'relative',
                        willChange: 'transform, margin',
                        marginBottom: phase === 0 ? '10px' : '12px',
                    }}
                >
                    <img
                        src="/icono-captura.png?v=3"
                        alt="Logo"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            opacity: 1,
                            transform: 'scale(1)',
                            transition: 'opacity 2s ease, transform 2.2s ease, filter 3s ease',
                            filter: phase === 0
                                ? 'drop-shadow(0 0 20px rgba(17,141,240,0.5)) drop-shadow(0 0 50px rgba(17,141,240,0.3)) drop-shadow(0 0 80px rgba(17,141,240,0.15))'
                                : 'drop-shadow(0 0 0px transparent)',
                        }}
                    />
                </div>

                {/* Texto Rubio García Dental bajo el icono */}
                <div
                    className="text-center w-full mb-10"
                    style={{
                        opacity: phase >= 2 ? 1 : 0,
                        transform: phase >= 2 ? 'translateY(8px)' : 'translateY(0px)',
                        transition: 'opacity 1.2s ease 0.5s, transform 1.2s ease 0.5s',
                    }}
                >
                    <p className="text-white/70 text-[22px] font-semibold uppercase tracking-[0.15em] drop-shadow-md whitespace-nowrap">
                        Rubio García Dental
                    </p>
                </div>
                {/* Formulario — aparece en fase 2 con ligero retraso */}
                <form
                    onSubmit={handleSubmit}
                    className="w-full"
                    style={{
                        opacity: phase >= 2 ? 1 : 0,
                        transform: phase >= 2 ? 'translateY(0) translateZ(0)' : 'translateY(14px) translateZ(0)',
                        transition: 'opacity 1s ease 0.15s, transform 1s ease 0.15s',
                        willChange: 'opacity',
                        WebkitFontSmoothing: 'antialiased',
                    }}
                >
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 animate-shake">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <p className="text-[13px] font-semibold">{error}</p>
                        </div>
                    )}
                    <div className="space-y-8">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-[#118DF0]/60 transition-all">
                        <div className="flex items-center justify-center w-11 flex-shrink-0">
                            <Mail className="w-[18px] h-[18px] text-white/50" />
                        </div>
                        <input
                            type="text"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="flex-1 pl-2 pr-4 py-3.5 bg-transparent outline-none text-[15px] font-medium text-white placeholder:text-white/25"
                            placeholder="Email o usuario"
                        />
                    </div>

                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-[#118DF0]/60 transition-all">
                        <div className="flex items-center justify-center w-11 flex-shrink-0">
                            <Lock className="w-[18px] h-[18px] text-white/50" />
                        </div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="flex-1 pl-2 pr-4 py-3.5 bg-transparent outline-none text-[15px] font-medium text-white placeholder:text-white/25"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl text-white font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>ACCEDER AL SISTEMA</span>
                                <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </>
                        )}
                    </button>

                    {/* Botón Modo Demo — SOLO visible cuando backend no responde */}
                    {backendUnavailable && (
                        <button
                            type="button"
                            onClick={handleDemoMode}
                            className="w-full py-2.5 rounded-xl text-amber-300 font-semibold text-sm active:scale-[0.98] transition-all border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                        >
                            📱 Modo Demo (sin backend)
                        </button>
                    )}
                    </div>
                </form>

                {/* SmilePro Studio — Justo debajo del formulario */}
                <div
                    className="mt-4 flex flex-col items-center justify-center pointer-events-none"
                    style={{
                        opacity: phase >= 2 ? 1 : 0,
                        transform: phase >= 2 ? 'translateY(0)' : 'translateY(10px)',
                        transition: 'opacity 1.2s ease 0.6s, transform 1.2s ease 0.6s',
                    }}
                >
                    <h2 className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
                        SmilePro <span className="text-[#118DF0]">Studio</span>
                    </h2>
                    <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.25em] mt-2 drop-shadow">
                        Ecosistema Dental Inteligente
                    </p>
                </div>

            </div>
            {/* Autoría */}
            <p className="fixed bottom-4 right-5 text-[10px] text-white/20 tracking-widest uppercase select-none pointer-events-none">
                © {new Date().getFullYear()} Rubio García Dental · SmilePro Studio
            </p>

            {/* Botón mute — solo visible durante el vídeo */}
            <button
                onClick={() => setMuted(v => !v)}
                className="fixed bottom-6 left-6 z-50 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/50 hover:text-white transition-all"
                style={{
                    opacity: phase < 2 ? 1 : 0,
                    pointerEvents: phase < 2 ? 'auto' : 'none',
                    transition: 'opacity 0.5s ease',
                }}
                title={muted ? 'Activar sonido' : 'Silenciar'}
            >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Audio independiente — toma el relevo cuando el vídeo se congela */}
            <audio ref={audioRef} src="/login-bg.mp4" loop muted />

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25%       { transform: translateX(-4px); }
                    75%       { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus {
                    -webkit-box-shadow: 0 0 0px 1000px transparent inset !important;
                    -webkit-text-fill-color: white !important;
                    transition: background-color 5000s ease-in-out 0s;
                    font-size: 15px !important;
                    font-weight: 500 !important;
                }
            `}</style>
        </div>
    );
};

export default Login;
