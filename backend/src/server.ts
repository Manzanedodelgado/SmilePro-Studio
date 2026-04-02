// ─── Smile Pro 2026 Backend Server ──────────────────────────
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initSocket } from './config/socket.js';
import { startAutomationEngine } from './modules/ai/automation.engine.js';
import { getRedis, closeRedis } from './config/redis.js';
import { csrfProtection } from './middleware/csrf.js';

// ─── Module Routes ──────────────────────────────────────
import authRoutes from "./modules/auth/auth.routes";
import { authenticate } from "./middleware/auth.js";
import patientsRoutes from './modules/patients/patients.routes';
import leadsRoutes from './modules/patients/leads.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';
import treatmentsRoutes from './modules/treatments/treatments.routes';
import clinicalRoutes from './modules/clinical/clinical.routes';
import questionnairesRoutes from './modules/clinical/questionnaires.routes';
import accountingRoutes from './modules/accounting/accounting.routes';
import communicationRoutes from './modules/communication/communication.routes';
import aiRoutes from './modules/ai/ai.routes';
import imagingRoutes from './modules/imaging/imaging.routes';
import adminRoutes from './modules/admin/admin.routes';
import legacyRoutes from './modules/legacy/legacy.routes';
import catalogsRoutes from './modules/catalogs/catalogs.routes';
import proxyRoutes from './modules/proxy/proxy.routes';   // V-001 to V-004 fix
import gdriveRoutes from './modules/gdrive/gdrive.routes'; // Fotos pacientes

// ─── App Setup ──────────────────────────────────────────
const app = express();
const httpServer = createServer(app);
initSocket(httpServer);

// ─── Global Middleware ──────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({
    limit: '10mb',
    verify: (_req: any, _res, buf) => { (_req as any).rawBody = buf.toString(); },
}));
app.use(express.urlencoded({ extended: true }));

// CSRF protection — validates X-CSRF-Token header on state-changing requests
app.use('/api/', csrfProtection);

// HTTP request logging
app.use(morgan('short', {
    stream: { write: (message: string) => logger.info(message.trim()) },
}));

// Rate limiting — excluir webhooks (que pueden llegar en ráfagas)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // desarrollo: 1000 per window (producción: bajar a 100)
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Demasiadas peticiones, inténtalo más tarde', code: 'RATE_LIMIT' } },
    skip: (req) => req.path.includes('/webhook/'), // Skip rate limit for webhooks
});
app.use('/api/', limiter);

// ─── Health Check ───────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: config.NODE_ENV,
        },
    });
});

// ─── Swagger/OpenAPI Documentation ──────────────────────
// Serves interactive API docs at /api/docs
// Uses dynamic import to avoid crash if swagger packages aren't installed
(async () => {
    try {
        const swaggerUi = await import('swagger-ui-express');
        const { swaggerSpec } = await import('./config/swagger.js');
        app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
            customSiteTitle: 'SmilePro Studio API',
            customCss: '.swagger-ui .topbar { display: none }',
        }));
        app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
        logger.info('[SWAGGER] API docs available at /api/docs');
    } catch {
        logger.warn('[SWAGGER] swagger-ui-express not installed — /api/docs disabled');
    }
})();

// ─── API Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/patients/leads', leadsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/treatments', treatmentsRoutes);
app.use('/api/clinical/questionnaires', questionnairesRoutes);
app.use("/api/clinical", authenticate, clinicalRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/imaging', imagingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/catalogs', catalogsRoutes);
app.use('/api/proxy', proxyRoutes);   // V-001 to V-004: API keys seguras en servidor
app.use('/api/gdrive', gdriveRoutes); // Fotos pacientes — Google Drive
app.use('/rest/v1', legacyRoutes);

// ─── Centinela Error Reporting ──────────────────────────
// POST /api/centinela/report — recibe errores del motor Centinela frontend
app.post('/api/centinela/report', (req, res) => {
    const { message, severity = 'error', module = 'Unknown', fingerprint, count, url, stack, tags } = req.body;
    if (!message) { res.status(400).json({ success: false }); return; }
    const logMsg = `[CENTINELA] [${severity.toUpperCase()}] [${module}] ${message}${fingerprint ? ` (#${fingerprint})` : ''}${count > 1 ? ` x${count}` : ''}`;
    if (severity === 'critical' || severity === 'error') logger.error(logMsg);
    else if (severity === 'warning') logger.warn(logMsg);
    else logger.info(logMsg);
    if (stack) logger.debug(`[CENTINELA] stack: ${stack.slice(0, 500)}`);
    res.json({ success: true });
});
// GET /api/centinela/status — resumen de salud para monitorización externa
app.get('/api/centinela/status', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() } });
});


// ─── Error Handling ─────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────
httpServer.listen(config.PORT, () => {
    logger.info(`🦷 Smile Pro 2026 API running on port ${config.PORT} [${config.NODE_ENV}]`);
    getRedis(); // Initialize Redis connection (JWT blacklist, cache)
    startAutomationEngine();
});

// ─── Graceful Shutdown ──────────────────────────────────
const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully...`);
    await closeRedis();
    httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

// ── Catch unhandled errors to prevent silent crashes ──
process.on('unhandledRejection', (reason: unknown) => {
    logger.error('UNHANDLED REJECTION', {
        error: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
    });
});

process.on('uncaughtException', (err: Error) => {
    logger.error('UNCAUGHT EXCEPTION — shutting down', {
        error: err.message,
        stack: err.stack,
    });
    process.exit(1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;

// ── Uptime Kuma → WhatsApp Alert Webhook ──
app.post('/api/uptime-webhook', async (req, res) => {
    try {
        const { msg, heartbeat, monitor } = req.body;
        const alertText = heartbeat?.status === 0
            ? `🔴 *CAÍDO*: ${monitor?.name || 'Servicio'}\n⏰ ${new Date().toLocaleString('es-ES')}\n📝 ${msg || 'Sin detalles'}`
            : `🟢 *RECUPERADO*: ${monitor?.name || 'Servicio'}\n⏰ ${new Date().toLocaleString('es-ES')}\n📝 ${msg || 'Sin detalles'}`;

        const evoResponse = await fetch('http://evolution-api:8080/message/sendText/chatwoot_link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': '429683C4C977415CAAFCCE10F7D57E11',
            },
            body: JSON.stringify({
                number: '34648085696',
                text: alertText,
            }),
        });
        const result = await evoResponse.json();
        logger.info('[UPTIME-KUMA] Alert sent via WhatsApp', { monitor: monitor?.name, status: heartbeat?.status });
        res.json({ success: true, result });
    } catch (err: any) {
        logger.error('[UPTIME-KUMA] Failed to send WhatsApp alert', { error: err.message });
        res.status(500).json({ success: false, error: err.message });
    }
});
