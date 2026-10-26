import { Schema, model } from 'mongoose';

const materialSchema = new Schema(
  {
    materialCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameTa: { type: String, default: '' },
    category: {
      type: String,
      enum: ['kraft_paper', 'corrugated_sheet', 'ink', 'glue', 'thread', 'tape', 'label_stock'],
      required: true,
    },
    unit: { type: String, enum: ['sq_m', 'sheet', 'kg', 'ml', 'roll', 'pcs'], required: true },
    packSize: { type: Number, default: 1 },
    unitCostPaise: { type: Number, default: 0 },
    taxRate: { type: Number, default: 18 },
    hsnCode: { type: String, default: '4802' },
    reorderPoint: { type: Number, default: 0 },
    reorderQuantity: { type: Number, default: 0 },
    leadTimeDays: { type: Number, default: 3 },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', default: null },
    storageLocation: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    /* E4: who acknowledged the low-stock alert; cleared once restocked. */
    minQtyAlertAck: {
      type: new Schema(
        {
          by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          at: { type: Date, default: null },
          note: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: null,
    },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const Material = model('Material', materialSchema);

const inventoryStockSchema = new Schema(
  {
    materialId: { type: Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    location: { type: String, default: 'STORE-1' },
    onHand: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    averageCostPaise: { type: Number, default: 0 },
    lastMovementAt: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

inventoryStockSchema.index({ materialId: 1, location: 1 }, { unique: true });

export const InventoryStock = model('InventoryStock', inventoryStockSchema);

const inventoryMovementSchema = new Schema(
  {
    materialId: { type: Schema.ObjectId, ref: 'Material', required: true, index: true },
    type: {
      type: String,
      enum: ['receipt', 'consumption', 'reservation', 'release', 'adjustment', 'wastage', 'return'],
      required: true,
    },
    quantity: { type: Number, required: true },
    unitCostPaise: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
    referenceType: {
      type: String,
      enum: ['purchase_order', 'production_job', 'manual', 'delivery'],
      default: 'manual',
    },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    location: { type: String, default: 'STORE-1' },
    note: { type: String, default: '' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    occurredAt: { type: Date, default: Date.now },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

inventoryMovementSchema.index({ materialId: 1, occurredAt: 1 });
inventoryMovementSchema.index({ referenceType: 1, referenceId: 1 });

export const InventoryMovement = model('InventoryMovement', inventoryMovementSchema);

export const MOVEMENT_TYPES = [
  'receipt',
  'consumption',
  'reservation',
  'release',
  'adjustment',
  'wastage',
  'return',
] as const;
