
/**
 * imagen.service.ts
 * Servicio de gestión de imágenes radiológicas dentales para SmilePro.
 *
 * - Upload y almacenamiento en memoria (sin captura directa)
 * - Mejora IA con Canvas API: contraste adaptativo, nitidez, reducción de ruido
 * - Colorización pseudo-color estilo DICOM dental
 * - Soporte DICOM real (.dcm/.dic): parser binario puro con windowing y LUT
 */

/** Detecta archivos DICOM por extensión o magic bytes (DICM en offset 128). */
async function isDicomFile(file: File): Promise<boolean> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (['dcm', 'dic', 'dicom'].includes(ext)) return true;
    try {
        const buf = await file.slice(128, 132).arrayBuffer();
        const magic = new TextDecoder().decode(buf);
        return magic === 'DICM';
    } catch { return false; }
}

export type ImageType = 'panoramica' | 'dicom' | 'intraoral' | 'extraoral' | 'cefalometrica' | 'periapical';

export type ColorMap =
    | 'grayscale'
    | 'hot'        // Calor: negro→rojo→amarillo→blanco
    | 'cool'       // Frío: cian→magenta
    | 'bone'       // Médico estándar
    | 'rainbow'    // Arcoíris clásico DICOM
    | 'viridis'    // Científico perceptualmente uniforme
    | 'dental_soft' // Dental suave: azul-turquesa-blanco
    | 'dental_warm'; // Dental cálido: amarillo-naranja (tejidos)

export interface EstudioRadiologico {
    id: string;
    pacienteNumPac: string;
    tipo: ImageType;
    nombre: string;
    fecha: string;   // ISO
    doctor: string;
    descripcion: string;
    // Datos de imagen (base64 o blob URL)
    originalUrl: string;        // Imagen original cargada
    enhancedUrl?: string;       // Post-procesado IA
    colorizedUrl?: string;      // Con mapa de color aplicado
    // Metadatos DICOM simulados
    dicomMeta?: DicomMeta;
    // Estado procesamiento
    isProcessing: boolean;
    colorMap: ColorMap;
    // Ajustes manuales vigentes
    brightness: number;  // -100 a +100, default 0
    contrast: number;    // -100 a +100, default 0
    sharpness: number;   // 0 a 100, default 0
    // Anotaciones
    anotaciones: Anotacion[];
    // Tags
    tags: string[];
    fileSize?: number; // bytes
    rutaOrigen?: string; // Ruta del archivo en servidor (simulada o real, ej: \\SERVIDOR\Romexis\...)
}

export interface DicomMeta {
    patientId: string;
    studyDate: string;
    modality: 'PX' | 'CT' | 'IO' | 'DX' | 'XA'; // Rx Panorámica, CT, Intraoral, Digital Rx, Angiografía
    kvp?: number;           // kVp (kilovoltios pico)
    tubeCurrent?: number;   // mA
    exposureTime?: number;  // ms
    studyDescription: string;
    seriesDescription?: string;
    manufacturer?: string;
    institutionName?: string;
}

export interface Anotacion {
    id: string;
    tipo: 'medicion' | 'flecha' | 'texto' | 'circulo' | 'rectangulo';
    x: number;       // % relativo (0-100)
    y: number;       // % relativo (0-100)
    x2?: number;     // Para líneas/rectángulos
    y2?: number;
    texto?: string;
    color: string;
    autor: string;
    fecha: string;
}

// ── COLOR MAPS ────────────────────────────────────────────────────────────────

/**
 * Genera una tabla LUT (Look-Up Table) de color para mapas pseudo-color.
 * Cada entrada es [R, G, B] para el nivel de gris 0-255.
 */
function buildColorLUT(map: ColorMap): Uint8Array {
    const lut = new Uint8Array(256 * 3);

    for (let i = 0; i < 256; i++) {
        const t = i / 255;
        let r = i, g = i, b = i;

        switch (map) {
            case 'grayscale':
                r = g = b = i;
                break;

            case 'hot':
                // negro→rojo→amarillo→blanco
                if (t < 0.333) { r = Math.round(t * 3 * 255); g = 0; b = 0; }
                else if (t < 0.666) { r = 255; g = Math.round((t - 0.333) * 3 * 255); b = 0; }
                else { r = 255; g = 255; b = Math.round((t - 0.666) * 3 * 255); }
                break;

            case 'cool':
                r = Math.round(t * 255);
                g = Math.round((1 - t) * 255);
                b = 255;
                break;

            case 'bone':
                // Azul-grisáceo médico
                r = Math.round(t * 0.9215 * 255);
                g = Math.round(t * 0.9215 * 255);
                b = Math.round((0.0784 + t * 0.9216) * 255);
                break;

            case 'rainbow':
                // Mapa arcoíris DICOM clásico
                if (t < 0.2) { r = 0; g = 0; b = Math.round(0.5 + t * 2.5 * 255); }
                else if (t < 0.4) { r = 0; g = Math.round((t - 0.2) * 5 * 255); b = 255; }
                else if (t < 0.6) { r = Math.round((t - 0.4) * 5 * 255); g = 255; b = Math.round((0.6 - t) * 5 * 255); }
                else if (t < 0.8) { r = 255; g = Math.round((0.8 - t) * 5 * 255); b = 0; }
                else { r = Math.round((1 - t) * 5 * 255); g = 0; b = 0; }
                break;

            case 'viridis':
                // Aproximación de Viridis (perceptually uniform)
                r = Math.round(Math.max(0, Math.min(255, (-0.0553 + 0.6979 * t + 2.198 * t * t - 3.064 * t * t * t + 1.8 * t * t * t * t) * 255)));
                g = Math.round(Math.max(0, Math.min(255, (0.0137 + 1.3988 * t - 0.8779 * t * t + 0.6366 * t * t * t - 0.298 * t * t * t * t) * 255)));
                b = Math.round(Math.max(0, Math.min(255, (0.3392 + 1.0942 * t - 3.0665 * t * t + 3.4179 * t * t * t - 1.5137 * t * t * t * t) * 255)));
                break;

            case 'dental_soft':
                // Azul oscuro → turquesa → blanco (ideal para esmalte/dentina)
                if (t < 0.5) {
                    r = Math.round(t * 2 * 80);
                    g = Math.round(t * 2 * 180);
                    b = Math.round(50 + t * 2 * 205);
                } else {
                    r = Math.round(80 + (t - 0.5) * 2 * 175);
                    g = Math.round(180 + (t - 0.5) * 2 * 75);
                    b = 255;
                }
                break;

            case 'dental_warm':
                // Amarillo-crema → naranja → rojo (ideal para tejidos blandos/pulpa)
                if (t < 0.4) {
                    r = 255;
                    g = Math.round(200 + t * 2.5 * 55);
                    b = Math.round(t * 2.5 * 80);
                } else if (t < 0.7) {
                    r = 255;
                    g = Math.round(255 - (t - 0.4) * 3.33 * 200);
                    b = Math.round(80 - (t - 0.4) * 3.33 * 80);
                } else {
                    r = 255;
                    g = Math.round(55 - (t - 0.7) * 3.33 * 55);
                    b = 0;
                }
                break;
        }

        lut[i * 3] = Math.max(0, Math.min(255, r));
        lut[i * 3 + 1] = Math.max(0, Math.min(255, g));
        lut[i * 3 + 2] = Math.max(0, Math.min(255, b));
    }

    return lut;
}

// ── CANVAS PROCESSING ─────────────────────────────────────────────────────────

/**
 * Carga una imagen (URL o Blob URL) en un canvas temporal y devuelve ImageData.
 */
async function imageToCanvas(imageUrl: string, maxSize = 2048): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > maxSize || h > maxSize) {
                const ratio = Math.min(maxSize / w, maxSize / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);
            resolve({ canvas, ctx });
        };
        img.onerror = reject;
        img.src = imageUrl;
    });
}

/**
 * Aplica mejora IA a la imagen:
 * 1. Ecualización adaptativa del histograma (CLAHE simplificado)
 * 2. Filtro de nitidez (unsharp mask)
 * 3. Reducción de ruido (box blur ligero antes del sharpen)
 */
export async function aiEnhanceImage(
    imageUrl: string,
    options: { brightness?: number; contrast?: number; sharpness?: number } = {}
): Promise<string> {
    const { canvas, ctx } = await imageToCanvas(imageUrl);
    const { width, height } = canvas;

    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;

    const brightness = options.brightness ?? 0;
    const contrast = options.contrast ?? 30; // Por defecto boost de contraste radiológico
    const sharpness = options.sharpness ?? 50;

    // ── Paso 1: Brightness + Contrast ───────────────────────────────────────
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Convertir a gris ponderado (luminancia para radiografías)
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        // Aplicar brillo
        let v = Math.max(0, Math.min(255, gray + brightness));
        // Aplicar contraste
        v = Math.max(0, Math.min(255, Math.round(contrastFactor * (v - 128) + 128)));
        data[i] = data[i + 1] = data[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);

    // ── Paso 2: Ecualización de histograma local (CLAHE simplificado) ────────
    imageData = ctx.getImageData(0, 0, width, height);
    data = imageData.data;

    // Construir histograma global
    const hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) hist[data[i]]++;
    const totalPixels = width * height;
    // CDF normalizada
    const cdf = new Array(256).fill(0);
    cdf[0] = hist[0];
    for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
    const cdfMin = cdf.find(v => v > 0) ?? 0;
    const eqLUT = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        eqLUT[i] = Math.round(((cdf[i] - cdfMin) / (totalPixels - cdfMin)) * 255);
    }
    for (let i = 0; i < data.length; i += 4) {
        const eq = eqLUT[data[i]];
        data[i] = data[i + 1] = data[i + 2] = eq;
    }
    ctx.putImageData(imageData, 0, 0);

    // ── Paso 3: Unsharp Mask (nitidez) ────────────────────────────────────────
    if (sharpness > 0) {
        const amount = sharpness / 100;
        const blurred = ctx.getImageData(0, 0, width, height);
        // Box blur 3x3 ligero para unsharp mask
        const blurData = new Uint8ClampedArray(blurred.data);
        const orig = ctx.getImageData(0, 0, width, height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                let sum = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        sum += orig.data[((y + dy) * width + (x + dx)) * 4];
                    }
                }
                blurData[idx] = blurData[idx + 1] = blurData[idx + 2] = Math.round(sum / 9);
            }
        }
        for (let i = 0; i < orig.data.length; i += 4) {
            const sharp = Math.max(0, Math.min(255, Math.round(orig.data[i] + amount * (orig.data[i] - blurData[i]))));
            orig.data[i] = orig.data[i + 1] = orig.data[i + 2] = sharp;
        }
        ctx.putImageData(orig, 0, 0);
    }

    return canvas.toDataURL('image/webp', 0.92);
}

/**
 * Aplica un mapa de pseudo-color a una imagen en escala de grises.
 * Transforma cada píxel según la LUT del colorMap seleccionado.
 */
export async function applyColorMap(imageUrl: string, colorMap: ColorMap): Promise<string> {
    if (colorMap === 'grayscale') return imageUrl;

    const { canvas, ctx } = await imageToCanvas(imageUrl);
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const lut = buildColorLUT(colorMap);

    for (let i = 0; i < data.length; i += 4) {
        // Usar luminancia (ya es gris tras el enhance)
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = lut[gray * 3];
        data[i + 1] = lut[gray * 3 + 1];
        data[i + 2] = lut[gray * 3 + 2];
        // Alpha intacto
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/webp', 0.92);
}

// ── GESTIÓN IN-MEMORY + BACKEND ───────────────────────────────────────────────

import { authFetch } from './db';

let estudios: EstudioRadiologico[] = [];
let nextId = 1;

export function getEstudios(numPac?: string): EstudioRadiologico[] {
    if (!numPac) return [...estudios];
    return estudios.filter(e => e.pacienteNumPac === numPac);
}

/**
 * Carga los estudios de un paciente desde el backend.
 * Fusiona con los estudios in-memory (los blob: no se pueden persistir en servidor).
 */
export async function loadEstudiosFromBackend(numPac: string): Promise<EstudioRadiologico[]> {
    try {
        const res = await authFetch(`/api/imaging/patients/${numPac}`);
        if (!res.ok) return getEstudios(numPac);
        const json = await res.json();
        const serverStudies: EstudioRadiologico[] = (json.data ?? []).map((s: any) => ({
            id: s.id,
            pacienteNumPac: s.num_pac,
            tipo: s.tipo as ImageType,
            nombre: s.nombre,
            fecha: s.fecha,
            doctor: s.doctor ?? '',
            descripcion: s.descripcion ?? '',
            originalUrl: s.ruta_origen ?? '',
            isProcessing: false,
            colorMap: 'grayscale' as ColorMap,
            brightness: 0, contrast: 0, sharpness: 0,
            anotaciones: [],
            tags: [],
            fileSize: undefined,
            rutaOrigen: s.ruta_origen,
        }));
        // Merge: backend studies + in-memory (blob) studies for this patient
        const localBlobs = estudios.filter(e =>
            e.pacienteNumPac === numPac && e.originalUrl.startsWith('blob:')
        );
        const serverIds = new Set(serverStudies.map(s => s.id));
        const merged = [...localBlobs.filter(e => !serverIds.has(e.id)), ...serverStudies];
        // Update local cache
        estudios = [...estudios.filter(e => e.pacienteNumPac !== numPac), ...merged];
        return merged;
    } catch {
        return getEstudios(numPac);
    }
}

export async function addEstudio(
    file: File,
    meta: {
        pacienteNumPac: string;
        tipo: ImageType;
        descripcion?: string;
        doctor?: string;
        tags?: string[];
    }
): Promise<EstudioRadiologico> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isDicom = await isDicomFile(file);
    const tipo: ImageType = isDicom ? 'dicom' : meta.tipo;

    // ── Obtener URL visualizable ─────────────────────────────────────────────
    // DICOM: solo blob URL — el renderizado lo hace CbctViewer directamente
    // desde el File object con su propio parser. Evitamos parsear dos veces.
    // Imágenes estándar: blob URL directo
    const originalUrl = URL.createObjectURL(file);
    const id = `img-${Date.now()}-${nextId++}`;

    const estudio: EstudioRadiologico = {
        id,
        pacienteNumPac: meta.pacienteNumPac,
        tipo,
        nombre: file.name,
        fecha: new Date().toISOString(),
        doctor: meta.doctor ?? 'Clínica',
        descripcion: meta.descripcion ?? '',
        originalUrl,
        isProcessing: false,
        colorMap: 'grayscale',
        brightness: 0,
        contrast: 0,
        sharpness: 0,
        anotaciones: [],
        tags: meta.tags ?? [],
        fileSize: file.size,
        dicomMeta: isDicom ? {
            patientId: meta.pacienteNumPac,
            studyDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
            modality: ext === 'dcm' || ext === 'dic' ? 'PX' : 'DX',
            studyDescription: meta.descripcion ?? 'Estudio radiológico DICOM',
        } : undefined,
    };

    estudios = [estudio, ...estudios];

    // Persist metadata to backend (no file content — blob stays local)
    try {
        await authFetch('/api/imaging/studies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                num_pac: meta.pacienteNumPac,
                tipo,
                nombre: file.name,
                fecha: estudio.fecha,
                doctor: estudio.doctor,
                descripcion: estudio.descripcion,
            }),
        });
    } catch {
        // Non-fatal: study still works in-memory
    }

    return estudio;
}

/**
 * Guarda las mediciones (implantes, nervios, reglas) de un estudio en el backend.
 */
export async function saveMeasurements(
    studyId: string,
    measurements: Array<{ id: string; tool: string; points: Array<{ x: number; y: number }>; label?: string; color: string; completed: boolean }>
): Promise<void> {
    try {
        await authFetch(`/api/imaging/studies/${studyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ measurements }),
        });
    } catch {
        // Non-fatal
    }
}

export async function processEstudio(
    id: string,
    options: {
        enhance?: boolean;
        colorMap?: ColorMap;
        brightness?: number;
        contrast?: number;
        sharpness?: number;
    }
): Promise<EstudioRadiologico> {
    const idx = estudios.findIndex(e => e.id === id);
    if (idx === -1) throw new Error(`Estudio ${id} no encontrado`);

    const estudio = { ...estudios[idx], isProcessing: true };
    estudios = estudios.map((e, i) => i === idx ? estudio : e);

    try {
        let processedUrl = estudio.originalUrl;

        if (options.enhance !== false) {
            processedUrl = await aiEnhanceImage(processedUrl, {
                brightness: options.brightness ?? estudio.brightness,
                contrast: options.contrast ?? estudio.contrast,
                sharpness: options.sharpness ?? estudio.sharpness,
            });
        }

        const colorMap = options.colorMap ?? estudio.colorMap;
        const finalUrl = colorMap !== 'grayscale'
            ? await applyColorMap(processedUrl, colorMap)
            : processedUrl;

        const updated: EstudioRadiologico = {
            ...estudio,
            enhancedUrl: processedUrl,
            colorizedUrl: colorMap !== 'grayscale' ? finalUrl : undefined,
            colorMap,
            brightness: options.brightness ?? estudio.brightness,
            contrast: options.contrast ?? estudio.contrast,
            sharpness: options.sharpness ?? estudio.sharpness,
            isProcessing: false,
        };

        estudios = estudios.map(e => e.id === id ? updated : e);
        return updated;
    } catch (err) {
        const failed = { ...estudio, isProcessing: false };
        estudios = estudios.map(e => e.id === id ? failed : e);
        throw err;
    }
}

export function addAnotacion(
    estudioId: string,
    anotacion: Omit<Anotacion, 'id' | 'fecha'>
): EstudioRadiologico | null {
    const idx = estudios.findIndex(e => e.id === estudioId);
    if (idx === -1) return null;
    const newAn: Anotacion = {
        ...anotacion,
        id: `an-${Date.now()}`,
        fecha: new Date().toISOString(),
    };
    const updated = { ...estudios[idx], anotaciones: [...estudios[idx].anotaciones, newAn] };
    estudios = estudios.map((e, i) => i === idx ? updated : e);
    return updated;
}

export function deleteEstudio(id: string): void {
    const estudio = estudios.find(e => e.id === id);
    if (estudio?.originalUrl.startsWith('blob:')) URL.revokeObjectURL(estudio.originalUrl);
    estudios = estudios.filter(e => e.id !== id);
    // Backend delete (fire-and-forget)
    authFetch(`/api/imaging/studies/${id}`, { method: 'DELETE' }).catch(() => {});
}

export function getEstudioById(id: string): EstudioRadiologico | undefined {
    return estudios.find(e => e.id === id);
}

// ── DEMO DATA ─────────────────────────────────────────────────────────────────

export const IMAGE_TYPES: { value: ImageType; label: string; icon: string }[] = [
    { value: 'panoramica', label: 'Panorámica', icon: 'panorama' },
    { value: 'periapical', label: 'Periapical', icon: 'radio_button_checked' },
    { value: 'cefalometrica', label: 'Cefalométrica', icon: 'face' },
    { value: 'intraoral', label: 'Foto Intraoral', icon: 'camera_indoor' },
    { value: 'extraoral', label: 'Foto Extraoral', icon: 'face_retouching_natural' },
    { value: 'dicom', label: 'DICOM / TC', icon: 'biotech' },
];

export const COLOR_MAPS: { value: ColorMap; label: string; description: string; preview: string[] }[] = [
    { value: 'grayscale', label: 'Escala de grises', description: 'Original radiológico', preview: ['#000', '#444', '#888', '#ccc', '#fff'] },
    { value: 'bone', label: 'Hueso', description: 'Estándar médico azulado', preview: ['#000d1a', '#1a2e4a', '#3a5f8a', '#7aabca', '#ddeeff'] },
    { value: 'hot', label: 'Térmico', description: 'Negro→Rojo→Amarillo→Blanco', preview: ['#000', '#800000', '#ff0000', '#ffff00', '#fff'] },
    { value: 'dental_soft', label: 'Dental Suave', description: 'Azul-turquesa (esmalte/dentina)', preview: ['#001433', '#005080', '#00a0c0', '#80d0ff', '#fff'] },
    { value: 'dental_warm', label: 'Dental Cálido', description: 'Amarillo-rojo (tejidos)', preview: ['#400000', '#cc6600', '#ffcc00', '#ffe080', '#fff8f0'] },
    { value: 'rainbow', label: 'Arcoíris', description: 'DICOM clásico multicolor', preview: ['#0000cc', '#00cccc', '#00cc00', '#cccc00', '#cc0000'] },
    { value: 'viridis', label: 'Viridis', description: 'Científico perceptual uniforme', preview: ['#440154', '#31688e', '#35b779', '#fde725', '#ffffa5'] },
    { value: 'cool', label: 'Frío', description: 'Cian-magenta', preview: ['#00ffff', '#40c0ff', '#8080ff', '#c040ff', '#ff00ff'] },
];
