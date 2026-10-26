import type { Server as HttpServer } from 'node:http';

import { Server } from 'socket.io';

import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { eventBus } from './eventBus.js';
import { verifyAccessToken } from '../modules/auth/strategies/jwt.js';

export type SocketServer = Server;

/**
 * Advisory realtime gateway. Events are a delivery optimisation only — clients
 * always reconcile via REST. Rooms: `user:<id>`, `role:<role>`.
 */
export function createSocketServer(httpServer: HttpServer): SocketServer {
  const io = new Server(httpServer, {
    cors: { origin: config.WEB_ORIGIN, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    try {
      const claims = verifyAccessToken(token);
      socket.data.user = { id: claims.sub, role: claims.role };
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as { id: string; role: string };
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);
    logger.debug({ socketId: socket.id, userId: user.id }, 'socket connected');

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'socket disconnected');
    });
  });

  return io;
}

export function emitToUser(io: SocketServer, userId: string, event: string, payload: unknown) {
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToRole(io: SocketServer, role: string, event: string, payload: unknown) {
  io.to(`role:${role}`).emit(event, payload);
}

/** Bridges domain events onto the socket rooms. */
export function wireEventBusToSocket(io: SocketServer): void {
  eventBus.subscribe('order.status_changed', (payload) => {
    const body = payload as { orderId?: string };
    if (body.orderId) io.to(`order:${body.orderId}`).emit('order.status_changed', payload);
  });
}
