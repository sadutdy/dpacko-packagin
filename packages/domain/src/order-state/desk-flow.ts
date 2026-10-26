/**
 * Sales Order Desk ladder (Module 2). An append-only parallel workflow that
 * runs on an order while it moves through the OMS state machine: the office
 * checks, confirms, notifies packing/accounts, prepares and prints bills,
 * records extra quantities, verifies dispatch documents, confirms delivery and
 * finally books the day's collections. Steps are logged with who/when.
 */

export const DeskStep = {
  Checked: 'checked',
  Confirmed: 'confirmed',
  PackingNotified: 'packing_notified',
  AccountsNotified: 'accounts_notified',
  BillPrepared: 'bill_prepared',
  BillReady: 'bill_ready',
  Printed: 'printed',
  ExtraQtyRecorded: 'extra_qty_recorded',
  DispatchDocsChecked: 'dispatch_docs_checked',
  DeliveryConfirmed: 'delivery_confirmed',
  ExtraQtySoldCheck: 'extra_qty_sold_check',
  CollectionsUpdated: 'collections_updated',
} as const;

export type DeskStep = (typeof DeskStep)[keyof typeof DeskStep];

export const DESK_STEPS: readonly DeskStep[] = [
  DeskStep.Checked,
  DeskStep.Confirmed,
  DeskStep.PackingNotified,
  DeskStep.AccountsNotified,
  DeskStep.BillPrepared,
  DeskStep.BillReady,
  DeskStep.Printed,
  DeskStep.ExtraQtyRecorded,
  DeskStep.DispatchDocsChecked,
  DeskStep.DeliveryConfirmed,
  DeskStep.ExtraQtySoldCheck,
  DeskStep.CollectionsUpdated,
];

/** Groups receiving a message when each step is performed. */
export const STEP_AUDIENCE: Record<DeskStep, readonly ('packing' | 'accounts' | 'sales' | 'office')[]> = {
  [DeskStep.Checked]: ['office'],
  [DeskStep.Confirmed]: ['packing', 'accounts', 'sales'],
  [DeskStep.PackingNotified]: ['packing'],
  [DeskStep.AccountsNotified]: ['accounts'],
  [DeskStep.BillPrepared]: ['accounts'],
  [DeskStep.BillReady]: ['accounts', 'office'],
  [DeskStep.Printed]: ['accounts', 'office'],
  [DeskStep.ExtraQtyRecorded]: ['packing', 'office'],
  [DeskStep.DispatchDocsChecked]: ['sales'],
  [DeskStep.DeliveryConfirmed]: ['sales'],
  [DeskStep.ExtraQtySoldCheck]: ['packing', 'office'],
  [DeskStep.CollectionsUpdated]: ['sales', 'office'],
};

export interface DeskEvent {
  step: DeskStep | string;
  by?: string;
  at?: string;
  note?: string;
}

/** The steps already recorded for an order, newest last. */
export function deskStepsCompleted(events: readonly DeskEvent[]): DeskStep[] {
  return events
    .map((event) => DESK_STEPS.find((step) => step === event.step))
    .filter((step): step is DeskStep => step !== undefined);
}

/** Returns the next step the order desk must perform, or null when done. */
export function nextDeskStep(events: readonly DeskEvent[]): DeskStep | null {
  const done = new Set(deskStepsCompleted(events));
  return DESK_STEPS.find((step) => !done.has(step)) ?? null;
}

/** Describes the desk's progress for UI rendering. */
export function deskProgress(events: readonly DeskEvent[]): { step: DeskStep; done: boolean; at?: string; by?: string; note?: string }[] {
  const byStep = new Map(events.map((event) => [event.step, event]));
  return DESK_STEPS.map((step) => {
    const event = byStep.get(step);
    return {
      step,
      done: event !== undefined,
      at: event?.at,
      by: event?.by,
      note: event?.note,
    };
  });
}

export function isDeskStep(value: unknown): value is DeskStep {
  return typeof value === 'string' && (DESK_STEPS as readonly string[]).includes(value);
}
