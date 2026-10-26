import { Schema, model } from 'mongoose';

const stageHistorySchema = new Schema(
  {
    stage: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deviceId: { type: String, default: '' },
    offline: { type: Boolean, default: false },
  },
  { _id: false },
);

const jobItemSchema = new Schema(
  {
    skuId: { type: Schema.Types.ObjectId, ref: 'CatalogSku', required: true },
    skuCode: { type: String, default: '' },
    quantity: { type: Number, required: true },
    completedQty: { type: Number, default: 0 },
    wastedQty: { type: Number, default: 0 },
  },
  { _id: false },
);

const materialReservationSchema = new Schema(
  {
    materialId: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    quantity: { type: Number, required: true },
    consumedQty: { type: Number, default: 0 },
  },
  { _id: false },
);

const qcSchema = new Schema(
  {
    checklist: { type: Schema.Types.Mixed, default: [] },
    result: { type: String, enum: ['pass', 'fail', 'reject', null], default: null },
    checkedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    checkedAt: { type: Date, default: null },
    reworkCount: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { _id: false },
);

const labelSchema = new Schema(
  {
    qrPayload: { type: String, default: '' },
    barcodeValue: { type: String, default: '' },
    labelUrl: { type: String, default: '' },
    printedAt: { type: Date, default: null },
  },
  { _id: false },
);

const productionJobSchema = new Schema(
  {
    jobNumber: { type: String, required: true, unique: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, default: '' },
    items: { type: [jobItemSchema], default: [] },
    stage: {
      type: String,
      enum: [
        'queued',
        'received',
        'cutting',
        'creasing',
        'assembly',
        'printing',
        'qc',
        'rework',
        'labelling',
        'packing',
        'ready',
        'scrapped',
        'cancelled',
      ],
      default: 'queued',
      index: true,
    },
    stageHistory: { type: [stageHistorySchema], default: [] },
    priority: { type: Number, default: 100 },
    scheduledDate: { type: Date, default: null },
    machineId: { type: Schema.Types.ObjectId, ref: 'Machine', default: null },
    operatorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    materialReservations: { type: [materialReservationSchema], default: [] },
    qc: { type: qcSchema, default: () => ({}) },
    label: { type: labelSchema, default: () => ({}) },
    quantityCompleted: { type: Number, default: 0 },
    quantityScrapped: { type: Number, default: 0 },
    offlineCompleted: { type: Boolean, default: false },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

productionJobSchema.index({ stage: 1, scheduledDate: 1 });
productionJobSchema.index({ stage: 1, priority: 1 });

export const ProductionJob = model('ProductionJob', productionJobSchema);

const qcChecklistItemSchema = new Schema(
  {
    code: { type: String, required: true },
    label: { type: String, required: true },
    labelTa: { type: String, default: '' },
    type: { type: String, enum: ['pass_fail', 'numeric', 'text'], default: 'pass_fail' },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    unit: { type: String, default: '' },
    required: { type: Boolean, default: true },
  },
  { _id: false },
);

const qcChecklistSchema = new Schema(
  {
    name: { type: String, required: true },
    appliesTo: { type: String, enum: ['material', 'category', 'sku'], required: true },
    material: { type: String, default: '' },
    category: { type: String, default: '' },
    skuId: { type: Schema.Types.ObjectId, ref: 'CatalogSku', default: null },
    items: { type: [qcChecklistItemSchema], default: [] },
    isActive: { type: Boolean, default: true },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const QcChecklist = model('QcChecklist', qcChecklistSchema);

const shiftHoursSchema = new Schema(
  {
    name: { type: String, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
  { _id: false },
);

const machineSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['die_cutter', 'creaser', 'printer', 'laminator', 'assembler'],
      required: true,
    },
    capacityPerShift: { type: Number, default: 1000 },
    shiftHours: { type: [shiftHoursSchema], default: [] },
    activeJobs: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    maintenanceDueDate: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const Machine = model('Machine', machineSchema);

const shiftSchema = new Schema(
  {
    name: { type: String, required: true },
    startMinutes: { type: Number, required: true },
    endMinutes: { type: Number, required: true },
    isNight: { type: Boolean, default: false },
    days: { type: [Number], default: [] },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const Shift = model('Shift', shiftSchema);
