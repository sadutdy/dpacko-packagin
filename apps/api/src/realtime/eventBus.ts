import { EventEmitter } from 'node:events';

import { logger } from '../config/logger.js';

type EventHandler = (payload: unknown) => void;

/**
 * Internal event bus. Modules emit domain events here; the bus fans out to
 * Socket.IO rooms and to BullMQ producers. Modules never touch Socket.IO or a
 * queue directly.
 */
class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  publish(event: string, payload: unknown): void {
    logger.debug({ event }, 'domain event published');
    this.emit(event, payload);
  }

  subscribe(event: string, handler: EventHandler): void {
    this.on(event, handler);
  }
}

export const eventBus = new DomainEventBus();

export function emitDomainEvent(event: string, payload: unknown): void {
  eventBus.publish(event, payload);
}
