import {
  applyPartyOverride,
  buildInvoiceDocument,
  EMPTY_DISPATCH,
  partyFromCustomer,
  resolvePartyState,
  type CopyKind,
  type CustomerLike,
  type DocumentParty,
  type DocumentSeller,
  type InvoiceDispatch,
  type InvoiceDocument,
  type InvoiceTitle,
} from '@ameen/domain';

import {
  cleanTerms,
  dayToIso,
  EMPTY_OVERRIDE,
  isGstin,
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
  type PartyOverrideDraft,
} from '../../documents/editor/core.js';
import { isInvoiceLayoutId, type InvoiceLayoutId } from '../../documents/invoice-layouts/index.js';

export const INVOICE_EDITABLE_STATUSES = ['unpaid', 'overdue', 'cancelled'] as const;
export type InvoiceEditableStatus = (typeof INVOICE_EDITABLE_STATUSES)[number];

export interface ShipToDraft extends PartyOverrideDraft {
  enabled: boolean;
}

export interface InvoiceDraft extends CoreDraft {
  orderId: string | null;
  quoteId: string | null;
  issueDate: string;
  dueDate: string;
  status: InvoiceEditableStatus;
  title: InvoiceTitle;
  layout: InvoiceLayoutId;
  copies: CopyKind[];
  reverseCharge: boolean;
  buyerOrderNo: string;
  buyerOrderDate: string;
  dispatch: InvoiceDispatch;
  shipTo: ShipToDraft;
}

/** Editable invoice as returned by `GET /payments/invoices/:id/editable`. */
export interface EditableInvoice {
  _id: string;
  invoiceNumber: string;
  editable: boolean;
  customerId: string;
  orderId: string | null;
  quoteId: string | null;
  issueDate: string;
  dueDate: string | null;
  status: string;
  title: InvoiceTitle;
  layout: string;
  copies: CopyKind[];
  reverseCharge: boolean;
  buyerOrderNo: string;
  buyerOrderDate: string | null;
  dispatch: InvoiceDispatch;
  partyOverride: OverridePayload;
  shipTo: OverridePayload & { enabled: boolean };
  terms: string[];
  notes: string;
  items: LinePayload[];
}

/** The subset of an editable quote an invoice is raised from. */
export interface QuoteSource {
  _id: string;
  quoteNumber: string;
  customerId: string;
  refNo: string;
  partyOverride: OverridePayload;
  terms: string[];
  notes: string;
  items: LinePayload[];
}

const LAYOUT_KEY = 'ameen-invoice-layout';

export function lastUsedInvoiceLayout(): InvoiceLayoutId {
  try {
    const stored = localStorage.getItem(LAYOUT_KEY);
    return isInvoiceLayoutId(stored) ? stored : 'tally';
  } catch {
    return 'tally';
  }
}

export function rememberInvoiceLayout(layout: InvoiceLayoutId): void {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

export function emptyInvoiceDraft(layout: InvoiceLayoutId): InvoiceDraft {
  return {
    customerId: '',
    orderId: null,
    quoteId: null,
    issueDate: isoDay(),
    dueDate: isoDay(15),
    status: 'unpaid',
    title: 'Tax Invoice',
    layout,
    copies: ['original'],
    reverseCharge: false,
    buyerOrderNo: '',
    buyerOrderDate: '',
    dispatch: { ...EMPTY_DISPATCH },
    partyOverride: { ...EMPTY_OVERRIDE },
    shipTo: { ...EMPTY_OVERRIDE, enabled: false },
    terms: [],
    notes: '',
    lines: [newLine()],
  };
}

const toDay = (iso: string | null) => (iso ? isoDay(0, new Date(iso)) : '');

export function draftFromInvoice(invoice: EditableInvoice): InvoiceDraft {
  return {
    customerId: invoice.customerId,
    orderId: invoice.orderId,
    quoteId: invoice.quoteId,
    issueDate: toDay(invoice.issueDate),
    dueDate: toDay(invoice.dueDate),
    status: (INVOICE_EDITABLE_STATUSES as readonly string[]).includes(invoice.status) ? (invoice.status as InvoiceEditableStatus) : 'unpaid',
    title: invoice.title,
    layout: isInvoiceLayoutId(invoice.layout) ? invoice.layout : 'tally',
    copies: invoice.copies.length > 0 ? invoice.copies : ['original'],
    reverseCharge: invoice.reverseCharge,
    buyerOrderNo: invoice.buyerOrderNo,
    buyerOrderDate: toDay(invoice.buyerOrderDate),
    dispatch: { ...EMPTY_DISPATCH, ...invoice.dispatch },
    partyOverride: overrideFromPayload(invoice.partyOverride),
    shipTo: { ...overrideFromPayload(invoice.shipTo), enabled: invoice.shipTo.enabled },
    terms: [...invoice.terms],
    notes: invoice.notes,
    lines: linesFromPayload(invoice.items),
  };
}

/** New invoice pre-filled from a quote: buyer, overrides, lines and terms. */
export function draftFromQuoteSource(quote: QuoteSource, layout: InvoiceLayoutId): InvoiceDraft {
  return {
    ...emptyInvoiceDraft(layout),
    customerId: quote.customerId,
    quoteId: quote._id,
    buyerOrderNo: quote.refNo,
    partyOverride: overrideFromPayload(quote.partyOverride),
    terms: [...quote.terms],
    notes: quote.notes,
    lines: linesFromPayload(quote.items),
  };
}

function trimDispatch(dispatch: InvoiceDispatch): InvoiceDispatch {
  return Object.fromEntries(Object.entries(dispatch).map(([key, value]) => [key, value.trim()])) as unknown as InvoiceDispatch;
}

/** Body for `POST /payments/invoices` and `PUT /payments/invoices/:id`. */
export function draftToPayload(draft: InvoiceDraft) {
  return {
    customerId: draft.customerId,
    orderId: draft.orderId,
    quoteId: draft.quoteId,
    issueDate: draft.issueDate || null,
    dueDate: draft.dueDate || null,
    status: draft.status,
    title: draft.title,
    layout: draft.layout,
    copies: draft.copies,
    reverseCharge: draft.reverseCharge,
    buyerOrderNo: draft.buyerOrderNo.trim(),
    buyerOrderDate: draft.buyerOrderDate || null,
    dispatch: trimDispatch(draft.dispatch),
    partyOverride: overrideToPayload(draft.partyOverride),
    shipTo: { ...overrideToPayload(draft.shipTo), enabled: draft.shipTo.enabled },
    terms: cleanTerms(draft.terms),
    notes: draft.notes.trim(),
    items: linesToPayload(draft.lines),
  };
}

/** Consignee for the preview; mirrors the API (blank fields fall back to the buyer). */
function shipToParty(draft: InvoiceDraft, buyer: DocumentParty): DocumentParty | null {
  if (!draft.shipTo.enabled) return null;
  const ship = overrideToPayload(draft.shipTo);
  return {
    name: ship.name || buyer.name,
    addressLines: ship.addressLines.length > 0 ? ship.addressLines : buyer.addressLines,
    phone: ship.phone,
    gstin: ship.gstin,
    stateName: ship.stateName || (ship.addressLines.length > 0 ? '' : buyer.stateName),
    stateCode: '',
  };
}

export function draftToDocument(
  draft: InvoiceDraft,
  seller: DocumentSeller,
  customer: CustomerLike | null,
  meta: { id: string; number: string },
): InvoiceDocument {
  const buyer = resolvePartyState(applyPartyOverride(customer ? partyFromCustomer(customer) : NO_CUSTOMER, overrideToPayload(draft.partyOverride)));
  return buildInvoiceDocument({
    quote: {
      id: meta.id,
      number: meta.number,
      date: dayToIso(draft.issueDate) ?? new Date().toISOString(),
      status: draft.status,
      title: draft.title,
      layout: draft.layout,
      terms: cleanTerms(draft.terms),
      notes: draft.notes.trim(),
    },
    seller,
    party: buyer,
    lines: previewLines(draft.lines),
    invoice: {
      dueDate: dayToIso(draft.dueDate),
      reverseCharge: draft.reverseCharge,
      buyerOrderNo: draft.buyerOrderNo.trim(),
      buyerOrderDate: dayToIso(draft.buyerOrderDate),
      dispatch: trimDispatch(draft.dispatch),
      shipTo: shipToParty(draft, buyer),
      copies: draft.copies,
    },
  });
}

/** Field errors for one invoice step. */
export function validateStep(step: string, draft: InvoiceDraft): FieldErrors {
  const errors = validateCore(step, draft);
  if (step === 'party' && draft.shipTo.enabled) {
    const gstin = draft.shipTo.gstin.trim();
    if (gstin && !isGstin(gstin)) errors['shipTo.gstin'] = 'Not a valid GSTIN.';
  }
  if (step === 'details') {
    if (!draft.issueDate) errors.issueDate = 'Pick the invoice date.';
    if (draft.dueDate && draft.issueDate && draft.dueDate < draft.issueDate) errors.dueDate = 'Must be on or after the invoice date.';
    if (draft.copies.length === 0) errors.copies = 'Print at least one copy.';
  }
  if (step === 'dispatch') {
    const eway = draft.dispatch.ewayBillNo.replace(/\s/g, '');
    if (eway && !/^\d{12}$/.test(eway)) errors.ewayBillNo = 'e-Way bill numbers have 12 digits.';
  }
  return errors;
}
