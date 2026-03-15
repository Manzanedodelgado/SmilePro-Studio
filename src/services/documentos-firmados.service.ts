// ─────────────────────────────────────────────────────────────────
//  services/documentos-firmados.service.ts
//  Documentos firmados — in-memory (stub temporal).
//  TODO: exponer /api/clinical/signed-documents en el backend.
//  SIN dependencia de db.ts / backend.
// ─────────────────────────────────────────────────────────────────

export type TipoDoc = 'primera_visita' | 'lopd' | 'consentimiento' | 'revocacion';

export interface DocumentoFirmadoEvento {
    id: string;
    tipoDoc: TipoDoc;
    contactoId?: string;
    numPac?: string;
    citaId?: string;
    tratamiento?: string;
    versionDoc?: string;
    firmadoAt: string;
    firmadoPor?: string;
    esTutorFirmante: boolean;
    urlDocumento?: string;
    revocado: boolean;
    revocadoAt?: string;
    revocadoMotivo?: string;
    revocadoPor?: string;
    notas?: string;
}

const _store: DocumentoFirmadoEvento[] = [];

export const registrarDocumentoFirmado = async (datos: {
    tipoDoc: TipoDoc; numPac?: string; contactoId?: string; citaId?: string;
    tratamiento?: string; firmadoPor?: string; esTutorFirmante?: boolean;
    urlDocumento?: string; notas?: string;
}): Promise<DocumentoFirmadoEvento | null> => {
    const evt: DocumentoFirmadoEvento = {
        id: crypto.randomUUID(),
        tipoDoc: datos.tipoDoc,
        numPac: datos.numPac,
        contactoId: datos.contactoId,
        citaId: datos.citaId,
        tratamiento: datos.tratamiento,
        firmadoAt: new Date().toISOString(),
        firmadoPor: datos.firmadoPor,
        esTutorFirmante: datos.esTutorFirmante ?? false,
        urlDocumento: datos.urlDocumento,
        revocado: false,
        notas: datos.notas,
    };
    _store.push(evt);
    return evt;
};

export const getDocumentosPorCita = async (citaId: string): Promise<DocumentoFirmadoEvento[]> =>
    _store.filter(d => d.citaId === citaId && !d.revocado);

export const getDocumentosPorPaciente = async (numPac: string, _incluirRevocados = false): Promise<DocumentoFirmadoEvento[]> =>
    _store.filter(d => d.numPac === numPac && (_incluirRevocados || !d.revocado));

export const revocarDocumento = async (id: string, motivo: string, revocadoPor?: string): Promise<boolean> => {
    const doc = _store.find(d => d.id === id);
    if (!doc) return false;
    doc.revocado = true;
    doc.revocadoAt = new Date().toISOString();
    doc.revocadoMotivo = motivo;
    doc.revocadoPor = revocadoPor;
    return true;
};

export const tipoDocLabel: Record<TipoDoc, { label: string; icon: string; color: string }> = {
    primera_visita: { label: 'Primera Visita', icon: '📋', color: '#0056b3' },
    lopd: { label: 'LOPD / Privacidad', icon: '🔒', color: '#7c3aed' },
    consentimiento: { label: 'Consentimiento', icon: '✍️', color: '#059669' },
    revocacion: { label: 'Revocación', icon: '🚫', color: '#dc2626' },
};
