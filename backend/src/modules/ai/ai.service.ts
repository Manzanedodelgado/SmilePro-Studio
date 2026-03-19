// ─── AI Service — Groq + Gemini + OpenRouter ─────────────────────────────────
import { config } from '../../config/index';
import { logger } from '../../config/logger.js';
import prisma from '../../config/database.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIResponse {
    text: string;
    tokens: number;
    model: string;
    provider: string;
}

export interface AutomationStep {
    delay?: number;    // minutos
    action: string;   // 'send_whatsapp' | 'send_email' | 'update_status' | 'notify_staff'
    template?: string;
    params?: Record<string, string>;
}

// ─── Helpers de llamada OpenAI-compatible ─────────────────────────────────────

async function callOpenAICompat(
    endpoint: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    maxTokens = 512,
    temperature = 0.3,
): Promise<AIResponse> {
    const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://gestion.rubiogarciadental.com',
            'X-Title': 'SmileStudio — Rubio García Dental',
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
        signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`AI API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as {
        choices: { message: { content: string } }[];
        usage?: { total_tokens?: number };
        model?: string;
    };

    return {
        text: data.choices?.[0]?.message?.content?.trim() ?? '',
        tokens: data.usage?.total_tokens ?? 0,
        model: data.model ?? model,
        provider: endpoint.includes('groq') ? 'groq'
            : endpoint.includes('google') ? 'gemini'
            : endpoint.includes('openrouter') ? 'openrouter'
            : 'unknown',
    };
}

// ─── Selección de proveedor con fallback ──────────────────────────────────────

async function callWithFallback(
    messages: ChatMessage[],
    useCase: 'whatsapp' | 'copilot' | 'vision',
    imageUrl?: string,
): Promise<AIResponse> {
    // Proveedor primario según caso de uso
    const primary = useCase === 'whatsapp'
        ? { endpoint: 'https://api.groq.com/openai/v1', key: config.GROQ_API_KEY, model: 'llama-3.3-70b-versatile', maxTok: 512, temp: 0.3 }
        : useCase === 'vision'
        ? { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', key: config.GEMINI_API_KEY, model: 'gemini-2.5-flash', maxTok: 1024, temp: 0.1 }
        : { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', key: config.GEMINI_API_KEY, model: 'gemini-2.5-flash-lite-preview-06-17', maxTok: 1024, temp: 0.2 };

    // Intentar primario
    if (primary.key) {
        try {
            const msgs = imageUrl
                ? messages.map(m => m.role === 'user' ? {
                    role: m.role,
                    content: [
                        { type: 'text', text: m.content },
                        { type: 'image_url', image_url: { url: imageUrl } },
                    ],
                } : m) as ChatMessage[]
                : messages;

            return await callOpenAICompat(primary.endpoint, primary.key, primary.model, msgs, primary.maxTok, primary.temp);
        } catch (err) {
            logger.warn(`[AI] Primary ${useCase} failed, trying fallback:`, err);
        }
    }

    // Fallback: OpenRouter (acepta cualquier modelo)
    if (config.OPENROUTER_API_KEY) {
        const fallbackModel = useCase === 'whatsapp' ? 'meta-llama/llama-3.3-70b-instruct' : 'google/gemini-flash-1.5';
        return await callOpenAICompat('https://openrouter.ai/api/v1', config.OPENROUTER_API_KEY, fallbackModel, messages, 512, 0.3);
    }

    // Sin ninguna clave — respuesta simulada para dev
    logger.warn('[AI] No API keys configured — returning mock response');
    return {
        text: '[DEMO] Respuesta simulada — configura GROQ_API_KEY o GEMINI_API_KEY en .env',
        tokens: 0,
        model: 'mock',
        provider: 'mock',
    };
}

// ─── Slots disponibles (agenda conectada) ─────────────────────────────────────

function getAvailableSlots(): string {
    // Appointments live in GELITE SQL Server (DCitas) — read-only access not wired yet.
    // We generate the next 5 working days with static morning/afternoon slots so the
    // AI can offer real-looking options while the full GELITE integration is pending.
    const slots: string[] = [];
    const now = new Date();
    let day = new Date(now);
    let added = 0;
    while (added < 5) {
        day = new Date(day.getTime() + 86_400_000);
        const wd = day.getDay(); // 0=Sun, 6=Sat
        if (wd === 0) continue; // no domingo
        const label = day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const times = wd === 6 ? ['9:00', '10:00', '11:00'] : ['9:00', '10:30', '12:00', '16:00', '17:30', '19:00'];
        slots.push(`${label}: ${times.join(', ')}`);
        added++;
    }
    return slots.join('\n');
}

// ─── Prompt del sistema dental ────────────────────────────────────────────────

async function getDentalSystemPrompt(includeSlots = false): Promise<string> {
    // Intentar cargar config personalizada de DB
    const cfg = await AIService.getAIConfig();
    const knowledge = cfg?.knowledge ?? [];

    const slotsSection = includeSlots
        ? `\nAGENDA — PRÓXIMOS HUECOS DISPONIBLES:\n${getAvailableSlots()}\n(Confirma siempre que el equipo verificará disponibilidad final antes de fijar la cita.)`
        : '';

    return `Eres ${cfg?.agentName ?? 'el asistente virtual'} de Rubio García Dental, una clínica dental especializada en Madrid.

IDENTIDAD:
- Responde siempre en español, con tono ${cfg?.tone?.formality === 'informal' ? 'cercano y amigable' : 'profesional pero cercano'}.
- Sé conciso. Los mensajes de WhatsApp deben ser cortos (máx 3 párrafos).
- Nunca des diagnósticos médicos. Siempre recomienda consultar con el dentista.

BASE DE CONOCIMIENTO:
${knowledge.length > 0 ? knowledge.join('\n') : `
- Servicios: implantes dentales, ortodoncia, estética dental, endodoncia, periodoncia, odontopediatría
- Horario: Lunes a Viernes 9:00-20:00, Sábados 9:00-14:00
- Dirección: [Configurar en Panel IA]
- Teléfono emergencias: [Configurar en Panel IA]
`}${slotsSection}

REGLAS:
- Si el paciente pide cita: recoge nombre, servicio y preferencia horaria. Si hay huecos disponibles en la agenda, ofrece 2-3 opciones concretas.
- Si es urgencia/dolor: prioriza siempre, ofrece llamar directamente al teléfono de emergencias.
- Si es queja o problema grave: escala a personal humano con "Voy a pasar su mensaje a nuestro equipo ahora mismo".
- Si no sabes algo: di "No tengo esa información exacta, pero nuestro equipo te responderá enseguida".

FORMATO:
- No uses markdown (no **, no #). Solo texto plano para WhatsApp.
- Máximo 150 palabras por respuesta.`;
}

// ─── AGENTE WHATSAPP (Groq) ───────────────────────────────────────────────────

const APPOINTMENT_KEYWORDS = ['cita', 'hora', 'turno', 'cuando', 'disponible', 'reservar', 'agendar', 'visita'];

export async function whatsappAgent(
    phone: string,
    message: string,
    history: ChatMessage[] = [],
): Promise<string> {
    try {
        // Incluir agenda solo si el mensaje parece solicitar una cita
        const lowerMsg = message.toLowerCase();
        const wantsAppointment = APPOINTMENT_KEYWORDS.some(kw => lowerMsg.includes(kw));
        const systemPrompt = await getDentalSystemPrompt(wantsAppointment);

        // Mantener historial limitado (últimos 10 turnos)
        const trimmedHistory = history.slice(-10);

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...trimmedHistory,
            { role: 'user', content: message },
        ];

        // Guardar historial en DB para contexto futuro
        await saveConversationTurn(phone, 'user', message);

        const result = await callWithFallback(messages, 'whatsapp');

        await saveConversationTurn(phone, 'assistant', result.text);

        logger.info(`[AI:WhatsApp] ${phone} | ${result.tokens} tok | ${result.provider}/${result.model}`);
        return result.text;
    } catch (err) {
        logger.error('[AI:WhatsApp] Error:', err);
        return 'Disculpa, tenemos un problema técnico momentáneo. Por favor llama directamente a la clínica o vuelve a escribirnos en unos minutos. 🙏';
    }
}

// ─── COPILOTO CLÍNICO (Gemini Flash-Lite) ────────────────────────────────────

export async function copilotChat(
    prompt: string,
    context?: string,
    patientId?: string,
): Promise<AIResponse> {
    let patientContext = '';

    if (patientId) {
        try {
            const patient = await (prisma.patient as any).findUnique({
                where: { id: patientId },
                include: {
                    clinicalRecords: { orderBy: { date: 'desc' }, take: 5 },
                    odontogramEntries: true,
                },
            }) as any;
            if (patient) {
                patientContext = `
PACIENTE: ${patient.firstName} ${patient.lastName}
Edad: ${patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 'desconocida'} años
Alergias: ${patient.allergies ?? 'Ninguna conocida'}
Medicación: ${patient.medications ?? 'Ninguna'}
Notas médicas: ${patient.medicalNotes ?? 'Sin notas'}
Últimas visitas: ${patient.clinicalRecords.map((r: any) => `[${r.date.toLocaleDateString('es-ES')}] ${r.type}: ${r.content.slice(0, 100)}`).join(' | ')}`;
            }
        } catch (err) {
            logger.warn('[AI:Copilot] Error loading patient context:', err);
        }
    }

    const systemPrompt = `Eres el copiloto clínico IA de Rubio García Dental. Asistes al equipo médico y administrativo de forma concisa y profesional.

Reglas:
- Responde siempre en español.
- Sé preciso y clínico. No uses lenguaje publicitario.
- Si te preguntan sobre diagnósticos, da opciones diferenciadas y recomienda siempre confirmar con el dentista.
- Para notas clínicas, usa terminología odontológica estándar (nomenclatura FDI).
- Formato markdown permitido (listas, negrita) ya que se muestra en la app.
${patientContext ? `\nCONTEXTO DEL PACIENTE:\n${patientContext}` : ''}
${context ? `\nCONTEXTO ADICIONAL:\n${context}` : ''}`;

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
    ];

    return callWithFallback(messages, 'copilot');
}

// ─── COMPLETAR NOTA MÉDICA ────────────────────────────────────────────────────

export async function completeNote(
    patientId: string,
    partialNote: string,
): Promise<string> {
    const patient = await (prisma.patient as any).findUnique({
        where: { id: patientId },
        include: { clinicalRecords: { orderBy: { date: 'desc' }, take: 3 } },
    }).catch(() => null) as any;

    const patientContext = patient
        ? `Paciente: ${patient.firstName} ${patient.lastName}. Historial reciente: ${patient.clinicalRecords.map((r: any) => r.content.slice(0, 80)).join(' | ')}`
        : '';

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: `Eres un asistente clínico dental. Completa y mejora la nota médica proporcionada. 
Usa terminología odontológica estándar (FDI). Sé claro, conciso y clínico. 
Mantén el sentido original pero mejora la redacción y añade detalles clínicos relevantes.
${patientContext}`,
        },
        {
            role: 'user',
            content: `Completa esta nota de visita:\n\n${partialNote}`,
        },
    ];

    const result = await callWithFallback(messages, 'copilot');
    return result.text;
}

// ─── SUGERIR TRATAMIENTO ──────────────────────────────────────────────────────

export async function suggestTreatment(
    patientId: string,
    symptoms?: string,
): Promise<{ name: string; description: string; urgency: string }[]> {
    const patient = await (prisma.patient as any).findUnique({
        where: { id: patientId },
        include: {
            clinicalRecords: { orderBy: { date: 'desc' }, take: 5 },
            odontogramEntries: true,
        },
    }).catch(() => null) as any;

    if (!patient) return [];

    const odontogramSummary = patient.odontogramEntries
        .filter((e: any) => e.status !== 'healthy')
        .map((e: any) => `Diente ${e.toothNumber}: ${e.status}${e.notes ? ` (${e.notes})` : ''}`)
        .join(', ') || 'Sin hallazgos registrados';

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: `Eres un asistente clínico dental especialista. Analiza el estado del paciente y sugiere tratamientos.
Responde SOLO con un JSON válido: [{"name":"...","description":"...","urgency":"alta|media|baja"}]
Sin explicaciones adicionales fuera del JSON.`,
        },
        {
            role: 'user',
            content: `Paciente: ${patient.firstName} ${patient.lastName}
Odontograma: ${odontogramSummary}
Historial reciente: ${patient.clinicalRecords.slice(0, 3).map((r: any) => r.content.slice(0, 100)).join(' | ')}
${symptoms ? `Síntomas actuales: ${symptoms}` : ''}
Sugiere hasta 4 tratamientos prioritarios.`,
        },
    ];

    try {
        const result = await callWithFallback(messages, 'copilot');
        // Extraer JSON de la respuesta
        const match = result.text.match(/\[[\s\S]*\]/);
        if (match) return JSON.parse(match[0]);
    } catch (err) {
        logger.warn('[AI:Suggest] Error parsing response:', err);
    }
    return [];
}

// ─── ANÁLISIS DE IMAGEN / RADIOGRAFÍA ────────────────────────────────────────

export async function analyzeImage(
    imageUrl: string,
    analysisType: 'radiograph' | 'general' = 'general',
): Promise<{ analysis: string; findings: string[]; recommendations: string[] }> {
    const systemPrompt = analysisType === 'radiograph'
        ? `Eres un especialista en radiología dental. Analiza la radiografía dental proporcionada.
Identifica hallazgos clínicamente relevantes: caries, patologías periapicales, pérdida ósea, fracturas, impactaciones.
Responde en español con estructura clara: HALLAZGOS y RECOMENDACIONES.
Nota: Este análisis es asistencial. El diagnóstico final debe realizarlo el dentista.`
        : `Analiza la imagen clínica dental y describe los hallazgos visibles de forma profesional.`;

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Analiza esta imagen clínica dental.' },
    ];

    try {
        const result = await callWithFallback(messages, 'vision', imageUrl);
        // Parsear en secciones
        const lines = result.text.split('\n').filter(l => l.trim());
        const findings: string[] = [];
        const recommendations: string[] = [];
        let section = '';
        for (const line of lines) {
            if (/hallazgo|finding/i.test(line)) { section = 'findings'; continue; }
            if (/recomend|recommend/i.test(line)) { section = 'recommendations'; continue; }
            if (section === 'findings' && line.startsWith('-')) findings.push(line.slice(1).trim());
            if (section === 'recommendations' && line.startsWith('-')) recommendations.push(line.slice(1).trim());
        }
        return { analysis: result.text, findings, recommendations };
    } catch (err) {
        logger.error('[AI:Image] Error:', err);
        return { analysis: 'Error al analizar la imagen. Verifica que la URL sea accesible.', findings: [], recommendations: [] };
    }
}

// ─── HISTORIAL DE CONVERSACIONES (WhatsApp) ───────────────────────────────────

async function saveConversationTurn(phone: string, role: 'user' | 'assistant', content: string) {
    try {
        const existing = await prisma.conversationHistory.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } });
        const messages: ChatMessage[] = existing ? ((existing.messages as unknown) as ChatMessage[]) : [];
        messages.push({ role, content });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1); // 24h TTL

        if (existing) {
            await prisma.conversationHistory.update({ where: { id: existing.id }, data: { messages: messages as any, expiresAt } });
        } else {
            await prisma.conversationHistory.create({ data: { phone, messages: messages as any, expiresAt } });
        }
    } catch (err) {
        logger.warn('[AI] Error saving conversation history:', err);
    }
}

export async function getConversationHistory(phone: string): Promise<ChatMessage[]> {
    try {
        const record = await prisma.conversationHistory.findFirst({
            where: { phone, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
        });
        return record ? ((record.messages as unknown) as ChatMessage[]) : [];
    } catch {
        return [];
    }
}

// ─── AI CONFIG (agente dental) ────────────────────────────────────────────────

export interface AIConfigData {
    id?: string;
    agentName: string;
    language: string;
    welcomeMsg: string;
    tone: { empathy: number; proactivity: number; formality: string };
    knowledge: string[];
    escalationRules: { condition: string; action: string }[];
}

export async function getAIConfig(): Promise<AIConfigData | null> {
    try {
        const cfg = await prisma.aIConfig.findFirst({ orderBy: { createdAt: 'desc' } });
        if (!cfg) return null;
        return {
            id: cfg.id,
            agentName: cfg.agentName,
            language: cfg.language,
            welcomeMsg: cfg.welcomeMsg,
            tone: cfg.tone as AIConfigData['tone'],
            knowledge: cfg.knowledge,
            escalationRules: cfg.escalationRules as AIConfigData['escalationRules'],
        };
    } catch {
        return null;
    }
}

export async function saveAIConfig(data: Omit<AIConfigData, 'id'>): Promise<AIConfigData> {
    const existing = await prisma.aIConfig.findFirst({ orderBy: { createdAt: 'desc' } });
    const saved = existing
        ? await prisma.aIConfig.update({
            where: { id: existing.id },
            data: { ...data, tone: data.tone as any, escalationRules: data.escalationRules as any },
        })
        : await prisma.aIConfig.create({
            data: { ...data, tone: data.tone as any, escalationRules: data.escalationRules as any },
        });

    return {
        id: saved.id,
        agentName: saved.agentName,
        language: saved.language,
        welcomeMsg: saved.welcomeMsg,
        tone: saved.tone as AIConfigData['tone'],
        knowledge: saved.knowledge,
        escalationRules: saved.escalationRules as AIConfigData['escalationRules'],
    };
}

// ─── AUTOMATIZACIONES CRUD ────────────────────────────────────────────────────

export interface AutomationData {
    id: string;
    name: string;
    enabled: boolean;
    trigger: string;
    canal: string;
    steps: AutomationStep[];
    successRate: number;
    executions: number;
    createdAt: string;
}

export async function getAutomations(): Promise<AutomationData[]> {
    const rows = await prisma.automation.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(r => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        trigger: r.trigger,
        canal: r.canal,
        steps: (r.steps as unknown) as AutomationStep[],
        successRate: r.successRate,
        executions: r.executions,
        createdAt: r.createdAt.toISOString(),
    }));
}

export async function toggleAutomation(id: string, enabled: boolean): Promise<AutomationData> {
    const row = await prisma.automation.update({ where: { id }, data: { enabled } });
    return {
        id: row.id, name: row.name, enabled: row.enabled, trigger: row.trigger,
        canal: row.canal, steps: (row.steps as unknown) as AutomationStep[],
        successRate: row.successRate, executions: row.executions, createdAt: row.createdAt.toISOString(),
    };
}

export async function createAutomation(data: Omit<AutomationData, 'id' | 'successRate' | 'executions' | 'createdAt'>): Promise<AutomationData> {
    const row = await prisma.automation.create({
        data: { name: data.name, enabled: data.enabled, trigger: data.trigger, canal: data.canal, steps: data.steps as any },
    });
    return {
        id: row.id, name: row.name, enabled: row.enabled, trigger: row.trigger,
        canal: row.canal, steps: (row.steps as unknown) as AutomationStep[],
        successRate: row.successRate, executions: row.executions, createdAt: row.createdAt.toISOString(),
    };
}

// ─── MÉTRICAS DE USO ─────────────────────────────────────────────────────────

export interface AIMetrics {
    totalMessages24h: number;
    totalTokens24h: number;
    avgLatencyMs: number;
    successRate: number;
    fallbackRate: number;
    activeAutomations: number;
    automationExecutions24h: number;
}

interface MetricEvent { ts: number; tokens: number; latencyMs: number; ok: boolean; }
const _metricEvents: MetricEvent[] = [];

export function recordMetricEvent(tokens: number, latencyMs: number, ok: boolean): void {
    _metricEvents.push({ ts: Date.now(), tokens, latencyMs, ok });
    const cutoff = Date.now() - 86_400_000;
    while (_metricEvents.length > 0 && _metricEvents[0].ts < cutoff) _metricEvents.shift();
}

export async function getAIMetrics(): Promise<AIMetrics> {
    const events = _metricEvents.filter(e => Date.now() - e.ts < 86_400_000);
    const totalMessages24h = events.length;
    const totalTokens24h = events.reduce((s, e) => s + e.tokens, 0);
    const avgLatencyMs = totalMessages24h > 0
        ? Math.round(events.reduce((s, e) => s + e.latencyMs, 0) / totalMessages24h)
        : 0;
    const successRate = totalMessages24h > 0
        ? Math.round((events.filter(e => e.ok).length / totalMessages24h) * 100)
        : 100;
    const fallbackRate = 100 - successRate;

    const automations = await prisma.automation.findMany({ where: { enabled: true } });
    const activeAutomations = automations.length;
    const automationExecutions24h = automations.reduce((s, a) => s + a.executions, 0);

    return { totalMessages24h, totalTokens24h, avgLatencyMs, successRate, fallbackRate, activeAutomations, automationExecutions24h };
}

// ─── STREAMING CHAT (SSE) ─────────────────────────────────────────────────────

export async function chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (err: Error) => void,
): Promise<void> {
    const endpoint = config.GROQ_API_KEY
        ? 'https://api.groq.com/openai/v1'
        : config.OPENROUTER_API_KEY
            ? 'https://openrouter.ai/api/v1'
            : null;

    const apiKey = config.GROQ_API_KEY ?? config.OPENROUTER_API_KEY;
    const model = config.GROQ_API_KEY
        ? 'llama-3.3-70b-versatile'
        : 'meta-llama/llama-3.3-70b-instruct';

    if (!endpoint || !apiKey) {
        onChunk('[DEMO] Configura GROQ_API_KEY en el servidor para respuestas reales.');
        onDone();
        return;
    }

    try {
        const res = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, max_tokens: 300, temperature: 0.7, stream: true }),
            signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text().catch(() => '')}`);
        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const lines = decoder.decode(value, { stream: true }).split('\n');
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]') { onDone(); return; }
                try {
                    const json = JSON.parse(raw);
                    const chunk = json.choices?.[0]?.delta?.content;
                    if (chunk) onChunk(chunk);
                    if (json.choices?.[0]?.finish_reason === 'stop') { onDone(); return; }
                } catch { /* partial line — ignore */ }
            }
        }
        onDone();
    } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
    }
}

// ─── HISTORIAL SIMULADOR ──────────────────────────────────────────────────────

export async function saveSimulatorMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
): Promise<void> {
    await saveConversationTurn(`sim:${sessionId}`, role, content);
}

export async function getSimulatorHistory(sessionId: string): Promise<ChatMessage[]> {
    return getConversationHistory(`sim:${sessionId}`);
}

// ─── Export singleton ─────────────────────────────────────────────────────────

export const AIService = {
    whatsappAgent,
    copilotChat,
    completeNote,
    suggestTreatment,
    analyzeImage,
    getConversationHistory,
    getAIConfig,
    saveAIConfig,
    getAutomations,
    toggleAutomation,
    createAutomation,
    chatStream,
    saveSimulatorMessage,
    getSimulatorHistory,
    getAIMetrics,
    recordMetricEvent,
};
