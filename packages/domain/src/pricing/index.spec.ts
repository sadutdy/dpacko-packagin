import { describe, expect, it } from 'vitest';

import { add, multiply } from '../money/index.js';
import {
  PrintType,
  RuleScope,
  RuleType,
  quote,
  quoteItem,
  resolveUnitPrice,
  type PriceRule,
  type QuoteItemInput,
} from './index.js';

const TN = { placeOfSupply: '33', customerState: '33' };
const OTHER = { placeOfSupply: '33', customerState: '29' };

function rule(
  overrides: Partial<PriceRule> & Pick<PriceRule, 'id' | 'ruleType' | 'value'>,
): PriceRule {
  return {
    scope: RuleScope.Sku,
    skuId: 'BOX-1',
    priority: 100,
    isActive: true,
    ...overrides,
  };
}

function item(overrides: Partial<QuoteItemInput> = {}): QuoteItemInput {
  return {
    skuId: 'BOX-1',
    category: 'parcel_box',
    quantity: 500,
    basePricePaise: 1000,
    taxRate: 18,
    print: { type: PrintType.None, sides: 0, colors: 0, plateChargePaise: 0 },
    ...overrides,
  };
}

describe('pricing engine', () => {
  it('returns the base price when no rule matches', () => {
    const result = quoteItem(item(), [], TN);
    expect(result.unitPricePaise).toBe(1000);
    expect(result.discountPaise).toBe(0);
  });

  it('applies a percentage rule', () => {
    const rules = [rule({ id: 'r1', ruleType: RuleType.Percentage, value: 10 })];
    const result = quoteItem(item(), rules, TN);
    expect(result.unitPricePaise).toBe(900);
    expect(result.discountPaise).toBe(50_000);
  });

  it('applies a fixed per-unit rule', () => {
    const rules = [rule({ id: 'r1', ruleType: RuleType.FixedPerUnit, value: 850 })];
    const result = quoteItem(item(), rules, TN);
    expect(result.unitPricePaise).toBe(850);
  });

  it('applies a fixed per-order rule across the run', () => {
    const rules = [rule({ id: 'r1', ruleType: RuleType.FixedPerOrder, value: 400_000 })];
    const result = quoteItem(item(), rules, TN);
    expect(result.unitPricePaise).toBe(800);
  });

  it('honours a minimum quantity tier', () => {
    const rules = [rule({ id: 'r1', ruleType: RuleType.Percentage, value: 20, minQty: 250 })];
    expect(resolveUnitPrice(item({ quantity: 100 }), rules)).toBe(1000);
    expect(resolveUnitPrice(item({ quantity: 250 }), rules)).toBe(800);
  });

  it('takes the first matching rule per type in priority order', () => {
    const rules = [
      rule({ id: 'r1', ruleType: RuleType.Percentage, value: 5, priority: 10 }),
      rule({ id: 'r2', ruleType: RuleType.Percentage, value: 20, priority: 20 }),
    ];
    expect(resolveUnitPrice(item(), rules)).toBe(950);
  });

  it('picks the best (lowest) price across rule types', () => {
    const rules = [
      rule({ id: 'r1', ruleType: RuleType.Percentage, value: 10, priority: 10 }),
      rule({ id: 'r2', ruleType: RuleType.FixedPerUnit, value: 950, priority: 20 }),
    ];
    expect(resolveUnitPrice(item(), rules)).toBe(900);
  });

  it('stacks a volume discount on top of the base price', () => {
    const rules = [rule({ id: 'r1', ruleType: RuleType.Percentage, value: 20, minQty: 250 })];
    const result = quoteItem(item(), rules, TN);
    expect(result.unitPricePaise).toBe(800);
    expect(result.taxablePaise).toBe(400_000);
  });

  it('adds the amortised print setup charge once per run', () => {
    const withPrint = item({
      print: { type: PrintType.Single, sides: 1, colors: 1, plateChargePaise: 5000 },
    });
    const result = quoteItem(withPrint, [], TN);
    expect(result.setupChargePaise).toBe(5000);
    expect(result.taxablePaise).toBe(add(multiply(1000, 500), 5000));
  });

  it('splits tax into CGST/SGST for intra-state supply', () => {
    const result = quoteItem(item(), [], TN);
    expect(result.cgstPaise).toBe(45_000);
    expect(result.sgstPaise).toBe(45_000);
    expect(result.igstPaise).toBe(0);
    expect(result.lineTotalPaise).toBe(590_000);
  });

  it('charges IGST for inter-state supply', () => {
    const result = quoteItem(item(), [], OTHER);
    expect(result.igstPaise).toBe(90_000);
    expect(result.cgstPaise).toBe(0);
    expect(result.sgstPaise).toBe(0);
  });

  it('keeps line totals summing to the grand total', () => {
    const result = quote(
      [
        item({ skuId: 'A', quantity: 333, basePricePaise: 1050 }),
        item({ skuId: 'B', quantity: 1000, basePricePaise: 333 }),
      ],
      [],
      TN,
    );

    const lineSum = add(...result.items.map((line) => line.lineTotalPaise));
    expect(lineSum).toBe(result.grandTotalPaise);
    expect(result.grandTotalPaise % 100).toBe(0);
  });

  it('rounds the grand total to the nearest rupee', () => {
    const result = quote([item({ quantity: 1, basePricePaise: 1 })], [], TN);
    expect(result.grandTotalPaise % 100).toBe(0);
  });

  it('ignores inactive and out-of-window rules', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const rules = [
      rule({ id: 'r1', ruleType: RuleType.Percentage, value: 50, isActive: false }),
      rule({
        id: 'r2',
        ruleType: RuleType.Percentage,
        value: 50,
        validFrom: new Date('2027-01-01T00:00:00.000Z'),
      }),
    ];
    expect(resolveUnitPrice(item(), rules, now)).toBe(1000);
  });
});
