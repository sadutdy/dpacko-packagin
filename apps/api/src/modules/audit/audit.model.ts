import { Schema, model } from 'mongoose';

/** Append-only audit log. TTL after 2 years. */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    entityType: { type: String, default: '', index: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    requestId: { type: String, default: '', index: true },
    occurredAt: { type: Date, default: Date.now, index: { expires: 63072000 } },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const AuditLog = model('AuditLog', auditLogSchema);
