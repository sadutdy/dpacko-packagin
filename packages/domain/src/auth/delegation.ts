import { DomainError, DomainErrorCode } from '../errors.js';

/**
 * Delegation-of-authority checker — pure functions over a configurable matrix
 * of approval limits. Storage lives in the API's `delegation_matrix`
 * collection; the client renders the same decisions by importing these helpers.
 */

export interface DelegationEntry {
  role: string;
  action: string;
  /** Null = unlimited money limit. */
  limitPaise: number | null;
  /** Null = unlimited quantity limit. */
  limitQty: number | null;
  active: boolean;
}

export const DelegationAction = {
  IndentRequest: 'indent_request',
  ProductionRequest: 'production_request',
  PettyCashEntry: 'petty_cash_entry',
  PriceApproval: 'price_approval',
  InvoiceApproval: 'invoice_approval',
  DocumentRemoval: 'document_removal',
} as const;

export type DelegationAction = (typeof DelegationAction)[keyof typeof DelegationAction];

/** Errors an unauthorized audit trail can classify. */
export const DelegationErrorCode = {
  NOT_DELEGATED: 'NOT_DELEGATED',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
} as const;

export type DelegationErrorCode = (typeof DelegationErrorCode)[keyof typeof DelegationErrorCode];

/** Returns the active delegation entry for a role+action pair, if any. */
export function findDelegation(
  entries: readonly DelegationEntry[],
  role: string,
  action: string,
): DelegationEntry | undefined {
  return entries.find(
    (entry) => entry.role === role && entry.action === action && entry.active,
  );
}

/**
 * Asserts that `role` holds a delegation for `action`,
 * with `amountPaise`/`quantity` inside its limits when the entry sets them.
 */
export function assertDelegation(
  entries: readonly DelegationEntry[],
  role: string,
  action: string,
  amountPaise?: number,
  quantity?: number,
): void {
  const entry = findDelegation(entries, role, action);
  if (!entry) {
    throw new DomainError(
      DomainErrorCode.NOT_DELEGATED,
      'No delegation entry grants this role authority for this action',
    );
  }
  if (amountPaise !== undefined && entry.limitPaise !== null && amountPaise > entry.limitPaise) {
    throw new DomainError(
      DomainErrorCode.LIMIT_EXCEEDED,
      `Amount exceeds the ${action} limit for this role`,
      { amountPaise, limitPaise: entry.limitPaise },
    );
  }
  if (quantity !== undefined && entry.limitQty !== null && quantity > entry.limitQty) {
    throw new DomainError(
      DomainErrorCode.LIMIT_EXCEEDED,
      `Quantity exceeds the ${action} limit for this role`,
      { quantity, limitQty: entry.limitQty },
    );
  }
}

/** True when the role holds the delegation (never throws). */
export function isDelegated(
  entries: readonly DelegationEntry[],
  role: string,
  action: string,
  amountPaise?: number,
): boolean {
  try {
    assertDelegation(entries, role, action, amountPaise);
    return true;
  } catch {
    return false;
  }
}
