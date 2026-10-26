import { Schema, model } from 'mongoose';

const notificationChannelSchema = new Schema(
  {
    group: { type: String, enum: ['packing', 'accounts', 'sales', 'office'], required: true },
    channel: { type: String, enum: ['in_app', 'whatsapp', 'sms'], required: true },
    enabled: { type: Boolean, default: true },
    templateId: { type: String, default: '' },
  },
  { timestamps: true },
);

notificationChannelSchema.index({ group: 1, channel: 1 }, { unique: true });

const notificationLogSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    event: { type: String, default: '' },
    group: { type: String, default: '' },
    channel: { type: String, default: 'in_app' },
    recipients: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    body: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'skipped', 'failed'], default: 'sent' },
    sentAt: { type: Date, default: () => new Date() },
    sentBy: { type: String, default: '' },
  },
  { timestamps: true },
);

notificationLogSchema.index({ event: 1, sentAt: -1 });
notificationLogSchema.index({ orderId: 1, sentAt: -1 });

export const NotificationChannel = model('NotificationChannel', notificationChannelSchema);
export const NotificationLog = model('NotificationLog', notificationLogSchema);
