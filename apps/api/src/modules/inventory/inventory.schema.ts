import { z } from 'zod';

import { objectIdSchema } from '../auth/auth.schema.js';

export const materialSchema = z.object({
  materialCode: z.string().min(1),
  name: z.string().min(1),
  nameTa: z.string().optional(),
  category: z.enum(['kraft_paper', 'corrugated_sheet', 'ink', 'glue', 'thread', 'tape', 'label_stock']),
  unit: z.enum(['sq_m', 'sheet', 'kg', 'ml', 'roll', 'pcs']),
  packSize: z.number().positive().default(1),
  unitCostPaise: z.number().int().min(0).default(0),
  taxRate: z.number().min(0).default(18),
  hsnCode: z.string().default('4802'),
  reorderPoint: z.number().min(0).default(0),
  reorderQuantity: z.number().min(0).default(0),
  leadTimeDays: z.number().int().min(0).default(3),
  vendorId: objectIdSchema.optional(),
  storageLocation: z.string().default('STORE-1'),
});

export const updateMaterialSchema = materialSchema.partial();

export const listMaterialsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export const stockQuerySchema = z.object({
  materialId: objectIdSchema.optional(),
  location: z.string().optional(),
});

export const movementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  materialId: objectIdSchema.optional(),
  type: z.enum(['receipt', 'consumption', 'reservation', 'release', 'adjustment', 'wastage', 'return']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const adjustmentSchema = z.object({
  materialId: objectIdSchema,
  quantity: z.number(),
  location: z.string().default('STORE-1'),
  reason: z.string().min(1),
  unitCostPaise: z.number().int().min(0).optional(),
});

export const reserveSchema = z.object({
  materialId: objectIdSchema,
  quantity: z.number().positive(),
  location: z.string().default('STORE-1'),
  referenceType: z.enum(['purchase_order', 'production_job', 'manual', 'delivery']).default('production_job'),
  referenceId: objectIdSchema.optional(),
  note: z.string().optional(),
});

export const releaseSchema = reserveSchema.omit({ quantity: true }).extend({
  quantity: z.number().positive(),
});

export const wastageSchema = z.object({
  materialId: objectIdSchema,
  quantity: z.number().positive(),
  location: z.string().default('STORE-1'),
  referenceType: z.enum(['purchase_order', 'production_job', 'manual', 'delivery']).default('production_job'),
  referenceId: objectIdSchema.optional(),
  note: z.string().optional(),
});

export const receiveSchema = z.object({
  materialId: objectIdSchema,
  quantity: z.number().positive(),
  location: z.string().default('STORE-1'),
  unitCostPaise: z.number().int().min(0).default(0),
  referenceType: z.enum(['purchase_order', 'production_job', 'manual', 'delivery']).default('purchase_order'),
  referenceId: objectIdSchema.optional(),
  note: z.string().optional(),
});
