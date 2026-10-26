import { AppError } from '../../core/errors/AppError.js';
import { userRepository } from '../auth/auth.repository.js';
import { NotificationChannel, NotificationLog } from './notification.model.js';

/** Roles to notify for each desk audience group. */
export const GROUP_ROLES: Record<string, readonly string[]> = {
  packing: ['production'],
  accounts: ['finance', 'admin'],
  sales: ['admin', 'office_admin'],
  office: ['office_admin', 'admin'],
};

const DEFAULT_GROUPS: readonly string[] = ['packing', 'accounts', 'sales', 'office'];
const DEFAULT_CHANNELS: readonly string[] = ['in_app'];

function toObject(doc: { toObject(options?: Record<string, unknown>): Record<string, unknown> }): Record<string, unknown> {
  return doc.toObject({ versionKey: false });
}

export const notificationsService = {
  /** Channel configuration per audience group (creates safe defaults lazily). */
  async listChannelConfig() {
    for (const group of DEFAULT_GROUPS) {
      for (const channel of DEFAULT_CHANNELS) {
        await NotificationChannel.updateOne({ group, channel }, { $setOnInsert: { enabled: true } }, { upsert: true });
      }
    }
    const configs = await NotificationChannel.find({}).sort({ group: 1, channel: 1 });
    return configs.map(toObject);
  },

  async updateChannelConfig(id: string, patch: Record<string, unknown>) {
    const config = await NotificationChannel.findByIdAndUpdate(id, { $set: patch }, { new: true });
    if (!config) throw AppError.notFound('Channel configuration not found');
    return toObject(config);
  },

  /**
   * Records a desk-step fan-out: every configured channel of every audience
   * group produces one log row. in_app messages resolve recipients from the
   * group's roles; whatsapp/sms are logged as skipped until providers exist.
   */
  async fanOut(input: {
    event: string;
    groups: readonly string[];
    body: string;
    orderId?: string;
    actorId: string;
    actorName: string;
  }) {
    const configs = await NotificationChannel.find({ group: { $in: [...input.groups] }, enabled: true });
    const rows: Record<string, unknown>[] = [];
    for (const group of input.groups) {
      const configured = configs.filter((document) => String(document.get('group')) === group);
      const channels = configured.length > 0 ? configured : [];
      if (channels.length === 0) {
        rows.push({
          orderId: input.orderId ?? null,
          event: input.event,
          group,
          channel: DEFAULT_CHANNELS[0],
          recipients: [],
          body: input.body,
          status: 'skipped',
          sentBy: input.actorId,
        });
        continue;
      }
      for (const channel of channels) {
        const channelName = String(channel.get('channel'));
        if (channelName === 'in_app') {
          const recipients = await userRepository.listByRoles(GROUP_ROLES[group] ?? []);
          rows.push({
            orderId: input.orderId ?? null,
            event: input.event,
            group,
            channel: channelName,
            recipients: recipients.map((user) => user._id),
            body: input.body,
            status: 'sent',
            sentBy: input.actorId,
          });
        } else {
          rows.push({
            orderId: input.orderId ?? null,
            event: input.event,
            group,
            channel: channelName,
            recipients: [],
            body: input.body,
            status: 'skipped',
            sentBy: input.actorId,
          });
        }
      }
    }
    if (rows.length > 0) await NotificationLog.insertMany(rows);
    return rows.length;
  },

  async listLog(query: Record<string, unknown>, limit = 100) {
    const rows = await NotificationLog.find(query).sort({ sentAt: -1 }).limit(limit);
    return rows.map(toObject);
  },
};
