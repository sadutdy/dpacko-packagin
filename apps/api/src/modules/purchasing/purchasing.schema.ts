import { z } from 'zod';

import { objectIdSchema } from '../auth/auth.schema.js';

export const vendorSchema = z.object({
  name: z.string().min(1),
  nameTa: z.string().default(''),
  type: z.enum(['raw_material', 'print_partner', 'packaging_other']).default('raw_material'),
  gstin: z.string().default(''),
  phone: z.string().default(''),
  email: z.string().default(''),
  address: z
    .object({
      line1: z.string().default(''),
      city: z.string().default(''),
      district: z.string().default(''),
      state: z.string().default('TN'),
      pincode: z.string().default(''),
    })
    .default({ line1: '', city: '', district: '', state: 'TN', pincode: '' }),
  paymentTermsDays: z.number().int().min(0).default(30),
  rating: z.number().min(0).max(5).default(3),
});

export const updateVendorSchema = vendorSchema.partial();

export const listVendorsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
});

export const vendorIdParamSchema = z.object({ id: objectIdSchema });

export const poItemSchema = z.object({
  materialId: objectIdSchema,
  quantity: z.number().positive(),
  unit: z.enum(['sq_m', 'sheet', 'kg', 'ml', 'roll', 'pcs']),
  unitCostPaise: z.number().int().min(0),
  taxRate: z.number().min(0).default(18),
});

export const createPoSchema = z.object({
  vendorId: objectIdSchema,
  items: z.array(poItemSchema).min(1),
  expectedDeliveryDate: z.coerce.date().optional(),
  notes: z.string().default(''),
});

export const listPosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  status: z.enum(['draft', 'sent', 'partially_received', 'received', 'cancelled']).optional(),
  vendorId: objectIdSchema.optional(),
});

export const receiveItemSchema = z.object({
  materialId: objectIdSchema,
  receivedQty: z.number().min(0),
  rejectedQty: z.number().min(0).default(0),
  unitCostPaise: z.number().int().min(0).default(0),
  binLocation: z.string().default('STORE-1'),
});

export const createGrnSchema = z.object({
  purchaseOrderId: objectIdSchema,
  invoiceNumber: z.string().default(''),
  invoiceDate: z.coerce.date().optional(),
  items: z.array(receiveItemSchema).min(1),
});
