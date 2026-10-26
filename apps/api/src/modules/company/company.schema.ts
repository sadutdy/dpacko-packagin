import { z } from 'zod';

/* GSTIN: 2-digit state code, PAN, entity code, 'Z', checksum. Uppercased. */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const GSTIN_MESSAGE = 'Invalid GSTIN';

export const gstinSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  z
    .string()
    .refine((value) => value === '' || GSTIN_PATTERN.test(value), GSTIN_MESSAGE)
    .default(''),
);

export const updateCompanySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(160),
  address: z.string().trim().max(600).default(''),
  phone: z
    .string()
    .trim()
    .default('')
    .refine((value) => value === '' || /^\+[1-9]\d{6,14}$/.test(value), 'Use E.164 format, e.g. +9194…'),
  website: z
    .string()
    .trim()
    .default('')
    .refine((value) => value === '' || z.string().url().safeParse(value).success, 'Enter a full URL, e.g. https://…'),
  logo: z.string().trim().max(600).default(''),
  gstin: gstinSchema,
  stateName: z.string().trim().max(60).default(''),
  stateCode: z
    .string()
    .trim()
    .default('')
    .refine((value) => value === '' || /^\d{2}$/.test(value), 'Use the 2-digit GST state code, e.g. 32'),
  declaration: z.string().trim().max(600).default(''),
  bankName: z.string().trim().max(120).default(''),
  accountNo: z.string().trim().max(34).default(''),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .default('')
    .refine((value) => value === '' || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value), 'Invalid IFSC'),
  branch: z.string().trim().max(120).default(''),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
