import { Schema, model } from 'mongoose';

const priceTierSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    minOrderValuePaise: { type: Number, default: 0 },
    discountPct: { type: Number, default: 0 },
    appliesTo: { type: String, enum: ['segment', 'customer'], default: 'segment' },
    segment: { type: String, default: '' },
    priority: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const PriceTier = model('PriceTier', priceTierSchema);

const priceRuleSchema = new Schema(
  {
    name: { type: String, required: true },
    scope: { type: String, enum: ['sku', 'category', 'customer', 'segment'], required: true },
    skuId: { type: Schema.Types.ObjectId, ref: 'CatalogSku', default: null },
    category: { type: String, default: '' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    segment: { type: String, default: '' },
    ruleType: {
      type: String,
      enum: ['percentage', 'fixed_per_unit', 'fixed_per_order'],
      required: true,
    },
    value: { type: Number, required: true },
    minQty: { type: Number, default: null },
    maxQty: { type: Number, default: null },
    priority: { type: Number, default: 100 },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const PriceRule = model('PriceRule', priceRuleSchema);
