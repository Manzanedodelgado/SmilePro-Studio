// ─── BudgetModal — Presupuesto desde el chat WhatsApp ─────────────────────────
import React, { useState, useRef } from 'react';
import { X, Plus, Trash2, Send, Printer, FileText } from 'lucide-react';
import { authFetch } from '../services/db';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

interface BudgetItem { id: string; description: string; price: number; }

interface BudgetModalProps {
    phone: string;
    patientName: string;
    doctorName?: string;
    onClose: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ phone, patientName, doctorName, onClose }) => {
    const [items, setItems] = useState<BudgetItem[]>([
        { id: '1', description: '', price: 0 },
    ]);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const addItem = () => setItems(p => [...p, { id: String(Date.now()), description: '', price: 0 }]);
    const removeItem = (id: string) => setItems(p => p.filter(i => i.id !== id));
    const updateItem = (id: string, field: 'description' | 'price', value: string | number) =>
        setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

    const total = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
    const validItems = items.filter(i => i.description.trim() && i.price > 0);

    const handleSendWhatsApp = async () => {
        if (!validItems.length) { setError('Añade al menos un tratamiento con precio.'); return; }
        setSending(true);
        setError(null);
        try {
            const r = await authFetch(`${API_BASE}/api/communication/whatsapp/send-budget`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, patientName, doctorName, items: validItems, totalAmount: total }),
            });
            if (!r.ok) throw new Error('Error del servidor');
            setSent(true);
            setTimeout(onClose, 2000);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error enviando');
        } finally {
            setSending(false);
        }
    };

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const win = window.open('', '_blank', 'width=700,height=900');
        if (!win) return;
        win.document.write(`
            <html><head><title>Presupuesto — ${patientName}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                h1 { color: #051650; font-size: 22px; margin-bottom: 4px; }
                .meta { color: #888; font-size: 13px; margin-bottom: 24px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #051650; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
                td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
                .total-row td { font-weight: bold; font-size: 16px; background: #f8f9ff; border-top: 2px solid #051650; }
                .footer { margin-top: 32px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
                @media print { body { padding: 20px; } }
            </style></head><body>
            <h1>PRESUPUESTO — Rubio García Dental</h1>
            <div class="meta">
                Paciente: <strong>${patientName}</strong>${doctorName ? ` | Dr/Dra: ${doctorName}` : ''}<br/>
                Fecha: ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <table>
                <thead><tr><th>Tratamiento</th><th style="text-align:right">Precio</th></tr></thead>
                <tbody>
                    ${validItems.map(i => `<tr><td>${i.description}</td><td style="text-align:right">${Number(i.price).toFixed(2)} €</td></tr>`).join('')}
                    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${total.toFixed(2)} €</td></tr>
                </tbody>
            </table>
            <div class="footer">Presupuesto válido durante 30 días. Para cualquier consulta contacte con la clínica.</div>
            </body></html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300]" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-[#051650] text-white">
                    <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-[#FBFFA3]" />
                        <div>
                            <p className="text-[14px] font-black uppercase tracking-tight">Presupuesto</p>
                            <p className="text-[12px] text-white/60">{patientName} · {phone}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_120px_36px] gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                        <span>Tratamiento</span>
                        <span className="text-right">Precio (€)</span>
                        <span />
                    </div>

                    {items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
                            <input
                                value={item.description}
                                onChange={e => updateItem(item.id, 'description', e.target.value)}
                                placeholder="Descripción del tratamiento..."
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3]"
                            />
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.price || ''}
                                onChange={e => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-[#0056b3]/20 focus:border-[#0056b3]"
                            />
                            <button onClick={() => removeItem(item.id)} disabled={items.length === 1}
                                className="p-2 text-slate-400 hover:text-[#E03555] hover:bg-[#FFF0F3] rounded-xl transition-all disabled:opacity-30">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}

                    <button onClick={addItem}
                        className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-200 rounded-xl text-[13px] font-bold text-slate-400 hover:border-[#0056b3] hover:text-[#0056b3] transition-all">
                        <Plus className="w-3.5 h-3.5" /> Añadir tratamiento
                    </button>

                    {/* Total */}
                    <div className="flex items-center justify-between px-4 py-3 bg-[#051650]/5 border border-[#051650]/10 rounded-xl mt-2">
                        <span className="text-[13px] font-black text-[#051650] uppercase tracking-wider">Total</span>
                        <span className="text-[20px] font-black text-[#051650]">{total.toFixed(2)} €</span>
                    </div>

                    {error && <p className="text-[12px] text-[#E03555] font-bold">{error}</p>}
                    {sent && <p className="text-[12px] text-teal-600 font-bold">✓ Presupuesto enviado por WhatsApp</p>}
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
                    <button onClick={handlePrint}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-all">
                        <Printer className="w-4 h-4" /> Imprimir PDF
                    </button>
                    <button onClick={handleSendWhatsApp} disabled={sending || sent || !validItems.length}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#051650] text-white rounded-xl text-[13px] font-bold hover:bg-[#0a2360] transition-all disabled:opacity-50">
                        {sending ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                        {sent ? 'Enviado ✓' : 'Enviar por WhatsApp'}
                    </button>
                </div>
            </div>
        </div>
    );
};
