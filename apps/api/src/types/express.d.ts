import type { Permission, Role } from '@ameen/domain';

export interface AuthUser {
  id: string;
  role: Role;
  permissions: readonly Permission[];
  customerId?: string;
  driverId?: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Parsed + validated request data, keyed by source (`body`, `query`, `params`). */
      valid?: Record<string, unknown>;
      user?: AuthUser;
      requestId?: string;
    }
  }
}

export {};
