// ─────────────────────────────────────────────────────────────────
//  services/notificaciones.service.ts
//  P-001 FIX: Notificaciones del Header conectadas a datos reales.
//  Fuentes: citas del día (sin confirmar, urgentes), stock bajo.
//  Se ejecuta en background y devuelve alertas accionables.
// ─────────────────────────────────────────────────────────────────
import { getCitasByFecha } from './citas.service';
import { getItemsInventario } from './inventario.service';
import type { Cita, ItemInventario } from '../types';

export interface Notificacion {
    id: number;
    type: 'warning' | 'info' | 'success';
    iconName: 'AlertTriangle' | 'Clock' | 'CheckCircle2' | 'Package' | 'Info';
    title: string;
    body: string;
    time: string;
    area?: string;   // para navegar al hacer click
    subArea?: string;
}

let _cache: Notificacion[] = [];
let _lastFetch = 0;
const CACHE_TTL = 60_000; // 1 minuto

/** Hora relativa legible */
const relTime = (date: Date): string => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)}min`;
    return `Hace ${Math.floor(diff / 3600)}h`;
};

/** Genera notificaciones desde citas del día */
const buildCitaNotifs = (citas: Cita[]): Notificacion[] => {
    const notifs: Notificacion[] = [];
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Citas sin confirmar (planificada, próximas 2h)
    const sinConfirmar = citas.filter(c =>
        c.estado === 'planificada' &&
        c.horaInicio >= hhmm &&
        c.horaInicio <= addMinutes(hhmm, 120)
    );
    if (sinConfirmar.length > 0) {
        notifs.push({
            id: 1,
            type: 'warning',
            iconName: 'Clock',
            title: `${sinConfirmar.length} cita${sinConfirmar.length > 1 ? 's' : ''} sin confirmar`,
            body: `Próximas 2h: ${sinConfirmar.map(c => c.nombrePaciente.split(' ')[0]).slice(0, 3).join(', ')}`,
            time: relTime(now),
            area: 'Agenda',
            subArea: 'Jornada de Hoy',
        });
    }

    // Citas urgentes hoy
    const urgentes = citas.filter(c => c.tratamiento === 'Urgencia' && c.estado !== 'finalizada');
    if (urgentes.length > 0) {
        notifs.push({
            id: 2,
            type: 'warning',
            iconName: 'AlertTriangle',
            title: `${urgentes.length} urgencia${urgentes.length > 1 ? 's' : ''} en agenda`,
            body: urgentes.map(c => `${c.horaInicio} — ${c.nombrePaciente.split(' ')[0]}`).slice(0, 2).join(' · '),
            time: relTime(now),
            area: 'Agenda',
            subArea: 'Jornada de Hoy',
        });
    }

    // Pacientes en espera (estado 'espera')
    const enEspera = citas.filter(c => c.estado === 'espera');
    if (enEspera.length > 0) {
        notifs.push({
            id: 3,
            type: 'info',
            iconName: 'Clock',
            title: `${enEspera.length} paciente${enEspera.length > 1 ? 's' : ''} en sala de espera`,
            body: enEspera.map(c => c.nombrePaciente.split(' ')[0]).join(', '),
            time: relTime(now),
            area: 'Agenda',
            subArea: 'Jornada de Hoy',
        });
    }

    return notifs;
};

/** Genera notificaciones desde stock */
const buildStockNotifs = (items: ItemInventario[]): Notificacion[] => {
    const bajos = items.filter(i => i.stockFisico <= i.minimoReorden && i.minimoReorden > 0);
    if (bajos.length === 0) return [];
    return [{
        id: 10,
        type: 'warning',
        iconName: 'Package',
        title: `Stock bajo: ${bajos.length} artículo${bajos.length > 1 ? 's' : ''}`,
        body: bajos.slice(0, 3).map(i => `${i.nombre} (${i.stockFisico}/${i.minimoReorden})`).join(', '),
        time: 'Ahora',
        area: 'Inventario',
        subArea: 'Panel de Stock',
    }];
};

/** Helper: suma minutos a HH:MM */
const addMinutes = (hhmm: string, mins: number): string => {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Carga y devuelve todas las notificaciones activas */
export const getNotificaciones = async (forceRefresh = false): Promise<Notificacion[]> => {
    if (!forceRefresh && Date.now() - _lastFetch < CACHE_TTL && _cache.length > 0) {
        return _cache;
    }

    try {
        const [citas, items] = await Promise.allSettled([
            getCitasByFecha(new Date()),
            getItemsInventario(),
        ]);

        const notifs: Notificacion[] = [];

        if (citas.status === 'fulfilled') {
            notifs.push(...buildCitaNotifs(citas.value));
        }
        if (items.status === 'fulfilled') {
            notifs.push(...buildStockNotifs(items.value));
        }

        _cache = notifs;
        _lastFetch = Date.now();
        return notifs;
    } catch {
        return _cache; // Devuelve caché si falla
    }
};

/** Fuerza recarga del caché de notificaciones */
export const invalidarNotificaciones = (): void => {
    _lastFetch = 0;
    _cache = [];
};
