// ─────────────────────────────────────────────────────────────────
//  services/config-agenda.service.ts
//  F-003 FIX: Config de agenda — ahora persiste en /api/admin/settings
// ─────────────────────────────────────────────────────────────────
import { authFetch } from './db';

export interface AgendaConfig {
    doctores: any[];
    horarios: any[];
    tratamientos: any[];
    [key: string]: any;
}

export const getConfigAgenda = async (): Promise<AgendaConfig | null> => {
    try {
        const res = await authFetch('/api/admin/settings');
        if (!res.ok) return null;
        const json = await res.json();
        // El endpoint devuelve toda la configuración; extraemos la parte de agenda
        const data = json.data ?? {};
        return {
            doctores: data.doctores ?? [],
            horarios: data.horarios ?? [],
            tratamientos: data.tratamientos ?? [],
            ...data,
        };
    } catch {
        return null;
    }
};

export const saveConfigAgenda = async (config: AgendaConfig): Promise<boolean> => {
    try {
        const res = await authFetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        return res.ok;
    } catch {
        return false;
    }
};
