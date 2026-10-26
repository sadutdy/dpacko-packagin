import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors.js';
import {
  DelegationAction,
  assertDelegation,
  findDelegation,
  isDelegated,
  type DelegationEntry,
} from './delegation.js';

const MATRIX: DelegationEntry[] = [
  { role: 'admin', action: DelegationAction.PriceApproval, limitPaise: null, limitQty: null, active: true },
  { role: 'office_admin', action: DelegationAction.IndentRequest, limitPaise: 2_500_000, limitQty: null, active: true },
  { role: 'office_admin', action: DelegationAction.PettyCashEntry, limitPaise: 500_000, limitQty: null, active: false },
];

describe('delegation-of-authority matrix', () => {
  it('finds the active entry for a role/action pair', () => {
    expect(findDelegation(MATRIX, 'office_admin', DelegationAction.IndentRequest)?.limitPaise).toBe(2_500_000);
    expect(findDelegation(MATRIX, 'office_admin', DelegationAction.PettyCashEntry)).toBeUndefined();
    expect(findDelegation(MATRIX, 'driver', DelegationAction.IndentRequest)).toBeUndefined();
  });

  it('passes within the money limit', () => {
    expect(() =>
      assertDelegation(MATRIX, 'office_admin', DelegationAction.IndentRequest, 2_500_000),
    ).not.toThrow();
  });

  it('throws LIMIT_EXCEEDED beyond the money limit', () => {
    try {
      assertDelegation(MATRIX, 'office_admin', DelegationAction.IndentRequest, 2_500_001);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('LIMIT_EXCEEDED');
      expect((error as DomainError).details).toEqual({ amountPaise: 2_500_001, limitPaise: 2_500_000 });
    }
  });

  it('treats a missing entry as NOT_DELEGATED', () => {
    expect(() =>
      assertDelegation(MATRIX, 'office_admin', DelegationAction.InvoiceApproval, 1),
    ).toThrow(/No delegation entry/);
  });

  it('ignores inactive entries', () => {
    expect(isDelegated(MATRIX, 'office_admin', DelegationAction.PettyCashEntry, 100)).toBe(false);
  });

  it('allows unlimited entries for admin', () => {
    expect(isDelegated(MATRIX, 'admin', DelegationAction.PriceApproval, 99_00_00_00)).toBe(true);
  });

  it('skips the amount check when no amount is supplied', () => {
    expect(() =>
      assertDelegation(MATRIX, 'office_admin', DelegationAction.IndentRequest),
    ).not.toThrow();
  });
});
