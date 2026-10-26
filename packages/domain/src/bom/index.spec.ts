import { describe, expect, it } from 'vitest';

import { BomUnit, aggregateBom, computeBom, computeMaterialRequirement } from './index.js';

describe('BOM calculation', () => {
  it('computes a requirement without wastage', () => {
    expect(computeMaterialRequirement(500, 0.42, BomUnit.SqM, 0)).toBe(210);
  });

  it('includes the wastage allowance', () => {
    expect(computeMaterialRequirement(500, 0.42, BomUnit.SqM, 3)).toBe(216.3);
  });

  it('rounds discrete units up to a whole unit', () => {
    expect(computeMaterialRequirement(250, 1, BomUnit.Sheet, 0)).toBe(250);
    expect(computeMaterialRequirement(251, 1, BomUnit.Sheet, 0)).toBe(251);
  });

  it('keeps continuous units to three decimals', () => {
    expect(computeMaterialRequirement(3, 0.3333, BomUnit.Kg, 0)).toBe(1);
  });

  it('rejects negative inputs', () => {
    expect(() => computeMaterialRequirement(-1, 1, BomUnit.Sheet, 0)).toThrow();
  });

  it('computes a full BOM for an order line', () => {
    const requirements = computeBom(500, [
      {
        materialId: 'kraft',
        quantityPerUnit: 0.42,
        unit: BomUnit.SqM,
        wastagePct: 3,
        isPrimary: true,
      },
      {
        materialId: 'glue',
        quantityPerUnit: 0.01,
        unit: BomUnit.Ml,
        wastagePct: 0,
        isPrimary: false,
      },
    ]);

    expect(requirements).toHaveLength(2);
    expect(requirements[0]).toMatchObject({ materialId: 'kraft', requiredQty: 216.3 });
    expect(requirements[1]).toMatchObject({ materialId: 'glue', requiredQty: 5 });
  });

  it('aggregates requirements by material', () => {
    const aggregated = aggregateBom([
      { materialId: 'kraft', requiredQty: 100, unit: BomUnit.SqM },
      { materialId: 'kraft', requiredQty: 50, unit: BomUnit.SqM },
      { materialId: 'glue', requiredQty: 5, unit: BomUnit.Ml },
    ]);

    expect(aggregated.get('kraft')?.requiredQty).toBe(150);
    expect(aggregated.get('glue')?.requiredQty).toBe(5);
  });
});
