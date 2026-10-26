import { DomainError, DomainErrorCode } from '../errors.js';
import { Role } from '../auth/permissions.js';

/**
 * The OMS order state machine. Pure functions only — no I/O, no Mongoose — so the
 * client can render a valid action set and the server stays authoritative.
 */

export const OrderState = {
  Draft: 'draft',
  Placed: 'placed',
  PaymentPending: 'payment_pending',
  Paid: 'paid',
  Planned: 'planned',
  InProduction: 'in_production',
  Qc: 'qc',
  Ready: 'ready',
  Dispatched: 'dispatched',
  Delivered: 'delivered',
  Closed: 'closed',
  Cancelled: 'cancelled',
  OnHold: 'on_hold',
  Rescheduled: 'rescheduled',
} as const;

export type OrderState = (typeof OrderState)[keyof typeof OrderState];

export const ORDER_STATES: readonly OrderState[] = Object.values(OrderState);

export function isOrderState(value: unknown): value is OrderState {
  return typeof value === 'string' && (ORDER_STATES as readonly string[]).includes(value);
}

/** A delivery-level reschedule is not an order state in the same sense, but the
 * transition table models it, so it is kept here for completeness. */
export const TERMINAL_STATES: readonly OrderState[] = [OrderState.Closed, OrderState.Cancelled];

export interface OrderTransition {
  from: OrderState | '*';
  to: OrderState;
  trigger: string;
  roles: readonly Role[];
  guard: string;
}

export const ORDER_TRANSITIONS: readonly OrderTransition[] = [
  {
    from: OrderState.Draft,
    to: OrderState.Placed,
    trigger: 'customer.submit',
    roles: [Role.Customer, Role.Admin],
    guard: 'items non-empty; stock availability not required yet',
  },
  {
    from: OrderState.Placed,
    to: OrderState.PaymentPending,
    trigger: 'razorpay.create_order',
    roles: [Role.Customer, Role.Admin],
    guard: 'payment method is razorpay',
  },
  {
    from: OrderState.Placed,
    to: OrderState.Paid,
    trigger: 'cod.approve / credit.grant',
    roles: [Role.Admin, Role.Finance],
    guard: 'credit limit not exceeded and no open overdues',
  },
  {
    from: OrderState.Placed,
    to: OrderState.Cancelled,
    trigger: 'customer/admin cancel',
    roles: [Role.Customer, Role.Admin],
    guard: 'before dispatch',
  },
  {
    from: OrderState.PaymentPending,
    to: OrderState.Paid,
    trigger: 'payment.captured webhook',
    roles: [],
    guard: 'idempotency: eventId not seen',
  },
  {
    from: OrderState.PaymentPending,
    to: OrderState.Placed,
    trigger: 'payment.failed webhook',
    roles: [],
    guard: 'none',
  },
  {
    from: OrderState.Placed,
    to: OrderState.Cancelled,
    trigger: 'admin delete',
    roles: [Role.Admin],
    guard: 'reason required; inventory released',
  },
  {
    from: OrderState.PaymentPending,
    to: OrderState.Cancelled,
    trigger: 'admin delete',
    roles: [Role.Admin],
    guard: 'reason required; inventory released',
  },
  {
    from: OrderState.Paid,
    to: OrderState.Planned,
    trigger: 'planner success',
    roles: [Role.Admin, Role.Production],
    guard: 'materials reserved or shortage raised as a PO',
  },
  {
    from: OrderState.Paid,
    to: OrderState.OnHold,
    trigger: 'admin.hold',
    roles: [Role.Admin],
    guard: 'reason required',
  },
  {
    from: OrderState.Paid,
    to: OrderState.Cancelled,
    trigger: 'admin cancel',
    roles: [Role.Admin],
    guard: 'reason required; refund issued; inventory released',
  },
  {
    from: OrderState.OnHold,
    to: OrderState.Paid,
    trigger: 'admin.resolve',
    roles: [Role.Admin, Role.Inventory],
    guard: 'reason required',
  },
  {
    from: OrderState.Planned,
    to: OrderState.InProduction,
    trigger: 'station.start',
    roles: [Role.Production],
    guard: 'job exists',
  },
  {
    from: OrderState.Planned,
    to: OrderState.Cancelled,
    trigger: 'admin cancel',
    roles: [Role.Admin],
    guard: 'reason required; job cancelled; material released; refund issued',
  },
  {
    from: OrderState.InProduction,
    to: OrderState.Qc,
    trigger: 'job.complete',
    roles: [Role.Production],
    guard: 'completed qty > 0',
  },
  {
    from: OrderState.InProduction,
    to: OrderState.Cancelled,
    trigger: 'admin cancel',
    roles: [Role.Admin],
    guard: 'reason required; job cancelled; material released; refund issued',
  },
  {
    from: OrderState.Qc,
    to: OrderState.Ready,
    trigger: 'qc.pass',
    roles: [Role.Production],
    guard: 'all required checks pass',
  },
  {
    from: OrderState.Qc,
    to: OrderState.InProduction,
    trigger: 'qc.fail.rework',
    roles: [Role.Production],
    guard: 'rework count < limit',
  },
  {
    from: OrderState.Qc,
    to: OrderState.Cancelled,
    trigger: 'qc.reject',
    roles: [Role.Production, Role.Admin],
    guard: 'rework count exhausted; wastage recorded; refund/credit note',
  },
  {
    from: OrderState.Ready,
    to: OrderState.Dispatched,
    trigger: 'dispatcher.assign',
    roles: [Role.Dispatcher, Role.Admin],
    guard: 'driver and vehicle available',
  },
  {
    from: OrderState.Dispatched,
    to: OrderState.Delivered,
    trigger: 'driver.pod',
    roles: [Role.Driver],
    guard: 'POD complete (signature, photo or OTP)',
  },
  {
    from: OrderState.Delivered,
    to: OrderState.Closed,
    trigger: 'finance.reconcile',
    roles: [Role.Finance, Role.Admin],
    guard: 'payment settled or written off',
  },
  {
    from: '*',
    to: OrderState.Rescheduled,
    trigger: 'delivery.failed',
    roles: [Role.Dispatcher, Role.Driver, Role.Admin],
    guard: 'none',
  },
];

/** The transitions defined for a state, ignoring the wildcard `*` entry. */
export function transitionsFrom(from: OrderState): readonly OrderTransition[] {
  return ORDER_TRANSITIONS.filter((transition) => transition.from === from);
}

/** Every state reachable from `from`, regardless of role. */
export function nextStates(from: OrderState): OrderState[] {
  const direct = transitionsFrom(from).map((transition) => transition.to);
  const wildcard = isTerminal(from)
    ? []
    : ORDER_TRANSITIONS.filter((t) => t.from === '*').map((t) => t.to);
  return [...new Set([...direct, ...wildcard])];
}

/** The states reachable from `from` for a given role. */
export function allowedTransitions(from: OrderState, role: Role): OrderState[] {
  const allowed = transitionsFrom(from)
    .filter((transition) => transition.roles.includes(role))
    .map((transition) => transition.to);

  const wildcard = isTerminal(from)
    ? []
    : ORDER_TRANSITIONS.filter((t) => t.from === '*' && t.roles.includes(role)).map((t) => t.to);

  return [...new Set([...allowed, ...wildcard])];
}

/** True when `role` may move an order from `from` to `to`. */
export function isTransitionAllowed(from: OrderState, to: OrderState, role: Role): boolean {
  return allowedTransitions(from, role).includes(to);
}

/**
 * Asserts a transition is legal for the role. Throws `DomainError` with
 * `INVALID_TRANSITION` and the allowed transitions in `details` otherwise, so the
 * UI can grey out invalid actions.
 */
export function assertTransition(from: OrderState, to: OrderState, role: Role): void {
  if (isTransitionAllowed(from, to, role)) return;

  const allowed = allowedTransitions(from, role);
  throw new DomainError(
    DomainErrorCode.INVALID_TRANSITION,
    `Cannot transition from '${from}' to '${to}'`,
    { from, to, role, allowedTransitions: allowed },
  );
}

/** True when the state is terminal (closed orders are immutable). */
export function isTerminal(state: OrderState): boolean {
  return TERMINAL_STATES.includes(state);
}
