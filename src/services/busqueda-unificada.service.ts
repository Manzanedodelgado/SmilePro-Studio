// ─────────────────────────────────────────────────────────────────
//  services/busqueda-unificada.service.ts
//  Búsqueda unificada sobre pacientes GELITE + contactos (backend).
//  Permite buscar por NumPac, nombre, apellidos, teléfono o email.
// ─────────────────────────────────────────────────────────────────

import { searchPacientes } from './pacientes.service';
import { buscarContactos, type Contacto } from './contactos.service';
import { logger } from './logger';

// ── Tipos ──────────────────────────────────────────────────────────

export type EntidadTipo = 'paciente' | 'contacto';

export interface EntidadBusqueda {
    /** ID único: NumPac o contacto.id */
    id: string;
    tipo: EntidadTipo;
    /** Nombre completo */
    nombre: string;
    /** Teléfono principal */
    telefono?: string;
    /** Email */
    email?: string;
    /** NumPac en GELITE (sólo para tipo 'paciente' y contactos ya vinculados) */
    numPac?: string;
    /** Número de citas o visitas */
    numVisitas?: number;
    /** Es menor de edad */
    esMenor?: boolean;
    /** NumPac provisional SmilePro (SP-NNNN) si ya asignado */
    spNumPac?: string;
    /** Nombre del tutor (si es menor) */
    nombreTutor?: string;
}

// ── Función principal ─────────────────────────────────────────────

/**
 * Busca en pacientes GELITE y contactos (backend) simultáneamente.
 * El resultado se ordena: pacientes primero, luego contactos.
 *
 * @param query  Texto libre: nombre, apellidos, teléfono, NumPac o email.
 * @param limit  Máximo de resultados (default 20).
 */
export const buscarEntidad = async (
    query: string,
    limit = 20,
): Promise<EntidadBusqueda[]> => {
    if (!query.trim()) return [];

    const q = query.trim().toLowerCase();

    try {
        // Lanzar ambas búsquedas en paralelo
        const [pacientes, contactos] = await Promise.all([
            searchPacientes(q).catch(() => []),
            buscarContactos(q).catch(() => [] as Contacto[]),
        ]);

        // ── Mapear pacientes GELITE ───────────────────────────────
        const resultadosPacientes: EntidadBusqueda[] = pacientes
            .slice(0, limit)
            .map(p => ({
                id: String(p.numPac ?? ''),
                tipo: 'paciente' as EntidadTipo,
                nombre: [p.nombre, p.apellidos].filter(Boolean).join(' '),
                telefono: (p.telefono) as string | undefined,
                email: undefined as string | undefined,
                numPac: String(p.numPac ?? ''),
            }));

        // ── Mapear contactos (backend) (sólo los que coincidan con q) ──
        const contactosFiltrados = contactos.filter(c => {
            const nombreCompleto = [c.nombre, c.apellidos].filter(Boolean).join(' ').toLowerCase();
            const tel = (c.telefono ?? '').toLowerCase();
            const email = (c.email ?? '').toLowerCase();
            const numpac = (c.numPac ?? '').toLowerCase();
            const telTutor = (c.telefonoTutor ?? '').toLowerCase();
            return nombreCompleto.includes(q) || tel.includes(q) || email.includes(q)
                || numpac.includes(q) || telTutor.includes(q);
        });

        const resultadosContactos: EntidadBusqueda[] = contactosFiltrados
            .slice(0, limit)
            .map(c => ({
                id: c.id,
                tipo: 'contacto' as EntidadTipo,
                nombre: [c.nombre, c.apellidos].filter(Boolean).join(' '),
                telefono: c.telefono,
                email: c.email,
                numPac: c.numPac ?? undefined,
                esMenor: c.esMenor,
                spNumPac: c.numPac ?? undefined,
                nombreTutor: c.esMenor
                    ? [c.nombreTutor, c.apellidosTutor].filter(Boolean).join(' ') || undefined
                    : undefined,
            }));

        const resultados = [...resultadosPacientes, ...resultadosContactos];

        logger.info(`[BusquedaUnificada] query="${q}" → ${resultadosPacientes.length} pac + ${resultadosContactos.length} ctc`);

        return resultados.slice(0, limit);

    } catch (e) {
        logger.error('[BusquedaUnificada] Error:', e);
        return [];
    }
};

/**
 * Busca por número de teléfono exacto (para WhatsApp entrante).
 * Devuelve el primer coincidente (paciente o contacto).
 */
export const buscarEntidadPorTelefono = async (
    telefono: string,
): Promise<EntidadBusqueda | null> => {
    const resultados = await buscarEntidad(telefono, 5);
    const exacto = resultados.find(r =>
        (r.telefono ?? '').replace(/[\s-]/g, '') === telefono.replace(/[\s-]/g, ''),
    );
    return exacto ?? resultados[0] ?? null;
};
