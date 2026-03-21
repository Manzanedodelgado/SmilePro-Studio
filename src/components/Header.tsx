import React, { useState, useRef, useEffect, useCallback } from 'react';
import { type Area } from '../types';
import { navigationItems } from '../navigation';
import { Search, Bell, Settings, HelpCircle, Package, LogOut, X, Clock, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getNotificaciones, type Notificacion } from '../services/notificaciones.service';

interface HeaderProps {
    activeArea: Area;
    onNavigate: (area: Area, subArea: string) => void;
    onSearch?: (term: string) => void;
    onCommandPalette?: () => void;
}


// ── P-001 FIX: iconos por nombre para Notificacion ──────────────────────
const getNotifIcon = (iconName: Notificacion['iconName']): React.ElementType => {
    switch (iconName) {
        case 'AlertTriangle': return AlertTriangle;
        case 'Clock':         return Clock;
        case 'CheckCircle2':  return CheckCircle2;
        case 'Package':       return Package;
        default:              return Info;
    }
};

// ── P-001 FIX: Hook de notificaciones conectado a datos reales ───────────
const useNotifications = () => {
    const [notifs, setNotifs] = useState<Notificacion[]>([]);

    const load = useCallback(async () => {
        const data = await getNotificaciones();
        setNotifs(data);
    }, []);

    useEffect(() => {
        load(); // carga inicial
        const interval = setInterval(load, 60_000); // refresco cada 60s
        return () => clearInterval(interval);
    }, [load]);

    return { notifs, reload: load };
};

const Header: React.FC<HeaderProps> = ({ activeArea, onNavigate, onCommandPalette }) => {
    const { logout, user } = useAuth();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [readNotifications, setReadNotifications] = useState<number[]>(() => {
        try { return JSON.parse(localStorage.getItem('smilepro_read_notifs') ?? '[]'); } catch { return []; }
    });
    const notifRef = useRef<HTMLDivElement>(null);
    const helpRef = useRef<HTMLDivElement>(null);
    const { notifs: notifications, reload: reloadNotifs } = useNotifications();
    const unread = notifications.filter(n => !readNotifications.includes(n.id)).length;

    // Cerrar dropdowns al clicar fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
            if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSettings = () => {
        onNavigate('IA & Automatización', 'IA Dental ✦');
    };

    const markAllRead = () => {
        const ids = notifications.map(n => n.id);
        setReadNotifications(ids);
        try { localStorage.setItem('smilepro_read_notifs', JSON.stringify(ids)); } catch { /* no-op */ }
    };

    const markOneRead = (id: number) => {
        setReadNotifications(prev => {
            const next = prev.includes(id) ? prev : [...prev, id];
            try { localStorage.setItem('smilepro_read_notifs', JSON.stringify(next)); } catch { /* no-op */ }
            return next;
        });
    };

    const notifColors = {
        warning: 'text-amber-600 bg-[#FEFDE8]',
        info: 'text-blue-500 bg-blue-50',
        success: 'text-blue-500 bg-blue-50',
    };

    // ── Mini-iconos de marca con los 4 colores del favicon ──────────────────
    // Favicon: #FF4B68 (coral) · #FBFFA3 (amarillo) · #118DF0 (azul brillante) · #004182 (azul marino)
    // Cada área tiene una disposición única de los 4 cuadros
    const BrandIcon = ({ area }: { area: string }) => {
        const layouts: Record<string, [string, string, string, string]> = {
            'CLÍNICA': ['#FF4B68', '#FBFFA3', '#118DF0', '#004182'], // original favicon
            'Agenda': ['#118DF0', '#FF4B68', '#004182', '#FBFFA3'], // azul arriba-izq
            'Pacientes': ['#FBFFA3', '#004182', '#FF4B68', '#118DF0'], // amarillo arriba-izq
            'Whatsapp': ['#004182', '#118DF0', '#FBFFA3', '#FF4B68'], // marino arriba-izq
            'IA & Automatización': ['#FBFFA3', '#FF4B68', '#118DF0', '#004182'], // amarillo-coral arriba
            'Inventario': ['#118DF0', '#004182', '#FBFFA3', '#FF4B68'], // azules arriba
            'Gestoría': ['#FF4B68', '#118DF0', '#004182', '#FBFFA3'], // coral-azul arriba
        };
        const [tl, tr, bl, br] = layouts[area] ?? layouts['CLÍNICA'];
        return (
            <svg width="14" height="14" viewBox="0 0 14 14" className="flex-shrink-0 rounded-[3px] overflow-hidden">
                <rect x="0" y="0" width="7" height="7" fill={tl} />
                <rect x="7" y="0" width="7" height="7" fill={tr} />
                <rect x="0" y="7" width="7" height="7" fill={bl} />
                <rect x="7" y="7" width="7" height="7" fill={br} />
            </svg>
        );
    };


    return (
        <header className="h-16 text-white flex items-center z-50 flex-shrink-0 shadow-md border-b-2 border-white sticky top-0 w-full relative bg-[#051650]" style={{ overflow: 'visible' }}>

            {/* Brand */}
            <div
                className="flex-shrink-0 flex items-center justify-between gap-3 pl-5 pr-4 cursor-pointer"
                style={{ width: '260px' }}
                onClick={() => onNavigate('CLÍNICA', 'General')}
            >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 rounded-[8px] overflow-hidden shadow-lg">
                    <rect x="0" y="0" width="18" height="18" fill="#FF4B68" />
                    <rect x="18" y="0" width="18" height="18" fill="#FBFFA3" />
                    <rect x="0" y="18" width="18" height="18" fill="#118DF0" />
                    <rect x="18" y="18" width="18" height="18" fill="#004182" />
                </svg>
                <div className="flex items-baseline gap-1.5 leading-none select-none">
                    <span className="text-white font-bold text-[22px] tracking-tight uppercase whitespace-nowrap">RUBIO GARCÍA</span>
                    <span className="font-bold text-[22px] tracking-tight uppercase whitespace-nowrap" style={{ color: '#2563eb', WebkitTextStroke: '0.5px rgba(255,255,255,0.6)' }}>DENTAL</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 flex items-center justify-center gap-1.5 min-w-0 px-4">
                {navigationItems.map((item) => {
                    const isActive = activeArea === item.name;
                    return (
                        <button
                            key={item.name}
                            onClick={() => {
                                const firstSubArea = item.children?.[0]?.name || 'General';
                                onNavigate(item.name as Area, firstSubArea);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 flex-shrink-0 whitespace-nowrap border font-bold ${isActive
                                ? 'text-[#051650] border-slate-200/60'
                                : 'text-white font-bold border-blue-400/30 shadow-md hover:brightness-110'
                                }`}
                            style={isActive
                                ? { background: 'rgba(255,255,255,0.95)' }
                                : { background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}
                        >
                            <BrandIcon area={item.name} />
                            <span className="text-[13px] font-bold uppercase tracking-wider">
                                {item.name}
                            </span>
                        </button>
                    );
                })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 pr-5 flex-shrink-0" style={{ width: '260px', justifyContent: 'flex-end' }}>

                {/* Search — M-01 FIX: Ahora funcional. Enter → navega a Pacientes con el término */}
                <button
                    onClick={onCommandPalette}
                    className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-1.5 border border-white/15 hover:bg-white/10 hover:border-white/25 transition-all cursor-pointer group"
                    title="Buscar en toda la aplicación (⌘K)"
                >
                    <Search className="w-3.5 h-3.5 text-white/50 group-hover:text-white/80 transition-colors" />
                    <span className="text-[12px] text-white/40 font-medium group-hover:text-white/60 transition-colors hidden sm:inline">Buscar...</span>
                    <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-bold text-white/30 bg-white/10 px-1.5 py-0.5 rounded border border-white/10 ml-2">⌘K</kbd>
                </button>

                {/* Bell — M-01 FIX: Panel de notificaciones real */}
                <div className="relative" ref={notifRef}>
                    <button
                        id="header-bell"
                        onClick={() => { setShowNotifications(v => !v); setShowHelp(false); }}
                        className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-[#0ea5e9] hover:bg-white/10 rounded-lg transition-all relative"
                        title="Notificaciones"
                    >
                        <Bell className="w-3.5 h-3.5" />
                        {unread > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[12px] font-bold rounded-full flex items-center justify-center leading-none">
                                {unread}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 top-10 w-max min-w-[320px] max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 z-[200] overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                                <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Notificaciones</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { reloadNotifs(); }} title="Refrescar" className="text-slate-400 hover:text-blue-500 transition-colors">
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                    </button>
                                    <button onClick={markAllRead} className="text-[12px] text-blue-500 font-bold hover:underline">Leídas</button>
                                </div>
                            </div>
                            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                                {notifications.length === 0 ? (
                                    <div className="px-4 py-8 text-center">
                                        <CheckCircle2 className="w-8 h-8 text-teal-400 mx-auto mb-2" />
                                        <p className="text-[13px] font-bold text-slate-500">Todo en orden</p>
                                        <p className="text-[12px] text-slate-400 mt-0.5">Sin alertas activas</p>
                                    </div>
                                ) : notifications.map(n => {
                                    const Icon = getNotifIcon(n.iconName);
                                    const isRead = readNotifications.includes(n.id);
                                    return (
                                        <div
                                            key={n.id}
                                            className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${isRead ? 'opacity-40' : ''}`}
                                            onClick={() => {
                                                markOneRead(n.id);
                                                if (n.area) onNavigate(n.area as any, n.subArea ?? '');
                                                setShowNotifications(false);
                                            }}
                                        >
                                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${notifColors[n.type]}`}>
                                                <Icon className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex-1 min-w-0 pr-4">
                                                <p className="text-[13px] font-bold text-slate-800 truncate">{n.title}</p>
                                                <p className="text-[12px] text-slate-500 leading-snug mt-0.5">{n.body}</p>
                                            </div>
                                            <span className="text-[12px] text-slate-400 font-medium flex-shrink-0 mt-0.5">{n.time}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Settings — M-01 FIX: Navega a configuración IA */}
                <button
                    id="header-settings"
                    onClick={handleSettings}
                    className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-[#0ea5e9] hover:bg-white/10 rounded-lg transition-all"
                    title="Configuración — IA & Automatización"
                >
                    <Settings className="w-3.5 h-3.5" />
                </button>

                {/* HelpCircle — M-01 FIX: Panel de ayuda rápida */}
                <div className="relative" ref={helpRef}>
                    <button
                        id="header-help"
                        onClick={() => { setShowHelp(v => !v); setShowNotifications(false); }}
                        className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-[#0ea5e9] hover:bg-white/10 rounded-lg transition-all"
                        title="Ayuda"
                    >
                        <HelpCircle className="w-3.5 h-3.5" />
                    </button>

                    {showHelp && (
                        <div className="absolute right-0 top-10 w-max min-w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[200] overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                                <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Ayuda Rápida</span>
                                <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="p-4 space-y-3">
                                {[
                                    { key: '⌘K / Ctrl+K', desc: 'Abrir el buscador universal (pacientes, acciones, navegación)' },
                                    { key: 'Click en Agenda', desc: 'Gestionar citas del día' },
                                    { key: 'Drag & Drop cita', desc: 'Arrastra para reprogramar hora/gabinete' },
                                    { key: 'Click derecho en cita', desc: 'Menú contextual (editar, cancelar, justificante)' },
                                ].map(({ key, desc }) => (
                                    <div key={key} className="flex items-start gap-2 whitespace-nowrap">
                                        <kbd className="text-[12px] font-bold bg-slate-800 text-white px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">{key}</kbd>
                                        <span className="text-[12px] text-slate-500 leading-snug whitespace-nowrap">{desc}</span>
                                    </div>
                                ))}
                                <div className="pt-2 border-t border-slate-100">
                                    <p className="text-[12px] text-slate-400 font-medium">SmilePro Studio · Rubio García Dental</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-px h-5 bg-white/15 mx-1" />
                <button
                    onClick={logout}
                    title={`Cerrar sesión (${user?.email || 'Usuario'})`}
                    className="h-8 px-2 flex items-center gap-1.5 bg-white/10 border border-white/15 text-white hover:bg-red-500/20 rounded-lg transition-all group"
                >
                    <div className="w-5 h-5 rounded-full bg-[#0ea5e9] flex items-center justify-center text-[12px] font-bold uppercase">
                        {user?.email?.charAt(0) || 'U'}
                    </div>
                    <LogOut className="w-3.5 h-3.5 text-white/70 group-hover:text-[#FF4B68] transition-colors" />
                </button>
            </div>
        </header>
    );
};

export default Header;