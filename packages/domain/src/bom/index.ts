/**
 * Bill-of-materials calculation. Pure and side-effect free.
 *
 * The raw requirement for a run is:
 *
 *   required = quantity * quantityPerUnit * (1 + wastagePct / 100)
 *
 * Discrete units (sheets, pieces) are rounded up so a job never consumes more
 * than it reserved; continuous units (sq m, kg, ml) keep three decimals.
 */

export const BomUnit = {
  SqM: 'sq_m',
  Sheet: 'sheet',
  Kg: 'kg',
  Ml: 'ml',
  Pcs: 'pcs',
  Roll: 'roll',
} as const;

export type BomUnit = (typeof BomUnit)[keyof typeof BomUnit];

export interface BomLineInput {
  materialId: string;
  quantityPerUnit: number;
  unit: BomUnit;
  wastagePct: number;
  isPrimary: boolean;
}

export interface BomRequirement {
  materialId: string;
  unit: BomUnit;
  quantityPerUnit: number;
  wastagePct: number;
  requiredQty: number;
  isPrimary: boolean;
}

/** Units that cannot be bought fractionally. */
const DISCRETE_UNITS: readonly BomUnit[] = [BomUnit.Sheet, BomUnit.Pcs, BomUnit.Roll];

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function ceil(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.ceil(value * factor) / factor;
}

/**
 * Computes the raw material required for `quantity` units, including the wastage
 * allowance. Discrete units are rounded up to the next whole unit; continuous
 * units are rounded up to three decimals.
 */
export function computeMaterialRequirement(
  quantity: number,
  quantityPerUnit: number,
  unit: BomUnit,
  wastagePct = 0,
): number {
  if (quantity < 0 || quantityPerUnit < 0 || wastagePct < 0) {
    throw new Error('computeMaterialRequirement requires non-negative inputs');
  }

  const raw = quantity * quantityPerUnit * (1 + wastagePct / 100);
  if (DISCRETE_UNITS.includes(unit)) return ceil(raw, 0);
  return round(raw, 3);
}

/** Computes the material requirement for every BOM line of an order. */
export function computeBom(quantity: number, lines: readonly BomLineInput[]): BomRequirement[] {
  return lines.map((line) => ({
    materialId: line.materialId,
    unit: line.unit,
    quantityPerUnit: line.quantityPerUnit,
    wastagePct: line.wastagePct,
    isPrimary: line.isPrimary,
    requiredQty: computeMaterialRequirement(
      quantity,
      line.quantityPerUnit,
      line.unit,
      line.wastagePct,
    ),
  }));
}

/**
 * Aggregates requirements across multiple order items so the planner reserves
 * material once per material id rather than once per line.
 */
export function aggregateBom(
  entries: readonly { materialId: string; requiredQty: number; unit: BomUnit }[],
): Map<string, BomRequirement> {
  const aggregated = new Map<string, BomRequirement>();

  for (const entry of entries) {
    const existing = aggregated.get(entry.materialId);
    if (existing) {
      existing.requiredQty = round(existing.requiredQty + entry.requiredQty, 3);
    } else {
      aggregated.set(entry.materialId, {
        materialId: entry.materialId,
        unit: entry.unit,
        quantityPerUnit: 0,
        wastagePct: 0,
        isPrimary: false,
        requiredQty: entry.requiredQty,
      });
    }
  }

  return aggregated;
}
