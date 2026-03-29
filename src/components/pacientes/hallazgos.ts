// ─────────────────────────────────────────────────────────────────
//  hallazgos.ts — Clinical findings catalog for the odontogram
// ─────────────────────────────────────────────────────────────────

export type HallazgoCategoria = 'caries' | 'restauracion' | 'protesis' | 'ortodoncia' | 'periodoncia' | 'otros';

export interface Hallazgo {
  id: string;
  label: string;
  categoria: HallazgoCategoria;
  color: string;
  /** Whether this finding applies to individual surfaces or the whole tooth */
  porSuperficie: boolean;
  /** Icon name from lucide-react */
  icon?: string;
}

export const CATEGORIAS: { id: HallazgoCategoria; label: string; shortLabel: string; color: string }[] = [
  { id: 'caries', label: 'Caries', shortLabel: 'Caries', color: '#ef4444' },
  { id: 'restauracion', label: 'Restauraciones', shortLabel: 'Restau', color: '#3b82f6' },
  { id: 'protesis', label: 'Prótesis', shortLabel: 'Prótesis', color: '#f59e0b' },
  { id: 'ortodoncia', label: 'Ortodoncia', shortLabel: 'Orto', color: '#8b5cf6' },
  { id: 'periodoncia', label: 'Periodoncia', shortLabel: 'Perio', color: '#00B4AB' },
  { id: 'otros', label: 'Otros', shortLabel: 'Otros', color: '#64748b' },
];

export const HALLAZGOS: Hallazgo[] = [
  // Caries
  { id: 'caries', label: 'Lesión de caries', categoria: 'caries', color: '#ef4444', porSuperficie: true },
  { id: 'caries_incipiente', label: 'Caries incipiente', categoria: 'caries', color: '#fca5a5', porSuperficie: true },
  { id: 'caries_profunda', label: 'Caries profunda', categoria: 'caries', color: '#b91c1c', porSuperficie: true },

  // Restauraciones
  { id: 'obturacion', label: 'Obturación / Empaste', categoria: 'restauracion', color: '#3b82f6', porSuperficie: true },
  { id: 'amalgama', label: 'Amalgama', categoria: 'restauracion', color: '#6b7280', porSuperficie: true },
  { id: 'resina', label: 'Resina compuesta', categoria: 'restauracion', color: '#60a5fa', porSuperficie: true },
  { id: 'inlay', label: 'Inlay / Onlay', categoria: 'restauracion', color: '#2563eb', porSuperficie: true },

  // Prótesis
  { id: 'corona', label: 'Corona', categoria: 'protesis', color: '#f59e0b', porSuperficie: false },
  { id: 'puente', label: 'Puente', categoria: 'protesis', color: '#d97706', porSuperficie: false },
  { id: 'implante', label: 'Implante', categoria: 'protesis', color: '#8b5cf6', porSuperficie: false },
  { id: 'veneer', label: 'Carilla', categoria: 'protesis', color: '#fbbf24', porSuperficie: false },

  // Ortodoncia
  { id: 'orto_fijo', label: 'Aparato ortodóntico fijo', categoria: 'ortodoncia', color: '#7c3aed', porSuperficie: false },
  { id: 'orto_removible', label: 'Aparato ortodóntico removible', categoria: 'ortodoncia', color: '#a78bfa', porSuperficie: false },

  // Periodoncia
  { id: 'bolsa_periodontal', label: 'Bolsa periodontal', categoria: 'periodoncia', color: '#00B4AB', porSuperficie: false },
  { id: 'recesion', label: 'Recesión gingival', categoria: 'periodoncia', color: '#2DD4CF', porSuperficie: false },
  { id: 'movilidad', label: 'Movilidad dental', categoria: 'periodoncia', color: '#009E99', porSuperficie: false },

  // Otros
  { id: 'ausente', label: 'Ausente', categoria: 'otros', color: '#94a3b8', porSuperficie: false },
  { id: 'endodoncia', label: 'Endodoncia', categoria: 'otros', color: '#f97316', porSuperficie: false },
  { id: 'fractura', label: 'Fractura', categoria: 'otros', color: '#e11d48', porSuperficie: false },
  { id: 'sellante', label: 'Sellante', categoria: 'otros', color: '#06b6d4', porSuperficie: true },
];

/**
 * Get hallazgos filtered by category
 */
export function getHallazgosByCategoria(categoria: HallazgoCategoria): Hallazgo[] {
  return HALLAZGOS.filter(h => h.categoria === categoria);
}

/**
 * Find a hallazgo by its ID
 */
export function getHallazgoById(id: string): Hallazgo | undefined {
  return HALLAZGOS.find(h => h.id === id);
}
