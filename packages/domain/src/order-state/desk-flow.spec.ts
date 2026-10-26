import { describe, expect, it } from 'vitest';

import {
  DESK_STEPS,
  DeskStep,
  deskProgress,
  deskStepsCompleted,
  isDeskStep,
  nextDeskStep,
} from './desk-flow.js';

function events(...steps: string[]): { step: string }[] {
  return steps.map((step) => ({ step, at: '2026-01-01T05:00:00.000Z' }));
}

describe('desk flow', () => {
  it('walks the ladder one step at a time', () => {
    expect(nextDeskStep([])).toBe(DeskStep.Checked);
    expect(nextDeskStep(events('checked'))).toBe(DeskStep.Confirmed);
    expect(
      nextDeskStep(events('checked', 'confirmed', 'packing_notified', 'accounts_notified', 'bill_prepared', 'bill_ready')),
    ).toBe(DeskStep.Printed);
    expect(nextDeskStep(events(...DESK_STEPS))).toBeNull();
  });

  it('ignores unknown steps when computing progress', () => {
    const done = deskStepsCompleted([...events('checked'), { step: 'banana' }]);
    expect(done).toEqual([DeskStep.Checked]);
    expect(nextDeskStep(events('checked', 'banana'))).toBe(DeskStep.Confirmed);
  });

  it('reports every step with its recorded metadata', () => {
    const progress = deskProgress([
      { step: DeskStep.Checked, by: 'u1', at: '2026-01-01T05:30:00.000Z', note: 'set' },
    ]);
    expect(progress).toHaveLength(DESK_STEPS.length);
    expect(progress[0]).toMatchObject({ step: DeskStep.Checked, done: true, by: 'u1' });
    expect(progress[1]).toMatchObject({ step: DeskStep.Confirmed, done: false });
    expect(isDeskStep('printed')).toBe(true);
    expect(isDeskStep('printed_twice')).toBe(false);
  });
});
