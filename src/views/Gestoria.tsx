
import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Receipt,
    Wallet,
    Building,
    Scale,
    Plus,
    Download,
    Filter,
    Search,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    FileText,
    CreditCard,
    PieChart,
    ChevronRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    ShieldCheck,
    ArrowLeftRight,
    FileSpreadsheet,
    Activity,
    Banknote,
    MoreHorizontal,
    Mail,
    RefreshCw,
    Paperclip,
    ExternalLink,
    Sparkles,
    AlertTriangle,
    X,
    Eye
} from 'lucide-react';
import { getFacturas, getMovimientosBanco, getGestoriaStats, FacturaUI, MovimientoBancoUI } from '../services/facturacion.service';
import { isDbConfigured } from '../services/db';
import { fetchInvoiceEmails, isGmailConfigured, isGmailAuthorized, startGmailAuth, disconnectGmail, handleOAuthRedirect } from '../services/gmail.service';
import { parseAllInvoiceEmails, loadFacturasFromSupabase, updateFacturaEstado, type FacturaExtraida } from '../services/invoice-parser.service';

interface StatCardProps {
    icon: React.ElementType;
    title: string;
    value: string;
    trend: string;
    isPositive: boolean;
    color: string;
    description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, trend, isPositive, color, description }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border-2 border-[#051650] dark:border-slate-700 hover:shadow-xl transition-all group relative overflow-hidden">
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className={`p-4 rounded-2xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-500`}>
                <Icon className={`w-7 h-7 ${color}`} />
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {trend}
            </div>
        </div>
        <div className="relative z-10">
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 mb-1">{title}</p>
            <h3 className="text-3xl font-black text-[#051650] dark:text-white mt-1">{value}</h3>
            {description && <p className="text-[10px] text-slate-500 mt-2 font-medium">{description}</p>}
        </div>
        <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${color} opacity-[0.03] rounded-full blur-2xl group-hover:opacity-[0.08] transition-opacity`}></div>
    </div>
);

interface GestoriaProps {
    activeSubArea?: string;
}

const Gestoria: React.FC<GestoriaProps> = ({ activeSubArea }) => {
    const [activeTab, setActiveTab] = useState<'resumen' | 'facturacion' | 'gmail' | 'banco' | 'impuestos' | 'informes'>('resumen');

    // ── Gmail invoice state ──────────────────────────────────────
    const [gmailFacturas, setGmailFacturas] = useState<FacturaExtraida[]>([]);
    const [gmailSyncing, setGmailSyncing] = useState(false);
    const [gmailLastSync, setGmailLastSync] = useState<Date | null>(null);
    const [gmailError, setGmailError] = useState<string | null>(null);
    const [gmailSearch, setGmailSearch] = useState('');
    const [gmailConnected, setGmailConnected] = useState(isGmailAuthorized());
    const [gmailProgress, setGmailProgress] = useState<string | null>(null);
    // Filters
    const [filterYear, setFilterYear] = useState<string>('');
    const [filterProveedor, setFilterProveedor] = useState<string>('');
    const [filterCategoria, setFilterCategoria] = useState<string>('');
    const [filterEstado, setFilterEstado] = useState<string>('');

    // Handle OAuth redirect on mount (if returning from Google auth)
    useEffect(() => {
        handleOAuthRedirect().then(ok => {
            if (ok) {
                setGmailConnected(true);
                setActiveTab('gmail');
                // Auto-sync after connection
                setTimeout(() => syncGmail(), 500);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncGmail = useCallback(async () => {
        setGmailSyncing(true);
        setGmailError(null);
        setGmailProgress('Buscando emails de facturas...');
        try {
            const emails = await fetchInvoiceEmails(420, (fetched, total) => {
                setGmailProgress(`Descargando ${fetched}/${total} emails...`);
            });
            setGmailProgress(`Parseando ${emails.length} facturas y descargando PDFs...`);
            const parsed = await parseAllInvoiceEmails(emails);
            setGmailFacturas(parsed);
            setGmailLastSync(new Date());
        } catch (e: unknown) {
            setGmailError(e instanceof Error ? e.message : 'Error de sincronización');
        } finally {
            setGmailSyncing(false);
            setGmailProgress(null);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'gmail' && gmailFacturas.length === 0 && !gmailSyncing) {
            syncGmail();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const filteredGmailFacturas = gmailFacturas.filter(f => {
        // Year filter
        if (filterYear && !f.fecha_email.startsWith(filterYear)) return false;
        // Proveedor filter
        if (filterProveedor && f.proveedor !== filterProveedor) return false;
        // Categoría filter
        if (filterCategoria && f.categoria !== filterCategoria) return false;
        // Estado filter
        if (filterEstado && f.estado !== filterEstado) return false;
        // Text search
        if (!gmailSearch) return true;
        const q = gmailSearch.toLowerCase();
        return f.proveedor.toLowerCase().includes(q)
            || (f.numero_factura ?? '').toLowerCase().includes(q)
            || f.concepto.toLowerCase().includes(q)
            || (f.categoria ?? '').toLowerCase().includes(q)
            || (f.proveedor_cif ?? '').toLowerCase().includes(q);
    });

    // Derived unique values for filter dropdowns
    const uniqueYears = [...new Set(gmailFacturas.map(f => f.fecha_email.slice(0, 4)))].sort().reverse();
    const uniqueProveedores = [...new Set(gmailFacturas.map(f => f.proveedor))].sort();
    const uniqueCategorias = [...new Set(gmailFacturas.map(f => f.categoria).filter(Boolean) as string[])].sort();

    // Load persisted invoices from Supabase on mount
    useEffect(() => {
        loadFacturasFromSupabase().then(rows => {
            if (rows.length > 0) setGmailFacturas(rows);
        });
    }, []);

    const toggleFacturaEstado = (id: string, estado: FacturaExtraida['estado']) => {
        setGmailFacturas(prev => prev.map(f => f.gmail_message_id === id ? { ...f, estado } : f));
        updateFacturaEstado(id, estado).catch(() => {/* silent */ });
    };

    useEffect(() => {
        if (!activeSubArea) return;

        switch (activeSubArea) {
            case 'Resumen Global':
                setActiveTab('resumen');
                break;
            case 'Facturación':
                setActiveTab('facturacion');
                break;
            case 'Banco y Conciliación':
                setActiveTab('banco');
                break;
            case 'Modelos Fiscales':
                setActiveTab('impuestos');
                break;
            case 'Informes':
                setActiveTab('informes');
                break;
        }
    }, [activeSubArea]);
    const [facturas, setFacturas] = useState<FacturaUI[]>([]);
    const [movimientos, setMovimientos] = useState<MovimientoBancoUI[]>([]);
    const [stats, setStats] = useState({ ingresosBrutos: '€42,850.00', facturasConteo: 142 });

    useEffect(() => {
        if (isDbConfigured()) {
            getFacturas().then(data => {
                if (data.length > 0) setFacturas(data);
            });
            getMovimientosBanco().then(data => {
                if (data.length > 0) setMovimientos(data);
            });
            getGestoriaStats().then(s => setStats(s));
        }
    }, []);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

    const tabs = [
        { id: 'resumen', label: 'Resumen Global', icon: PieChart },
        { id: 'facturacion', label: 'Facturación', icon: Receipt },
        { id: 'gmail', label: 'Facturas Email', icon: Mail, badge: gmailFacturas.filter(f => f.estado === 'pendiente').length || undefined },
        { id: 'banco', label: 'Banco y Conciliación', icon: ArrowLeftRight },
        { id: 'impuestos', label: 'Modelos Fiscales', icon: Scale },
        { id: 'informes', label: 'Informes', icon: FileSpreadsheet },
    ] as { id: string; label: string; icon: React.ElementType; badge?: number }[];

    return (
        <div className="space-y-10 pb-24">
            {/* Header Area */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <button className="flex-1 xl:flex-none flex items-center justify-center gap-3 px-6 py-3.5 bg-white dark:bg-slate-800 text-[#051650] dark:text-slate-200 rounded-2xl border border-slate-200 dark:border-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                        <Download className="w-4 h-4" />
                        Exportar Datos
                    </button>
                    <button
                        onClick={() => setShowInvoiceModal(true)}
                        className="flex-1 xl:flex-none flex items-center justify-center gap-3 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:shadow-blue-500/30 transition-all active:scale-95 relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        <Plus className="w-4 h-4" />
                        Nueva Factura
                    </button>
                </div>
            </div>

            {/* Navigation Tabs - High Fidelity */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-200/40 dark:bg-slate-800/50 rounded-[1.5rem] w-full xl:w-fit overflow-x-auto no-scrollbar shadow-inner border border-slate-200">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
                            relative flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                            ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xl scale-105'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}
                        `}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-600' : ''}`} />
                        {tab.label}
                        {tab.badge && tab.badge > 0 ? (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                                {tab.badge > 9 ? '9+' : tab.badge}
                            </span>
                        ) : null}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                {activeTab === 'resumen' && (
                    <div className="space-y-10">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <StatCard
                                icon={TrendingUp}
                                title="Ingresos Brutos"
                                value={stats.ingresosBrutos}
                                trend="+18.4%"
                                isPositive={true}
                                color="text-blue-600"
                                description={`Basado en ${stats.facturasConteo} facturas emitidas`}
                            />
                            <StatCard
                                icon={TrendingDown}
                                title="Gastos Totales"
                                value="€12,240.50"
                                trend="+2.1%"
                                isPositive={false}
                                color="text-rose-500"
                                description="Principal incremento en suministros"
                            />
                            <StatCard
                                icon={Banknote}
                                title="Saldo en Bancos"
                                value="€128,400.00"
                                trend="Reconciliado"
                                isPositive={true}
                                color="text-emerald-500"
                                description="Integración directa con 3 entidades"
                            />
                            <StatCard
                                icon={Activity}
                                title="Margen Neto"
                                value="71.4%"
                                trend="+5.2%"
                                isPositive={true}
                                color="text-amber-500"
                                description="Superior al objetivo del 65%"
                            />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                            {/* Distribution chart mockup */}
                            <div className="xl:col-span-2 bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border-2 border-[#051650] dark:border-slate-700 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                                <div className="flex justify-between items-center mb-10 relative z-10">
                                    <div>
                                        <h3 className="text-2xl font-black text-[#051650] dark:text-white tracking-tight flex items-center gap-2">
                                            Evolución de Tesorería
                                            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Datos Simulados"></span>
                                        </h3>
                                        <p className="text-sm font-medium text-slate-500 mt-1">Comparativa Ingresos vs Gastos Mensual</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Mensual</button>
                                        <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-400">Trimestral</button>
                                    </div>
                                </div>

                                <div className="h-80 flex items-end gap-4 justify-between relative z-10">
                                    {[65, 45, 75, 55, 90, 80, 70, 85, 95, 100, 85, 110].map((h, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative">
                                            <div className="w-full flex flex-col gap-1 items-center justify-end h-full">
                                                <div className="w-full bg-gradient-to-t from-blue-700 to-blue-500 rounded-t-xl transition-all group-hover:scale-x-110 duration-500 shadow-lg shadow-blue-500/20" style={{ height: `${h}%` }}></div>
                                                <div className="w-full bg-rose-500/20 rounded-b-xl" style={{ height: `${h / 2.5}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 group-hover:text-[#051650] transition-colors">
                                                {['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][i]}
                                            </span>
                                            {/* Tooltip on hover */}
                                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#051650] text-white text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                                €{h * 450}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Compliance and Banking Status */}
                            <div className="space-y-8">
                                <div className="bg-[#051650] p-10 rounded-[2.5rem] text-white shadow-2xl shadow-blue-900/40 relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="p-3 bg-white/10 rounded-2xl">
                                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-black text-xl tracking-tight">Sello Verifactu</h3>
                                                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Datos Simulados"></span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                                    <span className="text-[10px] uppercase font-black text-emerald-400 tracking-widest">Activo y Legal</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="p-5 bg-white/5 border border-white/10 rounded-[1.5rem] flex items-center justify-between group-hover:bg-white/10 transition-colors">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">Último Envío AEAT</p>
                                                    <p className="text-sm font-bold">Hoy, 08:30:12</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase text-white/40 mb-1">Resultado</p>
                                                    <p className="text-sm font-black text-emerald-400 uppercase">Aceptado</p>
                                                </div>
                                            </div>
                                            <div className="p-6 bg-blue-600/20 border border-blue-400/20 rounded-[1.5rem]">
                                                <p className="text-xs text-white/70 mb-2 leading-relaxed font-medium">Todas tus facturas cumplen con el Reglamento de sistemas informáticos de facturación.</p>
                                                <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors">
                                                    Descargar Certificado
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px]"></div>
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <h3 className="font-black text-[#051650] dark:text-white mb-6 uppercase text-xs tracking-widest">Carga de Trabajo Fiscal</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                </div>
                                                <span className="text-xs font-black text-[#051650] dark:text-white">RECONCILIACIÓN</span>
                                            </div>
                                            <span className="text-[10px] font-black text-emerald-600">98% OK</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                    <Clock className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <span className="text-xs font-black text-[#051650] dark:text-white">MODELO 303</span>
                                            </div>
                                            <span className="text-[10px] font-black text-blue-600">EN CURSO</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'facturacion' && (
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-[#051650] dark:border-slate-700 shadow-xl overflow-hidden animate-in zoom-in-95 duration-500">
                        <div className="p-8 border-b border-slate-200 dark:border-slate-700 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                            <div className="relative w-full xl:w-[500px]">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por paciente, NIF, nº factura o importe..."
                                    className="w-full pl-12 pr-6 py-4 bg-slate-100 dark:bg-slate-700/50 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 border-none transition-all placeholder:text-slate-400"
                                />
                            </div>
                            <div className="flex items-center gap-3 w-full xl:w-auto">
                                <button className="flex-1 xl:flex-none flex items-center justify-center gap-3 px-5 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-200 tracking-widest hover:bg-slate-200 transition-all">
                                    <Filter className="w-4 h-4" />
                                    Filtros Avanzados
                                </button>
                                <button className="flex-1 xl:flex-none flex items-center justify-center gap-3 px-5 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-200 tracking-widest hover:bg-slate-200 transition-all">
                                    <Calendar className="w-4 h-4" />
                                    Último Mes
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-700/30 text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-10 py-6">ID Legal (TBAI)</th>
                                        <th className="px-10 py-6">Paciente / Titular</th>
                                        <th className="px-10 py-6">Fecha</th>
                                        <th className="px-10 py-6 text-right">Base Imp.</th>
                                        <th className="px-10 py-6 text-right">Total Factura</th>
                                        <th className="px-10 py-6 text-center">Estado Cobro</th>
                                        <th className="px-10 py-6"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {facturas.map((row, i) => (
                                        <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-slate-700/40 transition-all group">
                                            <td className="px-10 py-7">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                                                        <FileText className="w-4 h-4 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-sm text-[#051650] dark:text-blue-200 leading-none mb-1">{row.id}</p>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${row.tbai === 'Verificado' ? 'bg-emerald-500' : row.tbai === 'Error' ? 'bg-rose-500' : 'bg-blue-500'}`}></div>
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Verifactu: {row.tbai}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-7">
                                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{row.name}</span>
                                            </td>
                                            <td className="px-10 py-7">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{row.date.split(',')[0]}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{row.date.split(',')[1]}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-7 text-right text-sm font-bold text-slate-500">{row.base}</td>
                                            <td className="px-10 py-7 text-right">
                                                <span className="text-lg font-black text-[#051650] dark:text-white">{row.total}</span>
                                            </td>
                                            <td className="px-10 py-7 text-center">
                                                <div className={`
                                                    mx-auto w-fit px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border
                                                    ${row.status === 'Liquidado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ''}
                                                    ${row.status === 'Pendiente' ? 'bg-blue-50 text-blue-600 border-blue-100' : ''}
                                                    ${row.status === 'Impagado' ? 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse' : ''}
                                                `}>
                                                    {row.status}
                                                </div>
                                            </td>
                                            <td className="px-10 py-7 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                    <button className="p-2.5 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 rounded-xl transition-all shadow-sm">
                                                        <Download className="w-4.5 h-4.5 text-slate-600" />
                                                    </button>
                                                    <button className="p-2.5 hover:bg-[#051650] hover:text-white rounded-xl transition-all shadow-sm">
                                                        <MoreHorizontal className="w-4.5 h-4.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── GMAIL INVOICE EXTRACTOR TAB ── */}
                {activeTab === 'gmail' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">

                        {/* Header: sync controls */}
                        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-[#051650] shadow-xl">
                            <div className="flex items-start gap-5">
                                <div className={`p-4 rounded-2xl shrink-0 ${gmailConnected ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                                    <Mail className={`w-7 h-7 ${gmailConnected ? 'text-emerald-600' : 'text-blue-600'}`} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-[#051650] dark:text-white tracking-tight">Facturas desde Gmail</h2>
                                    <p className="text-sm text-slate-500 mt-1 font-medium">
                                        <span className="font-black text-[#051650]">info@rubiogarciandental.com</span>
                                        {' — '} Desde Ene 2025
                                    </p>
                                    {gmailConnected && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Gmail Conectado</span>
                                        </div>
                                    )}
                                    {gmailLastSync && (
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            Última sincronización: {gmailLastSync.toLocaleTimeString('es-ES')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full xl:w-auto">
                                {!isGmailConfigured() && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-wide">Sin credenciales</span>
                                    </div>
                                )}

                                {isGmailConfigured() && !gmailConnected && (
                                    <button
                                        onClick={() => startGmailAuth()}
                                        className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:shadow-emerald-500/30 transition-all active:scale-95"
                                    >
                                        <Mail className="w-4 h-4" />
                                        Conectar Gmail
                                    </button>
                                )}

                                {gmailConnected && (
                                    <>
                                        <button
                                            onClick={syncGmail}
                                            disabled={gmailSyncing}
                                            className="flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${gmailSyncing ? 'animate-spin' : ''}`} />
                                            {gmailSyncing ? 'Sincronizando...' : 'Sincronizar'}
                                        </button>
                                        <button
                                            onClick={() => { disconnectGmail(); setGmailConnected(false); setGmailFacturas([]); }}
                                            className="px-4 py-3.5 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all"
                                        >
                                            Desconectar
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Error banner */}
                        {gmailError && (
                            <div className="flex items-center gap-4 p-5 bg-rose-50 border border-rose-200 rounded-2xl">
                                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                                <p className="text-sm font-bold text-rose-700">{gmailError}</p>
                                <button onClick={() => setGmailError(null)} className="ml-auto">
                                    <X className="w-4 h-4 text-rose-400" />
                                </button>
                            </div>
                        )}

                        {/* Stats row */}
                        {gmailFacturas.length > 0 && (
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total emails', value: String(gmailFacturas.length), color: 'text-blue-600', bg: 'bg-blue-50' },
                                    { label: 'Pendientes cruce', value: String(gmailFacturas.filter(f => f.estado === 'pendiente').length), color: 'text-amber-600', bg: 'bg-amber-50' },
                                    { label: 'Cruzadas', value: String(gmailFacturas.filter(f => f.estado === 'cruzado').length), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                    {
                                        label: 'Total detectado',
                                        value: '€' + gmailFacturas.reduce((s, f) => s + (f.total ?? 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                                        color: 'text-[#051650]',
                                        bg: 'bg-slate-50'
                                    },
                                ].map((s, i) => (
                                    <div key={i} className={`${s.bg} p-5 rounded-2xl border border-slate-100`}>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Search bar + Filters */}
                        <div className="flex flex-col gap-3">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={gmailSearch}
                                    onChange={e => setGmailSearch(e.target.value)}
                                    placeholder="Buscar por proveedor, nº factura o concepto..."
                                    className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                                <select
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
                                >
                                    <option value="">Todos los años</option>
                                    {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <select
                                    value={filterProveedor}
                                    onChange={e => setFilterProveedor(e.target.value)}
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer max-w-[250px] truncate"
                                >
                                    <option value="">Todos los proveedores</option>
                                    {uniqueProveedores.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select
                                    value={filterCategoria}
                                    onChange={e => setFilterCategoria(e.target.value)}
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
                                >
                                    <option value="">Todas las categorías</option>
                                    {uniqueCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select
                                    value={filterEstado}
                                    onChange={e => setFilterEstado(e.target.value)}
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
                                >
                                    <option value="">Todos los estados</option>
                                    <option value="pendiente">⏳ Pendiente</option>
                                    <option value="cruzado">✓ Cruzado</option>
                                    <option value="descartado">Descartado</option>
                                </select>
                                {(filterYear || filterProveedor || filterCategoria || filterEstado) && (
                                    <button
                                        onClick={() => { setFilterYear(''); setFilterProveedor(''); setFilterCategoria(''); setFilterEstado(''); }}
                                        className="px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-black uppercase hover:bg-rose-100 transition-all flex items-center gap-1"
                                    >
                                        <X className="w-3 h-3" /> Limpiar
                                    </button>
                                )}
                                <span className="ml-auto text-xs font-bold text-slate-400">
                                    {filteredGmailFacturas.length} de {gmailFacturas.length} facturas
                                </span>
                            </div>
                        </div>

                        {/* Invoice table */}
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-[#051650] shadow-xl overflow-hidden">

                            {/* Credential setup notice when in demo mode */}
                            {!isGmailConfigured() && (
                                <div className="mx-8 mt-8 p-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start gap-4">
                                    <Sparkles className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-black text-amber-800 mb-1">Mostrando datos de demostración</p>
                                        <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                            Para conectar Gmail real, añade en tu <code className="bg-amber-100 px-1 rounded">.env</code>:<br />
                                            <code className="text-[10px]">VITE_GMAIL_SA_EMAIL</code>, <code className="text-[10px]">VITE_GMAIL_SA_PRIVATE_KEY</code>, <code className="text-[10px]">VITE_GMAIL_USER_EMAIL</code>
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-y-auto max-h-[60vh]">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-700/30 text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-5">Proveedor</th>
                                            <th className="px-6 py-5">Nº Factura</th>
                                            <th className="px-6 py-5">Categoría</th>
                                            <th className="px-6 py-5">Fecha</th>
                                            <th className="px-6 py-5 text-right">Base</th>
                                            <th className="px-6 py-5 text-right">IVA</th>
                                            <th className="px-6 py-5 text-right">Total</th>
                                            <th className="px-6 py-5 text-center">Estado</th>
                                            <th className="px-6 py-5"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {gmailSyncing && (
                                            <tr>
                                                <td colSpan={9} className="px-6 py-16 text-center">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                                                        <p className="text-sm font-bold text-slate-400">{gmailProgress || 'Analizando emails y extrayendo facturas...'}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {!gmailSyncing && filteredGmailFacturas.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="px-6 py-16 text-center">
                                                    <Mail className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                                    <p className="text-sm font-bold text-slate-400">No se encontraron facturas</p>
                                                    <button onClick={syncGmail} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest">
                                                        Sincronizar ahora
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                        {!gmailSyncing && filteredGmailFacturas.map((f) => (
                                            <tr key={f.gmail_message_id} className="hover:bg-blue-50/20 transition-all group">
                                                {/* Proveedor */}
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-[#051650] dark:text-white leading-none">{f.proveedor}</p>
                                                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{f.proveedor_email}</p>
                                                            {f.proveedor_cif && (
                                                                <p className="text-[9px] text-slate-300 font-mono font-bold mt-0.5">CIF: {f.proveedor_cif}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Nº Factura */}
                                                <td className="px-6 py-5">
                                                    {f.numero_factura ? (
                                                        <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">{f.numero_factura}</span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 font-bold">—</span>
                                                    )}
                                                </td>

                                                {/* Categoría */}
                                                <td className="px-6 py-5">
                                                    {f.categoria ? (
                                                        <span className="text-[10px] font-black text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg whitespace-nowrap">{f.categoria}</span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 font-bold">Sin clasificar</span>
                                                    )}
                                                </td>

                                                {/* Fecha */}
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-700">
                                                            {new Date(f.fecha_email).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </span>
                                                        {f.tiene_adjunto && (
                                                            <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase mt-0.5">
                                                                <Paperclip className="w-2.5 h-2.5" />{f.nombre_adjunto?.split('.').pop()?.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Base */}
                                                <td className="px-6 py-5 text-right">
                                                    <span className="text-sm font-bold text-slate-500">
                                                        {f.base_imponible !== null ? `€${f.base_imponible.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '—'}
                                                    </span>
                                                </td>

                                                {/* IVA */}
                                                <td className="px-6 py-5 text-right">
                                                    <span className="text-xs font-black text-slate-400">
                                                        {f.iva_pct !== null ? `${f.iva_pct}%` : '—'}
                                                    </span>
                                                </td>

                                                {/* Total */}
                                                <td className="px-6 py-5 text-right">
                                                    <span className="text-lg font-black text-[#051650] dark:text-white">
                                                        {f.total !== null ? `€${f.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '—'}
                                                    </span>
                                                </td>

                                                {/* Estado */}
                                                <td className="px-6 py-5 text-center">
                                                    <div className={`mx-auto w-fit px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${f.estado === 'cruzado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        f.estado === 'descartado' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                                                            'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'
                                                        }`}>
                                                        {f.estado === 'cruzado' ? '✓ Cruzado' : f.estado === 'descartado' ? 'Descartado' : '⏳ Pendiente'}
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        {f.estado !== 'cruzado' && (
                                                            <button
                                                                onClick={() => toggleFacturaEstado(f.gmail_message_id, 'cruzado')}
                                                                className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-all whitespace-nowrap"
                                                                title="Marcar como cruzada con apunte bancario"
                                                            >
                                                                Cruzar
                                                            </button>
                                                        )}
                                                        {f.estado !== 'descartado' && (
                                                            <button
                                                                onClick={() => toggleFacturaEstado(f.gmail_message_id, 'descartado')}
                                                                className="p-1.5 hover:bg-slate-100 rounded-lg transition-all"
                                                                title="Descartar"
                                                            >
                                                                <X className="w-3.5 h-3.5 text-slate-400" />
                                                            </button>
                                                        )}
                                                        {f.enlace_gmail !== '#mock' && (
                                                            <a
                                                                href={f.enlace_gmail}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="Abrir en Gmail"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                                                            </a>
                                                        )}
                                                        {f.enlace_factura_portal && (
                                                            <a
                                                                href={f.enlace_factura_portal}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all flex items-center gap-1"
                                                                title="Acceder al portal de facturación"
                                                            >
                                                                <span className="text-[9px]">🌐</span>
                                                                <span className="text-[9px] font-black text-indigo-600 uppercase">Acceder</span>
                                                            </a>
                                                        )}
                                                        {f.pdf_preview_url && (
                                                            <a
                                                                href={f.pdf_preview_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 hover:bg-violet-50 rounded-lg transition-all"
                                                                title="Ver PDF"
                                                            >
                                                                <Eye className="w-3.5 h-3.5 text-violet-400" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'banco' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 animate-in fade-in slide-in-from-right-10 duration-700">
                        {/* High Fidelity Bank Interface */}
                        <div className="space-y-8">
                            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-[#051650] dark:border-slate-700 shadow-xl overflow-hidden relative">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-2xl font-black text-[#051650] dark:text-white tracking-tight">Apuntes Bancarios</h3>
                                            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Datos Simulados"></span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-500 mt-1">Conexión en streaming con Banco Santander</p>
                                    </div>
                                    <div className="p-4 bg-red-50 rounded-2xl">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/Banco_Santander_Logo.svg" alt="Santander" className="h-6" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {movimientos.map((move, i) => (
                                        <div key={i} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-700/40 rounded-3xl border border-transparent hover:border-blue-500/30 transition-all group cursor-pointer">
                                            <div className="flex items-center gap-5">
                                                <div className={`p-3 rounded-2xl ${move.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {move.type === 'in' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{move.date}</p>
                                                    <p className="text-sm font-black text-[#051650] dark:text-white mt-1 group-hover:text-blue-600 transition-colors">{move.desc}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className={`text-lg font-black ${move.type === 'in' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>{move.amount}€</span>
                                                {move.match ? (
                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 rounded-full text-[8px] font-black uppercase text-white tracking-widest">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Cruzado
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-600 rounded-full shadow-sm hover:bg-blue-600 group-hover:text-white transition-all">
                                                        <Plus className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Reconciliator Area */}
                        <div className="space-y-8">
                            <div className="bg-gradient-to-br from-[#051650] to-[#0A1D56] p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8">
                                    <Activity className="w-24 h-24 text-white/5" />
                                </div>
                                <div className="flex items-center gap-2 mb-8 relative z-10">
                                    <h3 className="text-2xl font-black">Asistente de Conciliación</h3>
                                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Datos Simulados"></span>
                                </div>
                                <div className="p-8 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-xl relative z-10">
                                    <p className="text-blue-300 font-bold leading-relaxed mb-6">He encontrado un abono bancario de <span className="text-white font-black underline underline-offset-4">€3,500.00</span> que coincide exactamente con el presupuesto de <span className="text-white font-black">Carlos Rubio Sanz</span>.</p>
                                    <div className="flex items-center gap-4 bg-white/10 p-5 rounded-2xl border border-white/10 mb-8">
                                        <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                                            <Scale className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Acción Sugerida</p>
                                            <p className="text-sm font-black">Conciliar y emitir factura legal automáticamente</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-95">Confirmar Conciliación</button>
                                        <button className="px-6 py-4 bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10">Omitir</button>
                                    </div>
                                </div>
                                <div className="mt-8 flex items-center justify-between px-2 relative z-10">
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Tasa de éxito AI</p>
                                        <p className="text-xl font-black">99.2%</p>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Pendientes</p>
                                        <p className="text-xl font-black">2 Apuntes</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'impuestos' && (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 animate-in fade-in slide-in-from-left-10 duration-700">
                        {/* High Fidelity Impuestos */}
                        <div className="space-y-8 xl:col-span-1">
                            <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border-2 border-[#051650] dark:border-slate-700 shadow-xl shadow-slate-200/40 relative">
                                <div className="absolute top-0 right-0 p-6 opacity-5">
                                    <Scale className="w-20 h-20 text-[#051650]" />
                                </div>
                                <div className="flex items-center gap-2 mb-10">
                                    <h3 className="text-2xl font-black text-[#051650] dark:text-white tracking-tight">Liquidación Q1 2024</h3>
                                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Datos Simulados"></span>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center px-2">
                                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Conceptos IVA</span>
                                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Importe</span>
                                        </div>
                                        <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-3xl border border-transparent hover:border-blue-500/20 transition-all">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">IVA Repercutido (Cobrado)</span>
                                                <span className="font-black text-emerald-600 text-lg">€8,140.00</span>
                                            </div>
                                            <div className="flex justify-between items-center opacity-70">
                                                <span className="text-xs font-medium text-slate-500">Base: €38,761.90</span>
                                                <span className="text-xs font-black text-slate-500">21%</span>
                                            </div>
                                        </div>
                                        <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-3xl border border-transparent hover:border-rose-500/20 transition-all">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">IVA Deducible (Gastos)</span>
                                                <span className="font-black text-rose-600 text-lg">-€2,450.20</span>
                                            </div>
                                            <div className="flex justify-between items-center opacity-70">
                                                <span className="text-xs font-medium text-slate-500">Base: €11,667.62</span>
                                                <span className="text-xs font-black text-slate-500">MIX</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-8 border-t border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">A ingresar (Modelo 303)</p>
                                                <h4 className="text-4xl font-black text-[#051650] dark:text-blue-200 tracking-tighter">€5,689.80</h4>
                                            </div>
                                            <div className="text-right">
                                                <div className="px-3 py-1 bg-blue-100 text-blue-700 text-[9px] font-black rounded-full mb-2">20 ABRIL</div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fecha límite</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="w-full py-5 bg-[#051650] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:shadow-blue-900/30 transition-all flex items-center justify-center gap-3">
                                        <Activity className="w-4 h-4 text-emerald-400" />
                                        Pre-visualizar Modelo 303
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tax Calendar - Premium Grid */}
                        <div className="xl:col-span-2 bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border-2 border-[#051650] dark:border-slate-700 shadow-xl overflow-hidden">
                            <h3 className="text-2xl font-black text-[#051650] dark:text-white mb-10 tracking-tight flex items-center gap-4">
                                Calendario Fiscal Rubio García Dental
                                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Datos Simulados"></span>
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] rounded-lg">2024 ACTIVADO</span>
                            </h3>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px] overflow-y-auto no-scrollbar mask-linear-fade">
                                {[
                                    { m: '303', t: 'I.V.A. Trimestral', d: '20 Abril', s: 'Pronto', c: 'blue', desc: 'Previsión de caja €5,689.80' },
                                    { m: '111', t: 'Retenciones IRPF', d: '20 Abril', s: 'Pendiente', c: 'amber', desc: 'Nóminas y servicios profesionales' },
                                    { m: '115', t: 'Retención Alquiler', d: '20 Abril', s: 'Pendiente', c: 'amber', desc: 'Inmueble clínica principal' },
                                    { m: '130', t: 'Pago Frac. IRPF', d: '20 Abril', s: 'Planificado', c: 'slate', desc: 'Modelo opcional según rendimientos' },
                                    { m: '202', t: 'Pago Frac. Sociedades', d: 'Octubre', s: 'Futuro', c: 'slate', desc: 'Basado en beneficio ejercicio anterior' },
                                    { m: '100', t: 'Declaración Renta', d: 'Junio', s: 'Campaña', c: 'blue', desc: 'Presentación telemática abierta' },
                                ].map((tax, i) => (
                                    <div key={i} className="group p-8 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 hover:border-blue-500/20 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all relative overflow-hidden">
                                        <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${tax.c === 'blue' ? 'bg-blue-500' : tax.c === 'amber' ? 'bg-amber-500' : 'bg-slate-500'} opacity-[0.03] rounded-full`}></div>
                                        <div className="flex justify-between items-start mb-6">
                                            <span className="text-3xl font-black text-slate-300 group-hover:text-blue-500/50 transition-colors uppercase">{tax.m}</span>
                                            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${tax.s === 'Pronto' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
                                                {tax.s}
                                            </div>
                                        </div>
                                        <h4 className="font-black text-lg text-[#051650] dark:text-blue-100 mb-2">{tax.t}</h4>
                                        <p className="text-xs text-slate-400 font-bold mb-6">{tax.desc}</p>
                                        <div className="flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-400 mt-auto">
                                            <Calendar className="w-4 h-4" />
                                            LÍMITE: {tax.d}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'informes' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 animate-in slide-in-from-bottom-10 duration-700">
                        {/* Reports Section */}
                        <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border-2 border-[#051650] dark:border-slate-700 shadow-xl overflow-hidden group">
                            <div className="flex items-center gap-6 mb-12">
                                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/40 rounded-3xl flex items-center justify-center border-2 border-blue-100 dark:border-blue-700 shadow-lg group-hover:rotate-6 transition-transform">
                                    <FileSpreadsheet className="w-7 h-7 text-blue-600" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-2xl font-black text-[#051650] dark:text-white tracking-tight">Centro de Informes</h3>
                                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Datos Simulados"></span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-500 mt-1">Exportación analítica Rubio García Dental</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { t: 'Rentabilidad por Doctor', d: 'PDF, EXCEL', i: 'TrendingUp' },
                                    { t: 'Análisis de Costes Ttos', d: 'PDF', i: 'Scale' },
                                    { t: 'Liquidación de Nóminas', d: 'ZIP (PDF)', i: 'Wallet' },
                                    { t: 'Listado Verifactu', d: 'XML, JSON', i: 'ShieldCheck' },
                                    { t: 'Balance de Situación', d: 'EXCEL', i: 'Building' },
                                    { t: 'Informe de Tesorería', d: 'PDF, POWERPOINT', i: 'Activity' },
                                ].map((rep, i) => (
                                    <div key={i} className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-[2rem] border border-transparent hover:border-blue-500/20 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer group/item shadow-sm hover:shadow-xl">
                                        <div className="flex justify-between items-start mb-4">
                                            <h5 className="font-black text-sm text-[#051650] dark:text-blue-100 w-2/3 leading-tight">{rep.t}</h5>
                                            <div className="p-2 bg-blue-600 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all translate-x-3 group-hover/item:translate-x-0">
                                                <Plus className="w-3 h-3 text-white" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest bg-white dark:bg-slate-600 px-2 py-0.5 rounded shadow-sm">{rep.d}</span>
                                            <Download className="w-3.5 h-3.5 text-blue-600/50 group-hover/item:text-blue-600 transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Custom Report Builder Mockup */}
                        <div className="bg-[#051650] p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col justify-center border-b-[10px] border-blue-500/30">
                            <div className="absolute top-0 right-0 p-12 opacity-10">
                                <Plus className="w-32 h-32" />
                            </div>
                            <div className="relative z-10 text-center space-y-8">
                                <Activity className="w-16 h-16 text-emerald-400 mx-auto" />
                                <h1 className="text-4xl font-black tracking-tighter leading-none">Generar Informe Personalizado</h1>
                                <p className="text-lg text-blue-200 font-medium max-w-sm mx-auto">Selecciona los parámetros y deja que la IA de SmilePro analice tus datos financieros por ti.</p>
                                <div className="flex flex-col gap-3 py-6">
                                    <div className="h-4 bg-white/10 rounded-full w-full"></div>
                                    <div className="h-4 bg-white/10 rounded-full w-2/3 mx-auto"></div>
                                    <div className="h-4 bg-white/10 rounded-full w-1/2 mx-auto"></div>
                                </div>
                                <button className="w-full py-5 bg-white text-[#051650] rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all transform active:scale-95 shadow-xl">
                                    Configurar Informe Analítico
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Nueva Factura Modal Mockup */}
            {showInvoiceModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-6 sm:p-10">
                    <div className="absolute inset-0 bg-[#051650]/80 backdrop-blur-xl" onClick={() => setShowInvoiceModal(false)}></div>
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10">
                            <h2 className="text-3xl font-black text-[#051650] dark:text-white tracking-tight mb-2">Emitir Nueva Factura Legal</h2>
                            <p className="text-slate-500 font-medium mb-10">Cumplimiento Verifactu / TicketBAI integrado.</p>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Paciente / Cliente</label>
                                        <input type="text" placeholder="Buscar..." className="w-full px-6 py-4 bg-slate-100 rounded-2xl border-none outline-none font-bold text-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">NIF / CIF</label>
                                        <input type="text" className="w-full px-6 py-4 bg-slate-100 rounded-2xl border-none outline-none font-bold text-sm" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Concepto del Servicio</label>
                                    <textarea className="w-full px-6 py-4 bg-slate-100 rounded-2xl border-none outline-none font-bold text-sm h-24 resize-none" placeholder="Descripción del tratamiento..."></textarea>
                                </div>
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Base Imponible</label>
                                        <input type="number" placeholder="0.00" className="w-full px-6 py-4 bg-slate-100 rounded-2xl border-none outline-none font-black text-lg text-blue-600" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">I.V.A. (%)</label>
                                        <select className="w-full px-6 py-4 bg-slate-100 rounded-2xl border-none outline-none font-black text-sm">
                                            <option>Exento (Médico)</option>
                                            <option>21%</option>
                                            <option>10%</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Total</label>
                                        <div className="w-full px-6 py-4 bg-[#051650] text-white rounded-2xl font-black text-lg flex items-center justify-center">€ 0.00</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 flex gap-4">
                                <button className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20">Registrar y Enviar a AEAT</button>
                                <button onClick={() => setShowInvoiceModal(false)} className="px-8 py-5 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gestoria;
