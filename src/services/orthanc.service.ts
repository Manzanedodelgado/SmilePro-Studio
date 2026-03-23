/**
 * orthanc.service.ts — Cliente frontend para Orthanc DICOM Server
 *
 * Orthanc corre localmente en http://localhost:8042
 * OHIF Viewer corre localmente en http://localhost:3001
 *
 * Flujo:
 *  1. uploadDicom(file)  → sube el DICOM a Orthanc via REST
 *  2. Orthanc devuelve el instanceId
 *  3. Obtenemos el StudyInstanceUID
 *  4. Construimos la URL de OHIF y la devolvemos
 *  5. openInOhif(url)    → abre OHIF en nueva ventana
 */

const ORTHANC = 'http://localhost:8042';
const OHIF    = 'http://localhost:3001';

// ── Tipos internos ────────────────────────────────────────────────────────────

interface OrthancInstance {
    ID: string;
    Status: 'Success' | 'AlreadyStored';
    Path: string;
    ParentSeries: string;
    ParentStudy: string;
    ParentPatient: string;
}

interface OrthancTags {
    StudyInstanceUID?: string;
    SeriesInstanceUID?: string;
    SOPInstanceUID?: string;
    PatientName?: string;
    PatientID?: string;
    StudyDate?: string;
    Modality?: string;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Comprueba si Orthanc está corriendo.
 * Timeout de 2 s para no bloquear la UI.
 */
export async function checkOrthancOnline(): Promise<boolean> {
    try {
        const res = await fetch(`${ORTHANC}/system`, {
            signal: AbortSignal.timeout(2000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Sube un archivo DICOM a Orthanc y devuelve la URL de OHIF para ese estudio.
 * Lanza un error si Orthanc no está disponible o la subida falla.
 */
export async function uploadDicomToOrthanc(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();

    // 1. Subir instancia DICOM
    const uploadRes = await fetch(`${ORTHANC}/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/dicom' },
        body: buffer,
    });

    if (!uploadRes.ok) {
        throw new Error(`Orthanc rechazó el archivo: ${uploadRes.status} ${uploadRes.statusText}`);
    }

    const instance = await uploadRes.json() as OrthancInstance;

    // 2. Obtener StudyInstanceUID
    const tagsRes = await fetch(`${ORTHANC}/instances/${instance.ID}/simplified-tags`);
    if (!tagsRes.ok) throw new Error('No se pudo obtener las tags DICOM de Orthanc');

    const tags = await tagsRes.json() as OrthancTags;
    const studyUID = tags.StudyInstanceUID;

    if (!studyUID) throw new Error('El archivo DICOM no contiene StudyInstanceUID');

    return `${OHIF}/viewer?StudyInstanceUIDs=${studyUID}`;
}

/**
 * Abre la URL de OHIF en una nueva ventana/pestaña del navegador.
 */
export function openInOhif(ohifUrl: string): void {
    window.open(ohifUrl, '_blank', 'noopener,noreferrer');
}

/**
 * URL base de la lista de estudios de OHIF (sin StudyInstanceUID).
 */
export const OHIF_URL = OHIF;
export const ORTHANC_URL = ORTHANC;
