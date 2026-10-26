import { add, multiply, percentOf } from '../money/index.js';

/**
 * Pricing engine. One implementation runs in the browser (live quote, display
 * only) and on the server (authoritative recomputation on every write).
 *
 * Rules are evaluated in `priority` order; the first match per rule type wins,
 * then the best (lowest) unit price is chosen. The server always recomputes.
 */

export const PrintType = {
  None: 'none',
  Single: 'single',
  Multi: 'multi',
} as const;

export type PrintType = (typeof PrintType)[keyof typeof PrintType];

export const RuleScope = {
  Sku: 'sku',
  Category: 'category',
  Customer: 'customer',
  Segment: 'segment',
} as const;

export type RuleScope = (typeof RuleScope)[keyof typeof RuleScope];

export const RuleType = {
  Percentage: 'percentage',
  FixedPerUnit: 'fixed_per_unit',
  FixedPerOrder: 'fixed_per_order',
} as const;

export type RuleType = (typeof RuleType)[keyof typeof RuleType];

export interface PriceRule {
  id: string;
  scope: RuleScope;
  ruleType: RuleType;
  value: number;
  priority: number;
  skuId?: string;
  category?: string;
  customerId?: string;
  segment?: string;
  minQty?: number;
  maxQty?: number;
  validFrom?: Date;
  validTo?: Date;
  isActive: boolean;
}

export interface PrintSpec {
  type: PrintType;
  sides: number;
  colors: number;
  plateChargePaise: number;
}

export interface QuoteItemInput {
  skuId: string;
  category: string;
  quantity: number;
  basePricePaise: number;
  print?: PrintSpec | null;
  taxRate: number;
  customerId?: string;
  segment?: string;
}

export interface QuoteOptions {
  /** State code of supply, e.g. `33` for Tamil Nadu. */
  placeOfSupply: string;
  /** State code of the customer. */
  customerState: string;
}

export interface QuoteItemResult {
  skuId: string;
  quantity: number;
  basePricePaise: number;
  unitPricePaise: number;
  discountPaise: number;
  setupChargePaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lineTotalPaise: number;
}

export interface QuoteResult {
  items: QuoteItemResult[];
  subtotalPaise: number;
  discountPaise: number;
  setupChargePaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
  currency: 'INR';
}

function ruleMatchesScope(rule: PriceRule, input: QuoteItemInput): boolean {
  switch (rule.scope) {
    case RuleScope.Sku:
      return rule.skuId === input.skuId;
    case RuleScope.Category:
      return rule.category === input.category;
    case RuleScope.Customer:
      return Boolean(rule.customerId) && rule.customerId === input.customerId;
    case RuleScope.Segment:
      return Boolean(rule.segment) && rule.segment === input.segment;
  }
}

function ruleIsApplicable(rule: PriceRule, input: QuoteItemInput, now: Date): boolean {
  if (!rule.isActive) return false;
  if (!ruleMatchesScope(rule, input)) return false;
  if (rule.minQty !== undefined && input.quantity < rule.minQty) return false;
  if (rule.maxQty !== undefined && input.quantity > rule.maxQty) return false;
  if (rule.validFrom && now < rule.validFrom) return false;
  if (rule.validTo && now > rule.validTo) return false;
  return true;
}

function candidateUnitPrice(rule: PriceRule, input: QuoteItemInput): number {
  switch (rule.ruleType) {
    case RuleType.Percentage:
      return Math.max(0, input.basePricePaise - percentOf(input.basePricePaise, rule.value));
    case RuleType.FixedPerUnit:
      return Math.max(0, rule.value);
    case RuleType.FixedPerOrder:
      return input.quantity > 0 ? Math.max(0, Math.round(rule.value / input.quantity)) : 0;
  }
}

/**
 * Picks the winning unit price. Rules are evaluated in priority order; the first
 * match per rule type is kept, then the lowest resulting unit price wins.
 */
export function resolveUnitPrice(
  input: QuoteItemInput,
  rules: readonly PriceRule[],
  now: Date = new Date(),
): number {
  const applicable = rules
    .filter((rule) => ruleIsApplicable(rule, input, now))
    .sort((a, b) => a.priority - b.priority);

  const firstPerType = new Map<RuleType, PriceRule>();
  for (const rule of applicable) {
    if (!firstPerType.has(rule.ruleType)) firstPerType.set(rule.ruleType, rule);
  }

  let best = input.basePricePaise;
  for (const rule of firstPerType.values()) {
    const candidate = candidateUnitPrice(rule, input);
    if (candidate < best) best = candidate;
  }

  return Math.max(0, Math.round(best));
}

function splitTax(
  taxablePaise: number,
  taxRate: number,
  options: QuoteOptions,
): { cgstPaise: number; sgstPaise: number; igstPaise: number } {
  const intraState = options.placeOfSupply === options.customerState;
  if (intraState) {
    const half = percentOf(taxablePaise, taxRate / 2);
    return { cgstPaise: half, sgstPaise: half, igstPaise: 0 };
  }
  return { cgstPaise: 0, sgstPaise: 0, igstPaise: percentOf(taxablePaise, taxRate) };
}

/** Quotes a single line item, tax included. */
export function quoteItem(
  input: QuoteItemInput,
  rules: readonly PriceRule[],
  options: QuoteOptions,
  now: Date = new Date(),
): QuoteItemResult {
  const unitPricePaise = resolveUnitPrice(input, rules, now);
  const baseTotal = multiply(input.basePricePaise, input.quantity);
  const discountedTotal = multiply(unitPricePaise, input.quantity);
  const discountPaise = Math.max(0, baseTotal - discountedTotal);

  const setupChargePaise =
    input.print && input.print.type !== PrintType.None ? input.print.plateChargePaise : 0;

  const taxablePaise = add(discountedTotal, setupChargePaise);
  const { cgstPaise, sgstPaise, igstPaise } = splitTax(taxablePaise, input.taxRate, options);
  const lineTotalPaise = add(taxablePaise, cgstPaise, sgstPaise, igstPaise);

  return {
    skuId: input.skuId,
    quantity: input.quantity,
    basePricePaise: input.basePricePaise,
    unitPricePaise,
    discountPaise,
    setupChargePaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    lineTotalPaise,
  };
}

/**
 * Distributes a (possibly negative) integer delta across `count` slots so the
 * deltas always sum exactly to `delta`. Used to push the invoice round-off onto
 * the line totals, keeping `sum(lineTotalPaise) === grandTotalPaise`.
 */
function distributeDelta(delta: number, count: number): number[] {
  if (count <= 0 || !Number.isFinite(delta)) return [];
  const base = Math.trunc(delta / count);
  let remainder = delta - base * count;
  const deltas = Array.from({ length: count }, () => base);

  let index = 0;
  while (remainder !== 0) {
    const step = remainder > 0 ? 1 : -1;
    deltas[index % count] = (deltas[index % count] ?? 0) + step;
    remainder -= step;
    index += 1;
  }

  return deltas;
}

/** Quotes a basket of line items, with round-off applied to the grand total. */
export function quote(
  items: readonly QuoteItemInput[],
  rules: readonly PriceRule[],
  options: QuoteOptions,
  now: Date = new Date(),
): QuoteResult {
  const results = items.map((item) => quoteItem(item, rules, options, now));

  const subtotalPaise = add(...results.map((r) => multiply(r.basePricePaise, r.quantity)));
  const discountPaise = add(...results.map((r) => r.discountPaise));
  const setupChargePaise = add(...results.map((r) => r.setupChargePaise));
  const taxablePaise = add(...results.map((r) => r.taxablePaise));
  const cgstPaise = add(...results.map((r) => r.cgstPaise));
  const sgstPaise = add(...results.map((r) => r.sgstPaise));
  const igstPaise = add(...results.map((r) => r.igstPaise));
  const taxPaise = add(cgstPaise, sgstPaise, igstPaise);

  const preRound = add(taxablePaise, taxPaise);
  const rounded = Math.round(preRound / 100) * 100;
  const roundOffPaise = rounded - preRound;

  // Push the round-off onto the line totals so they sum to the grand total.
  const deltas = distributeDelta(roundOffPaise, results.length);
  results.forEach((result, index) => {
    result.lineTotalPaise += deltas[index] ?? 0;
  });

  return {
    items: results,
    subtotalPaise,
    discountPaise,
    setupChargePaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    taxPaise,
    roundOffPaise,
    grandTotalPaise: rounded,
    currency: 'INR',
  };
}
