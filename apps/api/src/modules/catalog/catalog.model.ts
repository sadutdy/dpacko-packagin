import { Schema, model } from 'mongoose';

const dimensionsSchema = new Schema(
  {
    length: Number,
    width: Number,
    height: Number,
    unit: { type: String, enum: ['mm'], default: 'mm' },
  },
  { _id: false },
);

const printSchema = new Schema(
  {
    type: { type: String, enum: ['none', 'single', 'multi'], default: 'none' },
    sides: { type: Number, default: 0 },
    colors: { type: Number, default: 0 },
  },
  { _id: false },
);

const pricingSchema = new Schema(
  {
    basePricePaise: { type: Number, required: true },
    minQty: { type: Number, default: 250 },
    taxRate: { type: Number, default: 18 },
    hsnCode: { type: String, default: '4819' },
  },
  { _id: false },
);

const catalogSkuSchema = new Schema(
  {
    skuCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameTa: { type: String, default: '' },
    category: {
      type: String,
      enum: ['parcel_box', 'cake_box', 'burger_box', 'chicken_basket', 'tray', 'liner'],
      required: true,
      index: true,
    },
    material: {
      type: String,
      enum: ['kraft', 'corrugated_3ply', 'corrugated_2ply', 'whiteboard', 'paperboard', 'plastic'],
      required: true,
    },
    dimensions: { type: dimensionsSchema, default: () => ({ unit: 'mm' }) },
    flute: { type: String, enum: ['B', 'C', 'E', 'BC', null], default: null },
    gsm: { type: Number, default: null },
    print: { type: printSchema, default: () => ({ type: 'none', sides: 0, colors: 0 }) },
    pricing: { type: pricingSchema, required: true },
    leadTimeDays: { type: Number, default: 2 },
    isActive: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

catalogSkuSchema.index({ name: 'text' });

export const CatalogSku = model('CatalogSku', catalogSkuSchema);

const bomTemplateSchema = new Schema(
  {
    skuId: { type: Schema.Types.ObjectId, ref: 'CatalogSku', required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    quantityPerUnit: { type: Number, required: true },
    unit: { type: String, enum: ['sq_m', 'sheet', 'kg', 'ml', 'pcs', 'roll'], required: true },
    wastagePct: { type: Number, default: 3 },
    isPrimary: { type: Boolean, default: false },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const BomTemplate = model('BomTemplate', bomTemplateSchema);

export const SKU_CATEGORIES = [
  'parcel_box',
  'cake_box',
  'burger_box',
  'chicken_basket',
  'tray',
  'liner',
] as const;

export const MATERIALS = [
  'kraft',
  'corrugated_3ply',
  'corrugated_2ply',
  'whiteboard',
  'paperboard',
  'plastic',
] as const;
