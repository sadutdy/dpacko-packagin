import { Schema, model } from 'mongoose';

const vendorSchema = new Schema(
  {
    vendorCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameTa: { type: String, default: '' },
    type: { type: String, enum: ['raw_material', 'print_partner', 'packaging_other'], default: 'raw_material' },
    gstin: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: Schema.Types.Mixed, default: {} },
    paymentTermsDays: { type: Number, default: 0 },
    rating: { type: Number, default: 3 },
    isActive: { type: Boolean, default: true },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const Vendor = model('Vendor', vendorSchema);

const purchaseOrderItemSchema = new Schema(
  {
    materialId: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    unitCostPaise: { type: Number, default: 0 },
    taxRate: { type: Number, default: 18 },
    receivedQty: { type: Number, default: 0 },
    lineTotalPaise: { type: Number, default: 0 },
  },
  { _id: false },
);

const purchaseOrderSchema = new Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    items: { type: [purchaseOrderItemSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'sent', 'partially_received', 'received', 'cancelled'],
      default: 'draft',
    },
    totalPaise: { type: Number, default: 0 },
    taxPaise: { type: Number, default: 0 },
    grandTotalPaise: { type: Number, default: 0 },
    expectedDeliveryDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    sentAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const PurchaseOrder = model('PurchaseOrder', purchaseOrderSchema);

const goodsReceiptItemSchema = new Schema(
  {
    materialId: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    orderedQty: { type: Number, default: 0 },
    receivedQty: { type: Number, required: true },
    rejectedQty: { type: Number, default: 0 },
    unitCostPaise: { type: Number, default: 0 },
    binLocation: { type: String, default: '' },
  },
  { _id: false },
);

const goodsReceiptSchema = new Schema(
  {
    grnNumber: { type: String, required: true, unique: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    items: { type: [goodsReceiptItemSchema], default: [] },
    invoiceNumber: { type: String, default: '' },
    invoiceDate: { type: Date, default: null },
    status: { type: String, enum: ['draft', 'posted', 'cancelled'], default: 'draft' },
    postedAt: { type: Date, default: null },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const GoodsReceipt = model('GoodsReceipt', goodsReceiptSchema);
