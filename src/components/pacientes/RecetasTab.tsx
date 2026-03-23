// ─────────────────────────────────────────────────────────────────
//  components/pacientes/RecetasTab.tsx
//  Pestaña "Recetas" en Pacientes: listar historial + nueva receta
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Printer, Search, Pill, Trash2, Eye, X, FileText,
    Calendar, ClipboardList
} from 'lucide-react';
import {
    type Receta,
    getRecetasByPaciente,
    createReceta,
    deleteReceta,
    formatRecetaHTML,
    printReceta,
    createRecetaConDefaults,
    DOCTOR_DEFAULT,
} from '../../services/recetas.service';
import type { Medicamento } from '../../services/workflow-engine.service';

interface RecetasTabProps {
    numPac?: string;
    pacienteNombre?: string;
    pacienteDNI?: string;
    pacienteFechaNac?: string;
    showToast: (msg: string) => void;
}

// ── Estado del formulario de nueva receta ────────────────────────
interface NuevaRecetaForm {
    diagnostico: string;
    observaciones: string;
    medicamentos: Array<{
        nombre: string;
        presentacion: string;
        posologia: string;
        duracion: string;
        via: string;
        notas: string;
    }>;
}

const EMPTY_MED = { nombre: '', presentacion: '', posologia: '', duracion: '', via: 'Oral', notas: '' };
const EMPTY_FORM: NuevaRecetaForm = { diagnostico: '', observaciones: '', medicamentos: [{ ...EMPTY_MED }] };

const RecetasTab: React.FC<RecetasTabProps> = ({ numPac, pacienteNombre, pacienteDNI, pacienteFechaNac, showToast }) => {
    const [recetas, setRecetas] = useState<Receta[]>([]);
    const [view, setView] = useState<'list' | 'new' | 'preview'>('list');
    const [form, setForm] = useState<NuevaRecetaForm>({ ...EMPTY_FORM });
    const [previewHTML, setPreviewHTML] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReceta, setSelectedReceta] = useState<Receta | null>(null);

    // Cargar recetas del paciente
    const loadRecetas = useCallback(async () => {
        if (!numPac) return;
        const all = await getRecetasByPaciente(numPac);
        setRecetas(all.sort((a, b) => b.fecha.localeCompare(a.fecha)));
    }, [numPac]);

    useEffect(() => { loadRecetas(); }, [loadRecetas]);

    // Filtrar recetas
    const filtered = recetas.filter(r => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return r.medicamentos.some(m => m.nombre.toLowerCase().includes(q))
            || r.diagnostico.toLowerCase().includes(q)
            || r.fecha.includes(q)
            || (r.numReceta ?? '').includes(q);
    });

    // ── Handlers ─────────────────────────────────────────────────
    const handleNewReceta = () => {
        setForm({ ...EMPTY_FORM, medicamentos: [{ ...EMPTY_MED }] });
        setView('new');
    };

    const handleAddMed = () => {
        setForm(f => ({ ...f, medicamentos: [...f.medicamentos, { ...EMPTY_MED }] }));
    };

    const handleRemoveMed = (idx: number) => {
        setForm(f => ({ ...f, medicamentos: f.medicamentos.filter((_, i) => i !== idx) }));
    };

    const handleMedChange = (idx: number, field: string, value: string) => {
        setForm(f => ({
            ...f,
            medicamentos: f.medicamentos.map((m, i) => i === idx ? { ...m, [field]: value } : m)
        }));
    };

    const handleSave = async () => {
        if (!numPac || !pacienteNombre) {
            showToast('⚠ Selecciona un paciente primero');
            return;
        }
        if (form.medicamentos.every(m => !m.nombre.trim())) {
            showToast('⚠ Añade al menos un medicamento');
            return;
        }

        const validMeds = form.medicamentos.filter(m => m.nombre.trim());
        const recetaData = createRecetaConDefaults({
            numPac,
            pacienteNombre,
            pacienteDNI,
            pacienteFechaNac,
            diagnostico: form.diagnostico || 'Ver historia clínica',
            medicamentos: validMeds as Medicamento[],
            observaciones: form.observaciones || undefined,
        });

        const saved = await createReceta(recetaData);
        await loadRecetas();
        showToast(`✅ Receta ${saved.numReceta} generada`);

        // Mostrar preview
        setPreviewHTML(formatRecetaHTML(saved));
        setSelectedReceta(saved);
        setView('preview');
    };

    const handlePreview = (receta: Receta) => {
        setPreviewHTML(formatRecetaHTML(receta));
        setSelectedReceta(receta);
        setView('preview');
    };

    const handlePrint = (receta: Receta) => {
        printReceta(receta);
        showToast('🖨 Abriendo ventana de impresión');
    };

    const handleDelete = async (id: string) => {
        await deleteReceta(id);
        await loadRecetas();
        showToast('Receta eliminada');
    };

    // ── VISTA: LISTA ─────────────────────────────────────────────
    if (view === 'list') {
        return (
            <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50/80">
                    <div className="p-2 bg-blue-700 rounded-lg flex-shrink-0">
                        <ClipboardList className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Recetas Médicas</h2>
                        <p className="text-[10px] text-slate-400 font-medium">{pacienteNombre ?? 'Sin paciente'} · {recetas.length} recetas</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar medicamento, fecha..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 w-52"
                            />
                        </div>
                        <button
                            onClick={handleNewReceta}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#051650] to-blue-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95"
                        >
                            <Plus className="w-3.5 h-3.5" /> Nueva Receta
                        </button>
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {!numPac ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <FileText className="w-10 h-10 mb-2 opacity-40" />
                            <p className="text-sm font-bold">Selecciona un paciente</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Pill className="w-10 h-10 mb-2 opacity-40" />
                            <p className="text-sm font-bold">{searchQuery ? 'Sin resultados' : 'No hay recetas'}</p>
                            <p className="text-xs mt-1">Pulsa "Nueva Receta" para crear una</p>
                        </div>
                    ) : filtered.map(receta => (
                        <div key={receta.id} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200 hover:border-blue-200 transition-all group cursor-pointer"
                            onClick={() => handlePreview(receta)}>
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Pill className="w-5 h-5 text-blue-700" />
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-800 truncate">
                                        {receta.medicamentos.map(m => m.nombre).join(', ')}
                                    </span>
                                    {receta.numReceta && (
                                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                            {receta.numReceta}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                    {receta.diagnostico} · {receta.medicamentos.length} medicamento{receta.medicamentos.length > 1 ? 's' : ''}
                                </p>
                            </div>
                            {/* Fecha + acciones */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {receta.fecha}
                                </span>
                                <button
                                    onClick={e => { e.stopPropagation(); handlePrint(receta); }}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    title="Imprimir"
                                >
                                    <Printer className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={e => { e.stopPropagation(); handleDelete(receta.id); }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── VISTA: NUEVA RECETA ──────────────────────────────────────
    if (view === 'new') {
        return (
            <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
                    <button onClick={() => setView('list')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="p-2 bg-blue-700 rounded-lg flex-shrink-0">
                        <Plus className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Nueva Receta</h2>
                    <span className="text-[10px] text-slate-400 font-medium ml-2">{pacienteNombre}</span>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={() => setView('list')}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95"
                        >
                            <Printer className="w-3.5 h-3.5" /> Generar Receta
                        </button>
                    </div>
                </div>

                {/* Formulario */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Datos fijos del prescriptor (read-only) */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Prescriptor (automático)</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span><strong>Doctor:</strong> {DOCTOR_DEFAULT.nombre}</span>
                            <span><strong>Nº Col:</strong> {DOCTOR_DEFAULT.colegiado}</span>
                            <span><strong>NIF:</strong> {DOCTOR_DEFAULT.NIF}</span>
                            <span><strong>Clínica:</strong> {DOCTOR_DEFAULT.clinica}</span>
                        </div>
                    </div>

                    {/* Diagnóstico */}
                    <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Diagnóstico</label>
                        <input
                            type="text"
                            value={form.diagnostico}
                            onChange={e => setForm(f => ({ ...f, diagnostico: e.target.value }))}
                            placeholder="Ej: Infección periapical pieza 3.6"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                        />
                    </div>

                    {/* Medicamentos */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Medicamentos</label>
                            <button onClick={handleAddMed} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800">
                                <Plus className="w-3 h-3" /> Añadir
                            </button>
                        </div>
                        <div className="space-y-3">
                            {form.medicamentos.map((med, idx) => (
                                <div key={idx} className="bg-blue-50/50 rounded-xl p-3 border border-blue-200/50 relative">
                                    {form.medicamentos.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveMed(idx)}
                                            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-12 gap-2">
                                        <div className="col-span-5">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase">Medicamento *</label>
                                            <input
                                                type="text"
                                                value={med.nombre}
                                                onChange={e => handleMedChange(idx, 'nombre', e.target.value)}
                                                placeholder="Ej: Amoxicilina"
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase">Presentación</label>
                                            <input
                                                type="text"
                                                value={med.presentacion}
                                                onChange={e => handleMedChange(idx, 'presentacion', e.target.value)}
                                                placeholder="750mg comp."
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                            />
                                        </div>
                                        <div className="col-span-4">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase">Posología</label>
                                            <input
                                                type="text"
                                                value={med.posologia}
                                                onChange={e => handleMedChange(idx, 'posologia', e.target.value)}
                                                placeholder="1 comp cada 8h"
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase">Duración</label>
                                            <input
                                                type="text"
                                                value={med.duracion}
                                                onChange={e => handleMedChange(idx, 'duracion', e.target.value)}
                                                placeholder="7 días"
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase">Vía</label>
                                            <select
                                                value={med.via}
                                                onChange={e => handleMedChange(idx, 'via', e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
                                            >
                                                <option>Oral</option>
                                                <option>Tópica</option>
                                                <option>Intramuscular</option>
                                                <option>Intravenosa</option>
                                                <option>Sublingual</option>
                                            </select>
                                        </div>
                                        <div className="col-span-7">
                                            <label className="text-[8px] font-bold text-slate-500 uppercase">Notas / Alertas</label>
                                            <input
                                                type="text"
                                                value={med.notas}
                                                onChange={e => handleMedChange(idx, 'notas', e.target.value)}
                                                placeholder="Ej: Tomar con comida"
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Observaciones al farmacéutico */}
                    <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Observaciones al farmacéutico</label>
                        <textarea
                            value={form.observaciones}
                            onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                            placeholder="Información adicional para el farmacéutico..."
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                        />
                    </div>
                </div>
            </div>
        );
    }

    // ── VISTA: PREVIEW ───────────────────────────────────────────
    return (
        <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white">
                <button onClick={() => setView('list')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                    <X className="w-4 h-4" />
                </button>
                <div className="p-2 bg-emerald-600 rounded-lg flex-shrink-0">
                    <Eye className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Vista previa</h2>
                    {selectedReceta && <p className="text-[10px] text-slate-400">{selectedReceta.numReceta} · {selectedReceta.fecha}</p>}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => setView('list')}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                    >
                        ← Volver
                    </button>
                    {selectedReceta && (
                        <button
                            onClick={() => handlePrint(selectedReceta)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#051650] to-blue-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95"
                        >
                            <Printer className="w-3.5 h-3.5" /> Imprimir
                        </button>
                    )}
                </div>
            </div>
            {/* Preview iframe */}
            <div className="flex-1 min-h-0 bg-slate-100 p-4 flex items-start justify-center overflow-auto">
                <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-slate-200" style={{ width: '210mm', minHeight: '297mm' }}>
                    <iframe
                        srcDoc={previewHTML}
                        title="Receta Preview"
                        className="w-full border-0"
                        style={{ minHeight: '297mm' }}
                        sandbox="allow-scripts"
                    />
                </div>
            </div>
        </div>
    );
};

export default RecetasTab;
