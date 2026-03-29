/**
 * romexis-config.service.ts
 * Gestiona la configuración de conexión a Planmeca Romexis (No-IP / web).
 *
 * La clínica accede a Romexis vía: http://HOSTNAME/romexis/romexis
 * La API REST de Romexis vive en:  http://HOSTNAME/romexis/api/
 */

const CFG_KEY = 'smilepro_romexis_host';

export interface RomexisHost {
    /** Hostname No-IP, ej: "clinica.bbddsql.servemp3.com" */
    hostname: string;
    /** Usuario para la API de Romexis (opcional) */
    apiUser?: string;
    /** Contraseña para la API de Romexis (opcional) */
    apiPass?: string;
}

export const getRomexisConfig = (): RomexisHost | null => {
    try {
        const raw = localStorage.getItem(CFG_KEY);
        if (!raw) return null;
        const cfg: RomexisHost = JSON.parse(raw);
        return cfg.hostname ? cfg : null;
    } catch { return null; }
};

export const saveRomexisConfig = (cfg: RomexisHost): void => {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* no-op */ }
};

export const isRomexisReady = (): boolean => Boolean(getRomexisConfig()?.hostname);

/** URL del cliente web de Romexis */
export const getRomexisWebUrl = (): string | null => {
    const cfg = getRomexisConfig();
    return cfg ? `http://${cfg.hostname}/romexis/romexis` : null;
};

/** URL base de la API REST de Romexis */
export const getRomexisApiBase = (): string | null => {
    const cfg = getRomexisConfig();
    return cfg ? `http://${cfg.hostname}/romexis/api` : null;
};

/**
 * Crea un paciente en Romexis vía su API REST.
 * Devuelve el ID de Romexis asignado, o null si falla / no está configurado.
 */
export const syncPatientToRomexis = async (data: {
    nombre: string;
    apellidos: string;
    dni: string;
    fechaNacimiento: string;
    telefono?: string;
}): Promise<string | null> => {
    const cfg = getRomexisConfig();
    if (!cfg) return null;

    const apiBase = getRomexisApiBase()!;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiUser && cfg.apiPass) {
        headers['Authorization'] = `Basic ${btoa(`${cfg.apiUser}:${cfg.apiPass}`)}`;
    }

    try {
        const res = await fetch(`${apiBase}/patients`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                firstName:   data.nombre,
                lastName:    data.apellidos,
                ssn:         data.dni,
                dateOfBirth: data.fechaNacimiento,
                phone:       data.telefono ?? '',
            }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        // Romexis puede devolver { id } o { patientId } según versión
        return json.id ?? json.patientId ?? null;
    } catch {
        return null;
    }
};
