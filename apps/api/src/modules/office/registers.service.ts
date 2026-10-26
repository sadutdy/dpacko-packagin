import { Types } from 'mongoose';

import { assertDelegation, DelegationAction, findDelegation, type DelegationEntry } from '@ameen/domain';

import { AppError } from '../../core/errors/AppError.js';
import { buildPageMeta, parsePagination } from '../../core/http/pagination.js';
import { crmRepository } from '../crm/crm.repository.js';
import { userRepository } from '../auth/auth.repository.js';
import { isoBusinessDay, officeService } from './office.service.js';
import {
  CourierEntry,
  DelegationMatrix,
  DocumentAcknowledgement,
  DocumentsMaster,
  MaintenanceLog,
  PettyCashEntry,
  StationeryIndent,
  StationeryItem,
  StationeryMove,
  toDelegationEntry,
  AttendanceInput,
  Deviation,
  VendorDeliveryTracker,
  WasteLog,
  ReminderRule,
  DELEGATION_DEFAULTS,
  type DelegationMatrixDoc,
} from './office.model.js';
import { nextCounter } from '../counters/counter.model.js';
import { notificationsService } from '../notifications/notification.service.js';
import {
  officeRepository,
  type IndentDoc,
  type StationeryItemDoc,
} from './office.repository.js';

/** Mongoose is cast through `unknown` because services only rely on plain fields. */
function toObject(doc: unknown): Record<string, unknown> {
  return (doc as { toObject(options?: Record<string, unknown>): Record<string, unknown> }).toObject({ versionKey: false });
}

const ISO_PERIOD = '25-26';

/** Delegation rows for one role+action (office's own collaboration model). */
async function delegationEntries(role: string, action: string): Promise<DelegationEntry[]> {
  const rows = await officeRepository.listRegisterAll(DelegationMatrix, { role, action }, {});
  return rows.map((row) => toDelegationEntry(row as unknown as DelegationMatrixDoc));
}

/** Indent numbers: INT-2526-00001. */
async function nextIndentNo(): Promise<string> {
  return `INT-${ISO_PERIOD.replace('-', '')}-${String(await nextCounter('indent', ISO_PERIOD)).padStart(5, '0')}`;
}

/** Guards the delegation action vocabulary used by the matrix API. */
function assertDelegationAction(action: string): void {
  const allowed = new Set<string>(Object.values(DelegationAction));
  if (!allowed.has(action)) throw AppError.validation(`Unknown delegation action ${action}`);
}

export const registersService = {
  /* ------------------------------- courier ------------------------------- */

  async listCourier(query: { direction?: string; page: number; limit: number; format?: string }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {};
    if (query.direction) filter.direction = query.direction;
    const [rows, total] = await Promise.all([
      officeRepository.listRegister(CourierEntry, filter, params.skip, params.limit, { createdAt: -1 }),
      officeRepository.countRegister(CourierEntry, filter),
    ]);
    return { rows: rows.map(toObject), meta: buildPageMeta(total, params) };
  },

  async createCourier(input: Record<string, unknown>, actorId: string) {
    if (input.customerId) {
      const customer = await crmRepository.findById(String(input.customerId));
      if (!customer) throw AppError.notFound('Customer not found');
    }
    const entry = await officeRepository.createRegister(CourierEntry, {
      ...input,
      by: new Types.ObjectId(actorId),
    });
    return toObject(entry);
  },

  async updateCourier(id: string, patch: Record<string, unknown>, actorId: string) {
    void actorId;
    const updated = await officeRepository.updateRegister(CourierEntry, id, patch);
    if (!updated) throw AppError.notFound('Courier entry not found');
    return toObject(updated);
  },

  /* ----------------------------- stationery ----------------------------- */

  async listStationery(query: { page: number; limit: number; format?: string }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const [rows, total] = await Promise.all([
      officeRepository.listRegister(StationeryItem, {}, params.skip, params.limit, { name: 1 }),
      officeRepository.countRegister(StationeryItem, {}),
    ]);
    return { rows: rows.map(toObject), meta: buildPageMeta(total, params) };
  },

  async createStationeryItem(input: Record<string, unknown>, actorId: string) {
    void actorId;
    const item = await officeRepository.createRegister(StationeryItem, input);
    return toObject(item);
  },

  /** In/out/reorder movement: in adds stock, out consumes, reorder records intent. */
  async moveStationery(input: { itemId: string; direction: string; qty: number; note?: string }, actorId: string) {
    const item = await officeRepository.findRegisterById(StationeryItem, input.itemId);
    if (!item) throw AppError.notFound('Stationery item not found');
    const details = item as StationeryItemDoc & { set(field: string, v: unknown): void; save(): Promise<unknown> };
    if (input.direction === 'out') {
      if ((details.qty ?? 0) < input.qty) {
        throw AppError.conflict(`Only ${String(details.qty)} available in stationery`);
      }
      details.set('qty', (details.qty ?? 0) - input.qty);
    } else if (input.direction === 'in') {
      details.set('qty', (details.qty ?? 0) + input.qty);
    }
    await details.save();
    const move = await officeRepository.createRegister(StationeryMove, {
      itemId: new Types.ObjectId(input.itemId),
      direction: input.direction,
      qty: input.qty,
      note: input.note ?? '',
      by: new Types.ObjectId(actorId),
    });
    return toObject(move);
  },

  /* ------------------------------- indents ------------------------------ */

  async listIndents(query: { status?: string; page: number; limit: number; format?: string }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      officeRepository.listRegister(StationeryIndent, filter, params.skip, params.limit, { createdAt: -1 }),
      officeRepository.countRegister(StationeryIndent, filter),
    ]);
    return { rows: rows.map(toObject), meta: buildPageMeta(total, params) };
  },

  async createIndent(
    input: { title: string; itemDetail?: string; qty: number; estimatedPaise: number; purpose?: string; requiredDate?: Date },
    actorId: string,
    actorRole: string,
  ) {
    if (actorRole !== 'admin') {
      // Domain owns the rule; violations surface as DomainError and map to 403.
      assertDelegation(await delegationEntries(actorRole, 'indent_request'), actorRole, 'indent_request', input.estimatedPaise);
    }
    const indent = await officeRepository.createRegister(StationeryIndent, {
      refNo: await nextIndentNo(),
      ...input,
      status: 'submitted',
      requestedBy: new Types.ObjectId(actorId),
    });
    return toObject(indent);
  },

  /** submit → approve/commit under delegation — admins are unrestricted. */
  async patchIndent(id: string, input: { action: string; note?: string }, actorId: string, actorRole: string) {
    void actorRole;
    const indent = await officeRepository.findRegisterById(StationeryIndent, id);
    if (!indent) throw AppError.notFound('Indent not found');
    const doc = indent as IndentDoc & { status: string };
    const target: string =
      { submit: 'submitted', approve: 'approved', commit: 'committed', reject: 'rejected' }[input.action] ?? 'submitted';
    const ladder: Record<string, string[]> = {
      draft: ['submitted'],
      submitted: ['approved', 'rejected'],
      approved: ['committed', 'rejected'],
      committed: [],
      rejected: ['submitted'],
    };
    if (!ladder[doc.status]?.includes(target)) {
      throw AppError.conflict(`Indent cannot move from ${doc.status} to ${target}`);
    }
    if (['approve', 'commit', 'reject'].includes(input.action) && actorRole !== 'admin') {
      assertDelegation(await delegationEntries(actorRole, 'indent_request'), actorRole, 'indent_request');
    }
    const update: Record<string, unknown> = { status: target, decisionNote: input.note ?? '' };
    if (target === 'approved') {
      update.approvedBy = new Types.ObjectId(actorId);
      update.approvedAt = new Date();
    }
    const updated = await officeRepository.updateRegister(StationeryIndent, id, update);
    if (!updated) throw AppError.notFound('Indent not found');
    return toObject(updated);
  },

  /* --------------------------- maintenance log --------------------------- */

  async listMaintenance(query: { page: number; limit: number; format?: string }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const [rows, total] = await Promise.all([
      officeRepository.listRegister(MaintenanceLog, {}, params.skip, params.limit, { createdAt: -1 }),
      officeRepository.countRegister(MaintenanceLog, {}),
    ]);
    return { rows: rows.map(toObject), meta: buildPageMeta(total, params) };
  },

  async createMaintenance(input: Record<string, unknown>, actorId: string) {
    void actorId;
    const entry = await officeRepository.createRegister(MaintenanceLog, input);
    return toObject(entry);
  },

  async updateMaintenance(id: string, patch: Record<string, unknown>, actorId: string) {
    void actorId;
    const updated = await officeRepository.updateRegister(MaintenanceLog, id, patch);
    if (!updated) throw AppError.notFound('Maintenance entry not found');
    return toObject(updated);
  },

  /* ------------------------------ waste log ------------------------------ */

  async listWaste(query: { page: number; limit: number; format?: string }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const [rows, total] = await Promise.all([
      officeRepository.listRegister(WasteLog, {}, params.skip, params.limit, { at: -1 }),
      officeRepository.countRegister(WasteLog, {}),
    ]);
    return { rows: rows.map(toObject), meta: buildPageMeta(total, params) };
  },

  async createWaste(input: Record<string, unknown>, actorId: string) {
    const entry = await officeRepository.createRegister(WasteLog, {
      ...input,
      at: new Date(),
      by: new Types.ObjectId(actorId),
    });
    return toObject(entry);
  },

  /* ----------------------------- petty cash ----------------------------- */

  async listPettyCash(query: { status?: string; page: number; limit: number; format?: string }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      officeRepository.listRegister(PettyCashEntry, filter, params.skip, params.limit, { date: -1, createdAt: -1 }),
      officeRepository.countRegister(PettyCashEntry, filter),
    ]);
    return { rows: rows.map(toObject), meta: buildPageMeta(total, params) };
  },

  /**
   * POST petty-cash: amount must fit the delegation limit, and the rolling
   * 7-day total per requester may not breach it (splitting detector flags the
   * entry and raises a discrepancy deviation).
   */
  async createPettyCash(
    input: { date?: string; purpose: string; costCentre?: string; requester?: string; receiptNo?: string; amountPaise: number; notes?: string },
    actorId: string,
    actorRole: string,
  ) {
    const entries = await delegationEntries(actorRole, 'petty_cash_entry');    if (actorRole !== 'admin') {
      assertDelegation(entries, actorRole, 'petty_cash_entry', input.amountPaise);
    }
    const limit = findDelegation(entries, actorRole, 'petty_cash_entry')?.limitPaise ?? null;
    let splittingSuspect = false;
    if (limit !== null && input.requester) {
      const since = isoBusinessDay(new Date(Date.now() - 7 * 86_400_000));
      const recent = await officeRepository.listRegisterAll(PettyCashEntry, {
        requester: input.requester,
        date: { $gte: since },
      }, { createdAt: -1 });
      const rollingTotal = recent.reduce((sum: number, row: unknown) => sum + Number((row as { amountPaise?: number }).amountPaise ?? 0), 0);
      splittingSuspect = rollingTotal + input.amountPaise > limit;
      if (splittingSuspect) {
        await officeRepository.createDeviation({
          kind: 'discrepancy',
          severity: 'low',
          category: 'petty_cash',
          immediateEscalation: false,
          detail: `Splitting suspect: ${input.requester} crossed ₹${(limit / 100).toLocaleString('en-IN')} within 7 days.`,
          openedBy: new Types.ObjectId(actorId),
        });
      }
    }
    const entry = await officeRepository.createRegister(PettyCashEntry, {
      date: input.date ?? isoBusinessDay(),
      purpose: input.purpose,
      costCentre: input.costCentre ?? '',
      requester: input.requester ?? '',
      receiptNo: input.receiptNo ?? '',
      amountPaise: input.amountPaise,
      status: splittingSuspect ? 'flagged' : 'pending',
      splittingSuspect,
      notes: input.notes ?? '',
      by: new Types.ObjectId(actorId),
    });
    return toObject(entry);
  },

  async updatePettyCash(id: string, patch: { status?: string; reconciliation?: { note?: string } }, actorId: string) {
    const update: Record<string, unknown> = {};
    if (patch.status) update.status = patch.status;
    if (patch.reconciliation) {
      update.reconciliation = {
        reconciledBy: new Types.ObjectId(actorId),
        reconciledAt: new Date(),
        note: patch.reconciliation.note ?? '',
      };
    }
    const updated = await officeRepository.updateRegister(PettyCashEntry, id, update);
    if (!updated) throw AppError.notFound('Petty cash entry not found');
    return toObject(updated);
  },

  /* ------------------------- vendor deliveries -------------------------- */

  async listVendorTracker(query: { page: number; limit: number; format?: string }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const [rows, total] = await Promise.all([
      officeRepository.listRegister(VendorDeliveryTracker, {}, params.skip, params.limit, { createdAt: -1 }),
      officeRepository.countRegister(VendorDeliveryTracker, {}),
    ]);
    return { rows: rows.map(toObject), meta: buildPageMeta(total, params) };
  },

  async createVendorTracker(input: Record<string, unknown>, actorId: string) {
    void actorId;
    const entry = await officeRepository.createRegister(VendorDeliveryTracker, input);
    return toObject(entry);
  },

  async updateVendorTracker(id: string, patch: Record<string, unknown>, actorId: string) {
    void actorId;
    const updated = await officeRepository.updateRegister(VendorDeliveryTracker, id, patch);
    if (!updated) throw AppError.notFound('Tracker entry not found');
    return toObject(updated);
  },

  /* ------------------------- documents & SOP acks ------------------------ */

  async listDocuments(query: { docType?: string; page: number; limit: number; format?: string }) {
    const params = parsePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {};
    if (query.docType) filter.docType = query.docType;
    const [rows, total] = await Promise.all([
      officeRepository.listRegister(DocumentsMaster, filter, params.skip, params.limit, { docNo: 1 }),
      officeRepository.countRegister(DocumentsMaster, filter),
    ]);
    return { rows: rows.map(toObject), meta: buildPageMeta(total, params) };
  },

  async createDocument(input: Record<string, unknown>, actorId: string) {
    void actorId;
    const doc = await officeRepository.createRegister(DocumentsMaster, input);
    return toObject(doc);
  },

  /** Status changes (obsolete/retired) need `office:documents:authorize`. */
  async updateDocument(id: string, patch: Record<string, unknown>, actorRole: string) {
    if (patch.status !== undefined && patch.status !== 'current' && actorRole !== 'admin') {
      throw AppError.forbidden('Only an admin may retire or obsolete documents');
    }
    const updated = await officeRepository.updateRegister(DocumentsMaster, id, patch);
    if (!updated) throw AppError.notFound('Document not found');
    return toObject(updated);
  },

  async acknowledgeDocument(input: { docId: string }, userId: string) {
    const doc = await officeRepository.findRegisterById(DocumentsMaster, input.docId);
    if (!doc) throw AppError.notFound('Document not found');
    const existing = await DocumentAcknowledgement.findOne({
      docId: new Types.ObjectId(input.docId),
      user: new Types.ObjectId(userId),
    }).exec();
    if (existing) return toObject(existing);
    const ack = await DocumentAcknowledgement.create({
      docId: new Types.ObjectId(input.docId),
      revision: (doc as unknown as { revision?: number }).revision ?? 1,
      user: new Types.ObjectId(userId),
    });
    return toObject(ack);
  },

  async listAcks(docId?: string, userId?: string) {
    const filter: Record<string, unknown> = {};
    if (docId) filter.docId = new Types.ObjectId(docId);
    if (userId) filter.user = new Types.ObjectId(userId);
    const rows = await DocumentAcknowledgement.find(filter).sort({ at: -1 }).limit(200).exec();
    return rows.map((row) => toObject(row));
  },

  /* ------------------------------ attendance ----------------------------- */

  async listAttendance(query: { date?: string; userId?: string }) {
    const filter: Record<string, unknown> = {};
    if (query.date) filter.date = query.date;
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    const rows = await officeRepository.listRegisterAll(AttendanceInput, filter, { date: -1 });
    return rows.map(toObject);
  },

  async upsertAttendance(
    input: { userId: string; date?: string; status: string; inTime?: string; outTime?: string; notes?: string },
    actorId: string,
  ) {
    const user = await userRepository.findById(input.userId);
    if (!user) throw AppError.notFound('User not found');
    const date = input.date ?? isoBusinessDay();
    const updated = await AttendanceInput.findOneAndUpdate(
      { userId: new Types.ObjectId(input.userId), date },
      {
        $set: {
          status: input.status,
          inTime: input.inTime ?? '',
          outTime: input.outTime ?? '',
          notes: input.notes ?? '',
          by: new Types.ObjectId(actorId),
        },
      },
      { new: true, upsert: true },
    ).exec();
    return toObject(updated);
  },

  /* ----------------------------- deviations ------------------------------ */

  async listDeviations(query: { openOnly?: string }) {
    const filter: Record<string, unknown> = query.openOnly === 'true' ? { closedAt: null } : {};
    const rows = await Deviation.find(filter).sort({ createdAt: -1 }).limit(100).exec();
    return rows.map((row) => toObject(row));
  },

  async createDeviation(
    input: {
      kind: string;
      severity?: string;
      category?: string;
      immediateEscalation?: boolean;
      clientId?: string;
      orderId?: string;
      detail: string;
      correctiveAction?: string;
    },
    actorId: string,
  ) {
    const deviation = await officeRepository.createDeviation({
      kind: input.kind,
      severity: input.severity ?? 'low',
      category: input.category ?? '',
      immediateEscalation: input.immediateEscalation ?? false,
      customerId: input.clientId ? new Types.ObjectId(input.clientId) : null,
      orderId: input.orderId ? new Types.ObjectId(input.orderId) : null,
      detail: input.detail,
      correctiveAction: input.correctiveAction ?? '',
      openedBy: new Types.ObjectId(actorId),
    });
    if (deviation.immediateEscalation) {
      await officeService.createTask(
        {
          title: `Deviation ${deviation.kind} needs head escalation`,
          detail: deviation.detail,
          priority: 'urgent',
        },
        actorId,
      );
    }
    return toObject(deviation);
  },

  async updateDeviation(id: string, patch: { correctiveAction?: string; severity?: string; closed?: boolean }) {
    const update: Record<string, unknown> = {};
    if (patch.correctiveAction !== undefined) update.correctiveAction = patch.correctiveAction;
    if (patch.severity !== undefined) update.severity = patch.severity;
    if (patch.closed === true) update.closedAt = new Date();
    const updated = await officeRepository.updateRegister(Deviation, id, update);
    if (!updated) throw AppError.notFound('Deviation not found');
    return toObject(updated);
  },
};

/* ================== controls (M7): reminders, matrix, channels ================== */

export const controlsService = {
  /** Reminder rules (BullMQ repeatables are synced from these on worker boot). */
  async listReminders() {
    const rows = await ReminderRule.find({}).sort({ key: 1 }).exec();
    return rows.map((row) => toObject(row));
  },

  async createReminder(input: { key: string; kind: string; cron: string; active?: boolean; channel?: string; title?: string }) {
    const existing = await ReminderRule.findOne({ key: input.key }).exec();
    if (existing) throw AppError.conflict(`Reminder rule ${input.key} already exists`);
    const rule = await ReminderRule.create(input);
    return toObject(rule);
  },

  async updateReminder(key: string, patch: { active?: boolean; cron?: string; channel?: string; title?: string }) {
    const rule = await ReminderRule.findOneAndUpdate({ key }, { $set: patch }, { new: true }).exec();
    if (!rule) throw AppError.notFound('Reminder rule not found');
    return toObject(rule);
  },

  /**
   * Delegation matrix — listing merges stored rows with domain defaults so
   * unset pairs are visible as NOT_DELEGATED candidates.
   */
  async listMatrix() {
    const rows = await officeRepository.listRegisterAll(DelegationMatrix, {}, { action: 1, role: 1 });
    const stored = new Map(
      rows.map((row) => [
        `${String((row as { role: string }).role)}:${String((row as { action: string }).action)}`,
        toDelegationEntry(row as unknown as DelegationMatrixDoc),
      ]),
    );
    const merged: Record<string, unknown>[] = rows.map((row) =>
      toDelegationEntry(row as unknown as DelegationMatrixDoc) as unknown as Record<string, unknown>,
    );
    for (const entry of DELEGATION_DEFAULTS as Array<Record<string, unknown>>) {
      const key = `${String(entry.role)}:${String(entry.action)}`;
      if (!stored.has(key)) merged.push({ ...entry });
    }
    return merged;
  },

  /** Upserts one role+action row (PUT semantics across {role, action, limit}). */
  async upsertMatrix(input: { role: string; action: string; limitPaise?: number | null; limitQty?: number | null; active: boolean }) {
    assertDelegationAction(input.action);
    const updated = await DelegationMatrix.findOneAndUpdate(
      { role: input.role, action: input.action },
      {
        role: input.role,
        action: input.action,
        limitPaise: input.limitPaise ?? null,
        limitQty: input.limitQty ?? null,
        active: input.active,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
    return toDelegationEntry(updated as unknown as DelegationMatrixDoc);
  },

  async listChannels() {
    return notificationsService.listChannelConfig();
  },
};
