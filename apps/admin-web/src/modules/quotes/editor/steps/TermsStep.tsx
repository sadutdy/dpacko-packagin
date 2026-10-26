import { advance } from '@ameen/domain';

import { money } from '../../../documents/format.js';
import { FormField } from '../../../documents/editor/FormField.js';
import { TermsEditor } from '../../../documents/editor/steps/TermsEditor.js';
import type { StepProps } from '../types.js';

export function TermsStep({ draft, update, errors, ctx }: StepProps) {
  const preview = ctx.doc && draft.advancePct > 0 ? advance(ctx.doc.totals.grandTotalPaise, draft.advancePct) : null;

  return (
    <div className="space-y-6">
      <FormField
        label="Advance requested"
        error={errors.advancePct}
        hint={preview ? `${money(preview.exactPaise)} → ${money(preview.advancePaise)} after rounding to ₹1,000.` : 'Set 0 to hide the advance section.'}
      >
        <span className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.advancePct}
            onChange={(e) => update({ advancePct: Number(e.target.value) })}
            className="flex-1 accent-[var(--app-accent)]"
            aria-label="Advance percent"
          />
          <input
            className="field w-20"
            type="number"
            min={0}
            max={100}
            value={draft.advancePct}
            onChange={(e) => update({ advancePct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
          />
          <span className="text-sm text-app-muted">%</span>
        </span>
      </FormField>

      <TermsEditor draft={draft} update={update} emptyHint="No terms yet. Modern prints sensible defaults when this is empty." />
    </div>
  );
}
