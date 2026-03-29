// ─────────────────────────────────────────────────────────────────
//  services/whatsapp.service.ts
//  Ahora toda la lógica está en evolution.service.ts (Evolution API + Chatwoot).
//  Este archivo re-exporta para mantener compatibilidad con importaciones previas.
// ─────────────────────────────────────────────────────────────────
export * from './evolution.service';

// Funciones legacy (mantenidas por compatibilidad con código antiguo)
export const getConversaciones = async () => {
    const { getChatwootConversaciones } = await import('./evolution.service');
    return getChatwootConversaciones();
};

export const getMensajes = async (convId: string) => {
    const { getChatwootMensajes } = await import('./evolution.service');
    const id = parseInt(convId);
    if (isNaN(id)) return [];
    return getChatwootMensajes(id);
};

export const sendMensaje = async (convId: string, text: string) => {
    const { isChatwootConfigured, sendChatwootMessage, sendTextMessage } = await import('./evolution.service');
    const id = parseInt(convId);
    if (!isNaN(id) && isChatwootConfigured()) return sendChatwootMessage(id, text);
    return sendTextMessage(convId, text);
};
