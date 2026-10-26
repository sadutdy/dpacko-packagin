import { Schema, model } from 'mongoose';

// A GeoJSON point. Kept as an explicit subdocument schema: declaring `geo`
// inline with a nested `type` key triggers Mongoose's type-key ambiguity and
// materialises `geo: { coordinates: [] }`, which the 2dsphere index rejects.
const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] },
  },
  { _id: false },
);

const addressSchema = new Schema(
  {
    label: { type: String, default: '' },
    contactName: { type: String, default: '' },
    phone: { type: String, default: '' },
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    area: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: 'TN' },
    pincode: { type: String, default: '' },
    // No leaf defaults here: they would materialise `geo: { type:'Point',
    // coordinates: [] }` on fresh addresses, which the 2dsphere index rejects.
    // The geo field is only persisted when valid coordinates are supplied.
    geo: { type: geoPointSchema },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false },
);

/** OFF-3: front-desk notes shown on the order-entry screen. */
const deskNotesSchema = new Schema(
  {
    preferredLanguage: { type: String, enum: ['en', 'ta', 'ml', ''], default: 'en' },
    boxSizeHabits: { type: [String], default: [] },
    otherReplies: { type: String, default: '' },
    followUpPrefs: { type: String, default: '' },
  },
  { _id: false },
);

const customerSchema = new Schema(
  {
    customerCode: { type: String, required: true, unique: true },
    businessName: { type: String, required: true },
    businessNameTa: { type: String, default: '' },
    contactName: { type: String, default: '' },
    contactNameTa: { type: String, default: '' },
    phone: { type: String, required: true, index: true },
    email: { type: String, default: '' },
    gstin: { type: String, unique: true, sparse: true },
    pan: { type: String, default: '' },
    segment: {
      type: String,
      enum: ['walk_in', 'small', 'mid', 'large', 'enterprise'],
      default: 'small',
      index: true,
    },
    priceTier: { type: String, default: 'standard' },
    creditLimit: { type: Number, default: 0 },
    creditUsed: { type: Number, default: 0 },
    paymentTermsDays: { type: Number, default: 0 },
    addresses: { type: [addressSchema], default: [] },
    deskNotes: { type: deskNotesSchema, default: () => ({}) },
    notes: { type: String, default: '' },
    tags: { type: [String], default: [] },
    isBlacklisted: { type: Boolean, default: false },
    totalOrderValue: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

customerSchema.index({ gstin: 1 }, { unique: true, sparse: true });
customerSchema.index({ 'addresses.geo': '2dsphere' });

export const Customer = model('Customer', customerSchema);

export const SEGMENTS = ['walk_in', 'small', 'mid', 'large', 'enterprise'] as const;
