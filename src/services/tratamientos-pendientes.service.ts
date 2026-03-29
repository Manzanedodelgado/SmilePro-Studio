// ─────────────────────────────────────────────────────────────────
//  services/tratamientos-pendientes.service.ts
//  Gestión de tratamientos pendientes de realizar para el doctor.
//  Los tratamientos provienen de las líneas de presupuestos aceptados.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import {
    getPresupuestosByPaciente,
    createPresupuesto,
    aceptarPresupuesto,
    updatePresupuesto,
    type Presupuesto,
    type LineaPresupuesto,
} from './presupuestos.service';

// ── Types ─────────────────────────────────────────────────────────

export interface TratamientoPendiente {
    lineaId: string;
    presupuestoId: number;
    descripcion: string;
    pieza?: string;
    precioPresupuesto: number;
    estado: LineaPresupuesto['estado'];
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Obtiene todos los tratamientos pendientes de un paciente
 * (líneas de presupuestos aceptados/en curso con estado 'Pendiente' o 'En tratamiento').
 */
export async function getTratamientosPendientes(numPac: string): Promise<TratamientoPendiente[]> {
    const presupuestos = await getPresupuestosByPaciente(numPac);
    const activos = presupuestos.filter(p =>
        p.estado === 'Aceptado' || p.estado === 'En curso'
    );

    const pendientes: TratamientoPendiente[] = [];
    for (const pres of activos) {
        for (const linea of pres.lineas) {
            if (linea.estado === 'Pendiente' || linea.estado === 'En tratamiento') {
                pendientes.push({
                    lineaId: linea.id,
                    presupuestoId: pres.id,
                    descripcion: linea.descripcion,
                    pieza: linea.pieza,
                    precioPresupuesto: linea.precioPresupuesto,
                    estado: linea.estado,
                });
            }
        }
    }

    return pendientes;
}

/**
 * Marca un tratamiento como 'Finalizado' en su presupuesto.
 */
export async function marcarTratamientoRealizado(
    presupuestoId: number,
    lineaId: string,
): Promise<boolean> {
    const presupuestos = await getPresupuestosByPaciente('');
    // Necesitamos buscar el presupuesto por ID directamente
    const allPresupuestos = JSON.parse(localStorage.getItem('smilepro:presupuestos') || '[]') as Presupuesto[];
    const pres = allPresupuestos.find(p => p.id === presupuestoId);
    if (!pres) {
        logger.warn(`[TTO-PEND] Presupuesto ${presupuestoId} no encontrado`);
        return false;
    }

    const lineas = pres.lineas.map(l =>
        l.id === lineaId ? { ...l, estado: 'Finalizado' as const } : l
    );

    const result = await updatePresupuesto(presupuestoId, { lineas });
    if (result) {
        logger.info(`[TTO-PEND] Tratamiento ${lineaId} marcado como Finalizado en presupuesto #${presupuestoId}`);

        // Si todas las líneas están finalizadas, marcar el presupuesto como Finalizado
        const allDone = lineas.every(l => l.estado === 'Finalizado' || l.estado === 'Anulado');
        if (allDone) {
            await updatePresupuesto(presupuestoId, { estado: 'Finalizado' });
            logger.info(`[TTO-PEND] Presupuesto #${presupuestoId} completado — todos los tratamientos finalizados`);
        }
    }
    return result !== null;
}

/**
 * Flujo 2: Doctor realiza tratamiento sin presupuesto previo.
 * Crea presupuesto, lo auto-acepta, y marca los tratamientos como realizados.
 */
export async function autoAcceptAndMark(
    numPac: string,
    pacienteNombre: string,
    lineas: Omit<LineaPresupuesto, 'id' | 'idPre'>[],
): Promise<Presupuesto | null> {
    // 1. Crear presupuesto
    const lineasFull: LineaPresupuesto[] = lineas.map((l, i) => ({
        ...l,
        id: `AUTO-${Date.now()}-${i}`,
        idPre: 0, // se asignará al crear
        estado: 'Finalizado' as const,  // ya realizado
        importeCobrado: 0,
    }));

    const pres = await createPresupuesto({
        idPac: numPac,
        pacienteNombre,
        lineas: lineasFull,
        estado: 'Borrador',
        fechaInicio: new Date().toISOString().slice(0, 10),
    });

    // 2. Auto-aceptar
    await aceptarPresupuesto(pres.id, numPac, 'Sistema (auto-aceptado en cita)');

    // 3. Actualizar estado de líneas a Finalizado
    await updatePresupuesto(pres.id, {
        lineas: lineasFull.map(l => ({ ...l, idPre: pres.id })),
        estado: 'Finalizado',
    });

    logger.info(`[TTO-PEND] Presupuesto #${pres.id} creado, aceptado y finalizado automáticamente para ${pacienteNombre}`);
    return pres;
}

/**
 * Comprueba si todos los tratamientos del presupuesto activo están finalizados
 * y no hay más presupuestos pendientes.
 * Devuelve true si se debería preguntar por recordatorio de revisión.
 */
export async function shouldAskForRevision(numPac: string): Promise<boolean> {
    const presupuestos = await getPresupuestosByPaciente(numPac);

    // ¿Hay presupuestos en curso o aceptados con líneas pendientes?
    const hasTreatmentsPending = presupuestos.some(p =>
        (p.estado === 'Aceptado' || p.estado === 'En curso') &&
        p.lineas.some(l => l.estado === 'Pendiente' || l.estado === 'En tratamiento')
    );

    // ¿Hay presupuestos en borrador o pendientes de aceptar?
    const hasUnacceptedBudgets = presupuestos.some(p =>
        p.estado === 'Borrador' || p.estado === 'Pendiente'
    );

    // Preguntar por revisión solo si no hay nada pendiente
    return !hasTreatmentsPending && !hasUnacceptedBudgets;
}
