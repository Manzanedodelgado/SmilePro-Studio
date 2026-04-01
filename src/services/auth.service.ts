// ─────────────────────────────────────────────────────────────────
//  services/auth.service.ts
//  Login contra Node.js Backend 
//
//  ⚠️ SEGURIDAD: Esta versión FALLA si el backend no responde.
//  NO hay fallback ADMIN "indestructible".
//  Para habilitar modo demo explícitamente, usar DEMO_MODE flag.
// ─────────────────────────────────────────────────────────────────

// URL del backend Node.js Express. Lee VITE_API_URL (nombre correcto).
// Fallback a VITE_SUPABASE_URL por compatibilidad con entornos que aún no tengan VITE_API_URL.
const _rawUrl: string =
    String((import.meta as any).env?.VITE_API_URL || '').replace('undefined', '') ??
    (import.meta as any).env?.VITE_SUPABASE_URL ??
    'http://localhost:3000';

const API_BASE_URL: string = _rawUrl.endsWith('/api') ? _rawUrl : `${_rawUrl}/api`;

const headers = {
    'Content-Type': 'application/json',
};

export interface AuthUser {
    id: string;
    email?: string;
    nombre?: string;
    rol?: string;
}

export interface AuthSession {
    access_token: string;
    refresh_token: string;
    expires_at?: string;
    user: AuthUser;
}

// DEMO CREDENTIALS — Solo se usan si explícitamente habilitados en UI
// NO hay "fallback silencioso" a ADMIN
const DEMO_USER = {
    id: 'demo_001',
    email: 'demo@rubiogarciadental.com',
    nombre: 'Demo User',
    rol: 'dentista',  // No admin — datos limitados para demo
};

export const signIn = async (email: string, password: string): Promise<AuthSession | null> => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                const result = data.data;
                return {
                    access_token: result.accessToken,
                    refresh_token: result.refreshToken,
                    user: {
                        id: result.user.id,
                        email: result.user.email,
                        nombre: result.user.name,
                        rol: result.user.role,
                    },
                };
            }
        }

        // Si response.ok es false, devolver null (credenciales inválidas o error del servidor)
        return null;
    } catch (error) {
        // Network error — backend no responde
        // IMPORTANTE: No devolvemos fallback ADMIN
        // Esto es INTENCIONAL para seguridad
        console.error('[Auth] Network error during signIn:', error);
        return null;
    }
};

export const getUser = async (token: string): Promise<AuthUser | null> => {
    if (!token) return null;
    
    // No hay fallback a ADMIN — si el token falla, es null
    if (token === 'demo_token_001') return DEMO_USER;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            headers: {
                ...headers,
                Authorization: `Bearer ${token}`
            },
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                const user = data.data;
                return {
                    id: user.id,
                    email: user.email,
                    nombre: user.name,
                    rol: user.role,
                };
            }
        }
    } catch (error) {
        console.error('[Auth] Network error during getUser:', error);
    }

    // No hay fallback ADMIN — token inválido, error de red, etc. = null
    return null;
};

export const signOut = async (token: string): Promise<boolean> => {
    if (!token || token === 'demo_token_001') return true;
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                ...headers,
                Authorization: `Bearer ${token}`
            },
        });
    } catch (error) {
        console.warn('[Auth] Error during logout:', error);
    }
    return true;
};

/**
 * DEMO MODE EXPLÍCITO (para desarrollo sin backend)
 * 
 * ⚠️ IMPORTANTE: Solo llamar explícitamente desde UI (botón "Modo Demo")
 * NUNCA como fallback automático
 * 
 * @param forceEnable - If true, habilita modo demo. If false, lo desactiva.
 * @returns Demo session si se habilita
 */
export const enableDemoMode = (forceEnable: boolean = true): AuthSession | null => {
    if (!forceEnable) return null;
    
    // Guardar flag en sessionStorage para que otros servicios lo vean
    sessionStorage.setItem('DEMO_MODE_EXPLICIT', 'true');
    
    return {
        access_token: 'demo_token_001',
        refresh_token: 'demo_refresh_001',
        user: DEMO_USER
    };
};

/**
 * Verificar si el usuario está en modo demo
 */
export const isDemoMode = (): boolean => {
    return sessionStorage.getItem('DEMO_MODE_EXPLICIT') === 'true';
};
