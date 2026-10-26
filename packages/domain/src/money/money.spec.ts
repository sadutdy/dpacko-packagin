import { describe, expect, it } from 'vitest';

import {
  add,
  allocatePaise,
  amountInWords,
  applyDiscount,
  formatINR,
  multiply,
  percentOf,
  paiseToRupees,
  rupeesToPaise,
  splitEqually,
  subtract,
} from './index.js';

describe('money conversions', () => {
  it('converts rupees to paise without float drift', () => {
    expect(rupeesToPaise(10)).toBe(1000);
    expect(rupeesToPaise(0.1)).toBe(10);
    expect(rupeesToPaise(1234.56)).toBe(123456);
  });

  it('converts paise to rupees', () => {
    expect(paiseToRupees(123456)).toBe(1234.56);
    expect(paiseToRupees(0)).toBe(0);
  });
});

describe('paise arithmetic', () => {
  it('adds and subtracts', () => {
    expect(add(100, 250, 25)).toBe(375);
    expect(subtract(500, 125)).toBe(375);
  });

  it('multiplies and rounds to the nearest paise', () => {
    expect(multiply(1250, 500)).toBe(625000);
    // 333 * 3 = 999 exactly, but a fractional unit price must still land on whole paise.
    expect(multiply(333, 3)).toBe(999);
    expect(multiply(1050, 3)).toBe(3150);
    expect(Number.isInteger(multiply(333, 7))).toBe(true);
  });

  it('computes a percentage of an amount', () => {
    expect(percentOf(1000, 18)).toBe(180);
    expect(percentOf(1000, 0)).toBe(0);
    expect(percentOf(999, 18)).toBe(180);
  });

  it('applies a discount without going negative', () => {
    expect(applyDiscount(1000, 10)).toBe(900);
    expect(applyDiscount(1000, 0)).toBe(1000);
    expect(applyDiscount(1000, 100)).toBe(0);
    expect(applyDiscount(1000, 150)).toBe(0);
  });
});

describe('allocatePaise', () => {
  it('splits exactly with no lost paise', () => {
    const parts = allocatePaise(100, [1, 1, 1]);
    expect(parts).toEqual([34, 33, 33]);
    expect(add(...parts)).toBe(100);
  });

  it('always sums to the total, whatever the weights', () => {
    const totals = [100, 999, 1001, 7, 12345];
    const weightSets = [
      [1, 1, 1],
      [3, 7],
      [5, 3, 2],
      [1, 1, 1, 1, 1, 1, 1],
      [100, 1],
    ];

    for (const total of totals) {
      for (const weights of weightSets) {
        const parts = allocatePaise(total, weights);
        expect(add(...parts)).toBe(total);
        expect(parts.every((part) => Number.isInteger(part))).toBe(true);
      }
    }
  });

  it('is deterministic for equal weights', () => {
    expect(allocatePaise(10, [1, 1, 1, 1])).toEqual(allocatePaise(10, [1, 1, 1, 1]));
  });

  it('gives the remainder to the largest fractional part', () => {
    // 100 * 1/3 = 33.33, 100 * 2/3 = 66.67 -> the second gets the extra paise.
    expect(allocatePaise(100, [1, 2])).toEqual([33, 67]);
  });

  it('rejects a zero or negative weight sum', () => {
    expect(() => allocatePaise(100, [0, 0])).toThrow();
    expect(allocatePaise(100, [])).toEqual([]);
  });
});

describe('splitEqually', () => {
  it('splits exactly with a remainder distributed to the earliest parts', () => {
    expect(splitEqually(100, 3)).toEqual([34, 33, 33]);
    expect(splitEqually(10, 4)).toEqual([3, 3, 2, 2]);
    expect(splitEqually(9, 3)).toEqual([3, 3, 3]);
  });

  it('rejects a non-positive count', () => {
    expect(() => splitEqually(100, 0)).toThrow();
    expect(() => splitEqually(100, 2.5)).toThrow();
  });
});

describe('formatINR', () => {
  it('groups digits the Indian way', () => {
    expect(formatINR(12345678)).toContain('1,23,456.78');
    expect(formatINR(0)).toContain('0.00');
  });
});

describe('amountInWords', () => {
  it('renders rupees using lakh/crore grouping', () => {
    expect(amountInWords(100)).toBe('Rupees One Only');
    expect(amountInWords(100000)).toBe('Rupees One Thousand Only');
    expect(amountInWords(10000000)).toBe('Rupees One Lakh Only');
    expect(amountInWords(100000000)).toBe('Rupees Ten Lakh Only');
    expect(amountInWords(1000000000)).toBe('Rupees One Crore Only');
  });

  it('renders composite amounts', () => {
    expect(amountInWords(12345678)).toBe(
      'Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only',
    );
  });

  it('renders zero', () => {
    expect(amountInWords(0)).toBe('Rupees Zero Only');
  });

  it('handles negatives', () => {
    expect(amountInWords(-100)).toBe('Minus Rupees One Only');
  });

  it('renders fractional paise with the "Only" suffix', () => {
    expect(amountInWords(150)).toBe('Rupees One and Fifty Paise Only');
  });
});
