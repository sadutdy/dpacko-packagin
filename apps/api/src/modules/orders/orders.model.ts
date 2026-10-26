import { Schema, model } from 'mongoose';

const orderItemSchema = new Schema(
  {
    skuId: { type: Schema.Types.ObjectId, ref: 'CatalogSku', required: true },
    skuCode: { type: String, default: '' },
    name: { type: String, default: '' },
    quantity: { type: Number, required: true },
    dimensions: { type: Schema.Types.Mixed, default: {} },
    material: { type: String, default: '' },
    printSpec: {
      type: {
        type: String,
        enum: ['none', 'single', 'multi'],
        default: 'none',
      },
      sides: { type: Number, default: 0 },
      colors: { type: Number, default: 0 },
      artworkUrl: { type: String, default: '' },
      notes: { type: String, default: '' },
      plateChargePaise: { type: Number, default: 0 },
    },
    unitPricePaise: { type: Number, default: 0 },
    basePricePaise: { type: Number, default: 0 },
    setupChargePaise: { type: Number, default: 0 },
    discountPaise: { type: Number, default: 0 },
    taxRate: { type: Number, default: 18 },
    // Snapshotted for printed quotes/invoices; older docs fall back to bomSnapshot.
    hsnCode: { type: String, default: '' },
    unit: { type: String, default: 'NOS' },
    lineTotalPaise: { type: Number, default: 0 },
    bomSnapshot: { type: Schema.Types.Mixed, default: [] },
  },
  { _id: false },
);

const stateHistorySchema = new Schema(
  {
    from: { type: String, default: '' },
    to: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const pricingSchema = new Schema(
  {
    subtotalPaise: { type: Number, default: 0 },
    discountPaise: { type: Number, default: 0 },
    setupChargePaise: { type: Number, default: 0 },
    taxPaise: { type: Number, default: 0 },
    cgstPaise: { type: Number, default: 0 },
    sgstPaise: { type: Number, default: 0 },
    igstPaise: { type: Number, default: 0 },
    roundOffPaise: { type: Number, default: 0 },
    grandTotalPaise: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  { _id: false },
);

const paymentSchema = new Schema(
  {
    method: { type: String, enum: ['razorpay', 'cod', 'credit'], default: 'cod' },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded', 'partial'], default: 'pending' },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    amountPaidPaise: { type: Number, default: 0 },
    refunds: { type: Schema.Types.Mixed, default: [] },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    status: { type: String, default: 'placed', index: true },
    stateHistory: { type: [stateHistorySchema], default: [] },
    items: { type: [orderItemSchema], default: [] },
    pricing: { type: pricingSchema, default: () => ({}) },
    payment: { type: paymentSchema, default: () => ({}) },
    deliveryAddress: { type: Schema.Types.Mixed, default: {} },
    requestedDeliveryDate: { type: Date, default: null },
    promisedDeliveryDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    internalNotes: { type: String, default: '' },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    deliveryId: { type: Schema.Types.ObjectId, ref: 'Delivery', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    source: {
      type: String,
      enum: ['customer_app', 'customer_web', 'admin', 'phone', 'repeat'],
      default: 'admin',
    },
    isRepeat: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    placedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, requestedDeliveryDate: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const Order = model('Order', orderSchema);

// Quote lines may be free-text (no catalog SKU) and carry a printed description.
const quoteItemSchema = orderItemSchema.clone();
quoteItemSchema.path('skuId').required(false);
quoteItemSchema.add({
  skuId: { type: Schema.Types.ObjectId, ref: 'CatalogSku', default: null },
  description: { type: String, default: '' },
});

/** Buyer-block edits made in the quote editor; blanks fall back to the customer. */
export const partyOverrideSchema = new Schema(
  {
    name: { type: String, default: '' },
    addressLines: { type: [String], default: [] },
    gstin: { type: String, default: '' },
    stateName: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  { _id: false },
);

const quoteSchema = new Schema(
  {
    quoteNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    refNo: { type: String, default: '' },
    // Printed "Dated"; falls back to createdAt when unset.
    issueDate: { type: Date, default: null },
    title: { type: String, enum: ['Proforma Invoice', 'Quotation'], default: 'Proforma Invoice' },
    layout: { type: String, default: 'classic' },
    advancePct: { type: Number, min: 0, max: 100, default: 50 },
    partyOverride: { type: partyOverrideSchema, default: () => ({}) },
    terms: { type: [String], default: [] },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    items: { type: [quoteItemSchema], default: [] },
    pricing: { type: pricingSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'],
      default: 'draft',
    },
    validUntil: { type: Date, default: null },
    convertedOrderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    // 2: editor fields (refNo, issueDate, presentation, partyOverride, free-text lines).
    schemaVersion: { type: Number, default: 2 },
  },
  { timestamps: true },
);

export const Quote = model('Quote', quoteSchema);
