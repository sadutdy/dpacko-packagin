import type { FilterQuery, Types } from 'mongoose';

import {
  Appointment,
  CallLog,
  ChecklistItem,
  ChecklistSubmission,
  DailyCashClose,
  Deviation,
  OfficeComplaint,
  OfficeTask,
  OrderDeskStep,
  OutstandingFollowup,
  RouteSchedule,
  SmallOutstandingLedger,
} from './office.model.js';

interface BaseDoc {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  toObject(options?: Record<string, unknown>): Record<string, unknown>;
}

export interface ChecklistItemDoc extends BaseDoc {
  kind: string;
  labelEn: string;
  labelTa: string;
  labelMl: string;
  position: number;
  mandatory: boolean;
  active: boolean;
}

export interface SubmissionEntry {
  itemId: Types.ObjectId;
  done: boolean;
  note: string;
  at: Date;
}

export interface ChecklistSubmissionDoc extends BaseDoc {
  kind: string;
  date: string;
  items: { itemId: Types.ObjectId; done: boolean; note: string; at: Date }[];
  submittedBy: Types.ObjectId;
  submittedAt: Date;
  updatedAt: Date;
}

export interface OfficeTaskDoc extends BaseDoc {
  kind: string;
  title: string;
  detail: string;
  owner: Types.ObjectId | null;
  ownerRole: string;
  dueDate: Date | null;
  priority: string;
  status: string;
  assignedBy: Types.ObjectId | null;
  doneAt: Date | null;
}

export interface AppointmentDoc extends BaseDoc {
  kind: string;
  personName: string;
  organization: string;
  contact: string;
  host: Types.ObjectId | null;
  purpose: string;
  date: string;
  scheduledAt: Date | null;
  timeIn: Date | null;
  timeOut: Date | null;
  restrictedArea: boolean;
}

export interface DeskEventEntry {
  step: string;
  by: Types.ObjectId;
  note: string;
  at: Date | null;
}

export interface DeskDoc extends BaseDoc {
  orderId: Types.ObjectId;
  events: DeskEventEntry[];
}

export interface RouteScheduleDoc extends BaseDoc {
  weekday: number;
  area: string;
  kind: string;
  customers: Types.ObjectId[];
  active: boolean;
}

export interface CallLogDoc extends BaseDoc {
  customerId: Types.ObjectId;
  date: string;
  channel: string;
  outcome: string;
  nextAction: string;
  nextActionDate: string;
  by: Types.ObjectId;
}

export interface OutstandingFollowupDoc extends BaseDoc {
  customerId: Types.ObjectId;
  date: string;
  amountPaise: number;
  promiseDate: string;
  outcome: string;
  by: Types.ObjectId;
}

export interface SmallOutstandingDoc extends BaseDoc {
  customerId: Types.ObjectId;
  amountPaise: number;
  reason: string;
  createdOn: string;
  settled: boolean;
  settledOnOrderId: Types.ObjectId | null;
  settledOn: Date | null;
  createdBy: Types.ObjectId;
}

export interface DailyCashDoc extends BaseDoc {
  date: string;
  invoiceId: Types.ObjectId | null;
  orderId: Types.ObjectId | null;
  customerId: Types.ObjectId | null;
  collectedPaise: number;
  expensesPaise: number;
  outstandingPaise: number;
  notes: string;
  by: Types.ObjectId;
}

export interface DeviationDoc extends BaseDoc {
  kind: string;
  severity: string;
  category: string;
  immediateEscalation: boolean;
  owner: Types.ObjectId | null;
  customerId: Types.ObjectId | null;
  orderId: Types.ObjectId | null;
  detail: string;
  correctiveAction: string;
  openedBy: Types.ObjectId | null;
  closedAt: Date | null;
}

export interface ComplaintDoc extends BaseDoc {
  ticketNo: string;
  customerId: Types.ObjectId;
  orderId: Types.ObjectId | null;
  kind: string;
  title: string;
  detail: string;
  status: string;
  guidance: string;
  resolution: string;
  closureDate: string;
  openedBy: Types.ObjectId;
  closedBy: Types.ObjectId | null;
}

export interface CourierDoc extends BaseDoc {
  refNo: string;
  company: string;
  docketNo: string;
  direction: string;
  routeTo: string;
  toName: string;
  customerId: Types.ObjectId | null;
  podRef: string;
  podUrl: string;
  receivedBy: string;
  notes: string;
  by: Types.ObjectId;
}

export interface StationeryItemDoc extends BaseDoc {
  name: string;
  unit: string;
  qty: number;
  reorderLevel: number;
  avgCostPaise: number;
  active: boolean;
}

export interface IndentDoc extends BaseDoc {
  refNo: string;
  title: string;
  qty: number;
  estimatedPaise: number;
  status: string;
  requestedBy: Types.ObjectId;
  approvedBy: Types.ObjectId | null;
  decisionNote: string;
}

/** Mongoose is cast through `unknown` because generated doc types fight the
 *  plain interface shapes; services only rely on these fields. */
function asList<T>(docs: unknown[]): T[] {
  return docs as T[];
}

const POSITION_SORT = { position: 1 } as unknown as string;

async function createOne<T>(Model: { create(input: unknown[]): Promise<unknown[]> }, input: Record<string, unknown>): Promise<T> {
  const [doc] = await Model.create([input]);
  return doc as T;
}

export const officeRepository = {
  /* checklist templates */
  async createChecklistTemplate(input: Record<string, unknown>): Promise<ChecklistItemDoc> {
    return createOne<ChecklistItemDoc>(ChecklistItem, input);
  },
  async listChecklistTemplates(filter: FilterQuery<unknown>, sort: string | undefined = POSITION_SORT): Promise<ChecklistItemDoc[]> {
    return asList<ChecklistItemDoc>(await ChecklistItem.find(filter).sort(sort).exec());
  },
  async findChecklistTemplate(id: string): Promise<ChecklistItemDoc | null> {
    return (await ChecklistItem.findById(id).exec()) as unknown as ChecklistItemDoc | null;
  },
  async updateChecklistTemplate(id: string, patch: Record<string, unknown>): Promise<ChecklistItemDoc | null> {
    return (await ChecklistItem.findByIdAndUpdate(id, patch, { new: true }).exec()) as unknown as ChecklistItemDoc | null;
  },

  /* checklist submissions */
  async findSubmission(kind: string, date: string): Promise<ChecklistSubmissionDoc | null> {
    return (await ChecklistSubmission.findOne({ kind, date }).exec()) as unknown as ChecklistSubmissionDoc | null;
  },
  /** Merges answers into an existing submission doc (mongoose set + save). */
  async mergeSubmission(
    doc: ChecklistSubmissionDoc,
    patch: { items: unknown[]; submittedBy: Types.ObjectId; submittedAt: Date },
  ): Promise<ChecklistSubmissionDoc> {
    const mongooseDoc = doc as unknown as {
      set(path: string, value: unknown): void;
      items: unknown[];
      save(): Promise<unknown>;
    };
    mongooseDoc.set('updatedAt', new Date());
    mongooseDoc.set('submittedBy', patch.submittedBy);
    mongooseDoc.set('submittedAt', patch.submittedAt);
    mongooseDoc.set('items', patch.items);
    await mongooseDoc.save();
    return doc;
  },
  async createSubmission(input: Record<string, unknown>): Promise<ChecklistSubmissionDoc> {
    return createOne<ChecklistSubmissionDoc>(ChecklistSubmission, input);
  },

  /* tasks */
  async findTaskById(id: string): Promise<OfficeTaskDoc | null> {
    return (await OfficeTask.findById(id).exec()) as unknown as OfficeTaskDoc | null;
  },
  async createTask(input: Record<string, unknown>): Promise<OfficeTaskDoc> {
    return createOne<OfficeTaskDoc>(OfficeTask, input);
  },
  async updateTask(id: string, patch: Record<string, unknown>): Promise<OfficeTaskDoc | null> {
    return (await OfficeTask.findByIdAndUpdate(id, patch, { new: true }).exec()) as unknown as OfficeTaskDoc | null;
  },
  async listTasks(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string): Promise<OfficeTaskDoc[]> {
    const query = OfficeTask.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return asList<OfficeTaskDoc>(await query.exec());
  },
  countTasks(filter: FilterQuery<unknown>) {
    return OfficeTask.countDocuments(filter).exec();
  },

  /* appointments */
  async findAppointmentById(id: string): Promise<AppointmentDoc | null> {
    return (await Appointment.findById(id).exec()) as unknown as AppointmentDoc | null;
  },
  async createAppointment(input: Record<string, unknown>): Promise<AppointmentDoc> {
    return createOne<AppointmentDoc>(Appointment, input);
  },
  async updateAppointment(id: string, patch: Record<string, unknown>): Promise<AppointmentDoc | null> {
    return (await Appointment.findByIdAndUpdate(id, patch, { new: true }).exec()) as unknown as AppointmentDoc | null;
  },
  async listAppointments(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string): Promise<AppointmentDoc[]> {
    const query = Appointment.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return asList<AppointmentDoc>(await query.exec());
  },
  countAppointments(filter: FilterQuery<unknown>) {
    return Appointment.countDocuments(filter).exec();
  },
  async listAppointmentsByDate(date: string): Promise<AppointmentDoc[]> {
    return asList<AppointmentDoc>(await Appointment.find({ date }).sort({ scheduledAt: 1 }).exec());
  },

  /* sales order desk (M2) */
  async findDeskDoc(orderId: string): Promise<DeskDoc | null> {
    return (await OrderDeskStep.findOne({ orderId }).exec()) as unknown as DeskDoc | null;
  },

  /** Upserts the desk doc and appends the step event. */
  async appendDeskEvent(orderId: Types.ObjectId, event: { step: string; by: Types.ObjectId; note?: string }): Promise<DeskDoc> {
    return (await OrderDeskStep.findOneAndUpdate(
      { orderId },
      {
        $push: {
          events: {
            step: event.step,
            by: event.by,
            note: event.note ?? '',
            at: new Date(),
          },
        },
        $setOnInsert: { orderId },
      },
      { new: true, upsert: true },
    ).exec()) as unknown as DeskDoc;
  },

  async listDeskDocs(): Promise<DeskDoc[]> {
    return asList<DeskDoc>(await OrderDeskStep.find({}).sort({ updatedAt: -1 }).exec());
  },

  /* follow-ups & routes (M3) */
  async createRoute(input: Record<string, unknown>): Promise<RouteScheduleDoc> {
    return createOne<RouteScheduleDoc>(RouteSchedule, input);
  },
  async listRoutes(filter: FilterQuery<unknown>, sort: string | undefined = 'weekday'): Promise<RouteScheduleDoc[]> {
    return asList<RouteScheduleDoc>(await RouteSchedule.find(filter).sort(sort).exec());
  },
  async findRouteById(id: string): Promise<RouteScheduleDoc | null> {
    return (await RouteSchedule.findById(id).exec()) as unknown as RouteScheduleDoc | null;
  },
  async updateRoute(id: string, patch: Record<string, unknown>): Promise<RouteScheduleDoc | null> {
    return (await RouteSchedule.findByIdAndUpdate(id, patch, { new: true }).exec()) as unknown as RouteScheduleDoc | null;
  },

  async createCallLog(input: Record<string, unknown>): Promise<CallLogDoc> {
    return createOne<CallLogDoc>(CallLog, input);
  },
  async listCallLogs(filter: FilterQuery<unknown>, skip: number, limit: number): Promise<CallLogDoc[]> {
    return asList<CallLogDoc>(await CallLog.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).exec());
  },
  countCallLogs(filter: FilterQuery<unknown>) {
    return CallLog.countDocuments(filter).exec();
  },

  /* outstanding (M4) */
  async createFollowup(input: Record<string, unknown>): Promise<OutstandingFollowupDoc> {
    return createOne<OutstandingFollowupDoc>(OutstandingFollowup, input);
  },
  /** Latest follow-up per customer (fetches recent rows and reduces). */
  async listRecentFollowups(customerIds: readonly Types.ObjectId[], perCustomer = 1): Promise<OutstandingFollowupDoc[]> {
    if (customerIds.length === 0) return [];
    const rows = await OutstandingFollowup.find({ customerId: { $in: [...customerIds] } })
      .sort({ date: -1, createdAt: -1 })
      .exec();
    const seen = new Map<string, number>();
    const picked: OutstandingFollowupDoc[] = [];
    for (const row of rows) {
      const key = String(row.customerId);
      const count = seen.get(key) ?? 0;
      if (count >= perCustomer) continue;
      seen.set(key, count + 1);
      picked.push(row as unknown as OutstandingFollowupDoc);
    }
    return picked;
  },
  async createSmallEntry(input: Record<string, unknown>): Promise<SmallOutstandingDoc> {
    return createOne<SmallOutstandingDoc>(SmallOutstandingLedger, input);
  },
  async listSmallEntries(filter: FilterQuery<unknown>): Promise<SmallOutstandingDoc[]> {
    return asList<SmallOutstandingDoc>(await SmallOutstandingLedger.find(filter).sort({ createdAt: -1 }).exec());
  },
  async settleSmallEntry(id: string, orderId: Types.ObjectId): Promise<SmallOutstandingDoc | null> {
    return (await SmallOutstandingLedger.findByIdAndUpdate(
      id,
      { $set: { settled: true, settledOnOrderId: orderId, settledOn: new Date() } },
      { new: true },
    ).exec()) as unknown as SmallOutstandingDoc | null;
  },

  async createDailyCash(input: Record<string, unknown>): Promise<DailyCashDoc> {
    return createOne<DailyCashDoc>(DailyCashClose, input);
  },
  async listDailyCash(filter: FilterQuery<unknown>): Promise<DailyCashDoc[]> {
    return asList<DailyCashDoc>(await DailyCashClose.find(filter).sort({ createdAt: 1 }).exec());
  },
  countOpenDeviations(customerId: Types.ObjectId, kind: string) {
    return Deviation.countDocuments({ customerId, kind, closedAt: null }).exec();
  },
  async createDeviation(input: Record<string, unknown>): Promise<DeviationDoc> {
    return createOne<DeviationDoc>(Deviation, input);
  },
  async listDeviations(filter: FilterQuery<unknown>, limit = 100): Promise<DeviationDoc[]> {
    return asList<DeviationDoc>(await Deviation.find(filter).sort({ createdAt: -1 }).limit(limit).exec());
  },
  closeDeviation(id: string, patch: Record<string, unknown>) {
    return Deviation.findByIdAndUpdate(id, patch, { new: true }).exec() as Promise<unknown>;
  },

  /* complaints (M5) */
  async findComplaintById(id: string): Promise<ComplaintDoc | null> {
    return (await OfficeComplaint.findById(id).exec()) as unknown as ComplaintDoc | null;
  },
  async listComplaints(filter: FilterQuery<unknown>, skip: number, limit: number): Promise<ComplaintDoc[]> {
    return asList<ComplaintDoc>(
      await OfficeComplaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
    );
  },
  countComplaints(filter: FilterQuery<unknown>) {
    return OfficeComplaint.countDocuments(filter).exec();
  },
  async createComplaint(input: Record<string, unknown>): Promise<ComplaintDoc> {
    return createOne<ComplaintDoc>(OfficeComplaint, input);
  },
  updateComplaint(id: string, patch: Record<string, unknown>) {
    return OfficeComplaint.findByIdAndUpdate(id, patch, { new: true }).exec() as Promise<unknown>;
  },

  /** Dispatch desk (M5): deliveries for a set of orders. */
  async listDeliveriesForOrders(orderIds: readonly Types.ObjectId[]) {
    const { Delivery } = await import('../delivery/delivery.model.js');
    const docs = await Delivery.find({ orderId: { $in: [...orderIds] } }).exec();
    return asList<Record<string, unknown>>(docs.map((doc) => doc.toObject({ versionKey: false })));
  },
  async listDeliveriesOnDate(start: Date, end: Date) {
    const { Delivery } = await import('../delivery/delivery.model.js');
    const docs = await Delivery.find({ plannedAt: { $gte: start, $lte: end } }).exec();
    return asList<Record<string, unknown>>(docs.map((doc) => doc.toObject({ versionKey: false })));
  },

  /** Stock alerts (M5): materials below reorder point with ack state. */
  async listLowStockMaterials(): Promise<{
    materialId: string;
    materialCode: string;
    name: string;
    unit: string;
    onHand: number;
    reorderPoint: number;
    reorderQuantity: number;
    ack: { by: string; at: string; note: string } | null;
  }[]> {
    const materialRepo = await import('../inventory/inventory.repository.js');
    const materials = await materialRepo.materialRepository.list({}, 0, 1000);
    const stock = await materialRepo.stockRepository.list({});
    const byMaterial = new Map(stock.map((entry) => [String(entry.materialId), entry]));
    return materials
      .filter((material) => material.isActive)
      .map((material) => {
        const entry = byMaterial.get(String(material._id));
        const onHand = entry?.onHand ?? 0;
        const reorderPoint = material.reorderPoint ?? 0;
        const ack = material.minQtyAlertAck ?? null;
        return {
          materialId: String(material._id),
          materialCode: material.materialCode,
          name: material.name,
          unit: material.unit,
          onHand,
          reorderPoint,
          reorderQuantity: material.reorderQuantity ?? 0,
          isLow: onHand <= reorderPoint,
          ack: ack ? { by: ack.by ? String(ack.by) : '', at: ack.at ? ack.at.toISOString() : '', note: ack.note } : null,
        };
      })
      .filter((row) => row.isLow)
      .map(({ isLow: _isLow, ...row }) => row);
  },
  /** OFF-5: who acknowledged the low-stock alert (cleared on restock). */
  async ackLowStock(materialId: string, userId: Types.ObjectId, note: string) {
    const { materialRepository } = await import('../inventory/inventory.repository.js');
    return materialRepository.update(materialId, {
      minQtyAlertAck: { by: userId, at: new Date(), note },
    });
  },

  /* registers 1–9 (M6) — loose wrappers over mongoose models, cast on exit */
  async createRegister<T>(Model: { create(input: unknown[]): Promise<unknown[]> }, input: Record<string, unknown>): Promise<T> {
    return createOne<T>(Model, input);
  },
  async findRegisterById<T>(Model: { findById(id: string): { exec(): Promise<unknown> } }, id: string): Promise<T | null> {
    return (await Model.findById(id).exec()) as unknown as T | null;
  },
  async listRegister<T>(
    Model: {
      find(filter: unknown): {
        sort(sort: unknown): {
          skip(skip: number): { limit(limit: number): { exec(): Promise<unknown[]> } };
        };
      };
    },
    filter: FilterQuery<unknown>,
    skip: number,
    limit: number,
    sort: unknown,
  ): Promise<T[]> {
    const docs = await Model.find(filter).sort(sort).skip(skip).limit(limit).exec();
    return asList<T>(docs);
  },
  countRegister(Model: { countDocuments(filter: unknown): Promise<number> }, filter: FilterQuery<unknown>): Promise<number> {
    return Model.countDocuments(filter);
  },
  async updateRegister<T>(
    Model: {
      findByIdAndUpdate(id: string, update: unknown, options: { new: boolean }): { exec(): Promise<unknown> };
    },
    id: string,
    patch: Record<string, unknown>,
  ): Promise<T | null> {
    return (await Model.findByIdAndUpdate(id, patch, { new: true }).exec()) as unknown as T | null;
  },
  async listRegisterAll<T>(
    Model: {
      find(filter: unknown): { sort(sort: unknown): { exec(): Promise<unknown[]> } };
    },
    filter: FilterQuery<unknown>,
    sort: unknown,
  ): Promise<T[]> {
    return asList<T>(await Model.find(filter).sort(sort).exec());
  },
};
