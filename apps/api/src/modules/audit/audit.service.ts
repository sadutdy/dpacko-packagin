import type { Types } from 'mongoose';

import { AuditLog } from './audit.model.js';

export interface AuditEntry {
  actorId?: string | Types.ObjectId | null;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string | Types.ObjectId | null;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export const auditService = {
  async record(entry: AuditEntry) {
    try {
      await AuditLog.create({
        actorId: entry.actorId ?? null,
        actorRole: entry.actorRole ?? '',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
        ip: entry.ip ?? '',
        userAgent: entry.userAgent ?? '',
        requestId: entry.requestId ?? '',
        occurredAt: new Date(),
      });
    } catch {
      // Auditing must never break the request path.
    }
  },

  list(filter: Record<string, unknown>, skip: number, limit: number) {
    return AuditLog.find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit).exec();
  },

  count(filter: Record<string, unknown>) {
    return AuditLog.countDocuments(filter).exec();
  },
};
