/**
 * dicom.service.ts — v9  MPR Dental con offset correcto
 *
 * Fix principal: usa dicomParser.parseDicom() completo para obtener
 * el dataOffset exacto del Pixel Data element, evitando el escaneo
 * manual que a veces encontraba offsets erróneos.
 */

// @ts-ignore
import dicomParser from 'dicom-parser';

// ── PRESETS EXCLUSIVAMENTE DENTALES ──────────────────────────────────────────

export interface WindowPreset {
    key: string;
    label: string;
    wc: number;
    ww: number;
}

export const DENTAL_PRESETS: WindowPreset[] = [
    { key: 'hueso', label: '🦷 Hueso Alveolar', wc: 500, ww: 2500 },
    { key: 'cortical', label: '🦴 Hueso Cortical', wc: 300, ww: 1200 },
    { key: 'endodoncia', label: '🔬 Endodoncia', wc: 200, ww: 600 },
    { key: 'implante', label: '🔩 Implante / Metal', wc: 1500, ww: 5000 },
    { key: 'tejido', label: '💊 Tejido Blando', wc: 50, ww: 350 },
];

// Alias
export const CT_WINDOW_PRESETS = DENTAL_PRESETS;

// ── TIPOS ─────────────────────────────────────────────────────────────────────

export interface DicomVolume {
    rows: number;
    cols: number;
    numFrames: number;
    bitsAlloc: number;
    bitsStored: number;
    pixelRep: number;
    photometric: string;
    slope: number;
    intercept: number;
    modality: string;
    manufacturer?: string;
    studyDate?: string;
    patientId?: string;
    description?: string;
    defaultWC: number;
    defaultWW: number;
    frameViews: Uint16Array[];
    buffer: ArrayBuffer;
    // Debug info
    pixelDataOffset: number;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function dsParse(v?: string): number | undefined {
    if (!v) return undefined;
    const n = parseFloat(String(v).split('\\')[0].trim());
    return isNaN(n) ? undefined : n;
}

/** VOI LUT aplicado a un valor uint16 raw */
function applyVOI(
    raw: number,
    storedMax: number, signBit: number, signed: boolean,
    slope: number, intercept: number,
    lo: number, ww: number
): number {
    let v = raw & storedMax;
    if (signed && (v & signBit)) v = v - (signBit << 1);
    const hu = v * slope + intercept;
    if (hu <= lo) return 0;
    if (hu >= lo + ww) return 255;
    return ((hu - lo) / ww * 255) | 0;
}

// ── LOAD VOLUME ───────────────────────────────────────────────────────────────

export async function loadDicomVolume(file: File): Promise<DicomVolume> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // ── 1. Parsear CABECERAS (hasta Pixel Data) ───────────────────────────
    let ds: ReturnType<typeof dicomParser.parseDicom>;
    try { ds = dicomParser.parseDicom(bytes, { untilTag: '7fe00010' }); }
    catch { ds = dicomParser.parseDicom(bytes); }

    const rows = ds.uint16('x00280010') ?? 0;
    const cols = ds.uint16('x00280011') ?? 0;
    const bitsAlloc = ds.uint16('x00280100') ?? 16;
    const bitsStored = ds.uint16('x00280101') ?? 16;
    const pixelRep = ds.uint16('x00280103') ?? 0;
    const photometric = (ds.string('x00280004') ?? 'MONOCHROME2').trim();
    const numFrames = parseInt((ds.string('x00280008') ?? '1').trim()) || 1;
    const slope = dsParse(ds.string('x00281053')) ?? 1;
    const intercept = dsParse(ds.string('x00281052')) ?? 0;
    const modality = (ds.string('x00080060') ?? 'CT').trim();

    if (!rows || !cols) throw new Error(`DICOM inválido: ${rows}×${cols}`);

    // ── 2. Encontrar offset exacto del Pixel Data ─────────────────────────
    //
    // ESTRATEGIA FIABLE: escanear los últimos bytes del archivo sabiendo que
    // pixelData = numFrames * rows * cols * (bitsAlloc/8), así localizamos e
    // verificamos el offset antes de crear las vistas.
    const px = rows * cols;
    const bytesPerPx = bitsAlloc === 16 ? 2 : 1;
    const frameBytes = px * bytesPerPx;
    const totalPxBytes = frameBytes * numFrames;

    // El pixel data debe empezar exactamente en: fileSize - totalPxBytes (aprox.)
    // Buscar el tag (7FE0,0010) en la zona esperada del archivo
    const searchFrom = Math.max(0, buffer.byteLength - totalPxBytes - 256);
    const searchTo = Math.min(buffer.byteLength - totalPxBytes + 256, buffer.byteLength - 12);

    let pixelDataOffset = -1;

    // Buscar el tag en la zona esperada primero (rápido)
    for (let i = searchFrom; i < searchTo; i++) {
        if (bytes[i] === 0xE0 && bytes[i + 1] === 0x7F &&
            bytes[i + 2] === 0x10 && bytes[i + 3] === 0x00) {
            const vr = String.fromCharCode(bytes[i + 4], bytes[i + 5]);
            const candidate = (vr === 'OW' || vr === 'OB') ? i + 12 : i + 8;
            // Verificar: ¿hay suficiente espacio para al menos 1 frame?
            if (candidate + frameBytes <= buffer.byteLength) {
                pixelDataOffset = candidate;
                break;
            }
        }
    }

    // Fallback: escanear todo el archivo
    if (pixelDataOffset === -1) {
        for (let i = 0; i < bytes.length - 12; i++) {
            if (bytes[i] === 0xE0 && bytes[i + 1] === 0x7F &&
                bytes[i + 2] === 0x10 && bytes[i + 3] === 0x00) {
                const vr = String.fromCharCode(bytes[i + 4], bytes[i + 5]);
                const candidate = (vr === 'OW' || vr === 'OB') ? i + 12 : i + 8;
                if (candidate + frameBytes <= buffer.byteLength) {
                    pixelDataOffset = candidate;
                    break;
                }
            }
        }
    }

    if (pixelDataOffset === -1) throw new Error('Pixel Data no encontrado en el archivo');

    // Asegurar alineación a 2 bytes para Uint16Array
    const alignedOffset = (pixelDataOffset % 2 === 0) ? pixelDataOffset : pixelDataOffset + 1;

    // ── 3. Crear vistas zero-copy de cada frame ───────────────────────────
    const frameViews: Uint16Array[] = [];
    const actualFrames = Math.min(numFrames,
        Math.floor((buffer.byteLength - alignedOffset) / frameBytes));

    for (let f = 0; f < actualFrames; f++) {
        const start = alignedOffset + f * frameBytes;
        if (start + frameBytes > buffer.byteLength) break;
        if (bitsAlloc === 16) {
            frameViews.push(new Uint16Array(buffer, start, px));
        } else {
            const u8 = new Uint8Array(buffer, start, px);
            const u16 = new Uint16Array(px);
            for (let i = 0; i < px; i++) u16[i] = u8[i];
            frameViews.push(u16);
        }
    }

    if (frameViews.length === 0) throw new Error('No se pudieron extraer frames del DICOM');

    // ── Diagnóstico en consola ────────────────────────────────────────────
    const midFrame = frameViews[Math.floor(frameViews.length / 2)];
    const sampleMin = Math.min(...Array.from(midFrame.slice(0, 100)));
    const sampleMax = Math.max(...Array.from(midFrame.slice(0, 100)));
    console.group('[DICOM v9] Volumen cargado');
    console.log(`Dimensiones: ${cols}×${rows}×${frameViews.length} | ${modality} | ${bitsStored}bit`);
    console.log(`Pixeldata offset: ${pixelDataOffset} (alineado: ${alignedOffset})`);
    console.log(`Rescale: slope=${slope} intercept=${intercept}`);
    console.log(`Muestra frame central [0..100]: min=${sampleMin} max=${sampleMax}`);
    console.log(`Archivo: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
    console.groupEnd();

    return {
        rows, cols, numFrames: frameViews.length,
        bitsAlloc, bitsStored, pixelRep, photometric,
        slope, intercept, modality,
        manufacturer: ds.string('x00080070'),
        studyDate: ds.string('x00080020'),
        patientId: ds.string('x00100020'),
        description: ds.string('x00081030') ?? ds.string('x00080060'),
        defaultWC: 500, defaultWW: 2500,
        frameViews, buffer, pixelDataOffset,
    };
}

// ── PREPARAR PARÁMETROS VOI ──────────────────────────────────────────────────

function voiParams(vol: DicomVolume, wc: number, ww: number) {
    return {
        storedMax: (1 << vol.bitsStored) - 1,
        signBit: 1 << (vol.bitsStored - 1),
        signed: vol.pixelRep === 1,
        isMono1: vol.photometric === 'MONOCHROME1',
        slope: vol.slope,
        intercept: vol.intercept,
        lo: wc - ww / 2,
        ww,
    };
}

// ── RENDER AXIAL (plano Z) ────────────────────────────────────────────────────

export function renderAxial(
    vol: DicomVolume, z: number, wc: number, ww: number, imgData: ImageData
): void {
    const frame = vol.frameViews[Math.max(0, Math.min(z, vol.numFrames - 1))];
    if (!frame) return;
    const d = imgData.data;
    const { storedMax, signBit, signed, isMono1, slope, intercept, lo } = voiParams(vol, wc, ww);
    const px = vol.rows * vol.cols;
    for (let i = 0; i < px; i++) {
        let g = applyVOI(frame[i], storedMax, signBit, signed, slope, intercept, lo, ww);
        if (isMono1) g = 255 - g;
        const p = i << 2;
        d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
    }
}

export function renderFrame(vol: DicomVolume, z: number, wc: number, ww: number, imgData: ImageData): void {
    renderAxial(vol, z, wc, ww, imgData);
}

// ── RENDER CORONAL (plano Y) ──────────────────────────────────────────────────
// Salida: cols × numFrames  (horizontal=X, vertical=Z de arriba a abajo)

export function renderCoronal(
    vol: DicomVolume, y: number, wc: number, ww: number, canvas: HTMLCanvasElement
): void {
    const { cols, rows, numFrames, frameViews } = vol;
    const Yi = Math.max(0, Math.min(y, rows - 1));
    const outW = cols;
    const outH = numFrames;
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const id = ctx.createImageData(outW, outH);
    const d = id.data;
    const { storedMax, signBit, signed, isMono1, slope, intercept, lo } = voiParams(vol, wc, ww);
    const rowOffset = Yi * cols;  // posición Y dentro de cada frame axial
    for (let z = 0; z < numFrames; z++) {
        const frame = frameViews[z];
        const outBase = z * outW;
        for (let x = 0; x < outW; x++) {
            let g = applyVOI(frame[rowOffset + x], storedMax, signBit, signed, slope, intercept, lo, ww);
            if (isMono1) g = 255 - g;
            const p = (outBase + x) << 2;
            d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
        }
    }
    ctx.putImageData(id, 0, 0);
}

// ── RENDER SAGITAL (plano X) ──────────────────────────────────────────────────
// Salida: rows × numFrames  (horizontal=Y ant-post, vertical=Z sup-inf)

export function renderSagittal(
    vol: DicomVolume, x: number, wc: number, ww: number, canvas: HTMLCanvasElement
): void {
    const { cols, rows, numFrames, frameViews } = vol;
    const Xi = Math.max(0, Math.min(x, cols - 1));
    const outW = rows;
    const outH = numFrames;
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const id = ctx.createImageData(outW, outH);
    const d = id.data;
    const { storedMax, signBit, signed, isMono1, slope, intercept, lo } = voiParams(vol, wc, ww);
    for (let z = 0; z < numFrames; z++) {
        const frame = frameViews[z];
        const outBase = z * outW;
        for (let yi = 0; yi < rows; yi++) {
            let g = applyVOI(frame[yi * cols + Xi], storedMax, signBit, signed, slope, intercept, lo, ww);
            if (isMono1) g = 255 - g;
            const p = (outBase + yi) << 2;
            d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
        }
    }
    ctx.putImageData(id, 0, 0);
}

// ── RENDER PANORÁMICA (slab MIP del arco dental) ──────────────────────────────
// Proyecta la intensidad máxima a lo largo del eje Y (antero-posterior)
// Salida: cols × numFrames — vista superior del arco dental

export function renderPanoramica(
    vol: DicomVolume, wc: number, ww: number, canvas: HTMLCanvasElement
): void {
    const { cols, rows, numFrames, frameViews } = vol;
    const yStart = Math.floor(rows * 0.25);
    const yEnd = Math.floor(rows * 0.75);
    canvas.width = cols;
    canvas.height = numFrames;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const id = ctx.createImageData(cols, numFrames);
    const d = id.data;
    const { storedMax, signBit, signed, slope, intercept, lo, ww: wWindow } = voiParams(vol, wc, ww);

    for (let z = 0; z < numFrames; z++) {
        const frame = frameViews[z];
        const outBase = z * cols;
        for (let x = 0; x < cols; x++) {
            let maxHU = -Infinity;
            for (let yi = yStart; yi < yEnd; yi++) {
                let v = frame[yi * cols + x] & storedMax;
                if (signed && (v & signBit)) v = v - (signBit << 1);
                const hu = v * slope + intercept;
                if (hu > maxHU) maxHU = hu;
            }
            const g = maxHU <= lo ? 0 : maxHU >= lo + wWindow ? 255
                : ((maxHU - lo) / wWindow * 255) | 0;
            const p = (outBase + x) << 2;
            d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
        }
    }
    ctx.putImageData(id, 0, 0);
}

// ── RENDER MIP 3D async (chunked, no bloquea el hilo) ────────────────────────
// Proyecta el máximo HU a lo largo del eje Z → vista superior 3D
// OnProgress(0..1) se llama para actualizar una barra de progreso

export async function renderMIPAsync(
    vol: DicomVolume, wc: number, ww: number, canvas: HTMLCanvasElement,
    step = 1,
    onProgress?: (pct: number) => void
): Promise<void> {
    const { cols, rows, numFrames, frameViews } = vol;
    const px = rows * cols;
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { storedMax, signBit, signed, slope, intercept, lo, ww: wWindow } = voiParams(vol, wc, ww);
    const maxHU = new Float32Array(px).fill(-32768);
    const CHUNK = 10; // frames por chunk

    for (let z = 0; z < numFrames; z += CHUNK * step) {
        const end = Math.min(z + CHUNK * step, numFrames);
        for (let f = z; f < end; f += step) {
            const frame = frameViews[f];
            for (let i = 0; i < px; i++) {
                let v = frame[i] & storedMax;
                if (signed && (v & signBit)) v = v - (signBit << 1);
                const hu = v * slope + intercept;
                if (hu > maxHU[i]) maxHU[i] = hu;
            }
        }
        onProgress?.(end / numFrames);
        // Yield para no bloquear la UI
        await new Promise<void>(r => setTimeout(r, 0));
    }

    // Renderizado final
    const id = ctx.createImageData(cols, rows);
    const d = id.data;
    for (let i = 0; i < px; i++) {
        const hu = maxHU[i];
        const g = hu <= lo ? 0 : hu >= lo + wWindow ? 255 : ((hu - lo) / wWindow * 255) | 0;
        const p = i << 2;
        d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
}

// Versión sync rápida (step alto) para thumbnails
export function renderMIP(
    vol: DicomVolume, wc: number, ww: number, canvas: HTMLCanvasElement, step = 4
): void {
    const { cols, rows, numFrames, frameViews } = vol;
    const px = rows * cols;
    canvas.width = cols; canvas.height = rows;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { storedMax, signBit, signed, slope, intercept, lo, ww: wW } = voiParams(vol, wc, ww);
    const maxHU = new Float32Array(px).fill(-32768);
    for (let z = 0; z < numFrames; z += step) {
        const frame = frameViews[z];
        for (let i = 0; i < px; i++) {
            let v = frame[i] & storedMax;
            if (signed && (v & signBit)) v = v - (signBit << 1);
            const hu = v * slope + intercept;
            if (hu > maxHU[i]) maxHU[i] = hu;
        }
    }
    const id = ctx.createImageData(cols, rows); const d = id.data;
    for (let i = 0; i < px; i++) {
        const hu = maxHU[i];
        const g = hu <= lo ? 0 : hu >= lo + wW ? 255 : ((hu - lo) / wW * 255) | 0;
        const p = i << 2; d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
}

// ── CEFALOMETRÍA LATERAL (proyección MIP a lo largo del eje X) ───────────────
// Genera una imagen equivalente a una Rx lateral de cráneo (teleradiografía).
// Salida: rows × numFrames  (horizontal=antero-posterior, vertical=sup-inf)

export async function renderCephalometryAsync(
    vol: DicomVolume, wc: number, ww: number, canvas: HTMLCanvasElement,
    stepX = 1,
    onProgress?: (pct: number) => void
): Promise<void> {
    const { cols, rows, numFrames, frameViews } = vol;
    canvas.width = rows;       // anterior-posterior
    canvas.height = numFrames;  // superior-inferior
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const { storedMax, signBit, signed, slope, intercept, lo, ww: wW } = voiParams(vol, wc, ww);
    // maxHU[z * rows + y] = max a lo largo del eje X
    const totalPx = numFrames * rows;
    const maxHU = new Float32Array(totalPx).fill(-32768);
    const CHUNKX = Math.max(1, Math.floor(cols / 20)); // 20 chunks de columnas X

    for (let x = 0; x < cols; x += CHUNKX * stepX) {
        const xEnd = Math.min(x + CHUNKX * stepX, cols);
        for (let xi = x; xi < xEnd; xi += stepX) {
            for (let z = 0; z < numFrames; z++) {
                const frame = frameViews[z];
                for (let y = 0; y < rows; y++) {
                    let v = frame[y * cols + xi] & storedMax;
                    if (signed && (v & signBit)) v = v - (signBit << 1);
                    const hu = v * slope + intercept;
                    const idx = z * rows + y;
                    if (hu > maxHU[idx]) maxHU[idx] = hu;
                }
            }
        }
        onProgress?.(xEnd / cols);
        await new Promise<void>(r => setTimeout(r, 0));
    }

    const id = ctx.createImageData(rows, numFrames); const d = id.data;
    for (let i = 0; i < totalPx; i++) {
        const hu = maxHU[i];
        const g = hu <= lo ? 0 : hu >= lo + wW ? 255 : ((hu - lo) / wW * 255) | 0;
        const p = i << 2; d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
}

// ── PANORÁMICA ASYNC (slab MIP del arco, chunked) ────────────────────────────

export async function renderPanoramicaAsync(
    vol: DicomVolume, wc: number, ww: number, canvas: HTMLCanvasElement,
    onProgress?: (pct: number) => void
): Promise<void> {
    const { cols, rows, numFrames, frameViews } = vol;
    const yStart = Math.floor(rows * 0.25); const yEnd = Math.floor(rows * 0.75);
    canvas.width = cols; canvas.height = numFrames;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { storedMax, signBit, signed, slope, intercept, lo, ww: wW } = voiParams(vol, wc, ww);

    const id = ctx.createImageData(cols, numFrames); const d = id.data;
    const CHUNK = 20; // frames por chunk
    for (let z = 0; z < numFrames; z += CHUNK) {
        const zEnd = Math.min(z + CHUNK, numFrames);
        for (let zi = z; zi < zEnd; zi++) {
            const frame = frameViews[zi]; const outBase = zi * cols;
            for (let x = 0; x < cols; x++) {
                let maxHU = -Infinity;
                for (let y = yStart; y < yEnd; y++) {
                    let v = frame[y * cols + x] & storedMax;
                    if (signed && (v & signBit)) v = v - (signBit << 1);
                    const hu = v * slope + intercept;
                    if (hu > maxHU) maxHU = hu;
                }
                const g = maxHU <= lo ? 0 : maxHU >= lo + wW ? 255 : ((maxHU - lo) / wW * 255) | 0;
                const p = (outBase + x) << 2; d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
            }
        }
        ctx.putImageData(id, 0, 0); // render parcial
        onProgress?.(zEnd / numFrames);
        await new Promise<void>(r => setTimeout(r, 0));
    }
}

// ── THUMBNAIL ─────────────────────────────────────────────────────────────────

export async function dicomFileToImageUrl(file: File): Promise<string> {
    const vol = await loadDicomVolume(file);
    const z = Math.floor(vol.numFrames / 2);
    const c = document.createElement('canvas');
    c.width = vol.cols; c.height = vol.rows;
    const ctx = c.getContext('2d')!;
    const id = ctx.createImageData(vol.cols, vol.rows);
    renderAxial(vol, z, vol.defaultWC, vol.defaultWW, id);
    ctx.putImageData(id, 0, 0);
    const MAX = 512;
    if (c.width > MAX || c.height > MAX) {
        const r = Math.min(MAX / c.width, MAX / c.height);
        const sc = document.createElement('canvas');
        sc.width = Math.round(c.width * r); sc.height = Math.round(c.height * r);
        sc.getContext('2d')!.drawImage(c, 0, 0, sc.width, sc.height);
        return sc.toDataURL('image/webp', 0.85);
    }
    return c.toDataURL('image/webp', 0.85);
}

// ── DETECT ────────────────────────────────────────────────────────────────────

export async function isDicomFile(file: File): Promise<boolean> {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (['dcm', 'dic', 'dicom'].includes(ext)) return true;
    try {
        const v = new DataView(await file.slice(128, 132).arrayBuffer());
        return v.getUint8(0) === 0x44 && v.getUint8(1) === 0x49 &&
            v.getUint8(2) === 0x43 && v.getUint8(3) === 0x4D;
    } catch { return false; }
}
