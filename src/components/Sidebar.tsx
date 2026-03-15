import React, { useState, useEffect } from 'react';
import { type Area } from '../types';
import { navigationItems } from '../navigation';
import { type ColorMap, COLOR_MAPS, type EstudioRadiologico } from '../services/imagen.service';
import { getCitasByFecha } from '../services/citas.service';
import {
    LayoutDashboard, Calendar, Users, BarChart2, Package, Settings, MessageSquare,
    Search, UserPlus, ChevronRight, Activity, Clock, AlertCircle, TrendingUp,
    MoreHorizontal, PlusCircle, AlertTriangle, Monitor, FileText, Grid, CreditCard,
    Brain, FileCheck, ClipboardList, ShoppingCart, QrCode, Receipt, PieChart, Bot,
    Sliders, Palette, Wand2, CheckCircle2
} from 'lucide-react';

interface SidebarProps {
    activeArea: Area;
    activeSubArea: string;
    onNavigate: (area: Area, subArea: string) => void;
    radControls?: {
        brightness: number; contrast: number; sharpness: number; colorMap: ColorMap;
        onBrightness: (v: number) => void; onContrast: (v: number) => void;
        onSharpness: (v: number) => void; onColorMap: (v: ColorMap) => void;
        selectedStudy: EstudioRadiologico | null;
    };
}

// P-002 FIX: Hook de operativa en tiempo real desde DCitas
const useOperativaHoy = () => {
    const [espera, setEspera] = useState<{ id: string; nombre: string; tiempo: string; alerta: string; trat: string }[]>([]);
    const [gabinete, setGabinete] = useState<{ id: string; nombre: string; gab: string; doctor: string; tiempo: string }[]>([]);

    useEffect(() => {
        const load = async () => {
            const citas = await getCitasByFecha(new Date());
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();

            // En espera: estado 'espera'
            setEspera(citas
                .filter(c => c.estado === 'espera')
                .slice(0, 4)
                .map(c => {
                    const [h, m] = c.horaInicio.split(':').map(Number);
                    const minEspera = Math.max(0, nowMin - (h * 60 + m));
                    return {
                        id: c.id,
                        nombre: c.nombrePaciente,
                        tiempo: `${minEspera}`,
                        alerta: c.alertasMedicas.includes('Látex') ? 'Látex' : '',
                        trat: c.tratamiento,
                    };
                })
            );

            // En gabinete: estado 'gabinete'
            setGabinete(citas
                .filter(c => c.estado === 'gabinete')
                .slice(0, 2)
                .map(c => {
                    const [h, m] = c.horaInicio.split(':').map(Number);
                    const minGab = Math.max(0, nowMin - (h * 60 + m));
                    return {
                        id: c.id,
                        nombre: c.nombrePaciente,
                        gab: c.gabinete,
                        doctor: c.doctor,
                        tiempo: `${minGab} min`,
                    };
                })
            );
        };

        load();
        const interval = setInterval(load, 90_000); // refresco cada 90s
        return () => clearInterval(interval);
    }, []);

    return { espera, gabinete };
};

const Sidebar: React.FC<SidebarProps> = ({ activeArea, activeSubArea, onNavigate, radControls }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [enhanceSuccess, setEnhanceSuccess] = useState(false);
    const currentMenuItem = navigationItems.find(item => item.name === activeArea);

    if (!currentMenuItem?.children) {
        return null;
    }

    // Mapeo exhaustivo de iconos
    const getIcon = (iconName: string) => {
        switch (iconName) {
            // General
            case 'dashboard': return LayoutDashboard;
            case 'calendar_today': return Calendar;
            case 'people': return Users;
            case 'psychology': return Brain;
            case 'inventory_2': return Package;
            case 'admin_panel_settings': return Settings;
            case 'chat': return MessageSquare;

            // Sub-items Agenda
            case 'view_week': return Calendar;
            case 'view_day': return Calendar;
            case 'edit_calendar': return Settings;
            case 'hourglass_top': return Clock;

            // Sub-items Pacientes
            case 'medical_information': return Activity;
            case 'grid_view': return Grid;
            case 'sick': return AlertCircle;
            case 'description': return FileText;
            case 'payments': return CreditCard;
            case 'request_quote': return Receipt;

            // Sub-items IA
            case 'smart_toy': return Brain;
            case 'fact_check': return FileCheck;
            case 'rule': return ClipboardList;

            // Sub-items Inventario
            case 'qr_code_scanner': return QrCode;
            case 'shopping_cart': return ShoppingCart;

            // Sub-items Admin
            case 'account_balance': return BarChart2;
            case 'receipt_long': return FileText;
            case 'request_page': return FileText;
            case 'analytics': return PieChart;

            // Sub-items Whatsapp
            case 'inbox': return MessageSquare;
            case 'contacts': return Users;

            default: return Activity;
        }
    };

    // P-002 FIX: Datos de operativa desde citas reales
    const { espera: espera_real, gabinete: gabinete_real } = useOperativaHoy();

    // Mantener produccion como placeholder (requiere endpoint de facturación)
    const stats = {
        espera: espera_real,
        gabinete: gabinete_real,
        waitlist: [] as { id: string; nombre: string; trat: string; urgencia: string }[],
        produccion: { actual: 0, objetivo: 5000 }
    };

    const isAgenda = activeArea === 'Agenda';
    const isPacientes = activeArea === 'Pacientes';
    const isRadiologia = activeArea === 'Radiología';

    const handleEnhanceIA = async () => {
        if (!radControls) return;
        setIsEnhancing(true);
        await new Promise(r => setTimeout(r, 1500));
        setIsEnhancing(false);
        setEnhanceSuccess(true);
        setTimeout(() => setEnhanceSuccess(false), 2000);
    };

    // ── Colores de marca por área (extraídos del favicon) ─────────────────────
    // #FF4B68 coral · #FBFFA3 amarillo · #118DF0 azul brillante · #004182 azul marino
    const AREA_ACCENT: Record<string, { active: string; border: string; glow: string }> = {
        'CLÍNICA': { active: 'text-[#118DF0]', border: 'border-[#118DF0]', glow: 'rgba(17,141,240,0.2)' },
        'Agenda': { active: 'text-[#FF4B68]', border: 'border-[#FF4B68]', glow: 'rgba(255,75,104,0.2)' },
        'Pacientes': { active: 'text-[#0ea5e9]', border: 'border-[#0ea5e9]', glow: 'rgba(14,165,233,0.2)' },
        'Whatsapp': { active: 'text-[#22c55e]', border: 'border-[#22c55e]', glow: 'rgba(34,197,94,0.2)' },
        'IA & Automatización': { active: 'text-[#FBFFA3]', border: 'border-[#FBFFA3]', glow: 'rgba(251,255,163,0.15)' },
        'Inventario': { active: 'text-[#118DF0]', border: 'border-[#118DF0]', glow: 'rgba(17,141,240,0.2)' },
        'Gestoría': { active: 'text-[#a78bfa]', border: 'border-[#a78bfa]', glow: 'rgba(167,139,250,0.2)' },
    };
    const accent = AREA_ACCENT[activeArea] ?? { active: 'text-[#60a5fa]', border: 'border-[#1d4ed8]', glow: 'rgba(29,78,216,0.25)' };

    const MainIcon = getIcon(currentMenuItem.icon || 'clinic');
    const isExpanded = isHovered;


    return (
        <div className={`relative h-full flex-shrink-0 z-40 transition-all duration-300 ${isExpanded ? 'w-80' : 'w-[84px]'}`}>
            <aside
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`absolute inset-y-0 left-0 h-full flex flex-col border-r-0 z-40 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex-shrink-0 overflow-hidden shadow-2xl bg-gradient-to-br from-[#0c2a80] to-[#051650] border-[#051650] ${isExpanded ? 'w-80' : 'w-[84px]'}`}
            >
                {/* Header del Sidebar (Global Actions) */}
                <div className="h-16 flex items-center justify-center px-4 border-b border-white/10 flex-shrink-0 relative overflow-hidden w-full">
                    {/* Botones expandidos */}
                    <div className={`absolute inset-0 flex items-center px-4 gap-2 w-full transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[-10px] pointer-events-none'}`}>
                        <button
                            onClick={() => onNavigate('Pacientes', 'ACTION_SEARCH')}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md border border-white/20 transition-all active:scale-95 group"
                        >
                            <Search className="w-3.5 h-3.5" />
                            <span className="text-[13px] font-bold uppercase tracking-wider whitespace-nowrap">Buscar</span>
                        </button>
                        <button
                            onClick={() => onNavigate('Pacientes', 'ACTION_NEW')}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#0ea5e9] hover:bg-[#0284c7] text-white rounded-md transition-all active:scale-95 group font-bold"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span className="text-[13px] font-bold uppercase tracking-wider whitespace-nowrap">Nuevo</span>
                        </button>
                    </div>

                    {/* Botón contraído */}
                    <div className={`absolute inset-0 flex items-center justify-center w-full px-4 transition-all duration-300 ease-in-out ${!isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[10px] pointer-events-none'}`}>
                        <button
                            onClick={() => onNavigate('Pacientes', 'ACTION_SEARCH')}
                            title="Buscar"
                            className="w-full flex items-center justify-center py-2 bg-white/10 hover:bg-white/20 text-white rounded-md border border-white/20 transition-all active:scale-95"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar ${isExpanded ? 'px-4' : 'px-2'} flex flex-col gap-6 py-4`}>

                    {/* Título del Área */}
                    {currentMenuItem.title && (
                        <div className={`transition-all duration-300 relative h-20 w-full flex-shrink-0 flex items-center justify-center ${isExpanded ? 'px-4' : 'px-1'}`}>
                            <div className="absolute inset-x-0 top-3 flex flex-col items-center w-full px-inherit">
                                <div className="relative w-full flex items-center justify-center h-12">
                                    <div className={`absolute left-0 flex items-center gap-3 whitespace-nowrap transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                                        <div className="w-9 h-9 rounded-xl bg-[#0ea5e9]/15 border border-white/30 flex items-center justify-center flex-shrink-0 shadow-inner">
                                            <MainIcon className="w-4.5 h-4.5 text-[#0ea5e9]" />
                                        </div>
                                        <div className="min-w-0 flex-1 pr-4">
                                            <p className="text-[12px] font-bold text-white/70 uppercase tracking-[0.2em] leading-none mb-0.5">{activeArea}</p>
                                            <h2 className="text-[15px] font-bold text-white uppercase tracking-tight leading-tight truncate">{currentMenuItem.title}</h2>
                                        </div>
                                    </div>
                                    <div className={`absolute flex items-center justify-center transition-all duration-300 ease-in-out ${!isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                                        <div className="w-10 h-10 rounded-xl bg-[#0ea5e9]/15 border border-white/30 flex items-center justify-center flex-shrink-0 shadow-inner" title={`${activeArea} - ${currentMenuItem.title}`}>
                                            <MainIcon className="w-5 h-5 text-[#0ea5e9]" />
                                        </div>
                                    </div>
                                </div>
                                <div className={`h-px w-full transition-all duration-300 ease-in-out absolute top-14 ${isExpanded ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} style={{ background: 'linear-gradient(to right, rgba(14,165,233,0.4), transparent)' }} />
                            </div>
                        </div>
                    )}

                    {/* NAVEGACIÓN ESTÁNDAR */}
                    <nav className="flex flex-col gap-1 w-full">
                        {currentMenuItem.children.map((subItem) => {
                            const SubIcon = getIcon(subItem.icon || 'dashboard');
                            const isActive = activeSubArea === subItem.name;
                            return (
                                <button
                                    key={subItem.name}
                                    title={!isExpanded ? subItem.name : undefined}
                                    onClick={() => onNavigate(activeArea, subItem.name)}
                                    className={`relative flex items-center overflow-hidden rounded-lg group transition-all duration-300 ease-in-out h-11 ${isExpanded ? 'w-full px-4 border-l-4' : 'w-11 justify-center mx-auto border-l-[3px]'
                                        } ${isActive
                                            ? 'border-[#1d4ed8] text-white shadow-sm'
                                            : 'bg-transparent border-transparent text-white/80 hover:bg-white/15 hover:text-white/90'
                                        }`}
                                    style={isActive ? { background: 'linear-gradient(135deg, rgba(29,78,216,0.25), rgba(37,99,235,0.15))' } : {}}
                                >
                                    {/* Icon Container with fixed alignment */}
                                    <div className="flex items-center justify-center flex-shrink-0 w-5 h-5 relative">
                                        <SubIcon className={`absolute transition-transform duration-300 ${isExpanded ? 'w-4 h-4' : 'w-[18px] h-[18px]'} ${isActive ? 'text-[#60a5fa]' : 'text-white/80 group-hover:text-white'}`} />
                                    </div>

                                    <div className={`flex flex-1 items-center justify-between whitespace-nowrap transition-all duration-300 ease-in-out ${isExpanded ? 'ml-3 opacity-100 max-w-[200px]' : 'opacity-0 max-w-0 -translate-x-4 pointer-events-none'}`}>
                                        <span className="text-[13px] font-semibold text-left leading-tight truncate">
                                            {subItem.name}
                                        </span>
                                        {isActive && (
                                            <ChevronRight className="w-3.5 h-3.5 text-[#60a5fa]/60 flex-shrink-0 ml-2" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </nav>

                    {/* WIDGET RADIOLOGÍA: Controles IA */}
                    {isRadiologia && radControls && (
                        <div className={`border-t border-white/10 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100 pt-4 mt-2' : 'max-h-0 opacity-0'}`}>
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Brain className="w-3.5 h-3.5 text-purple-400" />
                                <span className="text-[12px] font-bold text-white/80 uppercase tracking-wider">IA Imagen</span>
                            </div>

                            {/* Sliders */}
                            <div className="space-y-3 px-1">
                                {[
                                    { label: 'Brillo', val: radControls.brightness, set: radControls.onBrightness, min: -100, max: 100 },
                                    { label: 'Contraste', val: radControls.contrast, set: radControls.onContrast, min: -100, max: 100 },
                                    { label: 'Nitidez', val: radControls.sharpness, set: radControls.onSharpness, min: 0, max: 100 },
                                ].map(({ label, val, set, min, max }) => (
                                    <div key={label}>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-[12px] font-semibold text-white/70 uppercase tracking-wide">{label}</span>
                                            <span className="text-[12px] font-mono text-blue-300">{val > 0 ? `+${val}` : val}</span>
                                        </div>
                                        <input type="range" min={min} max={max} value={val}
                                            onChange={e => set(Number(e.target.value))}
                                            className="w-full h-[2px] appearance-none bg-white/20 rounded-full cursor-pointer accent-blue-400" />
                                    </div>
                                ))}
                            </div>

                            {/* Botón Mejorar IA */}
                            <button onClick={handleEnhanceIA} disabled={isEnhancing}
                                className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-all ${isEnhancing ? 'bg-white/10 text-white/70 cursor-not-allowed'
                                    : enhanceSuccess ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                        : 'bg-gradient-to-r from-blue-600/80 to-purple-600/80 text-white hover:from-blue-500 hover:to-purple-500'
                                    }`}>
                                {isEnhancing ? (
                                    <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Procesando…</>
                                ) : enhanceSuccess ? (
                                    <><CheckCircle2 className="w-3.5 h-3.5" />Mejorado ✓</>
                                ) : (
                                    <><Wand2 className="w-3.5 h-3.5" />Mejorar con IA</>
                                )}
                            </button>

                            {/* Colorización */}
                            <div className="mt-3">
                                <p className="text-[12px] font-bold text-white/70 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                                    <Palette className="w-3 h-3" /> Colorización
                                </p>
                                <div className="grid grid-cols-2 gap-1">
                                    {COLOR_MAPS.map(cm => (
                                        <button key={cm.value}
                                            onClick={() => radControls.onColorMap(cm.value)}
                                            className={`px-2 py-1.5 rounded-lg text-[12px] font-bold transition-all border ${radControls.colorMap === cm.value
                                                ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                                                : 'border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                                                }`}
                                            style={{ borderLeft: `2px solid ${cm.preview?.[0] ?? '#3b82f6'}` }}>
                                            {cm.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Metadatos DICOM */}
                            {radControls.selectedStudy?.dicomMeta && (
                                <div className="mt-3 border-t border-white/10 pt-3">
                                    <p className="text-[12px] font-bold text-white/70 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                                        <Activity className="w-3 h-3" /> Metadatos DICOM
                                    </p>
                                    <div className="space-y-1 text-[12px] px-1">
                                        {([
                                            ['Modalidad', radControls.selectedStudy.dicomMeta.modality],
                                            ['Fecha', radControls.selectedStudy.dicomMeta.studyDate],
                                            ['kVp', radControls.selectedStudy.dicomMeta.kvp?.toString()],
                                            ['Doctor', radControls.selectedStudy.doctor],
                                            ['Institución', radControls.selectedStudy.dicomMeta.institutionName],
                                        ] as [string, string | undefined][]).filter(([, v]) => v).map(([k, v]) => (
                                            <div key={k} className="flex gap-1">
                                                <span className="text-white/70 flex-shrink-0 w-14">{k}:</span>
                                                <span className="text-white/70 truncate">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Ruta en servidor */}
                            {radControls.selectedStudy?.rutaOrigen && (
                                <div className="mt-2 border-t border-white/10 pt-2 px-1">
                                    <p className="text-[12px] text-white/70 font-bold uppercase tracking-wider mb-1">Ruta</p>
                                    <p className="text-[12px] font-mono text-white/70 break-all leading-relaxed">{radControls.selectedStudy.rutaOrigen}</p>
                                </div>
                            )}

                            {/* Anotaciones */}
                            {(radControls.selectedStudy?.anotaciones?.length ?? 0) > 0 && (
                                <div className="mt-2 border-t border-white/10 pt-2">
                                    <p className="text-[12px] font-bold text-white/70 uppercase tracking-wider mb-2 px-1">
                                        Anotaciones ({radControls.selectedStudy!.anotaciones.length})
                                    </p>
                                    <div className="space-y-1">
                                        {radControls.selectedStudy!.anotaciones.map(an => (
                                            <div key={an.id} className="flex items-start gap-1.5 bg-white/5 rounded-lg px-2 py-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: an.color }} />
                                                <div>
                                                    <p className="text-[12px] text-white/70 leading-tight">{an.texto}</p>
                                                    <p className="text-[12px] text-white/70">{an.autor}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tags */}
                            {(radControls.selectedStudy?.tags?.length ?? 0) > 0 && (
                                <div className="mt-2 border-t border-white/10 pt-2 px-1">
                                    <p className="text-[12px] text-white/70 font-bold uppercase tracking-wider mb-1.5">Tags</p>
                                    <div className="flex flex-wrap gap-1">
                                        {radControls.selectedStudy!.tags.map(t => (
                                            <span key={t} className="text-[12px] px-1.5 py-0.5 bg-white/10 text-white/70 rounded border border-white/10">{t}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isAgenda && isExpanded && (
                        /* VISTA OPERATIVA (AGENDA) */
                        <div className="mt-2 border-t border-white/10 pt-4">
                            <div className="animate-fade-in space-y-6">
                                {/* WIDGET 2: Sala de Espera */}
                                <div>
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <div className="flex items-center gap-2 text-white/80">
                                            <div className="relative">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#FBFFA3] animate-pulse" title="Datos Simulados"></span>
                                            </div>
                                            <span className="text-[12px] font-bold uppercase tracking-wider">Sala de Espera</span>
                                        </div>
                                        <span className="bg-[#0ea5e9] text-white text-[12px] font-bold px-1.5 py-0.5 rounded-md">{stats.espera.length}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {stats.espera.map((p) => (
                                            <div key={p.id} className="bg-white p-2.5 rounded-lg flex items-center gap-3 hover:bg-slate-50 transition-all cursor-pointer border border-slate-100">
                                                <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${parseInt(p.tiempo) > 10 ? 'bg-red-500/20 text-red-500 border border-[#FF4B68]/30' : 'bg-blue-500/20 text-[#051650] border border-blue-500/30'}`}>
                                                    <div className="flex flex-col items-center leading-none">
                                                        <span className="text-[13px] font-bold">{p.tiempo.split(' ')[0]}</span>
                                                        <span className="text-[12px] font-bold uppercase">min</span>
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-bold text-slate-800 truncate leading-tight">{p.nombre}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide truncate">{p.trat}</span>
                                                        {p.alerta === "Látex" && <span className="w-1.5 h-1.5 bg-[#FF6E87] rounded-full"></span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* WIDGET 3: En Gabinete */}
                                <div>
                                    <div className="flex items-center justify-between mb-3 px-1 mt-2">
                                        <div className="flex items-center gap-2 text-white/80">
                                            <Activity className="w-3.5 h-3.5" />
                                            <span className="text-[12px] font-bold uppercase tracking-widest">En Gabinete</span>
                                        </div>
                                        <span className="bg-[#0ea5e9] text-white text-[12px] font-bold px-1.5 py-0.5 rounded-md">{stats.gabinete.length}</span>
                                    </div>
                                    {stats.gabinete.length === 0 ? (
                                        <p className="text-[12px] text-white/40 px-1 italic">Sin pacientes en gabinete</p>
                                    ) : stats.gabinete.map(g => (
                                        <div key={g.id} className="bg-white border-l-4 border-l-[#051650] border border-slate-200 p-3 rounded-lg flex items-center gap-3 hover:bg-slate-50 transition-all cursor-pointer mb-1.5">
                                            <div className="w-10 h-10 rounded-lg bg-[#051650] text-white flex items-center justify-center flex-shrink-0 font-bold text-sm">
                                                {g.gab}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold text-slate-800 truncate leading-tight">{g.nombre.split(',')[0] || g.nombre}</p>
                                                <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">{g.doctor} • {g.tiempo}</span>
                                            </div>
                                            <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]"></span>
                                        </div>
                                    ))}
                                </div>


                            </div>
                        </div>
                    )}
                </div>

                {/* ACCIONES RÁPIDAS GLOBALES */}
                <div className={`p-3 border-t border-white/10 transition-all duration-300 mt-auto ${isExpanded ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2 items-center'}`}>
                    {isExpanded ? (
                        <>
                            <button className="flex items-center justify-center gap-2 py-2 bg-[#0a2150] hover:bg-[#0d2760] text-white rounded-md border border-[#1a3a7a] transition-all active:scale-95 animate-fade-in">
                                <PlusCircle className="w-4 h-4" />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Cita</span>
                            </button>
                            <button className="flex items-center justify-center gap-2 py-2 bg-[#C02040] hover:bg-[#E03555] text-white rounded-md border border-red-800 transition-all active:scale-95 animate-fade-in">
                                <AlertTriangle className="w-4 h-4" style={{ color: '#FF4B68' }} />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Urgente</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="w-11 h-11 flex items-center justify-center bg-[#0a2150] hover:bg-[#0d2760] text-white rounded-xl border border-[#1a3a7a] transition-all active:scale-95 animate-fade-in shadow-inner" title="Nueva Cita">
                                <PlusCircle className="w-[18px] h-[18px]" />
                            </button>
                            <button className="w-11 h-11 flex items-center justify-center bg-[#C02040]/80 hover:bg-[#E03555] text-white rounded-xl border border-red-800 transition-all active:scale-95 animate-fade-in shadow-inner" title="Urgencia">
                                <AlertTriangle className="w-[18px] h-[18px]" style={{ color: '#FF4B68' }} />
                            </button>
                        </>
                    )}
                </div>
            </aside>
        </div>
    );
};

export default Sidebar;