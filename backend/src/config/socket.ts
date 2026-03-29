// ─── Socket.io singleton ─────────────────────────────────────────────────────
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { config } from './index.js';
import { logger } from './logger.js';

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer): Server => {
    io = new Server(httpServer, {
        cors: {
            origin: config.CORS_ORIGIN,
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    io.on('connection', (socket) => {
        logger.info(`[Socket.io] Client connected: ${socket.id}`);
        socket.on('disconnect', () => {
            logger.info(`[Socket.io] Client disconnected: ${socket.id}`);
        });
    });

    logger.info('[Socket.io] Initialized');
    return io;
};

export const getIO = (): Server => {
    if (!io) throw new Error('Socket.io not initialized — call initSocket() first');
    return io;
};

/** Emit a WhatsApp-related event to all connected clients */
export const emitWA = (event: string, data: unknown): void => {
    io?.emit(event, data);
};
