import {
  applyPartyOverride,
  buildQuoteDocument,
  DEFAULT_PRESENTATION,
  partyFromCustomer,
  type CustomerLike,
  type DocumentSeller,
  type QuoteDocument,
  type QuoteTitle,
} from '@ameen/domain';

import {
  cleanTerms,
  dayToIso,
  EMPTY_OVERRIDE,
  isoDay,
  linesFromPayload,
  linesToPayload,
  newLine,
  NO_CUSTOMER,
  overrideFromPayload,
  overrideToPayload,
  previewLines,
  validateCore,
  type CoreDraft,
  type FieldErrors,
  type LinePayload,
  type OverridePayload,
} from '../../documents/editor/core.js';
import type { LayoutId } from '../../documents/layouts/index.js';

// Shared editor model, re-exported so quote steps keep one import path.
export * from '../../documents/editor/core.js';

export const EDITABLE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
export type EditableStatus = (typeof EDITABLE_STATUSES)[number];

export interface QuoteDraft extends CoreDraft {
  refNo: string;
  issueDate: string;
  validUntil: string;
  status: EditableStatus;
  title: QuoteTitle;
  layout: LayoutId;
  advancePct: number;
}

/** Editable quote as returned by `GET /orders/quotes/:id`. */
export interface EditableQuote {
  _id: string;
  quoteNumber: string;
  customerId: string;
  refNo: string;
  issueDate: string;
  validUntil: string | null;
  status: string;
  title: QuoteTitle;
  layout: string;
  advancePct: number;
  partyOverride: OverridePayload;
  terms: string[];
  notes: string;
  items: LinePayload[];
}

export function emptyDraft(layout: LayoutId): QuoteDraft {
  return {
    customerId: '',
    refNo: '',
    issueDate: isoDay(),
    validUntil: isoDay(14),
    status: 'draft',
    title: 'Proforma Invoice',
    layout,
    advancePct: DEFAULT_PRESENTATION.advancePct,
    partyOverride: { ...EMPTY_OVERRIDE },
    terms: [],
    notes: '',
    lines: [newLine()],
  };
}

export function draftFromQuote(quote: EditableQuote, isLayout: (value: string) => value is LayoutId): QuoteDraft {
  return {
    customerId: quote.customerId,
    refNo: quote.refNo,
    issueDate: isoDay(0, new Date(quote.issueDate)),
    validUntil: quote.validUntil ? isoDay(0, new Date(quote.validUntil)) : '',
    status: (EDITABLE_STATUSES as readonly string[]).includes(quote.status) ? (quote.status as EditableStatus) : 'draft',
    title: quote.title,
    layout: isLayout(quote.layout) ? quote.layout : 'classic',
    advancePct: quote.advancePct,
    partyOverride: overrideFromPayload(quote.partyOverride),
    terms: [...quote.terms],
    notes: quote.notes,
    lines: linesFromPayload(quote.items),
  };
}

/** Body for `POST /orders/quotes` and `PUT /orders/quotes/:id`. */
export function draftToPayload(draft: QuoteDraft) {
  return {
    customerId: draft.customerId,
    refNo: draft.refNo.trim(),
    issueDate: draft.issueDate || null,
    validUntil: draft.validUntil || null,
    status: draft.status,
    title: draft.title,
    layout: draft.layout,
    advancePct: draft.advancePct,
    partyOverride: overrideToPayload(draft.partyOverride),
    terms: cleanTerms(draft.terms),
    notes: draft.notes.trim(),
    items: linesToPayload(draft.lines),
  };
}

/** Live preview document, built with the same domain builder as the API. */
export function draftToDocument(
  draft: QuoteDraft,
  seller: DocumentSeller,
  customer: CustomerLike | null,
  meta: { id: string; number: string },
): QuoteDocument {
  return buildQuoteDocument({
    quote: {
      id: meta.id,
      number: meta.number,
      refNo: draft.refNo.trim(),
      date: dayToIso(draft.issueDate) ?? new Date().toISOString(),
      validUntil: dayToIso(draft.validUntil),
      status: draft.status,
      title: draft.title,
      layout: draft.layout,
      advancePct: draft.advancePct,
      terms: cleanTerms(draft.terms),
      notes: draft.notes.trim(),
    },
    seller,
    party: applyPartyOverride(customer ? partyFromCustomer(customer) : NO_CUSTOMER, overrideToPayload(draft.partyOverride)),
    lines: previewLines(draft.lines),
  });
}

/** Field errors for one quote step. */
export function validateStep(step: string, draft: QuoteDraft): FieldErrors {
  const errors = validateCore(step, draft);
  if (step === 'details') {
    if (!draft.issueDate) errors.issueDate = 'Pick the quote date.';
    if (draft.validUntil && draft.issueDate && draft.validUntil < draft.issueDate) errors.validUntil = 'Must be on or after the quote date.';
  }
  if (step === 'terms' && (draft.advancePct < 0 || draft.advancePct > 100)) errors.advancePct = '0–100%.';
  return errors;
}
