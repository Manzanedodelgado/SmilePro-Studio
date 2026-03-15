// ─────────────────────────────────────────────────────────────────
//  services/ia-control.service.ts
//  F-004 FIX: Control del agente IA — ahora persiste en /api/ai/ia-control
// ─────────────────────────────────────────────────────────────────
import { authFetch } from './db';

export interface IAControlStatus {
    iaActive: boolean;
    pausedAt: string | null;
    autoResumeAt: string | null;
    minutesLeft: number | null;
}

export const getIAStatus = async (conversationId: string | number): Promise<IAControlStatus> => {
    try {
        const res = await authFetch(`/api/ai/ia-control/${conversationId}`);
        if (!res.ok) return { iaActive: true, pausedAt: null, autoResumeAt: null, minutesLeft: null };
        const json = await res.json();
        return json.data ?? { iaActive: true, pausedAt: null, autoResumeAt: null, minutesLeft: null };
    } catch {
        return { iaActive: true, pausedAt: null, autoResumeAt: null, minutesLeft: null };
    }
};

export const pauseIA = async (conversationId: string | number, _pausedBy?: string): Promise<boolean> => {
    try {
        const res = await authFetch(`/api/ai/ia-control/${conversationId}/pause`, { method: 'POST' });
        return res.ok;
    } catch {
        return false;
    }
};

export const resumeIA = async (conversationId: string | number): Promise<boolean> => {
    try {
        const res = await authFetch(`/api/ai/ia-control/${conversationId}/resume`, { method: 'POST' });
        return res.ok;
    } catch {
        return false;
    }
};
