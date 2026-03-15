
// ─────────────────────────────────────────────────────────────────
//  services/gmail.service.ts
//  Gmail API — extracción automática de facturas de proveedores
//  Cuenta: info@rubiogarciandental.com
//
//  Autenticación: OAuth2 (Client ID + Client Secret)
//  Flujo: El usuario pulsa "Conectar Gmail" → popup Google →
//         obtiene auth code → intercambia por tokens →
//         stored en localStorage para uso continuo.
//
//  Variables (.env.local):
//    VITE_GMAIL_CLIENT_ID       = 603784757474-...googleusercontent.com
//    VITE_GMAIL_CLIENT_SECRET   = GOCSPX-...
//    VITE_GMAIL_USER_EMAIL      = info@rubiogarciandental.com
// ─────────────────────────────────────────────────────────────────

import { logger } from './logger';

const fetchWithTimeout = (url: string, opts: RequestInit = {}, ms = 30_000): Promise<Response> => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
};

const CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID as string | undefined;
const CLIENT_SECRET = import.meta.env.VITE_GMAIL_CLIENT_SECRET as string | undefined;
const USER_EMAIL = import.meta.env.VITE_GMAIL_USER_EMAIL ?? 'info@rubiogarciandental.com';

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const REDIRECT_URI = () => `${window.location.origin}/`;
const LS_KEY = 'gmail_oauth_tokens';

export const isGmailConfigured = (): boolean => Boolean(CLIENT_ID && CLIENT_SECRET);

// ── Types ───────────────────────────────────────────────────────────

export interface GmailInvoiceEmail {
    id: string;
    threadId: string;
    fecha: string;
    de: string;
    deEmail: string;
    asunto: string;
    snippet: string;
    hasAttachment: boolean;
    attachments: GmailAttachment[];
    bodyText: string;
    bodyHtml: string;   // HTML body — needed to extract portal links
    enlaceGmail: string;
}

export interface GmailAttachment {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    data?: string;
}

// ── OAuth2 Token Management ─────────────────────────────────────────

interface OAuthTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number; // epoch ms
}

/** Check if user has already authorized Gmail */
export const isGmailAuthorized = (): boolean => {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return false;
    try {
        const tokens: OAuthTokens = JSON.parse(stored);
        return Boolean(tokens.refresh_token);
    } catch { return false; }
};

/** Remove stored tokens (disconnect Gmail) */
export const disconnectGmail = (): void => {
    localStorage.removeItem(LS_KEY);
};

/**
 * Redirect the user to Google's OAuth2 consent page.
 * After consent, Google redirects back to our origin with ?code=...&state=gmail_auth
 * handleOAuthRedirect() will catch that on page load.
 */
export const startGmailAuth = (): void => {
    if (!CLIENT_ID) return;

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI(),
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        login_hint: USER_EMAIL,
        state: 'gmail_auth',
    });

    // Direct redirect — most reliable
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

/**
 * Check URL on page load — if returning from OAuth redirect (non-popup fallback)
 */
export const handleOAuthRedirect = async (): Promise<boolean> => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'gmail_auth') {
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return exchangeCodeForTokens(code);
    }
    return false;
};

/** Exchange auth code for access_token + refresh_token */
async function exchangeCodeForTokens(code: string): Promise<boolean> {
    if (!CLIENT_ID || !CLIENT_SECRET) return false;
    try {
        const res = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI(),
                grant_type: 'authorization_code',
            }),
        });
        if (!res.ok) {
            logger.error('[Gmail] Token exchange failed', await res.text());
            return false;
        }
        const data = await res.json();
        const tokens: OAuthTokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + (data.expires_in - 60) * 1000,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(tokens));
        return true;
    } catch (e) {
        logger.error('[Gmail] Token exchange error', e);
        return false;
    }
}

/** Get a valid access_token, refreshing if needed */
async function getAccessToken(): Promise<string | null> {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return null;

    let tokens: OAuthTokens;
    try { tokens = JSON.parse(stored); } catch { return null; }

    // Token still valid?
    if (tokens.access_token && Date.now() < tokens.expires_at) {
        return tokens.access_token;
    }

    // Refresh
    if (!tokens.refresh_token || !CLIENT_ID || !CLIENT_SECRET) return null;
    try {
        const res = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                refresh_token: tokens.refresh_token,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'refresh_token',
            }),
        });
        if (!res.ok) {
            logger.error('[Gmail] Refresh failed', await res.text());
            disconnectGmail();
            return null;
        }
        const data = await res.json();
        tokens.access_token = data.access_token;
        tokens.expires_at = Date.now() + (data.expires_in - 60) * 1000;
        localStorage.setItem(LS_KEY, JSON.stringify(tokens));
        return tokens.access_token;
    } catch {
        return null;
    }
}

// ── Gmail API helpers ───────────────────────────────────────────────

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailGet<T>(path: string, token: string): Promise<T> {
    const res = await fetchWithTimeout(`${GMAIL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
    return res.json();
}

/** Decode base64url string to UTF-8 text */
function decodeBase64(b64: string): string {
    const std = b64.replace(/-/g, '+').replace(/_/g, '/');
    try {
        return decodeURIComponent(escape(atob(std)));
    } catch {
        return atob(std);
    }
}

interface GmailPayload {
    mimeType: string;
    filename?: string;
    body?: { data?: string; attachmentId?: string; size?: number };
    parts?: GmailPayload[];
    headers?: { name: string; value: string }[];
}

/** Recursively extract text/plain body from MIME parts */
function extractBodyText(payload: GmailPayload): string {
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
        return decodeBase64(payload.body.data);
    }
    if (payload.parts) {
        for (const part of payload.parts) {
            const t = extractBodyText(part);
            if (t) return t;
        }
    }
    return '';
}

/** Recursively extract text/html body from MIME parts */
function extractBodyHtml(payload: GmailPayload): string {
    if (payload.mimeType === 'text/html' && payload.body?.data) {
        return decodeBase64(payload.body.data);
    }
    if (payload.parts) {
        for (const part of payload.parts) {
            const t = extractBodyHtml(part);
            if (t) return t;
        }
    }
    return '';
}

/** Collect attachments from MIME tree */
function extractAttachments(payload: GmailPayload): GmailAttachment[] {
    const out: GmailAttachment[] = [];
    const walk = (p: GmailPayload) => {
        if (p.filename && p.filename.length > 0 && p.body?.attachmentId) {
            out.push({
                id: p.body.attachmentId,
                filename: p.filename,
                mimeType: p.mimeType,
                size: p.body.size ?? 0,
            });
        }
        p.parts?.forEach(walk);
    };
    walk(payload);
    return out;
}

// ── Search query ────────────────────────────────────────────────────

const INVOICE_QUERY = [
    'subject:(factura OR invoice OR rechnung OR facture OR "nota de crédito" OR "albarán")',
    'OR (factura OR invoice) has:attachment',
].join(' ');

// ── Public API ──────────────────────────────────────────────────────

/**
 * Fetch invoices-related emails.
 * Supports full pagination (no 50-message cap).
 * @param lastDays — how far back to search (default: all of 2025 = ~420 days)
 * @param onProgress — optional callback for UI progress updates
 */
export const fetchInvoiceEmails = async (
    lastDays = 420,
    onProgress?: (fetched: number, total: number) => void,
): Promise<GmailInvoiceEmail[]> => {
    const token = await getAccessToken();
    if (!token) return MOCK_EMAILS;

    try {
        const after = Math.floor((Date.now() - lastDays * 864e5) / 1000);
        const q = encodeURIComponent(`${INVOICE_QUERY} after:${after}`);

        // 1. Collect ALL message IDs with pagination
        const allMessages: { id: string; threadId: string }[] = [];
        let pageToken: string | undefined;

        do {
            const pageParam = pageToken ? `&pageToken=${pageToken}` : '';
            const list = await gmailGet<{
                messages?: { id: string; threadId: string }[];
                nextPageToken?: string;
                resultSizeEstimate?: number;
            }>(`/messages?q=${q}&maxResults=100${pageParam}`, token);

            if (list.messages) {
                allMessages.push(...list.messages);
                onProgress?.(allMessages.length, list.resultSizeEstimate ?? allMessages.length);
            }
            pageToken = list.nextPageToken;
        } while (pageToken);

        if (allMessages.length === 0) return [];

        logger.info('[Gmail] Found invoice emails since 2025-01-01');

        // 2. Fetch full message details in batches of 10
        const emails: GmailInvoiceEmail[] = [];

        const chunks: { id: string; threadId: string }[][] = [];
        for (let i = 0; i < allMessages.length; i += 10) {
            chunks.push(allMessages.slice(i, i + 10));
        }

        for (const chunk of chunks) {
            await Promise.all(
                chunk.map(async (m) => {
                    try {
                        const full = await gmailGet<{
                            id: string; threadId: string; snippet: string;
                            payload: GmailPayload; internalDate?: string;
                        }>(`/messages/${m.id}?format=full`, token);

                        const headers = full.payload.headers ?? [];
                        const hdr = (name: string) =>
                            headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

                        const from = hdr('From');
                        const emailMatch = from.match(/<([^>]+)>/);
                        const deEmail = emailMatch?.[1] ?? from;
                        const de = from.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '') || deEmail;

                        const attachments = extractAttachments(full.payload);
                        const bodyText = extractBodyText(full.payload);
                        const bodyHtml = extractBodyHtml(full.payload);

                        const fecha = full.internalDate
                            ? new Date(Number(full.internalDate)).toISOString()
                            : new Date().toISOString();

                        emails.push({
                            id: full.id,
                            threadId: full.threadId,
                            fecha,
                            de,
                            deEmail,
                            asunto: hdr('Subject'),
                            snippet: full.snippet,
                            hasAttachment: attachments.length > 0,
                            attachments,
                            bodyText,
                            bodyHtml,
                            enlaceGmail: `https://mail.google.com/mail/u/0/#inbox/${full.id}`,
                        });
                    } catch { /* skip bad messages */ }
                }),
            );
            onProgress?.(emails.length, allMessages.length);
        }

        return emails.sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (e) {
        logger.error('[Gmail] fetchInvoiceEmails error', e);
        return MOCK_EMAILS;
    }
};

/**
 * Download a specific attachment's binary content (base64url).
 */
export const downloadAttachment = async (
    messageId: string,
    attachmentId: string,
): Promise<string | null> => {
    const token = await getAccessToken();
    if (!token) return null;
    try {
        const res = await gmailGet<{ data: string }>(
            `/messages/${messageId}/attachments/${attachmentId}`,
            token,
        );
        return res.data;
    } catch {
        return null;
    }
};

// ── Mock data ────────────────────────────────────────────────────────

const MOCK_EMAILS: GmailInvoiceEmail[] = [
    {
        id: 'mock-1', threadId: 't1',
        fecha: new Date(Date.now() - 2 * 864e5).toISOString(),
        de: 'Suministros Dentales Iberia', deEmail: 'facturas@sdi.es',
        asunto: 'FACTURA 2025/0234 - Pedido material clínica',
        snippet: 'Estimados clientes, adjuntamos factura correspondiente al pedido realizado...',
        hasAttachment: true,
        attachments: [{ id: 'a1', filename: 'Factura_2025_0234.pdf', mimeType: 'application/pdf', size: 48200 }],
        bodyText: 'SUMINISTROS DENTALES IBERIA S.L.\nCIF: B12345678\nFactura nº 2025/0234\nFecha: 23/02/2025\nBase imponible: 1.240,00 €\nIVA 21%: 260,40 €\nTOTAL: 1.500,40 €',
        bodyHtml: '',
        enlaceGmail: '#mock',
    },
    {
        id: 'mock-2', threadId: 't2',
        fecha: new Date(Date.now() - 5 * 864e5).toISOString(),
        de: 'Telefónica', deEmail: 'automatico@telefonica.com',
        asunto: 'Tu factura de Movistar - Febrero 2025',
        snippet: 'Tu factura del mes de febrero ya está disponible. Importe total: 89,45 €',
        hasAttachment: true,
        attachments: [{ id: 'a2', filename: 'factura_MAT_202502.pdf', mimeType: 'application/pdf', size: 112000 }],
        bodyText: 'TELEFONICA DE ESPAÑA S.A.U.\nCIF: A28015865\nFactura nº MAT-202502\nPeriodo: 01/02/2025 - 28/02/2025\nBase: 73,93 €\nIVA 21%: 15,52 €\nTOTAL: 89,45 €',
        bodyHtml: '<p>Tu factura ya está disponible.</p><a href="https://www.movistar.es/mimovistar/mis-facturas">Ver tu factura</a>',
        enlaceGmail: '#mock',
    },
    {
        id: 'mock-3', threadId: 't3',
        fecha: new Date(Date.now() - 12 * 864e5).toISOString(),
        de: 'Endocare Dental', deEmail: 'admin@endocare.es',
        asunto: 'invoice #INV-2025-089 for dental supplies',
        snippet: 'Please find attached invoice INV-2025-089. Payment due in 30 days.',
        hasAttachment: true,
        attachments: [{ id: 'a3', filename: 'INV-2025-089.pdf', mimeType: 'application/pdf', size: 67000 }],
        bodyText: 'ENDOCARE DENTAL S.L.\nCIF: B87654321\nInvoice INV-2025-089\nDate: 13/02/2025\nSubtotal: 3.200,00 €\nVAT 21%: 672,00 €\nTotal: 3.872,00 €',
        bodyHtml: '',
        enlaceGmail: '#mock',
    },
    {
        id: 'mock-4', threadId: 't4',
        fecha: new Date(Date.now() - 18 * 864e5).toISOString(),
        de: 'Seguros Sanitas', deEmail: 'facturas@sanitas.es',
        asunto: 'Factura seguro clínica - Febrero 2025',
        snippet: 'Adjuntamos la factura correspondiente a la cuota mensual de su seguro clínica...',
        hasAttachment: false, attachments: [],
        bodyText: 'SANITAS S.A. DE SEGUROS\nCIF: A28985678\nFactura 2025-02-001842\nFecha: 07/02/2025\nBase: 415,00 €\nIVA Exento\nTOTAL: 415,00 €',
        bodyHtml: '<p>Su factura está disponible en su área de cliente</p><a href="https://micuenta.sanitas.es/facturas">Acceder a mi factura</a>',
        enlaceGmail: '#mock',
    },
    {
        id: 'mock-5', threadId: 't5',
        fecha: new Date(Date.now() - 25 * 864e5).toISOString(),
        de: 'Iberdrola Empresas', deEmail: 'noreply@iberdrola.es',
        asunto: 'Factura Luz Clínica - Enero 2025 - Ref: 7823991',
        snippet: 'Su factura de electricidad correspondiente al periodo enero 2025 está disponible.',
        hasAttachment: true,
        attachments: [{ id: 'a5', filename: 'factura_iberdrola_01_2025.pdf', mimeType: 'application/pdf', size: 93000 }],
        bodyText: 'IBERDROLA CLIENTES S.A.U.\nCIF: A95758389\nRef. Factura: 7823991\nPeriodo: 01/01/2025 - 31/01/2025\nBase imponible: 342,18 €\nIVA 21%: 71,86 €\nTOTAL: 414,04 €',
        bodyHtml: '<p>Consulte su factura online</p><a href="https://www.iberdrola.es/clientes/factura-online">Descargar factura</a>',
        enlaceGmail: '#mock',
    },
];
