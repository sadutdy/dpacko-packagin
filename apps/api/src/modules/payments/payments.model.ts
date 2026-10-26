import { Schema, model } from 'mongoose';

import { partyOverrideSchema } from '../orders/orders.model.js';

const invoiceItemSchema = new Schema(
  {
    description: { type: String, required: true },
    // v2 (invoice editor): printed name, sub-line details, catalog link, setup charge.
    name: { type: String, default: '' },
    details: { type: String, default: '' },
    skuId: { type: Schema.Types.ObjectId, ref: 'CatalogSku', default: null },
    setupChargePaise: { type: Number, default: 0 },
    hsnCode: { type: String, default: '4819' },
    qty: { type: Number, required: true },
    unit: { type: String, default: 'pcs' },
    unitPricePaise: { type: Number, default: 0 },
    taxRate: { type: Number, default: 18 },
    cgstPaise: { type: Number, default: 0 },
    sgstPaise: { type: Number, default: 0 },
    igstPaise: { type: Number, default: 0 },
    lineTotalPaise: { type: Number, default: 0 },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    // Optional since v2: invoices can be raised from a quote or directly.
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null },
    title: { type: String, enum: ['Tax Invoice', 'Bill of Supply'], default: 'Tax Invoice' },
    layout: { type: String, default: 'tally' },
    copies: { type: [String], default: ['original'] },
    reverseCharge: { type: Boolean, default: false },
    buyerOrderNo: { type: String, default: '' },
    buyerOrderDate: { type: Date, default: null },
    dispatch: {
      type: new Schema(
        {
          deliveryNote: { type: String, default: '' },
          paymentTerms: { type: String, default: '' },
          dispatchDocNo: { type: String, default: '' },
          dispatchedThrough: { type: String, default: '' },
          destination: { type: String, default: '' },
          vehicleNo: { type: String, default: '' },
          ewayBillNo: { type: String, default: '' },
          termsOfDelivery: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    partyOverride: { type: partyOverrideSchema, default: () => ({}) },
    // Consignee; only printed when enabled.
    shipTo: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          name: { type: String, default: '' },
          addressLines: { type: [String], default: [] },
          gstin: { type: String, default: '' },
          stateName: { type: String, default: '' },
          phone: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    terms: { type: [String], default: [] },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    financialYear: { type: String, default: '' },
    items: { type: [invoiceItemSchema], default: [] },
    placeOfSupply: { type: String, default: '33' },
    supplierGstin: { type: String, default: '' },
    customerGstin: { type: String, default: '' },
    subtotalPaise: { type: Number, default: 0 },
    discountPaise: { type: Number, default: 0 },
    cgstPaise: { type: Number, default: 0 },
    sgstPaise: { type: Number, default: 0 },
    igstPaise: { type: Number, default: 0 },
    roundOffPaise: { type: Number, default: 0 },
    grandTotalPaise: { type: Number, default: 0 },
    amountInWords: { type: String, default: '' },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'overdue', 'cancelled', 'credited'],
      default: 'unpaid',
    },
    pdfUrl: { type: String, default: '' },
    issuedAt: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    printCount: { type: Number, default: 0 },
    prints: {
      type: [
        new Schema(
          {
            by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            copies: { type: Number, default: 1 },
            at: { type: Date, default: () => new Date() },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    paymentIds: { type: [Schema.Types.ObjectId], ref: 'Payment', default: [] },
    schemaVersion: { type: Number, default: 2 },
  },
  { timestamps: true },
);

export const Invoice = model('Invoice', invoiceSchema);

const refundSchema = new Schema(
  {
    amountPaise: { type: Number, required: true },
    reason: { type: String, default: '' },
    providerRefundId: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false },
);

const paymentSchema = new Schema(
  {
    paymentNumber: { type: String, required: true, unique: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    provider: { type: String, enum: ['razorpay', 'cash', 'bank_transfer', 'cheque'], required: true },
    method: { type: String, enum: ['upi', 'card', 'netbanking', 'cod', 'credit'], required: true },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'],
      default: 'created',
    },
    providerOrderId: { type: String, default: '' },
    providerPaymentId: { type: String, default: '' },
    feePaise: { type: Number, default: 0 },
    refunds: { type: [refundSchema], default: [] },
    reconciled: { type: Boolean, default: false },
    reconciledAt: { type: Date, default: null },
    methodDetails: { type: Schema.Types.Mixed, default: {} },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

paymentSchema.index({ providerOrderId: 1 }, { unique: true, partialFilterExpression: { providerOrderId: { $gt: '' } } });
paymentSchema.index({ providerPaymentId: 1 }, { unique: true, partialFilterExpression: { providerPaymentId: { $gt: '' } } });

export const Payment = model('Payment', paymentSchema);

const razorpayWebhookSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['received', 'processed', 'failed', 'ignored'],
      default: 'received',
    },
    processedAt: { type: Date, default: null },
    error: { type: String, default: '' },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const RazorpayWebhook = model('RazorpayWebhook', razorpayWebhookSchema);
