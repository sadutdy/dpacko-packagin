import { z } from 'zod';

import { objectIdSchema } from '../auth/auth.schema.js';

export const CHECKLIST_KINDS = ['opening', 'closing'] as const;
export const TASK_PRIORITIES = ['low', 'normal', 'urgent'] as const;
export const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
export const TASK_KINDS = ['task', 'inbox', 'urgent_request', 'reminder'] as const;
export const APPOINTMENT_KINDS = ['visitor', 'meeting'] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/* ---------------------------- checklist ---------------------------- */

export const checklistTemplateCreateSchema = z.object({
  kind: z.enum(CHECKLIST_KINDS),
  labelEn: z.string().min(1).max(160),
  labelTa: z.string().max(160).optional(),
  labelMl: z.string().max(160).optional(),
  position: z.number().int().default(100),
  mandatory: z.boolean().default(true),
});

export const checklistTemplateUpdateSchema = z.object({
  labelEn: z.string().min(1).max(160).optional(),
  labelTa: z.string().max(160).optional(),
  labelMl: z.string().max(160).optional(),
  position: z.number().int().optional(),
  mandatory: z.boolean().optional(),
  /** Items are retired, not deleted (registers stay append-only). */
  active: z.boolean().optional(),
});

export const checklistDailySchema = z.object({
  kind: z.enum(CHECKLIST_KINDS),
  date: isoDate,
  items: z
    .array(
      z.object({
        itemId: objectIdSchema,
        done: z.boolean(),
        note: z.string().max(300).optional(),
      }),
    )
    .min(1),
});

export const checklistQuerySchema = z.object({
  kind: z.enum(CHECKLIST_KINDS),
  date: isoDate.optional(),
});

/* ------------------------------ tasks ------------------------------ */

export const taskCreateSchema = z.object({
  kind: z.enum(TASK_KINDS).default('task'),
  title: z.string().min(1).max(200),
  detail: z.string().max(2000).default(''),
  owner: objectIdSchema.nullish(),
  ownerRole: z.string().max(40).default(''),
  dueDate: z.coerce.date().nullish(),
  priority: z.enum(TASK_PRIORITIES).default('normal'),
});

export const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  detail: z.string().max(2000).optional(),
  owner: objectIdSchema.nullish(),
  ownerRole: z.string().max(40).optional(),
  dueDate: z.coerce.date().nullish(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

export const taskListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  /**
   * `mine` = owned by the caller. `inbox` = open shared items (no owner).
   * `urgent` = priority urgent and not done. `open` = anything not done/cancelled.
   */
  view: z.enum(['mine', 'inbox', 'urgent', 'open']).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  kind: z.enum(TASK_KINDS).optional(),
  date: isoDate.optional(),
});

/* --------------------------- appointments --------------------------- */

export const appointmentCreateSchema = z.object({
  kind: z.enum(APPOINTMENT_KINDS),
  personName: z.string().min(1).max(160),
  organization: z.string().max(160).default(''),
  contact: z.string().max(60).default(''),
  host: objectIdSchema.optional(),
  purpose: z.string().max(400).default(''),
  date: isoDate,
  scheduledAt: z.coerce.date().optional(),
  idType: z.string().max(60).default(''),
  idNumber: z.string().max(60).default(''),
  restrictedArea: z.boolean().default(false),
  notes: z.string().max(1000).default(''),
  /**true = checking in now (server stamps timeIn). */
  checkIn: z.boolean().default(false),
});

export const appointmentUpdateSchema = z.object({
  organization: z.string().max(160).optional(),
  contact: z.string().max(60).optional(),
  host: objectIdSchema.nullish(),
  purpose: z.string().max(400).optional(),
  scheduledAt: z.coerce.date().nullish(),
  timeIn: z.coerce.date().nullish(),
  /** Setting `timeOut` is the check-out action (guarded once set). */
  timeOut: z.coerce.date().nullish(),
  idType: z.string().max(60).optional(),
  idNumber: z.string().max(60).optional(),
  restrictedArea: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

export const appointmentListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  kind: z.enum(APPOINTMENT_KINDS).optional(),
  date: isoDate.optional(),
  view: z.enum(['today', 'upcoming']).optional(),
});

/* ----------------------------- summary ----------------------------- */

export const summaryQuerySchema = z.object({ date: isoDate.optional() });

/* ------------------------- sales order desk (M2) ------------------------- */

const deskStepEnum = z.enum([
  'checked',
  'confirmed',
  'packing_notified',
  'accounts_notified',
  'bill_prepared',
  'bill_ready',
  'printed',
  'extra_qty_recorded',
  'dispatch_docs_checked',
  'delivery_confirmed',
  'extra_qty_sold_check',
  'collections_updated',
]);

export const deskStepCreateSchema = z.object({
  step: deskStepEnum,
  note: z.string().max(1000).optional(),
});

export const printBillSchema = z.object({
  copies: z.coerce.number().int().min(1).max(5).default(2),
  note: z.string().max(500).optional(),
});

export const deskListSchema = z.object({
  date: isoDate.optional(),
  pending: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const deskSummarySchema = z.object({ date: isoDate.optional() });

export const channelUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  templateId: z.string().max(120).optional(),
});

export const notificationLogQuerySchema = z.object({
  event: z.string().max(80).optional(),
  orderId: objectIdSchema.optional(),
  group: z.enum(['packing', 'accounts', 'sales', 'office']).optional(),
  channel: z.enum(['in_app', 'whatsapp', 'sms']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/* -------------------- follow-ups & routes (M3) -------------------- */

export const ROUTE_KINDS = ['retail', 'wholesale'] as const;
export const CALL_CHANNELS = ['call', 'whatsapp', 'voice', 'visit'] as const;

export const routeCreateSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  area: z.string().min(1).max(120),
  kind: z.enum(ROUTE_KINDS).default('retail'),
  customers: z.array(objectIdSchema).max(200).default([]),
  active: z.boolean().default(true),
});

export const routeUpdateSchema = z.object({
  area: z.string().min(1).max(120).optional(),
  kind: z.enum(ROUTE_KINDS).optional(),
  customers: z.array(objectIdSchema).max(200).optional(),
  active: z.boolean().optional(),
});

export const routeListSchema = z.object({
  kind: z.enum(ROUTE_KINDS).optional(),
  includeInactive: z.boolean().optional(),
});

export const callLogCreateSchema = z.object({
  customerId: objectIdSchema,
  date: isoDate.optional(),
  channel: z.enum(CALL_CHANNELS).default('call'),
  outcome: z.string().min(1).max(600),
  nextAction: z.string().max(600).optional(),
  nextActionDate: isoDate.optional(),
});

export const callLogListSchema = z.object({
  customerId: objectIdSchema.optional(),
  date: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

/* ------------------------ outstanding (M4) ------------------------ */

export const outstandingViewSchema = z.object({
  view: z.enum(['daily', 'overdue', 'small']).default('daily'),
});

export const followupCreateSchema = z.object({
  promiseDate: isoDate,
  outcome: z.string().min(1).max(600),
});

export const smallEntryCreateSchema = z.object({
  customerId: objectIdSchema,
  amountPaise: z.number().int().positive().max(50_000_00),
  reason: z.string().max(400).optional(),
});

export const applyToOrderSchema = z.object({
  orderId: objectIdSchema,
});

export const dailyCashQuerySchema = z.object({
  date: isoDate.optional(),
});

export const dailyCashCreateSchema = z.object({
  date: isoDate.optional(),
  invoiceId: objectIdSchema.optional(),
  orderId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  collectedPaise: z.number().int().min(0).default(0),
  expensesPaise: z.number().int().min(0).default(0),
  outstandingPaise: z.number().int().min(0).default(0),
  notes: z.string().max(600).optional(),
});

/* --------------- dispatch, complaints & stock alerts (M5) --------------- */

export const complaintCreateSchema = z.object({
  customerId: objectIdSchema,
  orderId: objectIdSchema.optional(),
  kind: z.enum(['product', 'service', 'other']).default('product'),
  title: z.string().max(200).optional(),
  detail: z.string().min(1).max(2000),
  guidance: z.string().max(1000).optional(),
});

export const complaintUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  title: z.string().max(200).optional(),
  kind: z.enum(['product', 'service', 'other']).optional(),
  guidance: z.string().max(1000).optional(),
  resolution: z.string().max(2000).optional(),
  closureDate: isoDate.optional(),
});

export const complaintListSchema = z.object({
  customerId: objectIdSchema.optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const dispatchBoardSchema = z.object({ date: isoDate.optional() });

export const stockAckSchema = z.object({
  note: z.string().max(400).optional(),
});

/* --------------------------- registers (M6) --------------------------- */

const directionEnum = ['sent', 'received'] as const;
const indentStatuses = ['draft', 'submitted', 'approved', 'committed', 'rejected'] as const;
const CADENCES = ['none', 'monthly', 'yearly'] as const;
const WASTE_TYPES = ['scrap', 'paper', 'rejected'] as const;
const ATTENDANCE_STATUSES = ['present', 'absent', 'leave', 'half_day'] as const;
const DEVIATION_KINDS = ['missed_deadline', 'unauthorized', 'discrepancy', 'incident', 'near_miss', 'suspected_fraud', 'data_breach'] as const;
const DOC_TYPES = ['gst_sale', 'gst_purchase', 'other'] as const;
const DOC_STATUSES = ['current', 'obsolete', 'retired'] as const;

export const courierCreateSchema = z.object({
  refNo: z.string().max(80).optional(),
  company: z.string().max(120).optional(),
  docketNo: z.string().min(1).max(120),
  direction: z.enum(directionEnum).default('sent'),
  routeTo: z.string().max(200).optional(),
  toName: z.string().max(120).optional(),
  customerId: objectIdSchema.optional(),
  podRef: z.string().max(120).optional(),
  podUrl: z.string().max(400).optional(),
  receivedBy: z.string().max(120).optional(),
  notes: z.string().max(600).optional(),
});

export const courierUpdateSchema = z.object({
  podRef: z.string().max(120).optional(),
  podUrl: z.string().max(400).optional(),
  receivedBy: z.string().max(120).optional(),
  receivedAt: z.coerce.date().nullish(),
  notes: z.string().max(600).optional(),
  routeTo: z.string().max(200).optional(),
});

export const stationeryItemCreateSchema = z.object({
  name: z.string().min(1).max(160),
  unit: z.string().max(30).default('pcs'),
  qty: z.coerce.number().int().min(0).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  avgCostPaise: z.number().int().min(0).default(0),
});

export const stationeryMoveCreateSchema = z.object({
  itemId: objectIdSchema,
  direction: z.enum(['in', 'out', 'reorder']),
  qty: z.number().int().positive(),
  note: z.string().max(400).optional(),
});

export const indentCreateSchema = z.object({
  title: z.string().min(1).max(200),
  itemDetail: z.string().max(600).optional(),
  qty: z.coerce.number().int().min(0).default(0),
  estimatedPaise: z.number().int().min(0).default(0),
  purpose: z.string().max(600).optional(),
  requiredDate: z.coerce.date().optional(),
});

export const indentPatchSchema = z.object({
  action: z.enum(['submit', 'approve', 'commit', 'reject']),
  note: z.string().max(600).optional(),
});

export const maintenanceCreateSchema = z.object({
  location: z.string().min(1).max(160),
  issue: z.string().min(1).max(600),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  assignedTeam: z.string().max(160).optional(),
  cadence: z.enum(CADENCES).default('none'),
  nextDueDate: isoDate.optional(),
});

export const maintenanceUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignedTeam: z.string().max(160).optional(),
  cadence: z.enum(CADENCES).optional(),
  nextDueDate: isoDate.optional(),
  resolvedAt: z.coerce.date().nullish(),
});

export const wasteCreateSchema = z.object({
  type: z.enum(WASTE_TYPES),
  qty: z.number().positive(),
  unit: z.string().max(30).default('kg'),
  handler: z.string().max(160).optional(),
  proofUrl: z.string().max(400).optional(),
  note: z.string().max(600).optional(),
});

export const pettyCashCreateSchema = z.object({
  date: isoDate.optional(),
  purpose: z.string().min(1).max(400),
  costCentre: z.string().max(120).optional(),
  requester: z.string().max(120).optional(),
  receiptNo: z.string().max(80).optional(),
  amountPaise: z.number().int().positive(),
  notes: z.string().max(600).optional(),
});

export const pettyCashUpdateSchema = z.object({
  status: z.enum(['pending', 'flagged', 'reconciled']).optional(),
  reconciliation: z
    .object({
      note: z.string().max(400).optional(),
    })
    .optional(),
});

export const vendorTrackerCreateSchema = z.object({
  vendorId: objectIdSchema,
  poNumber: z.string().max(80).optional(),
  promisedDate: z.coerce.date().optional(),
  pendingDocuments: z.array(z.string().max(120)).default([]),
  notes: z.string().max(600).optional(),
});

export const vendorTrackerUpdateSchema = z.object({
  status: z.enum(['pending', 'received', 'late', 'disputed']).optional(),
  promisedDate: z.coerce.date().nullish(),
  pendingDocuments: z.array(z.string().max(120)).optional(),
  overdueEscalated: z.boolean().optional(),
  notes: z.string().max(600).optional(),
  complaintId: objectIdSchema.nullish(),
});

export const documentCreateSchema = z.object({
  docNo: z.string().min(1).max(80),
  fileName: z.string().min(1).max(200),
  docType: z.enum(DOC_TYPES).default('other'),
  date: isoDate.optional(),
  accessRoles: z.array(z.string().max(60)).default([]),
  retentionUpto: isoDate.optional(),
});

export const documentUpdateSchema = z.object({
  status: z.enum(DOC_STATUSES).optional(),
  revision: z.coerce.number().int().min(1).optional(),
  retentionUpto: isoDate.optional(),
  accessRoles: z.array(z.string().max(60)).optional(),
});

export const sopAcknowledgeSchema = z.object({
  docId: objectIdSchema,
});

export const attendanceUpsertSchema = z.object({
  userId: objectIdSchema,
  date: isoDate.optional(),
  status: z.enum(ATTENDANCE_STATUSES),
  inTime: z.string().max(8).optional(),
  outTime: z.string().max(8).optional(),
  notes: z.string().max(400).optional(),
});

export const attendanceListSchema = z.object({
  date: isoDate.optional(),
  userId: objectIdSchema.optional(),
});

export const courierListSchema = z.object({
  direction: z.enum(directionEnum).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  format: z.enum(['json', 'csv']).optional(),
});

/** Shared list contract for plain register lists (page/limit + csv). */
export const registerListSchema = courierListSchema.strip();

export const indentListSchema = z.object({
  status: z.enum(indentStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  format: z.enum(['json', 'csv']).optional(),
});

export const maintenanceListSchema = registerListSchema;
export const wasteListSchema = registerListSchema;

export const pettyCashListSchema = z.object({
  status: z.enum(['pending', 'flagged', 'reconciled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  format: z.enum(['json', 'csv']).optional(),
});

export const vendorTrackerListSchema = registerListSchema;

export const documentListSchema = z.object({
  docType: z.enum(DOC_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  format: z.enum(['json', 'csv']).optional(),
});

export const deviationListSchema = z.object({
  openOnly: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
});

export const deviationCreateSchema = z.object({
  kind: z.enum(DEVIATION_KINDS),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  category: z.string().max(120).optional(),
  immediateEscalation: z.boolean().default(false),
  clientId: objectIdSchema.optional(),
  orderId: objectIdSchema.optional(),
  detail: z.string().min(1).max(1200),
  correctiveAction: z.string().max(1200).optional(),
});

export const deviationUpdateSchema = z.object({
  correctiveAction: z.string().max(1200).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  closed: z.boolean().optional(),
});

/* --------------------- M7 controls: reminders & matrix --------------------- */

export const reminderListSchema = z.object({});

export const reminderCreateSchema = z.object({
  key: z.string().min(1).max(80),
  kind: z.enum([
    'checklist_opening',
    'checklist_closing',
    'route_day',
    'outstanding_followup',
    'maintenance',
    'sop_review',
  ]),
  cron: z.string().min(3).max(60),
  active: z.coerce.boolean().default(true),
  channel: z.string().max(60).default('in_app'),
  title: z.string().max(200).optional(),
});

export const reminderUpdateSchema = z.object({
  active: z.coerce.boolean().optional(),
  cron: z.string().min(3).max(60).optional(),
  channel: z.string().max(60).optional(),
  title: z.string().max(200).optional(),
});

export const matrixUpsertSchema = z.object({
  role: z.string().min(1).max(60),
  action: z.string().min(1).max(60),
  limitPaise: z.number().int().min(0).nullish(),
  limitQty: z.number().int().min(0).nullish(),
  active: z.boolean().default(true),
});

/** Reminder rules are keyed by their rule key (not a mongo id). */
export const reminderKeyParamsSchema = z.object({
  id: z.string().min(1).max(80),
});
