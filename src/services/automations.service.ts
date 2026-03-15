// ─────────────────────────────────────────────────────────────────
//  services/automations.service.ts
//  Automatizaciones — backend local (Node.js/Prisma).
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import { INITIAL_AUTOMATIONS, type Automation } from '../views/ia/AutomationRules';

const API_BASE = 'http://localhost:3000/api/ai';

let _cache: Automation[] | null = null;
export const invalidateAutomationsCache = () => { _cache = null; };

const mapRow = (r: any): Automation => ({
    id: r.id,
    name: r.name ?? '',
    description: r.description ?? '',
    trigger: r.trigger ?? r.trigger_event ?? '',
    channel: r.canal ?? r.channel ?? 'whatsapp',
    category: r.category ?? 'Citas',
    active: r.enabled ?? r.active ?? false,
    executions: r.executions ?? 0,
    successRate: r.successRate ?? r.success_rate ?? 0,
    timing: r.timing ?? '',
    example: r.example ?? '',
    config: r.config ?? r.steps?.[0] ?? {
        delayValue: 0, delayUnit: 'horas',
        message: '', channel: r.canal ?? 'whatsapp', schedule: 'Cualquier hora', conditions: '',
    },
});

export const getAutomations = async (): Promise<Automation[]> => {
    if (_cache) return _cache;
    try {
        const res = await fetch(`${API_BASE}/automations`);
        if (!res.ok) {
            _cache = [...INITIAL_AUTOMATIONS];
            return _cache;
        }
        const json = await res.json();
        const rows: any[] = json.data ?? [];
        if (rows.length === 0) {
            _cache = [...INITIAL_AUTOMATIONS];
            return _cache;
        }
        _cache = rows.map(mapRow);
        return _cache;
    } catch (e) {
        logger.warn('[Automations] Backend no disponible, usando datos locales:', e);
        return INITIAL_AUTOMATIONS;
    }
};

export const saveAutomation = async (automation: Automation): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/automations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: automation.name,
                enabled: automation.active,
                trigger: automation.trigger,
                canal: automation.channel,
                steps: [automation.config],
            }),
        });
        if (res.ok && _cache) {
            const idx = _cache.findIndex(a => a.id === automation.id);
            if (idx >= 0) _cache[idx] = automation;
            else _cache.push(automation);
        }
        return res.ok;
    } catch (e) {
        logger.error('[Automations] Error al guardar:', e);
        return false;
    }
};

export const toggleAutomation = async (id: string, active: boolean): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/automations/${id}/toggle`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: active }),
        });
        if (res.ok && _cache) {
            const item = _cache.find(a => a.id === id);
            if (item) item.active = active;
        }
        return res.ok;
    } catch (e) {
        logger.error('[Automations] Error al toggle:', e);
        return false;
    }
};
