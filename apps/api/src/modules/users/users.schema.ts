import { z } from 'zod';

import { ROLE_OPTIONS } from '../auth/auth.schema.js';

export { inviteUserSchema, updateUserSchema } from '../auth/auth.schema.js';

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  role: z.enum(ROLE_OPTIONS).optional(),
  status: z.enum(['active', 'invited', 'suspended', 'archived']).optional(),
  search: z.string().optional(),
});
