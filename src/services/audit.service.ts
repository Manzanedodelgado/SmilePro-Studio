// ─────────────────────────────────────────────────────────────────
//  services/audit.service.ts
//  Audit Trail — fire-and-forget al backend local.
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api/admin';

export type AuditAction =
    | 'LOGIN'
    | 'LOGOUT'
    | 'VIEW_PATIENT'
    | 'SEARCH_PATIENT'
    | 'CREATE_CITA'
    | 'UPDATE_CITA'
    | 'DELETE_CITA'
    | 'UPDATE_ESTADO_CITA'
    | 'SAVE_ODONTOGRAMA'
    | 'CREATE_SOAP_NOTE'
    | 'UPDATE_SOAP_NOTE'
    | 'SAVE_CONFIG'
    | 'UPDATE_STOCK'
    | 'ADD_ALLERGY'
    | 'DELETE_ALLERGY'
    | 'ADD_MEDICATION'
    | 'DELETE_MEDICATION'
    | 'AI_QUERY'
    | 'AI_ANALYZE_ODONTOGRAMA'
    | 'EXPORT_DATA'
    | 'VIEW_GESTORIA'
    | 'VIEW_HISTORIA_CLINICA'
    | 'GENERATE_DOCUMENT'
    | 'SIGN_DOCUMENT'
    | 'VIEW_DOCUMENT'
    | 'REVOKE_CONSENT';

export interface AuditEntry {
    action: AuditAction;
    entity_type?: string;
    entity_id?: string;
    details?: Record<string, any>;
}

interface AuditRow {
    id: string;
    user_id: string;
    user_email: string;
    user_role: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: any;
    created_at: string;
}

let currentUser: { id: string; email: string; role: string } | null = null;

export const setAuditUser = (user: { id: string; email: string; role: string }) => {
    currentUser = user;
};

export const clearAuditUser = () => {
    currentUser = null;
};

export const logAudit = (entry: AuditEntry): void => {
    // Fire-and-forget — no bloquea la UI
    fetch(`${API_BASE}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser?.id ?? 'anonymous',
            user_email: currentUser?.email ?? 'unknown',
            user_role: currentUser?.role ?? 'unknown',
            action: entry.action,
            entity_type: entry.entity_type ?? '',
            entity_id: entry.entity_id ?? '',
            details: entry.details ?? {},
        }),
    }).catch(() => { /* silencioso */ });
};

export const getAuditLog = async (_limit = 50): Promise<AuditRow[]> => {
    try {
        const res = await fetch(`${API_BASE}/audit`);
        if (!res.ok) return [];
        const json = await res.json();
        return json.data ?? [];
    } catch { return []; }
};

export const getAuditByPatient = async (_numPac: string): Promise<AuditRow[]> => {
    // TODO: filtro por paciente cuando el backend lo exponga
    return [];
};
