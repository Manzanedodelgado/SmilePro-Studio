// ─────────────────────────────────────────────────────────────────
//  services/ia-dental.service.ts
//  IA Dental — streaming SSE, historial persistente, rate limiting.
// ─────────────────────────────────────────────────────────────────
import { logger } from './logger';
import { authFetch } from './db';

// la key Groq vive en el backend (.env del servidor).
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
const STREAM_ENDPOINT = `${API_BASE}/api/ai/chat/stream`;

// ── Health check con caché 30s ─────────────────────────────────────
let _aiHealthCache: { ok: boolean; ts: number } | null = null;
export const isAIConfigured = async (): Promise<boolean> => {
    const now = Date.now();
    if (_aiHealthCache && now - _aiHealthCache.ts < 30_000) return _aiHealthCache.ok;
    try {
        const res = await fetchWithTimeout(`${API_BASE}/api/health`, {}, 5_000);
        const ok = res.ok;
        _aiHealthCache = { ok, ts: now };
        return ok;
    } catch {
        _aiHealthCache = { ok: false, ts: now };
        return false;
    }
};
export const isAIConfiguredSync = (): boolean => _aiHealthCache?.ok ?? false;

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

const fetchWithTimeout = (url: string, opts: RequestInit = {}, ms = 35_000): Promise<Response> => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
};

// ── Rate limiting cliente (máx 20 msgs/min por sesión) ────────────

const _rateBucket: number[] = [];
const RATE_MAX = 20;
const RATE_WINDOW_MS = 60_000;

const checkRateLimit = (): boolean => {
    const now = Date.now();
    while (_rateBucket.length > 0 && now - _rateBucket[0] > RATE_WINDOW_MS) _rateBucket.shift();
    if (_rateBucket.length >= RATE_MAX) return false;
    _rateBucket.push(now);
    return true;
};

// ── Chat history persistente en backend ───────────────────────────

export const loadChatHistory = async (sessionId: string): Promise<{ role: string; text: string }[]> => {
    try {
        const res = await fetchWithTimeout(`${API_BASE}/api/ai/conversations/history/${encodeURIComponent(sessionId)}`, {}, 5_000);
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data ?? []).map((m: ChatMessage) => ({
            role: m.role === 'assistant' ? 'ia' : m.role,
            text: m.content,
        }));
    } catch {
        return [];
    }
};

export const saveChatMessage = (sessionId: string, role: 'user' | 'assistant', content: string): void => {
    // Fire-and-forget: no bloquea el UI
    fetch(`${API_BASE}/api/ai/conversations/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role, content }),
    }).catch(() => { /* silencioso — no crítico */ });
};

// ── System Prompt ─────────────────────────────────────────────────

const buildSystemPrompt = (knowledgeBase: string[], clinicName = 'Rubio García Dental'): string => `
Eres IA Dental, el asistente virtual de ${clinicName} — SmilePro Studio. Eres una IA especializada en odontología.

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

// ── Sanitización ──────────────────────────────────────────────────

const sanitizeInput = (input: string): string => {
    const injectionPatterns = [
        // Español
        /ignora\s+(todas\s+las\s+)?instrucciones/i,
        /olvida\s+(lo\s+que\s+te\s+)?(dije|dijeron|dicho|han\s+dicho)/i,
        /act[úu]a\s+(como|si)/i,
        /eres\s+(ahora|un[a]?)\s+/i,
        /nuevo\s+(rol|modo|personaje|sistema)/i,
        /sin\s+(restricciones|filtros|límites)/i,
        /ignora\s+(el\s+)?sistema/i,
        // English
        /ignore\s+(all\s+)?(previous\s+)?(instructions|rules|guidelines)/i,
        /forget\s+(everything|what|your)/i,
        /you\s+are\s+now\s+/i,
        /act\s+as\s+(if\s+you\s+(are|were)|a\s+)/i,
        /pretend\s+(you\s+are|to\s+be)/i,
        /roleplay\s+as/i,
        /jailbreak|DAN\s+mode|do\s+anything\s+now/i,
        /no\s+restrictions|without\s+(any\s+)?filters/i,
        // Técnicos (inyección de prompt)
        /system\s*:/i,
        /\[INST\]|\[\/INST\]/,
        /<\|im_start\|>|<\|im_end\|>/,
        /<<SYS>>|<\/SYS>/,
        /###\s*(instruction|system|prompt)/i,
        /---\s*(system|override|admin)/i,
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
        return '¡Hola! Soy IA Dental, el asistente virtual de SmilePro Studio. ¿En qué puedo ayudarte hoy? 😊';
    return 'Gracias por tu mensaje. ¿Hay algo específico sobre nuestros tratamientos o servicios en lo que pueda ayudarte?';
};

// ── Streaming SSE (preferido) ──────────────────────────────────────

export const askIAStream = async (
    userMessage: string,
    chatHistory: { role: string; text: string }[] = [],
    knowledgeBase: string[] = [],
    sessionId: string,
    onChunk: (chunk: string) => void,
    onDone: (isFallback: boolean) => void,
): Promise<void> => {
    if (!checkRateLimit()) {
        onChunk('⏳ Has enviado muchos mensajes seguidos. Espera un momento antes de continuar.');
        onDone(true);
        return;
    }

    const sanitized = sanitizeInput(userMessage);
    saveChatMessage(sessionId, 'user', sanitized);

    if (!await isAIConfigured()) {
        onChunk(fallbackReply(userMessage));
        onDone(true);
        return;
    }

    const messages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(knowledgeBase) },
        ...chatHistory.slice(-10).map(m => ({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.text,
        })),
        { role: 'user', content: sanitized },
    ];

    try {
        const token = sessionStorage.getItem('sb_auth_token') ?? '';
        const response = await fetch(STREAM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ messages }),
        });

        if (!response.ok || !response.body) throw new Error(`Stream HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const lines = decoder.decode(value, { stream: true }).split('\n');
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]') {
                    saveChatMessage(sessionId, 'assistant', fullText);
                    onDone(false);
                    return;
                }
                try {
                    const json = JSON.parse(raw);
                    if (json.error) throw new Error(json.error);
                    if (json.chunk) { fullText += json.chunk; onChunk(json.chunk); }
                } catch (parseErr) {
                    if ((parseErr as Error).message !== 'Unexpected end of JSON input') throw parseErr;
                }
            }
        }
        saveChatMessage(sessionId, 'assistant', fullText);
        onDone(false);
    } catch (e) {
        logger.warn('[IA Dental] Stream error, usando fallback:', e);
        const fb = fallbackReply(userMessage);
        onChunk(fb);
        saveChatMessage(sessionId, 'assistant', fb);
        onDone(true);
    }
};

// ── askIA sin streaming (para compatibilidad con Odontograma y otros) ─

export interface IAReply { text: string; isFallback: boolean; }

export const askIA = async (
    userMessage: string,
    chatHistory: { role: string; text: string }[] = [],
    knowledgeBase: string[] = [],
    sessionId?: string
): Promise<IAReply> => {
    return new Promise((resolve) => {
        let text = '';
        askIAStream(
            userMessage,
            chatHistory,
            knowledgeBase,
            sessionId ?? 'anon',
            (chunk) => { text += chunk; },
            (isFallback) => resolve({ text, isFallback }),
        );
    });
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
        const res = await authFetch(`${API_BASE}/api/ai/config`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.data ?? null;
    } catch {
        return null;
    }
};

export const saveAIConfig = async (config: AIAgentConfig): Promise<boolean> => {
    try {
        const res = await authFetch(`${API_BASE}/api/ai/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        return res.ok;
    } catch {
        return false;
    }
};

// ── Análisis de odontograma ───────────────────────────────────────

export const analyzeOdontograma = async (
    toothData: { numero: string; caras: Record<string, string> }[]
): Promise<string> => {
    if (!await isAIConfigured()) {
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

    const { text } = await askIA(
        `Analiza estos hallazgos del odontograma:\n${hallazgos.join('\n')}`,
        [],
        ['Eres un asistente dental clínico. Analiza el odontograma y genera un resumen breve (máximo 5 puntos) con recomendaciones de tratamiento. Usa formato de lista con "»" al inicio. Responde en español. NO diagnostiques, solo sugiere posibles tratamientos a evaluar por el odontólogo.'],
        'odontograma',
    );

    return text || hallazgos.map(h => `» ${h}`).join('\n');
};

// ── Análisis de periodontograma ───────────────────────────────────

export interface PerioSummary {
    bopPct: number;
    meanDepth: number;
    deep4: number;
    deep6: number;
    teethWithMobility: string[];
    teethWithFurcation: string[];
}

export const analyzePerioData = async (summary: PerioSummary): Promise<string> => {
    if (!await isAIConfigured()) {
        return 'Conecta la API de IA para obtener análisis periodontal automático.';
    }

    const lines = [
        `BOP (sangrado al sondaje): ${summary.bopPct}% (${summary.bopPct < 15 ? 'controlado' : summary.bopPct < 25 ? 'moderado' : 'elevado'})`,
        `Sondaje medio: ${summary.meanDepth} mm`,
        `Bolsas ≥4 mm: ${summary.deep4} puntos`,
        `Bolsas ≥6 mm: ${summary.deep6} puntos`,
        summary.teethWithMobility.length > 0 ? `Movilidad dental: piezas ${summary.teethWithMobility.join(', ')}` : 'Sin movilidad significativa',
        summary.teethWithFurcation.length > 0 ? `Afectación de furcación: piezas ${summary.teethWithFurcation.join(', ')}` : 'Sin afectación de furcación',
    ];

    const { text } = await askIA(
        `Analiza estos datos del periodontograma clínico:\n${lines.join('\n')}`,
        [],
        [
            'Eres un periodoncista clínico experto. Analiza los datos del periodontograma y genera:',
            '1) Diagnóstico periodontal probable (según clasificación 2017 AAP/EFP)',
            '2) Recomendaciones de tratamiento (máximo 4 puntos, con "»" al inicio)',
            '3) Urgencia de tratamiento (baja/media/alta)',
            'Responde en español. Sé conciso. NO diagnostiques definitivamente, solo orienta al odontólogo.',
        ],
        'periodontograma',
    );

    return text || lines.map(l => `» ${l}`).join('\n');
};

// ── Análisis del historial clínico (EntradasMedicas) ─────────────

export interface EntradaResumen {
    fecha?: string | null;
    descripcion: string;
    estado: number;
    importe?: number | null;
}

export const analyzeClinicalHistory = async (entradas: EntradaResumen[]): Promise<string> => {
    if (!await isAIConfigured()) {
        return 'Conecta la API de IA para obtener un resumen del historial clínico.';
    }

    if (entradas.length === 0) return 'Sin entradas clínicas registradas para analizar.';

    const lines = entradas.slice(0, 40).map(e => {
        const fecha = e.fecha ? e.fecha.slice(0, 10) : 'sin fecha';
        const estados = ['', 'Presupuestado', 'Aceptado', 'En curso', 'Facturado', 'Realizado', 'Anulado'];
        const est = estados[e.estado] ?? `estado ${e.estado}`;
        return `${fecha} — ${e.descripcion.slice(0, 80)} [${est}]${e.importe ? ` (${e.importe}€)` : ''}`;
    });

    const { text } = await askIA(
        `Analiza este historial clínico dental:\n${lines.join('\n')}`,
        [],
        [
            'Eres un odontólogo clínico revisando el historial de un paciente. Genera un resumen clínico conciso con:',
            '1) Resumen de tratamientos realizados (máx 3 puntos con "»")',
            '2) Tratamientos pendientes o en curso relevantes',
            '3) Recomendaciones o advertencias para la próxima visita',
            'Sé directo, usa "»" para cada punto. Máximo 8 líneas total. Responde en español.',
        ],
        'historial-clinico',
    );

    return text || lines.slice(0, 5).map(l => `» ${l}`).join('\n');
};

// ── Análisis de nota SOAP desde transcript de voz ─────────────────

export const analyzeTranscriptWithAI = async (transcript: string): Promise<{
    subjetivo: string; objetivo: string; analisis: string; plan: string; eva: number;
}> => {
    const fallback = { subjetivo: '', objetivo: '', analisis: '', plan: '', eva: 0 };
    if (!transcript.trim()) return fallback;

    if (!await isAIConfigured()) return fallback;

    const { text } = await askIA(
        `Transcripción de voz de consulta dental:\n"${transcript}"\n\nEstructura en formato JSON SOAP.`,
        [],
        [
            'Eres un asistente clínico dental. Analiza la transcripción de voz y extrae los campos SOAP.',
            'Responde ÚNICAMENTE con JSON válido (sin texto adicional):',
            '{"subjetivo":"motivo y síntomas del paciente","objetivo":"hallazgos exploración clínica","analisis":"diagnóstico probable","plan":"tratamiento y próximos pasos","eva":0}',
            'eva es de 0 a 10. Si no hay información para un campo pon cadena vacía. Sin comentarios.',
        ],
        'soap-transcript',
    );

    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            return {
                subjetivo: parsed.subjetivo ?? '',
                objetivo: parsed.objetivo ?? '',
                analisis: parsed.analisis ?? '',
                plan: parsed.plan ?? '',
                eva: typeof parsed.eva === 'number' ? Math.min(10, Math.max(0, parsed.eva)) : 0,
            };
        }
    } catch { /* ignore */ }
    return fallback;
};

// ── Sugerencias de presupuesto desde odontograma ──────────────────

export const suggestBudgetFromOdontograma = async (
    toothData: { numero: string; caras: Record<string, string> }[]
): Promise<{ descripcion: string; pieza: string; precio: number }[]> => {
    if (!await isAIConfigured()) return [];

    const hallazgos = toothData
        .filter(d => Object.values(d.caras).some(c => c !== 'normal'))
        .map(d => {
            const estados = [...new Set(Object.values(d.caras).filter(c => c !== 'normal'))];
            return `Pieza ${d.numero}: ${estados.join(', ')}`;
        });

    if (hallazgos.length === 0) return [];

    const { text } = await askIA(
        `Basándote en estos hallazgos del odontograma, genera una lista de tratamientos para el presupuesto:\n${hallazgos.join('\n')}\n\nResponde SOLO con JSON array (sin explicación): [{"descripcion":"...","pieza":"XX","precio":NNN}, ...]`,
        [],
        [
            'Eres un asistente de gestión dental. Genera tratamientos para un presupuesto clínico.',
            'Precios orientativos típicos de clínica dental española: empaste 90-150€, endodoncia 280-420€, corona 580-850€, implante 1200€, extracción 80-180€, limpieza 80€.',
            'Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional.',
        ],
        'budget-suggest',
    );

    try {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) return JSON.parse(match[0]);
    } catch { /* ignore parse errors */ }
    return [];
};
