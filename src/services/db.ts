/// <reference types="vite/client" />
// ─────────────────────────────────────────────────────────────────
//  services/db.ts
//  LEGACY — Helper base para operaciones REST.                    
//  Actualmente NINGUNO de los servicios de negocio lo importa.    
//  Las operaciones de datos van directamente al backend Node.js    
//  (VITE_API_URL = http://localhost:3000).                         
// ─────────────────────────────────────────────────────────────────

// URL real del backend Node.js
const API_URL: string = (import.meta as any).env?.VITE_API_URL
    ?? (import.meta as any).env?.VITE__legacyUrl
    ?? 'http://localhost:3000';

// Mantenidas por compatibilidad con rutas heredadas de backend REST (no en uso activo)
const _legacyUrl: string = API_URL;
const _legacyAnonKey: string = (import.meta as any).env?.VITE__legacyAnonKey ?? '';
const _legacySvcKey: string = (import.meta as any).env?.VITE__legacySvcKey ?? '';
const USE_FDW_PROXY = false;

console.info(`[DB] Backend → ${API_URL}`);

// isDbConfigured: devuelve true si el backend Node.js está disponible
export const isDbConfigured = (): boolean => Boolean(API_URL);

// Tablas FDW de GELITE
const FDW_TABLES = new Set([
    'Pacientes', 'DCitas', 'TtosMed', 'PRESUTTO', 'NV_CabFactura',
    'TColabos', 'TArticulo', 'StckMov', 'BancoMov',
    'IconoTratAgenda', 'TSitCita', 'TUsuAgd', 'NV_LinFactura', 'FormPago',
]);

const isFdwTable = (path: string): boolean =>
    FDW_TABLES.has(path.split('?')[0]);

// ── Polyfill crypto.randomUUID ───────────────────────────────────
export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

export const fetchWithTimeout = (
    url: string,
    opts: RequestInit = {},
    timeoutMs = 30_000
): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
};

const buildQueryString = (params?: Record<string, string>): string => {
    if (!params) return '';
    return Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
};

/**
 * FDW via Edge Function proxy (seguro — SERVICE_ROLE_KEY solo en servidor).
 * Usar cuando USE_FDW_PROXY = true y la función esté desplegada.
 */
const dbFetchFDWProxy = (table: string, params?: Record<string, string>): Promise<Response> => {
    const queryString = buildQueryString(params);
    return fetchWithTimeout(`${_legacyUrl}/functions/v1/fdw-proxy`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${_legacyAnonKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ table, queryString }),
    });
};

/**
 * FDW directo con service_role (fallback temporal hasta desplegar fdw-proxy).
 */
const dbFetchFDWDirect = (table: string, params?: Record<string, string>): Promise<Response> => {
    const url = new URL(`${_legacyUrl}/rest/v1/${table}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return fetchWithTimeout(url.toString(), {
        headers: {
            apikey: _legacyAnonKey,
            Authorization: `Bearer ${_legacySvcKey}`,
            'Content-Type': 'application/json',
        },
    });
};


/** Fetch genérico contra backend REST v1 (tablas nativas) */
export const dbFetch = async (
    path: string,
    options?: RequestInit & { params?: Record<string, string> }
): Promise<Response> => {
    if (!isDbConfigured()) throw new Error('Backend no configurado');

    // Tablas FDW → proxy seguro (cuando desplegado) o directo con service_role (fallback)
    if (isFdwTable(path)) {
        const tableName = path.split('?')[0];
        return USE_FDW_PROXY
            ? dbFetchFDWProxy(tableName, options?.params)
            : dbFetchFDWDirect(tableName, options?.params);
    }

    // Tablas nativas → PostgREST directo con anon key
    const base = `${_legacyUrl}/rest/v1/${path}`;
    const url = new URL(base);
    if (options?.params) {
        Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    return fetch(url.toString(), {
        ...options,
        headers: {
            apikey: _legacyAnonKey,
            Authorization: `Bearer ${_legacyAnonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
            ...(options?.headers ?? {}),
        },
    });
};

/** SELECT */
export const dbSelect = async <T>(
    table: string,
    params?: Record<string, string>
): Promise<T[]> => {
    if (!isDbConfigured()) return [];
    const fixedParams = params ? Object.fromEntries(
        Object.entries(params).map(([k, v]) =>
            k === 'or' && !v.startsWith('(') ? [k, `(${v})`] : [k, v]
        )
    ) : params;
    const res = await dbFetch(table, { params: fixedParams });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[DB] SELECT ${table} error:`, text);
        return [];
    }
    return res.json();
};

/** INSERT */
export const dbInsert = async <T>(
    table: string,
    body: Partial<T>
): Promise<T | null> => {
    if (!isDbConfigured()) return { ...body, id: generateId() } as T;
    const res = await dbFetch(table, { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) { console.error(`[DB] INSERT ${table}:`, await res.text()); return null; }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
};

/** UPDATE */
export const dbUpdate = async <T>(
    table: string,
    id: string,
    body: Partial<T>,
    idColumn: string = 'id'
): Promise<T | null> => {
    if (!isDbConfigured()) return { ...body, [idColumn]: id } as unknown as T;
    const res = await dbFetch(`${table}?${idColumn}=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
    if (!res.ok) { console.error(`[DB] UPDATE ${table}:`, await res.text()); return null; }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
};

/** DELETE */
export const dbDelete = async (
    table: string,
    id: string,
    idColumn: string = 'id'
): Promise<boolean> => {
    if (!isDbConfigured()) return true;
    const res = await dbFetch(`${table}?${idColumn}=eq.${id}`, { method: 'DELETE' });
    return res.ok;
};

/** UPSERT — INSERT con ON CONFLICT DO UPDATE (usa la preferencia de PostgREST) */
export const dbUpsert = async <T>(
    table: string,
    body: Partial<T>,
    onConflict?: string
): Promise<T | null> => {
    if (!isDbConfigured()) return { ...body, id: generateId() } as T;
    const prefer = onConflict
        ? `resolution=merge-duplicates`
        : `resolution=merge-duplicates`;
    const res = await dbFetch(
        onConflict ? `${table}?on_conflict=${onConflict}` : table,
        {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                Prefer: `return=representation,${prefer}`,
            },
        }
    );
    if (!res.ok) { console.error(`[DB] UPSERT ${table}:`, await res.text()); return null; }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
};

// Sesión (legacy — compatibilidad; el token no se usa en este servicio REST)
export const setSessionToken = (_token: string | null): void => { /* no-op */ };
