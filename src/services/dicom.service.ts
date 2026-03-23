/**
 * dicom.service.ts — Carga y renderizado DICOM puro (sin Cornerstone)
 * Usa un Web Worker para no bloquear el hilo principal con archivos grandes.
 */

import dicomParser from 'dicom-parser';
import type { DicomMeta } from '../workers/dicom.worker';

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

export async function loadDicomVolume(
    file: File,
    onProgress?: (pct: number) => void,
): Promise<DicomVolume> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL('../workers/dicom.worker.ts', import.meta.url),
            { type: 'module' },
        );

        worker.onmessage = (e: MessageEvent) => {
            const msg = e.data as
                | { type: 'progress'; pct: number }
                | { type: 'done'; meta: DicomMeta; pixelBuffer: ArrayBuffer }
                | { type: 'error'; message: string };

            if (msg.type === 'progress') {
                onProgress?.(msg.pct);
            } else if (msg.type === 'done') {
                worker.terminate();
                const { meta, pixelBuffer } = msg;
                const allPixels   = new Uint16Array(pixelBuffer);
                const framePixels = meta.rows * meta.cols;
                const frameViews: Uint16Array[] = [];
                for (let f = 0; f < meta.numFrames; f++) {
                    frameViews.push(allPixels.subarray(f * framePixels, (f + 1) * framePixels));
                }
                resolve({ ...meta, frameViews });
            } else {
                worker.terminate();
                reject(new Error(msg.message));
            }
        };

        worker.onerror = (err) => {
            worker.terminate();
            reject(new Error(err.message));
        };

        worker.postMessage({ file });
    });
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

// ── Panorámica con arco dental personalizado ──────────────────────────────────

/** Interpolación Catmull-Rom 1-D */
function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2*p1 + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
}

/**
 * Devuelve `nSamples` puntos interpolados a lo largo del spline Catmull-Rom
 * definido por los puntos de control (coordenadas en píxeles del volumen).
 */
export function sampleArchSpline(
    controls: Array<[number, number]>,
    nSamples = 256,
): Array<[number, number]> {
    const n = controls.length;
    if (n === 0) return [];
    if (n === 1) return [controls[0]];
    const result: Array<[number, number]> = [];
    const segs   = n - 1;
    const perSeg = Math.max(2, Math.ceil(nSamples / segs));
    for (let i = 0; i < segs; i++) {
        const p0 = controls[Math.max(0, i - 1)];
        const p1 = controls[i];
        const p2 = controls[Math.min(n - 1, i + 1)];
        const p3 = controls[Math.min(n - 1, i + 2)];
        for (let s = 0; s < perSeg; s++) {
            const t = s / perSeg;
            result.push([
                catmullRom1D(p0[0], p1[0], p2[0], p3[0], t),
                catmullRom1D(p0[1], p1[1], p2[1], p3[1], t),
            ]);
        }
    }
    result.push(controls[n - 1]);
    return result;
}

/**
 * Renderiza una panorámica siguiendo el arco definido por `controls`.
 * Para cada posición del arco muestrea un slab perpendicular y proyecta el máximo (MIP).
 * Fallback a renderPanoramicaAsync si hay menos de 2 puntos.
 */
export async function renderArchPanoramicaAsync(
    vol:          DicomVolume,
    controls:     Array<[number, number]>,  // [col, row] en px del volumen
    slabThickness: number,                  // grosor del slab en px
    wc: number, ww: number,
    canvas: HTMLCanvasElement,
    onProgress?: (pct: number) => void,
): Promise<void> {
    if (controls.length < 2) return renderPanoramicaAsync(vol, wc, ww, canvas, onProgress);

    const { cols, rows, numFrames, frameViews } = vol;

    // Longitud real del arco → resolución nativa (1 muestra / px a lo largo del arco)
    const densePts = sampleArchSpline(controls, controls.length * 100);
    let arcLen = 0;
    for (let i = 1; i < densePts.length; i++) {
        const ddx = densePts[i][0] - densePts[i - 1][0];
        const ddy = densePts[i][1] - densePts[i - 1][1];
        arcLen += Math.sqrt(ddx * ddx + ddy * ddy);
    }
    const nCols   = Math.max(256, Math.round(arcLen));
    const archPts = sampleArchSpline(controls, nCols);
    const half    = Math.max(1, Math.floor(slabThickness / 2));

    canvas.width  = nCols;
    canvas.height = numFrames;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const voi = voiParams(vol, wc, ww);
    const id  = ctx.createImageData(nCols, numFrames);
    const d   = id.data;

    const CHUNK = 8;
    for (let z = 0; z < numFrames; z += CHUNK) {
        const end = Math.min(z + CHUNK, numFrames);
        for (let zi = z; zi < end; zi++) {
            const frame = frameViews[zi];
            for (let xi = 0; xi < nCols; xi++) {
                // Tangente por diferencias finitas
                const ax = archPts[Math.max(0, xi - 1)][0], ay = archPts[Math.max(0, xi - 1)][1];
                const bx = archPts[Math.min(nCols - 1, xi + 1)][0], by = archPts[Math.min(nCols - 1, xi + 1)][1];
                const tx = bx - ax, ty = by - ay;
                const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
                // Normal perpendicular en el plano axial (sentido de muestreo del slab)
                const nx = -ty / tlen, ny = tx / tlen;
                const cx = archPts[xi][0], cy = archPts[xi][1];

                let maxRaw = 0;
                for (let s = -half; s <= half; s++) {
                    const sx = Math.round(cx + s * nx);
                    const sy = Math.round(cy + s * ny);
                    if (sx < 0 || sx >= cols || sy < 0 || sy >= rows) continue;
                    const v = frame[sy * cols + sx];
                    if (v > maxRaw) maxRaw = v;
                }
                const g = applyVOI(maxRaw, voi);
                const p = (zi * nCols + xi) << 2;
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

// ── Render: Volumen 3D (ray casting isosuperficie) ────────────────────────────

/** Presets de transfer function para el render 3D */
export type Preset3D = 'tejido_duro' | 'tejido_blando' | 'piel' | 'dental' | 'mip3d';

interface TFEntry { huMin: number; huMax: number; r: number; g: number; b: number; aMin: number; aMax: number; }

const TF_PRESETS: Record<Preset3D, { threshold: number; entries: TFEntry[] }> = {
    // ámbar cálido estilo Romexis — hueso cortical hasta esmalte dental
    tejido_duro: {
        threshold: 150,
        entries: [
            { huMin:150,  huMax:350,  r:160, g:90,  b:20,  aMin:0,    aMax:0.35 },
            { huMin:350,  huMax:700,  r:200, g:130, b:30,  aMin:0.35, aMax:0.72 },
            { huMin:700,  huMax:1300, r:230, g:165, b:50,  aMin:0.72, aMax:0.92 },
            { huMin:1300, huMax:3000, r:255, g:205, b:100, aMin:0.92, aMax:1.0  },
        ],
    },
    tejido_blando: {
        threshold: 20,
        entries: [
            { huMin:20,  huMax:80,  r:200, g:140, b:120, aMin:0,   aMax:0.3 },
            { huMin:80,  huMax:200, r:210, g:160, b:130, aMin:0.3, aMax:0.6 },
            { huMin:200, huMax:500, r:220, g:170, b:100, aMin:0.6, aMax:0.9 },
        ],
    },
    piel: {
        threshold: -100,
        entries: [
            { huMin:-100, huMax:50, r:220, g:180, b:150, aMin:0,   aMax:0.4 },
            { huMin:50,  huMax:200, r:210, g:160, b:120, aMin:0.4, aMax:0.8 },
        ],
    },
    dental: {
        threshold: 250,
        entries: [
            { huMin:250,  huMax:550,  r:220, g:170, b:80,  aMin:0,    aMax:0.50 },
            { huMin:550,  huMax:1000, r:245, g:200, b:120, aMin:0.50, aMax:0.88 },
            { huMin:1000, huMax:2000, r:255, g:230, b:170, aMin:0.88, aMax:0.97 },
            { huMin:2000, huMax:3000, r:255, g:245, b:210, aMin:0.97, aMax:1.0  },
        ],
    },
    mip3d: {
        threshold: 0,
        entries: [
            { huMin:0,   huMax:500, r:150, g:150, b:150, aMin:0,   aMax:0.4 },
            { huMin:500, huMax:3000,r:255, g:255, b:255, aMin:0.4, aMax:1.0 },
        ],
    },
};

function tfColor(hu: number, preset: Preset3D): [number, number, number, number] {
    const p = TF_PRESETS[preset];
    if (hu < p.threshold) return [0, 0, 0, 0];
    for (const e of p.entries) {
        if (hu >= e.huMin && hu < e.huMax) {
            const t = (hu - e.huMin) / (e.huMax - e.huMin);
            const a = e.aMin + t * (e.aMax - e.aMin);
            return [e.r, e.g, e.b, a];
        }
    }
    const last = p.entries[p.entries.length - 1];
    return last ? [last.r, last.g, last.b, last.aMax] : [0, 0, 0, 0];
}

export async function render3DVolumeAsync(
    vol: DicomVolume,
    preset: Preset3D,
    canvas: HTMLCanvasElement,
    onProgress?: (pct: number) => void,
    rotX       = 20,    // pitch (grados) — negativo mira desde abajo
    rotY       = 15,    // yaw (grados)
    opacityMul = 1.0,   // multiplicador de opacidad (0-2)
    specMul    = 1.0,   // multiplicador especular (0-2)
    ambient    = 0.25,  // luz ambiente (0-1)
    diffuse    = 0.65,  // luz difusa (0-1)
    lowRes     = false, // modo rápido para previsualización
): Promise<void> {
    const { cols, rows, numFrames, frameViews, slope, intercept, pixelRep } = vol;

    const maxSide = lowRes ? 200 : 420;
    const outW = Math.min(cols, maxSide);
    const outH = Math.min(rows, maxSide);
    canvas.width  = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const id = ctx.createImageData(outW, outH);
    const d  = id.data;

    // ── Rotation matrix R = Rx(rotX) * Ry(rotY) ──────────────────────────────
    const rxR = rotX * Math.PI / 180;
    const ryR = rotY * Math.PI / 180;
    const cxr = Math.cos(rxR), sxr = Math.sin(rxR);
    const cyr = Math.cos(ryR), syr = Math.sin(ryR);

    // Camera basis vectors in volume space (right, up, look)
    const Rr = [cyr,        sxr * syr,  -cxr * syr] as const; // right
    const Ru = [0,          cxr,         sxr       ] as const; // up
    const Rl = [syr,       -sxr * cyr,   cxr * cyr ] as const; // look (into volume)

    // Volume centre
    const vcx = (cols - 1) / 2, vcy = (rows - 1) / 2, vcz = (numFrames - 1) / 2;

    // Ray extent
    const halfDiag = 0.62 * Math.sqrt(cols*cols + rows*rows + numFrames*numFrames);
    const STEP  = lowRes ? 3.0 : 2.0;
    const nStep = Math.ceil(2 * halfDiag / STEP);

    // Sample HU — nearest-neighbour, clamped
    function sHU(xi: number, yi: number, zi: number): number {
        const xc = Math.max(0, Math.min(cols-1,      Math.round(xi)));
        const yc = Math.max(0, Math.min(rows-1,      Math.round(yi)));
        const zc = Math.max(0, Math.min(numFrames-1, Math.round(zi)));
        let raw = frameViews[zc][yc * cols + xc];
        if (pixelRep && (raw & 0x8000)) raw -= 0x10000;
        return raw * slope + intercept;
    }

    // Precomputed light
    const lLen = Math.sqrt(0.45*0.45 + 0.70*0.70 + 0.55*0.55);
    const llx = -0.45/lLen, lly = -0.70/lLen, llz = 0.55/lLen;

    const tf    = TF_PRESETS[preset];
    const CHUNK = lowRes ? 30 : 4;

    for (let py = 0; py < outH; py += CHUNK) {
        const rowEnd = Math.min(py + CHUNK, outH);
        for (let pyi = py; pyi < rowEnd; pyi++) {
            const v = 0.5 - pyi / outH;   // +0.5 arriba → -0.5 abajo

            for (let pxi = 0; pxi < outW; pxi++) {
                const u = pxi / outW - 0.5;

                // Image-plane position (en espacio del volumen)
                const planX = vcx + u * cols * Rr[0] + v * rows * Ru[0];
                const planY = vcy + u * cols * Rr[1] + v * rows * Ru[1];
                const planZ = vcz + u * cols * Rr[2] + v * rows * Ru[2];

                // Ray: arranca desde la "cara trasera" y avanza en la dirección look
                const sX = planX - halfDiag * Rl[0];
                const sY = planY - halfDiag * Rl[1];
                const sZ = planZ - halfDiag * Rl[2];

                let accR = 0, accG = 0, accB = 0, accA = 0;

                for (let s = 0; s < nStep; s++) {
                    const t = s * STEP;
                    const vx = sX + t * Rl[0];
                    const vy = sY + t * Rl[1];
                    const vz = sZ + t * Rl[2];

                    if (vx < 0 || vx >= cols || vy < 0 || vy >= rows || vz < 0 || vz >= numFrames) continue;

                    const hu = sHU(vx, vy, vz);
                    if (hu < tf.threshold) continue;

                    const [cr, cg, cb, ca] = tfColor(hu, preset);
                    if (ca <= 0) continue;

                    const caS = Math.min(1, ca * opacityMul);

                    // Gradiente central para normal de superficie
                    const xi = Math.round(vx), yi = Math.round(vy), zi = Math.round(vz);
                    const gx = sHU(xi+1,yi,zi) - sHU(xi-1,yi,zi);
                    const gy = sHU(xi,yi+1,zi) - sHU(xi,yi-1,zi);
                    const gz = sHU(xi,yi,zi+1) - sHU(xi,yi,zi-1);
                    const gL = Math.sqrt(gx*gx + gy*gy + gz*gz) || 1;
                    const nx = gx/gL, ny = gy/gL, nz = gz/gL;

                    const dot   = nx*llx + ny*lly + nz*llz;
                    const diff2 = Math.max(0, -dot);
                    const spec  = Math.pow(Math.max(0, -dot * nz + llz * 0.5), 8) * 0.3 * specMul;
                    const light = ambient + diffuse * diff2 + spec;

                    const oA = 1 - accA;
                    const cn = caS * oA;
                    accR += cn * Math.min(255, cr * light);
                    accG += cn * Math.min(255, cg * light);
                    accB += cn * Math.min(255, cb * light);
                    accA += cn;

                    if (accA >= 0.98) break;
                }

                const idx = (pyi * outW + pxi) * 4;
                d[idx]   = Math.round(Math.min(255, accR));
                d[idx+1] = Math.round(Math.min(255, accG));
                d[idx+2] = Math.round(Math.min(255, accB));
                d[idx+3] = 255;
            }
        }
        ctx.putImageData(id, 0, 0);
        onProgress?.(rowEnd / outH);
        await new Promise<void>(r => setTimeout(r, 0));
    }
    ctx.putImageData(id, 0, 0);
}

// ── Render: cortes transversales perpendiculares al arco ──────────────────────

/**
 * Renderiza la sección transversal #sectionIdx (0-based) de nSections totales
 * distribuidas uniformemente a lo largo del arco dental.
 * Output: width = halfWidth*2 (perpendicular al arco), height = numFrames (eje Z).
 */
export function renderArchTransversal(
    vol: DicomVolume,
    controls: Array<[number, number]>,
    sectionIdx: number,
    nSections: number,
    halfWidth: number,
    slabHalf: number,
    wc: number, ww: number,
    canvas: HTMLCanvasElement,
): void {
    if (controls.length < 2) { canvas.width = 4; canvas.height = 4; return; }

    const { cols, rows, numFrames, frameViews } = vol;
    const W = halfWidth * 2;
    canvas.width  = W;
    canvas.height = numFrames;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dense arch sample (400 pts)
    const archPts = sampleArchSpline(controls, 400);
    const n = archPts.length;

    // Position along arch for this section (evenly spaced, avoid endpoints)
    const t = (sectionIdx + 0.5) / nSections;
    const ptIdx = Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));

    // Tangent via central difference
    const ax = archPts[Math.max(0, ptIdx - 3)][0], ay = archPts[Math.max(0, ptIdx - 3)][1];
    const bx = archPts[Math.min(n - 1, ptIdx + 3)][0], by = archPts[Math.min(n - 1, ptIdx + 3)][1];
    const tx = bx - ax, ty = by - ay;
    const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
    const tux = tx / tlen, tuy = ty / tlen;   // unit tangent
    const nx = -tuy, ny = tux;                 // unit normal (perpendicular)

    const cx = archPts[ptIdx][0], cy = archPts[ptIdx][1];
    const voi = voiParams(vol, wc, ww);
    const id  = ctx.createImageData(W, numFrames);
    const d   = id.data;

    for (let z = 0; z < numFrames; z++) {
        const frame = frameViews[z];
        for (let x = 0; x < W; x++) {
            const offset = x - halfWidth;
            const pcol = cx + nx * offset;
            const prow = cy + ny * offset;

            // MIP slab along arch tangent direction
            let maxRaw = 0;
            for (let s = -slabHalf; s <= slabHalf; s++) {
                const sc = Math.round(pcol + tux * s);
                const sr = Math.round(prow + tuy * s);
                if (sc < 0 || sc >= cols || sr < 0 || sr >= rows) continue;
                const v = frame[sr * cols + sc];
                if (v > maxRaw) maxRaw = v;
            }
            const g = applyVOI(maxRaw, voi);
            const p = (z * W + x) << 2;
            d[p] = d[p + 1] = d[p + 2] = g; d[p + 3] = 255;
        }
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
