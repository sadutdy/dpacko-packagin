import { z } from 'zod';

import { objectIdSchema } from '../auth/auth.schema.js';

export const addressSchema = z.object({
  label: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  area: z.string().optional(),
  city: z.string().min(1),
  district: z.string().optional(),
  state: z.string().default('TN'),
  pincode: z.string().length(6),
  isDefault: z.boolean().default(false),
});

export const createCustomerSchema = z.object({
  businessName: z.string().min(1).max(160),
  businessNameTa: z.string().optional(),
  contactName: z.string().optional(),
  contactNameTa: z.string().optional(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  email: z.string().email().optional(),
  gstin: z.string().length(15).optional(),
  pan: z.string().optional(),
  segment: z.enum(['walk_in', 'small', 'mid', 'large', 'enterprise']).default('small'),
  priceTier: z.string().default('standard'),
  creditLimit: z.number().int().min(0).default(0),
  paymentTermsDays: z.number().int().min(0).default(0),
  addresses: z.array(addressSchema).default([]),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isBlacklisted: z.boolean().default(false),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  search: z.string().optional(),
  segment: z.enum(['walk_in', 'small', 'mid', 'large', 'enterprise']).optional(),
  city: z.string().optional(),
  hasOverdue: z.coerce.boolean().optional(),
});

export const creditSchema = z.object({
  creditLimit: z.number().int().min(0),
  paymentTermsDays: z.number().int().min(0).optional(),
});

export const idParamSchema = z.object({ id: objectIdSchema });
