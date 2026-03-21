import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { type Area, type Paciente } from '../types';
import { navigationItems } from '../navigation';
import { searchPacientes } from '../services/pacientes.service';
import {
    Search, Command, ArrowUp, ArrowDown, CornerDownLeft,
    Calendar, Users, Brain, MessageSquare, Package, BarChart3,
    Activity, ClipboardList, Grid3X3, AlertCircle, FileText, CreditCard, Receipt,
    UserPlus, CalendarPlus, Settings, Sparkles, X
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (area: Area, subArea: string, numPac?: string) => void;
}

interface CommandItem {
    id: string;
    label: string;
    sublabel?: string;
    icon: React.ElementType;
    category: 'navigation' | 'patient' | 'action';
    action: () => void;
    keywords?: string[];
}

/* ─── Icon Map ────────────────────────────────────────────────────────────── */
const AREA_ICONS: Record<string, React.ElementType> = {
    'CLÍNICA': Activity,
    'Agenda': Calendar,
    'Pacientes': Users,
    'Whatsapp': MessageSquare,
    'IA & Automatización': Brain,
    'Inventario': Package,
    'Gestoría': BarChart3,
};

const SUB_ICONS: Record<string, React.ElementType> = {
    'Historia Clínica': Activity,
    'Anamnesis': ClipboardList,
    'Odontograma 3D': Grid3X3,
    'Sondaje Periodontal': AlertCircle,
    'Radiología': Search,
    'Documentos y Consentimientos': FileText,
    'Cuenta Corriente': CreditCard,
    'Presupuestos': Receipt,
    'Panel IA': Brain,
    'IA Dental ✶': Sparkles,
    'Automatizaciones': Settings,
};

/* ─── Component ───────────────────────────────────────────────────────────── */
const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [patients, setPatients] = useState<Paciente[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Reset state on open/close
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setPatients([]);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Debounced patient search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.length >= 2) {
            setIsSearching(true);
            debounceRef.current = setTimeout(async () => {
                const results = await searchPacientes(query);
                setPatients(results.slice(0, 5));
                setIsSearching(false);
            }, 300);
        } else {
            setPatients([]);
            setIsSearching(false);
        }
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query]);

    // Build command items
    const navItems = useMemo<CommandItem[]>(() => {
        const items: CommandItem[] = [];

        // Quick actions — always visible at top
        items.push({
            id: 'action-new-patient',
            label: 'Nuevo Paciente',
            sublabel: 'Crear ficha de paciente nuevo',
            icon: UserPlus,
            category: 'action',
            action: () => { onNavigate('Pacientes', 'ACTION_NEW'); onClose(); },
            keywords: ['crear', 'nuevo', 'paciente', 'ficha', 'alta'],
        });
        items.push({
            id: 'action-new-cita',
            label: 'Nueva Cita',
            sublabel: 'Abrir agenda para programar cita',
            icon: CalendarPlus,
            category: 'action',
            action: () => { onNavigate('Agenda', 'Nueva Cita'); onClose(); },
            keywords: ['cita', 'programar', 'agenda', 'reservar'],
        });
        items.push({
            id: 'action-search-patient',
            label: 'Buscar Paciente',
            sublabel: 'Abrir buscador de pacientes',
            icon: Search,
            category: 'action',
            action: () => { onNavigate('Pacientes', 'ACTION_SEARCH'); onClose(); },
            keywords: ['buscar', 'encontrar', 'paciente', 'search'],
        });

        // Navigation items from navigation.ts
        navigationItems.forEach(area => {
            items.push({
                id: `nav-${area.name}`,
                label: area.name,
                sublabel: area.title || '',
                icon: AREA_ICONS[area.name] || Activity,
                category: 'navigation',
                action: () => { onNavigate(area.name, area.children?.[0]?.name || 'General'); onClose(); },
                keywords: [area.name.toLowerCase(), (area.title || '').toLowerCase()],
            });

            area.children?.forEach(sub => {
                items.push({
                    id: `nav-${area.name}-${sub.name}`,
                    label: sub.name,
                    sublabel: area.name,
                    icon: SUB_ICONS[sub.name] || AREA_ICONS[area.name] || Activity,
                    category: 'navigation',
                    action: () => { onNavigate(area.name, sub.name); onClose(); },
                    keywords: [sub.name.toLowerCase(), area.name.toLowerCase()],
                });
            });
        });

        return items;
    }, [onNavigate, onClose]);

    // Patient results as command items
    const patientItems = useMemo<CommandItem[]>(() => {
        return patients.map(p => ({
            id: `patient-${p.numPac}`,
            label: `${p.nombre} ${p.apellidos}`.trim(),
            sublabel: `#${p.numPac} · ${p.dni || 'Sin DNI'} · ${p.telefono || 'Sin tel.'}`,
            icon: Users,
            category: 'patient' as const,
            action: () => { onNavigate('Pacientes', 'Historia Clínica', p.numPac); onClose(); },
        }));
    }, [patients, onNavigate, onClose]);

    // Filter items based on query
    const filteredItems = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) {
            // Show: actions first, then first few nav items
            return [
                ...navItems.filter(i => i.category === 'action'),
                ...navItems.filter(i => i.category === 'navigation').slice(0, 8),
            ];
        }
        const navMatches = navItems.filter(item => {
            const searchable = [item.label, item.sublabel || '', ...(item.keywords || [])].join(' ').toLowerCase();
            return searchable.includes(q);
        });
        return [...patientItems, ...navMatches];
    }, [query, navItems, patientItems]);

    // Keep selectedIndex in bounds
    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredItems.length]);

    // Scroll selected item into view
    useEffect(() => {
        if (!listRef.current) return;
        const items = listRef.current.querySelectorAll('[data-command-item]');
        items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    // Keyboard handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                filteredItems[selectedIndex]?.action();
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredItems, selectedIndex, onClose]);

    // Close on backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    if (!isOpen) return null;

    // Group items by category for display
    const actionItems = filteredItems.filter(i => i.category === 'action');
    const patItems = filteredItems.filter(i => i.category === 'patient');
    const navFilteredItems = filteredItems.filter(i => i.category === 'navigation');

    let globalIdx = -1;
    const nextIdx = () => ++globalIdx;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
            onClick={handleBackdropClick}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

            {/* Palette */}
            <div
                className="relative w-full max-w-[640px] bg-white rounded-2xl shadow-[0_25px_60px_-10px_rgba(0,0,0,0.35)] border border-slate-200/80 overflow-hidden animate-scale-in"
                onKeyDown={handleKeyDown}
            >
                {/* Input Area */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                    <div className="p-1.5 bg-slate-100 rounded-lg">
                        <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar pacientes, acciones, secciones..."
                        className="flex-1 text-[15px] font-medium text-slate-800 placeholder:text-slate-400 bg-transparent outline-none"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="p-1 hover:bg-slate-100 rounded-md transition-colors">
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    )}
                    <kbd className="hidden sm:flex items-center gap-0.5 text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2 custom-scrollbar">
                    {/* Loading */}
                    {isSearching && (
                        <div className="flex items-center gap-3 px-5 py-3">
                            <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                            <span className="text-[13px] text-slate-400 font-medium">Buscando pacientes...</span>
                        </div>
                    )}

                    {/* Patient Results */}
                    {patItems.length > 0 && (
                        <div className="mb-1">
                            <div className="px-5 py-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pacientes</span>
                            </div>
                            {patItems.map(item => {
                                const idx = nextIdx();
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        data-command-item
                                        onClick={item.action}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors duration-100 group ${
                                            selectedIndex === idx
                                                ? 'bg-blue-50 text-blue-900'
                                                : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-xl flex-shrink-0 transition-colors ${
                                            selectedIndex === idx
                                                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14px] font-bold truncate">{item.label}</p>
                                            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{item.sublabel}</p>
                                        </div>
                                        {selectedIndex === idx && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <CornerDownLeft className="w-3.5 h-3.5 text-blue-400" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Quick Actions */}
                    {actionItems.length > 0 && (
                        <div className="mb-1">
                            <div className="px-5 py-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones Rápidas</span>
                            </div>
                            {actionItems.map(item => {
                                const idx = nextIdx();
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        data-command-item
                                        onClick={item.action}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors duration-100 group ${
                                            selectedIndex === idx
                                                ? 'bg-blue-50 text-blue-900'
                                                : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-xl flex-shrink-0 transition-colors ${
                                            selectedIndex === idx
                                                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14px] font-bold truncate">{item.label}</p>
                                            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{item.sublabel}</p>
                                        </div>
                                        {selectedIndex === idx && (
                                            <CornerDownLeft className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Navigation */}
                    {navFilteredItems.length > 0 && (
                        <div className="mb-1">
                            <div className="px-5 py-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Navegar a</span>
                            </div>
                            {navFilteredItems.map(item => {
                                const idx = nextIdx();
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        data-command-item
                                        onClick={item.action}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors duration-100 group ${
                                            selectedIndex === idx
                                                ? 'bg-blue-50 text-blue-900'
                                                : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-xl flex-shrink-0 transition-colors ${
                                            selectedIndex === idx
                                                ? 'bg-slate-800 text-white shadow-md'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[14px] font-bold truncate">{item.label}</p>
                                            {item.sublabel && (
                                                <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{item.sublabel}</p>
                                            )}
                                        </div>
                                        {selectedIndex === idx && (
                                            <CornerDownLeft className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Empty state */}
                    {filteredItems.length === 0 && !isSearching && (
                        <div className="px-5 py-10 text-center">
                            <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-[14px] font-bold text-slate-400">Sin resultados</p>
                            <p className="text-[12px] text-slate-400 mt-1">Prueba con otro término de búsqueda</p>
                        </div>
                    )}
                </div>

                {/* Footer hints */}
                <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-1.5">
                        <kbd className="inline-flex items-center justify-center w-5 h-5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400 shadow-sm">
                            <ArrowUp className="w-3 h-3" />
                        </kbd>
                        <kbd className="inline-flex items-center justify-center w-5 h-5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400 shadow-sm">
                            <ArrowDown className="w-3 h-3" />
                        </kbd>
                        <span className="text-[10px] text-slate-400 font-medium ml-0.5">Navegar</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <kbd className="inline-flex items-center justify-center h-5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400 shadow-sm px-1.5">
                            <CornerDownLeft className="w-3 h-3" />
                        </kbd>
                        <span className="text-[10px] text-slate-400 font-medium ml-0.5">Seleccionar</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <kbd className="inline-flex items-center justify-center h-5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400 shadow-sm px-1.5">
                            esc
                        </kbd>
                        <span className="text-[10px] text-slate-400 font-medium ml-0.5">Cerrar</span>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                        <Command className="w-3 h-3" />
                        <span>K</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
