// ─── Communication Service — Evolution API + Chatwoot ────
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';

// ── Config guards ─────────────────────────────────────────

export const isEvolutionConfigured = (): boolean =>
    !!(config.EVOLUTION_API_URL && config.EVOLUTION_API_KEY && config.EVOLUTION_INSTANCE);

export const isChatwootConfigured = (): boolean =>
    !!(config.CHATWOOT_URL && config.CHATWOOT_TOKEN && config.CHATWOOT_ACCOUNT_ID);

// ── Helpers ───────────────────────────────────────────────

const evoHeaders = () => ({
    'Content-Type': 'application/json',
    'apikey': config.EVOLUTION_API_KEY!,
});

const cwHeaders = () => ({
    'Content-Type': 'application/json',
    'api_access_token': config.CHATWOOT_TOKEN!,
});

const evoBase = () => config.EVOLUTION_API_URL!;
const cwBase  = () => `${config.CHATWOOT_URL}/api/v1/accounts/${config.CHATWOOT_ACCOUNT_ID}`;

async function evoFetch(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${evoBase()}${path}`, {
        ...init,
        headers: { ...evoHeaders(), ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(15_000),
    });
    return res;
}

async function cwFetch(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${cwBase()}${path}`, {
        ...init,
        headers: { ...cwHeaders(), ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(15_000),
    });
    return res;
}

/**
 * Normaliza teléfono al formato Evolution API (sin '+', con prefijo 34 si es ES).
 */
export function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('34') && digits.length >= 11) return digits;
    if (digits.length === 9 && /^[679]/.test(digits)) return '34' + digits;
    return digits;
}

// ── Tipos ─────────────────────────────────────────────────

export interface InstanceStatus {
    instance: string;
    state: 'open' | 'close' | 'connecting';
    qrcode?: string;
    number?: string;
}

export interface ConversationSummary {
    id: string;
    chatwootId: number;
    name: string;
    phone: string;
    lastMessage: string;
    lastMessageAt: number;
    unread: number;
    status: 'open' | 'resolved' | 'pending';
    tags: string[];
    assignedAgent?: string;
}

export interface MessageItem {
    id: string;
    sender: 'me' | 'them' | 'bot';
    text: string;
    createdAt: number;
    status: 'sent' | 'delivered' | 'read';
    attachments?: { type: string; url: string; name?: string }[];
}

// ── Evolution API ─────────────────────────────────────────

export const EvolutionService = {
    async getInstanceStatus(): Promise<InstanceStatus | null> {
        if (!isEvolutionConfigured()) return null;
        try {
            const res = await evoFetch(`/instance/connectionState/${config.EVOLUTION_INSTANCE}`);
            if (!res.ok) return null;
            const data = await res.json();
            return {
                instance: config.EVOLUTION_INSTANCE!,
                state: data?.instance?.state ?? 'close',
                number: data?.instance?.owner ?? undefined,
            };
        } catch (err) {
            logger.warn('Evolution getInstanceStatus error:', err);
            return null;
        }
    },

    async getQRCode(): Promise<string | null> {
        if (!isEvolutionConfigured()) return null;
        try {
            const res = await evoFetch(`/instance/connect/${config.EVOLUTION_INSTANCE}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data?.qrcode?.base64 ?? null;
        } catch (err) {
            logger.warn('Evolution getQRCode error:', err);
            return null;
        }
    },

    async sendText(phone: string, text: string): Promise<boolean> {
        if (!isEvolutionConfigured()) return false;
        try {
            const res = await evoFetch(`/message/sendText/${config.EVOLUTION_INSTANCE}`, {
                method: 'POST',
                body: JSON.stringify({ number: normalizePhone(phone), text, delay: 1200 }),
            });
            if (!res.ok) {
                const body = await res.text();
                logger.warn(`Evolution sendText ${res.status}:`, body);
            }
            return res.ok;
        } catch (err) {
            logger.error('Evolution sendText error:', err);
            return false;
        }
    },

    async sendTemplate(phone: string, templateName: string, variables: string[]): Promise<boolean> {
        if (!isEvolutionConfigured()) return false;
        try {
            const res = await evoFetch(`/message/sendTemplate/${config.EVOLUTION_INSTANCE}`, {
                method: 'POST',
                body: JSON.stringify({
                    number: normalizePhone(phone),
                    name: templateName,
                    language: { code: 'es' },
                    components: variables.length > 0
                        ? [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v })) }]
                        : [],
                }),
            });
            return res.ok;
        } catch (err) {
            logger.error('Evolution sendTemplate error:', err);
            return false;
        }
    },

    async sendMedia(phone: string, mediaUrl: string, caption?: string, type: 'image' | 'document' = 'document'): Promise<boolean> {
        if (!isEvolutionConfigured()) return false;
        try {
            const endpoint = type === 'image' ? 'sendImage' : 'sendDocument';
            const res = await evoFetch(`/message/${endpoint}/${config.EVOLUTION_INSTANCE}`, {
                method: 'POST',
                body: JSON.stringify({ number: normalizePhone(phone), mediaUrl, caption: caption ?? '' }),
            });
            return res.ok;
        } catch (err) {
            logger.error('Evolution sendMedia error:', err);
            return false;
        }
    },
};

// ── Chatwoot API ──────────────────────────────────────────

export const ChatwootService = {
    async getConversations(page = 1): Promise<ConversationSummary[]> {
        if (!isChatwootConfigured()) return [];
        try {
            const params = new URLSearchParams({
                inbox_id: String(config.CHATWOOT_INBOX_ID ?? ''),
                page: String(page),
            });
            const res = await cwFetch(`/conversations?${params}`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data?.data?.payload ?? []).map((c: any): ConversationSummary => {
                const contact = c.meta?.sender;
                const phone = contact?.phone_number ?? contact?.identifier ?? '';
                const last = c.last_non_activity_message;
                return {
                    id: phone || String(c.id),
                    chatwootId: c.id,
                    name: contact?.name || phone,
                    phone,
                    lastMessage: last?.content ?? '—',
                    lastMessageAt: last?.created_at ? last.created_at * 1000 : 0,
                    unread: c.unread_count ?? 0,
                    status: c.status === 'open' ? 'open' : c.status === 'resolved' ? 'resolved' : 'pending',
                    tags: c.labels ?? [],
                    assignedAgent: c.meta?.assignee?.name,
                };
            }).sort((a: ConversationSummary, b: ConversationSummary) => b.lastMessageAt - a.lastMessageAt);
        } catch (err) {
            logger.error('Chatwoot getConversations error:', err);
            return [];
        }
    },

    async getMessages(conversationId: number): Promise<MessageItem[]> {
        if (!isChatwootConfigured()) return [];
        try {
            const res = await cwFetch(`/conversations/${conversationId}/messages`);
            if (!res.ok) return [];
            const data = await res.json();
            const msgs: any[] = data?.payload ?? [];
            return msgs
                .filter(m => m.message_type !== 2) // excluir actividad interna
                .map((m: any): MessageItem => ({
                    id: String(m.id),
                    sender: m.message_type === 1 ? 'me'
                        : m.sender?.type === 'agent_bot' ? 'bot'
                            : 'them',
                    text: m.content ?? '',
                    createdAt: m.created_at,
                    status: m.status === 'read' ? 'read' : m.status === 'delivered' ? 'delivered' : 'sent',
                    attachments: m.attachments?.map((a: any) => ({
                        type: a.file_type?.startsWith('image') ? 'image' : 'document',
                        url: a.data_url,
                        name: a.file_name,
                    })),
                }))
                .sort((a, b) => a.createdAt - b.createdAt);
        } catch (err) {
            logger.error('Chatwoot getMessages error:', err);
            return [];
        }
    },

    async sendMessage(conversationId: number, content: string): Promise<boolean> {
        if (!isChatwootConfigured()) return false;
        try {
            const res = await cwFetch(`/conversations/${conversationId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content, message_type: 'outgoing', private: false }),
            });
            return res.ok;
        } catch (err) {
            logger.error('Chatwoot sendMessage error:', err);
            return false;
        }
    },

    async setStatus(conversationId: number, status: 'open' | 'resolved' | 'pending'): Promise<boolean> {
        if (!isChatwootConfigured()) return false;
        try {
            const res = await cwFetch(`/conversations/${conversationId}/toggle_status`, {
                method: 'POST',
                body: JSON.stringify({ status }),
            });
            return res.ok;
        } catch (err) {
            logger.error('Chatwoot setStatus error:', err);
            return false;
        }
    },

    async addLabels(conversationId: number, labels: string[]): Promise<boolean> {
        if (!isChatwootConfigured()) return false;
        try {
            const res = await cwFetch(`/conversations/${conversationId}/labels`, {
                method: 'POST',
                body: JSON.stringify({ labels }),
            });
            return res.ok;
        } catch (err) {
            logger.error('Chatwoot addLabels error:', err);
            return false;
        }
    },

    async markRead(conversationId: number): Promise<boolean> {
        if (!isChatwootConfigured()) return false;
        try {
            const res = await cwFetch(`/conversations/${conversationId}/update_last_seen`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            return res.ok;
        } catch (err) {
            logger.error('Chatwoot markRead error:', err);
            return false;
        }
    },

    async deleteConversation(conversationId: number): Promise<boolean> {
        if (!isChatwootConfigured()) return false;
        try {
            const res = await cwFetch(`/conversations/${conversationId}`, { method: 'DELETE' });
            return res.ok;
        } catch (err) {
            logger.error('Chatwoot deleteConversation error:', err);
            return false;
        }
    },
};
