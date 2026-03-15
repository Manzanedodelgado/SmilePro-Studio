import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, getUser, signOut as sbSignOut } from '../services/auth.service';
import { setAuditUser, clearAuditUser } from '../services/audit.service';
import { setSessionToken } from '../services/db';

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (token: string, user: AuthUser, refreshToken: string) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const savedToken = sessionStorage.getItem('sb_auth_token');
            if (savedToken) {
                try {
                    // SEC-C02 FIX: Validar token contra el servidor — no solo verificar sessionStorage
                    const validatedUser = await getUser(savedToken);
                    if (validatedUser) {
                        setToken(savedToken);
                        setUser(validatedUser);
                        // Conectar JWT a db.ts — queries correrán como rol authenticated
                        setSessionToken(savedToken);
                        sessionStorage.setItem('sb_auth_user', JSON.stringify(validatedUser));
                        // VLN-009 FIX: restaurar contexto de audit al recargar
                        setAuditUser({
                            id: validatedUser.id,
                            email: validatedUser.email ?? 'unknown',
                            role: (validatedUser as any).rol ?? 'user',
                        });
                    } else {
                        // Token expirado o revocado — limpiar sesión
                        sessionStorage.removeItem('sb_auth_token');
                        sessionStorage.removeItem('sb_refresh_token');
                        sessionStorage.removeItem('sb_auth_user');
                    }
                } catch {
                    // Error de red — sesión local como fallback (no silencioso: logged)
                    console.warn('[Auth] No se pudo validar token con el servidor. Usando sesión local como fallback temporal.');
                    const savedUserStr = sessionStorage.getItem('sb_auth_user');
                    if (savedUserStr) {
                        try {
                            const savedUser: AuthUser = JSON.parse(savedUserStr);
                            setToken(savedToken);
                            setUser(savedUser);
                            setSessionToken(savedToken); // fallback JWT — mejor que anon
                        } catch { /* JSON inválido */ }
                    }
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = (newToken: string, newUser: AuthUser, refreshToken: string) => {
        setToken(newToken);
        setUser(newUser);
        // Conectar JWT a db.ts inmediatamente — todas las queries posteriores serán authenticated
        setSessionToken(newToken);
        sessionStorage.setItem('sb_auth_token', newToken);
        sessionStorage.setItem('sb_refresh_token', refreshToken);
        sessionStorage.setItem('sb_auth_user', JSON.stringify(newUser));
        setAuditUser({
            id: newUser.id,
            email: newUser.email ?? 'unknown',
            role: (newUser as any).rol ?? 'user',
        });
    };

    const logout = async () => {
        if (token) await sbSignOut(token);
        clearAuditUser();
        setSessionToken(null);  // borrar JWT — queries vuelven a anon (sin acceso a FDW)
        setToken(null);
        setUser(null);
        sessionStorage.removeItem('sb_auth_token');
        sessionStorage.removeItem('sb_refresh_token');
        sessionStorage.removeItem('sb_auth_user');
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isAuthenticated: !!user,
            loading,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
