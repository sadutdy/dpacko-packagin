const TONES: Record<string, string> = {
  paid: 'pill-good',
  delivered: 'pill-good',
  closed: 'pill-good',
  qc_pass: 'pill-good',
  ready: 'pill-good',

  placed: 'pill-attention',
  payment_pending: 'pill-attention',
  on_hold: 'pill-attention',
  rescheduled: 'pill-attention',
  qc_fail: 'pill-attention',
  rework: 'pill-attention',

  cancelled: 'pill-problem',
  qc_reject: 'pill-problem',

  planned: 'pill-active',
  in_production: 'pill-active',
  printing: 'pill-active',
} as const;

/* Extended statuses (tasks, priorities) → the same four semantic tones. */
const EXTENDED_TONES: Record<string, string> = {
  open: 'pill-attention',
  pending: 'pill-attention',
  medium: 'pill-attention',
  high: 'pill-attention',

  flagged: 'pill-problem',
  late: 'pill-problem',
  rejected: 'pill-problem',
  obsolete: 'pill-problem',
  critical: 'pill-problem',
  urgent: 'pill-problem',

  approved: 'pill-good',
  committed: 'pill-good',
  resolved: 'pill-good',
  reconciled: 'pill-good',

  in_progress: 'pill-active',
  submitted: 'pill-active',
  received: 'pill-active',
} as const;

/** Status value (snake_case or plain) → pill tone class. */
export function statusPillClass(status: string): string {
  return TONES[status] ?? EXTENDED_TONES[status] ?? 'pill-neutral';
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`pill ${statusPillClass(status)}`}>{status.replace(/_/g, ' ')}</span>;
}
