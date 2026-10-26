/**
 * Builds the printable quotation / proforma-invoice document from a stored
 * quote. Pure: the API supplies the seller, party and priced lines; this module
 * owns the GST presentation rules (intra vs inter-state split, HSN summary,
 * round-off, amounts in words) so every layout renders identical figures.
 */
import { stateFromGstin, findGstState } from '../gst/states.js';
import { add, inrWords, multiply, percentOf } from '../money/index.js';

export type SupplyType = 'intra' | 'inter';
export type TaxLabel = 'CGST' | 'SGST' | 'IGST';

export interface DocumentParty {
  name: string;
  addressLines: string[];
  phone: string;
  gstin: string;
  stateName: string;
  stateCode: string;
}

export interface DocumentBank {
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
}

export interface DocumentSeller extends DocumentParty {
  logo: string;
  website: string;
  declaration: string;
  bank: DocumentBank | null;
}

export interface QuoteDocumentLineInput {
  name: string;
  description?: string;
  hsn: string;
  quantity: number;
  unit: string;
  /** Unit rate after discounts, integer paise. */
  ratePaise: number;
  /** Plate/setup charge folded into the line's taxable value. */
  setupChargePaise?: number;
  taxRate: number;
}

export const QUOTE_TITLES = ['Proforma Invoice', 'Quotation'] as const;
export type QuoteTitle = (typeof QUOTE_TITLES)[number];
export const INVOICE_TITLES = ['Tax Invoice', 'Bill of Supply'] as const;
export type InvoiceTitle = (typeof INVOICE_TITLES)[number];
/** Any title a printed business document can carry. */
export type DocumentTitle = QuoteTitle | InvoiceTitle;

/** Per-quote presentation settings chosen in the quote editor. */
export interface QuotePresentation {
  title: DocumentTitle;
  /** Layout id from the admin layout registry (`classic`, `modern`, …). */
  layout: string;
  /** 0 hides the advance section. */
  advancePct: number;
  terms: string[];
  notes: string;
}

export const DEFAULT_PRESENTATION: QuotePresentation = {
  title: 'Proforma Invoice',
  layout: 'classic',
  advancePct: 50,
  terms: [],
  notes: '',
};

export interface QuoteDocumentInput {
  quote: {
    id: string;
    number: string;
    refNo?: string;
    date: string;
    validUntil?: string | null;
    status: string;
  } & Partial<QuotePresentation>;
  seller: DocumentSeller;
  party: DocumentParty;
  lines: QuoteDocumentLineInput[];
  /**
   * State code that decides CGST+SGST vs IGST. Defaults to the party's state;
   * invoices pass the ship-to state (where the goods' movement ends).
   */
  placeOfSupplyCode?: string;
}

export interface QuoteDocumentLine {
  sl: number;
  name: string;
  description: string;
  hsn: string;
  quantity: number;
  unit: string;
  ratePaise: number;
  setupChargePaise: number;
  amountPaise: number;
  taxRate: number;
}

export interface DocumentTaxLine {
  label: TaxLabel;
  ratePct: number;
  amountPaise: number;
}

export interface HsnTaxPart {
  ratePct: number;
  amountPaise: number;
}

export interface HsnSummaryRow {
  hsn: string;
  taxablePaise: number;
  cgst: HsnTaxPart | null;
  sgst: HsnTaxPart | null;
  igst: HsnTaxPart | null;
  totalTaxPaise: number;
}

export interface QuoteDocument {
  quote: QuoteDocumentInput['quote'] & QuotePresentation & { refNo: string; validUntil: string | null };
  seller: DocumentSeller;
  party: DocumentParty;
  supply: SupplyType;
  lines: QuoteDocumentLine[];
  taxes: DocumentTaxLine[];
  hsnSummary: HsnSummaryRow[];
  totals: {
    quantity: number;
    /** Set when every line shares a unit, so the total row can print it. */
    unit: string | null;
    taxablePaise: number;
    taxPaise: number;
    roundOffPaise: number;
    grandTotalPaise: number;
  };
  words: { amount: string; tax: string };
}

/** Fills a party's state name/code from its GSTIN, then from a stated name/abbr. */
export function resolvePartyState<T extends { gstin: string; stateName: string; stateCode: string }>(party: T): T {
  const state = findGstState(party.stateCode) ?? stateFromGstin(party.gstin) ?? findGstState(party.stateName);
  if (!state) return party;
  return { ...party, stateName: state.name, stateCode: state.code };
}

/** Intra-state when both sides are in the same state (or either is unknown). */
export function supplyType(sellerStateCode: string, partyStateCode: string): SupplyType {
  if (!sellerStateCode || !partyStateCode) return 'intra';
  return sellerStateCode === partyStateCode ? 'intra' : 'inter';
}

function lineTax(taxablePaise: number, taxRate: number, supply: SupplyType) {
  if (supply === 'intra') {
    const half = percentOf(taxablePaise, taxRate / 2);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: percentOf(taxablePaise, taxRate) };
}

export function buildQuoteDocument(input: QuoteDocumentInput): QuoteDocument {
  const seller = resolvePartyState(input.seller);
  const party = resolvePartyState(input.party);
  const supply = supplyType(seller.stateCode, input.placeOfSupplyCode || party.stateCode);

  const lines: QuoteDocumentLine[] = input.lines.map((line, index) => {
    const setupChargePaise = line.setupChargePaise ?? 0;
    return {
      sl: index + 1,
      name: line.name,
      description: line.description ?? '',
      hsn: line.hsn || '—',
      quantity: line.quantity,
      unit: line.unit || 'NOS',
      ratePaise: line.ratePaise,
      setupChargePaise,
      amountPaise: add(multiply(line.ratePaise, line.quantity), setupChargePaise),
      taxRate: line.taxRate,
    };
  });

  // Group by HSN + rate: one HSN can carry two rates in rare mixed baskets.
  const groups = new Map<string, HsnSummaryRow>();
  const taxByLabelRate = new Map<string, DocumentTaxLine>();
  const addTax = (label: TaxLabel, ratePct: number, amountPaise: number) => {
    if (amountPaise === 0) return;
    const key = `${label}|${ratePct}`;
    const existing = taxByLabelRate.get(key);
    if (existing) existing.amountPaise += amountPaise;
    else taxByLabelRate.set(key, { label, ratePct, amountPaise });
  };

  for (const line of lines) {
    const tax = lineTax(line.amountPaise, line.taxRate, supply);
    const half = line.taxRate / 2;
    addTax('CGST', half, tax.cgst);
    addTax('SGST', half, tax.sgst);
    addTax('IGST', line.taxRate, tax.igst);

    const key = `${line.hsn}|${line.taxRate}`;
    const row = groups.get(key) ?? {
      hsn: line.hsn,
      taxablePaise: 0,
      cgst: supply === 'intra' ? { ratePct: half, amountPaise: 0 } : null,
      sgst: supply === 'intra' ? { ratePct: half, amountPaise: 0 } : null,
      igst: supply === 'inter' ? { ratePct: line.taxRate, amountPaise: 0 } : null,
      totalTaxPaise: 0,
    };
    row.taxablePaise += line.amountPaise;
    if (row.cgst) row.cgst.amountPaise += tax.cgst;
    if (row.sgst) row.sgst.amountPaise += tax.sgst;
    if (row.igst) row.igst.amountPaise += tax.igst;
    row.totalTaxPaise += tax.cgst + tax.sgst + tax.igst;
    groups.set(key, row);
  }

  const taxes = [...taxByLabelRate.values()];
  const taxablePaise = add(...lines.map((line) => line.amountPaise));
  const taxPaise = add(...taxes.map((tax) => tax.amountPaise));
  const preRound = add(taxablePaise, taxPaise);
  const grandTotalPaise = Math.round(preRound / 100) * 100;
  const units = new Set(lines.map((line) => line.unit));

  return {
    quote: {
      ...DEFAULT_PRESENTATION,
      ...input.quote,
      refNo: input.quote.refNo ?? '',
      validUntil: input.quote.validUntil ?? null,
    },
    seller,
    party,
    supply,
    lines,
    taxes,
    hsnSummary: [...groups.values()],
    totals: {
      quantity: add(...lines.map((line) => line.quantity)),
      unit: units.size === 1 ? ([...units][0] ?? null) : null,
      taxablePaise,
      taxPaise,
      roundOffPaise: grandTotalPaise - preRound,
      grandTotalPaise,
    },
    words: { amount: inrWords(grandTotalPaise), tax: inrWords(taxPaise) },
  };
}

/** Address shape stored on CRM customers (all fields optional). */
export interface CustomerAddressLike {
  line1?: string;
  line2?: string;
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  isDefault?: boolean;
}

export interface CustomerLike {
  businessName: string;
  phone?: string;
  gstin?: string | null;
  addresses?: readonly CustomerAddressLike[];
}

/** Per-quote edits to the buyer block; empty values keep the customer's own. */
export interface PartyOverride {
  name?: string;
  addressLines?: string[];
  gstin?: string;
  stateName?: string;
  phone?: string;
}

function joinNonEmpty(values: (string | undefined)[], separator: string): string {
  return values.map((value) => (value ?? '').trim()).filter(Boolean).join(separator);
}

/** Buyer block from a CRM customer and its default (or first) address. */
export function partyFromCustomer(customer: CustomerLike): DocumentParty {
  const address = customer.addresses?.find((entry) => entry.isDefault) ?? customer.addresses?.[0];
  const addressLines = address
    ? [
        joinNonEmpty([address.line1, address.line2], ', '),
        joinNonEmpty([address.area, address.city, address.district], ', '),
        (address.pincode ?? '').trim(),
      ].filter(Boolean)
    : [];
  return {
    name: customer.businessName,
    addressLines,
    phone: customer.phone ?? '',
    gstin: customer.gstin ?? '',
    stateName: address?.state ?? '',
    stateCode: '',
  };
}

/** Applies non-empty overrides; a changed GSTIN or state re-derives the code. */
export function applyPartyOverride(party: DocumentParty, override: PartyOverride | null | undefined): DocumentParty {
  if (!override) return party;
  const lines = override.addressLines?.map((line) => line.trim()).filter(Boolean) ?? [];
  const next: DocumentParty = {
    name: override.name?.trim() || party.name,
    addressLines: lines.length > 0 ? lines : party.addressLines,
    phone: override.phone?.trim() || party.phone,
    gstin: override.gstin?.trim().toUpperCase() || party.gstin,
    stateName: override.stateName?.trim() || party.stateName,
    stateCode: party.stateCode,
  };
  // An explicit state wins over the GSTIN prefix; a new GSTIN alone re-derives it.
  const forced = findGstState(override.stateName);
  if (forced) return { ...next, stateName: forced.name, stateCode: forced.code };
  if (next.gstin !== party.gstin || next.stateName !== party.stateName) next.stateCode = '';
  return next;
}

/** Totals in the stored `pricing` shape (orders/quotes collections). */
export function pricingFromDocument(doc: QuoteDocument) {
  const sum = (label: TaxLabel) => add(...doc.taxes.filter((tax) => tax.label === label).map((tax) => tax.amountPaise));
  return {
    subtotalPaise: doc.totals.taxablePaise,
    discountPaise: 0,
    setupChargePaise: add(...doc.lines.map((line) => line.setupChargePaise)),
    taxPaise: doc.totals.taxPaise,
    cgstPaise: sum('CGST'),
    sgstPaise: sum('SGST'),
    igstPaise: sum('IGST'),
    roundOffPaise: doc.totals.roundOffPaise,
    grandTotalPaise: doc.totals.grandTotalPaise,
    currency: 'INR' as const,
  };
}

export interface AdvanceResult {
  pct: number;
  /** Exact percentage of the grand total. */
  exactPaise: number;
  /** Rounding applied (negative when rounded down). */
  roundOffPaise: number;
  /** Advance actually requested. */
  advancePaise: number;
}

/**
 * Advance payment request, rounded to the nearest `roundToPaise`
 * (default ₹1,000). `advance(148050000, 50)` → 7,40,250.00 exact, 7,40,000.00 due.
 */
export function advance(grandTotalPaise: number, pct: number, roundToPaise = 100_000): AdvanceResult {
  const clamped = Math.min(100, Math.max(0, pct));
  const exactPaise = percentOf(grandTotalPaise, clamped);
  const step = roundToPaise > 0 ? roundToPaise : 1;
  const advancePaise = Math.round(exactPaise / step) * step;
  return { pct: clamped, exactPaise, roundOffPaise: advancePaise - exactPaise, advancePaise };
}
