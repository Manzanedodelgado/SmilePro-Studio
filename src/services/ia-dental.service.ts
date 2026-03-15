// ─────────────────────────────────────────────────────────────────
//  services/ia-dental.service.ts
//  IA Dental — llama al backend proxy (key en servidor).
//  Chat history: stub (sin persistencia por ahora).
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// la key Groq vive en el backend (.env del servidor).
// El frontend llama al proxy autenticado en lugar de a Groq directamente.
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
const PROXY_GROQ = `${API_BASE}/api/proxy/groq/chat`;

// isAIConfigured ahora comprueba si el backend está disponible, no si hay key en el cliente
export const isAIConfigured = (): boolean => !!API_BASE;

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

const fetchWithTimeout = (url: string, opts: RequestInit = {}, ms = 35_000): Promise<Response> => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
};

// ── Chat history — stub (sin persistencia) ────────────────────────

export const loadChatHistory = async (_sessionId: string): Promise<{ role: string; text: string }[]> => [];

export const saveChatMessage = (_sessionId: string, _role: 'user' | 'assistant', _content: string): void => {
    // TODO: migrar a /api/ai/conversations cuando el backend lo exponga
};

// ── System Prompt ─────────────────────────────────────────────────

const buildSystemPrompt = (knowledgeBase: string[], clinicName = 'Rubio García Dental'): string => `
Eres IA Dental, el asistente virtual de ${clinicName} — Smile Pro 2026. Eres una IA especializada en odontología.

REGLAS ABSOLUTAS:
1. Responde SIEMPRE en español peninsular.
2. Sé cálida, empática y profesional. Nunca fría.
3. NUNCA diagnostiques. Sugiere siempre una consulta presencial.
4. Si detectas URGENCIA (dolor severo, sangrado, traumatismo) → escala inmediatamente: "🚨 Esto parece urgente. Llama al teléfono de urgencias de la clínica."
5. Si preguntan por precios exactos → "Cada caso es único. Te recomendamos una primera visita para un presupuesto personalizado."
6. Respuestas CORTAS (2-4 frases máximo). No hagas listas largas.
7. Usa emojis con moderación (máx 1-2 por mensaje).

BASE DE CONOCIMIENTO DE LA CLÍNICA:
${knowledgeBase.map(k => `• ${k}`).join('\n')}

Si no tienes la información, di honestamente que no lo sabes y sugiere contactar con la clínica.
`.trim();

// ── Llamada al PROXY BACKEND (V-001 fix) ────────────────────────

const callGroq = async (messages: ChatMessage[], accessToken?: string): Promise<string> => {
    const res = await fetchWithTimeout(PROXY_GROQ, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7, max_tokens: 300, top_p: 0.9 }),
    });

    if (!res.ok) {
        const err = await res.text();
        logger.error('[IA Dental] Proxy error:', res.status, err);
        throw new Error(`Proxy ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || 'Lo siento, no he podido procesar tu mensaje.';
};

// ── Sanitización ──────────────────────────────────────────────────

const sanitizeInput = (input: string): string => {
    const injectionPatterns = [
        /ignora\s+(todas\s+las\s+)?instrucciones/i,
        /olvida\s+(lo\s+que\s+te\s+)?(dije|dijeron|dicho)/i,
        /system\s*:/i,
        /\[INST\]|\[\/INST\]/,
        /<\|im_start\|>|<\|im_end\|>/,
        /act\s+as\s+(if\s+you\s+(are|were)|a)/i,
        /jailbreak|DAN\s+mode|do\s+anything\s+now/i,
    ];
    for (const pattern of injectionPatterns) {
        if (pattern.test(input)) {
            console.warn('[IA Dental] Prompt injection detectado y bloqueado');
            return '[Mensaje filtrado por política de seguridad de la clínica]';
        }
    }
    return input.trim().slice(0, 500);
};

// ── Fallback estático ─────────────────────────────────────────────

const fallbackReply = (userMsg: string): string => {
    const lower = userMsg.toLowerCase();
    if (lower.includes('cita') || lower.includes('reservar'))
        return 'Por supuesto, puedo ayudarte a reservar una cita. ¿Qué día y hora te viene mejor? 📅';
    if (lower.includes('precio') || lower.includes('cuánto') || lower.includes('cuesta'))
        return 'Cada caso es único. Te recomendamos una primera visita gratuita con nuestros especialistas para un presupuesto personalizado. ¿Te parece bien?';
    if (lower.includes('dolor') || lower.includes('urgencia') || lower.includes('sangr'))
        return '🚨 Entiendo que es urgente. Llama al teléfono de urgencias ahora. Si el dolor es muy severo, no esperes.';
    if (lower.includes('horario'))
        return 'Estamos de Lunes a Viernes de 8:30 a 20:00h y Sábados de 9:00 a 14:00h. ¿Quieres reservar una cita? 🕐';
    if (lower.includes('hola') || lower.includes('buenas'))
        return '¡Hola! Soy IA Dental, el asistente virtual de Smile Pro 2026. ¿En qué puedo ayudarte hoy? 😊';
    return 'Gracias por tu mensaje. ¿Hay algo específico sobre nuestros tratamientos o servicios en lo que pueda ayudarte?';
};

// ── API Pública ───────────────────────────────────────────────────

export const askIA = async (
    userMessage: string,
    chatHistory: { role: string; text: string }[] = [],
    knowledgeBase: string[] = [],
    sessionId?: string
): Promise<string> => {
    if (!isAIConfigured()) return fallbackReply(userMessage);

    const sid = sessionId ?? 'session-anon';
    try {
        const messages: ChatMessage[] = [
            { role: 'system', content: buildSystemPrompt(knowledgeBase) },
        ];
        for (const msg of chatHistory.slice(-10)) {
            messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.text });
        }
        const sanitized = sanitizeInput(userMessage);
        saveChatMessage(sid, 'user', sanitized);
        messages.push({ role: 'user', content: sanitized });

        const reply = await callGroq(messages);
        saveChatMessage(sid, 'assistant', reply);
        return reply;
    } catch (e) {
        console.warn('[IA Dental] Fallback por error:', e);
        return fallbackReply(userMessage);
    }
};

// ── Config persistente en backend ─────────────────────────────────

export interface AIAgentConfig {
    name: string;
    tone: number;
    lang: number;
    greeting: string;
    knowledge: string[];
}

export const loadAIConfig = async (): Promise<AIAgentConfig | null> => {
    try {
        const res = await fetch(`${API_BASE}/api/ai/config`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.data ?? null;
    } catch {
        return null;
    }
};

export const saveAIConfig = async (config: AIAgentConfig): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/ai/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        return res.ok;
    } catch {
        return false;
    }
};

export const analyzeOdontograma = async (
    toothData: { numero: string; caras: Record<string, string> }[]
): Promise<string> => {
    if (!isAIConfigured()) {
        return 'Conecta la API de IA para obtener análisis automático del odontograma.';
    }

    const hallazgos = toothData
        .filter(d => Object.values(d.caras).some(c => c !== 'normal'))
        .map(d => {
            const carasAfectadas = Object.entries(d.caras)
                .filter(([, v]) => v !== 'normal')
                .map(([cara, estado]) => `${cara}: ${estado}`)
                .join(', ');
            return `Pieza ${d.numero}: ${carasAfectadas}`;
        });

    if (hallazgos.length === 0) {
        return 'Odontograma sin hallazgos patológicos. Todas las piezas en estado normal. ✅';
    }

    try {
        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: 'Eres un asistente dental clínico. Analiza el odontograma y genera un resumen breve (máximo 5 puntos) con recomendaciones de tratamiento. Usa formato de lista con "»" al inicio. Responde en español. NO diagnostiques, solo sugiere posibles tratamientos a evaluar por el odontólogo.',
            },
            { role: 'user', content: `Analiza estos hallazgos del odontograma:\n${hallazgos.join('\n')}` },
        ];
        return await callGroq(messages);
    } catch {
        return hallazgos.map(h => `» ${h}`).join('\n');
    }
};
