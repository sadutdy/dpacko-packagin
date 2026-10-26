import { z } from 'zod';

import { QUOTE_TITLES } from '@ameen/domain';

import { objectIdSchema } from '../auth/auth.schema.js';

const ORDER_STATUSES = [
  'draft',
  'placed',
  'payment_pending',
  'paid',
  'planned',
  'in_production',
  'qc',
  'ready',
  'dispatched',
  'delivered',
  'closed',
  'cancelled',
  'on_hold',
  'rescheduled',
] as const;

export const printSpecSchema = z.object({
  type: z.enum(['none', 'single', 'multi']).default('none'),
  sides: z.number().int().min(0).default(0),
  colors: z.number().int().min(0).default(0),
  artworkUrl: z.string().default(''),
  notes: z.string().default(''),
});

export const quoteItemInputSchema = z.object({
  skuId: objectIdSchema,
  quantity: z.number().int().positive(),
  printSpec: printSpecSchema.optional(),
});

export const addressSchema = z.object({
  label: z.string().default(''),
  contactName: z.string().default(''),
  phone: z.string().default(''),
  line1: z.string().default(''),
  line2: z.string().default(''),
  area: z.string().default(''),
  city: z.string().default(''),
  district: z.string().default(''),
  state: z.string().default('TN'),
  pincode: z.string().default(''),
  geo: z
    .object({
      type: z.string().default('Point'),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .optional(),
  isDefault: z.boolean().optional(),
});

export const createOrderSchema = z.object({
  customerId: objectIdSchema,
  items: z.array(quoteItemInputSchema).min(1),
  paymentMethod: z.enum(['razorpay', 'cod', 'credit']).default('cod'),
  requestedDeliveryDate: z.coerce.date().optional(),
  deliveryAddress: addressSchema.optional(),
  source: z.enum(['customer_app', 'customer_web', 'admin', 'phone', 'repeat']).default('admin'),
  isRepeat: z.boolean().default(false),
  notes: z.string().default(''),
  persistQuote: z.boolean().default(false),
});

export const quotePreviewSchema = z.object({
  customerId: objectIdSchema,
  items: z.array(quoteItemInputSchema).min(1),
  persist: z.boolean().default(false),
});

export const updateOrderSchema = z.object({
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  requestedDeliveryDate: z.coerce.date().optional(),
  promisedDeliveryDate: z.coerce.date().optional(),
  deliveryAddress: addressSchema.optional(),
});

export const updateQuoteSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']).optional(),
  validUntil: z.coerce.date().optional(),
});

export const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  customerId: objectIdSchema.optional(),
  search: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const objectIdParamSchema = z.object({ id: objectIdSchema });

export const orderIdParamSchema = z.object({ id: objectIdSchema });

export const transitionSchema = z.object({
  to: z.enum(ORDER_STATUSES),
  reason: z.string().default(''),
  note: z.string().default(''),
});

/** One editable quote line; free-text lines have no SKU. */
export const quoteLineSchema = z.object({
  skuId: objectIdSchema.nullable().default(null),
  name: z.string().trim().min(1, 'Item name is required').max(160),
  description: z.string().trim().max(300).default(''),
  hsn: z.string().trim().max(12).default(''),
  quantity: z.number().int().positive(),
  unit: z.string().trim().min(1).max(12).default('NOS'),
  ratePaise: z.number().int().min(0),
  setupChargePaise: z.number().int().min(0).default(0),
  taxRate: z.number().min(0).max(28),
});

/** Buyer-block edits (blank = use the customer's own value). */
export const partyOverrideInputSchema = z.object({
  name: z.string().trim().max(160).default(''),
  addressLines: z.array(z.string().trim().max(160)).max(6).default([]),
  gstin: z.string().trim().max(15).default(''),
  stateName: z.string().trim().max(60).default(''),
  phone: z.string().trim().max(20).default(''),
});

/** Full quote as saved by the quote editor (create and edit). */
export const saveQuoteSchema = z.object({
  customerId: objectIdSchema,
  refNo: z.string().trim().max(60).default(''),
  issueDate: z.coerce.date().nullable().default(null),
  validUntil: z.coerce.date().nullable().default(null),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).default('draft'),
  title: z.enum(QUOTE_TITLES).default('Proforma Invoice'),
  layout: z.string().trim().min(1).max(30).default('classic'),
  advancePct: z.number().min(0).max(100).default(50),
  partyOverride: partyOverrideInputSchema.default({}),
  terms: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  notes: z.string().trim().max(1000).default(''),
  items: z.array(quoteLineSchema).min(1, 'Add at least one item').max(50),
});

export type SaveQuoteInput = z.infer<typeof saveQuoteSchema>;

export const listQuotesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  customerId: objectIdSchema.optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']).optional(),
});
