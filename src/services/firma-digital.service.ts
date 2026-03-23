// ─────────────────────────────────────────────────────────────────
//  services/firma-digital.service.ts
//  Gestión de firma digital del doctor: setup, almacenamiento y aplicación.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';

const LS_KEY = 'smilepro:firmas-doctor';

export interface FirmaDoctor {
    doctorId: string;
    doctorNombre: string;
    firmaBase64: string;     // PNG en base64
    fechaCreacion: string;
}

// ── Storage helpers ───────────────────────────────────────────────

function loadFirmas(): Record<string, FirmaDoctor> {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function saveFirmas(data: Record<string, FirmaDoctor>): void {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Comprueba si el doctor ya tiene firma configurada.
 */
export function hasDoctorSignature(doctorId: string): boolean {
    const firmas = loadFirmas();
    return !!firmas[doctorId]?.firmaBase64;
}

/**
 * Obtiene la firma del doctor como base64 PNG.
 */
export function getDoctorSignature(doctorId: string): string | null {
    const firmas = loadFirmas();
    return firmas[doctorId]?.firmaBase64 ?? null;
}

/**
 * Guarda la firma del doctor.
 * Se llama desde el componente de setup (canvas de firma).
 */
export function saveDoctorSignature(doctorId: string, doctorNombre: string, firmaBase64: string): void {
    const firmas = loadFirmas();
    firmas[doctorId] = {
        doctorId,
        doctorNombre,
        firmaBase64,
        fechaCreacion: new Date().toISOString(),
    };
    saveFirmas(firmas);
    logger.info(`[FIRMA] Firma digital guardada para ${doctorNombre} (${doctorId})`);
}

/**
 * Elimina la firma de un doctor.
 */
export function deleteDoctorSignature(doctorId: string): void {
    const firmas = loadFirmas();
    delete firmas[doctorId];
    saveFirmas(firmas);
}

/**
 * Aplica la firma del doctor a un documento HTML.
 * Inserta la imagen de firma en el HTML antes de imprimirlo.
 */
export function applySignatureToHTML(html: string, doctorId: string): string {
    const firma = getDoctorSignature(doctorId);
    if (!firma) return html;

    // Inserta la firma antes del cierre del body o al final
    const firmaImg = `
        <div style="margin-top: 20px; text-align: left;">
            <p style="margin-bottom: 4px; font-size: 11px; color: #666;">Firma digital:</p>
            <img src="${firma}" alt="Firma del doctor" style="max-width: 200px; height: auto;" />
        </div>`;

    if (html.includes('</body>')) {
        return html.replace('</body>', `${firmaImg}</body>`);
    }
    return html + firmaImg;
}

/**
 * Genera la URL para el componente de configuración de firma.
 * En la implementación actual, se abre como modal en la app.
 */
export function getSignatureSetupUrl(doctorId: string): string {
    return `#/configuracion/firma?doctorId=${encodeURIComponent(doctorId)}`;
}
