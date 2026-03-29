// ─── Gestoría Mailer — envío automático de datos contables ───────────────────
import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { AccountingService } from './accounting.service.js';

// ── Config file path ──────────────────────────────────────────────────────────
const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'gestoria-config.json');
const HISTORY_FILE = path.join(DATA_DIR, 'gestoria-envios.json');

async function ensureDataDir() {
    await fs.mkdir(DATA_DIR, { recursive: true });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GestoriaConfig {
    nombre: string;
    email: string;
    contacto: string;
    nif: string;
    smtp: {
        host: string;
        port: number;
        user: string;
        pass: string;
        secure: boolean;
    };
    incluir: {
        facturasEmitidas: boolean;
        facturasRecibidas: boolean;
        movimientosBanco: boolean;
        modelosFiscales: boolean;
    };
    periodoDefecto: 'mes_actual' | 'trimestre_actual' | 'ano_actual';
    asuntoPlantilla: string;
    cuerpoPlantilla: string;
}

export interface EnvioRecord {
    id: string;
    fecha: string;
    periodo: string;
    destinatario: string;
    contenido: string[];
    estado: 'ok' | 'error';
    error?: string;
    nFacturas?: number;
    nMovimientos?: number;
}

const DEFAULT_CONFIG: GestoriaConfig = {
    nombre: '',
    email: '',
    contacto: '',
    nif: '',
    smtp: {
        host: config.GMAIL_USER_EMAIL ? 'smtp.gmail.com' : 'smtp.example.com',
        port: 587,
        user: config.GMAIL_USER_EMAIL ?? '',
        pass: '',
        secure: false,
    },
    incluir: {
        facturasEmitidas: true,
        facturasRecibidas: true,
        movimientosBanco: true,
        modelosFiscales: false,
    },
    periodoDefecto: 'mes_actual',
    asuntoPlantilla: 'Documentación contable {periodo} — Clínica Dental',
    cuerpoPlantilla:
        'Estimado/a {contacto},\n\nAdjunto encontrará la documentación contable correspondiente al período {periodo}.\n\nContenido:\n{contenido}\n\nQuedamos a su disposición para cualquier consulta.\n\nAtentamente,\nClínica Dental',
};

// ── Config CRUD ───────────────────────────────────────────────────────────────

export async function loadConfig(): Promise<GestoriaConfig> {
    await ensureDataDir();
    try {
        const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

export async function saveConfig(cfg: Partial<GestoriaConfig>): Promise<GestoriaConfig> {
    await ensureDataDir();
    const current = await loadConfig();
    const merged = { ...current, ...cfg };
    // Deep merge sub-objects
    if (cfg.smtp) merged.smtp = { ...current.smtp, ...cfg.smtp };
    if (cfg.incluir) merged.incluir = { ...current.incluir, ...cfg.incluir };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
}

// ── History ───────────────────────────────────────────────────────────────────

async function loadHistory(): Promise<EnvioRecord[]> {
    await ensureDataDir();
    try {
        const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function appendHistory(record: EnvioRecord): Promise<void> {
    const hist = await loadHistory();
    hist.unshift(record); // newest first
    const trimmed = hist.slice(0, 50); // keep last 50
    await fs.writeFile(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}

export async function getHistory(): Promise<EnvioRecord[]> {
    return loadHistory();
}

// ── Period helpers ────────────────────────────────────────────────────────────

function getPeriodRange(period: string): { from: string; to: string; label: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed

    if (period === 'mes_actual') {
        const from = new Date(y, m, 1).toISOString().slice(0, 10);
        const to = new Date(y, m + 1, 0).toISOString().slice(0, 10);
        const label = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return { from, to, label };
    }
    if (period === 'trimestre_actual') {
        const q = Math.floor(m / 3);
        const from = new Date(y, q * 3, 1).toISOString().slice(0, 10);
        const to = new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10);
        const label = `T${q + 1} ${y}`;
        return { from, to, label };
    }
    // ano_actual
    const from = `${y}-01-01`;
    const to = `${y}-12-31`;
    return { from, to, label: String(y) };
}

// ── Build CSV helpers ─────────────────────────────────────────────────────────

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
    const escape = (v: unknown) => {
        const s = v == null ? '' : String(v).replace(/"/g, '""');
        return `"${s}"`;
    };
    const lines = [headers.map(escape).join(',')];
    for (const row of rows) {
        lines.push(headers.map(h => escape(row[h])).join(','));
    }
    return lines.join('\n');
}

// ── Main send function ────────────────────────────────────────────────────────

export async function sendToGestoria(periodOverride?: string): Promise<EnvioRecord> {
    const cfg = await loadConfig();

    if (!cfg.email) throw new Error('No hay email de gestoría configurado');
    if (!cfg.smtp.user || !cfg.smtp.pass) throw new Error('SMTP no configurado. Añade usuario y contraseña SMTP.');

    const period = periodOverride ?? cfg.periodoDefecto;
    const { from, to, label } = getPeriodRange(period);

    // Build transporter
    const transporter = nodemailer.createTransport({
        host: cfg.smtp.host,
        port: cfg.smtp.port,
        secure: cfg.smtp.secure,
        auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
    });

    const attachments: { filename: string; content: string }[] = [];
    const contenidoLines: string[] = [];
    let nFacturas = 0;
    let nMovimientos = 0;

    // ── Facturas emitidas
    if (cfg.incluir.facturasEmitidas) {
        try {
            const { data: invoices } = await AccountingService.getEmittedInvoices({ desde: from, hasta: to, pageSize: '1000' });
            if (invoices.length > 0) {
                nFacturas += invoices.length;
                const csv = toCsv(
                    ['id', 'numero', 'fecha', 'paciente', 'concepto', 'baseImponible', 'iva', 'total', 'estadoPago'],
                    invoices as any,
                );
                attachments.push({ filename: `facturas_emitidas_${label}.csv`, content: csv });
                contenidoLines.push(`• Facturas emitidas: ${invoices.length} registros`);
            }
        } catch (e) {
            logger.warn('[Gestoria] No se pudieron obtener facturas emitidas', e);
        }
    }

    // ── Facturas recibidas (email/gmail)
    if (cfg.incluir.facturasRecibidas) {
        try {
            const { data: received } = await AccountingService.getEmailInvoices({ desde: from, hasta: to, pageSize: '1000' });
            if (received.length > 0) {
                nFacturas += received.length;
                const csv = toCsv(
                    ['gmailMessageId', 'proveedor', 'fecha', 'concepto', 'importe', 'iva', 'categoria', 'estado'],
                    received as any,
                );
                attachments.push({ filename: `facturas_recibidas_${label}.csv`, content: csv });
                contenidoLines.push(`• Facturas recibidas (email): ${received.length} registros`);
            }
        } catch (e) {
            logger.warn('[Gestoria] No se pudieron obtener facturas recibidas', e);
        }
    }

    // ── Movimientos bancarios
    if (cfg.incluir.movimientosBanco) {
        try {
            const { data: movements } = await AccountingService.getBankMovements({ desde: from, hasta: to, pageSize: '1000' });
            if (movements.length > 0) {
                nMovimientos = movements.length;
                const csv = toCsv(
                    ['id', 'fecha', 'concepto', 'importe', 'saldo', 'tipo', 'conciliado'],
                    movements as any,
                );
                attachments.push({ filename: `movimientos_banco_${label}.csv`, content: csv });
                contenidoLines.push(`• Movimientos bancarios: ${movements.length} registros`);
            }
        } catch (e) {
            logger.warn('[Gestoria] No se pudieron obtener movimientos bancarios', e);
        }
    }

    // ── Modelos fiscales
    if (cfg.incluir.modelosFiscales) {
        try {
            const models = await AccountingService.getTaxModels({ year: String(new Date(from).getFullYear()) });
            if (models.length > 0) {
                const csv = toCsv(['modelo', 'periodo', 'ejercicio', 'estado', 'importe'], models as any);
                attachments.push({ filename: `modelos_fiscales_${label}.csv`, content: csv });
                contenidoLines.push(`• Modelos fiscales: ${models.length} registros`);
            }
        } catch (e) {
            logger.warn('[Gestoria] No se pudieron obtener modelos fiscales', e);
        }
    }

    if (attachments.length === 0) {
        throw new Error('No hay datos para enviar en el período seleccionado');
    }

    // ── Build email
    const asunto = cfg.asuntoPlantilla.replace('{periodo}', label);
    const cuerpo = cfg.cuerpoPlantilla
        .replace(/{contacto}/g, cfg.contacto || cfg.nombre || 'Gestor/a')
        .replace(/{periodo}/g, label)
        .replace(/{contenido}/g, contenidoLines.join('\n'));

    await transporter.sendMail({
        from: `"Clínica Dental SmilePro" <${cfg.smtp.user}>`,
        to: cfg.email,
        subject: asunto,
        text: cuerpo,
        attachments,
    });

    logger.info(`[Gestoria] Email enviado a ${cfg.email} — ${attachments.length} adjuntos`);

    const record: EnvioRecord = {
        id: Date.now().toString(),
        fecha: new Date().toISOString(),
        periodo: label,
        destinatario: cfg.email,
        contenido: contenidoLines,
        estado: 'ok',
        nFacturas,
        nMovimientos,
    };
    await appendHistory(record);
    return record;
}
