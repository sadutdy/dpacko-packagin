import type { DocumentSeller, QuoteDocument } from '@ameen/domain';

import type { CoreDraft, CustomerOption, FieldErrors, SkuOption } from './core.js';

export type DraftUpdate<D> = Partial<D> | ((draft: D) => D);

export interface EditorContext {
  customer: CustomerOption | null;
  setCustomer: (customer: CustomerOption | null) => void;
  seller: DocumentSeller | null;
  /** Live preview document (null until the seller profile loads). */
  doc: QuoteDocument | null;
  /** Quote/invoice number; null until the document is saved. */
  documentNumber: string | null;
  skus: SkuOption[];
  /** Re-applies price rules to a catalog line's rate. */
  resetRate: (lineKey: string) => void;
  goTo: (stepId: string) => void;
}

export interface StepProps<D extends CoreDraft = CoreDraft> {
  draft: D;
  update: (update: DraftUpdate<D>) => void;
  errors: FieldErrors;
  ctx: EditorContext;
}
