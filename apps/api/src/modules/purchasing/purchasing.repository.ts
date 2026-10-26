import { type Types } from 'mongoose';
import type { FilterQuery, HydratedDocument } from 'mongoose';

import { GoodsReceipt, PurchaseOrder, Vendor } from './purchasing.model.js';

export type VendorDoc = HydratedDocument<
  {
    vendorCode: string;
    name: string;
    nameTa: string;
    type: string;
    gstin: string;
    phone: string;
    email: string;
    address: unknown;
    paymentTermsDays: number;
    rating: number;
    isActive: boolean;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type PurchaseOrderDoc = HydratedDocument<
  {
    poNumber: string;
    vendorId: Types.ObjectId;
    items: Types.DocumentArray<{
      materialId: Types.ObjectId;
      quantity: number;
      unit: string;
      unitCostPaise: number;
      taxRate: number;
      receivedQty: number;
      lineTotalPaise: number;
    }>;
    status: string;
    totalPaise: number;
    taxPaise: number;
    grandTotalPaise: number;
    expectedDeliveryDate?: Date | null;
    notes: string;
    sentAt?: Date | null;
    receivedAt?: Date | null;
    createdBy?: Types.ObjectId | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export type GoodsReceiptDoc = HydratedDocument<
  {
    grnNumber: string;
    purchaseOrderId?: Types.ObjectId | null;
    vendorId: Types.ObjectId;
    items: Types.DocumentArray<{
      materialId: Types.ObjectId;
      orderedQty: number;
      receivedQty: number;
      rejectedQty: number;
      unitCostPaise: number;
      binLocation: string;
    }>;
    invoiceNumber: string;
    invoiceDate?: Date | null;
    status: string;
    postedAt?: Date | null;
    postedBy?: Types.ObjectId | null;
  },
  { createdAt: Date; updatedAt: Date }
>;

export const purchasingRepository = {
  async createVendor(input: Record<string, unknown>): Promise<VendorDoc> {
    const [doc] = await Vendor.create([input]);
    return doc as VendorDoc;
  },

  insertionManyVendors(docs: Record<string, unknown>[]) {
    return Vendor.insertMany(docs) as unknown as Promise<VendorDoc[]>;
  },

  listVendors(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = Vendor.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<VendorDoc[]>;
  },

  countVendors(filter: FilterQuery<unknown>) {
    return Vendor.countDocuments(filter).exec();
  },

  findVendorById(id: string) {
    return Vendor.findById(id).exec() as Promise<VendorDoc | null>;
  },

  findVendorByCode(code: string) {
    return Vendor.findOne({ vendorCode: code }).exec() as Promise<VendorDoc | null>;
  },

  updateVendor(id: string, input: Record<string, unknown>) {
    return Vendor.findByIdAndUpdate(id, input, { new: true }).exec() as Promise<VendorDoc | null>;
  },

  async createPurchaseOrder(input: Record<string, unknown>): Promise<PurchaseOrderDoc> {
    const [doc] = await PurchaseOrder.create([input]);
    return doc as PurchaseOrderDoc;
  },

  findPurchaseOrderById(id: string) {
    return PurchaseOrder.findById(id).exec() as Promise<PurchaseOrderDoc | null>;
  },

  findPurchaseOrderByNumber(number: string) {
    return PurchaseOrder.findOne({ poNumber: number }).exec() as Promise<PurchaseOrderDoc | null>;
  },

  listPurchaseOrders(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = PurchaseOrder.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<PurchaseOrderDoc[]>;
  },

  countPurchaseOrders(filter: FilterQuery<unknown>) {
    return PurchaseOrder.countDocuments(filter).exec();
  },

  updatePurchaseOrder(id: string, update: Record<string, unknown>) {
    return PurchaseOrder.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<PurchaseOrderDoc | null>;
  },

  async createGoodsReceipt(input: Record<string, unknown>): Promise<GoodsReceiptDoc> {
    const [doc] = await GoodsReceipt.create([input]);
    return doc as GoodsReceiptDoc;
  },

  findGoodsReceiptById(id: string) {
    return GoodsReceipt.findById(id).exec() as Promise<GoodsReceiptDoc | null>;
  },

  listGoodsReceipts(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = GoodsReceipt.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<GoodsReceiptDoc[]>;
  },

  countGoodsReceipts(filter: FilterQuery<unknown>) {
    return GoodsReceipt.countDocuments(filter).exec();
  },

  updateGoodsReceipt(id: string, update: Record<string, unknown>) {
    return GoodsReceipt.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<GoodsReceiptDoc | null>;
  },
};
