import { useRef, useState } from 'react';
import type { Cita, EstadoCita } from '../../types';
import './CitaCard.css';

/* ═══════════════════════════════════════════════════════
   CitaCard — Tarjeta compacta de cita para el grid
   Migrado desde SmileStudio/repo con adaptación a tipos
   de producción (Cita vs CitaAPI)
   ═══════════════════════════════════════════════════════ */

// ── Estado → icono ──
const ESTADO_ICON: Record<EstadoCita, string> = {
    'planificada': '○',
    'confirmada':  '●',
    'espera':      '◎',
    'consulta':    '▶',
    'finalizada':  '✓',
    'fallada':     '✗',
    'anulada':     '✗',
    'cancelada':   '✗',
    'desconocido': '?',
    'bloqueo_bio': '🔒',
};

const ESTADO_LABEL: Record<EstadoCita, string> = {
    'planificada': 'Planificada',
    'confirmada':  'Confirmada',
    'espera':      'En espera',
    'consulta':    'En consulta',
    'finalizada':  'Finalizada',
    'fallada':     'No-Show',
    'anulada':     'Anulada',
    'cancelada':   'Cancelada',
    'desconocido': 'Desconocido',
    'bloqueo_bio': 'Bloqueo Bio.',
};

// ── Paleta de fondos por estado ──
const ESTADO_BG: Record<EstadoCita, { bg: string; border: string }> = {
    'planificada': { bg: '#3b82f6', border: '#2563eb' },
    'confirmada':  { bg: '#10b981', border: '#059669' },
    'espera':      { bg: '#f59e0b', border: '#d97706' },
    'consulta':    { bg: '#8b5cf6', border: '#7c3aed' },
    'finalizada':  { bg: '#64748b', border: '#475569' },
    'fallada':     { bg: '#ef4444', border: '#dc2626' },
    'anulada':     { bg: '#ef4444', border: '#dc2626' },
    'cancelada':   { bg: '#94a3b8', border: '#64748b' },
    'desconocido': { bg: '#6b7280', border: '#4b5563' },
    'bloqueo_bio': { bg: '#1e293b', border: '#0f172a' },
};

// ── Paleta rotatoria índice (cuando no hay estado conocido) ──
const CITA_COLORS = [
    { bg: '#1d4ed8', border: '#1e40af' },
    { bg: '#2563eb', border: '#1d4ed8' },
    { bg: '#3b82f6', border: '#2563eb' },
    { bg: '#60a5fa', border: '#3b82f6' },
    { bg: '#93c5fd', border: '#60a5fa' },
    { bg: '#bfdbfe', border: '#93c5fd' },
];

// ── WhatsApp icon SVG mini ──
const WhatsAppIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// ── Abrir WhatsApp (extrae el número del nombre del paciente o del contacto) ──
const openWhatsApp = (movil?: string) => {
    if (!movil) return;
    let clean = movil.replace(/[\s\-\(\)\.]/g, '');
    if (/^[67]\d{8}$/.test(clean)) clean = '34' + clean;
    if (clean.startsWith('0034')) clean = clean.substring(2);
    window.open(`https://wa.me/${clean}`, '_blank');
};

/* ── Componente CitaCard individual ── */
export function CitaCard({
    cita,
    compact = false,
    colorIndex = 0,
    movil,
}: {
    cita: Cita;
    compact?: boolean;
    colorIndex?: number;
    movil?: string;
}) {
    const estadoBg = ESTADO_BG[cita.estado] ?? CITA_COLORS[colorIndex % CITA_COLORS.length];
    const icon = ESTADO_ICON[cita.estado] ?? '○';
    const label = ESTADO_LABEL[cita.estado] ?? cita.estado;

    const nombreCompleto = cita.nombrePaciente || '';

    return (
        <div
            className={`cita-card cita-card--${cita.estado}`}
            style={{
                background: estadoBg.bg,
                borderLeftColor: estadoBg.border,
            }}
            title={`${label} · ${cita.tratamiento || 'Sin tratamiento'} · ${cita.notas || ''}`}
        >
            {/* Estado */}
            <div className="cita-estado">
                {icon}
            </div>

            {/* Info */}
            <div className="cita-info">
                {cita.pacienteNumPac && (
                    <span className="cita-numpac">{cita.pacienteNumPac}</span>
                )}
                <span className="cita-nombre">
                    {compact
                        ? (nombreCompleto.split(' ')[0] || 'PAC.')
                        : nombreCompleto || 'PACIENTE'
                    }
                </span>
                {!compact && cita.tratamiento && (
                    <span className="cita-tratamiento">
                        {cita.tratamiento}
                    </span>
                )}
                {!compact && cita.notas && (
                    <span className="cita-notas" title={cita.notas}>
                        📝 {cita.notas}
                    </span>
                )}
                {!compact && movil && (
                    <span className="cita-telefono" title={movil}>
                        📱 {movil}
                    </span>
                )}
            </div>

            {/* Alertas médicas */}
            {cita.alertasMedicas?.length > 0 && (
                <div className="cita-alerta-badge" title={cita.alertasMedicas.join(', ')}>
                    ⚠️
                </div>
            )}

            {/* WhatsApp */}
            <button
                className="cita-whatsapp"
                disabled={!movil}
                onClick={(e) => { e.stopPropagation(); openWhatsApp(movil); }}
                title={movil ? `WhatsApp: ${movil}` : 'Sin móvil registrado'}
            >
                <WhatsAppIcon />
            </button>
        </div>
    );
}

/* ── CitaSlot — celda con posibles colisiones ── */
export function CitaSlot({ citas, getMovil }: { citas: Cita[]; getMovil?: (cita: Cita) => string | undefined }) {
    const [expanded, setExpanded] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    if (citas.length === 0) return null;

    // Ordenar: consultando > espera > confirmada > planificada > finalizada > anulada
    const ORDER: Record<EstadoCita, number> = {
        'consulta':    0,
        'espera':      1,
        'confirmada':  2,
        'planificada': 3,
        'finalizada':  4,
        'fallada':     5,
        'anulada':     6,
        'cancelada':   7,
        'desconocido': 8,
        'bloqueo_bio': 9,
    };
    const sorted = [...citas].sort((a, b) =>
        (ORDER[a.estado] ?? 9) - (ORDER[b.estado] ?? 9)
    );

    if (sorted.length === 1) {
        return <CitaCard cita={sorted[0]} movil={getMovil?.(sorted[0])} />;
    }

    const visible = sorted.slice(0, 2);
    const remaining = sorted.length - 2;

    return (
        <div ref={ref} className="cita-collision-wrapper" style={{ position: 'relative' }}>
            {visible.map((c, i) => (
                <CitaCard key={c.id} cita={c} compact movil={getMovil?.(c)} colorIndex={i} />
            ))}
            {remaining > 0 && (
                <div className="cita-collision-badge" onClick={() => setExpanded(!expanded)}>
                    +{remaining} más
                </div>
            )}
            {expanded && (
                <div className="cita-expand-panel">
                    {sorted.map((c, i) => (
                        <CitaCard key={c.id} cita={c} movil={getMovil?.(c)} colorIndex={i} />
                    ))}
                    <button
                        onClick={() => setExpanded(false)}
                        style={{
                            fontSize: 9, fontWeight: 700, color: '#94a3b8',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '2px 0', textAlign: 'center',
                        }}
                    >
                        Cerrar
                    </button>
                </div>
            )}
        </div>
    );
}

/* ── CitaSkeleton de carga ── */
export function CitaSkeleton() {
    return <div className="cita-skeleton" style={{ margin: '2px 0' }} />;
}

export default CitaCard;
