import { Chip, FormField } from '../FormField.js';
import { TERM_PRESETS, type CoreDraft } from '../core.js';
import type { StepProps } from '../types.js';

/** Ordered terms list with presets, plus free-text remarks. */
export function TermsEditor<D extends CoreDraft>({ draft, update, emptyHint }: Pick<StepProps<D>, 'draft' | 'update'> & { emptyHint?: string }) {
  const terms = draft.terms;
  const setTerms = (next: (current: string[]) => string[]) => update((d) => ({ ...d, terms: next(d.terms) }));

  return (
    <>
      <div>
        <span className="section-label mb-2 block">Terms &amp; conditions</span>
        {terms.length === 0 && <p className="mb-2 text-xs text-app-faint">{emptyHint ?? 'No terms yet.'}</p>}
        <ol className="space-y-2">
          {terms.map((term, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-1.5 w-5 text-right text-xs text-app-faint">{index + 1}.</span>
              <textarea
                className="field flex-1"
                rows={1}
                value={term}
                onChange={(e) => setTerms((current) => current.map((entry, i) => (i === index ? e.target.value : entry)))}
              />
              <span className="flex flex-col gap-1">
                <button
                  type="button"
                  className="btn-small"
                  aria-label="Move term up"
                  disabled={index === 0}
                  onClick={() =>
                    setTerms((current) => {
                      const next = [...current];
                      [next[index - 1], next[index]] = [next[index] ?? '', next[index - 1] ?? ''];
                      return next;
                    })
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-small-danger"
                  aria-label="Remove term"
                  onClick={() => setTerms((current) => current.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
        <button type="button" className="btn-secondary mt-3" onClick={() => setTerms((current) => [...current, ''])}>
          + Add term
        </button>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TERM_PRESETS.filter((preset) => !terms.includes(preset)).map((preset) => (
            <Chip key={preset} title="Add this term" onClick={() => setTerms((current) => [...current, preset])}>
              + {preset.length > 42 ? `${preset.slice(0, 40)}…` : preset}
            </Chip>
          ))}
        </div>
      </div>

      <FormField label="Remarks" hint="Printed as “Remarks:” below the terms.">
        <textarea className="field" rows={3} value={draft.notes} onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))} />
      </FormField>
    </>
  );
}
