// ─────────────────────────────────────────────────────────────────────
//  backend/src/modules/gdrive/gdrive.service.ts
//  Google Drive — gestión de carpetas de pacientes
//  Autenticación: Service Account (recomendado) o API Key (solo lectura).
//
//  Carpeta raíz: 1R0xewRUWYnLfakIMwhsdhl1R76kb-cno
//  Estructura: <raíz>/ {NumPac} — {Apellidos}, {Nombre} /
//
//  POST /api/gdrive/patient-folder     → crear carpeta para 1 paciente
//  POST /api/gdrive/bulk-create        → crear carpetas masivas (paginado)
//  GET  /api/gdrive/patient/:numPac    → listar fotos de un paciente
// ─────────────────────────────────────────────────────────────────────
import { logger } from '../../config/logger.js';

const ROOT_FOLDER = process.env.GDRIVE_FOLDER_ID ?? '1R0xewRUWYnLfakIMwhsdhl1R76kb-cno';

// ── Obtener Access Token via Service Account ──────────────────────────
// Si GDRIVE_SA_KEY_JSON está configurado (JSON de SA), se usa OAuth2 SA.
// Si no, usamos el access_token que manda el cliente (usuario logado con Google).

let _saTokenCache: { token: string; exp: number } | null = null;

// Caché de folder IDs por paciente — evita buscar la carpeta en cada carga
const _folderIdCache = new Map<string, string>();

export const getSAAccessToken = async (): Promise<string | null> => {
    const saKeyJson = process.env.GDRIVE_SA_KEY_JSON;
    if (!saKeyJson) return null;

    // Reutilizar token si sigue válido (exp - 60s de margen)
    if (_saTokenCache && _saTokenCache.exp > Date.now() / 1000 + 60) {
        return _saTokenCache.token;
    }

    try {
        let sa;
        try {
            sa = JSON.parse(saKeyJson);  // raw JSON
        } catch {
            sa = JSON.parse(Buffer.from(saKeyJson, 'base64').toString('utf-8'));  // base64
        }

        // JWT para Service Account
        const { createSign } = await import('node:crypto');
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const claim = Buffer.from(JSON.stringify({
            iss: sa.client_email,
            scope: 'https://www.googleapis.com/auth/drive',
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
        })).toString('base64url');

        const sign = createSign('RSA-SHA256');
        sign.update(`${header}.${claim}`);
        const sig = sign.sign(sa.private_key, 'base64url');
        const jwt = `${header}.${claim}.${sig}`;

        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }).toString(),
        });

        if (!res.ok) {
            logger.error('[GDrive SA] Token error:', await res.text());
            return null;
        }

        const json = await res.json() as { access_token: string; expires_in: number };
        _saTokenCache = { token: json.access_token, exp: now + json.expires_in };
        return json.access_token;
    } catch (e) {
        logger.error('[GDrive SA] JWT error:', e);
        return null;
    }
};

// ── Helper: headers Drive API ──────────────────────────────────────────
const driveHeaders = async (userToken?: string): Promise<Record<string, string>> => {
    const token = userToken ?? await getSAAccessToken();
    if (!token) throw new Error('No hay token de Google Drive disponible. Configura GDRIVE_SA_KEY_JSON o proporciona un token de usuario.');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
};

// ── Nombre canónico de carpeta de paciente ─────────────────────────────
export const folderName = (numPac: string, apellidos: string, nombre: string): string =>
    `${numPac} — ${apellidos.trim().toUpperCase()}, ${nombre.trim()}`;

// ── Crear carpeta Drive para 1 paciente ───────────────────────────────
export const createPatientFolder = async (
    numPac: string,
    apellidos: string,
    nombre: string,
    userToken?: string
): Promise<{ id: string; name: string; url: string } | null> => {
    try {
        const name = folderName(numPac, apellidos, nombre);

        // ¿Ya existe?
        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?` + new URLSearchParams({
                q: `'${ROOT_FOLDER}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id,name)',
                pageSize: '1',
            }),
            { headers: await driveHeaders(userToken) }
        );

        if (searchRes.ok) {
            const searchJson = await searchRes.json() as { files: { id: string; name: string }[] };
            if (searchJson.files?.[0]) {
                const existing = searchJson.files[0];
                logger.info(`[GDrive] Carpeta ya existe: ${existing.name}`);
                return { id: existing.id, name: existing.name, url: `https://drive.google.com/drive/folders/${existing.id}` };
            }
        }

        // Crear nueva
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: await driveHeaders(userToken),
            body: JSON.stringify({
                name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [ROOT_FOLDER],
            }),
        });

        if (!createRes.ok) {
            const err = await createRes.text();
            logger.error(`[GDrive] Error creando carpeta "${name}":`, err);
            return null;
        }

        const folder = await createRes.json() as { id: string; name: string };
        logger.info(`[GDrive] Carpeta creada: ${folder.name} (${folder.id})`);
        return { id: folder.id, name: folder.name, url: `https://drive.google.com/drive/folders/${folder.id}` };
    } catch (e) {
        logger.error('[GDrive] createPatientFolder error:', e);
        return null;
    }
};

// ── Listar fotos de carpeta de paciente ───────────────────────────────
export const getPatientPhotos = async (
    numPac: string,
    apellidos: string,
    nombre: string,
    userToken?: string
): Promise<{ id: string; name: string; label: string; date: string; url: string; thumbnail: string }[]> => {
    try {
        const name = folderName(numPac, apellidos, nombre);

        // Buscar carpeta del paciente (con caché para evitar llamada extra)
        let folderId = _folderIdCache.get(numPac);
        if (!folderId) {
            const folderRes = await fetch(
                `https://www.googleapis.com/drive/v3/files?` + new URLSearchParams({
                    q: `'${ROOT_FOLDER}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder'`,
                    fields: 'files(id)',
                    pageSize: '1',
                }),
                { headers: await driveHeaders(userToken) }
            );

            if (!folderRes.ok) return [];
            const folderJson = await folderRes.json() as { files: { id: string }[] };
            folderId = folderJson.files?.[0]?.id;
            if (!folderId) return [];
            _folderIdCache.set(numPac, folderId);
        }

        // Listar imágenes
        const filesRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?` + new URLSearchParams({
                q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
                fields: 'files(id,name,createdTime,mimeType)',
                orderBy: 'createdTime desc',
                pageSize: '50',
            }),
            { headers: await driveHeaders(userToken) }
        );

        if (!filesRes.ok) return [];
        const filesJson = await filesRes.json() as { files: { id: string; name: string; createdTime: string; mimeType: string }[] };

        return (filesJson.files ?? []).map(f => ({
            id: f.id,
            name: f.name,
            label: labelFromName(f.name),
            date: new Date(f.createdTime).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
            url: `/api/gdrive/image/${f.id}`,
            thumbnail: `/api/gdrive/image/${f.id}?sz=w400`,
            mimeType: f.mimeType,
        }));
    } catch (e) {
        logger.error('[GDrive] getPatientPhotos error:', e);
        return [];
    }
};

const labelFromName = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('frente') || n.includes('front')) return 'Frente';
    if (n.includes('derecho') || n.includes('derecha') || n.includes('right')) return 'Derecha';
    if (n.includes('izquierd') || n.includes('left')) return 'Izquierda';
    if (n.includes('superior') || n.includes('upper')) return 'Superior';
    if (n.includes('inferior') || n.includes('lower')) return 'Inferior';
    if (n.includes('oclusal') || n.includes('occlusal')) return 'Oclusal';
    return name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
};
