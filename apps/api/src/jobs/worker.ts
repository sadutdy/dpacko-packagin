import { Worker, type Job } from 'bullmq';

import { logger } from '../config/logger.js';
import { getRedis } from '../config/redis.js';
import { QUEUE_NAMES, QueueName } from './queues.js';
import { processOfficeReminder, syncOfficeReminders } from './officeReminders.js';

/**
 * BullMQ worker entrypoint — a separate process from the API. Each queue gets
 * its own worker; job ids are deterministic so enqueueing twice is a no-op.
 */
async function processJob(name: string, job: Job): Promise<void> {
  logger.info({ jobId: job.id, queue: name }, 'job started');

  switch (name) {
    case QueueName.OfficeReminders:
      await processOfficeReminder(job);
      break;
    case QueueName.NotificationFanout:
      // M2 wires this to the WhatsApp/SMS adapters.
      logger.info({ payload: job.data }, 'notification fanout (stub)');
      break;
    default:
      logger.info({ payload: job.data }, 'job processor (stub)');
  }
}

export function createWorkers(): Worker[] {
  return QUEUE_NAMES.map(
    (name) =>
      new Worker(name, (job) => processJob(name, job), {
        connection: getRedis(),
        concurrency: name === QueueName.NotificationFanout ? 20 : 5,
      }),
  );
}

export async function startWorker(): Promise<Worker[]> {
  const workers = createWorkers();

  for (const worker of workers) {
    worker.on('completed', (job) => logger.info({ jobId: job.id }, 'job completed'));
    worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'job failed'));
  }

  logger.info({ queues: QUEUE_NAMES }, 'worker started');
  try {
    await syncOfficeReminders();
  } catch (err) {
    logger.warn({ err }, 'office reminder sync failed (redis unavailable?)');
  }
  return workers;
}
