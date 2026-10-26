import type { ReactNode } from 'react';

import { useAuth } from './AuthContext.js';

/** Hides its children unless the caller holds `permission`. */
export function Can({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) return null;
  return <>{children}</>;
}
