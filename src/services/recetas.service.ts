// ─────────────────────────────────────────────────────────────────
//  services/recetas.service.ts
//  Recetas médicas — CRUD + generación PDF.
//  Usa localStorage como fallback offline.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import type { Medicamento } from './workflow-engine.service';

const LS_KEY = 'smilepro:recetas';

// ── Types ─────────────────────────────────────────────────────────

export interface Receta {
    id: string;

    // ── EDITABLES POR RECETA (cambian en cada prescripción) ───────
    numPac: string;                // Nº paciente interno
    pacienteNombre: string;        // Nombre completo
    pacienteDNI?: string;          // DNI / NIE / Pasaporte
    pacienteFechaNac?: string;     // Fecha nacimiento
    fecha: string;                 // Fecha de la prescripción
    diagnostico: string;           // Diagnóstico
    medicamentos: Medicamento[];   // Lista de medicamentos prescritos
    observaciones?: string;        // Info al farmacéutico / observaciones
    firmada: boolean;              // Si el doctor ha firmado

    // ── FIJOS POR DOCTOR (se auto-rellenan de DOCTOR_DEFAULT) ────
    doctorNombre: string;          // "Dr. Mario Rubio García"
    doctorColegiado: string;       // "28007352"
    doctorNIF?: string;            // "14304784A"
    doctorIdColegio?: string;      // "28" (Madrid)
    clinicaNombre: string;         // "Dental Rubio García"
    clinicaDireccion: string;      // "C/ Mayor 19, 28921 Alcorcón"
    clinicaTelefono?: string;      // "916410841"
    clinicaEmail?: string;         // "info@rubiogarciadental.com"

    // ── AUTO-GENERADOS (no editables por usuario) ────────────────
    numReceta?: string;            // "28-0287410" — generado por el sistema
    CVE?: string;                  // Código Verificación Electrónica
    lote?: number;                 // NumeroLote del CGCOM

    // ── CAMPOS DE LA FARMACIA (no editables, los rellena la farmacia) ─
    // - Firma de Farmacéutico     → vacío en impresión
    // - Farmacia (NIF/CIF, datos) → vacío en impresión
    // - Motivo de sustitución     → checkboxes vacíos
    // - Nº Orden dispensación     → siempre "1" en privada
}

// ── Datos FIJOS del doctor (Mario Rubio García) ──────────────────
// Se usan como valores por defecto en cada receta.
// Para cambiar de doctor, modificar estos datos O pasar valores explícitos.

export const DOCTOR_DEFAULT = {
    nombre: 'Dr. Mario Rubio García',
    NIF: '14304784A',
    colegiado: '28007352',
    idColegio: '28',
    clinica: 'Dental Rubio García',
    direccion: 'CALLE MAYOR, 19\n28921  ALCORCÓN',
    direccionCorta: 'C/ Mayor 19, 28921 Alcorcón, Madrid',
    telefono: '916410841',
    email: 'info@rubiogarciadental.com',
    cp: '28921',
    municipio: 'Alcorcón',
} as const;

// ── Contador de lote para Nº Receta auto-generado ────────────────
let _loteCounter = (() => {
    try {
        const stored = localStorage.getItem('smilepro:receta-lote');
        return stored ? parseInt(stored, 10) : 7910;
    } catch { return 7910; }
})();

function nextNumReceta(): { numReceta: string; lote: number; CVE: string } {
    _loteCounter++;
    try { localStorage.setItem('smilepro:receta-lote', String(_loteCounter)); } catch { /* ok */ }
    const num = `28-${String(_loteCounter).padStart(7, '0')}`;
    // CVE = colegiado + año(2) + mes(2) + lote(4) + num(7) — simplificado
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const CVE = `${DOCTOR_DEFAULT.colegiado}${yy}${mm}${String(_loteCounter).padStart(4, '0')}${num.replace('-', '')}`;
    return { numReceta: num, lote: _loteCounter, CVE };
}

/**
 * Crea una receta con los campos fijos auto-rellenos.
 * El llamador solo necesita pasar los campos EDITABLES.
 */
export function createRecetaConDefaults(
    editables: {
        numPac: string;
        pacienteNombre: string;
        pacienteDNI?: string;
        pacienteFechaNac?: string;
        diagnostico: string;
        medicamentos: Medicamento[];
        observaciones?: string;
    }
): Omit<Receta, 'id'> {
    const auto = nextNumReceta();
    const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return {
        // Editables (del llamador)
        ...editables,
        fecha: hoy,
        firmada: false,

        // Fijos (del doctor)
        doctorNombre: DOCTOR_DEFAULT.nombre,
        doctorColegiado: DOCTOR_DEFAULT.colegiado,
        doctorNIF: DOCTOR_DEFAULT.NIF,
        doctorIdColegio: DOCTOR_DEFAULT.idColegio,
        clinicaNombre: DOCTOR_DEFAULT.clinica,
        clinicaDireccion: DOCTOR_DEFAULT.direccion,
        clinicaTelefono: DOCTOR_DEFAULT.telefono,
        clinicaEmail: DOCTOR_DEFAULT.email,

        // Auto-generados
        numReceta: auto.numReceta,
        CVE: auto.CVE,
        lote: auto.lote,
    };
}

// ── Persistence ───────────────────────────────────────────────────

function loadAll(): Receta[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveAll(data: Receta[]): void {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// ── CRUD ──────────────────────────────────────────────────────────

export const getRecetasByPaciente = async (numPac: string): Promise<Receta[]> => {
    return loadAll().filter(r => r.numPac === numPac);
};

export const createReceta = async (data: Omit<Receta, 'id'>): Promise<Receta> => {
    const all = loadAll();
    const receta: Receta = {
        ...data,
        id: crypto.randomUUID(),
    };
    all.unshift(receta);
    saveAll(all);
    logger.info(`[RECETAS] Receta ${receta.id} creada para paciente ${data.numPac}`);
    return receta;
};

export const deleteReceta = async (id: string): Promise<boolean> => {
    const all = loadAll();
    const filtered = all.filter(r => r.id !== id);
    if (filtered.length === all.length) return false;
    saveAll(filtered);
    return true;
};

// ── Generación de texto para impresión / WhatsApp ─────────────────

export function formatRecetaTexto(receta: Receta): string {
    const lines: string[] = [];
    lines.push(`══════════════════════════════════════════`);
    lines.push(`RECETA MÉDICA`);
    lines.push(`══════════════════════════════════════════`);
    lines.push(`Clínica: ${receta.clinicaNombre}`);
    lines.push(`Dirección: ${receta.clinicaDireccion}`);
    lines.push(`──────────────────────────────────────────`);
    lines.push(`Paciente: ${receta.pacienteNombre}`);
    if (receta.pacienteDNI) lines.push(`DNI: ${receta.pacienteDNI}`);
    lines.push(`Fecha: ${receta.fecha}`);
    lines.push(`──────────────────────────────────────────`);
    lines.push(`Diagnóstico: ${receta.diagnostico}`);
    lines.push(``);

    for (let i = 0; i < receta.medicamentos.length; i++) {
        const m = receta.medicamentos[i];
        lines.push(`${i + 1}. ${m.nombre} ${m.presentacion}`);
        lines.push(`   Posología: ${m.posologia}`);
        lines.push(`   Duración: ${m.duracion}`);
        lines.push(`   Vía: ${m.via}`);
        if (m.notas) lines.push(`   ⚠ ${m.notas}`);
        lines.push(``);
    }

    if (receta.observaciones) {
        lines.push(`Observaciones: ${receta.observaciones}`);
        lines.push(``);
    }

    lines.push(`──────────────────────────────────────────`);
    lines.push(`Dr/Dra: ${receta.doctorNombre}`);
    lines.push(`Nº Colegiado: ${receta.doctorColegiado}`);
    lines.push(`══════════════════════════════════════════`);

    return lines.join('\n');
}

export function formatRecetaHTML(receta: Receta): string {
    // Contador para IDs únicos de canvas de barcode
    const barcodeId = `bc_${Date.now()}`;

    // Construir texto de prescripción con todos los medicamentos
    const prescripcionTexto = receta.medicamentos.map(m =>
        `${m.nombre} ${m.presentacion}`.toUpperCase()
    ).join('<br/>');

    const posologiaTexto = receta.medicamentos.map(m =>
        m.posologia
    ).join(' / ');

    const duracionTexto = receta.medicamentos.map(m =>
        m.duracion
    ).join(' / ');

    const numEnvases = receta.medicamentos.length;
    const numReceta = receta.numReceta ?? '';
    const CVE = receta.CVE ?? '';
    const doctorNIF = receta.doctorNIF ?? DOCTOR_DEFAULT.NIF;

    // Generar un bloque de receta (se usa 2 veces: farmacia + paciente)
    let copyCounter = 0;
    const renderReceta = (copiaLabel: string) => {
        const canvasId = `${barcodeId}_${copyCounter++}`;
        return `
        <div style="text-align:center;font-size:9px;font-weight:bold;color:#666;margin-bottom:1mm;letter-spacing:1px;text-transform:uppercase;">${copiaLabel}</div>
        <div style="border:1.5px solid #000;width:100%;height:140mm;position:relative;margin-bottom:4mm;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;line-height:1.3;box-sizing:border-box;">
            <!-- Barra lateral vertical -->
            <div style="position:absolute;left:0;top:0;bottom:0;width:18px;background:#ddd;display:flex;align-items:center;justify-content:center;border-right:1px solid #000;">
                <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#333;">Receta Médica Privada</span>
            </div>
            <div style="margin-left:18px;height:100%;display:flex;flex-direction:column;">
                <!-- Nº Receta -->
                <div style="padding:3mm 4mm 2mm;border-bottom:1px solid #000;">
                    <span style="font-size:11px;font-weight:bold;">Nº Receta: ${numReceta}</span>
                </div>
                <!-- Título -->
                <div style="text-align:center;padding:2mm 0;border-bottom:1px solid #000;">
                    <div style="font-size:14px;font-weight:bold;letter-spacing:1px;">RECETA MÉDICA</div>
                    <div style="font-size:11px;font-weight:bold;letter-spacing:0.5px;">ASISTENCIA SANITARIA PRIVADA</div>
                </div>
                <!-- Grid 3 columnas -->
                <div style="display:flex;flex:1;min-height:0;">
                    <!-- Col izquierda: Prescripción -->
                    <div style="width:46%;border-right:1px solid #000;display:flex;flex-direction:column;">
                        <div style="padding:2mm 2.5mm;border-bottom:1px solid #000;">
                            <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;color:#333;margin-bottom:1px;">Prescripción <span style="font-weight:normal;font-size:6.5px;">Consignar el medicamento: DVI o marca, forma farmacéutica, vía de administración, dosis por unidad y unidades por envase. (Datos correspondientes en su caso de producto sanitario)</span></div>
                        </div>
                        <div style="padding:2mm 2.5mm;border-bottom:1px solid #000;display:flex;align-items:center;gap:3mm;">
                            <span style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Nº envases/unidades:</span>
                            <span style="border:1px solid #000;padding:1px 6px;font-weight:bold;font-size:12px;">${numEnvases}</span>
                        </div>
                        <div style="padding:2mm 2.5mm;flex:1;">
                            <div style="font-size:11px;font-weight:bold;padding-top:2mm;">${prescripcionTexto}</div>
                            ${receta.observaciones ? `<div style="margin-top:3mm;font-size:9px;color:#333;">Obs: ${receta.observaciones}</div>` : ''}
                        </div>
                    </div>
                    <!-- Col central: Duración + Posología -->
                    <div style="width:22%;border-right:1px solid #000;display:flex;flex-direction:column;">
                        <div style="padding:2mm 2.5mm;border-bottom:1px solid #000;">
                            <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Duración del tratamiento</div>
                            <div style="text-align:center;font-size:10.5px;">${duracionTexto || '-'}</div>
                        </div>
                        <div style="padding:2mm 2.5mm;border-bottom:1px solid #000;">
                            <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Posología</div>
                            <div style="display:flex;border-top:1px solid #999;margin-top:1mm;">
                                <div style="flex:1;text-align:center;border-right:1px solid #999;padding:1mm 0;">
                                    <div style="font-size:7px;color:#666;">Unidades</div>
                                    <div style="font-size:9px;">${posologiaTexto}</div>
                                </div>
                                <div style="flex:1;text-align:center;padding:1mm 0;">
                                    <div style="font-size:7px;color:#666;">Pauta</div>
                                </div>
                            </div>
                        </div>
                        <div style="padding:2mm 2.5mm;border-bottom:1px solid #000;">
                            <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Nº. Orden dispensación</div>
                            <div style="text-align:center;font-weight:bold;">1</div>
                        </div>
                        <div style="padding:2mm 2.5mm;border-bottom:1px solid #000;">
                            <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Fecha prevista dispensación</div>
                            <div style="text-align:center;">${receta.fecha}</div>
                        </div>
                        <div style="padding:2mm 2.5mm;flex:1;">
                            <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Firma de Farmacéutico</div>
                        </div>
                    </div>
                    <!-- Col derecha: Paciente + Prescriptor -->
                    <div style="width:32%;display:flex;flex-direction:column;">
                        <div style="padding:2mm 2.5mm;border-bottom:1px solid #000;">
                            <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Paciente <span style="font-weight:normal;font-size:6.5px;">(Nombre, apellidos, año de nacimiento y nº de DNI/NIE o nº de Pasaporte)</span></div>
                            <div style="font-size:11px;font-weight:bold;padding-top:1mm;">
                                ${receta.pacienteNombre.toUpperCase()}<br/>
                                ${receta.pacienteFechaNac ?? ''}<br/>
                                ${receta.pacienteDNI ?? ''}
                            </div>
                        </div>
                        <div style="padding:2mm 2.5mm;border-bottom:1px solid #000;flex:1;">
                            <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Prescriptor <span style="font-weight:normal;font-size:6.5px;">(Nombre, apellidos, nº colegiado, especialidad, dirección, población y firma)</span></div>
                            <div style="font-size:10.5px;padding-top:1mm;">
                                Dr./Dra. <strong>${receta.doctorNombre.replace(/^Dr\.?\s*/i, '').toUpperCase()}</strong><br/>
                                Nº Colegiado <strong>${receta.doctorColegiado}</strong><br/>
                                ${receta.clinicaDireccion.toUpperCase()}
                            </div>
                        </div>
                        <div style="padding:2mm 2.5mm;">
                            <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Fecha de la prescripción*</div>
                            <div style="font-weight:bold;">${receta.fecha}</div>
                        </div>
                    </div>
                </div>
                <!-- Zona inferior -->
                <div style="border-top:1px solid #000;display:flex;">
                    <div style="width:40%;border-right:1px solid #000;padding:2mm 2.5mm;">
                        <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Información al farmacéutico, en su caso:</div>
                        <div style="height:8mm;font-size:9px;">${receta.observaciones ?? ''}</div>
                    </div>
                    <div style="width:28%;border-right:1px solid #000;padding:2mm 2.5mm;">
                        <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Motivo de la sustitución:</div>
                        <div style="margin-top:2mm;">
                            <div><span style="display:inline-block;width:10px;height:10px;border:1px solid #000;vertical-align:middle;margin-right:3px;"></span> Urgencia</div>
                            <div style="margin-top:1mm;"><span style="display:inline-block;width:10px;height:10px;border:1px solid #000;vertical-align:middle;margin-right:3px;"></span> Desabastecimiento</div>
                        </div>
                    </div>
                    <div style="width:32%;padding:2mm 2.5mm;">
                        <div style="font-size:7.5px;font-weight:bold;text-transform:uppercase;">Farmacia <span style="font-weight:normal;font-size:6px;">(NIF/CIF, datos de identificación y fecha de dispensación)</span></div>
                    </div>
                </div>
                <!-- Footer legal + CVE -->
                <div style="border-top:1px solid #000;display:flex;font-size:6.5px;color:#333;line-height:1.2;">
                    <div style="width:50%;padding:1.5mm 2.5mm;border-right:1px solid #000;">
                        *La validez de esta receta médica es de 10 días naturales desde la fecha prevista para la dispensación o en su defecto de la fecha de prescripción. La medicación prescrita no superará los 3 meses de tratamiento. La receta privada es válida para una única dispensación en la farmacia, esta receta podrá ser dispensada en cualquier oficina de farmacia del territorio nacional.
                    </div>
                    <div style="width:50%;padding:1.5mm 2.5mm;text-align:center;">
                        En cumplimiento de lo establecido en el artículo 5 de la Ley Orgánica 15/1999, le informamos que sus datos serán incorporados en un fichero de titularidad del prescriptor para la gestión y control de la prescripción médica, así como un fichero de información dispensadora para dar cumplimiento a la obligación establecida en el RD 1718/2010. Se le informa que podrá ejercitar sus derechos de acceso, rectificación, cancelación y oposición en la dirección del prescriptor y/o de la farmacia dispensadora.
                        ${CVE ? `<div style="margin-top:1.5mm;max-width:100%;overflow:hidden;"><canvas id="${canvasId}" style="max-width:100%;height:auto;"></canvas></div>
                        <div style="font-family:monospace;font-size:7px;letter-spacing:0.5px;margin-top:0.5mm;">${CVE}</div>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    };

    // Variable doctorNIF usada arriba — suprimir warning
    void doctorNIF;

    const farmaciaHTML = renderReceta('Copia para la Farmacia');
    const pacienteHTML = renderReceta('Copia para el Paciente');

    return `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Receta - ${receta.pacienteNombre}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>
            @media print {
                body { margin: 0; padding: 0; }
                .no-print { display: none !important; }
                .receta-page { page-break-inside: avoid; }
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11px; line-height: 1.3; }
            .a4-page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 6mm 10mm; }
        </style>
    </head>
    <body>
        <div class="a4-page">
            ${farmaciaHTML}
            ${pacienteHTML}
        </div>
        <div class="no-print" style="text-align:center;padding:16px;">
            <button onclick="window.print()" style="padding:12px 32px;background:#1e3a5f;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
                🖨 Imprimir Receta
            </button>
        </div>
        ${CVE ? `<script>
            window.addEventListener('DOMContentLoaded', function() {
                var canvases = document.querySelectorAll('canvas[id^="${barcodeId}"]');
                canvases.forEach(function(c) {
                    try {
                        JsBarcode(c, '${CVE.replace(/'/g, "\\'") }', {
                            format: 'CODE128',
                            width: 0.8,
                            height: 20,
                            displayValue: false,
                            margin: 0
                        });
                    } catch(e) { console.warn('Barcode error', e); }
                });
            });
        <\/script>` : ''}
    </body>
    </html>`;
}

/** Abre la receta en una nueva ventana e imprime */
export function printReceta(receta: Receta): void {
    const html = formatRecetaHTML(receta);
    const win = window.open('', '_blank', 'width=800,height=600');
    if (win) {
        win.document.write(html);
        win.document.close();
    }
}

// ── Envío por WhatsApp (opcional) ─────────────────────────────────

import { sendTextMessage, isEvolutionConfigured, normalizePhone } from './evolution.service';

/**
 * Envía la receta al paciente vía WhatsApp en formato texto.
 * La impresión sigue siendo obligatoria; esto es un complemento opcional.
 */
export async function sendRecetaWhatsApp(
    receta: Receta,
    phone: string,
    clinicaNombre: string = 'SmilePro Studio',
): Promise<boolean> {
    if (!isEvolutionConfigured()) {
        logger.warn('[RECETAS] WhatsApp no configurado — receta no enviada');
        return false;
    }

    const nombre = receta.pacienteNombre.split(' ')[0];
    const medsTexto = receta.medicamentos.map((m, i) =>
        `${i + 1}. *${m.nombre}* ${m.presentacion}\n` +
        `   Posología: ${m.posologia}\n` +
        `   Duración: ${m.duracion}\n` +
        (m.notas ? `   ⚠ ${m.notas}` : '')
    ).join('\n\n');

    const mensaje =
        `Hola ${nombre} 👋\n\n` +
        `Desde ${clinicaNombre} te enviamos tu receta médica:\n\n` +
        `📋 *Diagnóstico:* ${receta.diagnostico}\n\n` +
        medsTexto + '\n\n' +
        (receta.observaciones ? `📌 *Observaciones:* ${receta.observaciones}\n\n` : '') +
        `👨‍⚕️ ${receta.doctorNombre} — Nº Col. ${receta.doctorColegiado}\n\n` +
        `⚠️ Este mensaje es informativo. La receta oficial es el documento impreso.\n\n` +
        `— ${clinicaNombre}`;

    const sent = await sendTextMessage(normalizePhone(phone), mensaje);
    if (sent) {
        logger.info(`[RECETAS] Receta enviada por WhatsApp a ${nombre} (${phone})`);
    }
    return sent;
}
