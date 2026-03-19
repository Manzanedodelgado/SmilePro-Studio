
// ─────────────────────────────────────────────────────────────────
//  services/invoice-parser.service.ts
//  Extrae datos estructurados de facturas desde:
//    • Cuerpo de email (texto plano)
//    • Adjuntos PDF (pdf.js — lectura de texto en browser)
//  Mejoras v2:
//    • Descarga PDFs adjuntos y extrae texto
//    • Extrae nombre real del proveedor (NIF/CIF + razón social)
//    • Categoriza conceptos automáticamente
//    • Soporte para enlaces a portales de facturación
// ─────────────────────────────────────────────────────────────────

import type { GmailInvoiceEmail } from './gmail.service';
import { downloadAttachment } from './gmail.service';
import { authFetch } from './db';

export interface FacturaExtraida {
    // Identificación
    gmail_message_id: string;
    enlace_gmail: string;

    // Datos proveedor
    proveedor: string;          // Nombre real extraído de la factura
    proveedor_email: string;
    proveedor_cif: string | null;

    // Datos factura
    numero_factura: string | null;
    fecha_email: string;        // ISO
    fecha_factura: string | null;
    concepto: string;           // Asunto del email
    categoria: string | null;   // Categoría auto-detectada

    // Importes
    base_imponible: number | null;
    iva_pct: number | null;     // e.g. 21, 10, 4, 0
    total: number | null;

    // Meta
    tiene_adjunto: boolean;
    nombre_adjunto: string | null;
    pdf_preview_url: string | null;     // blob: URL for PDF preview
    enlace_factura_portal: string | null; // Link inside email to view/download invoice
    estado: 'pendiente' | 'cruzado' | 'descartado';
    raw_snippet: string;
}

// ── Helpers de regex ─────────────────────────────────────────────

/** Limpia y parsea un string de importe español/europeo a número */
function parseAmount(s: string): number | null {
    if (!s) return null;
    const cleaned = s.replace(/[€$£\s]/g, '')
        .replace(/\.(\d{3}),/g, '$1.')
        .replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
}

/** Extraer un importe de un texto usando uno o varios patrones */
function findAmount(text: string, patterns: RegExp[]): number | null {
    for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]) {
            const n = parseAmount(m[1]);
            if (n !== null && n > 0) return n;
        }
    }
    return null;
}

// ── Parsers por campo ────────────────────────────────────────────

const reFacturaNum = [
    /[Ff]actura[:\s#nNº]*\s*([A-Z0-9\-\/]{4,20})/,
    /[Ii]nvoice[:\s#]*\s*([A-Z0-9\-\/]{4,20})/,
    /[Rr]echnung[:\s#]*\s*([A-Z0-9\-\/]{4,20})/,
    /\b(?:Nº|No|Ref\.?)[:\s]*([A-Z0-9\-\/]{4,20})/i,
    /\b(F(?:ACT)?[\-\/]?\d{4}[\-\/]\d{2,6})\b/i,
    /\b(INV[\-\/\s]?\d{4}[\-\/]?\d{1,6})\b/i,
];

const reTotal = [
    /[Tt]otal\s*(?:a pagar|factura)?[:\s€]*(\d[\d.,]*\s*€?)/,
    /[Ii]mporte\s*(?:total)?[:\s€]*(\d[\d.,]*\s*€?)/,
    /TOTAL[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))\s*€/,
    /€\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/,
    /Total amount[:\s]+(\d[\d.,]+)/i,
    /Gesamtbetrag[:\s]+(\d[\d.,]+)/i,
];

const reBase = [
    /[Bb]ase\s*(?:imponible)?[:\s€]*(\d[\d.,]+)/,
    /[Ss]ubtotal[:\s€]*(\d[\d.,]+)/,
    /[Nn]et(?:o)?\s*(?:amount)?[:\s€]*(\d[\d.,]+)/i,
    /[Nn]eto[:\s€]*(\d[\d.,]+)/,
];

const reIVA = [
    /IVA\s*(\d{1,2})\s*%/i,
    /VAT\s*(\d{1,2})\s*%/i,
    /MwSt\.?\s*(\d{1,2})\s*%/i,
    /I\.V\.A\.\s*(\d{1,2})\s*%/i,
];

const reDate = [
    /[Ff]echa\s*(?:de\s*)?(?:factura|emisión)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    /[Dd]ate[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    /[Dd]atum[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
];

// ── CIF / NIF del proveedor ──────────────────────────────────────

const reCIF = [
    /(?:CIF|NIF|N\.I\.F\.|C\.I\.F\.)[:\s]*([A-Z]\d{7,8}[A-Z0-9]?)/i,
    /(?:VAT\s*(?:ID|No)?|Tax\s*ID)[:\s]*([A-Z]{2}\d{7,12})/i,
    /\b([A-HJ-NP-SUVW]\d{7}[A-J0-9])\b/,  // Spanish CIF format
];

// ── Nombre real del proveedor (NO el From del email) ─────────────

const reProveedorNombre = [
    // "Razón social:" or "Nombre:" at start of invoice
    /(?:Raz[oó]n\s*social|Nombre\s*(?:fiscal|empresa)|Company\s*name)[:\s]*(.{3,60}?)[\n\r,]/i,
    // "Emitida por:" 
    /(?:Emitida?\s*por|Issued\s*by|Ausgestellt\s*von)[:\s]*(.{3,60}?)[\n\r,]/i,
    // Line right before or after CIF
    /([A-Z][A-Za-záéíóúñÁÉÍÓÚÑ\s&.,]{3,50})\s*(?:CIF|NIF|N\.I\.F)/i,
    /(?:CIF|NIF)[:\s]*[A-Z0-9]+[\s\n\r]*(.{3,50}?)[\n\r]/i,
];

// ── Categorización automática de conceptos ───────────────────────

interface CategoriaRule {
    categoria: string;
    keywords: RegExp;
}

const CATEGORIAS: CategoriaRule[] = [
    { categoria: '🦷 Material dental', keywords: /dental|implante|composite|endodon|esteriliz|guant|jering|aguja|bracket|ortodoncia|protesi|corona|pr[oó]tesis/i },
    { categoria: '💊 Farmacia/Medicamento', keywords: /farmac|medicament|anestes|lidocain|articain|medicin/i },
    { categoria: '🔬 Laboratorio', keywords: /laborat|prótesis\s*dental|lab\s*dental|colado|encerado|zirconio|porcelana/i },
    { categoria: '⚡ Electricidad', keywords: /electric|luz|iberdrola|endesa|naturgy|energía|kwh|consumo\s*eléctrico/i },
    { categoria: '💧 Agua', keywords: /agua|canal de isabel|aguas de/i },
    { categoria: '🔥 Gas', keywords: /\bgas\b|repsol\s*gas|naturgy.*gas/i },
    { categoria: '📡 Telecomunicaciones', keywords: /telef[oó]nica|movistar|vodafone|orange|m[oó]vil|internet|fibra|telecomunicacion/i },
    { categoria: '🏥 Seguros', keywords: /segur|p[oó]liza|asisa|sanitas|axa|mapfre|zurich|mutua|caser|responsabilidad\s*civil/i },
    { categoria: '🏠 Alquiler/Local', keywords: /alquiler|arrendamiento|renta|local\s*comercial|comunidad\s*de\s*propietarios/i },
    { categoria: '🧹 Limpieza/Mantenimiento', keywords: /limpie|mantenimiento|desinfec|climatizaci|aire\s*acondicionado|extintores/i },
    { categoria: '💻 Software/IT', keywords: /software|licencia|informática|hosting|dominio|servidor|cloud|saas|erp|crm/i },
    { categoria: '📋 Asesoría/Gestoría', keywords: /asesor|gestor|contabilidad|fiscal|abogad|notar|legal|trámit/i },
    { categoria: '👥 RRHH/Nóminas', keywords: /n[oó]mina|salari|seguridad\s*social|prevenci[oó]n|riesgos\s*laborales|mutua.*accidentes/i },
    { categoria: '📦 Mensajería/Transporte', keywords: /mensajer|transporte|env[ioí]|correos|seur|mrw|dhl|ups|fedex|logística/i },
    { categoria: '🖨️ Material oficina', keywords: /oficina|papel|t[oó]ner|impresora|material\s*de\s*oficina/i },
    { categoria: '📢 Marketing/Publicidad', keywords: /marketing|publicidad|google\s*ads|redes\s*sociales|dise[ñn]o|web|seo|publicaci/i },
    { categoria: '🏦 Servicio bancario', keywords: /banco|bancario|comisi[oó]n|tarjeta|tpv|datáfono|sabadell|santander|caixa|bbva/i },
    { categoria: '🎓 Formación', keywords: /formaci[oó]n|curso|congreso|seminario|postgrado|máster|certific/i },
];

function detectCategoria(text: string, subject: string): string | null {
    const combined = `${subject} ${text}`.toLowerCase();
    for (const rule of CATEGORIAS) {
        if (rule.keywords.test(combined)) return rule.categoria;
    }
    return null;
}

// ── Parse helpers ────────────────────────────────────────────────

function parseDate(text: string): string | null {
    for (const re of reDate) {
        const m = text.match(re);
        if (m) {
            const raw = m[0].match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (raw) {
                const [, d, mo, y] = raw;
                return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        }
    }
    return null;
}

function parseNumeroFactura(text: string, subject: string): string | null {
    for (const re of reFacturaNum) {
        const m = (subject + '\n' + text).match(re);
        if (m?.[1] && m[1].length >= 4) return m[1].trim();
    }
    return null;
}

function parseIvaPct(text: string): number | null {
    for (const re of reIVA) {
        const m = text.match(re);
        if (m?.[1]) {
            const n = parseInt(m[1]);
            if ([0, 4, 10, 21].includes(n)) return n;
        }
    }
    if (/exento|exempt|exento de iva/i.test(text)) return 0;
    return null;
}

function parseCIF(text: string): string | null {
    for (const re of reCIF) {
        const m = text.match(re);
        if (m?.[1]) return m[1].toUpperCase();
    }
    return null;
}

/** Try to extract the REAL provider name from invoice text (not from email From) */
function parseProveedorNombre(text: string, emailFrom: string): string {
    for (const re of reProveedorNombre) {
        const m = text.match(re);
        if (m?.[1]) {
            const name = m[1].trim().replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
            if (name.length >= 3 && name.length <= 60) return name;
        }
    }
    // Fallback: try to extract a company name from the first few lines of text
    const lines = text.split(/[\n\r]+/).slice(0, 10);
    for (const line of lines) {
        const trimmed = line.trim();
        // Heuristic: a line that looks like a company name (starts with uppercase, 3-50 chars, 
        // contains mostly letters, not a date/amount)
        if (
            trimmed.length >= 5 && trimmed.length <= 50 &&
            /^[A-ZÁÉÍÓÚÑ]/.test(trimmed) &&
            !/^\d/.test(trimmed) &&
            !/total|factura|fecha|base|iva|subtotal|importe/i.test(trimmed) &&
            !/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(trimmed) &&
            !/^\d[\d.,]+\s*€/.test(trimmed)
        ) {
            return trimmed;
        }
    }
    // Last resort: use cleaned-up email From
    return emailFrom
        .replace(/<[^>]+>/, '')
        .replace(/^"|"$/g, '')
        .replace(/noreply|no-reply|automatico|info@|admin@|facturas@|facturacion@/gi, '')
        .trim() || emailFrom;
}

// ── PDF text extraction (pdf.js) ─────────────────────────────────

/** Extract plain text from a PDF given as base64url string */
async function extractPdfText(base64url: string): Promise<string> {
    try {
        // eslint-disable-next-line no-new-func
        const cdnImport = new Function('url', 'return import(url)');
        const pdfjsModule = await cdnImport(
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/+esm'
        ).catch(() => null);

        if (!pdfjsModule) return '';

        if (pdfjsModule.GlobalWorkerOptions) {
            pdfjsModule.GlobalWorkerOptions.workerSrc =
                'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js';
        }

        const std = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(std);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const pdf = await pdfjsModule.getDocument({ data: bytes }).promise;
        let text = '';
        for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            text += (content.items as { str?: string }[]).map(item => item.str ?? '').join(' ') + '\n';
        }
        return text;
    } catch {
        return '';
    }
}

/** Create a blob URL for PDF preview from base64url data */
function createPdfBlobUrl(base64url: string): string | null {
    try {
        const std = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(std);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

// ── Extract invoice portal links from HTML ──────────────────────

/** Keywords in anchor text or href that indicate an invoice link */
const INVOICE_LINK_KEYWORDS = /factura|invoice|rechnung|descarga|download|ver.*factura|consulta.*factura|acceder.*factura|tu\s*factura|your\s*invoice|factura.*online|factura.*pdf/i;

/** Domains/patterns to EXCLUDE (tracking, unsubscribe, social, etc.) */
const EXCLUDE_LINKS = /unsub|track|click\.|pixel|facebook|twitter|instagram|linkedin|youtube|mailto:|tel:|/i;

/**
 * Extract invoice-related links from the HTML body of an email.
 * Looks for <a href="..."> tags whose text or URL contain invoice keywords.
 * Returns the best matching URL, or null.
 */
function extractInvoicePortalLinks(html: string): string | null {
    if (!html) return null;

    // Match all <a> tags with href
    const linkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    const candidates: { url: string; score: number }[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
        const url = match[1];
        const anchorText = match[2].replace(/<[^>]+>/g, '').trim(); // strip inner HTML tags

        // Skip excluded links
        if (EXCLUDE_LINKS.test(url)) continue;
        if (url.startsWith('#') || url.length < 10) continue;

        let score = 0;
        // Anchor text matches invoice keywords → high score
        if (INVOICE_LINK_KEYWORDS.test(anchorText)) score += 10;
        // URL itself matches invoice keywords → moderate score
        if (INVOICE_LINK_KEYWORDS.test(url)) score += 5;
        // Contains "pdf" in url → bonus
        if (/\.pdf/i.test(url)) score += 3;

        if (score > 0) {
            candidates.push({ url, score });
        }
    }

    if (candidates.length === 0) return null;
    // Return the highest-scoring link
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;
}

// ── Main parser ──────────────────────────────────────────────────

/**
 * Parse a GmailInvoiceEmail into a structured FacturaExtraida.
 * Downloads PDF attachments for parsing + preview.
 */
export const parseInvoiceEmail = async (
    email: GmailInvoiceEmail,
): Promise<FacturaExtraida> => {
    // 1. Start with email body text
    let text = email.bodyText || email.snippet || '';
    let pdfBlobUrl: string | null = null;

    // 2. Download and parse PDF attachment if present
    const pdfAttachment = email.attachments.find(a =>
        a.mimeType === 'application/pdf' ||
        a.filename.toLowerCase().endsWith('.pdf')
    );

    if (pdfAttachment && !email.id.startsWith('mock-')) {
        try {
            const pdfData = await downloadAttachment(email.id, pdfAttachment.id);
            if (pdfData) {
                // Create preview URL
                pdfBlobUrl = createPdfBlobUrl(pdfData);
                // Extract text from PDF
                const pdfText = await extractPdfText(pdfData);
                if (pdfText.length > 20) {
                    // PDF text is likely more accurate, prepend it
                    text = pdfText + '\n---EMAIL---\n' + text;
                }
            }
        } catch { /* continue with email body only */ }
    }

    // 3. Extract fields
    const total = findAmount(text, reTotal);
    const base = findAmount(text, reBase);
    const ivaPct = parseIvaPct(text);

    let baseImponible = base;
    if (!baseImponible && total !== null && ivaPct !== null && ivaPct > 0) {
        baseImponible = Math.round((total / (1 + ivaPct / 100)) * 100) / 100;
    }

    // 4. Extract real provider name from invoice content (not From header)
    const proveedor = parseProveedorNombre(text, email.de);
    const proveedorCif = parseCIF(text);

    // 5. Detect category
    const categoria = detectCategoria(text, email.asunto);

    // 6. Extract invoice portal link from HTML body
    const enlaceFacturaPortal = extractInvoicePortalLinks(email.bodyHtml);

    const attachment = email.attachments[0] ?? null;

    return {
        gmail_message_id: email.id,
        enlace_gmail: email.enlaceGmail,
        proveedor,
        proveedor_email: email.deEmail,
        proveedor_cif: proveedorCif,
        numero_factura: parseNumeroFactura(text, email.asunto),
        fecha_email: email.fecha,
        fecha_factura: parseDate(text),
        concepto: email.asunto,
        categoria,
        base_imponible: baseImponible,
        iva_pct: ivaPct,
        total,
        tiene_adjunto: email.hasAttachment,
        nombre_adjunto: attachment?.filename ?? null,
        pdf_preview_url: pdfBlobUrl,
        enlace_factura_portal: enlaceFacturaPortal,
        estado: 'pendiente',
        raw_snippet: email.snippet.slice(0, 300),
    };
};

/**
 * Batch-parse multiple invoice emails.
 * Downloads PDFs, extracts text, categorizes, and auto-saves to the backend.
 */
export const parseAllInvoiceEmails = async (
    emails: GmailInvoiceEmail[],
): Promise<FacturaExtraida[]> => {
    // Parse sequentially to avoid overwhelming Gmail API with parallel attachment downloads
    const results: FacturaExtraida[] = [];
    for (const e of emails) {
        const parsed = await parseInvoiceEmail(e);
        results.push(parsed);
    }
    const sorted = results.sort((a, b) => b.fecha_email.localeCompare(a.fecha_email));

    // Persist en el backend en segundo plano
    saveFacturasToBackend(sorted).catch(() => {/* silent */ });

    return sorted;
};

// ── Backend persistence (facturas de email) ───────────────────────

const API_URL = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:3000') as string;

/**
 * Guarda facturas extraídas en el backend Node.js.
 * Usa gmail_message_id como clave de idempotencia.
 */
export const saveFacturasToBackend = async (
    facturas: FacturaExtraida[],
): Promise<void> => {
    if (!API_URL || facturas.length === 0) return;

    const real = facturas.filter(f => !f.gmail_message_id.startsWith('mock-'));
    if (real.length === 0) return;

    const rows = real.map(f => ({
        gmail_message_id: f.gmail_message_id,
        enlace_gmail: f.enlace_gmail,
        proveedor_extraido: f.proveedor,
        numero_factura: f.numero_factura,
        fecha_factura: f.fecha_factura,
        base_imponible: f.base_imponible,
        iva_pct: f.iva_pct,
        total: f.total,
        estado: f.estado,
    }));

    await authFetch(`${API_URL}/api/accounting/email-invoices/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
    }).catch(() => { /* silencioso — no bloquea el flujo */ });
};

/**
 * Carga facturas guardadas desde el backend Node.js.
 */
export const loadFacturasFromBackend = async (): Promise<FacturaExtraida[]> => {
    if (!API_URL) return [];
    try {
        const res = await authFetch(
            `${API_URL}/api/accounting/email-invoices?order=fecha_email.desc&limit=200`,
        );
        if (!res.ok) return [];
        const rows = await res.json() as Record<string, unknown>[];
        return rows.map(r => ({
            gmail_message_id: String(r.gmail_message_id ?? ''),
            enlace_gmail: String(r.enlace_gmail ?? ''),
            proveedor: String(r.proveedor_extraido ?? r.proveedor ?? ''),
            proveedor_email: String(r.proveedor_email ?? ''),
            proveedor_cif: r.proveedor_cif ? String(r.proveedor_cif) : null,
            numero_factura: r.numero_factura ? String(r.numero_factura) : null,
            fecha_email: String(r.fecha_email ?? new Date().toISOString()),
            fecha_factura: r.fecha_factura ? String(r.fecha_factura) : null,
            concepto: String(r.concepto ?? ''),
            categoria: r.categoria ? String(r.categoria) : null,
            base_imponible: r.base_imponible !== null ? Number(r.base_imponible) : null,
            iva_pct: r.iva_pct !== null ? Number(r.iva_pct) : null,
            total: r.total !== null ? Number(r.total) : null,
            tiene_adjunto: Boolean(r.tiene_adjunto),
            nombre_adjunto: r.nombre_adjunto ? String(r.nombre_adjunto) : null,
            pdf_preview_url: null,
            enlace_factura_portal: r.enlace_factura_portal ? String(r.enlace_factura_portal) : null,
            estado: (r.estado as FacturaExtraida['estado']) ?? 'pendiente',
            raw_snippet: String(r.raw_snippet ?? ''),
        }));
    } catch {
        return [];
    }
};

/**
 * Actualiza el estado de una factura en el backend.
 */
export const updateFacturaEstado = async (
    gmailMessageId: string,
    estado: FacturaExtraida['estado'],
): Promise<void> => {
    if (!API_URL || gmailMessageId.startsWith('mock-')) return;
    await authFetch(
        `${API_URL}/api/accounting/email-invoices/${encodeURIComponent(gmailMessageId)}/estado`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado }),
        },
    ).catch(() => { /* silencioso */ });
};

// ── Aliases de compatibilidad (los nombres nuevos son los correctos) ──
export const saveFacturasToSupabase = saveFacturasToBackend;
export const loadFacturasFromSupabase = loadFacturasFromBackend;
