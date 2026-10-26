import { z } from 'zod';

import { objectIdSchema } from '../auth/auth.schema.js';

export const skuDimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(['mm']).default('mm'),
});

export const skuPrintSchema = z.object({
  type: z.enum(['none', 'single', 'multi']).default('none'),
  sides: z.number().int().min(0).default(0),
  colors: z.number().int().min(0).default(0),
});

export const skuPricingSchema = z.object({
  basePricePaise: z.number().int().min(0),
  minQty: z.number().int().min(1).default(250),
  taxRate: z.number().min(0).default(18),
  hsnCode: z.string().default('4819'),
});

export const createSkuSchema = z.object({
  skuCode: z.string().min(1),
  name: z.string().min(1),
  nameTa: z.string().optional(),
  category: z.enum(['parcel_box', 'cake_box', 'burger_box', 'chicken_basket', 'tray', 'liner']),
  material: z.enum(['kraft', 'corrugated_3ply', 'corrugated_2ply', 'whiteboard', 'paperboard', 'plastic']),
  dimensions: skuDimensionsSchema,
  flute: z.enum(['B', 'C', 'E', 'BC']).nullable().optional(),
  gsm: z.number().nullable().optional(),
  print: skuPrintSchema.default({ type: 'none', sides: 0, colors: 0 }),
  pricing: skuPricingSchema,
  leadTimeDays: z.number().int().min(0).default(2),
  tags: z.array(z.string()).default([]),
});

export const updateSkuSchema = createSkuSchema.partial();

export const listSkusSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  category: z.string().optional(),
  material: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
});

export const bomLineSchema = z.object({
  materialId: objectIdSchema,
  quantityPerUnit: z.number().positive(),
  unit: z.enum(['sq_m', 'sheet', 'kg', 'ml', 'pcs', 'roll']),
  wastagePct: z.number().min(0).default(3),
  isPrimary: z.boolean().default(false),
});

export const replaceBomSchema = z.object({ lines: z.array(bomLineSchema).min(1) });
