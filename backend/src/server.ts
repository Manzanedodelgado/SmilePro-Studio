// ─── Smile Pro 2026 Backend Server ──────────────────────────
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initSocket } from './config/socket.js';
import { startAutomationEngine } from './modules/ai/automation.engine.js';

// ─── Module Routes ──────────────────────────────────────
import authRoutes from './modules/auth/auth.routes';
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
app.use(express.json({
    limit: '10mb',
    verify: (_req: any, _res, buf) => { (_req as any).rawBody = buf.toString(); },
}));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan('short', {
    stream: { write: (message: string) => logger.info(message.trim()) },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // desarrollo: 1000 per window (producción: bajar a 100)
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Demasiadas peticiones, inténtalo más tarde', code: 'RATE_LIMIT' } },
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

// ─── API Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/patients/leads', leadsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/treatments', treatmentsRoutes);
app.use('/api/clinical/questionnaires', questionnairesRoutes);
app.use('/api/clinical', clinicalRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/imaging', imagingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/catalogs', catalogsRoutes);
app.use('/api/proxy', proxyRoutes);   // V-001 to V-004: API keys seguras en servidor
app.use('/api/gdrive', gdriveRoutes); // Fotos pacientes — Google Drive
app.use('/rest/v1', legacyRoutes);

// ─── Error Handling ─────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────
httpServer.listen(config.PORT, () => {
    logger.info(`🦷 Smile Pro 2026 API running on port ${config.PORT} [${config.NODE_ENV}]`);
    startAutomationEngine();
});

// ─── Graceful Shutdown ──────────────────────────────────
const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully...`);
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

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
