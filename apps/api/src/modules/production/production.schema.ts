import { z } from 'zod';

import { objectIdSchema } from '../auth/auth.schema.js';

const STAGES = [
  'queued',
  'received',
  'cutting',
  'creasing',
  'assembly',
  'printing',
  'qc',
  'rework',
  'labelling',
  'packing',
  'ready',
  'scrapped',
  'cancelled',
] as const;

export const jobItemSchema = z.object({
  skuId: objectIdSchema,
  skuCode: z.string().default(''),
  quantity: z.number().int().positive(),
});

export const createJobSchema = z.object({
  orderId: objectIdSchema,
  orderNumber: z.string().default(''),
  items: z.array(jobItemSchema).min(1),
  priority: z.number().int().optional(),
  scheduledDate: z.coerce.date().optional(),
  machineId: objectIdSchema.optional(),
  operatorId: objectIdSchema.optional(),
  offline: z.boolean().default(false),
});

export const listJobsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  stage: z.enum(STAGES).optional(),
  orderId: objectIdSchema.optional(),
  machineId: objectIdSchema.optional(),
  scheduledDate: z.coerce.date().optional(),
});

export const idParamSchema = z.object({ id: objectIdSchema });

export const transitionSchema = z.object({
  to: z.enum(STAGES),
  note: z.string().default(''),
  deviceId: z.string().default(''),
  offline: z.boolean().default(false),
  occurredAt: z.coerce.date().optional(),
});

export const qcResultSchema = z.object({
  result: z.enum(['pass', 'fail', 'reject']),
  checklist: z
    .array(
      z.object({
        code: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
        passed: z.boolean().optional(),
      }),
    )
    .default([]),
  notes: z.string().default(''),
});

export const materialReservationSchema = z.object({
  materialId: objectIdSchema,
  quantity: z.number().positive(),
});

export const reserveMaterialsSchema = z.object({
  location: z.string().default('STORE-1'),
  materials: z.array(materialReservationSchema).min(1),
});

export const machineSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['die_cutter', 'creaser', 'printer', 'laminator', 'assembler']),
  capacityPerShift: z.number().int().positive().default(1000),
  shiftHours: z
    .array(
      z.object({
        name: z.string(),
        start: z.number(),
        end: z.number(),
      }),
    )
    .default([]),
  maintenanceDueDate: z.coerce.date().optional(),
});

export const updateMachineSchema = machineSchema.partial();

export const qcChecklistItemCreate = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  labelTa: z.string().default(''),
  type: z.enum(['pass_fail', 'numeric', 'text']).default('pass_fail'),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  unit: z.string().default(''),
  required: z.boolean().default(true),
});

export const qcChecklistSchema = z.object({
  name: z.string().min(1),
  appliesTo: z.enum(['material', 'category', 'sku']),
  material: z.string().default(''),
  category: z.string().default(''),
  skuId: objectIdSchema.optional(),
  items: z.array(qcChecklistItemCreate).min(1),
});

export const shiftSchema = z.object({
  name: z.string().min(1),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(0).max(1440),
  isNight: z.boolean().default(false),
  days: z.array(z.number().int().min(0).max(6)).default([]),
});

export const syncEventsSchema = z.object({
  events: z
    .array(
      z.object({
        jobId: objectIdSchema,
        to: z.enum(STAGES),
        at: z.coerce.date(),
        deviceId: z.string().default(''),
      }),
    )
    .min(1),
});
