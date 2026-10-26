import { z } from 'zod';

import { INVOICE_TITLES, type CopyKind } from '@ameen/domain';

import { objectIdSchema } from '../auth/auth.schema.js';
import { partyOverrideInputSchema, quoteLineSchema } from '../orders/orders.schema.js';

export const recordPaymentSchema = z.object({
  orderId: objectIdSchema,
  amountPaise: z.number().int().positive(),
  provider: z.enum(['razorpay', 'cash', 'bank_transfer', 'cheque']),
  method: z.enum(['upi', 'card', 'netbanking', 'cod', 'credit']),
  providerOrderId: z.string().default(''),
  providerPaymentId: z.string().default(''),
  note: z.string().optional(),
});

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  status: z.enum(['unpaid', 'partial', 'paid', 'overdue', 'cancelled', 'credited']).optional(),
  customerId: objectIdSchema.optional(),
});

/** Legacy: cut the invoice for an order (FIN-1, idempotent). */
export const invoiceForOrderSchema = z.object({
  orderId: objectIdSchema,
});

const COPY_KIND_VALUES = ['original', 'duplicate', 'triplicate'] as const satisfies readonly CopyKind[];

const text = (max: number) => z.string().trim().max(max).default('');

/** Full invoice as saved by the invoice editor (create and edit). */
export const saveInvoiceSchema = z.object({
  customerId: objectIdSchema,
  orderId: objectIdSchema.nullable().default(null),
  quoteId: objectIdSchema.nullable().default(null),
  issueDate: z.coerce.date().nullable().default(null),
  dueDate: z.coerce.date().nullable().default(null),
  status: z.enum(['unpaid', 'overdue', 'cancelled']).default('unpaid'),
  title: z.enum(INVOICE_TITLES).default('Tax Invoice'),
  layout: z.string().trim().min(1).max(30).default('tally'),
  copies: z.array(z.enum(COPY_KIND_VALUES)).min(1).max(3).default(['original']),
  reverseCharge: z.boolean().default(false),
  buyerOrderNo: text(60),
  buyerOrderDate: z.coerce.date().nullable().default(null),
  dispatch: z
    .object({
      deliveryNote: text(60),
      paymentTerms: text(120),
      dispatchDocNo: text(60),
      dispatchedThrough: text(120),
      destination: text(120),
      vehicleNo: text(20),
      ewayBillNo: text(20),
      termsOfDelivery: text(300),
    })
    .default({}),
  partyOverride: partyOverrideInputSchema.default({}),
  shipTo: partyOverrideInputSchema.extend({ enabled: z.boolean().default(false) }).default({}),
  terms: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  notes: text(1000),
  items: z.array(quoteLineSchema).min(1, 'Add at least one item').max(50),
});

export type SaveInvoiceInput = z.infer<typeof saveInvoiceSchema>;

/** POST /invoices accepts either an editor payload or the legacy `{ orderId }`. */
export const createInvoiceSchema = z.union([saveInvoiceSchema, invoiceForOrderSchema]);

export const updateInvoiceSchema = z.object({
  dueDate: z.coerce.date().optional(),
  status: z.enum(['unpaid', 'partial', 'paid', 'overdue', 'cancelled', 'credited']).optional(),
});

export const invoiceIdParamSchema = z.object({ id: objectIdSchema });

export const listPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  orderId: objectIdSchema.optional(),
  status: z.enum(['created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded']).optional(),
});

export const razorpayOrderSchema = z.object({ orderId: objectIdSchema });

export const razorpayCaptureSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  eventId: z.string().optional(),
});
