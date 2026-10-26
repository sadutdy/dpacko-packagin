import { z } from 'zod';

import { objectIdSchema } from '../auth/auth.schema.js';

export const driverSchema = z.object({
  name: z.string().min(1),
  nameTa: z.string().default(''),
  phone: z.string().min(1),
  vehicleIds: z.array(objectIdSchema).default([]),
  licenseNumber: z.string().default(''),
  licenseExpiry: z.coerce.date().optional(),
});

export const vehicleSchema = z.object({
  type: z.enum(['van', 'mini_truck', 'bike']),
  registrationNumber: z.string().min(1),
  capacityKg: z.number().positive().default(500),
  capacityBoxes: z.number().positive().default(200),
  insuranceExpiry: z.coerce.date().optional(),
});

export const updateDriverLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  heading: z.number().optional(),
});

export const trackPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  heading: z.number().optional(),
  speed: z.number().optional(),
});

export const assignSchema = z.object({
  driverId: objectIdSchema,
  vehicleId: objectIdSchema,
  plannedAt: z.coerce.date().optional(),
});

export const deliverSchema = z.object({
  method: z.enum(['signature', 'photo', 'otp']),
  signatureUrl: z.string().default(''),
  photoUrl: z.string().default(''),
  otp: z.string().optional(),
  recipientName: z.string().default(''),
  notes: z.string().default(''),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const failDeliverySchema = z.object({
  reason: z.string().min(1),
});

export const rescheduleSchema = z.object({
  plannedAt: z.coerce.date(),
});

export const listDeliveriesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  status: z
    .enum(['unassigned', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'rescheduled', 'returned'])
    .optional(),
  driverId: objectIdSchema.optional(),
  date: z.coerce.date().optional(),
});

export const createRouteSchema = z.object({
  routeDate: z.coerce.date(),
  driverId: objectIdSchema,
  vehicleId: objectIdSchema,
  deliveryIds: z.array(objectIdSchema).min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const listRoutesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  routeDate: z.coerce.date().optional(),
  driverId: objectIdSchema.optional(),
});
