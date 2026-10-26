import { TermsEditor } from '../../../documents/editor/steps/TermsEditor.js';
import type { StepProps } from '../types.js';

export function InvoiceTermsStep({ draft, update }: StepProps) {
  return (
    <div className="space-y-6">
      <TermsEditor draft={draft} update={update} emptyHint="No terms yet. Printed above the declaration." />
    </div>
  );
}
