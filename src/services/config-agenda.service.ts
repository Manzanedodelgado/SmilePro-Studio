// ─────────────────────────────────────────────────────────────────
//  services/config-agenda.service.ts
//  Config de agenda — in-memory (stub temporal).
//  TODO: exponer /api/admin/settings en el backend.
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────

export interface AgendaConfig {
    doctores: any[];
    horarios: any[];
    tratamientos: any[];
}

let _config: AgendaConfig | null = null;

export const getConfigAgenda = async (): Promise<AgendaConfig | null> => _config;

export const saveConfigAgenda = async (config: AgendaConfig): Promise<boolean> => {
    _config = config;
    return true;
};
