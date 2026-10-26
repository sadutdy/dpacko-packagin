import { Queue } from 'bullmq';

import { getRedis } from '../config/redis.js';

export const QueueName = {
  OrderLifecycle: 'order-lifecycle',
  ProductionDispatch: 'production-dispatch',
  InventoryReorder: 'inventory-reorder',
  PaymentReconcile: 'payment-reconcile',
  DeliveryTracking: 'delivery-tracking',
  NotificationFanout: 'notification-fanout',
  InvoiceGenerate: 'invoice-generate',
  ReportExport: 'report-export',
  Daily: 'daily',
  OfficeReminders: 'office-reminders',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const QUEUE_NAMES = Object.values(QueueName);

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
  queues.set(name, queue);
  return queue;
}

/* Note: OfficeReminders is defined above with the other queue names. */
