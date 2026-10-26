import { Schema, model } from 'mongoose';

import type { DelegationEntry } from '@ameen/domain';

const CHECKLIST_KINDS = ['opening', 'closing'] as const;
const TASK_PRIORITIES = ['low', 'normal', 'urgent'] as const;
const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
const TASK_KINDS = ['task', 'inbox', 'urgent_request', 'reminder'] as const;
const APPOINTMENT_KINDS = ['visitor', 'meeting'] as const;

/**
 * Delegation-of-authority matrix: approval limits per role + action.
 * Rows are edited only by holders of `office:matrix:write`
 * (Role.Admin); reads require `office:matrix:read`. Every write is audited.
 */
const delegationMatrixSchema = new Schema(
  {
    role: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    limitPaise: { type: Number, default: null },
    limitQty: { type: Number, default: null },
    active: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

delegationMatrixSchema.index({ role: 1, action: 1 }, { unique: true });

export interface DelegationMatrixDoc extends Record<string, unknown> {
  role: string;
  action: string;
  limitPaise: number | null;
  limitQty: number | null;
  active: boolean;
  updatedAt: Date;
}

export function toDelegationEntry(doc: DelegationMatrixDoc): DelegationEntry {
  return {
    role: doc.role,
    action: doc.action,
    limitPaise: doc.limitPaise,
    limitQty: doc.limitQty,
    active: doc.active,
  };
}

export const DelegationMatrix = model('DelegationMatrix', delegationMatrixSchema);

/** Default matrix applied at seed: office desk limits + audit-covered actions. */
export const DELEGATION_DEFAULTS: Record<string, unknown>[] = [
  { role: 'admin', action: 'price_approval', limitPaise: null, limitQty: null },
  { role: 'admin', action: 'invoice_approval', limitPaise: null, limitQty: null },
  { role: 'admin', action: 'document_removal', limitPaise: null, limitQty: null },
  { role: 'admin', action: 'indent_request', limitPaise: null, limitQty: null },
  { role: 'office_admin', action: 'indent_request', limitPaise: 2_500_000, limitQty: null },
  { role: 'office_admin', action: 'production_request', limitPaise: 2_500_000, limitQty: null },
  { role: 'office_admin', action: 'petty_cash_entry', limitPaise: 500_000, limitQty: null },
  // Office admin has NO delegation for price/invoice approval or document
  // removal — the absence of a row (NOT_DELEGATED) blocks those actions.
];

/* ------------------------------------------------------------------ *
 * Module 1 — "My Day": checklists, tasks, visitors/meetings.          *
 * ------------------------------------------------------------------ */

/** Configurable checklist template items (opening / closing). */
const checklistItemSchema = new Schema(
  {
    kind: { type: String, enum: CHECKLIST_KINDS, required: true, index: true },
    labelEn: { type: String, required: true },
    labelTa: { type: String, default: '' },
    labelMl: { type: String, default: '' },
    position: { type: Number, default: 100 },
    mandatory: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const ChecklistItem = model('ChecklistItem', checklistItemSchema);

/** One submission per kind + calendar day (unique index enforced). */
const checklistSubmissionSchema = new Schema(
  {
    kind: { type: String, enum: CHECKLIST_KINDS, required: true },
    /** ISO `YYYY-MM-DD` in the shop's local timezone (Asia/Kolkata). */
    date: { type: String, required: true },
    items: [
      new Schema(
        {
          itemId: { type: Schema.Types.ObjectId, ref: 'ChecklistItem', required: true },
          done: { type: Boolean, default: false },
          note: { type: String, default: '' },
          /** Timestamp of the actual check — appended by the server, never backdated. */
          at: { type: Date, default: Date.now },
        },
        { _id: true },
      ),
    ],
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    submittedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

checklistSubmissionSchema.index({ kind: 1, date: 1 }, { unique: true });

export const ChecklistSubmission = model('ChecklistSubmission', checklistSubmissionSchema);

/** Daily task list + shared inbox + urgent requests. No deletes — status only. */
const officeTaskSchema = new Schema(
  {
    kind: { type: String, enum: TASK_KINDS, default: 'task', index: true },
    title: { type: String, required: true },
    detail: { type: String, default: '' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    ownerRole: { type: String, default: '' },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'normal', index: true },
    status: { type: String, enum: TASK_STATUSES, default: 'open', index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    doneAt: { type: Date, default: null },
    outDatedAt: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const OfficeTask = model('OfficeTask', officeTaskSchema);

/** Visitors & meetings register (also drives "today's visitors" on My Day). */
const appointmentSchema = new Schema(
  {
    kind: { type: String, enum: APPOINTMENT_KINDS, required: true, index: true },
    personName: { type: String, required: true },
    organization: { type: String, default: '' },
    contact: { type: String, default: '' },
    host: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    purpose: { type: String, default: '' },
    date: { type: String, required: true, index: true },
    scheduledAt: { type: Date, default: null },
    timeIn: { type: Date, default: null },
    timeOut: { type: Date, default: null },
    /** Visitor / contractor ID details per policy. */
    idType: { type: String, default: '' },
    idNumber: { type: String, default: '' },
    restrictedArea: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const Appointment = model('Appointment', appointmentSchema);

/* ------------------------- sales order desk (M2) ------------------------- */

const deskEventSchema = new Schema(
  {
    step: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: null },
  },
  { _id: false },
);

/** One document per order holding that order's desk ladder. */
const orderDeskStepSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    events: { type: [deskEventSchema], default: [] },
  },
  { timestamps: true },
);

export const OrderDeskStep = model('OrderDeskStep', orderDeskStepSchema);

/* ---------------------- follow-ups & routes (M3) ----------------------- */

/** Weekly route plan: which customers the van visits on which weekday. */
const routeScheduleSchema = new Schema(
  {
    weekday: { type: Number, min: 0, max: 6, required: true, index: true },
    area: { type: String, required: true },
    kind: { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
    customers: { type: [Schema.Types.ObjectId], ref: 'Customer', default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

routeScheduleSchema.index({ weekday: 1, area: 1 }, { unique: true });

export const RouteSchedule = model('RouteSchedule', routeScheduleSchema);

/** Per-customer contact register (calls / whatsapp / voice note / visit). */
const callLogSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    date: { type: String, required: true },
    channel: { type: String, enum: ['call', 'whatsapp', 'voice', 'visit'], default: 'call' },
    outcome: { type: String, required: true },
    nextAction: { type: String, default: '' },
    nextActionDate: { type: String, default: '' },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

callLogSchema.index({ customerId: 1, date: -1 });

export const CallLog = model('CallLog', callLogSchema);

/* ------------------------ outstanding (M4) ------------------------ */

/** N8: per customer/day follow-up register with a promise-date snapshot. */
const outstandingFollowupSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    date: { type: String, required: true },
    amountPaise: { type: Number, default: 0 },
    promiseDate: { type: String, default: '' },
    outcome: { type: String, default: '' },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

outstandingFollowupSchema.index({ customerId: 1, date: -1 });

export const OutstandingFollowup = model('OutstandingFollowup', outstandingFollowupSchema);

/** N9: small carry-forward amounts the office collects against a next order. */
const smallOutstandingSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    amountPaise: { type: Number, required: true },
    reason: { type: String, default: '' },
    createdOn: { type: String, required: true },
    settled: { type: Boolean, default: false, index: true },
    settledOnOrderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    settledOn: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const SmallOutstandingLedger = model('SmallOutstandingLedger', smallOutstandingSchema);

/** N10: per-delivered-sale cash/expenses bookkeeping with day totals. */
const dailyCashCloseSchema = new Schema(
  {
    date: { type: String, required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    collectedPaise: { type: Number, default: 0 },
    expensesPaise: { type: Number, default: 0 },
    outstandingPaise: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const DailyCashClose = model('DailyCashClose', dailyCashCloseSchema);

/** N22: deviation / escalation log (shared with dispatch & alerts later). */
const deviationSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ['missed_deadline', 'unauthorized', 'discrepancy', 'incident', 'near_miss', 'suspected_fraud', 'data_breach'],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    category: { type: String, default: '' },
    immediateEscalation: { type: Boolean, default: false },
    owner: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    detail: { type: String, default: '' },
    correctiveAction: { type: String, default: '' },
    /** Null for system-raised deviations (e.g. overdue escalation flags). */
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Deviation = model('Deviation', deviationSchema);

/* ------------------- dispatch, complaints & alerts (M5) ------------------- */

/** Customer complaint register (product | service | other). */
const officeComplaintSchema = new Schema(
  {
    ticketNo: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    kind: { type: String, enum: ['product', 'service', 'other'], default: 'product' },
    title: { type: String, default: '' },
    detail: { type: String, required: true },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },
    guidance: { type: String, default: '' },
    resolution: { type: String, default: '' },
    closureDate: { type: String, default: '' },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const OfficeComplaint = model('OfficeComplaint', officeComplaintSchema);

/* ------------------------- registers 1–9 (M6) ------------------------- */

/** 1. Courier in/out register (route-to, POD fields). */
const courierEntrySchema = new Schema(
  {
    refNo: { type: String, default: '' },
    company: { type: String, default: '' },
    docketNo: { type: String, required: true },
    direction: { type: String, enum: ['sent', 'received'], default: 'sent' },
    routeTo: { type: String, default: '' },
    toName: { type: String, default: '' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    dispatchedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    podRef: { type: String, default: '' },
    podUrl: { type: String, default: '' },
    receivedBy: { type: String, default: '' },
    notes: { type: String, default: '' },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const CourierEntry = model('CourierEntry', courierEntrySchema);

/** 3. Stationery store: consumable items with stock + movement/register. */
const stationeryItemSchema = new Schema(
  {
    name: { type: String, required: true },
    unit: { type: String, default: 'pcs' },
    qty: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    avgCostPaise: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const StationeryItem = model('StationeryItem', stationeryItemSchema);

const stationeryMoveSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: 'StationeryItem', required: true, index: true },
    direction: { type: String, enum: ['in', 'out', 'reorder'], required: true },
    qty: { type: Number, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: () => new Date() },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const StationeryMove = model('StationeryMove', stationeryMoveSchema);

/** 4. Purchase/production indents — approval rider on the delegation matrix. */
const stationeryIndentSchema = new Schema(
  {
    refNo: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    itemDetail: { type: String, default: '' },
    qty: { type: Number, default: 0 },
    estimatedPaise: { type: Number, default: 0 },
    purpose: { type: String, default: '' },
    requiredDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'committed', 'rejected'],
      default: 'draft',
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    decisionNote: { type: String, default: '' },
  },
  { timestamps: true },
);

export const StationeryIndent = model('StationeryIndent', stationeryIndentSchema);

/** 5. Maintenance/facility register with monthly/yearly reminder cadence. */
const maintenanceSchema = new Schema(
  {
    location: { type: String, required: true },
    issue: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    assignedTeam: { type: String, default: '' },
    reportedAt: { type: Date, default: () => new Date() },
    resolvedAt: { type: Date, default: null },
    status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open', index: true },
    cadence: { type: String, enum: ['none', 'monthly', 'yearly'], default: 'none' },
    nextDueDate: { type: String, default: '' },
  },
  { timestamps: true },
);

export const MaintenanceLog = model('MaintenanceLog', maintenanceSchema);

/** 6. Waste/scrap disposal register (Haritha Karma Sena default). */
const wasteSchema = new Schema(
  {
    type: { type: String, enum: ['scrap', 'paper', 'rejected'], required: true },
    qty: { type: Number, required: true },
    unit: { type: String, default: 'kg' },
    handler: { type: String, default: 'Haritha Karma Sena' },
    proofUrl: { type: String, default: '' },
    note: { type: String, default: '' },
    at: { type: Date, default: () => new Date() },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const WasteLog = model('WasteLog', wasteSchema);

/** 7. Petty cash register — delegation-limited with a splitting detector. */
const pettyCashSchema = new Schema(
  {
    date: { type: String, required: true, index: true },
    purpose: { type: String, required: true },
    costCentre: { type: String, default: '' },
    requester: { type: String, default: '' },
    receiptNo: { type: String, default: '' },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'flagged', 'reconciled'], default: 'pending', index: true },
    splittingSuspect: { type: Boolean, default: false },
    reconciliation: {
      type: new Schema(
        {
          reconciledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          reconciledAt: { type: Date, default: null },
          note: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: null,
    },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const PettyCashEntry = model('PettyCashEntry', pettyCashSchema);

/** 8. Vendor deliveries tracker (PO-linked promised-date watch). */
const vendorTrackerSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    poNumber: { type: String, default: '' },
    promisedDate: { type: Date, default: null },
    pendingDocuments: { type: [String], default: [] },
    status: { type: String, enum: ['pending', 'received', 'late', 'disputed'], default: 'pending' },
    complaintId: { type: Schema.Types.ObjectId, ref: 'OfficeComplaint', default: null },
    overdueEscalated: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

export const VendorDeliveryTracker = model('VendorDeliveryTracker', vendorTrackerSchema);

/** 9a. Approved documents master — never hard-deleted, status-only changes. */
const documentsMasterSchema = new Schema(
  {
    docNo: { type: String, required: true, unique: true },
    fileName: { type: String, required: true },
    docType: { type: String, enum: ['gst_sale', 'gst_purchase', 'other'], default: 'other' },
    revision: { type: Number, default: 1 },
    date: { type: String, default: '' },
    accessRoles: { type: [String], default: [] },
    retentionUpto: { type: String, default: '' },
    status: { type: String, enum: ['current', 'obsolete', 'retired'], default: 'current', index: true },
  },
  { timestamps: true },
);

export const DocumentsMaster = model('DocumentsMaster', documentsMasterSchema);

/** 9b. Per-revision acknowledgements (SOP ADM-SOP-1 lives here). */
const documentAckSchema = new Schema(
  {
    docId: { type: Schema.Types.ObjectId, ref: 'DocumentsMaster', required: true, index: true },
    revision: { type: Number, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

documentAckSchema.index({ docId: 1, revision: 1, user: 1 }, { unique: true });

export const DocumentAcknowledgement = model('DocumentAcknowledgement', documentAckSchema);

/** Restricted attendance inputs (today's register view). */
const attendanceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent', 'leave', 'half_day'], required: true },
    inTime: { type: String, default: '' },
    outTime: { type: String, default: '' },
    notes: { type: String, default: '' },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export const AttendanceInput = model('AttendanceInput', attendanceSchema);

/** Reminder rules (N24) — config for BullMQ repeatable jobs (M7). */
const reminderRuleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    kind: {
      type: String,
      enum: ['checklist_opening', 'checklist_closing', 'route_day', 'outstanding_followup', 'maintenance', 'sop_review'],
      required: true,
      index: true,
    },
    cron: { type: String, required: true },
    active: { type: Boolean, default: true },
    channel: { type: String, default: 'in_app' },
    title: { type: String, default: '' },
  },
  { timestamps: true },
);

export const ReminderRule = model('ReminderRule', reminderRuleSchema);
