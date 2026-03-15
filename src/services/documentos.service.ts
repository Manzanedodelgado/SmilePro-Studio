// ─────────────────────────────────────────────────────────────────
//  services/documentos.service.ts
//  Documentos clínicos — in-memory (stub temporal).
//  TODO: exponer /api/clinical/documents en el backend.
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';

export type DocumentoTipo = 'RGPD' | 'Consentimiento' | 'Presupuesto' | 'Instrucciones';
export type DocumentoEstado = 'Pendiente' | 'Firmado' | 'Caducado' | 'Revocado';
export type FirmanteTipo = 'paciente' | 'tutor_legal' | 'profesional';
export type MetodoFirma = 'biometrico' | 'checkbox_aceptacion' | 'firma_digital' | 'whatsapp_remoto';

export interface PatientDocument {
    id: string;
    num_pac: string;
    titulo: string;
    tipo: DocumentoTipo;
    template_id: string;
    estado: DocumentoEstado;
    contenido_hash?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface DocumentSignature {
    id: string;
    document_id: string;
    num_pac: string;
    firmante_nombre: string;
    firmante_tipo: FirmanteTipo;
    metodo_firma: MetodoFirma;
    ip_firmante?: string;
    user_agent?: string;
    consentimiento_leido: boolean;
    timestamp_firma: string;
    profesional_email?: string;
    hash_firma?: string;
}

/** Token pendiente de firma remota */
export interface SigningToken {
    token: string;
    document_id: string;
    num_pac: string;
    nombre_paciente: string;
    titulo_documento: string;
    tipo_documento: DocumentoTipo;
    created_at: string;
    /** Expira en 48 h */
    expires_at: string;
}

// ── Almacenes in-memory ────────────────────────────────────────────
const _docs = new Map<string, PatientDocument[]>();
const _sigs = new Map<string, DocumentSignature[]>();
const _tokens = new Map<string, SigningToken>();

// ── CRUD básico ────────────────────────────────────────────────────

export const getDocumentosByPaciente = async (numPac: string): Promise<PatientDocument[]> =>
    _docs.get(numPac) ?? [];

export const crearDocumento = async (params: {
    numPac: string; titulo: string; tipo: DocumentoTipo;
    templateId: string; createdBy: string;
    contenido?: string;
}): Promise<PatientDocument | null> => {
    const doc: PatientDocument = {
        id: crypto.randomUUID(),
        num_pac: params.numPac,
        titulo: params.titulo,
        tipo: params.tipo,
        template_id: params.templateId,
        estado: 'Pendiente',
        created_by: params.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    const list = _docs.get(params.numPac) ?? [];
    list.push(doc);
    _docs.set(params.numPac, list);
    return doc;
};

/** Firma presencial — checkbox_aceptacion o biometrico */
export const firmarDocumento = async (params: {
    documentId: string;
    numPac: string;
    firmanteNombre: string;
    firmanteTipo: FirmanteTipo;
    metodoFirma: MetodoFirma;
    consentimientoLeido: boolean;
    profesionalEmail?: string;
}): Promise<DocumentSignature | null> => {
    const sig: DocumentSignature = {
        id: crypto.randomUUID(),
        document_id: params.documentId,
        num_pac: params.numPac,
        firmante_nombre: params.firmanteNombre,
        firmante_tipo: params.firmanteTipo,
        metodo_firma: params.metodoFirma,
        consentimiento_leido: params.consentimientoLeido,
        timestamp_firma: new Date().toISOString(),
        profesional_email: params.profesionalEmail,
        hash_firma: await _hashFirma(params.documentId + params.firmanteNombre + Date.now()),
    };

    // Guardar firma
    const sigList = _sigs.get(params.documentId) ?? [];
    sigList.push(sig);
    _sigs.set(params.documentId, sigList);

    // Actualizar estado del documento a Firmado
    _markDocFirmado(params.numPac, params.documentId);

    logger.warn('[DOCUMENTOS] firmarDocumento — stub en memoria, no persiste');
    return sig;
};

export const getSignaturesByDocument = async (documentId: string): Promise<DocumentSignature[]> =>
    _sigs.get(documentId) ?? [];

// ── Firma remota por WhatsApp (token-based) ────────────────────────

/**
 * Crea un token de firma remota válido 48 h.
 * Devuelve el token y la URL de firma para enviar al paciente.
 */
export const crearTokenFirma = (params: {
    documentId: string;
    numPac: string;
    nombrePaciente: string;
    tituloDocumento: string;
    tipoDocumento: DocumentoTipo;
}): { token: string; url: string } => {
    const token = crypto.randomUUID();
    const now = new Date();
    const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const entry: SigningToken = {
        token,
        document_id: params.documentId,
        num_pac: params.numPac,
        nombre_paciente: params.nombrePaciente,
        titulo_documento: params.tituloDocumento,
        tipo_documento: params.tipoDocumento,
        created_at: now.toISOString(),
        expires_at: expires.toISOString(),
    };
    _tokens.set(token, entry);

    const base = window.location.origin + window.location.pathname;
    const url = `${base}#sign/${token}`;
    logger.info(`[DOCUMENTOS] Token firma creado: ${token} — caduca ${expires.toLocaleString('es-ES')}`);
    return { token, url };
};

/** Recupera la información de un token pendiente (o null si no existe/caducó). */
export const getTokenFirma = (token: string): SigningToken | null => {
    const entry = _tokens.get(token);
    if (!entry) return null;
    if (new Date() > new Date(entry.expires_at)) {
        _tokens.delete(token);
        return null;
    }
    return entry;
};

/**
 * El paciente confirma la firma desde la página pública.
 * Registra la firma, marca el documento como Firmado y elimina el token.
 */
export const consumirTokenFirma = async (
    token: string,
    metadatos?: { ip?: string; userAgent?: string }
): Promise<boolean> => {
    const entry = getTokenFirma(token);
    if (!entry) return false;

    const sig: DocumentSignature = {
        id: crypto.randomUUID(),
        document_id: entry.document_id,
        num_pac: entry.num_pac,
        firmante_nombre: entry.nombre_paciente,
        firmante_tipo: 'paciente',
        metodo_firma: 'whatsapp_remoto',
        consentimiento_leido: true,
        timestamp_firma: new Date().toISOString(),
        ip_firmante: metadatos?.ip,
        user_agent: metadatos?.userAgent ?? navigator.userAgent,
        hash_firma: await _hashFirma(token + entry.document_id + Date.now()),
    };

    const sigList = _sigs.get(entry.document_id) ?? [];
    sigList.push(sig);
    _sigs.set(entry.document_id, sigList);

    _markDocFirmado(entry.num_pac, entry.document_id);
    _tokens.delete(token);

    logger.info(`[DOCUMENTOS] Firma remota consumida — doc ${entry.document_id} firmado por ${entry.nombre_paciente}`);
    return true;
};

// ── Helpers privados ──────────────────────────────────────────────

function _markDocFirmado(numPac: string, documentId: string) {
    const list = _docs.get(numPac) ?? [];
    const idx = list.findIndex(d => d.id === documentId);
    if (idx >= 0) {
        list[idx] = { ...list[idx], estado: 'Firmado', updated_at: new Date().toISOString() };
        _docs.set(numPac, list);
    }
}

async function _hashFirma(input: string): Promise<string> {
    try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        return input.slice(0, 16);
    }
}
