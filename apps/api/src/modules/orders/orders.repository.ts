import { type Types } from 'mongoose';
import type { FilterQuery, HydratedDocument } from 'mongoose';

import { Order, Quote } from './orders.model.js';

export interface OrderItemShape {
  skuId: Types.ObjectId;
  skuCode: string;
  name: string;
  quantity: number;
  dimensions: unknown;
  material: string;
  printSpec: {
    type: string;
    sides: number;
    colors: number;
    artworkUrl: string;
    notes: string;
    plateChargePaise: number;
  };
  unitPricePaise: number;
  basePricePaise: number;
  setupChargePaise: number;
  discountPaise: number;
  taxRate: number;
  hsnCode?: string;
  unit?: string;
  lineTotalPaise: number;
  bomSnapshot: unknown;
}

export type OrderDoc = HydratedDocument<
  {
    orderNumber: string;
    customerId: Types.ObjectId;
    status: string;
    stateHistory: Types.DocumentArray<{
      from: string;
      to: string;
      at: Date;
      by?: Types.ObjectId | null;
      reason: string;
      note: string;
    }>;
    items: Types.DocumentArray<OrderItemShape>;
    pricing: {
      subtotalPaise: number;
      discountPaise: number;
      setupChargePaise: number;
      taxPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      roundOffPaise: number;
      grandTotalPaise: number;
      currency: string;
    };
    payment: {
      method: string;
      status: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      paidAt?: Date | null;
      amountPaidPaise: number;
      refunds: unknown;
    };
    deliveryAddress: unknown;
    requestedDeliveryDate?: Date | null;
    promisedDeliveryDate?: Date | null;
    notes: string;
    internalNotes: string;
    quoteId?: Types.ObjectId | null;
    invoiceId?: Types.ObjectId | null;
    deliveryId?: Types.ObjectId | null;
    createdBy?: Types.ObjectId | null;
    source: string;
    isRepeat: boolean;
    cancelledAt?: Date | null;
    cancelReason: string;
    placedAt?: Date | null;
    closedAt?: Date | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type QuoteDoc = HydratedDocument<
  {
    quoteNumber: string;
    customerId: Types.ObjectId;
    refNo?: string;
    issueDate?: Date | null;
    title?: string;
    layout?: string;
    advancePct?: number;
    partyOverride?: { name?: string; addressLines?: string[]; gstin?: string; stateName?: string; phone?: string } | null;
    terms?: string[];
    notes?: string;
    items: Types.DocumentArray<Omit<OrderItemShape, 'skuId'> & { skuId: Types.ObjectId | null; description?: string }>;
    pricing: OrderShapePricing;
    status: string;
    validUntil?: Date | null;
    convertedOrderId?: Types.ObjectId | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

interface OrderShapePricing {
  subtotalPaise: number;
  discountPaise: number;
  setupChargePaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
  currency: string;
}

export const ordersRepository = {
  async createOrder(input: Record<string, unknown>): Promise<OrderDoc> {
    const [doc] = await Order.create([input]);
    return doc as OrderDoc;
  },

  insertionManyOrders(docs: Record<string, unknown>[]) {
    return Order.insertMany(docs) as unknown as Promise<OrderDoc[]>;
  },

  findOrderById(id: string) {
    return Order.findById(id).exec() as Promise<OrderDoc | null>;
  },

  findOrderByNumber(number: string) {
    return Order.findOne({ orderNumber: number }).exec() as Promise<OrderDoc | null>;
  },

  listOrders(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = Order.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<OrderDoc[]>;
  },

  countOrders(filter: FilterQuery<unknown>) {
    return Order.countDocuments(filter).exec();
  },

  updateOrder(id: string, update: Record<string, unknown>) {
    return Order.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<OrderDoc | null>;
  },

  statusCounts(match: FilterQuery<unknown> = {}) {
    return Order.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]).exec();
  },

  revenueByMonth(match: FilterQuery<unknown> = {}) {
    return Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$pricing.grandTotalPaise' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]).exec();
  },

  topCustomers(match: FilterQuery<unknown> = {}, limit = 5) {
    return Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$customerId',
          totalValue: { $sum: '$pricing.grandTotalPaise' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalValue: -1 } },
      { $limit: limit },
    ]).exec();
  },

  topSkus(match: FilterQuery<unknown> = {}, limit = 10) {
    return Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.skuCode',
          name: { $first: '$items.name' },
          totalQty: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.lineTotalPaise' },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
    ]).exec();
  },

  async createQuote(input: Record<string, unknown>): Promise<QuoteDoc> {
    const [doc] = await Quote.create([input]);
    return doc as QuoteDoc;
  },

  findQuoteById(id: string) {
    return Quote.findById(id).exec() as Promise<QuoteDoc | null>;
  },

  listQuotes(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = Quote.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<QuoteDoc[]>;
  },

  countQuotes(filter: FilterQuery<unknown>) {
    return Quote.countDocuments(filter).exec();
  },

  updateQuote(id: string, update: Record<string, unknown>) {
    return Quote.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<QuoteDoc | null>;
  },

  deleteQuote(id: string) {
    return Quote.findByIdAndDelete(id).exec() as Promise<QuoteDoc | null>;
  },
};
