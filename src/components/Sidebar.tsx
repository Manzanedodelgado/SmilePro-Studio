import React, { useState, useEffect } from 'react';
import { type Area } from '../types';
import { navigationItems } from '../navigation';
import { getCitasByFecha } from '../services/citas.service';
import {
    LayoutDashboard, Calendar, Users, BarChart2, Package, Settings, MessageSquare,
    Search, UserPlus, ChevronRight, Activity, Clock, AlertCircle,
    PlusCircle, AlertTriangle, FileText, Grid, CreditCard,
    Brain, FileCheck, ClipboardList, ShoppingCart, QrCode, Receipt, PieChart,
    Palette
} from 'lucide-react';

interface SidebarProps {
    activeArea: Area;
    activeSubArea: string;
    onNavigate: (area: Area, subArea: string, numPac?: string) => void;
}

// P-002 FIX: Hook de operativa en tiempo real desde DCitas
const useOperativaHoy = () => {
    const [espera, setEspera] = useState<{ id: string; numPac: string; nombre: string; tiempo: string; alerta: string; trat: string }[]>([]);
    const [gabinete, setGabinete] = useState<{ id: string; numPac: string; nombre: string; gab: string; doctor: string; tiempo: string }[]>([]);

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
                        numPac: c.pacienteNumPac ?? '',
                        nombre: c.nombrePaciente,
                        tiempo: `${minEspera}`,
                        alerta: c.alertasMedicas.includes('L\u00e1tex') ? 'L\u00e1tex' : '',
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
                        numPac: c.pacienteNumPac ?? '',
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

const Sidebar: React.FC<SidebarProps> = ({ activeArea, activeSubArea, onNavigate }) => {
    const [isHovered, setIsHovered] = useState(false);
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
                    {isAgenda && (
                        <div className="mt-2 border-t border-white/10 pt-4">
                            {/* Full widgets — visible solo expandido */}
                            <div className={`transition-all duration-300 ${isExpanded ? 'opacity-100 max-h-[600px]' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}`}>
                                <div className="space-y-6">
                                    {/* WIDGET: Sala de Espera */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2 px-1">
                                            <div className="flex items-center gap-2 text-white/80">
                                                <div className="relative">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#FBFFA3] animate-pulse" title="Datos Simulados"></span>
                                                </div>
                                                <span className="text-[12px] font-bold uppercase tracking-wider">Sala de Espera</span>
                                            </div>
                                            <span className="bg-pink-500 text-white text-[12px] font-bold px-1.5 py-0.5 rounded-md">{stats.espera.length}</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {stats.espera.map((p) => (
                                                <div key={p.id}
                                                    onClick={() => p.numPac && !p.numPac.startsWith('CTX-') ? onNavigate('Pacientes', 'Historia Clínica', p.numPac) : undefined}
                                                    className={`bg-white p-2.5 rounded-lg flex items-center gap-3 transition-all border border-slate-100 ${p.numPac && !p.numPac.startsWith('CTX-') ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-200' : 'cursor-default'}`}
                                                >
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

                                    {/* WIDGET: En Gabinete */}
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
                                            <div key={g.id}
                                                onClick={() => g.numPac && !g.numPac.startsWith('CTX-') ? onNavigate('Pacientes', 'Historia Clínica', g.numPac) : undefined}
                                                className={`bg-white border-l-4 border-l-[#051650] border border-slate-200 p-3 rounded-lg flex items-center gap-3 transition-all mb-1.5 ${g.numPac && !g.numPac.startsWith('CTX-') ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default hover:bg-slate-50'}`}
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-[#051650] text-white flex items-center justify-center flex-shrink-0 font-bold text-sm">{g.gab}</div>
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

                            {/* Badges compactos — visibles solo colapsado */}
                            <div className={`flex flex-col gap-3 items-center transition-all duration-300 ${!isExpanded ? 'opacity-100 max-h-[200px]' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}`}>
                                <div className="w-9 h-9 rounded-lg bg-pink-500 flex items-center justify-center shadow-inner" title={`${stats.espera.length} en espera`}>
                                    <span className="text-[14px] font-black text-white">{stats.espera.length}</span>
                                </div>
                                <div className="w-9 h-9 rounded-lg bg-[#0ea5e9] flex items-center justify-center shadow-inner" title={`${stats.gabinete.length} en consulta`}>
                                    <span className="text-[14px] font-black text-white">{stats.gabinete.length}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ACCIONES RÁPIDAS GLOBALES */}
                <div className={`p-3 border-t border-white/10 transition-all duration-300 mt-auto ${isExpanded ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2 items-center'}`}>
                    {isExpanded ? (
                        <>
                            <button onClick={() => onNavigate('Agenda', 'Nueva Cita')} className="flex items-center justify-center gap-2 py-2 bg-[#0a2150] hover:bg-[#0d2760] text-white rounded-md border border-[#1a3a7a] transition-all active:scale-95 animate-fade-in">
                                <PlusCircle className="w-4 h-4" />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Cita</span>
                            </button>
                            <button onClick={() => onNavigate('Agenda', 'Urgencia')} className="flex items-center justify-center gap-2 py-2 bg-[#C02040] hover:bg-[#E03555] text-white rounded-md border border-red-800 transition-all active:scale-95 animate-fade-in">
                                <AlertTriangle className="w-4 h-4" style={{ color: '#FF4B68' }} />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Urgente</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => onNavigate('Agenda', 'Nueva Cita')} className="w-11 h-11 flex items-center justify-center bg-[#0a2150] hover:bg-[#0d2760] text-white rounded-xl border border-[#1a3a7a] transition-all active:scale-95 animate-fade-in shadow-inner" title="Nueva Cita">
                                <PlusCircle className="w-[18px] h-[18px]" />
                            </button>
                            <button onClick={() => onNavigate('Agenda', 'Urgencia')} className="w-11 h-11 flex items-center justify-center bg-[#C02040]/80 hover:bg-[#E03555] text-white rounded-xl border border-red-800 transition-all active:scale-95 animate-fade-in shadow-inner" title="Urgencia">
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