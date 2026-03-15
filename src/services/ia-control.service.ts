// ─────────────────────────────────────────────────────────────────
//  services/ia-control.service.ts
//  Control del agente IA — backend local (Node.js/Prisma).
//  SIN dependencia de db.ts / backend.
//  TODO: exponer /api/ai/ia-control en el backend cuando se necesite.
// ─────────────────────────────────────────────────────────────────

const PAUSE_MINUTES = 5;

export interface IAControlStatus {
    iaActive: boolean;
    pausedAt: string | null;
    autoResumeAt: string | null;
    minutesLeft: number | null;
}

// Estado en memoria (fallback mientras el backend no expone este endpoint)
const _state = new Map<string, { iaActive: boolean; pausedAt: string | null; autoResumeAt: string | null }>();

export const getIAStatus = async (conversationId: string | number): Promise<IAControlStatus> => {
    const key = String(conversationId);
    const s = _state.get(key);
    if (!s) return { iaActive: true, pausedAt: null, autoResumeAt: null, minutesLeft: null };

    let { iaActive, pausedAt, autoResumeAt } = s;
    let minutesLeft: number | null = null;

    if (!iaActive && autoResumeAt) {
        const resumeTime = new Date(autoResumeAt).getTime();
        const now = Date.now();
        if (resumeTime <= now) {
            _state.set(key, { iaActive: true, pausedAt: null, autoResumeAt: null });
            iaActive = true;
        } else {
            minutesLeft = Math.ceil((resumeTime - now) / 60000);
        }
    }

    return { iaActive, pausedAt, autoResumeAt, minutesLeft };
};

export const pauseIA = async (conversationId: string | number, _pausedBy?: string): Promise<boolean> => {
    const now = new Date();
    const autoResumeAt = new Date(now.getTime() + PAUSE_MINUTES * 60 * 1000).toISOString();
    _state.set(String(conversationId), { iaActive: false, pausedAt: now.toISOString(), autoResumeAt });
    return true;
};

export const resumeIA = async (conversationId: string | number): Promise<boolean> => {
    _state.set(String(conversationId), { iaActive: true, pausedAt: null, autoResumeAt: null });
    return true;
};
