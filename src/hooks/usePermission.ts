// ─────────────────────────────────────────────────────────────────
//  hooks/usePermission.ts
//  VLN-012 FIX: RBAC — Control de acceso por rol en frontend.
//  Uso: const canEdit = usePermission('edit_odontograma');
// ─────────────────────────────────────────────────────────────────
import { useAuth } from '../context/AuthContext';

// Acciones posibles en el sistema
export type PermissionAction =
    | 'view_historia_clinica'
    | 'edit_odontograma'
    | 'view_odontograma'
    | 'view_gestoria'
    | 'edit_gestoria'
    | 'view_inventario'
    | 'edit_inventario'
    | 'view_agenda'
    | 'edit_agenda'
    | 'view_pacientes'
    | 'view_whatsapp'
    | 'send_whatsapp'
    | 'view_ia'
    | 'view_audit_log'
    | 'admin_panel';

// Roles del sistema
type Rol = 'admin' | 'dentista' | 'recepcion' | 'higienista';

// Matriz ACL: acción → roles permitidos
const ACL: Record<PermissionAction, Rol[]> = {
    view_historia_clinica: ['admin', 'dentista', 'higienista'],
    edit_odontograma: ['admin', 'dentista'],
    view_odontograma: ['admin', 'dentista', 'higienista'],
    view_gestoria: ['admin', 'recepcion'],
    edit_gestoria: ['admin'],
    view_inventario: ['admin'],
    edit_inventario: ['admin'],
    view_agenda: ['admin', 'dentista', 'recepcion', 'higienista'],
    edit_agenda: ['admin', 'dentista', 'recepcion'],
    view_pacientes: ['admin', 'dentista', 'recepcion', 'higienista'],
    view_whatsapp: ['admin', 'recepcion'],
    send_whatsapp: ['admin', 'recepcion'],
    view_ia: ['admin', 'dentista'],
    view_audit_log: ['admin'],
    admin_panel: ['admin'],
};

/**
 * Hook para verificar permisos del usuario actual según su rol.
 * Devuelve true si el usuario puede realizar la acción.
 * Por defecto deniega si el rol es desconocido.
 */
export const usePermission = (action: PermissionAction): boolean => {
    const { user } = useAuth();
    const rol = (((user as any)?.rol ?? 'recepcion') as string).toLowerCase() as Rol;
    return ACL[action]?.includes(rol) ?? false;
};

/**
 * Versión imperativa (sin hook) para usar en servicios.
 */
export const hasPermission = (rol: string, action: PermissionAction): boolean => {
    return ACL[action]?.includes(rol.toLowerCase() as Rol) ?? false;
};
