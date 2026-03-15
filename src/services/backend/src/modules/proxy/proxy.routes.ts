// ─── Proxy Routes — V-001 to V-004 Security Fix ─────────────────
// Todas las llamadas a APIs externas con keys secretas se centralizan
// aquí en el backend. El frontend NUNCA recibe ni envía las API keys.
// Las keys se leen desde variables de entorno del SERVIDOR.
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { logger } from '../../config/logger.js';

const router = Router();

// Todas las rutas del proxy requieren autenticación
router.use(authenticate);

// ── Helpers ──────────────────────────────────────────────────────

/** Forward un fetch externo y devuelve la respuesta al cliente */
async function forwardRequest(
    url: string,
    options: RequestInit,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type') ?? 'application/json';

        if (contentType.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
            const text = await response.text();
            res.status(response.status).type(contentType).send(text);
        }
    } catch (err) {
        logger.error('[Proxy] Error forwarding request:', err);
        next(err);
    }
}

// ══════════════════════════════════════════════════════════════════
// V-001 FIX: GROQ API PROXY
// Frontend llama a POST /api/proxy/groq/chat
// Backend reenvía a Groq con la key del servidor
// ══════════════════════════════════════════════════════════════════
router.post('/groq/chat', async (req: Request, res: Response, next: NextFunction) => {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        res.status(503).json({ success: false, error: { message: 'Groq no configurado en el servidor' } });
        return;
    }

    const { model, messages, temperature, max_tokens } = req.body;

    await forwardRequest(
        'https://api.groq.com/openai/v1/chat/completions',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: model ?? 'llama-3.3-70b-versatile',
                messages,
                temperature: temperature ?? 0.7,
                max_tokens: max_tokens ?? 300,
            }),
        },
        res,
        next
    );
});

// ══════════════════════════════════════════════════════════════════
// V-003 FIX: EVOLUTION API PROXY
// Frontend llama a /api/proxy/evolution/*
// Backend reenvía a Evolution API con la key del servidor
// ══════════════════════════════════════════════════════════════════
const EVOLUTION_BASE = process.env.EVOLUTION_API_URL ?? '';
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY  ?? '';

router.all('/evolution/*', async (req: Request, res: Response, next: NextFunction) => {
    if (!EVOLUTION_BASE || !EVOLUTION_KEY) {
        res.status(503).json({ success: false, error: { message: 'Evolution API no configurada en el servidor' } });
        return;
    }

    // Strip /api/proxy/evolution → reenviar el resto al target
    const subPath = req.path.replace(/^\/evolution/, '');
    const targetUrl = `${EVOLUTION_BASE}${subPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    const options: RequestInit = {
        method: req.method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_KEY,
        } as Record<string, string>,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        options.body = JSON.stringify(req.body);
    }

    logger.info(`[Proxy:Evolution] ${req.method} ${targetUrl}`);
    await forwardRequest(targetUrl, options, res, next);
});

// ══════════════════════════════════════════════════════════════════
// V-004 FIX: CHATWOOT PROXY
// Frontend llama a /api/proxy/chatwoot/*
// Backend reenvía a Chatwoot con el token del servidor
// ══════════════════════════════════════════════════════════════════
const CHATWOOT_BASE  = process.env.CHATWOOT_URL   ?? '';
const CHATWOOT_TOKEN = process.env.CHATWOOT_TOKEN  ?? '';

router.all('/chatwoot/*', async (req: Request, res: Response, next: NextFunction) => {
    if (!CHATWOOT_BASE || !CHATWOOT_TOKEN) {
        res.status(503).json({ success: false, error: { message: 'Chatwoot no configurado en el servidor' } });
        return;
    }

    const subPath = req.path.replace(/^\/chatwoot/, '');
    const targetUrl = `${CHATWOOT_BASE}${subPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    const options: RequestInit = {
        method: req.method,
        headers: {
            'Content-Type': 'application/json',
            'api_access_token': CHATWOOT_TOKEN,
        } as Record<string, string>,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        options.body = JSON.stringify(req.body);
    }

    logger.info(`[Proxy:Chatwoot] ${req.method} ${targetUrl}`);
    await forwardRequest(targetUrl, options, res, next);
});

// ══════════════════════════════════════════════════════════════════
// V-002 FIX: GMAIL / GOOGLE OAUTH PROXY
// El client_secret de Gmail NUNCA debe ir al frontend.
// Frontend llama a /api/proxy/gmail/* para todas las operaciones OAuth.
// ══════════════════════════════════════════════════════════════════
const GMAIL_CLIENT_ID     = process.env.GMAIL_CLIENT_ID     ?? '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET ?? '';

/** Intercambia código OAuth por tokens */
router.post('/gmail/token', async (req: Request, res: Response, next: NextFunction) => {
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
        res.status(503).json({ success: false, error: { message: 'Gmail OAuth no configurado en el servidor' } });
        return;
    }

    const { code, redirect_uri } = req.body as { code: string; redirect_uri: string };

    const body = new URLSearchParams({
        code,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        redirect_uri,
        grant_type: 'authorization_code',
    });

    await forwardRequest(
        'https://oauth2.googleapis.com/token',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        },
        res,
        next
    );
});

/** Refresca el access token de Gmail */
router.post('/gmail/refresh', async (req: Request, res: Response, next: NextFunction) => {
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
        res.status(503).json({ success: false, error: { message: 'Gmail OAuth no configurado en el servidor' } });
        return;
    }

    const { refresh_token } = req.body as { refresh_token: string };

    const body = new URLSearchParams({
        refresh_token,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        grant_type: 'refresh_token',
    });

    await forwardRequest(
        'https://oauth2.googleapis.com/token',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        },
        res,
        next
    );
});

/** Proxy genérico para llamadas Gmail API (con access_token del usuario) */
router.all('/gmail/api/*', async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.headers['x-gmail-token'] as string;
    if (!accessToken) {
        res.status(401).json({ success: false, error: { message: 'x-gmail-token header requerido' } });
        return;
    }

    const subPath = req.path.replace(/^\/gmail\/api/, '');
    const targetUrl = `https://gmail.googleapis.com${subPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    const options: RequestInit = {
        method: req.method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        } as Record<string, string>,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        options.body = JSON.stringify(req.body);
    }

    await forwardRequest(targetUrl, options, res, next);
});

export default router;
