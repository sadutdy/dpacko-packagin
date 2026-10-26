/**
 * GST tax invoice document. Built on the quotation builder (same lines, tax
 * split, HSN summary, round-off and words) plus the blocks a tax invoice
 * carries: copy labels, ship-to, place of supply, reverse charge, buyer's
 * order and dispatch details, due date and balance.
 */
import { findGstState } from '../gst/states.js';
import {
  buildQuoteDocument,
  resolvePartyState,
  type DocumentParty,
  type QuoteDocument,
  type QuoteDocumentInput,
} from '../quote-document/index.js';

export const COPY_LABELS = {
  original: 'Original for Recipient',
  duplicate: 'Duplicate for Transporter',
  triplicate: 'Triplicate for Supplier',
} as const;
export type CopyKind = keyof typeof COPY_LABELS;
export const COPY_KINDS = Object.keys(COPY_LABELS) as CopyKind[];

export interface InvoiceDispatch {
  deliveryNote: string;
  paymentTerms: string;
  dispatchDocNo: string;
  dispatchedThrough: string;
  destination: string;
  vehicleNo: string;
  ewayBillNo: string;
  termsOfDelivery: string;
}

export const EMPTY_DISPATCH: InvoiceDispatch = {
  deliveryNote: '',
  paymentTerms: '',
  dispatchDocNo: '',
  dispatchedThrough: '',
  destination: '',
  vehicleNo: '',
  ewayBillNo: '',
  termsOfDelivery: '',
};

export interface InvoiceExtrasInput {
  dueDate?: string | null;
  reverseCharge?: boolean;
  buyerOrderNo?: string;
  buyerOrderDate?: string | null;
  dispatch?: Partial<InvoiceDispatch>;
  /** Consignee when goods go somewhere other than the buyer's address. */
  shipTo?: DocumentParty | null;
  amountPaidPaise?: number;
  /** Copies to print, in order; defaults to the original only. */
  copies?: CopyKind[];
}

export interface InvoiceExtras {
  dueDate: string | null;
  reverseCharge: boolean;
  buyerOrderNo: string;
  buyerOrderDate: string | null;
  dispatch: InvoiceDispatch;
  shipTo: DocumentParty | null;
  placeOfSupply: { name: string; code: string };
  amountPaidPaise: number;
  balanceDuePaise: number;
  copies: CopyKind[];
}

export interface InvoiceDocument extends QuoteDocument {
  invoice: InvoiceExtras;
}

export type InvoiceDocumentInput = QuoteDocumentInput & { invoice?: InvoiceExtrasInput };

export function buildInvoiceDocument(input: InvoiceDocumentInput): InvoiceDocument {
  const extras = input.invoice ?? {};
  const party = resolvePartyState(input.party);
  const shipTo = extras.shipTo ? resolvePartyState(extras.shipTo) : null;
  // Goods: place of supply is where movement ends — the consignee when given.
  const supplyParty = shipTo?.stateCode ? shipTo : party;
  const base = buildQuoteDocument({
    ...input,
    party,
    placeOfSupplyCode: supplyParty.stateCode,
    // Invoices never carry an advance request.
    quote: { title: 'Tax Invoice', ...input.quote, advancePct: 0 },
  });
  const amountPaidPaise = Math.max(0, extras.amountPaidPaise ?? 0);
  const state = findGstState(supplyParty.stateCode);

  return {
    ...base,
    invoice: {
      dueDate: extras.dueDate ?? null,
      reverseCharge: extras.reverseCharge ?? false,
      buyerOrderNo: extras.buyerOrderNo ?? '',
      buyerOrderDate: extras.buyerOrderDate ?? null,
      dispatch: { ...EMPTY_DISPATCH, ...extras.dispatch },
      shipTo,
      placeOfSupply: { name: state?.name ?? supplyParty.stateName, code: state?.code ?? supplyParty.stateCode },
      amountPaidPaise,
      balanceDuePaise: Math.max(0, base.totals.grandTotalPaise - amountPaidPaise),
      copies: extras.copies && extras.copies.length > 0 ? COPY_KINDS.filter((kind) => extras.copies?.includes(kind)) : ['original'],
    },
  };
}
