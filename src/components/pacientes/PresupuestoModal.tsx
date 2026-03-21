import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Printer, MessageSquare, Check, ChevronDown, Zap, Loader2 } from 'lucide-react';
import {
    createPresupuesto, updatePresupuesto,
    CATALOGO_TRATAMIENTOS,
    type Presupuesto, type LineaPresupuesto,
} from '../../services/presupuestos.service';
import { sendTextMessage, isEvolutionConfigured } from '../../services/evolution.service';
import { suggestBudgetFromOdontograma } from '../../services/ia-dental.service';
import { getOdontograma } from '../../services/odontograma.service';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
    const dt = new Date(d); dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
};

// FDI tooth numbers (all 32)
const PIEZAS = [
    '18','17','16','15','14','13','12','11',
    '21','22','23','24','25','26','27','28',
    '48','47','46','45','44','43','42','41',
    '31','32','33','34','35','36','37','38',
    'Superior','Inferior','General',
];

// ── Empty line factory ─────────────────────────────────────────────────────────
const newLine = (idPre = 0): LineaPresupuesto => ({
    id: `L${Date.now()}_${Math.random().toString(36).slice(2)}`,
    idPre,
    descripcion: '',
    pieza: '',
    cantidad: 1,
    precioPresupuesto: 0,
    precioUnitario: 0,
    descuento: 0,
    importeLinea: 0,
    importeCobrado: 0,
    estado: 'Pendiente',
});

const lineTotal = (l: LineaPresupuesto) =>
    Math.round(l.cantidad * l.precioUnitario! * (1 - l.descuento / 100) * 100) / 100;

// ── Props ─────────────────────────────────────────────────────────────────────
interface PresupuestoModalProps {
    numPac: string;
    pacienteNombre?: string;
    pacienteTelefono?: string;
    presupuesto?: Presupuesto | null; // null = new
    onClose: () => void;
    onSaved: (p: Presupuesto) => void;
    showToast?: (msg: string) => void;
}

// ── CatalogDropdown ────────────────────────────────────────────────────────────
const CatalogDropdown: React.FC<{
    value: string;
    onChange: (desc: string, price: number) => void;
}> = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(value);
    const ref = useRef<HTMLDivElement>(null);

    const filtered = CATALOGO_TRATAMIENTOS.filter(t =>
        t.descripcion.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 12);

    useEffect(() => { setQuery(value); }, [value]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative', flex: 1 }}>
            <input
                value={query}
                onChange={e => { setQuery(e.target.value); onChange(e.target.value, 0); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder="Descripción del tratamiento..."
                style={{
                    width: '100%', padding: '4px 8px', fontSize: 13, border: '1px solid #e2e8f0',
                    borderRadius: 6, outline: 'none', backgroundColor: '#fff',
                }}
            />
            {open && filtered.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto',
                }}>
                    {filtered.map(t => (
                        <div
                            key={t.descripcion}
                            onClick={() => { onChange(t.descripcion, t.precio); setQuery(t.descripcion); setOpen(false); }}
                            style={{
                                padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                borderBottom: '1px solid #f8fafc',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                        >
                            <span style={{ color: '#334155' }}>{t.descripcion}</span>
                            <span style={{
                                fontSize: 12, fontWeight: 700, color: '#051650',
                                background: '#eff6ff', padding: '1px 6px', borderRadius: 4,
                            }}>
                                {fmt(t.precio)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Main modal ────────────────────────────────────────────────────────────────
const PresupuestoModal: React.FC<PresupuestoModalProps> = ({
    numPac, pacienteNombre = '', pacienteTelefono = '',
    presupuesto, onClose, onSaved, showToast,
}) => {
    const isNew = !presupuesto;
    const toast = (msg: string) => showToast ? showToast(msg) : alert(msg);

    const [fecha, setFecha] = useState(presupuesto?.fecha ?? today());
    const [validez, setValidez] = useState(presupuesto?.fecha ? addDays(presupuesto.fecha, 30) : addDays(today(), 30));
    const [notas, setNotas] = useState(presupuesto?.notas ?? '');
    const [estado, setEstado] = useState<Presupuesto['estado']>(presupuesto?.estado ?? 'Borrador');
    const [lineas, setLineas] = useState<LineaPresupuesto[]>(
        presupuesto?.lineas?.length ? presupuesto.lineas : [newLine()]
    );
    const [saving, setSaving] = useState(false);
    const [showCatCategoria, setShowCatCategoria] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    // Computed totals
    const subtotal = lineas.reduce((s, l) => s + l.cantidad * (l.precioUnitario ?? 0), 0);
    const descuentoTotal = lineas.reduce((s, l) => s + (l.cantidad * (l.precioUnitario ?? 0) * l.descuento / 100), 0);
    const total = subtotal - descuentoTotal;

    // ── Line CRUD ──────────────────────────────────────────────────────────────

    const updateLine = useCallback((idx: number, patch: Partial<LineaPresupuesto>) => {
        setLineas(prev => {
            const next = [...prev];
            const updated = { ...next[idx], ...patch };
            updated.importeLinea = lineTotal(updated);
            updated.precioPresupuesto = updated.importeLinea;
            next[idx] = updated;
            return next;
        });
    }, []);

    const addLine = useCallback(() => {
        setLineas(prev => [...prev, newLine(presupuesto?.id ?? 0)]);
    }, [presupuesto?.id]);

    const removeLine = useCallback((idx: number) => {
        setLineas(prev => prev.filter((_, i) => i !== idx));
    }, []);

    const addFromCatalog = useCallback((t: typeof CATALOGO_TRATAMIENTOS[0]) => {
        setLineas(prev => [
            ...prev.filter(l => l.descripcion !== ''), // remove empty lines
            {
                ...newLine(),
                descripcion: t.descripcion,
                precioUnitario: t.precio,
                precioPresupuesto: t.precio,
                importeLinea: t.precio,
            },
        ]);
        setShowCatCategoria(false);
    }, []);

    const handleAISuggest = useCallback(async () => {
        setAiLoading(true);
        try {
            const odontograma = numPac ? await getOdontograma(numPac) : null;
            if (!odontograma || odontograma.length === 0) {
                toast('No hay datos de odontograma para este paciente. Rellena primero el odontograma.');
                return;
            }
            const suggestions = await suggestBudgetFromOdontograma(odontograma);
            if (suggestions.length === 0) {
                toast('La IA no pudo generar sugerencias. Comprueba que la API de IA esté configurada.');
                return;
            }
            const newLines = suggestions.map(s => ({
                ...newLine(),
                descripcion: s.descripcion,
                pieza: s.pieza || '',
                precioUnitario: s.precio,
                precioPresupuesto: s.precio,
                importeLinea: s.precio,
            }));
            setLineas(prev => [
                ...prev.filter(l => l.descripcion.trim() !== ''),
                ...newLines,
            ]);
            toast(`✅ IA añadió ${suggestions.length} tratamientos sugeridos del odontograma`);
        } catch {
            toast('Error al consultar la IA. Inténtalo de nuevo.');
        } finally {
            setAiLoading(false);
        }
    }, [numPac]);

    // ── Save ───────────────────────────────────────────────────────────────────

    const handleSave = useCallback(async (estadoOverride?: Presupuesto['estado']) => {
        if (lineas.filter(l => l.descripcion.trim()).length === 0) {
            toast('Añade al menos un tratamiento al presupuesto');
            return;
        }
        setSaving(true);
        try {
            const cleanLineas = lineas.filter(l => l.descripcion.trim()).map(l => ({
                ...l,
                importeLinea: lineTotal(l),
                precioPresupuesto: lineTotal(l),
            }));
            const finalEstado = estadoOverride ?? estado;
            const data = {
                idPac: numPac, pacienteNombre, lineas: cleanLineas,
                fecha, notas, estado: finalEstado,
                importeCobrado: 0, importePendiente: 0,
                importePagado: 0, lineasPendientes: 0, lineasFinalizadas: 0,
            };
            let saved: Presupuesto;
            if (isNew) {
                saved = await createPresupuesto(data as Omit<Presupuesto, 'id' | 'importeTotal'>);
            } else {
                saved = (await updatePresupuesto(presupuesto.id, data))!;
            }
            onSaved(saved);
            toast(`Presupuesto ${isNew ? 'creado' : 'actualizado'} correctamente`);
        } finally {
            setSaving(false);
        }
    }, [lineas, fecha, notas, estado, numPac, pacienteNombre, isNew, presupuesto, onSaved]);

    // ── Print ──────────────────────────────────────────────────────────────────

    const handlePrint = useCallback(() => {
        const w = window.open('', '_blank');
        if (!w) return;
        const catLines = lineas.filter(l => l.descripcion.trim());
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Presupuesto ${presupuesto?.id ?? 'NUEVO'} — ${pacienteNombre}</title>
<style>
  body{font-family:Arial,sans-serif;padding:32px;color:#1e293b;max-width:800px;margin:0 auto}
  h1{color:#051650;font-size:22px;margin-bottom:4px}
  .sub{color:#64748b;font-size:13px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th{background:#f1f5f9;padding:10px 8px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0}
  td{padding:9px 8px;border-bottom:1px solid #f1f5f9;font-size:13px}
  .right{text-align:right} .center{text-align:center}
  .total-row{font-weight:800;font-size:15px;color:#051650;border-top:2px solid #051650}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:#eff6ff;color:#051650}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8}
  @media print{body{padding:16px}}
</style></head><body>
<h1>Presupuesto de Tratamiento</h1>
<div class="sub">
  <strong>Paciente:</strong> ${pacienteNombre}&nbsp;&nbsp;
  <strong>Fecha:</strong> ${fecha}&nbsp;&nbsp;
  <strong>Válido hasta:</strong> ${validez}
  ${presupuesto?.id ? `&nbsp;&nbsp;<strong>Ref:</strong> #${presupuesto.id}` : ''}
</div>
<table>
  <thead><tr>
    <th>Tratamiento</th><th class="center">Pieza</th>
    <th class="center">Uds.</th><th class="right">Precio unit.</th>
    <th class="center">Desc.</th><th class="right">Total</th>
  </tr></thead>
  <tbody>
    ${catLines.map(l => `<tr>
      <td>${l.descripcion}</td>
      <td class="center">${l.pieza || '—'}</td>
      <td class="center">${l.cantidad}</td>
      <td class="right">${fmt(l.precioUnitario ?? 0)}</td>
      <td class="center">${l.descuento > 0 ? l.descuento + '%' : '—'}</td>
      <td class="right"><strong>${fmt(lineTotal(l))}</strong></td>
    </tr>`).join('')}
    <tr class="total-row">
      <td colspan="5" class="right">TOTAL PRESUPUESTO</td>
      <td class="right">${fmt(total)}</td>
    </tr>
  </tbody>
</table>
${notas ? `<p style="font-size:13px;color:#475569"><strong>Notas:</strong> ${notas}</p>` : ''}
<div class="footer">
  Rubio García Dental &bull; Este presupuesto es orientativo y está sujeto al diagnóstico definitivo del especialista.
  Válido hasta ${validez}.
</div>
</body></html>`);
        w.document.close();
        w.focus();
        w.print();
    }, [lineas, fecha, validez, notas, total, pacienteNombre, presupuesto]);

    // ── WhatsApp ───────────────────────────────────────────────────────────────

    const handleWhatsApp = useCallback(async () => {
        const lineasTxt = lineas
            .filter(l => l.descripcion.trim())
            .map(l => `• ${l.descripcion}${l.pieza ? ` (pieza ${l.pieza})` : ''} — ${fmt(lineTotal(l))}`)
            .join('\n');
        const texto = `Estimado/a ${pacienteNombre},\n\nAdjunto su presupuesto de tratamiento:\n\n${lineasTxt}\n\n*TOTAL: ${fmt(total)}*\n\nVálido hasta: ${validez}\n\nQuedamos a su disposición. ¡Gracias! 🦷`;
        if (isEvolutionConfigured() && pacienteTelefono) {
            const ok = await sendTextMessage(pacienteTelefono, texto);
            toast(ok ? '✅ Presupuesto enviado por WhatsApp' : 'Error al enviar WhatsApp');
        } else if (pacienteTelefono) {
            window.open(`https://wa.me/${pacienteTelefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
        } else {
            toast('No hay teléfono registrado para este paciente');
        }
    }, [lineas, total, validez, pacienteNombre, pacienteTelefono]);

    // ── Render ─────────────────────────────────────────────────────────────────

    const categories = [...new Set(CATALOGO_TRATAMIENTOS.map(t => t.categoria))];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(5,22,80,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '20px 16px', overflowY: 'auto',
        }}>
            <div style={{
                background: '#fff', borderRadius: 16, width: '100%', maxWidth: 980,
                boxShadow: '0 24px 80px rgba(5,22,80,0.25)',
                display: 'flex', flexDirection: 'column',
                minHeight: 'min-content',
            }}>

                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0',
                    background: '#f8fafc', borderRadius: '16px 16px 0 0',
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#051650' }}>
                            {isNew ? 'Nuevo Presupuesto' : `Presupuesto #${presupuesto.id}`}
                        </h2>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
                            {pacienteNombre} · {numPac}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
                            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <X size={16} color="#64748b" />
                    </button>
                </div>

                {/* ── Meta row ── */}
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 24px',
                    borderBottom: '1px solid #f1f5f9', background: '#fff',
                }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha</span>
                        <input
                            type="date" value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Válido hasta</span>
                        <input
                            type="date" value={validez}
                            onChange={e => setValidez(e.target.value)}
                            style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estado</span>
                        <select
                            value={estado}
                            onChange={e => setEstado(e.target.value as Presupuesto['estado'])}
                            style={{ padding: '5px 28px 5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, background: '#fff' }}
                        >
                            <option value="Borrador">Borrador</option>
                            <option value="Pendiente">Pendiente (enviar al paciente)</option>
                            <option value="Aceptado">Aceptado</option>
                            <option value="En curso">En curso</option>
                            <option value="Finalizado">Finalizado</option>
                            <option value="Rechazado">Rechazado</option>
                        </select>
                    </label>
                </div>

                {/* ── Lines table ── */}
                <div style={{ padding: '16px 24px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Tratamientos
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {/* AI suggest from odontogram */}
                            <button
                                onClick={handleAISuggest}
                                disabled={aiLoading}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 12px', fontSize: 12, fontWeight: 700,
                                    border: '1px solid #c7d2fe', borderRadius: 8,
                                    background: '#eff6ff', color: '#3730a3', cursor: 'pointer',
                                    opacity: aiLoading ? 0.6 : 1,
                                }}
                                title="Generar tratamientos sugeridos a partir del odontograma del paciente"
                            >
                                {aiLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
                                {aiLoading ? 'Consultando IA...' : 'IA desde odontograma'}
                            </button>

                            {/* Catalog quick-add */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowCatCategoria(v => !v)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '6px 12px', fontSize: 12, fontWeight: 700,
                                        border: '1px solid #e2e8f0', borderRadius: 8,
                                        background: '#fff', color: '#475569', cursor: 'pointer',
                                    }}
                                >
                                    Catálogo <ChevronDown size={13} />
                                </button>
                                {showCatCategoria && (
                                    <div style={{
                                        position: 'absolute', right: 0, top: '100%', zIndex: 9999,
                                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                        width: 340, maxHeight: 400, overflowY: 'auto',
                                    }}>
                                        {categories.map(cat => (
                                            <div key={cat}>
                                                <div style={{
                                                    padding: '6px 12px', fontSize: 10, fontWeight: 800,
                                                    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em',
                                                    background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
                                                }}>
                                                    {cat}
                                                </div>
                                                {CATALOGO_TRATAMIENTOS.filter(t => t.categoria === cat).map(t => (
                                                    <div
                                                        key={t.descripcion}
                                                        onClick={() => addFromCatalog(t)}
                                                        style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            padding: '7px 12px', cursor: 'pointer', fontSize: 12,
                                                            borderBottom: '1px solid #f8fafc',
                                                        }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                                                    >
                                                        <span style={{ color: '#334155' }}>{t.descripcion}</span>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#051650' }}>{fmt(t.precio)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={addLine}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 12px', fontSize: 12, fontWeight: 700,
                                    background: '#051650', color: '#fff',
                                    border: 'none', borderRadius: 8, cursor: 'pointer',
                                }}
                            >
                                <Plus size={13} /> Añadir línea
                            </button>
                        </div>
                    </div>

                    {/* Table header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 72px 52px 88px 56px 88px 32px',
                        gap: 4, padding: '6px 8px',
                        background: '#f8fafc', borderRadius: 8, marginBottom: 4,
                        fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                        <span>Descripción</span>
                        <span style={{ textAlign: 'center' }}>Pieza</span>
                        <span style={{ textAlign: 'center' }}>Uds.</span>
                        <span style={{ textAlign: 'right' }}>Precio unit.</span>
                        <span style={{ textAlign: 'center' }}>Dto %</span>
                        <span style={{ textAlign: 'right' }}>Total</span>
                        <span />
                    </div>

                    {/* Line rows */}
                    {lineas.map((l, idx) => (
                        <div
                            key={l.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 72px 52px 88px 56px 88px 32px',
                                gap: 4, padding: '4px 8px',
                                background: idx % 2 === 0 ? '#fff' : '#fafafa',
                                borderRadius: 6, alignItems: 'center',
                                border: '1px solid transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                        >
                            {/* Description with catalog autocomplete */}
                            <CatalogDropdown
                                value={l.descripcion}
                                onChange={(desc, price) => {
                                    if (price > 0) {
                                        updateLine(idx, { descripcion: desc, precioUnitario: price });
                                    } else {
                                        updateLine(idx, { descripcion: desc });
                                    }
                                }}
                            />
                            {/* Pieza */}
                            <select
                                value={l.pieza ?? ''}
                                onChange={e => updateLine(idx, { pieza: e.target.value })}
                                style={{
                                    padding: '4px 4px', fontSize: 12, border: '1px solid #e2e8f0',
                                    borderRadius: 6, background: '#fff', textAlign: 'center',
                                }}
                            >
                                <option value="">—</option>
                                {PIEZAS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            {/* Quantity */}
                            <input
                                type="number" min={1} max={99} value={l.cantidad}
                                onChange={e => updateLine(idx, { cantidad: Math.max(1, parseInt(e.target.value) || 1) })}
                                style={{
                                    padding: '4px 6px', fontSize: 12, border: '1px solid #e2e8f0',
                                    borderRadius: 6, textAlign: 'center', width: '100%',
                                }}
                            />
                            {/* Price */}
                            <input
                                type="number" min={0} step={0.01} value={l.precioUnitario ?? 0}
                                onChange={e => updateLine(idx, { precioUnitario: parseFloat(e.target.value) || 0 })}
                                style={{
                                    padding: '4px 6px', fontSize: 12, border: '1px solid #e2e8f0',
                                    borderRadius: 6, textAlign: 'right', width: '100%', fontFamily: 'monospace',
                                }}
                            />
                            {/* Discount */}
                            <input
                                type="number" min={0} max={100} value={l.descuento}
                                onChange={e => updateLine(idx, { descuento: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                                style={{
                                    padding: '4px 6px', fontSize: 12, border: '1px solid #e2e8f0',
                                    borderRadius: 6, textAlign: 'center', width: '100%',
                                    backgroundColor: l.descuento > 0 ? '#fef3c7' : '#fff',
                                    color: l.descuento > 0 ? '#92400e' : '#334155',
                                }}
                            />
                            {/* Total */}
                            <div style={{
                                textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                                color: '#051650', paddingRight: 4,
                            }}>
                                {fmt(lineTotal(l))}
                            </div>
                            {/* Delete */}
                            <button
                                onClick={() => removeLine(idx)}
                                style={{
                                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid transparent', borderRadius: 6, background: 'transparent', cursor: 'pointer',
                                }}
                                onMouseEnter={e => { (e.currentTarget.style.background = '#fff0f3'); (e.currentTarget.style.borderColor = '#ffc0cb'); }}
                                onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.borderColor = 'transparent'); }}
                            >
                                <Trash2 size={13} color="#e03555" />
                            </button>
                        </div>
                    ))}

                    {lineas.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                            Sin líneas de tratamiento — añade una o selecciona del catálogo
                        </div>
                    )}
                </div>

                {/* ── Totals + Notes ── */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    gap: 24, padding: '16px 24px', borderTop: '1px solid #f1f5f9',
                    background: '#f8fafc',
                }}>
                    {/* Notes */}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                            Notas internas
                        </label>
                        <textarea
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                            rows={3}
                            placeholder="Observaciones, condiciones especiales, plan de pagos..."
                            style={{
                                width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #e2e8f0',
                                borderRadius: 8, resize: 'vertical', background: '#fff', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Totals */}
                    <div style={{ minWidth: 240 }}>
                        {[
                            { label: 'Subtotal', value: subtotal, dim: true },
                            { label: 'Descuentos', value: -descuentoTotal, dim: true, hide: descuentoTotal === 0 },
                        ].filter(r => !r.hide).map(r => (
                            <div key={r.label} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '4px 0', fontSize: 13, color: r.dim ? '#94a3b8' : '#051650',
                            }}>
                                <span style={{ fontWeight: 600 }}>{r.label}</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.value)}</span>
                            </div>
                        ))}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 0 6px', borderTop: '2px solid #051650', marginTop: 6,
                        }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#051650' }}>TOTAL</span>
                            <span style={{ fontSize: 22, fontWeight: 900, color: '#051650', fontFamily: 'monospace' }}>{fmt(total)}</span>
                        </div>
                    </div>
                </div>

                {/* ── Footer actions ── */}
                <div style={{
                    display: 'flex', gap: 8, padding: '16px 24px',
                    borderTop: '1px solid #e2e8f0', background: '#fff',
                    borderRadius: '0 0 16px 16px', justifyContent: 'space-between', flexWrap: 'wrap',
                }}>
                    {/* Left: secondary actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onClose} style={{
                            padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b',
                        }}>
                            Cancelar
                        </button>
                        <button onClick={handlePrint} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#475569',
                        }}>
                            <Printer size={14} /> Imprimir PDF
                        </button>
                        <button onClick={handleWhatsApp} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#00B4AB',
                        }}>
                            <MessageSquare size={14} /> WhatsApp
                        </button>
                    </div>

                    {/* Right: primary save actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => handleSave('Borrador')}
                            disabled={saving}
                            style={{
                                padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#475569',
                            }}
                        >
                            Guardar borrador
                        </button>
                        <button
                            onClick={() => handleSave('Pendiente')}
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                border: 'none', borderRadius: 8,
                                background: '#051650', color: '#fff',
                                boxShadow: '0 2px 8px rgba(5,22,80,0.3)',
                                opacity: saving ? 0.6 : 1,
                            }}
                        >
                            <Check size={14} />
                            {saving ? 'Guardando...' : 'Guardar y enviar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PresupuestoModal;
