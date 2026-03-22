/**
 * dicom.service.ts — Carga y renderizado DICOM puro (sin Cornerstone)
 * Usa dicom-parser para parsear el archivo binario.
 */

import dicomParser from 'dicom-parser';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface WindowPreset {
    name: string;
    wc: number;
    ww: number;
}

export const DENTAL_PRESETS: WindowPreset[] = [
    { name: 'Hueso',   wc: 400,   ww: 1500 },
    { name: 'Tejido',  wc: 40,    ww: 400  },
    { name: 'Dental',  wc: 600,   ww: 2000 },
    { name: 'Implante',wc: 1000,  ww: 3000 },
];

export interface DicomVolume {
    rows: number;
    cols: number;
    numFrames: number;
    bitsAlloc: number;
    bitsStored: number;
    pixelRep: number;           // 0 = unsigned, 1 = signed
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
    /** [row_spacing_mm, col_spacing_mm] — tag (0028,0030) */
    pixelSpacing?: [number, number];
    /** Un Uint16Array por frame — comparte buffer del archivo */
    frameViews: Uint16Array[];
}

// ── Parser ────────────────────────────────────────────────────────────────────

function ds(dataset: dicomParser.DataSet, tag: string): string | undefined {
    try { return dataset.string(tag); } catch { return undefined; }
}
function u16(dataset: dicomParser.DataSet, tag: string): number | undefined {
    try { return dataset.uint16(tag); } catch { return undefined; }
}
function f32(str?: string): number | undefined {
    if (!str) return undefined;
    const n = parseFloat(str.split('\\')[0].trim());
    return isNaN(n) ? undefined : n;
}

export async function loadDicomVolume(file: File): Promise<DicomVolume> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // Sin untilTag: necesitamos el dataOffset del pixel data element (7fe00010)
    const dataset = dicomParser.parseDicom(bytes);

    const rows       = u16(dataset, 'x00280010') ?? 512;
    const cols       = u16(dataset, 'x00280011') ?? 512;
    const numFrames  = parseInt(ds(dataset, 'x00280008') ?? '1', 10) || 1;
    const bitsAlloc  = u16(dataset, 'x00280100') ?? 16;
    const bitsStored = u16(dataset, 'x00280101') ?? 12;
    const pixelRep   = u16(dataset, 'x00280103') ?? 0;
    const photometric= ds(dataset, 'x00280004') ?? 'MONOCHROME2';
    const slope      = f32(ds(dataset, 'x00281053')) ?? 1;
    const intercept  = f32(ds(dataset, 'x00281052')) ?? -1024;
    const modality   = ds(dataset, 'x00080060') ?? 'CT';
    const manufacturer = ds(dataset, 'x00080070');
    const studyDate  = ds(dataset, 'x00080020');
    const patientId  = ds(dataset, 'x00100020');
    const description= ds(dataset, 'x00081030');

    // Window center / width
    const wcStr = ds(dataset, 'x00281050');
    const wwStr = ds(dataset, 'x00281051');
    let wc = f32(wcStr) ?? 0;
    let ww = f32(wwStr) ?? 0;

    // Pixel spacing [row, col]
    const psStr = ds(dataset, 'x00280030');
    let pixelSpacing: [number, number] | undefined;
    if (psStr) {
        const parts = psStr.split('\\');
        const r = parseFloat(parts[0] ?? '');
        const c = parseFloat(parts[1] ?? parts[0] ?? '');
        if (!isNaN(r) && !isNaN(c) && r > 0 && c > 0) pixelSpacing = [r, c];
    }

    // Pixel data element
    const pixEl = dataset.elements['x7fe00010'];
    if (!pixEl) throw new Error('No pixel data in DICOM file');
    const framePixels = rows * cols;
    const frameBytes  = framePixels * (bitsAlloc / 8);

    // Copia alineada: Uint16Array requiere offset múltiplo de 2
    const totalPixels = numFrames * framePixels;
    const allPixels   = new Uint16Array(totalPixels);
    // Límite seguro: nunca exceder el buffer original
    const maxBytes = buffer.byteLength - pixEl.dataOffset;
    const dataLen  = Math.min(frameBytes * numFrames, maxBytes);
    const src      = new DataView(buffer, pixEl.dataOffset, dataLen);
    const maxPx    = Math.floor(dataLen / 2);
    for (let i = 0; i < Math.min(totalPixels, maxPx); i++) {
        allPixels[i] = src.getUint16(i * 2, true); // little-endian
    }

    const frameViews: Uint16Array[] = [];
    for (let f = 0; f < numFrames; f++) {
        frameViews.push(allPixels.subarray(f * framePixels, (f + 1) * framePixels));
    }

    // Auto window: solo si los tags WC/WW no existen o WW no es válido
    if (!wcStr || !wwStr || ww <= 1) {
        const mid = frameViews[Math.floor(numFrames / 2)];
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < mid.length; i++) {
            let v = mid[i];
            if (pixelRep && (v & 0x8000)) v = v - 0x10000;
            const hu = v * slope + intercept;
            if (hu < lo) lo = hu;
            if (hu > hi) hi = hu;
        }
        wc = (lo + hi) / 2;
        ww = Math.max(1, hi - lo);
    }

    return {
        rows, cols, numFrames, bitsAlloc, bitsStored, pixelRep, photometric,
        slope, intercept, modality, manufacturer, studyDate, patientId, description,
        defaultWC: wc, defaultWW: ww, pixelSpacing, frameViews,
    };
}

// ── VOI LUT helper ────────────────────────────────────────────────────────────

interface VOI {
    lo: number; ww: number;
    storedMax: number; signBit: number; signed: boolean; isMono1: boolean;
    slope: number; intercept: number;
}

function voiParams(vol: DicomVolume, wc: number, ww: number): VOI {
    const storedMax = (1 << vol.bitsStored) - 1;
    const signBit   = 1 << (vol.bitsStored - 1);
    const signed    = vol.pixelRep === 1;
    const isMono1   = vol.photometric === 'MONOCHROME1';
    const lo        = wc - ww / 2;
    return { lo, ww, storedMax, signBit, signed, isMono1, slope: vol.slope, intercept: vol.intercept };
}

function applyVOI(raw: number, v: VOI): number {
    let px = raw & v.storedMax;
    if (v.signed && (px & v.signBit)) px = px - (v.signBit << 1);
    const hu = px * v.slope + v.intercept;
    let g = hu <= v.lo ? 0 : hu >= v.lo + v.ww ? 255 : ((hu - v.lo) / v.ww * 255) | 0;
    return v.isMono1 ? 255 - g : g;
}

// ── Render: Axial ─────────────────────────────────────────────────────────────

export function renderFrame(vol: DicomVolume, z: number, wc: number, ww: number, imgData: ImageData): void {
    const frame = vol.frameViews[Math.max(0, Math.min(z, vol.numFrames - 1))];
    if (!frame) return;
    const voi = voiParams(vol, wc, ww);
    const d = imgData.data;
    const px = vol.rows * vol.cols;
    for (let i = 0; i < px; i++) {
        const g = applyVOI(frame[i], voi);
        const p = i << 2;
        d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
    }
}

// ── Render: Coronal ───────────────────────────────────────────────────────────

export function renderCoronal(vol: DicomVolume, y: number, wc: number, ww: number, canvas: HTMLCanvasElement): void {
    const { cols, rows, numFrames, frameViews } = vol;
    const yi = Math.max(0, Math.min(y, rows - 1));
    canvas.width = cols; canvas.height = numFrames;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const id = ctx.createImageData(cols, numFrames);
    const d = id.data;
    const voi = voiParams(vol, wc, ww);
    for (let z = 0; z < numFrames; z++) {
        const frame = frameViews[z];
        for (let x = 0; x < cols; x++) {
            const g = applyVOI(frame[yi * cols + x], voi);
            const p = (z * cols + x) << 2;
            d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
        }
    }
    ctx.putImageData(id, 0, 0);
}

// ── Render: Sagital ───────────────────────────────────────────────────────────

export function renderSagittal(vol: DicomVolume, x: number, wc: number, ww: number, canvas: HTMLCanvasElement): void {
    const { cols, rows, numFrames, frameViews } = vol;
    const xi = Math.max(0, Math.min(x, cols - 1));
    canvas.width = rows; canvas.height = numFrames;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const id = ctx.createImageData(rows, numFrames);
    const d = id.data;
    const voi = voiParams(vol, wc, ww);
    for (let z = 0; z < numFrames; z++) {
        const frame = frameViews[z];
        for (let yi = 0; yi < rows; yi++) {
            const g = applyVOI(frame[yi * cols + xi], voi);
            const p = (z * rows + yi) << 2;
            d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
        }
    }
    ctx.putImageData(id, 0, 0);
}

// ── Render: Panorámica (MIP a lo largo del eje Y, slab central) ───────────────

export async function renderPanoramicaAsync(
    vol: DicomVolume, wc: number, ww: number, canvas: HTMLCanvasElement,
    onProgress?: (pct: number) => void
): Promise<void> {
    const { cols, rows, numFrames, frameViews } = vol;
    const y0 = Math.floor(rows * 0.25);
    const y1 = Math.floor(rows * 0.75);
    canvas.width = cols; canvas.height = numFrames;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const voi = voiParams(vol, wc, ww);
    const id = ctx.createImageData(cols, numFrames);
    const d = id.data;
    const CHUNK = 8;
    for (let z = 0; z < numFrames; z += CHUNK) {
        const end = Math.min(z + CHUNK, numFrames);
        for (let zi = z; zi < end; zi++) {
            const frame = frameViews[zi];
            for (let x = 0; x < cols; x++) {
                let maxRaw = 0;
                for (let yi = y0; yi < y1; yi++) {
                    const v = frame[yi * cols + x];
                    if (v > maxRaw) maxRaw = v;
                }
                const g = applyVOI(maxRaw, voi);
                const p = (zi * cols + x) << 2;
                d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
            }
        }
        onProgress?.(end / numFrames);
        await new Promise<void>(r => setTimeout(r, 0));
    }
    ctx.putImageData(id, 0, 0);
}

// ── Render: MIP 3D (proyección a lo largo del eje Z) ─────────────────────────

export async function renderMIPAsync(
    vol: DicomVolume, wc: number, ww: number, canvas: HTMLCanvasElement,
    _step = 1,
    onProgress?: (pct: number) => void
): Promise<void> {
    const { cols, rows, numFrames, frameViews } = vol;
    const px = rows * cols;
    canvas.width = cols; canvas.height = rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const voi = voiParams(vol, wc, ww);
    const maxRaw = new Uint16Array(px);
    const CHUNK = 10;
    for (let z = 0; z < numFrames; z += CHUNK) {
        const end = Math.min(z + CHUNK, numFrames);
        for (let f = z; f < end; f++) {
            const frame = frameViews[f];
            for (let i = 0; i < px; i++) {
                if (frame[i] > maxRaw[i]) maxRaw[i] = frame[i];
            }
        }
        onProgress?.(end / numFrames);
        await new Promise<void>(r => setTimeout(r, 0));
    }
    const id = ctx.createImageData(cols, rows);
    const d = id.data;
    for (let i = 0; i < px; i++) {
        const g = applyVOI(maxRaw[i], voi);
        const p = i << 2;
        d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
}

// ── Render: Cefalometría (MIP a lo largo del eje X) ──────────────────────────

export async function renderCephalometryAsync(
    vol: DicomVolume, wc: number, ww: number, canvas: HTMLCanvasElement,
    _step = 1,
    onProgress?: (pct: number) => void
): Promise<void> {
    const { cols, rows, numFrames, frameViews } = vol;
    canvas.width = rows; canvas.height = numFrames;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const voi = voiParams(vol, wc, ww);
    const id = ctx.createImageData(rows, numFrames);
    const d = id.data;
    const CHUNK = 8;
    for (let z = 0; z < numFrames; z += CHUNK) {
        const end = Math.min(z + CHUNK, numFrames);
        for (let zi = z; zi < end; zi++) {
            const frame = frameViews[zi];
            for (let yi = 0; yi < rows; yi++) {
                let maxRaw = 0;
                for (let x = 0; x < cols; x++) {
                    const v = frame[yi * cols + x];
                    if (v > maxRaw) maxRaw = v;
                }
                const g = applyVOI(maxRaw, voi);
                const p = (zi * rows + yi) << 2;
                d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
            }
        }
        onProgress?.(end / numFrames);
        await new Promise<void>(r => setTimeout(r, 0));
    }
    ctx.putImageData(id, 0, 0);
}

// ── Utilidades ────────────────────────────────────────────────────────────────

export async function extractDicomPixelSpacing(file: File): Promise<[number, number] | undefined> {
    try {
        const vol = await loadDicomVolume(file);
        return vol.pixelSpacing;
    } catch { return undefined; }
}

export async function isDicomFile(file: File): Promise<boolean> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (['dcm', 'dic', 'dicom'].includes(ext)) return true;
    try {
        const buf = await file.slice(128, 132).arrayBuffer();
        return new TextDecoder().decode(buf) === 'DICM';
    } catch { return false; }
}
