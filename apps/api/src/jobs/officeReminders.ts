import type { Job } from 'bullmq';

import { logger } from '../config/logger.js';
import { getQueue, QueueName } from './queues.js';
import { ReminderRule } from '../modules/office/office.model.js';
import { notificationsService } from '../modules/notifications/notification.service.js';
import { OfficeTask } from '../modules/office/office.model.js';
import { Types } from 'mongoose';
import { User } from '../modules/auth/auth.model.js';

export const OFFICE_REMINDER_QUEUE = QueueName.OfficeReminders;

/**
 * (Re)configures one repeatable job per active reminder rule on worker boot,
 * keyed by the rule so re-running this is idempotent.
 */
export async function syncOfficeReminders(): Promise<number> {
  const rules = await ReminderRule.find({ active: true }).exec();
  const queue = getQueue(OFFICE_REMINDER_QUEUE);
  for (const rule of rules) {
    await queue.add(String(rule.key), {}, {
      repeat: { pattern: rule.cron, tz: 'Asia/Kolkata' },
      jobId: `office-reminder-${String(rule.key)}`,
    });
  }
  logger.info({ count: rules.length }, 'office reminder repeatables synced');
  return rules.length;
}

/** Reminder processor — creates an in-app task and fans out channel messages. */
export async function processOfficeReminder(job: Job): Promise<void> {
  const rule = await ReminderRule.findOne({ key: String(job.name) }).exec();
  if (!rule) {
    logger.warn({ key: job.name }, 'reminder rule missing — skipping');
    return;
  }
  const title = rule.get('title') || `${String(rule.get('kind')).replaceAll('_', ' ')} reminder`;

  // In-app: one office task for every user holding the office audiences.
  const recipients = await User.find({ role: { $in: ['office_admin', 'admin'] }, status: 'active' }).exec();
  for (const user of recipients) {
    await OfficeTask.create([
      {
        title,
        kind: 'reminder',
        detail: `Scheduled reminder ${rule.key}`,
        status: 'open',
        owner: user._id,
        ownerRole: String(user.get('role')),
        assignedBy: user._id,
        doneAt: null,
      },
    ]).catch(() => undefined);
  }

  await notificationsService.fanOut({
    event: `reminder.${rule.get('kind')}`,
    groups: ['office'],
    body: title,
    actorId: new Types.ObjectId().toHexString(),
    actorName: 'System',
  });
  logger.info({ key: rule.key }, 'office reminder dispatched');
}
