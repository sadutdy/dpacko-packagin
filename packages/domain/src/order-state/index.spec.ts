import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors.js';
import { Role } from '../auth/permissions.js';
import {
  OrderState,
  allowedTransitions,
  assertTransition,
  isOrderState,
  isTerminal,
  isTransitionAllowed,
  nextStates,
} from './index.js';

describe('order state machine', () => {
  it('recognises valid states', () => {
    expect(isOrderState('placed')).toBe(true);
    expect(isOrderState('nonsense')).toBe(false);
  });

  it('allows the happy path', () => {
    expect(isTransitionAllowed(OrderState.Draft, OrderState.Placed, Role.Customer)).toBe(true);
    expect(isTransitionAllowed(OrderState.Placed, OrderState.PaymentPending, Role.Customer)).toBe(
      true,
    );
    expect(isTransitionAllowed(OrderState.Placed, OrderState.Paid, Role.Admin)).toBe(true);
    expect(isTransitionAllowed(OrderState.Paid, OrderState.Planned, Role.Admin)).toBe(true);
    expect(isTransitionAllowed(OrderState.Planned, OrderState.InProduction, Role.Production)).toBe(
      true,
    );
    expect(isTransitionAllowed(OrderState.InProduction, OrderState.Qc, Role.Production)).toBe(true);
    expect(isTransitionAllowed(OrderState.Qc, OrderState.Ready, Role.Production)).toBe(true);
    expect(isTransitionAllowed(OrderState.Ready, OrderState.Dispatched, Role.Dispatcher)).toBe(
      true,
    );
    expect(isTransitionAllowed(OrderState.Dispatched, OrderState.Delivered, Role.Driver)).toBe(
      true,
    );
    expect(isTransitionAllowed(OrderState.Delivered, OrderState.Closed, Role.Finance)).toBe(true);
  });

  it('rejects illegal transitions with the correct code and allowed set', () => {
    try {
      assertTransition(OrderState.Delivered, OrderState.Dispatched, Role.Dispatcher);
      throw new Error('expected assertTransition to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      const domainError = error as DomainError;
      expect(domainError.code).toBe('INVALID_TRANSITION');
      expect(domainError.details).toMatchObject({ from: 'delivered', to: 'dispatched' });
      expect(Array.isArray(domainError.details?.allowedTransitions)).toBe(true);
    }
  });

  it('enforces role guards', () => {
    expect(isTransitionAllowed(OrderState.Draft, OrderState.Placed, Role.Admin)).toBe(true);
    expect(isTransitionAllowed(OrderState.Draft, OrderState.Placed, Role.Production)).toBe(false);
    expect(isTransitionAllowed(OrderState.Ready, OrderState.Dispatched, Role.Driver)).toBe(false);
    expect(isTransitionAllowed(OrderState.Dispatched, OrderState.Delivered, Role.Dispatcher)).toBe(
      false,
    );
  });

  it('supports the qc rework loop', () => {
    expect(isTransitionAllowed(OrderState.Qc, OrderState.InProduction, Role.Production)).toBe(true);
    expect(isTransitionAllowed(OrderState.Qc, OrderState.Ready, Role.Production)).toBe(true);
    expect(isTransitionAllowed(OrderState.Qc, OrderState.Cancelled, Role.Production)).toBe(true);
  });

  it('treats closed and cancelled orders as immutable', () => {
    expect(isTerminal(OrderState.Closed)).toBe(true);
    expect(isTerminal(OrderState.Cancelled)).toBe(true);
    expect(isTransitionAllowed(OrderState.Closed, OrderState.Placed, Role.Admin)).toBe(false);
    expect(nextStates(OrderState.Closed)).toEqual([]);
  });

  it('allows a customer to cancel a placed order but not a paid one', () => {
    expect(isTransitionAllowed(OrderState.Placed, OrderState.Cancelled, Role.Customer)).toBe(true);
    expect(isTransitionAllowed(OrderState.Paid, OrderState.Cancelled, Role.Customer)).toBe(false);
  });

  it('exposes wildcard reschedule transitions to delivery roles', () => {
    expect(isTransitionAllowed(OrderState.Dispatched, OrderState.Rescheduled, Role.Driver)).toBe(
      true,
    );
    expect(isTransitionAllowed(OrderState.Dispatched, OrderState.Rescheduled, Role.Customer)).toBe(
      false,
    );
  });

  it('returns a de-duplicated allowed transition list', () => {
    const allowed = allowedTransitions(OrderState.Qc, Role.Production);
    expect(new Set(allowed).size).toBe(allowed.length);
    expect(allowed).toContain(OrderState.Ready);
  });
});
