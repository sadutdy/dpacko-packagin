/**
 * Draft model shared by every document editor (quotes, invoices, …): the
 * buyer, its per-document overrides, priced lines, terms and remarks, plus
 * the input ⇄ paise conversions and their validation.
 */
import { rupeesToPaise, type CustomerLike, type DocumentParty } from '@ameen/domain';

export const GST_SLABS = [0, 5, 12, 18, 28] as const;
export const UNITS = ['NOS', 'PCS', 'BOX', 'PKT', 'SET', 'KG', 'ROLL', 'BUNDLE'] as const;

/** Quick-add terms offered in the Terms step. */
export const TERM_PRESETS = [
  '50% advance along with the purchase order, balance before dispatch.',
  'Delivery within 10 working days from artwork approval.',
  'Prices are ex-works; transportation extra at actuals.',
  'GST as applicable at the time of invoicing.',
  'Quantity variation of ±5% is acceptable for printed items.',
  'Interest @18% p.a. will be charged on bills not paid by the due date.',
  'Goods once sold will not be taken back.',
  'Subject to Malappuram jurisdiction.',
] as const;

export interface CustomerOption extends CustomerLike {
  _id: string;
  customerCode?: string;
  paymentTermsDays?: number;
}

export interface SkuOption {
  _id: string;
  name: string;
  skuCode: string;
  pricing: { basePricePaise: number; taxRate: number; hsnCode?: string; minQty?: number };
}

export interface LineDraft {
  /** Stable React key; not persisted. */
  key: string;
  skuId: string | null;
  name: string;
  description: string;
  hsn: string;
  quantity: string;
  unit: string;
  /** Rupees as typed, e.g. "2.35". */
  rate: string;
  setupCharge: string;
  taxRate: number;
  /** True while the rate follows the customer's price rules for the SKU. */
  autoRate: boolean;
}

export interface PartyOverrideDraft {
  name: string;
  /** One printed address line per row. */
  address: string;
  gstin: string;
  stateName: string;
  phone: string;
}

/** Fields every document draft has; generic steps only touch these. */
export interface CoreDraft {
  customerId: string;
  partyOverride: PartyOverrideDraft;
  lines: LineDraft[];
  terms: string[];
  notes: string;
}

/** Stored line shape (API ⇄ editor). */
export interface LinePayload {
  skuId: string | null;
  name: string;
  description: string;
  hsn: string;
  quantity: number;
  unit: string;
  ratePaise: number;
  setupChargePaise: number;
  taxRate: number;
}

/** Stored override shape (API ⇄ editor). */
export interface OverridePayload {
  name: string;
  addressLines: string[];
  gstin: string;
  stateName: string;
  phone: string;
}

export type FieldErrors = Record<string, string>;

let keySeq = 0;
const nextKey = () => `line-${Date.now().toString(36)}-${(keySeq += 1)}`;

/** `yyyy-mm-dd` in local time, `days` from `from` (today by default). */
export function isoDay(days = 0, from = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA');
}

/** `yyyy-mm-dd` → ISO timestamp at local midnight, or null when blank. */
export function dayToIso(day: string): string | null {
  return day ? new Date(`${day}T00:00:00`).toISOString() : null;
}

/** Paise → editable rupee string: 235 → "2.35", 5000 → "50". */
export function paiseToInput(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

/** Rupee input → paise, or null when blank/invalid. */
export function inputToPaise(value: string): number | null {
  if (value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? rupeesToPaise(number) : null;
}

export function inputToQty(value: string): number | null {
  const number = Number(value);
  return value.trim() !== '' && Number.isInteger(number) && number > 0 ? number : null;
}

export function newLine(partial: Partial<LineDraft> = {}): LineDraft {
  return {
    skuId: null,
    name: '',
    description: '',
    hsn: '4819',
    quantity: '',
    unit: 'NOS',
    rate: '',
    setupCharge: '',
    taxRate: 18,
    autoRate: false,
    ...partial,
    key: partial.key ?? nextKey(),
  };
}

/** Line pre-filled from a catalog SKU; the rate is refreshed from price rules. */
export function lineFromSku(sku: SkuOption, base?: LineDraft): LineDraft {
  return {
    ...(base ?? newLine()),
    skuId: sku._id,
    name: sku.name,
    description: base?.description ?? '',
    hsn: sku.pricing.hsnCode || '4819',
    quantity: base?.quantity || String(sku.pricing.minQty ?? ''),
    rate: paiseToInput(sku.pricing.basePricePaise),
    taxRate: sku.pricing.taxRate,
    autoRate: true,
  };
}

export const EMPTY_OVERRIDE: PartyOverrideDraft = { name: '', address: '', gstin: '', stateName: '', phone: '' };

export function overrideFromPayload(source: OverridePayload): PartyOverrideDraft {
  return {
    name: source.name,
    address: source.addressLines.join('\n'),
    gstin: source.gstin,
    stateName: source.stateName,
    phone: source.phone,
  };
}

export function overrideToPayload(override: PartyOverrideDraft): OverridePayload {
  return {
    name: override.name.trim(),
    addressLines: override.address.split('\n').map((line) => line.trim()).filter(Boolean),
    gstin: override.gstin.trim().toUpperCase(),
    stateName: override.stateName.trim(),
    phone: override.phone.trim(),
  };
}

/** Saved lines keep their agreed rate until the user resets it. */
export function linesFromPayload(items: LinePayload[]): LineDraft[] {
  return items.map((item) =>
    newLine({
      skuId: item.skuId,
      name: item.name,
      description: item.description,
      hsn: item.hsn,
      quantity: String(item.quantity),
      unit: item.unit,
      rate: paiseToInput(item.ratePaise),
      setupCharge: item.setupChargePaise ? paiseToInput(item.setupChargePaise) : '',
      taxRate: item.taxRate,
      autoRate: false,
    }),
  );
}

export function linesToPayload(lines: LineDraft[]): LinePayload[] {
  return lines.map((line) => ({
    skuId: line.skuId,
    name: line.name.trim(),
    description: line.description.trim(),
    hsn: line.hsn.trim(),
    quantity: inputToQty(line.quantity) ?? 0,
    unit: line.unit.trim() || 'NOS',
    ratePaise: inputToPaise(line.rate) ?? 0,
    setupChargePaise: inputToPaise(line.setupCharge) ?? 0,
    taxRate: line.taxRate,
  }));
}

/** Lines for a live preview: half-typed rows show as "Untitled item". */
export function previewLines(lines: LineDraft[]): LinePayload[] {
  return linesToPayload(lines)
    .filter((item, index) => item.name || lines[index]?.quantity)
    .map((item) => ({ ...item, name: item.name || 'Untitled item' }));
}

export function cleanTerms(terms: string[]): string[] {
  return terms.map((term) => term.trim()).filter(Boolean);
}

export const NO_CUSTOMER: DocumentParty = {
  name: 'Select a customer',
  addressLines: [],
  phone: '',
  gstin: '',
  stateName: '',
  stateCode: '',
};

const GSTIN_PATTERN = /^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][0-9A-Za-z][Zz][0-9A-Za-z]$/;

export function isGstin(value: string): boolean {
  return GSTIN_PATTERN.test(value.trim());
}

/**
 * Validation for the shared steps: `party` and `items`. Keys are `field` or
 * `lines.<index>.<field>`; document editors add their own steps on top.
 */
export function validateCore(step: string, draft: CoreDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (step === 'party') {
    if (!draft.customerId) errors.customerId = 'Choose a customer.';
    const gstin = draft.partyOverride.gstin.trim();
    if (gstin && !isGstin(gstin)) errors.gstin = 'Not a valid GSTIN.';
  }
  if (step === 'items') {
    if (draft.lines.length === 0) errors.lines = 'Add at least one item.';
    draft.lines.forEach((line, index) => {
      if (!line.name.trim()) errors[`lines.${index}.name`] = 'Name the item.';
      if (inputToQty(line.quantity) === null) errors[`lines.${index}.quantity`] = 'Whole number above 0.';
      if (inputToPaise(line.rate) === null) errors[`lines.${index}.rate`] = 'Enter a rate.';
      if (line.setupCharge.trim() && inputToPaise(line.setupCharge) === null) errors[`lines.${index}.setupCharge`] = 'Invalid amount.';
    });
  }
  return errors;
}
