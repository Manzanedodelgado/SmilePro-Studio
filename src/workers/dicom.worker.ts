/**
 * dicom.worker.ts — Parsing DICOM en un Web Worker
 *
 * Mueve la carga CPU/memoria fuera del hilo principal para que
 * archivos CBCT grandes (>100 MB) no congelen ni crashen el browser.
 *
 * Protocolo de mensajes:
 *   main → worker:  { file: File }
 *   worker → main:  { type: 'progress', pct: number }
 *                 | { type: 'done', meta: DicomMeta, pixelBuffer: ArrayBuffer, rows: number, cols: number, numFrames: number }
 *                 | { type: 'error', message: string }
 */

import dicomParser from 'dicom-parser';

// ── Tipos transferidos ────────────────────────────────────────────────────────

export interface DicomMeta {
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
    pixelSpacing?: [number, number];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Handler ───────────────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent<{ file: File }>) => {
    try {
        const { file } = e.data;

        self.postMessage({ type: 'progress', pct: 5 });

        const buffer = await file.arrayBuffer();

        self.postMessage({ type: 'progress', pct: 30 });

        const bytes = new Uint8Array(buffer);
        const dataset = dicomParser.parseDicom(bytes);

        self.postMessage({ type: 'progress', pct: 60 });

        const rows        = u16(dataset, 'x00280010') ?? 512;
        const cols        = u16(dataset, 'x00280011') ?? 512;
        const numFrames   = parseInt(ds(dataset, 'x00280008') ?? '1', 10) || 1;
        const bitsAlloc   = u16(dataset, 'x00280100') ?? 16;
        const bitsStored  = u16(dataset, 'x00280101') ?? 12;
        const pixelRep    = u16(dataset, 'x00280103') ?? 0;
        const photometric = ds(dataset, 'x00280004') ?? 'MONOCHROME2';
        const slope       = f32(ds(dataset, 'x00281053')) ?? 1;
        const intercept   = f32(ds(dataset, 'x00281052')) ?? -1024;
        const modality    = ds(dataset, 'x00080060') ?? 'CT';
        const manufacturer = ds(dataset, 'x00080070');
        const studyDate   = ds(dataset, 'x00080020');
        const patientId   = ds(dataset, 'x00100020');
        const description = ds(dataset, 'x00081030');

        const wcStr = ds(dataset, 'x00281050');
        const wwStr = ds(dataset, 'x00281051');
        let wc = f32(wcStr) ?? 0;
        let ww = f32(wwStr) ?? 0;

        let pixelSpacing: [number, number] | undefined;
        const psStr = ds(dataset, 'x00280030');
        if (psStr) {
            const parts = psStr.split('\\');
            const r = parseFloat(parts[0] ?? '');
            const c = parseFloat(parts[1] ?? parts[0] ?? '');
            if (!isNaN(r) && !isNaN(c) && r > 0 && c > 0) pixelSpacing = [r, c];
        }

        // Pixel data
        const pixEl = dataset.elements['x7fe00010'];
        if (!pixEl) throw new Error('No pixel data in DICOM file');

        const framePixels = rows * cols;
        const frameBytes  = framePixels * (bitsAlloc / 8);
        const totalPixels = numFrames * framePixels;

        // Allocate a fresh buffer (no shared refs to the full file buffer)
        const pixelBuffer = new ArrayBuffer(totalPixels * 2);
        const allPixels   = new Uint16Array(pixelBuffer);

        const maxBytes = buffer.byteLength - pixEl.dataOffset;
        const dataLen  = Math.min(frameBytes * numFrames, maxBytes);
        const src      = new DataView(buffer, pixEl.dataOffset, dataLen);
        const maxPx    = Math.floor(dataLen / 2);

        for (let i = 0; i < Math.min(totalPixels, maxPx); i++) {
            allPixels[i] = src.getUint16(i * 2, true);
        }

        self.postMessage({ type: 'progress', pct: 85 });

        // Auto window si los tags no existen o son inválidos
        if (!wcStr || !wwStr || ww <= 1) {
            const midStart = Math.floor(numFrames / 2) * framePixels;
            let lo = Infinity, hi = -Infinity;
            for (let i = midStart; i < midStart + framePixels; i++) {
                let v = allPixels[i];
                if (pixelRep && (v & 0x8000)) v = v - 0x10000;
                const hu = v * slope + intercept;
                if (hu < lo) lo = hu;
                if (hu > hi) hi = hu;
            }
            wc = (lo + hi) / 2;
            ww = Math.max(1, hi - lo);
        }

        const meta: DicomMeta = {
            rows, cols, numFrames, bitsAlloc, bitsStored, pixelRep, photometric,
            slope, intercept, modality, manufacturer, studyDate, patientId, description,
            defaultWC: wc, defaultWW: ww, pixelSpacing,
        };

        self.postMessage({ type: 'progress', pct: 100 });

        // Transferimos el pixelBuffer (zero-copy) — tras esto el worker ya no puede accederlo
        self.postMessage({ type: 'done', meta, pixelBuffer }, [pixelBuffer]);

    } catch (err) {
        self.postMessage({ type: 'error', message: (err as Error).message });
    }
};
