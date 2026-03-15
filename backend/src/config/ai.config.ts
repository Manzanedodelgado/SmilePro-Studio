/**
 * SmileStudio — AI Configuration
 *
 * Estrategia multi-modelo: modelo correcto para cada tarea.
 * Playground "AI model selection" — decisión confirmada 2026-03-08.
 *
 * Filosofía:
 *  - WhatsApp (alto volumen, necesita velocidad) → Groq (gratis, ~500 tok/s)
 *  - Copiloto clínico (notas, tratamientos) → Gemini 2.5 Flash-Lite (~0€ free tier)
 *  - Visión / radiografías (necesita visión) → Gemini 2.5 Flash (único con free tier + visión)
 *  - Fallback universal → OpenRouter (una API key, todos los modelos, sin cambiar código)
 *
 * Coste estimado: ~1.50€/mes en clínica normal (~200 WhatsApp/día).
 */

export type AIProvider = 'groq' | 'gemini' | 'deepseek' | 'openrouter';

export interface AIModelConfig {
    provider: AIProvider;
    model: string;
    maxTokens?: number;
    temperature?: number;
}

export const AI_CONFIG = {
    /**
     * WhatsApp 24/7 — alto volumen, respuesta < 1s
     * Groq free tier: 30 req/min, ~14.400 req/día
     */
    whatsapp: {
        provider: 'groq' as AIProvider,
        model: 'llama-3.3-70b-versatile',
        maxTokens: 512,
        temperature: 0.3,
    },

    /**
     * Copiloto clínico — autocompletar entradas médicas, sugerir tratamientos
     * Gemini 2.5 Flash-Lite: mejor relación calidad/precio ($0.10/1M input tokens)
     */
    copilot: {
        provider: 'gemini' as AIProvider,
        model: 'gemini-2.5-flash-lite-preview-06-17',
        maxTokens: 1024,
        temperature: 0.2,
    },

    /**
     * Análisis de radiografías — necesita visión multimodal
     * Gemini 2.5 Flash: único con free tier generoso + capacidad de visión
     * Free tier: 1000 req/día
     */
    vision: {
        provider: 'gemini' as AIProvider,
        model: 'gemini-2.5-flash',
        maxTokens: 1024,
        temperature: 0.1,
    },

    /**
     * Fallback universal — si cualquier proveedor cae o sube precios
     * OpenRouter: una API key, acceso a todos los modelos, cambias el modelo sin tocar código
     */
    fallback: {
        provider: 'openrouter' as AIProvider,
        model: 'auto', // OpenRouter selecciona el mejor disponible automáticamente
        maxTokens: 1024,
        temperature: 0.3,
    },
} as const satisfies Record<string, AIModelConfig>;

/**
 * URLs base de los proveedores (todos compatibles con OpenAI SDK format)
 */
export const AI_ENDPOINTS: Record<AIProvider, string> = {
    groq: 'https://api.groq.com/openai/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
    deepseek: 'https://api.deepseek.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
};

/**
 * Coste estimado mensual (~200 mensajes WhatsApp/día, clínica normal)
 *  WhatsApp:  0€    (Groq free tier)
 *  Copiloto:  ~1€   (Gemini Flash-Lite $0.10/1M tokens)
 *  Visión:    ~0.50€ (Gemini Flash $0.30/1M tokens, 5-10 RX/día)
 *  Total:     ~1.50€/mes
 */
export const AI_COST_ESTIMATE = {
    whatsapp: '0€ (Groq free tier: 30 req/min)',
    copilot: '~1€/mes (Gemini 2.5 Flash-Lite)',
    vision: '~0.50€/mes (Gemini 2.5 Flash, 1000 req/día free)',
    total: '~1.50€/mes clínica normal · 0€ uso bajo',
} as const;

export type AITask = keyof typeof AI_CONFIG;
