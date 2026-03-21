import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { signIn } from '../services/auth.service';
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
    const [muted, setMuted]       = useState(true);
    const [phase, setPhase]       = useState<0 | 1 | 2>(0);
    const [showLogo, setShowLogo]       = useState(false);
    const [showLogoImg, setShowLogoImg] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const { login } = useAuth();

    useEffect(() => {
        const tLogo    = setTimeout(() => setShowLogo(true),     100);   // fondo → blanco inmediato
        const tLogoImg = setTimeout(() => setShowLogoImg(true), 1700);  // imagen entra
        const t1    = setTimeout(() => setPhase(1), 6500);        // empieza a subir
        const t2    = setTimeout(() => setPhase(2), 8500);        // formulario aparece
        return () => { clearTimeout(tLogo); clearTimeout(tLogoImg); clearTimeout(t1); clearTimeout(t2); };
    }, []);

    useEffect(() => {
        if (videoRef.current) videoRef.current.muted = muted;
        if (audioRef.current) audioRef.current.muted = muted;
    }, [muted]);

    // Al llegar a fase 2: 1s de reproducción en posición fija, luego congela y pasa audio
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
        setLoading(true);
        try {
            const session = await signIn(email, password);
            if (session) {
                login(session.access_token, session.user, session.refresh_token);
            } else {
                setError('Credenciales inválidas. Comprueba usuario y contraseña.');
            }
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    // El vídeo vive siempre en su posición final (pequeño, arriba del formulario).
    // Durante la fase 0 lo proyectamos al centro de la pantalla con transform.
    // translateY(17vh) ≈ desplazamiento desde la parte superior del bloque centrado
    // hasta el centro de la pantalla. scale(4) lo hace suficientemente grande.
    const videoTransform = phase === 0
        ? 'translateY(17vh) scale(2.2)'
        : 'translateY(0) scale(1)';

    const videoTransition = phase === 1
        ? 'transform 3s cubic-bezier(0.25, 0, 0.1, 1), box-shadow 3s ease'
        : 'none';

    return (
        <div className="min-h-screen flex items-center justify-center overflow-hidden bg-[#020e2a] relative">

            {/* Resplandor de fondo */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(17,141,240,0.07) 0%, transparent 65%)' }} />

            {/* ── Bloque principal centrado ─────────────────────────────────── */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-8">

                {/* Vídeo / Logo — misma posición, cross-fade */}
                <div
                    style={{
                        transform: videoTransform,
                        transition: videoTransition,
                        boxShadow: showLogoImg
                            ? '0 0 0px transparent'
                            : phase === 0
                                ? '0 0 120px rgba(17,141,240,0.35), 0 0 40px rgba(17,141,240,0.2)'
                                : '0 0 24px rgba(17,141,240,0.15)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        width: '100%',
                        // logo ratio 3312:1440 ≈ 2.3:1 → al ancho completo del bloque (~288px) = ~125px
                        height: '158px',
                        flexShrink: 0,
                        position: 'relative',
                        willChange: 'transform',
                    }}
                >
                    <video
                        ref={videoRef}
                        src="/login-bg.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center center',
                            transform: 'scale(1.35)',
                            opacity: showLogo ? 0 : 1,
                            transition: 'opacity 2.5s ease',
                        }}
                    />
                    {/* Fondo que transiciona de oscuro a blanco antes de revelar el logo */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: showLogo ? '#ffffff' : '#020e2a',
                        transition: 'background-color 1.5s ease',
                    }} />
                    <img
                        src="/clinic-logo.jpg"
                        alt="Rubio García Dental"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            opacity: showLogoImg ? 1 : 0,
                            transform: showLogoImg ? 'scale(1)' : 'scale(1.06)',
                            transition: 'opacity 2s ease, transform 2.2s ease',
                        }}
                    />
                </div>


                {/* Formulario — aparece en fase 2 con ligero retraso */}
                <form
                    onSubmit={handleSubmit}
                    className="w-full space-y-4 mt-7"
                    style={{
                        opacity: phase >= 2 ? 1 : 0,
                        transform: phase >= 2 ? 'translateY(0)' : 'translateY(14px)',
                        transition: 'opacity 1s ease 0.15s, transform 1s ease 0.15s',
                    }}
                >
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 animate-shake">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <p className="text-[13px] font-semibold">{error}</p>
                        </div>
                    )}

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
                </form>

                {/* SmilePro Studio — baja a los pies del formulario */}
                <div
                    className="mt-10 text-center"
                    style={{
                        opacity: phase >= 2 ? 1 : 0,
                        transition: 'opacity 1.2s ease 0.4s',
                    }}
                >
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                        SmilePro <span className="text-[#118DF0]">Studio</span>
                    </h2>
                    <p className="text-white/30 text-[11px] font-semibold uppercase tracking-[0.2em] mt-1.5">
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
            `}</style>
        </div>
    );
};

export default Login;
