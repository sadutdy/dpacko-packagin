import { Types } from 'mongoose';
import type { FilterQuery, HydratedDocument } from 'mongoose';

import { Invoice, Payment, RazorpayWebhook } from './payments.model.js';

export type InvoiceDoc = HydratedDocument<
  {
    invoiceNumber: string;
    orderId: Types.ObjectId | null;
    quoteId?: Types.ObjectId | null;
    title?: string;
    layout?: string;
    copies?: string[];
    reverseCharge?: boolean;
    buyerOrderNo?: string;
    buyerOrderDate?: Date | null;
    dispatch?: Partial<Record<'deliveryNote' | 'paymentTerms' | 'dispatchDocNo' | 'dispatchedThrough' | 'destination' | 'vehicleNo' | 'ewayBillNo' | 'termsOfDelivery', string>> | null;
    partyOverride?: { name?: string; addressLines?: string[]; gstin?: string; stateName?: string; phone?: string } | null;
    shipTo?: { enabled?: boolean; name?: string; addressLines?: string[]; gstin?: string; stateName?: string; phone?: string } | null;
    terms?: string[];
    notes?: string;
    customerId: Types.ObjectId;
    financialYear: string;
    items: Types.DocumentArray<{
      description: string;
      name?: string;
      details?: string;
      skuId?: Types.ObjectId | null;
      setupChargePaise?: number;
      hsnCode: string;
      qty: number;
      unit: string;
      unitPricePaise: number;
      taxRate: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      lineTotalPaise: number;
    }>;
    placeOfSupply: string;
    supplierGstin: string;
    customerGstin: string;
    subtotalPaise: number;
    discountPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    roundOffPaise: number;
    grandTotalPaise: number;
    amountInWords: string;
    status: string;
    pdfUrl: string;
    issuedAt?: Date | null;
    dueDate?: Date | null;
    printCount: number;
    prints: Types.DocumentArray<{ by: Types.ObjectId; copies: number; at?: Date | null }>;
    paymentIds: Types.ObjectId[];
  },
  { createdAt: Date; updatedAt: Date }
>;

export type PaymentDoc = HydratedDocument<
  {
    paymentNumber: string;
    orderId: Types.ObjectId;
    invoiceId?: Types.ObjectId | null;
    customerId: Types.ObjectId;
    provider: string;
    method: string;
    amountPaise: number;
    currency: string;
    status: string;
    providerOrderId: string;
    providerPaymentId: string;
    feePaise: number;
    refunds: unknown;
    reconciled: boolean;
    reconciledAt?: Date | null;
    methodDetails: unknown;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type RazorpayWebhookDoc = HydratedDocument<
  {
    eventId: string;
    event: string;
    payload: unknown;
    status: string;
    processedAt?: Date | null;
    error: string;
  },
  { createdAt: Date; updatedAt: Date }
>;

export const paymentsRepository = {
  async createInvoice(input: Record<string, unknown>): Promise<InvoiceDoc> {
    const [doc] = await Invoice.create([input]);
    return doc as InvoiceDoc;
  },
  findInvoiceById(id: string) {
    return Invoice.findById(id).exec() as Promise<InvoiceDoc | null>;
  },
  findInvoiceByOrderId(orderId: string) {
    return Invoice.findOne({ orderId }).exec() as Promise<InvoiceDoc | null>;
  },
  listInvoices(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = Invoice.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<InvoiceDoc[]>;
  },
  countInvoices(filter: FilterQuery<unknown>) {
    return Invoice.countDocuments(filter).exec();
  },
  updateInvoice(id: string, update: Record<string, unknown>) {
    return Invoice.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<InvoiceDoc | null>;
  },

  /** Records a print run: appends the print entry and bumps printCount atomically. */
  markInvoicePrinted(id: string, actorId: string, copies: number) {
    return Invoice.findByIdAndUpdate(
      id,
      {
        $inc: { printCount: copies },
        $push: { prints: { by: new Types.ObjectId(actorId), copies, at: new Date() } },
      },
      { new: true },
    ).exec() as Promise<InvoiceDoc | null>;
  },

  deleteInvoice(id: string) {
    return Invoice.findByIdAndDelete(id).exec() as Promise<InvoiceDoc | null>;
  },
  invoiceAging() {
    return Invoice.aggregate([
      { $match: { status: { $in: ['unpaid', 'partial', 'overdue'] } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalPaise: { $sum: '$grandTotalPaise' },
        },
      },
    ]).exec();
  },

  async createPayment(input: Record<string, unknown>): Promise<PaymentDoc> {
    const [doc] = await Payment.create([input]);
    return doc as PaymentDoc;
  },
  findPaymentById(id: string) {
    return Payment.findById(id).exec() as Promise<PaymentDoc | null>;
  },
  listPayments(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = Payment.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<PaymentDoc[]>;
  },
  countPayments(filter: FilterQuery<unknown>) {
    return Payment.countDocuments(filter).exec();
  },
  updatePayment(id: string, update: Record<string, unknown>) {
    return Payment.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<PaymentDoc | null>;
  },

  async createWebhook(input: Record<string, unknown>): Promise<RazorpayWebhookDoc> {
    const [doc] = await RazorpayWebhook.create([input]);
    return doc as RazorpayWebhookDoc;
  },
  findWebhookByEventId(eventId: string) {
    return RazorpayWebhook.findOne({ eventId }).exec() as Promise<RazorpayWebhookDoc | null>;
  },
  paymentCollectionsByMonth() {
    return Payment.aggregate([
      { $match: { status: 'captured' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          totalPaise: { $sum: '$amountPaise' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]).exec();
  },
};
