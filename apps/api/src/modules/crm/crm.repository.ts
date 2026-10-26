import { type Types } from 'mongoose';
import type { FilterQuery, HydratedDocument } from 'mongoose';

import { nextCounter } from '../counters/counter.model.js';
import { Customer } from './crm.model.js';

export interface CustomerAddressShape {
  label: string;
  contactName: string;
  phone: string;
  line1: string;
  line2: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  geo: { type: string; coordinates: number[] };
  isDefault: boolean;
}

export type CustomerDoc = HydratedDocument<
  {
    customerCode: string;
    businessName: string;
    businessNameTa: string;
    contactName: string;
    contactNameTa: string;
    phone: string;
    email: string;
    gstin?: string;
    pan: string;
    segment: string;
    priceTier: string;
    creditLimit: number;
    creditUsed: number;
    paymentTermsDays: number;
    addresses: Types.DocumentArray<CustomerAddressShape>;
    deskNotes: { preferredLanguage: string; boxSizeHabits: string[]; otherReplies: string; followUpPrefs: string };
    notes: string;
    tags: string[];
    isBlacklisted: boolean;
    totalOrderValue: number;
    orderCount: number;
  },
  { createdAt: Date; updatedAt: Date }
>;

export const crmRepository = {
  async create(input: Record<string, unknown>): Promise<CustomerDoc> {
    const code = `CUS-${String(await nextCounter('customer', 'all')).padStart(4, '0')}`;
    const [doc] = await Customer.create([{ ...input, customerCode: code }]);
    return doc as CustomerDoc;
  },

  findById(id: string) {
    return Customer.findById(id).exec() as Promise<CustomerDoc | null>;
  },

  findByPhone(phone: string) {
    return Customer.findOne({ phone }).exec() as Promise<CustomerDoc | null>;
  },

  list(filter: FilterQuery<unknown>, skip: number, limit: number, sort?: string) {
    const query = Customer.find(filter).skip(skip).limit(limit);
    if (sort) query.sort(sort);
    else query.sort({ createdAt: -1 });
    return query.exec() as Promise<CustomerDoc[]>;
  },

  count(filter: FilterQuery<unknown>) {
    return Customer.countDocuments(filter).exec();
  },

  update(id: string, update: Record<string, unknown>) {
    return Customer.findByIdAndUpdate(id, update, { new: true }).exec() as Promise<CustomerDoc | null>;
  },

  remove(id: string) {
    return Customer.findByIdAndDelete(id).exec() as Promise<CustomerDoc | null>;
  },

  segments() {
    return Customer.aggregate([
      { $group: { _id: '$segment', count: { $sum: 1 } } },
      { $project: { _id: 0, segment: '$_id', count: 1 } },
    ]).exec();
  },
};
