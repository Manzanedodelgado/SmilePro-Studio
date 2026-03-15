
import React, { useState, useEffect } from 'react';
import { usePermission } from '../hooks/usePermission';
import { ItemInventario, Lote } from '../types';
import {
    Package,
    Boxes,
    TrendingDown,
    AlertTriangle,
    History,
    Download,
    Verified,
    Calendar,
    Cpu,
    ArrowRight,
    Plus,
    Filter,
    X
} from 'lucide-react';
import { StatCard, Badge, PremiumContainer, AccessDenied } from '../components/UI';
import { getItemsInventario as getInventario, updateStock } from '../services/inventario.service';
import { useAuth } from '../context/AuthContext';

// V-011 FIX: Datos reales desde TArticulo + StckMov via FDW.

interface InventarioProps {
    activeSubArea?: string;
}

const Inventario: React.FC<InventarioProps> = ({ activeSubArea }) => {
    const canView = usePermission('view_inventario');
    if (!canView) return (
        <AccessDenied
            icon={AlertTriangle}
            message="El inventario solo es accesible para administradores."
        />
    );

    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('visual');
    const [searchTerm, setSearchTerm] = useState('');
    const [inventory, setInventory] = useState<ItemInventario[]>([]);
    const [loadingInv, setLoadingInv] = useState(true);
    const [trazasItem, setTrazasItem] = useState<ItemInventario | null>(null);
    const [reponerItem, setReponerItem] = useState<ItemInventario | null>(null);
    const [reponerCantidad, setReponerCantidad] = useState('');
    const [reponerLoading, setReponerLoading] = useState(false);
    const [pedidoVisible, setPedidoVisible] = useState(false);

    useEffect(() => {
        setLoadingInv(true);
        getInventario()
            .then(data => setInventory(data))
            .catch(() => setInventory([]))
            .finally(() => setLoadingInv(false));
    }, []);

    useEffect(() => {
        if (activeSubArea === 'Trazabilidad') setActiveTab('trazabilidad');
        else if (activeSubArea === 'Pedidos IA') setActiveTab('pedidos');
        else setActiveTab('visual');
    }, [activeSubArea]);

    // M-01 FIX: Exportar trazabilidad completa como CSV — datos reales de StckMov via el backend
    const exportarRegistroCSV = () => {
        const rows = [
            ['Artículo', 'SKU', 'Lote Fabricante', 'Caducidad', 'Cantidad', 'Estado', 'Ubicación'],
            ...inventory.flatMap(item =>
                item.lotes.map(l => [
                    item.nombre, item.sku,
                    l.loteFabricante ?? '—', l.fechaCaducidad ?? '—',
                    l.cantidad.toString(), l.estado, l.ubicacion ?? '—'
                ])
            )
        ];
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trazabilidad_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // M-01 FIX: Reponer stock — escribe en stock_ajustes_pendientes via updateStock en el backend
    const handleReponer = async () => {
        if (!reponerItem || !reponerCantidad) return;
        setReponerLoading(true);
        const nuevo = reponerItem.stockFisico + Number(reponerCantidad);
        try {
            await updateStock(
                reponerItem.id, nuevo,
                `Reposición manual desde SmilePro Web`
            );
            setInventory(prev => prev.map(i =>
                i.id === reponerItem.id ? { ...i, stockFisico: nuevo, stockVirtual: nuevo } : i
            ));
        } catch (err) {
            console.error('[Inventario] Error al reponer stock:', err);
        }
        setReponerLoading(false);
        setReponerItem(null);
        setReponerCantidad('');
    };

    const filteredInventory = inventory.filter(i =>
        !searchTerm || i.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || i.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderVisualInventory = () => {
        if (loadingInv) return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Cargando inventario...</p>
                </div>
            </div>
        );
        if (inventory.length === 0) return (
            <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="text-center">
                    <Package className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Sin artículos en inventario</p>
                    <p className="text-[12px] text-slate-300 mt-1">Verifica la conexión con el backend (TArticulo vía GELITE)</p>
                </div>
            </div>
        );
        return (
            <div className="space-y-4">
                {/* Filtro de búsqueda */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 max-w-sm">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Filtrar por nombre o SKU..."
                        className="bg-transparent border-none outline-none text-[13px] text-slate-700 placeholder-slate-400 w-full"
                    />
                    {searchTerm && <button onClick={() => setSearchTerm('')}><X className="w-3 h-3 text-slate-500" /></button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {filteredInventory.map(item => {
                        const isLowStock = item.stockFisico <= item.minimoReorden;
                        const sortedLotes = [...item.lotes].sort((a, b) => new Date(a.fechaCaducidad).getTime() - new Date(b.fechaCaducidad).getTime());
                        const nextExpiring = sortedLotes[0];
                        const isExpiringSoon = nextExpiring && new Date(nextExpiring.fechaCaducidad) < new Date(new Date().setMonth(new Date().getMonth() + 3));

                        return (
                            <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-xl p-6 border shadow-sm hover:shadow-xl transition-all group flex flex-col relative overflow-hidden ${isLowStock ? 'border-[#FFC0CB] dark:border-rose-900/50' : 'border-[#051650] dark:border-slate-700'}`}>
                                {/* Status */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`p-4 rounded-2xl ${item.categoria === 'Implante' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                                        {item.categoria === 'Implante' ? <Package className="w-6 h-6" /> : <Boxes className="w-6 h-6" />}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-3xl font-bold tracking-tighter ${isLowStock ? 'text-[#E03555]' : 'text-slate-900 dark:text-white'}`}>
                                            {item.stockFisico}
                                        </span>
                                        <span className="text-[12px] font-bold uppercase text-slate-400 tracking-widest">Unidades</span>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight mb-1 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{item.nombre}</h3>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="gray">{item.sku}</Badge>
                                        {isLowStock && <Badge variant="rose">Reposición Urgente</Badge>}
                                        {isExpiringSoon && !isLowStock && <Badge variant="amber">Caducidad {nextExpiring.fechaCaducidad}</Badge>}
                                    </div>
                                </div>

                                {nextExpiring && (
                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 mb-6 space-y-3">
                                        <div className="flex justify-between items-center text-[12px] font-bold uppercase tracking-widest">
                                            <span className="text-slate-400">Ubicación</span>
                                            <span className="text-slate-700 dark:text-slate-500">{nextExpiring.ubicacion ?? '—'}</span>
                                        </div>
                                        <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />
                                        <div className="flex justify-between items-center text-[12px] font-bold uppercase tracking-widest">
                                            <span className="text-slate-400">Lote FEFO</span>
                                            <span className={isExpiringSoon ? 'text-[#051650]' : 'text-slate-700 dark:text-slate-300'}>{nextExpiring.loteFabricante ?? '—'}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-auto grid grid-cols-2 gap-3">
                                    {/* M-01 FIX: Trazas → modal con lotes desde StckMov */}
                                    <button
                                        onClick={() => setTrazasItem(item)}
                                        className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl text-[12px] font-bold uppercase border border-slate-200 dark:border-slate-600 hover:bg-slate-50 transition-all"
                                    >
                                        <History className="w-3.5 h-3.5" />
                                        Trazas
                                    </button>
                                    {/* M-01 FIX: Reponer → modal de ajuste que escribe en stock_ajustes_pendientes via updateStock */}
                                    <button
                                        onClick={() => { setReponerItem(item); setReponerCantidad(''); }}
                                        className="flex items-center justify-center gap-2 py-3 bg-[#051650] text-white rounded-xl text-[12px] font-bold uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-all active:scale-95"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Reponer
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderTrazabilidad = () => (
        <PremiumContainer
            title="Registro de Trazabilidad"
            subtitle="Trazabilidad FEFO de implantes y material quirúrgico AEMPS — fuente: StckMov via FDW"
            actions={
                /* M-01 FIX: Exportar → descarga CSV real con datos de StckMov */
                <button
                    onClick={exportarRegistroCSV}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl text-[12px] font-bold uppercase flex items-center gap-2 hover:bg-slate-200 transition-all"
                >
                    <Download className="w-4 h-4" />
                    Exportar Registro
                </button>
            }
            className="animate-in fade-in zoom-in-95 duration-500"
        >
            {inventory.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                    <div className="text-center">
                        <History className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Sin registros de trazabilidad</p>
                        <p className="text-[12px] text-slate-300 mt-1">Los lotes se cargan desde StckMov vía el backend local</p>
                    </div>
                </div>
            ) : (
                <table className="w-full text-left">
                    <thead><tr className="text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="pb-3">Artículo</th>
                        <th className="pb-3">SKU</th>
                        <th className="pb-3">Lote</th>
                        <th className="pb-3">Caducidad</th>
                        <th className="pb-3">Cantidad</th>
                        <th className="pb-3">Estado</th>
                    </tr></thead>
                    <tbody>
                        {inventory.flatMap(item =>
                            item.lotes.map((l, i) => (
                                <tr key={`${item.id}-${i}`} className="text-[13px] border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="py-2 font-bold text-slate-800">{item.nombre}</td>
                                    <td className="py-2 text-slate-400">{item.sku}</td>
                                    <td className="py-2 text-slate-600">{l.loteFabricante ?? '—'}</td>
                                    <td className={`py-2 font-medium ${new Date(l.fechaCaducidad) < new Date(new Date().setMonth(new Date().getMonth() + 3)) ? 'text-[#051650] font-bold' : 'text-slate-600'}`}>{l.fechaCaducidad ?? '—'}</td>
                                    <td className="py-2 font-bold text-slate-800">{l.cantidad}</td>
                                    <td className="py-2"><span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#051650]">{l.estado}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}
        </PremiumContainer>
    );

    return (
        <>
            <div className="space-y-8 animate-in fade-in duration-700">
                {/* Tabs */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
                    <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 rounded-[1.5rem] p-1 shadow-md">
                        <button
                            onClick={() => setActiveTab('visual')}
                            className={`px-6 py-2.5 rounded-2xl text-[12px] font-bold uppercase tracking-widest transition-all ${activeTab === 'visual' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-400 hover:text-blue-600'}`}
                        >
                            Stock Visual
                        </button>
                        <button
                            onClick={() => setActiveTab('trazabilidad')}
                            className={`px-6 py-2.5 rounded-2xl text-[12px] font-bold uppercase tracking-widest transition-all ${activeTab === 'trazabilidad' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-400 hover:text-blue-600'}`}
                        >
                            Trazabilidad
                        </button>
                        <button
                            onClick={() => setActiveTab('pedidos')}
                            className={`px-6 py-2.5 rounded-2xl text-[12px] font-bold uppercase tracking-widest transition-all ${activeTab === 'pedidos' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-400 hover:text-blue-600'}`}
                        >
                            Smart Orders (IA)
                        </button>
                    </div>
                </div>

                {/* Stats — datos reales de TArticulo+StckMov */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-1">
                    <StatCard
                        title="Ítems en Catálogo"
                        value={inventory.length.toString()}
                        trend="Desde TArticulo"
                        icon={Boxes}
                        color="text-blue-600"
                        description="Referencias activas en FDW"
                    />
                    <StatCard
                        title="Stock Crítico"
                        value={inventory.filter(i => i.stockFisico <= i.minimoReorden).length.toString()}
                        trend="Inmediato"
                        isPositive={inventory.filter(i => i.stockFisico <= i.minimoReorden).length === 0}
                        icon={AlertTriangle}
                        color="text-[#E03555]"
                        description="Ítems por debajo del mínimo"
                    />
                    <StatCard
                        title="Caducidad Próxima"
                        value={inventory.flatMap(i => i.lotes).filter(l => new Date(l.fechaCaducidad) < new Date(new Date().setMonth(new Date().getMonth() + 3))).length.toString()}
                        trend="<90 Días"
                        isPositive={false}
                        icon={Calendar}
                        color="text-[#051650]"
                        description="Lotes con FEFO prioritario"
                    />
                    <StatCard
                        title="Total Lotes"
                        value={inventory.flatMap(i => i.lotes).length.toString()}
                        trend="StckMov"
                        icon={TrendingDown}
                        color="text-[#051650]"
                        description="Movimientos de stock registrados"
                    />
                </div>

                {/* Content */}
                <div className="px-1">
                    {activeTab === 'visual' && renderVisualInventory()}
                    {activeTab === 'trazabilidad' && renderTrazabilidad()}
                    {activeTab === 'pedidos' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center animate-in zoom-in-95 duration-500 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full -ml-32 -mt-32" />
                            <div className="relative z-10">
                                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-blue-100">
                                    <Cpu className="w-12 h-12" />
                                </div>
                                <h3 className="text-3xl font-bold text-[#051650] dark:text-white uppercase tracking-tighter mb-4 flex items-center justify-center gap-3">
                                    IA Dental Order Engine
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto mb-10 leading-relaxed font-medium">
                                    Analiza el stock actual desde <strong>TArticulo+StckMov</strong> (GELITE vía backend) y genera una propuesta de pedido para todos los artículos por debajo del mínimo de reorden configurado.
                                </p>
                                {/* M-01 FIX: Botón conectado a datos reales de stock */}
                                <button
                                    onClick={() => setPedidoVisible(v => !v)}
                                    className="px-10 py-5 bg-[#051650] text-white rounded-[1.5rem] text-[13px] font-bold uppercase tracking-widest shadow-2xl shadow-blue-900/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 mx-auto group"
                                >
                                    {pedidoVisible ? 'Ocultar Pre-Pedido' : 'Generar Pre-Pedido Inteligente'}
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                {pedidoVisible && (
                                    <div className="mt-8 bg-slate-50 rounded-[1.5rem] border border-slate-200 p-6 text-left animate-in fade-in duration-300">
                                        <h4 className="text-[13px] font-bold text-slate-700 uppercase tracking-widest mb-4">
                                            Pre-Pedido — Artículos críticos desde TArticulo (GELITE vía backend)
                                        </h4>
                                        {inventory.filter(i => i.stockFisico <= i.minimoReorden).length === 0 ? (
                                            <p className="text-[13px] text-[#051650] font-bold">✓ No hay artículos críticos. Stock en orden.</p>
                                        ) : (
                                            <table className="w-full text-left">
                                                <thead><tr className="text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                                                    <th className="pb-2">Artículo</th>
                                                    <th className="pb-2">SKU</th>
                                                    <th className="pb-2">Actual</th>
                                                    <th className="pb-2">Mínimo</th>
                                                    <th className="pb-2">Sugerido Pedir</th>
                                                </tr></thead>
                                                <tbody>
                                                    {inventory.filter(i => i.stockFisico <= i.minimoReorden).map(item => (
                                                        <tr key={item.id} className="text-[13px] font-medium text-slate-700 border-b border-slate-100">
                                                            <td className="py-2 font-bold">{item.nombre}</td>
                                                            <td className="py-2 text-slate-400">{item.sku}</td>
                                                            <td className="py-2 text-[#E03555] font-bold">{item.stockFisico}</td>
                                                            <td className="py-2">{item.minimoReorden}</td>
                                                            <td className="py-2 text-blue-700 font-bold">{Math.max(item.minimoReorden * 3 - item.stockFisico, 1)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Trazas — datos reales de StckMov via GELITE (backend) */}
            {trazasItem && (
                <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4" onClick={() => setTrazasItem(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-sm font-bold text-[#051650] uppercase tracking-tight">{trazasItem.nombre}</h3>
                                <p className="text-[12px] text-slate-400 font-medium">Lotes desde StckMov · Backend GELITE</p>
                            </div>
                            <button onClick={() => setTrazasItem(null)} className="text-slate-400 hover:text-slate-700 p-2 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        {trazasItem.lotes.length === 0 ? (
                            <p className="text-[13px] text-slate-400 font-medium">Sin lotes en StckMov para este artículo.</p>
                        ) : (
                            <table className="w-full text-left">
                                <thead><tr className="text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <th className="pb-2">Lote</th>
                                    <th className="pb-2">Caducidad</th>
                                    <th className="pb-2">Cantidad</th>
                                    <th className="pb-2">Estado</th>
                                </tr></thead>
                                <tbody>
                                    {trazasItem.lotes.map((l, i) => (
                                        <tr key={i} className="text-[13px] border-b border-slate-50">
                                            <td className="py-2 font-bold text-slate-700">{l.loteFabricante || '—'}</td>
                                            <td className={`py-2 ${new Date(l.fechaCaducidad) < new Date(new Date().setMonth(new Date().getMonth() + 3)) ? 'text-[#051650] font-bold' : 'text-slate-500'}`}>{l.fechaCaducidad || '—'}</td>
                                            <td className="py-2 font-bold text-slate-800">{l.cantidad}</td>
                                            <td className="py-2"><span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#051650]">{l.estado}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Reponer — escribe en stock_ajustes_pendientes via updateStock (backend) */}
            {reponerItem && (
                <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4" onClick={() => setReponerItem(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-[#051650] uppercase tracking-tight mb-2">Reponer Stock</h3>
                        <p className="text-[13px] text-slate-500 mb-1">{reponerItem.nombre}</p>
                        <p className="text-[13px] text-slate-400 mb-6">
                            Stock actual en TArticulo: <strong className="text-[#E03555]">{reponerItem.stockFisico} uds</strong>
                        </p>
                        <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Unidades a añadir</label>
                        <input
                            type="number"
                            min="1"
                            value={reponerCantidad}
                            onChange={e => setReponerCantidad(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                            placeholder="Ej: 50"
                        />
                        <p className="text-[13px] text-slate-400 mb-6">
                            Registra ajuste en <code className="bg-slate-100 px-1 rounded">stock_ajustes_pendientes</code> (Backend) para procesar en GELITE
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setReponerItem(null)} className="flex-1 py-3 border border-slate-200 rounded-xl text-[12px] font-bold uppercase text-slate-500 hover:bg-slate-50">Cancelar</button>
                            <button
                                onClick={handleReponer}
                                disabled={!reponerCantidad || reponerLoading}
                                className="flex-1 py-3 bg-[#051650] text-white rounded-xl text-[12px] font-bold uppercase hover:bg-blue-800 transition-all disabled:opacity-40"
                            >
                                {reponerLoading ? 'Guardando...' : 'Confirmar Reposición'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Inventario;
