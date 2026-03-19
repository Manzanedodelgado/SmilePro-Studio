// ─────────────────────────────────────────────────────────────────
//  services/gdrive.service.ts  (FRONTEND)
//  Capa frontend de integración con Google Drive.
//  Ahora llama al backend proxy en lugar de usar
//  VITE_GDRIVE_API_KEY directamente.
//
//  Backend: GET /api/gdrive/photos/:numPac?apellidos=&nombre=
// ─────────────────────────────────────────────────────────────────

import { authFetch } from './db';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

export const isGDriveConfigured = (): boolean => true; // Siempre activo via backend proxy

// ── Tipos ──────────────────────────────────────────────────────

export interface PatientPhoto {
    id: string;
    name: string;
    label: string;
    date: string;
    url: string;
    thumbnail: string;
    mimeType?: string;
}

// ── Mock data (fallback si el backend no responde) ─────────────

const MOCK_PHOTOS: PatientPhoto[] = [
    {
        id: 'mock-001', name: 'frente_2024-03.jpg', label: 'Frente',
        date: 'Mar 2024',
        url: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&q=80&w=800',
        thumbnail: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&q=80&w=200',
    },
];

// ── Obtener fotos del paciente (via backend proxy) ─────────────

export const getPatientPhotos = async (
    numPac: string,
    apellidos = '',
    nombre = ''
): Promise<PatientPhoto[]> => {
    if (!numPac) return MOCK_PHOTOS;

    try {
        const params = new URLSearchParams({ apellidos, nombre });
        const res = await authFetch(
            `${API_BASE}/api/gdrive/photos/${encodeURIComponent(numPac)}?${params}`
        );

        if (!res.ok) return MOCK_PHOTOS;
        const json = await res.json();
        const photos: PatientPhoto[] = json.data ?? [];
        return photos.length > 0 ? photos : [];
    } catch {
        return MOCK_PHOTOS;
    }
};

// ── Crear carpeta de paciente en Drive (via backend) ───────────

export const createPatientDriveFolder = async (
    numPac: string,
    apellidos: string,
    nombre: string
): Promise<{ id: string; name: string; url: string } | null> => {
    try {
        const res = await authFetch(`${API_BASE}/api/gdrive/patient-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numPac, apellidos, nombre }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data ?? null;
    } catch {
        return null;
    }
};

// ── Upload (requiere OAuth, pendiente de implementar) ──────────

export const uploadPatientPhoto = async (
    _patientId: string,
    _file: File
): Promise<boolean> => {
    console.warn('[GDrive] Upload aún no implementado vía backend OAuth2');
    return false;
};
