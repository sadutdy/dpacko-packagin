import { type Types } from 'mongoose';
import type { FilterQuery, HydratedDocument } from 'mongoose';

import { Machine, ProductionJob, QcChecklist, Shift } from './production.model.js';

export type ProductionJobDoc = HydratedDocument<
  {
    jobNumber: string;
    orderId: Types.ObjectId;
    orderNumber: string;
    items: Types.DocumentArray<{
      skuId: Types.ObjectId;
      skuCode: string;
      quantity: number;
      completedQty: number;
      wastedQty: number;
    }>;
    stage: string;
    stageHistory: Types.DocumentArray<{
      stage: string;
      at: Date;
      by?: Types.ObjectId | null;
      deviceId: string;
      offline: boolean;
    }>;
    priority: number;
    scheduledDate?: Date | null;
    machineId?: Types.ObjectId | null;
    operatorId?: Types.ObjectId | null;
    materialReservations: Types.DocumentArray<{
      materialId: Types.ObjectId;
      quantity: number;
      consumedQty: number;
    }>;
    qc: {
      checklist: unknown[];
      result?: string | null;
      checkedBy?: Types.ObjectId | null;
      checkedAt?: Date | null;
      reworkCount: number;
      notes: string;
    };
    label: {
      qrPayload: string;
      barcodeValue: string;
      labelUrl: string;
      printedAt?: Date | null;
    };
    quantityCompleted: number;
    quantityScrapped: number;
    offlineCompleted: boolean;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type MachineDoc = HydratedDocument<
  {
    code: string;
    name: string;
    type: string;
    capacityPerShift: number;
    shiftHours: Types.DocumentArray<{ name: string; start: number; end: number }>;
    activeJobs: number;
    isActive: boolean;
    maintenanceDueDate?: Date | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type QcChecklistDoc = HydratedDocument<
  {
    name: string;
    appliesTo: string;
    material: string;
    category: string;
    skuId?: Types.ObjectId | null;
    items: Types.DocumentArray<{
      code: string;
      label: string;
      labelTa: string;
      type: string;
      min?: number | null;
      max?: number | null;
      unit: string;
      required: boolean;
    }>;
    isActive: boolean;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type ShiftDoc = HydratedDocument<
  {
    name: string;
    startMinutes: number;
    endMinutes: number;
    isNight: boolean;
    days: number[];
  },
  { createdAt: Date; updatedAt: Date }
>;

export const productionRepository = {
  async createJob(input: Record<string, unknown>): Promise<ProductionJobDoc> {
    const [doc] = await ProductionJob.create([input]);
    return doc as ProductionJobDoc;
  },

  insertionMany(docs: Record<string, unknown>[]) {
    return ProductionJob.insertMany(docs) as unknown as Promise<ProductionJobDoc[]>;
  },

  findJobById(id: string) {
    return ProductionJob.findById(id).exec() as Promise<ProductionJobDoc | null>;
  },

  listJobs(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = ProductionJob.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ priority: 1, scheduledDate: 1 });
    return query.exec() as Promise<ProductionJobDoc[]>;
  },

  countJobs(filter: FilterQuery<unknown>) {
    return ProductionJob.countDocuments(filter).exec();
  },

  updateJob(id: string, update: Record<string, unknown>) {
    return ProductionJob.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<ProductionJobDoc | null>;
  },

  stageCounts() {
    return ProductionJob.aggregate([
      { $group: { _id: '$stage', count: { $sum: 1 } } },
      { $project: { _id: 0, stage: '$_id', count: 1 } },
    ]).exec();
  },

  listMachines() {
    return Machine.find({ isActive: true }).sort({ code: 1 }).exec() as Promise<MachineDoc[]>;
  },

  findMachineByCode(code: string) {
    return Machine.findOne({ code }).exec() as Promise<MachineDoc | null>;
  },

  createMachine(input: Record<string, unknown>) {
    return Machine.create(input) as Promise<MachineDoc>;
  },

  updateMachine(id: string, input: Record<string, unknown>) {
    return Machine.findByIdAndUpdate(id, input, { new: true }).exec() as Promise<MachineDoc | null>;
  },

  listChecklists() {
    return QcChecklist.find({ isActive: true }).sort({ name: 1 }).exec() as Promise<QcChecklistDoc[]>;
  },

  createChecklist(input: Record<string, unknown>) {
    return QcChecklist.create(input) as Promise<QcChecklistDoc>;
  },

  updateChecklist(id: string, input: Record<string, unknown>) {
    return QcChecklist.findByIdAndUpdate(id, input, { new: true }).exec() as Promise<QcChecklistDoc | null>;
  },

  listShifts() {
    return Shift.find({}).sort({ startMinutes: 1 }).exec() as Promise<ShiftDoc[]>;
  },

  createShift(input: Record<string, unknown>) {
    return Shift.create(input) as Promise<ShiftDoc>;
  },
};
