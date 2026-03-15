// ─────────────────────────────────────────────────────────────────────────────
//  services/evolution.service.ts
//
//  Integración dual:
//   • Evolution API  → enviar / recibir mensajes WhatsApp directamente
//   • Chatwoot       → leer conversaciones e historial de mensajes
//
//  Config (en .env.local):
//    VITE_EVOLUTION_API_URL    → URL base de tu Evolution API
//    VITE_EVOLUTION_API_KEY    → API Key global de Evolution
//    VITE_EVOLUTION_INSTANCE   → Nombre de la instancia (ej: clinica-rubio-garcia)
//    VITE_CHATWOOT_URL         → URL base de Chatwoot
//    VITE_CHATWOOT_TOKEN       → User Access Token de Chatwoot
//    VITE_CHATWOOT_ACCOUNT_ID  → ID de la cuenta Chatwoot
//    VITE_CHATWOOT_INBOX_ID    → ID del inbox de WhatsApp en Chatwoot
// ─────────────────────────────────────────────────────────────────────────────

const fetchWithTimeout = (url: string, opts: RequestInit = {}, ms = 30_000): Promise<Response> => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
};

const EVO_URL_RAW = (import.meta.env.VITE_EVOLUTION_API_URL as string | undefined) || 'https://comunicaciones-evolution-api.ayjla6.easypanel.host';
const EVO_KEY = (import.meta.env.VITE_EVOLUTION_API_KEY as string | undefined) || '429683C4C977415CAAFCCE10F7D57E11';
const EVO_INSTANCE_RAW = (import.meta.env.VITE_EVOLUTION_INSTANCE as string | undefined) || 'chatwoot_link';

const CW_URL_RAW = (import.meta.env.VITE_CHATWOOT_URL as string | undefined) || 'https://comunicaciones-chatwoot.ayjla6.easypanel.host';
const CW_TOKEN = (import.meta.env.VITE_CHATWOOT_TOKEN as string | undefined) || 'J9GaJMe4sAXTfGgeBvmmLjsZ';
const CW_ACCOUNT = (import.meta.env.VITE_CHATWOOT_ACCOUNT_ID as string | undefined) || '1';
const CW_INBOX = (import.meta.env.VITE_CHATWOOT_INBOX_ID as string | undefined) || '1';

// En desarrollo (localhost) usamos el proxy de Vite para evitar CORS
const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const EVO_URL = IS_DEV ? '/evo-proxy' : EVO_URL_RAW;
const CW_URL = IS_DEV ? '/cw-proxy' : CW_URL_RAW;
// URL-encode el nombre de instancia para soportar espacios y tildes
const EVO_INSTANCE = EVO_INSTANCE_RAW ? encodeURIComponent(EVO_INSTANCE_RAW) : undefined;

export const isEvolutionConfigured = (): boolean =>
    !!(EVO_URL_RAW && EVO_KEY && EVO_INSTANCE_RAW && EVO_URL_RAW !== 'https://your-evolution-api.com');

export const isChatwootConfigured = (): boolean =>
    !!(CW_URL_RAW && CW_TOKEN && CW_ACCOUNT && CW_URL_RAW !== 'https://your-chatwoot.com');

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ConversacionUI {
    id: string;
    chatwootId?: number;
    name: string;
    phone: string;
    lastMessage: string;
    lastMessageAt: number;      // timestamp ms
    unread: number;
    status: 'online' | 'offline' | 'open' | 'resolved' | 'pending';
    avatar: string;
    type: 'patient' | 'provider' | 'lead';
    tags: string[];
    assignedAgent?: string;
}

export interface MensajeUI {
    id: string;
    sender: 'me' | 'them' | 'bot';
    text: string;
    time: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    attachments?: { type: 'image' | 'document' | 'audio'; url: string; name?: string }[];
    replyTo?: string;   // Texto del mensaje al que se responde (preview en la burbuja)
}

export interface InstanceStatus {
    instance: string;
    state: 'open' | 'close' | 'connecting';
    qrcode?: string;        // base64 del QR si no está conectado
    number?: string;        // número vinculado
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const evoHeaders = () => ({
    'Content-Type': 'application/json',
    'apikey': EVO_KEY!,
});

const cwHeaders = () => ({
    'Content-Type': 'application/json',
    'api_access_token': CW_TOKEN!,
});

const fmt = (ts: number | string) => {
    const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Normaliza un teléfono al formato internacional sin '+' que espera Evolution API.
 * Si el número no tiene prefijo de país, asume España (+34).
 * Ejemplos: '666778638' → '34666778638', '+34 666 778 638' → '34666778638'
 */
export const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    // Si ya empieza por 34 y tiene ≥11 dígitos → OK
    if (digits.startsWith('34') && digits.length >= 11) return digits;
    // Si empieza por 6/7/9 y tiene 9 dígitos → número español sin prefijo
    if (digits.length === 9 && /^[679]/.test(digits)) return '34' + digits;
    // En otros casos devolver como está
    return digits;
};

// ── Evolution API ─────────────────────────────────────────────────────────────

/** Estado de la instancia WhatsApp (conectado / QR pendiente) */
export const getInstanceStatus = async (): Promise<InstanceStatus | null> => {
    if (!isEvolutionConfigured()) return null;
    try {
        const r = await fetchWithTimeout(`${EVO_URL}/instance/connectionState/${EVO_INSTANCE}`, {
            headers: evoHeaders(),
        });
        if (!r.ok) return null;
        const data = await r.json();
        return {
            instance: EVO_INSTANCE!,
            state: data?.instance?.state ?? 'close',
            number: data?.instance?.profilePictureUrl ? undefined : undefined,
        };
    } catch {
        return null;
    }
};

/** Obtener QR para conectar la instancia */
export const getQRCode = async (): Promise<string | null> => {
    if (!isEvolutionConfigured()) return null;
    try {
        const r = await fetchWithTimeout(`${EVO_URL}/instance/connect/${EVO_INSTANCE}`, {
            headers: evoHeaders(),
        });
        if (!r.ok) return null;
        const data = await r.json();
        return data?.qrcode?.base64 ?? null;
    } catch {
        return null;
    }
};

/**
 * Enviar mensaje de texto via Evolution API.
 * phone: número destino con prefijo país, sin +  (ej: "34612345678")
 */
export const sendTextMessage = async (phone: string, text: string): Promise<boolean> => {
    if (!isEvolutionConfigured()) return false;
    try {
        const r = await fetchWithTimeout(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
            method: 'POST',
            headers: evoHeaders(),
            body: JSON.stringify({
                number: normalizePhone(phone),
                text,
                delay: 1200,
            }),
        });
        return r.ok;
    } catch {
        return false;
    }
};

/**
 * Enviar mensaje de plantilla (template aprobado en Meta)
 */
export const sendTemplateMessage = async (
    phone: string,
    templateName: string,
    variables: string[]
): Promise<boolean> => {
    if (!isEvolutionConfigured()) return false;
    try {
        const r = await fetchWithTimeout(`${EVO_URL}/message/sendTemplate/${EVO_INSTANCE}`, {
            method: 'POST',
            headers: evoHeaders(),
            body: JSON.stringify({
                number: normalizePhone(phone),
                name: templateName,
                language: { code: 'es' },
                components: variables.length > 0
                    ? [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v })) }]
                    : [],
            }),
        });
        return r.ok;
    } catch {
        return false;
    }
};

/**
 * Enviar imagen o documento por Evolution API
 */
export const sendMediaMessage = async (
    phone: string,
    mediaUrl: string,
    caption?: string,
    type: 'image' | 'document' = 'document'
): Promise<boolean> => {
    if (!isEvolutionConfigured()) return false;
    try {
        const endpoint = type === 'image' ? 'sendImage' : 'sendDocument';
        const r = await fetchWithTimeout(`${EVO_URL}/message/${endpoint}/${EVO_INSTANCE}`, {
            method: 'POST',
            headers: evoHeaders(),
            body: JSON.stringify({ number: normalizePhone(phone), mediaUrl, caption: caption ?? '' }),
        });
        return r.ok;
    } catch {
        return false;
    }
};

// ── Chatwoot API ──────────────────────────────────────────────────────────────

/** Listar todas las conversaciones abiertas del inbox de WhatsApp */
export const getChatwootConversaciones = async (): Promise<ConversacionUI[]> => {
    if (!isChatwootConfigured()) return [];
    try {
        const params = new URLSearchParams({
            inbox_id: CW_INBOX!,
            page: '1',
        });
        const r = await fetchWithTimeout(
            `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/conversations?${params}`,
            { headers: cwHeaders() }
        );
        if (!r.ok) return [];
        const data = await r.json();
        const convs: ConversacionUI[] = (data?.data?.payload ?? []).map((c: any) => {
            const contact = c.meta?.sender;
            const phone = contact?.phone_number ?? contact?.identifier ?? '';
            const name = contact?.name || phone;
            const last = c.last_non_activity_message;
            return {
                id: phone || String(c.id),
                chatwootId: c.id,
                name,
                phone,
                lastMessage: last?.content ?? '—',
                lastMessageAt: last?.created_at ? last.created_at * 1000 : 0,
                unread: c.unread_count ?? 0,
                status: c.status === 'open' ? 'open' : c.status === 'resolved' ? 'resolved' : 'pending',
                avatar: contact?.name?.slice(0, 2)?.toUpperCase() ?? '??',
                type: 'patient',
                tags: c.labels ?? [],
                assignedAgent: c.meta?.assignee?.name,
            };
        });
        return convs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    } catch {
        return [];
    }
};

/** Mensajes de una conversación de Chatwoot */
export const getChatwootMensajes = async (conversationId: number): Promise<MensajeUI[]> => {
    if (!isChatwootConfigured()) return [];
    try {
        const r = await fetchWithTimeout(
            `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/conversations/${conversationId}/messages`,
            { headers: cwHeaders() }
        );
        if (!r.ok) return [];
        const data = await r.json();
        const msgs = data?.payload ?? [];
        return msgs
            .filter((m: any) => m.message_type !== 2) // excluir mensajes de actividad interna
            .map((m: any): MensajeUI => ({
                id: String(m.id),
                sender: m.message_type === 1 ? 'me'   // saliente de agente
                    : m.sender?.type === 'agent_bot' ? 'bot'
                        : 'them',
                text: m.content ?? '',
                time: fmt(m.created_at),
                status: m.status === 'read' ? 'read' : m.status === 'delivered' ? 'delivered' : 'sent',
                attachments: m.attachments?.map((a: any) => ({
                    type: a.file_type?.startsWith('image') ? 'image' : 'document',
                    url: a.data_url,
                    name: a.file_name,
                })),
            }))
            .sort((a: MensajeUI, b: MensajeUI) => {
                const ta = msgs.find((m: any) => String(m.id) === a.id)?.created_at ?? 0;
                const tb = msgs.find((m: any) => String(m.id) === b.id)?.created_at ?? 0;
                return ta - tb;
            });
    } catch {
        return [];
    }
};

/**
 * Enviar un mensaje desde Chatwoot (aparece como respuesta del agente en Chatwoot
 * y llega al paciente por WhatsApp vía Evolution API).
 */
export const sendChatwootMessage = async (conversationId: number, content: string): Promise<boolean> => {
    if (!isChatwootConfigured()) return false;
    try {
        const r = await fetchWithTimeout(
            `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/conversations/${conversationId}/messages`,
            {
                method: 'POST',
                headers: cwHeaders(),
                body: JSON.stringify({ content, message_type: 'outgoing', private: false }),
            }
        );
        return r.ok;
    } catch {
        return false;
    }
};

/** Asignar etiqueta a una conversación de Chatwoot */
export const labelConversation = async (conversationId: number, labels: string[]): Promise<boolean> => {
    if (!isChatwootConfigured()) return false;
    try {
        const r = await fetchWithTimeout(
            `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/conversations/${conversationId}/labels`,
            {
                method: 'POST',
                headers: cwHeaders(),
                body: JSON.stringify({ labels }),
            }
        );
        return r.ok;
    } catch {
        return false;
    }
};

/** Resolver una conversación en Chatwoot */
export const resolveConversation = async (conversationId: number): Promise<boolean> => {
    if (!isChatwootConfigured()) return false;
    try {
        const r = await fetchWithTimeout(
            `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/conversations/${conversationId}/toggle_status`,
            {
                method: 'POST',
                headers: cwHeaders(),
                body: JSON.stringify({ status: 'resolved' }),
            }
        );
        return r.ok;
    } catch {
        return false;
    }
};

/** Marcar todos los mensajes de una conversación como leídos en Chatwoot */
export const markConversationRead = async (conversationId: number): Promise<boolean> => {
    if (!isChatwootConfigured()) return false;
    try {
        const r = await fetchWithTimeout(
            `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/conversations/${conversationId}/update_last_seen`,
            {
                method: 'POST',
                headers: cwHeaders(),
                body: JSON.stringify({}),
            }
        );
        return r.ok;
    } catch {
        return false;
    }
};

/** Eliminar una conversación en Chatwoot (requiere rol admin en Chatwoot) */
export const deleteConversation = async (conversationId: number): Promise<boolean> => {
    if (!isChatwootConfigured()) return false;
    try {
        const r = await fetchWithTimeout(
            `${CW_URL}/api/v1/accounts/${CW_ACCOUNT}/conversations/${conversationId}`,
            {
                method: 'DELETE',
                headers: cwHeaders(),
            }
        );
        return r.ok;
    } catch {
        return false;
    }
};
