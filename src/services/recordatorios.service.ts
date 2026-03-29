// ─────────────────────────────────────────────────────────────────
//  services/recordatorios.service.ts
//  Sistema de recordatorios clínicos: revisiones, seguimientos,
//  control de implantes, preparación de antibiótico, etc.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import { sendTextMessage, isEvolutionConfigured, normalizePhone } from './evolution.service';

const LS_KEY = 'smilepro:recordatorios';

// ── Types ─────────────────────────────────────────────────────────

export type TipoRecordatorio =
    | 'revision'             // Revisión periódica (doctor elige plazo)
    | 'seguimiento_24h'      // Post-tratamiento: cirugía, endo, ortodoncia
    | 'seguimiento_implante' // Implante: 2.5 meses para 2ª fase
    | 'antibiotico_prep';    // 48h antes de implante: empezar antibiótico

export type EstadoRecordatorio = 'pendiente' | 'enviado' | 'cancelado';

export type PlazoRevision = '15d' | '1m' | '3m' | '6m' | '1a';

export interface Recordatorio {
    id: string;
    numPac: string;
    pacienteNombre: string;
    telefono: string;
    tipo: TipoRecordatorio;
    fechaProgramada: string;   // ISO date string
    estado: EstadoRecordatorio;
    tratamiento: string;
    mensaje: string;
    presupuestoId?: number;
    citaId?: string;
    createdAt: string;
}

// ── Storage ───────────────────────────────────────────────────────

function loadAll(): Recordatorio[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveAll(data: Recordatorio[]): void {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function generateId(): string {
    return `REC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Cálculo de fechas ────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

export function plazoToDate(plazo: PlazoRevision, from: Date = new Date()): Date {
    switch (plazo) {
        case '15d': return addDays(from, 15);
        case '1m':  return addDays(from, 30);
        case '3m':  return addDays(from, 90);
        case '6m':  return addDays(from, 180);
        case '1a':  return addDays(from, 365);
    }
}

export function plazoLabel(plazo: PlazoRevision): string {
    switch (plazo) {
        case '15d': return '15 días';
        case '1m':  return '1 mes';
        case '3m':  return '3 meses';
        case '6m':  return '6 meses';
        case '1a':  return '1 año';
    }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Crea un recordatorio de revisión periódica (doctor elige plazo).
 */
export function crearRecordatorioRevision(
    numPac: string,
    pacienteNombre: string,
    telefono: string,
    plazo: PlazoRevision,
    tratamiento: string = 'Revisión general',
): Recordatorio {
    const fecha = plazoToDate(plazo);
    const nombre = pacienteNombre.split(' ')[0];
    const rec: Recordatorio = {
        id: generateId(),
        numPac,
        pacienteNombre,
        telefono,
        tipo: 'revision',
        fechaProgramada: fecha.toISOString().slice(0, 10),
        estado: 'pendiente',
        tratamiento,
        mensaje:
            `Hola ${nombre} 👋\n\n` +
            `Desde SmilePro Studio te recordamos que es buen momento para tu revisión dental.\n\n` +
            `Han pasado ${plazoLabel(plazo)} desde tu último tratamiento.\n` +
            `¿Te gustaría pedir cita? Responde *SÍ* y te contactamos.\n\n` +
            `— SmilePro Studio`,
        createdAt: new Date().toISOString(),
    };
    const all = loadAll();
    all.push(rec);
    saveAll(all);
    logger.info(`[RECORDATORIO] Revisión creada para ${pacienteNombre} — ${plazoLabel(plazo)} → ${rec.fechaProgramada}`);
    return rec;
}

/**
 * Crea seguimiento 24h post-tratamiento (cirugía, endo, ortodoncia, implante).
 */
export function crearSeguimiento24h(
    numPac: string,
    pacienteNombre: string,
    telefono: string,
    tratamiento: string,
): Recordatorio {
    const nombre = pacienteNombre.split(' ')[0];
    const rec: Recordatorio = {
        id: generateId(),
        numPac,
        pacienteNombre,
        telefono,
        tipo: 'seguimiento_24h',
        fechaProgramada: addDays(new Date(), 1).toISOString().slice(0, 10),
        estado: 'pendiente',
        tratamiento,
        mensaje:
            `Hola ${nombre} 👋\n\n` +
            `Ayer te realizamos: *${tratamiento}*\n\n` +
            `¿Cómo te encuentras? ¿Tienes alguna molestia o inflamación?\n\n` +
            `Si necesitas algo, escríbenos o llámanos. Estamos aquí para ti 😊\n\n` +
            `— SmilePro Studio`,
        createdAt: new Date().toISOString(),
    };
    const all = loadAll();
    all.push(rec);
    saveAll(all);
    logger.info(`[RECORDATORIO] Seguimiento 24h creado para ${pacienteNombre} — ${tratamiento}`);
    return rec;
}

/**
 * Crea seguimiento de implante a 2.5 meses (para 2ª fase o medidas de corona).
 */
export function crearSeguimientoImplante(
    numPac: string,
    pacienteNombre: string,
    telefono: string,
    tratamiento: string,
): Recordatorio {
    const nombre = pacienteNombre.split(' ')[0];
    const fecha = addDays(new Date(), 75); // ~2.5 meses
    const rec: Recordatorio = {
        id: generateId(),
        numPac,
        pacienteNombre,
        telefono,
        tipo: 'seguimiento_implante',
        fechaProgramada: fecha.toISOString().slice(0, 10),
        estado: 'pendiente',
        tratamiento,
        mensaje:
            `Hola ${nombre} 👋\n\n` +
            `Han pasado 2 meses y medio desde tu cirugía de implante.\n\n` +
            `Es momento de programar una cita para continuar con tu tratamiento ` +
            `(segunda fase de implante o toma de medidas para la corona).\n\n` +
            `¿Puedes venir esta semana o la próxima? Responde *SÍ* y te damos cita.\n\n` +
            `— SmilePro Studio`,
        createdAt: new Date().toISOString(),
    };
    const all = loadAll();
    all.push(rec);
    saveAll(all);
    logger.info(`[RECORDATORIO] Seguimiento implante 2.5m para ${pacienteNombre} → ${rec.fechaProgramada}`);
    return rec;
}

/**
 * Crea recordatorio de antibiótico 48h antes del implante.
 * ⚠️ Solo si el paciente tiene receta de antibiótico asociada.
 */
export function crearRecordatorioAntibiotico(
    numPac: string,
    pacienteNombre: string,
    telefono: string,
    fechaCita: string, // ISO date
    antibioticoNombre: string,
): Recordatorio {
    const nombre = pacienteNombre.split(' ')[0];
    const citaDate = new Date(fechaCita);
    const recDate = addDays(citaDate, -2); // 48h antes
    const rec: Recordatorio = {
        id: generateId(),
        numPac,
        pacienteNombre,
        telefono,
        tipo: 'antibiotico_prep',
        fechaProgramada: recDate.toISOString().slice(0, 10),
        estado: 'pendiente',
        tratamiento: 'Preparación implante — antibiótico',
        mensaje:
            `Hola ${nombre} 👋\n\n` +
            `Tu cita de implante es pasado mañana.\n\n` +
            `⚠️ *Recuerda empezar a tomar el antibiótico prescrito:*\n` +
            `💊 *${antibioticoNombre}*\n\n` +
            `Es importante que empieces hoy según las indicaciones ` +
            `que te dimos con la receta.\n\n` +
            `Si tienes alguna duda, escríbenos.\n\n` +
            `— SmilePro Studio`,
        createdAt: new Date().toISOString(),
    };
    const all = loadAll();
    all.push(rec);
    saveAll(all);
    logger.info(`[RECORDATORIO] Antibiótico 48h antes para ${pacienteNombre} — ${antibioticoNombre}`);
    return rec;
}

// ── Consulta y gestión ────────────────────────────────────────────

/** Obtiene todos los recordatorios de un paciente */
export function getRecordatoriosByPaciente(numPac: string): Recordatorio[] {
    return loadAll().filter(r => r.numPac === numPac);
}

/** Obtiene los recordatorios pendientes que vencen hoy */
export function getRecordatoriosPendientesHoy(): Recordatorio[] {
    const hoy = new Date().toISOString().slice(0, 10);
    return loadAll().filter(r => r.estado === 'pendiente' && r.fechaProgramada <= hoy);
}

/** Marca un recordatorio como enviado */
export function marcarEnviado(id: string): void {
    const all = loadAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx !== -1) {
        all[idx].estado = 'enviado';
        saveAll(all);
    }
}

/** Cancela un recordatorio */
export function cancelarRecordatorio(id: string): void {
    const all = loadAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx !== -1) {
        all[idx].estado = 'cancelado';
        saveAll(all);
    }
}

/**
 * Procesa todos los recordatorios pendientes:
 * envía los mensajes de los que hayan vencido y los marca como enviados.
 * Se llama periódicamente (ej: cada hora o al iniciar la app).
 */
export async function processRecordatoriosPendientes(): Promise<number> {
    if (!isEvolutionConfigured()) return 0;

    const pendientes = getRecordatoriosPendientesHoy();
    let enviados = 0;

    for (const rec of pendientes) {
        const sent = await sendTextMessage(normalizePhone(rec.telefono), rec.mensaje);
        if (sent) {
            marcarEnviado(rec.id);
            enviados++;
            logger.info(`[RECORDATORIO] Enviado: ${rec.tipo} → ${rec.pacienteNombre}`);
        }
    }

    if (enviados > 0) {
        logger.info(`[RECORDATORIO] ${enviados}/${pendientes.length} recordatorios enviados`);
    }

    return enviados;
}
